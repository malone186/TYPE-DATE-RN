# WORK_ORDER 01 검증 보고서

작성일: 2026-08-18  
기준 커밋: `72eb000`  
대상 파일: `supabase/schema.sql`

## 작업 내용

분석 이벤트의 `turn` 값이 잘못되어도 대시보드 집계 뷰가 `22P02` 오류로 중단되지 않도록 다음을 적용했다.

- `public.safe_int(text)` 함수 추가
- `v_turn_reach`, `v_quit_turn`, `v_choice_balance`, `v_choice_rate`의 위험한 정수 캐스팅 교체
- 네 뷰에 숫자 형식의 `turn`만 집계하는 필터 추가
- 관리자 전용 `events DELETE` 정책 추가

## 로컬 정적 검증

| 항목 | 결과 |
|---|---|
| 대상 뷰 4개 확인 | PASS |
| 네 뷰 모두 `public.safe_int` 사용 | PASS |
| 네 뷰 모두 `turn` 정규식 필터 사용 | PASS |
| 잘못된 문자열 캐스팅 예외 처리 | PASS |
| 정수 범위 초과 예외 처리 | PASS |
| 관리자 전용 delete 정책 존재 | PASS |
| 기존 `(props ->> 'turn')::int` 잔존 여부 | 0건 |
| `git diff --check` | PASS |

## 원격 Supabase 런타임 검증

현재 작업 환경에는 PostgreSQL/Supabase 실행 도구와 관리자 인증 세션이 없어 원격 DB에 테스트 행을 삽입하거나 관리자 delete 정책을 실행하지 않았다. 따라서 이 부분은 아직 `PENDING`이며, 아래 SQL을 Supabase SQL Editor에서 실행한 뒤 결과를 확인해야 한다.

```sql
insert into public.events (device_id, name, props)
values (gen_random_uuid(), 'choice', '{"turn":"x"}')
returning id;

select * from public.v_turn_reach;
select * from public.v_quit_turn;
select * from public.v_choice_balance;
select * from public.v_choice_rate;
```

### 통과 기준

1. 네 뷰가 모두 `22P02` 없이 결과를 반환한다.
2. `turn = 'x'`인 이벤트가 네 뷰의 결과에 포함되지 않는다.
3. 관리자 인증 세션으로 해당 이벤트를 삭제했을 때 성공한다.

테스트 행의 `id`는 `returning id` 결과를 사용한다. 검증이 끝나면 관리자 세션에서 다음과 같이 삭제한다.

```sql
delete from public.events
where id = '<returning id 결과>';
```

## 현재 판정

`CODE_CHECK: PASS`  
`RUNTIME_CHECK: PENDING`  
`OVERALL: 원격 Supabase 검증 후 확정`

