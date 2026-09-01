# TYPE DATE 1:1 문의 — Supabase 운영 적용 인수인계

작성일: 2026-09-01  
담당자: TYPE DATE 운영 Supabase 프로젝트에 접근 권한이 있는 작업자

## 1. 목적

앱에 구현된 1:1 문의 기능을 운영 Supabase와 연결하고 다음 흐름을 실기기에서 확인한다.

> 앱 설정 → 고객지원 → 문의 작성 → 관리자 대시보드에서 답변 → 앱에서 추가 답장 → 관리자 종료

앱 코드와 로컬 테스트는 완료되어 있다. 이 문서의 작업은 **운영 Supabase 설정, 운영 관리자 등록, 환경 연결 및 실기기 확인**에 한정한다.

## 2. 시작 전에 지킬 것

- 작업할 Supabase 프로젝트의 이름과 소유자를 먼저 확인한다.
- 가능하면 작업 전 데이터베이스 백업 또는 복구 지점을 준비한다.
- 서비스 역할 키(`service_role`), 데이터베이스 비밀번호, 로그인 비밀번호를 Git이나 메신저에 올리지 않는다.
- 앱과 관리자 대시보드에는 Supabase의 publishable/anon 클라이언트 키만 사용한다.
- 운영 DB에는 `supabase/schema.sql` 전체를 실행하지 않는다. 아래에 지정한 migration 파일만 적용한다.
- SQL 실행 중 오류가 발생하면 같은 SQL을 임의로 수정하거나 테이블·정책을 삭제하지 말고, 오류 전문에서 비밀 값만 제거해 개발 담당자에게 전달한다.

## 3. 준비물과 권한

- 운영 Supabase 프로젝트 Dashboard 접근 권한
- Authentication 설정 변경 권한
- SQL Editor 실행 권한
- 관리자 대시보드에서 사용할 이메일/비밀번호 Auth 계정
- EAS production 환경 변수를 설정할 수 있는 Expo/EAS 권한자와의 연락 수단
- 최신 프로젝트 소스에 아래 파일이 존재하는지 확인

```text
supabase/migrations/202609010001_inquiries_operations.sql
admin/index.html
src/lib/inquiries.ts
```

## 4. 운영 적용 순서

### 4-1. 대상 프로젝트 확인

Supabase Dashboard에서 운영 프로젝트를 연 뒤 다음을 기록한다.

- 프로젝트 이름
- 프로젝트 URL의 프로젝트 식별자
- 작업 날짜와 작업자

앱의 `EXPO_PUBLIC_SUPABASE_URL`과 관리자 대시보드가 이 프로젝트를 바라봐야 한다. 실제 URL이나 키 값은 이 문서에 적거나 Git에 추가하지 않는다.

### 4-2. 기존 문의 스키마 확인

SQL Editor에서 아래 읽기 전용 SQL을 실행한다.

```sql
select
  to_regclass('public.admins') as admins,
  to_regclass('public.inquiries') as inquiries,
  to_regclass('public.inquiry_messages') as inquiry_messages;
```

세 항목이 모두 테이블 이름으로 반환되어야 한다. 하나라도 `null`이면 migration을 실행하지 말고 개발 담당자에게 결과를 전달한다. 이번 migration은 기존 문의 테이블과 `public.is_admin()` 함수가 있는 현재 스키마를 전제로 한다.

다음 SQL로 관리자 판별 함수도 확인한다.

```sql
select to_regprocedure('public.is_admin()') as is_admin_function;
```

`is_admin_function`이 `null`이면 중단한다.

### 4-3. Anonymous Sign-ins 활성화

Supabase Dashboard에서 다음 위치로 이동한다.

> Authentication → Sign In / Providers → Allow anonymous sign-ins

옵션을 활성화하고 저장한다. Supabase 익명 사용자는 데이터베이스에서 `authenticated` 역할로 접근하므로 RLS 정책이 적용된다.

공식 문서: <https://supabase.com/docs/guides/auth/auth-anonymous>

### 4-4. 문의 migration 적용

운영 DB에 적용할 파일은 하나다.

```text
supabase/migrations/202609010001_inquiries_operations.sql
```

권장 절차:

