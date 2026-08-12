# TYPE_DATE 관리자 대시보드

앱의 익명 플레이 통계를 한눈에 보는 웹 대시보드.

```
[앱] ──POST──▶ [Supabase events 테이블] ◀──SELECT── [이 대시보드]
       anon                                   로그인한 관리자만
```

## 1. Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. **SQL Editor**에 [`../supabase/schema.sql`](../supabase/schema.sql) 전체를 붙여넣고 실행
3. **Settings → API**에서 두 값을 복사
   - `Project URL`
   - `anon public` 키

## 2. 앱에 키 넣기

프로젝트 루트에 `.env.local` 파일을 만든다 (이미 `.gitignore`에 포함됨):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

`expo start`를 다시 실행하면 이때부터 이벤트가 쌓인다.
**환경변수가 없으면 수집은 조용히 꺼진 채로 앱이 정상 동작한다** — 로컬 개발에서 통계가 오염되지 않게 하려면 그냥 비워두면 된다.

## 3. 익명 로그인 켜기 (1:1 문의에 필요)

Supabase **Authentication → Providers → Anonymous sign-ins**를 켠다.
문의 기능이 가입 절차 없이 익명 계정으로 스레드를 묶기 때문에, 꺼져 있으면 문의 화면이 실패한다.

트래킹만 쓰고 문의는 안 쓸 거라면 켜지 않아도 된다.

## 4. 관리자 계정 만들기

두 단계다. **두 번째를 빠뜨리면 대시보드가 전부 빈 값으로 보인다.**

1. **Authentication → Users → Add user**에서 이메일/비밀번호로 계정 생성
   (`Auto Confirm User` 켜기)
2. 그 계정을 관리자로 등록:

```sql
insert into public.admins (user_id) values ('<Users 목록의 UID>') on conflict do nothing;
```

`duplicate key ... admins_pkey` 에러가 나면 **이미 등록된 것**이다(실패가 아니다).
`on conflict do nothing`을 붙이면 몇 번을 실행해도 조용히 넘어간다.

익명 로그인을 쓰면 **앱 사용자도 `authenticated` 역할**이 된다. 그래서 "로그인했으면 관리자"로 볼 수 없고,
`admins` 테이블에 등록된 계정만 관리자로 취급한다. 등록하지 않은 채 로그인하면 대시보드가
UID와 함께 실행할 SQL을 그대로 띄워주니 복사해서 쓰면 된다.

## 5. 대시보드 열기

[`index.html`](index.html) 상단의 두 상수를 채운다:

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

그다음 파일을 브라우저로 열면 된다. 배포하려면 이 `admin/` 폴더만 **별도 Vercel 프로젝트**로 올린다
(Root Directory: `admin`, 빌드 명령 없음).

> 게임 쪽 [`vercel.json`](../vercel.json)은 모든 경로를 앱 `index.html`로 rewrite하고
> `dist/`만 배포하므로, 같은 배포에 `admin/`을 얹으면 열리지 않는다. 반드시 분리할 것.

## 수집하는 것 / 안 하는 것

| 이벤트 | 시점 | 함께 남기는 값 |
|---|---|---|
| `app_open` | 앱 실행 | 라인(남/여) |
| `screen_view` | 화면 진입 | 화면 이름 |
| `episode_start` | 소개팅 시작 | 회차 id, 상대 MBTI |
| `choice` | 선택지 선택 | 회차 id, 턴 번호, A/B/C/D, 호감도 증감 |
| `episode_quit` | 나가기 확인 후 이탈 | 회차 id, 포기한 턴 |
| `episode_complete` | 결과 화면 진입 | 회차 id, 엔딩, 유형, 최종 호감도 |

`screen_view`는 화면마다 코드를 심지 않고 [App.tsx](../App.tsx)의 `NavigationContainer` 리스너 한 곳에서 잡는다.
화면이 늘어나도 자동으로 따라온다.

**보내지 않는 것:** 사용자 이름, 기기 정보, 위치, 광고 식별자.
기기 구분은 앱이 처음 실행될 때 만든 임의 UUID(`td_device_id`) 하나뿐이며 사람과 연결되지 않는다.

## 1:1 문의

앱 **설정 → 1:1 문의**에서 들어간다. 회원가입은 없다 — `signInAnonymously()`로 익명 계정을 만들어
스레드를 묶고, RLS가 `auth.uid()`로 남의 문의 접근을 막는다.

| | |
|---|---|
| 앱 화면 | [InquiryScreen](../src/screens/InquiryScreen.tsx) 목록·작성, [InquiryThreadScreen](../src/screens/InquiryThreadScreen.tsx) 대화 |
| 데이터 접근 | [src/lib/inquiries.ts](../src/lib/inquiries.ts) |
| 관리자 | 대시보드 상단 **1:1 문의** 카드 — 답변 대기 건이 위로 온다 |

한계 두 가지를 알고 쓸 것:

- **답변 알림을 보낼 수 없다.** 푸시가 범위 밖이라 사용자가 앱을 다시 열어야 답변을 본다.
- **앱을 지우면 익명 세션이 사라져 문의 내역도 못 본다.** 그래서 문의 작성 시 이메일을 선택 입력받는다 —
  값이 있으면 관리자가 메일로 답할 수 있다.

## 보안

- 앱이 쓰는 `anon` 키는 공개돼도 되는 키다. RLS 정책상 **INSERT만** 가능하고 SELECT는 막혀 있어,
  키가 노출돼도 남의 기록을 읽을 수 없다.
- 원본 이벤트와 집계 뷰는 **`admins`에 등록된 계정만** 읽는다.
  익명 로그인 사용자도 `authenticated`이므로 역할만으로 판단하면 전체 트래킹 데이터가 새어나간다.
- 문의 메시지는 사용자가 `sender = 'user'`로만 쓸 수 있다 — 운영자 답변을 위조할 수 없다.
  상태 변경(답변 완료/종료)도 관리자만 가능하다.

## 알아둘 점

- 날짜 집계는 **UTC 기준**이다. 한국시간 오전 9시 이전 접속은 전날로 잡힌다.
  KST로 보려면 `schema.sql`의 `created_at::date`를 `(created_at at time zone 'Asia/Seoul')::date`로 바꾼다.
- 집계는 SQL 뷰에서 끝내고 브라우저는 결과만 받는다. PostgREST 기본 1000행 제한에 걸리지 않게 하려는 구조이니,
  뷰를 걷어내고 원본 `events`를 그대로 불러오는 식으로 바꾸지 말 것 (조용히 잘린 수치가 나온다).
- 기간 필터는 없다. 전체 누적 + 일별 추이 그래프로 본다. 기간별로 끊어 보고 싶어지면
  뷰에 `day` 컬럼을 넣고 필터를 거는 방식이 자연스럽다.
