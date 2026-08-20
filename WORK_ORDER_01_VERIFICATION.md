# WORK_ORDER 01 검증 보고서

작성일: 2026-08-19 (최초 2026-08-18)  
기준 커밋: `10a4e57` + 후속 수정 (작업 트리)  
대상 파일: `supabase/schema.sql`

## 작업 내용

분석 이벤트의 `turn` 값이 잘못되어도 대시보드 집계 뷰가 `22P02` 오류로 중단되지 않도록 다음을 적용했다.

- `public.safe_int(text)` 함수 추가
- `v_turn_reach`, `v_quit_turn`, `v_choice_balance`, `v_choice_rate`의 위험한 정수 캐스팅 교체
- 네 뷰에 숫자 형식의 `turn`만 집계하는 필터 추가
- 네 뷰에 `safe_int(...) is not null` 조건 추가 (2026-08-19, 아래 런타임 검증에서 발견된 잔여 오염 차단)
- 관리자 전용 `events DELETE` 정책 추가

두 필터는 중복이 아니라 상호 보완이다. 정규식은 캐스팅은 되지만 비정상인 값(`' 3 '`, `'+5'`, `'-7'`)을 걸러내고, `safe_int` 조건은 정규식을 통과하는 범위 초과 값(`'99999999999'`)을 걸러낸다.

## 로컬 정적 검증

| 항목 | 결과 |
|---|---|
| 대상 뷰 4개 확인 | PASS |
| 네 뷰 모두 `public.safe_int` 사용 | PASS |
| 네 뷰 모두 `turn` 정규식 필터 사용 | PASS |
| 네 뷰 모두 `safe_int(...) is not null` 필터 사용 | PASS |
| 잘못된 문자열 캐스팅 예외 처리 | PASS |
| 정수 범위 초과 예외 처리 | PASS |
| 관리자 전용 delete 정책 존재 | PASS |
| 기존 `(props ->> 'turn')::int` 잔존 여부 | 0건 |
| `git diff --check` | PASS |

## 런타임 검증 — PGlite

원격 Supabase에 접근할 수 없어(관리자 인증 세션 없음, 익명 키로는 뷰 조회 불가 — 설계대로 `is_admin()` 필요) PGlite(WASM PostgreSQL)에 `supabase/schema.sql`을 **수정 없이 그대로** 실행해 검증했다. Supabase 전용 객체(`auth.uid()`, `anon`/`authenticated` 롤, `auth.users`)만 테스트 쪽 스텁으로 채웠고 스키마 파일은 건드리지 않았다.

### 수정 전(`72eb000`) / 수정 후 대조

`{"turn":"x"}` 이벤트 1건 삽입 후:

| 뷰 | 수정 전 | 수정 후 |
|---|---|---|
| `v_turn_reach` | `22P02 invalid input syntax for type integer: "x"` | 정상 반환 |
| `v_quit_turn` | `22P02` | 정상 반환 |
| `v_choice_balance` | `22P02` | 정상 반환 |
| `v_choice_rate` | `22P02` | 정상 반환 |

지시서가 지적한 "네 뷰가 전부 죽는다"가 실제로 재현됐고, 수정본에서 사라졌다.

### safe_int 단위 동작

| 입력 | 결과 |
|---|---|
| `'12'` | 12 |
| `'x'` | null (`invalid_text_representation` 분기) |
| `''` | null |
| `'99999999999'` | null (`numeric_value_out_of_range` 분기) |
| `null` | null |

두 예외 분기 모두 실제로 실행됐다.

### 오염 데이터 배제

`'x'` / `''` / `' 3 '` / `'99999999999'` / `turn` 키 없음을 섞어 넣고 네 뷰를 조회한 결과, 오염 행은 전부 제외되고 `turn`이 null인 행도 남지 않았다. 정상 행(`turn: 1`)의 집계는 그대로 유지됐다(`A 66.7% / B 33.3%`).

### 관리자 delete 정책

Supabase 기본 grant를 재현하고 RLS를 실제로 태워 확인했다.

| 주체 | 결과 |
|---|---|
| 일반 익명 로그인 사용자 (`authenticated`이나 `admins` 미등록) | 삭제 0건 — 차단됨 |
| 관리자 (`admins` 등록) | 삭제 2건 — 오염 행 제거 성공 |

## 발견 사항 — 처리 완료

정규식 `^[0-9]+$`는 전부 숫자인 초과 범위 문자열(`'99999999999'`)을 통과시키고, 그 값은 `safe_int`에서 null이 되어 `v_turn_reach`·`v_choice_rate`에 `turn = null` 행을 하나 만들었다.

`22P02` 영구 정지는 막혔지만 대시보드 표시가 오염됐다 — `admin/index.html:1132`의 `Number(null)`이 `0`이라 퍼널 차트에 "턴 0" 축이 생기고, `admin/index.html:1147`의 선택률 표에 "턴 null" 행이 떴다.

네 뷰에 `and public.safe_int(props ->> 'turn') is not null`을 추가해 처리했다. 재검증에서 `turn = null` 행 0건을 확인했다.

## 정상 데이터 손실 없음

`src/screens/BlindDateChatScreen.tsx:195`(`choice`)와 `:526`(`episode_quit`)이 `turn`을 항상 숫자로 보내므로, 추가된 필터가 실제 앱 트래픽을 걸러내는 경우는 없다.

## 남은 확인 — 운영 DB 적용

PGlite가 증명한 것은 **SQL 로직**이다. 운영 Supabase 프로젝트에 이 스키마가 실제로 적용됐는지는 별개이며, 파일만 고치고 SQL Editor에서 실행하지 않았다면 운영 DB는 여전히 옛 뷰 정의로 동작한다.

SQL Editor에서 아래를 실행해 행이 나오면 적용된 것이다.

```sql
select proname from pg_proc where proname = 'safe_int';
```

## 현재 판정

`CODE_CHECK: PASS`  
`RUNTIME_CHECK: PASS` (PGlite — 수정 전 22P02 재현, 수정 후 해소, 관리자 delete 정책 동작 확인)  
`DEPLOY_CHECK: PENDING` (운영 Supabase 적용 여부 확인 필요)  
`OVERALL: 코드 확정 · 운영 반영만 남음`
