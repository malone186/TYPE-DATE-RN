-- TYPE_DATE 트래킹 스키마
-- Supabase 프로젝트의 SQL Editor에 그대로 붙여넣고 실행한다.
--
-- 설계 요약
--  · 이벤트는 events 한 테이블에 append-only로 쌓는다.
--  · 앱(anon)은 INSERT만 가능, SELECT 불가 — 익명 키가 노출돼도 남의 기록을 읽을 수 없다.
--  · 대시보드는 Supabase Auth로 로그인한 계정만 집계 뷰를 읽는다.
--  · 개인정보(사용자 이름)는 절대 보내지 않는다. device_id는 앱이 만든 임의 UUID다.
--  · 구매 원장은 서버 검증 함수만 쓰며, purchase token 원문 대신 해시만 저장한다.

-- ── 관리자 ──────────────────────────────────────────────────────────
-- 익명 로그인을 쓰면 앱 사용자도 authenticated 역할이 된다.
-- 따라서 "로그인했으면 관리자"라고 볼 수 없고, 명시적으로 등록된 계정만 관리자로 취급한다.
-- 관리자 추가 (이미 등록돼 있어도 에러 없이 넘어간다):
--   insert into public.admins (user_id) values ('<Auth Users의 UID>') on conflict do nothing;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- 관리자 목록 자체는 아무도 클라이언트에서 읽지 못한다(정책 없음 = 전부 거부).
-- 아래 is_admin()이 security definer라 정책 없이도 판정은 동작한다.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;


create table if not exists public.events (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  device_id   uuid        not null,
  name        text        not null,
  line        text,                      -- 'male' | 'female'
  episode_id  text,
  props       jsonb       not null default '{}'::jsonb
);

create index if not exists events_created_at_idx on public.events (created_at desc);
create index if not exists events_name_idx       on public.events (name);
create index if not exists events_device_idx     on public.events (device_id);

alter table public.events enable row level security;

-- 앱은 쓰기만 한다.
drop policy if exists "anon can insert events" on public.events;
create policy "anon can insert events"
  on public.events for insert
  to anon
  with check (true);

-- 원본 이벤트 읽기는 admins에 등록된 관리자만.
-- (익명 로그인 사용자도 authenticated이므로 역할만으로 판단하면 전체 데이터가 새어나간다)
drop policy if exists "authenticated can read events" on public.events;
drop policy if exists "admins can read events" on public.events;
create policy "admins can read events"
  on public.events for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins can delete events" on public.events;
create policy "admins can delete events"
  on public.events for delete
  to authenticated
  using (public.is_admin());

-- 잘못된 분석 이벤트가 집계 뷰 전체를 깨뜨리지 않도록 정수 캐스팅을 방어한다.
create or replace function public.safe_int(value text)
returns integer
language plpgsql
immutable
strict
as $$
begin
  return value::integer;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return null;
end;
$$;


-- ── 집계 뷰 ──────────────────────────────────────────────────────────
-- security_invoker=on: 뷰도 위 RLS를 그대로 따른다(로그인 필요).

-- 일별 활성 기기 / 신규 기기
create or replace view public.v_daily_active
with (security_invoker = on) as
with first_seen as (
  select device_id, min(created_at)::date as first_day
  from public.events
  group by device_id
)
select
  e.created_at::date                                   as day,
  count(distinct e.device_id)                          as active_devices,
  count(distinct e.device_id) filter (
    where f.first_day = e.created_at::date
  )                                                    as new_devices
from public.events e
join first_seen f on f.device_id = e.device_id
group by 1
order by 1;

-- 회차별 시작 / 완주 / 완주율
create or replace view public.v_episode_funnel
with (security_invoker = on) as
select
  episode_id,
  line,
  count(*) filter (where name = 'episode_start')    as starts,
  count(*) filter (where name = 'episode_complete') as completes,
  round(
    100.0 * count(*) filter (where name = 'episode_complete')
    / nullif(count(*) filter (where name = 'episode_start'), 0)
  , 1)                                              as complete_rate
from public.events
where episode_id is not null
  and name in ('episode_start', 'episode_complete')
group by episode_id, line
order by episode_id;

-- 엔딩 분포 (성공 / 친구 / 실패)
create or replace view public.v_ending_dist
with (security_invoker = on) as
select
  props ->> 'ending' as ending,
  line,
  count(*)           as n
