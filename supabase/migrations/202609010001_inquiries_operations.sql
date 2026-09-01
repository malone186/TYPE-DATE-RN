-- 운영 가능한 1:1 문의 계약.
-- 기존 문의와 메시지는 보존하고, 새 쓰기는 RPC 하나의 트랜잭션으로 제한한다.

alter table public.inquiries
  add column if not exists updated_at timestamptz;

alter table public.inquiries
  add column if not exists client_request_id uuid;

alter table public.inquiry_messages
  add column if not exists client_request_id uuid;

-- 기존 문의는 마지막 메시지 시각을 최근 활동 시각으로 채운다.
update public.inquiries i
set updated_at = coalesce(
  (select max(m.created_at) from public.inquiry_messages m where m.inquiry_id = i.id),
  i.created_at
)
where i.updated_at is null;

-- 구버전 앱이 답장을 보낼 때 상태를 갱신하지 않았던 기존 행을 보정한다.
update public.inquiries i
set status = 'open'
where i.status <> 'closed'
  and exists (
    select 1 from public.inquiry_messages m
    where m.inquiry_id = i.id
      and m.sender = 'user'
      and m.id = (
        select latest.id from public.inquiry_messages latest
        where latest.inquiry_id = i.id
        order by latest.created_at desc, latest.id desc
        limit 1
      )
  );