1. Supabase SQL Editor에서 새 쿼리를 만든다.
2. 위 migration 파일의 전체 내용을 그대로 붙여넣는다.
3. 선택된 프로젝트가 운영 대상과 일치하는지 다시 확인한다.
4. 한 번만 실행한다.
5. 성공 메시지와 실행 시각을 기록한다.

이 migration은 다음을 적용한다.

- 문의 생성과 첫 메시지를 한 트랜잭션으로 저장하는 `create_inquiry` RPC
- 사용자 답장 `send_inquiry_message` RPC
- 관리자 답변 `admin_reply_inquiry` RPC
- 관리자 종료 `close_inquiry` RPC
- 제목 1~100자, 본문 1~4,000자, 이메일 최대 254자 검증
- `updated_at`과 요청 중복 방지용 `client_request_id`
- 사용자 답장 시 `open`, 관리자 답변 시 `answered` 상태 전환
- `closed` 문의 추가 작성 차단
- 직접 insert/update 제한과 사용자·관리자 권한 분리

### 4-5. 적용 결과 확인

아래 읽기 전용 SQL을 실행한다.

```sql
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'inquiries'
  and column_name in ('updated_at', 'client_request_id')
order by column_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'create_inquiry',
    'send_inquiry_message',
    'admin_reply_inquiry',
    'close_inquiry'
  )
order by routine_name;

select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('inquiries', 'inquiry_messages')
order by tablename, policyname;
```

확인 기준:

- `inquiries.updated_at`, `inquiries.client_request_id`가 존재한다.
- RPC 함수 네 개가 모두 조회된다.
- 문의 및 메시지 조회용 RLS 정책이 존재한다.
- migration 실행 오류가 없다.

### 4-6. 운영 관리자 계정 등록

관리자 대시보드는 이메일/비밀번호 방식으로 로그인한다.

1. Supabase Dashboard → Authentication → Users에서 운영자 계정을 생성하거나 기존 계정을 선택한다.
2. 해당 사용자의 UUID를 복사한다.
3. SQL Editor에서 아래 SQL의 자리표시자만 실제 UUID로 바꿔 실행한다.

```sql
insert into public.admins (user_id)
values ('<ADMIN_AUTH_USER_UID>')
on conflict (user_id) do nothing;
```

4. 아래 SQL로 등록 여부를 확인한다.

```sql
select exists (
  select 1
  from public.admins
  where user_id = '<ADMIN_AUTH_USER_UID>'::uuid
) as registered;
```

결과가 `true`여야 한다. 운영자 비밀번호는 전달 문서나 저장소에 적지 않는다.

### 4-7. 앱과 관리자 대시보드의 프로젝트 일치 확인

다음 세 곳이 동일한 Supabase 프로젝트를 가리키는지 확인한다.

- EAS production의 `EXPO_PUBLIC_SUPABASE_URL`
- EAS production의 `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `admin/index.html`이 사용하는 Supabase 프로젝트 URL 및 publishable/anon 키

서비스 역할 키는 앱이나 정적 관리자 HTML에 절대 넣지 않는다. 프로젝트가 다르면 배포나 EAS 빌드를 진행하기 전에 개발 담당자와 연결 값을 정리한다.

문의 연결에 직접 필요한 EAS 환경 변수 이름은 다음과 같다.

```text
EXPO_PUBLIC_APP_ENV
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

production 빌드에는 기존 앱 설정상 다음 변수도 필요하다.

```text
EXPO_PUBLIC_PRIVACY_POLICY_URL
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID
ADMOB_ANDROID_APP_ID
```

기존 결제 검증 기능을 운영하는 경우 `EXPO_PUBLIC_VERIFY_PURCHASE_URL`도 기존 운영값을 유지한다. 이 문서에는 변수 이름만 기록하고 실제 값은 기록하지 않는다.

## 5. 실기기 E2E 테스트

반드시 관리자 등록과 migration 적용이 끝난 뒤 진행한다.

### 5-1. 앱에서 문의 생성

1. Android 앱을 실행한다.
2. 설정 → 고객지원 → 1:1 문의로 이동한다.
3. 제목, 본문, 선택 이메일을 입력해 전송한다.
4. 문의 대화방으로 이동하는지 확인한다.
5. 전송 버튼을 빠르게 여러 번 눌러도 문의와 첫 메시지가 각각 한 건만 생성되는지 확인한다.