from public.events
where name = 'episode_complete'
  and props ? 'ending'
group by 1, 2;

-- 성향 유형 분포 (EF / ET / IF / IT)
create or replace view public.v_style_dist
with (security_invoker = on) as
select
  props ->> 'styleType' as style_type,
  count(*)              as n
from public.events
where name = 'episode_complete'
  and props ? 'styleType'
group by 1
order by 1;

-- 턴별 도달 인원 — 어디서 이탈하는지 보는 용도
create or replace view public.v_turn_reach
with (security_invoker = on) as
select
  episode_id,
  public.safe_int(props ->> 'turn') as turn,
  count(distinct device_id) as devices
from public.events
where name = 'choice'
  and props ? 'turn'
  and props ->> 'turn' ~ '^[0-9]+$'
  and public.safe_int(props ->> 'turn') is not null
group by 1, 2
order by 1, 2;

-- 턴별 중도 포기 — 나가기 확인 모달에서 '나가기'를 누른 지점
create or replace view public.v_quit_turn
with (security_invoker = on) as
select
  episode_id,
  public.safe_int(props ->> 'turn') as turn,
  count(*)                as quits
from public.events
where name = 'episode_quit'
  and props ? 'turn'
  and props ->> 'turn' ~ '^[0-9]+$'
  and public.safe_int(props ->> 'turn') is not null
group by 1, 2
order by 1, 2;

-- 온보딩 퍼널 — 화면별 도달 기기 수 (단계 순서는 대시보드에서 지정)
create or replace view public.v_onboarding
with (security_invoker = on) as
select
  props ->> 'screen'        as screen,
  count(distinct device_id) as devices
from public.events
where name = 'screen_view'
  and props ? 'screen'
group by 1;

-- 리텐션 — 첫 방문일 코호트 기준 D1 / D7 재방문율.
-- "정확히 N일 뒤에 다시 왔는가" 기준(표준 코호트 방식)이라
-- 2~6일차에 온 사람은 D1에도 D7에도 잡히지 않는다.
create or replace view public.v_retention
with (security_invoker = on) as
with first_day as (
  select device_id, min(created_at)::date as d0
  from public.events
  group by device_id
),
active as (
  select distinct device_id, created_at::date as d
  from public.events
)
select
  f.d0                        as cohort_day,
  count(distinct f.device_id) as cohort_size,
  count(distinct a1.device_id) as returned_d1,
  count(distinct a7.device_id) as returned_d7,
  round(100.0 * count(distinct a1.device_id)
        / nullif(count(distinct f.device_id), 0), 1) as d1_rate,
  round(100.0 * count(distinct a7.device_id)
        / nullif(count(distinct f.device_id), 0), 1) as d7_rate
from first_day f
left join active a1 on a1.device_id = f.device_id and a1.d = f.d0 + 1
left join active a7 on a7.device_id = f.device_id and a7.d = f.d0 + 7
group by f.d0
order by f.d0 desc;

-- 선택지 밸런스 경고 — 아무도 안 고르는 선택지(<5%)와 몰표 선택지(>70%).
-- 표본이 적으면 2명만 같은 걸 골라도 100%가 되므로, 턴 합계 20건 이상만 본다.
create or replace view public.v_choice_balance
with (security_invoker = on) as
select * from (
  select
    episode_id,
    public.safe_int(props ->> 'turn') as turn,
    props ->> 'label'       as label,
    count(*)                as n,
    sum(count(*)) over (
      partition by episode_id, public.safe_int(props ->> 'turn')
    )                       as turn_total,
    round(100.0 * count(*) / sum(count(*)) over (
      partition by episode_id, public.safe_int(props ->> 'turn')
    ), 1)                   as pct
  from public.events
  where name = 'choice'
    and props ? 'label'
    and props ->> 'turn' ~ '^[0-9]+$'
    and public.safe_int(props ->> 'turn') is not null
  group by 1, 2, 3
) t
where turn_total >= 20
  and (pct < 5 or pct > 70)
order by pct desc, episode_id, turn;

-- 선택지 선택률 — 회차·턴별 A/B/C/D 분포
create or replace view public.v_choice_rate
with (security_invoker = on) as
select
  episode_id,
  public.safe_int(props ->> 'turn') as turn,
  props ->> 'label'       as label,
  count(*)                as n,
  round(100.0 * count(*) / sum(count(*)) over (
    partition by episode_id, public.safe_int(props ->> 'turn')
  ), 1)                   as pct