alter table public.inquiries
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inquiries_subject_length_check'
  ) then
    alter table public.inquiries
      add constraint inquiries_subject_length_check
      check (char_length(regexp_replace(subject, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 1 and 100) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'inquiries_email_length_check'
  ) then
    alter table public.inquiries
      add constraint inquiries_email_length_check
      check (email is null or char_length(regexp_replace(email, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 1 and 254) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'inquiry_messages_body_length_check'
  ) then
    alter table public.inquiry_messages
      add constraint inquiry_messages_body_length_check
      check (char_length(regexp_replace(body, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 1 and 4000) not valid;
  end if;
end
$$;

create unique index if not exists inquiries_user_request_uidx
  on public.inquiries (user_id, client_request_id)
  where client_request_id is not null;

create index if not exists inquiries_updated_idx
  on public.inquiries (updated_at desc);

create unique index if not exists inquiry_messages_request_uidx
  on public.inquiry_messages (inquiry_id, sender, client_request_id)
  where client_request_id is not null;

-- 모든 메시지 쓰기는 이 트리거를 통과한다. RPC 외의 서버-side 쓰기라도
-- 종료된 문의를 다시 열거나 updated_at을 놓치지 않게 한다.
create or replace function public.sync_inquiry_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  select status into current_status
  from public.inquiries
  where id = new.inquiry_id
  for update;

  if current_status is null then
    raise exception using errcode = 'P0001', message = 'inquiry_not_found';
  end if;
  if current_status = 'closed' then
    raise exception using errcode = 'P0001', message = 'inquiry_closed';
  end if;

  update public.inquiries
  set status = case when new.sender = 'user' then 'open' else 'answered' end,
      updated_at = now()
  where id = new.inquiry_id;
  return new;
end
$$;

drop trigger if exists inquiry_messages_activity on public.inquiry_messages;
create trigger inquiry_messages_activity
  after insert on public.inquiry_messages
  for each row execute function public.sync_inquiry_activity();

create or replace view public.v_inquiry_list
with (security_invoker = on) as
select
  i.id,
  i.created_at,
  i.subject,
  i.status,
  i.email,
  i.user_id,
  (select count(*) from public.inquiry_messages m where m.inquiry_id = i.id) as message_count,
  i.updated_at as last_message_at,
  (select m.sender from public.inquiry_messages m
    where m.inquiry_id = i.id order by m.created_at desc, m.id desc limit 1) as last_sender
from public.inquiries i;

-- 문의와 첫 메시지를 한 번의 RPC 트랜잭션으로 저장한다.
create or replace function public.create_inquiry(
  p_subject text,
  p_body text,
  p_email text,
  p_device_id uuid,
  p_request_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  inquiry_id bigint;
  existing_id bigint;
  clean_subject text := regexp_replace(coalesce(p_subject, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  clean_body text := regexp_replace(coalesce(p_body, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  clean_email text := nullif(regexp_replace(coalesce(p_email, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'invalid_request_id';
  end if;
  if char_length(clean_subject) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'invalid_subject';
  end if;
  if char_length(clean_body) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'invalid_body';
  end if;
  if clean_email is not null and char_length(clean_email) > 254 then
    raise exception using errcode = '22023', message = 'invalid_email';
  end if;

  select id into existing_id
  from public.inquiries
  where user_id = current_user_id and client_request_id = p_request_id;
  if existing_id is not null then
    return existing_id;
  end if;

  begin
    insert into public.inquiries (user_id, device_id, email, subject, client_request_id)
    values (current_user_id, p_device_id, clean_email, clean_subject, p_request_id)
    returning id into inquiry_id;

    insert into public.inquiry_messages (inquiry_id, sender, body, client_request_id)
    values (inquiry_id, 'user', clean_body, p_request_id);
  exception when unique_violation then
    select id into existing_id
    from public.inquiries
    where user_id = current_user_id and client_request_id = p_request_id;
    if existing_id is not null then
      return existing_id;
    end if;
    raise;
  end;

  return inquiry_id;
end
$$;

-- 사용자의 추가 답장과 상태 open 전환을 한 트랜잭션으로 처리한다.
create or replace function public.send_inquiry_message(
  p_inquiry_id bigint,
  p_body text,
  p_request_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_status text;
  message_id bigint;
  existing_id bigint;
  clean_body text := regexp_replace(coalesce(p_body, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'invalid_request_id';
  end if;
  if char_length(clean_body) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'invalid_body';
  end if;

  select status into current_status
  from public.inquiries
  where id = p_inquiry_id and user_id = current_user_id
  for update;
  if current_status is null then
    raise exception using errcode = 'P0001', message = 'inquiry_not_found';
  end if;
  if current_status = 'closed' then
    raise exception using errcode = 'P0001', message = 'inquiry_closed';
  end if;

  select id into existing_id
  from public.inquiry_messages
  where inquiry_id = p_inquiry_id and sender = 'user' and client_request_id = p_request_id;
  if existing_id is not null then
    return existing_id;
  end if;

  begin
    insert into public.inquiry_messages (inquiry_id, sender, body, client_request_id)
    values (p_inquiry_id, 'user', clean_body, p_request_id)
    returning id into message_id;
  exception when unique_violation then
    select id into existing_id
    from public.inquiry_messages
    where inquiry_id = p_inquiry_id and sender = 'user' and client_request_id = p_request_id;
    if existing_id is not null then
      return existing_id;
    end if;
    raise;
  end;

  return message_id;
end
$$;

-- 관리자 답변과 answered 전환을 한 트랜잭션으로 처리한다.
create or replace function public.admin_reply_inquiry(
  p_inquiry_id bigint,
  p_body text,
  p_request_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  message_id bigint;
  existing_id bigint;
  clean_body text := regexp_replace(coalesce(p_body, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'invalid_request_id';
  end if;
  if char_length(clean_body) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'invalid_body';
  end if;

  select status into current_status
  from public.inquiries
  where id = p_inquiry_id
  for update;
  if current_status is null then
    raise exception using errcode = 'P0001', message = 'inquiry_not_found';
  end if;
  if current_status = 'closed' then
    raise exception using errcode = 'P0001', message = 'inquiry_closed';
  end if;

  select id into existing_id
  from public.inquiry_messages
  where inquiry_id = p_inquiry_id and sender = 'admin' and client_request_id = p_request_id;
  if existing_id is not null then
    return existing_id;
  end if;

  begin
    insert into public.inquiry_messages (inquiry_id, sender, body, client_request_id)
    values (p_inquiry_id, 'admin', clean_body, p_request_id)
    returning id into message_id;
  exception when unique_violation then
    select id into existing_id
    from public.inquiry_messages
    where inquiry_id = p_inquiry_id and sender = 'admin' and client_request_id = p_request_id;
    if existing_id is not null then
      return existing_id;
    end if;
    raise;
  end;

  return message_id;
end
$$;

create or replace function public.close_inquiry(p_inquiry_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  update public.inquiries
  set status = 'closed', updated_at = now()
  where id = p_inquiry_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'inquiry_not_found';
  end if;
  return true;
end
$$;

-- 클라이언트는 목록/대화 읽기만 직접 하고, 모든 쓰기는 위 함수로 제한한다.
drop policy if exists "create own inquiry" on public.inquiries;
drop policy if exists "admins update inquiries" on public.inquiries;
drop policy if exists "write own thread" on public.inquiry_messages;

revoke all on public.inquiries from public, anon, authenticated;
grant select on public.inquiries to authenticated;
revoke all on public.inquiry_messages from public, anon, authenticated;
grant select on public.inquiry_messages to authenticated;

revoke all on public.v_inquiry_list from public, anon, authenticated;
grant select on public.v_inquiry_list to authenticated;

revoke all on function public.create_inquiry(text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_inquiry(text, text, text, uuid, uuid) to authenticated;
revoke all on function public.send_inquiry_message(bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.send_inquiry_message(bigint, text, uuid) to authenticated;
revoke all on function public.admin_reply_inquiry(bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_reply_inquiry(bigint, text, uuid) to authenticated;
revoke all on function public.close_inquiry(bigint) from public, anon, authenticated;
grant execute on function public.close_inquiry(bigint) to authenticated;
revoke all on function public.sync_inquiry_activity() from public, anon, authenticated;