기대 상태: `답변 대기` (`open`)

### 5-2. 관리자 답변

1. 관리자 대시보드에 등록된 운영자 계정으로 로그인한다.
2. 문의 메뉴에서 새 문의가 답변 대기 목록 상단에 표시되는지 확인한다.
3. 제목, 최근 활동 시각, 선택 이메일, 대화 내용을 확인한다.
4. 답변을 한 번 전송한다.
5. 전송 중 버튼을 반복 클릭해도 답변이 한 건만 저장되는지 확인한다.

기대 상태: `운영자 답변` (`answered`)

### 5-3. 앱에서 답변 확인 및 추가 답장

1. 앱의 문의 목록을 다시 연다.
2. 운영자 말풍선과 답변 상태가 표시되는지 확인한다.
3. 사용자가 추가 메시지를 보낸다.

기대 상태: 다시 `답변 대기` (`open`), 관리자 대시보드 목록 상단으로 이동

### 5-4. 문의 종료

1. 관리자 대시보드에서 문의를 종료한다.
2. 앱에서 문의를 다시 연다.
3. `종료된 문의입니다` 문구가 표시되는지 확인한다.
4. 입력창이 사라지고 새 문의 작성 버튼이 표시되는지 확인한다.
5. 종료된 문의에 사용자와 관리자 모두 추가 메시지를 작성할 수 없는지 확인한다.

기대 상태: `종료` (`closed`)

### 5-5. 권한 격리 확인

가능하면 서로 다른 두 기기 또는 두 개의 독립 설치 환경에서 익명 사용자 A/B를 만든다.

- A가 만든 문의를 B가 목록이나 대화방에서 볼 수 없어야 한다.
- B가 A의 문의 ID를 알아도 메시지를 작성할 수 없어야 한다.
- 일반 사용자가 관리자 발신자로 메시지를 저장할 수 없어야 한다.
- `admins`에 없는 이메일 계정은 전체 문의 조회·답변·종료가 불가능해야 한다.
- `admins`에 등록된 계정만 전체 문의 조회·답변·종료가 가능해야 한다.

## 6. 오류가 날 때 전달할 정보

다음 항목만 개발 담당자에게 전달한다.

- 실패한 절차 번호
- 실행한 migration 파일명
- Supabase가 표시한 오류 코드와 메시지
- 오류가 발생한 시각
- 앱 또는 대시보드에서 재현한 순서
- 비밀 값이 보이지 않게 가린 화면 캡처

다음 정보는 전달하지 않는다.

- service role 키
- 데이터베이스 비밀번호
- 운영자 로그인 비밀번호
- 전체 `.env` 내용
- 개인 액세스 토큰

## 7. 완료 보고 양식

아래 내용을 채워 앱 담당자에게 전달한다.

```text
[TYPE DATE 1:1 문의 Supabase 적용 결과]

- 대상 프로젝트 확인: 완료 / 미완료
- Anonymous Sign-ins 활성화: 완료 / 미완료
- 적용 migration: 202609010001_inquiries_operations.sql
- migration 성공: 예 / 아니오
- RPC 4개 확인: 예 / 아니오
- 관리자 UID 등록: 완료 / 미완료
- 앱/대시보드 동일 프로젝트 확인: 완료 / 미완료
- 앱 문의 생성: 성공 / 실패
- 관리자 답변: 성공 / 실패
- 사용자 추가 답장 및 open 복귀: 성공 / 실패
- 관리자 종료 및 추가 작성 차단: 성공 / 실패
- 사용자 A/B 권한 격리: 성공 / 실패 / 미실행
- 오류 및 특이사항:
```

## 8. 범위 밖 사항

- 푸시 알림은 구현 범위가 아니다.
- 자동 이메일 발송은 구현 범위가 아니다.
- 이메일은 필요한 경우 운영팀이 별도로 연락하기 위한 선택 정보다.
- 익명 사용자는 로그아웃, 앱 데이터 삭제 또는 재설치 후 기존 계정에 다시 접근하지 못할 수 있다.