from public.events
where name = 'choice'
  and props ? 'label'
  and props ->> 'turn' ~ '^[0-9]+$'
  and public.safe_int(props ->> 'turn') is not null
group by 1, 2, 3
order by 1, 2, 3;


-- ── 1:1 문의 ────────────────────────────────────────────────────────
-- 익명 로그인(signInAnonymously)으로 발급된 auth.uid()에 스레드를 묶는다.
-- 가입 절차는 없지만 JWT 기반이라 "남의 문의 읽기"가 실제로 차단된다.

create table if not exists public.inquiries (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  device_id         uuid,                       -- 트래킹 기록과 연결하고 싶을 때만 사용
  email             text
                    check (email is null or char_length(regexp_replace(email, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 1 and 254),
  subject           text        not null
                    check (char_length(regexp_replace(subject, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 1 and 100),
  status            text        not null default 'open'
                    check (status in ('open', 'answered', 'closed')),
  client_request_id uuid
);

create table if not exists public.inquiry_messages (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),
  inquiry_id        bigint      not null references public.inquiries(id) on delete cascade,
  sender            text        not null check (sender in ('user', 'admin')),
  body              text        not null
                    check (char_length(regexp_replace(body, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 1 and 4000),
  client_request_id uuid
);

create index if not exists inquiries_user_idx     on public.inquiries (user_id, created_at desc);
create index if not exists inquiries_updated_idx  on public.inquiries (updated_at desc);
create index if not exists inquiry_msg_thread_idx on public.inquiry_messages (inquiry_id, created_at);
create unique index if not exists inquiries_user_request_uidx
  on public.inquiries (user_id, client_request_id)
  where client_request_id is not null;
create unique index if not exists inquiry_messages_request_uidx
  on public.inquiry_messages (inquiry_id, sender, client_request_id)
  where client_request_id is not null;

alter table public.inquiries        enable row level security;
alter table public.inquiry_messages enable row level security;

-- 문의/메시지는 본인 또는 관리자만 읽는다. 클라이언트 쓰기는 RPC로만 허용한다.
drop policy if exists "own inquiries" on public.inquiries;
create policy "own inquiries"
  on public.inquiries for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- 메시지: 자기 스레드의 글만 읽는다.
drop policy if exists "read own thread" on public.inquiry_messages;
create policy "read own thread"
  on public.inquiry_messages for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.inquiries i
      where i.id = inquiry_id and i.user_id = auth.uid()
    )
  );

-- 관리자 목록용 — 마지막 메시지와 누가 마지막으로 말했는지까지 한 번에.
create or replace view public.v_inquiry_list
with (security_invoker = on) as
select
  i.id,
  i.created_at,
  i.subject,
  i.status,
  i.email,
  i.user_id,
  (select count(*)  from public.inquiry_messages m where m.inquiry_id = i.id) as message_count,
  i.updated_at as last_message_at,
  (select m.sender from public.inquiry_messages m
    where m.inquiry_id = i.id order by m.created_at desc, m.id desc limit 1) as last_sender
from public.inquiries i;

-- 메시지가 추가될 때 최근 활동 시각과 상태를 함께 갱신하고, 종료된 문의는 막는다.
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

-- 문의와 첫 메시지를 한 번의 RPC 트랜잭션으로 저장한다.
create or replace function public.create_inquiry(
  p_subject text, p_body text, p_email text, p_device_id uuid, p_request_id uuid
)
returns bigint
language plpgsql security definer set search_path = public
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
  select id into existing_id from public.inquiries
  where user_id = current_user_id and client_request_id = p_request_id;
  if existing_id is not null then return existing_id; end if;
  begin
    insert into public.inquiries (user_id, device_id, email, subject, client_request_id)
    values (current_user_id, p_device_id, clean_email, clean_subject, p_request_id)
    returning id into inquiry_id;
    insert into public.inquiry_messages (inquiry_id, sender, body, client_request_id)
    values (inquiry_id, 'user', clean_body, p_request_id);
  exception when unique_violation then
    select id into existing_id from public.inquiries
    where user_id = current_user_id and client_request_id = p_request_id;
    if existing_id is not null then return existing_id; end if;
    raise;
  end;
  return inquiry_id;
end
$$;

-- 사용자의 추가 답장과 open 전환을 한 트랜잭션으로 처리한다.
create or replace function public.send_inquiry_message(
  p_inquiry_id bigint, p_body text, p_request_id uuid
)
returns bigint
language plpgsql security definer set search_path = public
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
  select status into current_status from public.inquiries
  where id = p_inquiry_id and user_id = current_user_id for update;
  if current_status is null then
    raise exception using errcode = 'P0001', message = 'inquiry_not_found';
  end if;
  if current_status = 'closed' then
    raise exception using errcode = 'P0001', message = 'inquiry_closed';
  end if;
  select id into existing_id from public.inquiry_messages
  where inquiry_id = p_inquiry_id and sender = 'user' and client_request_id = p_request_id;
  if existing_id is not null then return existing_id; end if;
  begin
    insert into public.inquiry_messages (inquiry_id, sender, body, client_request_id)
    values (p_inquiry_id, 'user', clean_body, p_request_id)
    returning id into message_id;
  exception when unique_violation then
    select id into existing_id from public.inquiry_messages
    where inquiry_id = p_inquiry_id and sender = 'user' and client_request_id = p_request_id;
    if existing_id is not null then return existing_id; end if;
    raise;
  end;
  return message_id;
end
$$;

-- 관리자 답변과 answered 전환을 한 트랜잭션으로 처리한다.
create or replace function public.admin_reply_inquiry(
  p_inquiry_id bigint, p_body text, p_request_id uuid
)
returns bigint
language plpgsql security definer set search_path = public
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
  select status into current_status from public.inquiries
  where id = p_inquiry_id for update;
  if current_status is null then
    raise exception using errcode = 'P0001', message = 'inquiry_not_found';
  end if;
  if current_status = 'closed' then
    raise exception using errcode = 'P0001', message = 'inquiry_closed';
  end if;
  select id into existing_id from public.inquiry_messages
  where inquiry_id = p_inquiry_id and sender = 'admin' and client_request_id = p_request_id;
  if existing_id is not null then return existing_id; end if;
  begin
    insert into public.inquiry_messages (inquiry_id, sender, body, client_request_id)
    values (p_inquiry_id, 'admin', clean_body, p_request_id)
    returning id into message_id;
  exception when unique_violation then
    select id into existing_id from public.inquiry_messages
    where inquiry_id = p_inquiry_id and sender = 'admin' and client_request_id = p_request_id;
    if existing_id is not null then return existing_id; end if;
    raise;
  end;
  return message_id;
end
$$;

create or replace function public.close_inquiry(p_inquiry_id bigint)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  update public.inquiries set status = 'closed', updated_at = now()
  where id = p_inquiry_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'inquiry_not_found';
  end if;
  return true;
end
$$;

-- 쓰기는 RPC로만, 읽기는 authenticated의 RLS 범위에서만 허용한다.
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


-- ── 회차 간 이어보기 ─────────────────────────────────────────────────
-- 이 회차를 끝낸 사람이 그 뒤에 '다른 회차를 시작했는가'.
-- 해금 순서에 의존하지 않도록 "다음 회차"가 아니라 "이후의 아무 회차"로 본다.
-- 연재형 구조에서 완주율보다 중요한 지표 — 완주율이 높아도 여기서 끊기면 이탈이다.
create or replace view public.v_continuation
with (security_invoker = on) as
with done as (
  select device_id, episode_id, min(created_at) as done_at
  from public.events
  where name = 'episode_complete'
  group by device_id, episode_id
)
select
  d.episode_id,
  count(*)                                as finishers,
  count(*) filter (where nx.went)         as continued,
  round(100.0 * count(*) filter (where nx.went)
        / nullif(count(*), 0), 1)         as continue_rate
from done d
cross join lateral (
  select exists (
    select 1 from public.events e
    where e.device_id  = d.device_id
      and e.name       = 'episode_start'
      and e.episode_id is distinct from d.episode_id
      and e.created_at > d.done_at
  ) as went
) nx
group by d.episode_id
order by continue_rate nulls last;


-- ── 서버 검증 구매 원장 ─────────────────────────────────────────────
-- 클라이언트의 purchase 콜백/분석 이벤트는 실매출 근거가 아니다.
-- raw purchase token은 저장하지 않고 SHA-256 base64url 해시로 중복을 막는다.

create table if not exists public.purchase_transactions (
  id                     bigserial primary key,
  user_id                uuid references auth.users(id) on delete set null,
  platform               text not null check (platform in ('android')),
  package_name           text not null,
  product_id             text not null,
  transaction_id         text,
  purchase_time          timestamptz,
  status                 text not null check (status in ('purchased', 'pending', 'cancelled', 'unknown')),
  is_test                boolean not null default false,
  acknowledgement_status text not null check (acknowledgement_status in ('acknowledged', 'pending', 'not_required')),
  purchase_token_hash    text not null check (length(purchase_token_hash) = 43),
  last_verified_at       timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  unique (purchase_token_hash)
);

create index if not exists purchase_transactions_status_idx
  on public.purchase_transactions (status, is_test, last_verified_at desc);

alter table public.purchase_transactions enable row level security;
drop policy if exists "admins can read purchase transactions" on public.purchase_transactions;
create policy "admins can read purchase transactions"
  on public.purchase_transactions for select
  to authenticated
  using (public.is_admin());

revoke all on public.purchase_transactions from anon, authenticated;
grant select on public.purchase_transactions to authenticated;


-- ── 앱 오류 ─────────────────────────────────────────────────────────
-- 크래시가 나도 문의가 들어와야 아는 상태를 없애기 위한 수집.
create or replace view public.v_errors
with (security_invoker = on) as
select
  coalesce(props ->> 'screen', '(알 수 없음)')  as screen,
  coalesce(props ->> 'message', '(메시지 없음)') as message,
  props ->> 'fatal'                            as fatal,
  count(*)                                     as n,
  count(distinct device_id)                    as devices,
  min(created_at)                              as first_seen,
  max(created_at)                              as last_seen
from public.events
where name = 'error'
group by 1, 2, 3
order by n desc, last_seen desc;


-- ── 수익 (광고 / 광고 제거) ──────────────────────────────────────────
-- 주의: 클라이언트 이벤트는 참고 전환/노출 지표일 뿐 실정산 근거가 아니다.
--   · 실제 광고 수익은 AdMob 보고서에만 있다. 여기 노출 수 × eCPM은 추정치다.
--   · purchase source만 신규 구매 관측으로 보고 restore/test/레거시는 제외한다.

create or replace view public.v_monetization
with (security_invoker = on) as
select
  count(*) filter (where name = 'ad_shown'
    and props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production') as ad_impressions,
  count(distinct device_id) filter (where name = 'ad_shown'
    and props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production') as ad_viewers,
  count(*) filter (where name = 'remove_ads'
    and props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production'
    and props ->> 'source' = 'purchase') as removals,
  count(distinct device_id) filter (where name = 'remove_ads'
    and props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production'
    and props ->> 'source' = 'purchase') as removal_devices,
  count(distinct device_id) filter (where props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production') as all_devices,
  count(*) filter (where name = 'remove_ads'
    and props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production'
    and props ->> 'source' = 'restore') as restore_events,
  count(*) filter (where name = 'remove_ads'
    and props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production'
    and props ->> 'source' = 'test') as test_events,
  (select count(*) from public.purchase_transactions
    where status = 'purchased' and is_test = false) as verified_purchases,
  (select count(*) from public.purchase_transactions
    where status = 'purchased' and is_test = true) as verified_test_purchases,
  (select count(*) from public.purchase_transactions
    where acknowledgement_status = 'pending') as acknowledgement_pending
from public.events
-- GROUP BY가 없는 집계는 보이는 행이 0개여도 '전부 0'인 행을 1개 돌려준다.
-- 그대로 두면 권한 없는 계정에 "수익 0원"이라고 단언하게 되므로(=데이터 없음과 구분 불가)
-- HAVING으로 행 자체를 없애 다른 뷰들과 같이 빈 결과가 되게 한다.
having public.is_admin();

create or replace view public.v_monetization_daily
with (security_invoker = on) as
select
  created_at::date                            as day,
  count(*) filter (where name = 'ad_shown')   as ad_impressions,
  count(*) filter (where name = 'remove_ads' and props ->> 'source' = 'purchase') as removals,
  count(*) filter (where name = 'remove_ads' and props ->> 'source' = 'restore') as restore_events,
  count(*) filter (where name = 'remove_ads' and props ->> 'source' = 'test') as test_events
from public.events
where props ->> 'schema_version' = '2'
  and props ->> 'app_environment' = 'production'
  and name in ('ad_shown', 'remove_ads')
group by 1
order by 1;
