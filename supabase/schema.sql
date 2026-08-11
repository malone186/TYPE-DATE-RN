-- TYPE_DATE 트래킹 스키마
-- Supabase 프로젝트의 SQL Editor에 그대로 붙여넣고 실행한다.
--
-- 설계 요약
--  · 이벤트는 events 한 테이블에 append-only로 쌓는다.
--  · 앱(anon)은 INSERT만 가능, SELECT 불가 — 익명 키가 노출돼도 남의 기록을 읽을 수 없다.
--  · 대시보드는 Supabase Auth로 로그인한 계정만 집계 뷰를 읽는다.
--  · 개인정보(사용자 이름)는 절대 보내지 않는다. device_id는 앱이 만든 임의 UUID다.

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

-- 원본 이벤트 읽기는 로그인한 관리자만.
drop policy if exists "authenticated can read events" on public.events;
create policy "authenticated can read events"
  on public.events for select
  to authenticated
  using (true);


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
  (props ->> 'turn')::int   as turn,
  count(distinct device_id) as devices
from public.events
where name = 'choice'
  and props ? 'turn'
group by 1, 2
order by 1, 2;

-- 턴별 중도 포기 — 나가기 확인 모달에서 '나가기'를 누른 지점
create or replace view public.v_quit_turn
with (security_invoker = on) as
select
  episode_id,
  (props ->> 'turn')::int as turn,
  count(*)                as quits
from public.events
where name = 'episode_quit'
  and props ? 'turn'
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
    (props ->> 'turn')::int as turn,
    props ->> 'label'       as label,
    count(*)                as n,
    sum(count(*)) over (
      partition by episode_id, (props ->> 'turn')::int
    )                       as turn_total,
    round(100.0 * count(*) / sum(count(*)) over (
      partition by episode_id, (props ->> 'turn')::int
    ), 1)                   as pct
  from public.events
  where name = 'choice'
    and props ? 'label'
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
  (props ->> 'turn')::int as turn,
  props ->> 'label'       as label,
  count(*)                as n,
  round(100.0 * count(*) / sum(count(*)) over (
    partition by episode_id, (props ->> 'turn')::int
  ), 1)                   as pct
from public.events
where name = 'choice'
  and props ? 'label'
group by 1, 2, 3
order by 1, 2, 3;
