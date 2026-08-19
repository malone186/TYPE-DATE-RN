# TYPE_DATE 정비 작업 지시서

> 기준 커밋: `72eb000` · branch `master`
> 검증일: 2026-08-18

GPT 리뷰 8건을 코드로 교차 검증한 결과다. 사실로 확인된 것만 작업으로 옮겼고,
틀린 지적과 이미 처리된 항목은 아래 **손대지 말 것**으로 내렸다.
순서에는 의존 관계가 있다 — 번호대로 진행한다.

| 지금 할 작업 | 손대지 말 것 | 삭제할 죽은 파일 | escape 누락 지점 |
|---|---|---|---|
| 5건 | 7건 | 24MB | 3곳 |

---

## 시작 전 공통 규칙 (예외 없음)

1. 기존 코드는 **승인 전에 고치지 않는다.** 작업마다 "무엇을 / 어떻게 / 왜"를 먼저 보고하고 확인을 받는다.
2. 한 작업 = 한 커밋 = 한 PR. 작업 여러 개를 한 PR에 섞지 않는다.
3. 지시서에 없는 리팩터링·포매팅·주석 정리를 곁들이지 않는다. 바뀐 줄은 전부 지시서의 한 항목으로 설명돼야 한다.
4. 각 작업의 **검증** 항목을 실제로 돌린 결과를 PR 본문에 붙인다. "될 것 같다"는 통과가 아니다.

---

# 작업

## 01 · 뷰 캐스트 방어 — 대시보드 영구 정지 차단 `P0`

**파일:** `supabase/schema.sql` — L141, L154, L209, L213, L216, L232, L236

### 문제

7곳에서 `(props ->> 'turn')::int` 로 캐스팅한다. 익명 사용자가 `{"turn":"x"}` 이벤트를 **한 건만** 넣으면
`v_turn_reach` · `v_quit_turn` · `v_choice_rate` · `v_choice_balance` 4개 뷰가 전부 `22P02`로 죽는다.

events에 delete 정책이 없어서 관리자가 대시보드에서 그 행을 지울 수도 없다. SQL 에디터로 직접 들어가야 복구된다.

### 할 일

- 숫자가 아니면 `null`을 반환하는 안전 캐스트 함수를 만들고 7곳 전부 교체한다.
- 각 뷰의 `where`에 `props->>'turn' ~ '^[0-9]+$'` 필터를 추가한다.
- `events`에 관리자 전용 delete 정책을 추가한다 — 오염된 행을 대시보드에서 지울 수 있어야 한다.

### 검증

아래를 넣고 4개 뷰가 **에러 없이** 결과를 반환하면 통과. 그 뒤 관리자 계정으로 해당 행 삭제까지 확인한다.

```sql
insert into events (device_id, name, props)
values (gen_random_uuid(), 'choice', '{"turn":"x"}');
```

---

## 02 · 이벤트 입력 검증과 관리자 화면 escape `P0`

**파일:** `supabase/schema.sql`, `admin/index.html`

### 문제

events insert 정책이 `with check (true)`라 익명 사용자가 `name`·`episode_id`·`props`를 무엇이든 넣을 수 있다.
그 값 중 3곳이 관리자 화면에서 escape 없이 `innerHTML`로 들어간다.

### 할 일 — 서버

- `name`을 실제 쓰는 9개로 제한한다: `app_open`, `screen_view`, `choice`, `episode_start`, `episode_complete`, `episode_quit`, `ad_shown`, `remove_ads`, `error`
- `line`은 `'male'` / `'female'`만 허용한다.
- `episode_id`에 길이와 패턴 제한을 건다.
- device_id 기준 rate limit을 건다.

### 할 일 — 관리자 화면 (이 3곳만)

| 위치 | 대상 |
|---|---|
| `admin/index.html:1079` | 회차 선택 `<option>` — value와 텍스트 양쪽 다 `esc()` |
| `admin/index.html:1022~` | 밸런스 표의 `episode_id`, `label` |
| `admin/index.html:668` | `hoverable(bar, ...)`의 `r.label` — 툴팁이 innerHTML이다 |

### 손대지 말 것

나머지 `innerHTML`은 **이미 `esc()`가 걸려 있다.** 오류 표, 챕터 카드, 문의 목록, 문의 스레드는 건드리지 않는다.
전수 교체하지 말고 위 3곳만 고친다.

### 검증

`episode_id`에 `<img src=x onerror=alert(1)>`를 넣은 이벤트를 삽입한 뒤,
대시보드 회차 탭 · 밸런스 표 · 퍼널 툴팁 세 곳 모두에서 스크립트가 실행되지 않는지 확인한다.

---

## 03 · 의존성 복구와 자동 검사 도입 `P0`

**파일:** `package.json`, `.github/workflows/`

### 문제

현재 `npx tsc --noEmit`이 딱 한 줄로 실패한다.

```
src/lib/supabase.ts(2,46): error TS2307: Cannot find module '@supabase/supabase-js'
```

package.json에는 이미 선언돼 있고 node_modules에만 없다. **코드 문제가 아니다.**
그리고 테스트·린트·CI가 전부 없다.

### 할 일

- `npm install` 후 `npx tsc --noEmit`이 0 에러인지 확인한다.
- CI에 `npm ci` + typecheck를 넣는다.
- 대본 validator를 추가한다:
  - 선택지가 정확히 4개인지
  - `turnNumber`가 1부터 끊김 없이 이어지는지
  - `imagePath`·`facePath`·`backgroundPath`가 registry에 실제로 있는 키인지

### 손대지 말 것

package.json의 **버전 범위를 임의로 올리지 않는다.** Expo SDK 54 조합이라 개별 업그레이드는 별건으로 다룬다.

### 검증

깨끗한 클론에서 `npm ci && npx tsc --noEmit`이 통과하고,
validator가 현재 대본 32개(여자 16 + 남자 16)를 전부 통과하는지 확인한다.

---

## 04 · 죽은 이미지 파일 삭제 — 24MB `P1`

**파일:** `assets/images/`

### 문제

assets 총 44MB 중 24MB가 **아무데서도 참조되지 않는 잔재**다.
registry는 이미 배경 전부를 `.jpg`로 가리키고 있는데, 예전 `.png` 원본이 같이 남아 있다.
변환 작업이 아니라 삭제 작업이다.

### 삭제 대상 — 11개 (전부 참조 0건, jpg 쌍 존재 확인 완료)

```
ESTP_background.png   ESTJ_background.png   INTP_background.png
ISTP_background.png   ISFP_background.png   ISTJ_background.png
ISFJ_background.png   ESFJ_background.png   INFP_background.png
INFJ_background.png   소개팅신 배경.png
```

### 손대지 말 것

`src/assets/images.ts`의 **registry 키 문자열은 그대로 둔다.**

`.png` 키가 `.jpg` 파일을 가리키는 건 실수가 아니라 의도된 구조다 — 대본 데이터의 경로 문자열이 그 키를 그대로 쓴다.
키를 "정리"하면 대본 32개가 전부 깨진다.

`logo.png` · `logo_intro.png` · `logo_mark.png`도 살아 있는 파일이니 남긴다.

### 검증

삭제 후 앱을 실행해 캐릭터 16종의 배경이 전부 뜨는지 눈으로 확인한다.
**typecheck만으로는 잡히지 않는다** — 이미지 참조는 런타임에 끊긴다.

---

## 05 · 선택지 ID 분리 — 죽어 있는 밸런스 통계 복구 `P1`

**파일:** `src/screens/BlindDateChatScreen.tsx:54`, `:194`, `supabase/schema.sql`

### 문제

`shuffleChoices()`가 선택지를 섞은 뒤 **위치 기준으로 A~D를 다시 붙인다.**
그런데 `track('choice')`는 그 재할당된 라벨을 기록한다.

셔플이 균등 랜덤이므로 A·B·C·D는 항상 25%로 수렴하고,
`v_choice_balance`의 경고 조건(`5%` 미만 또는 `70%` 초과)은 **구조적으로 절대 발화하지 않는다.**
튜닝이 필요한 게 아니라 기능이 죽어 있다.

### 할 일

- `Choice` 타입에 `choiceId`를 추가하고 대본의 선택지마다 고정 ID를 부여한다.
- `shuffleChoices()`는 지금처럼 `label`만 재할당하고 `choiceId`는 보존한다.
- `track('choice')`의 props에 `choiceId`를 함께 보낸다.
- 밸런스·선택률 뷰와 대시보드 표를 `choiceId` 기준으로 바꾼다.

### 손대지 말 것

**셔플 자체는 유지한다.** 데이터상 좋은 답이 앞자리에 몰려 있어서 위치 암기를 막으려고 넣은 장치다.
셔플을 없애면 게임이 망가진다.

기존 `label` 필드도 남긴다 — 점 색상 그라디언트가 위→아래 순서를 쓴다.

### 검증

같은 회차를 여러 번 플레이한 뒤, 대시보드 선택률이 25% 근처에 균등하게 모이지 않고 실제로 갈리는지 확인한다.
균등하게 나오면 아직 라벨을 보고 있는 것이다.

---

# 손대지 말 것 (승인 없이 변경 금지)

| 대상 | 이유 |
|---|---|
| **광고 제거 로직**<br>`SettingsSheet.tsx:106` | 결제 없이 켜지는 건 이미 알고 미뤄둔 임시 상태다. 코드 주석과 프로젝트 기록 양쪽에 남아 있다. Google Play Billing을 붙일 때 한 번에 처리한다. |
| **문의 RLS 정책**<br>`schema.sql:308` | 잘 짜여 있다. 사용자가 `sender: 'admin'`으로 답변을 위조하는 것까지 이미 막혀 있다. 빈 스레드·closed 상태 두 건은 별도 작업으로 뺀다. |
| **이미 escape된 innerHTML** | 오류 표, 챕터 카드, 문의 목록, 문의 스레드는 전부 `esc()`가 걸려 있다. 작업 02의 3곳 외에는 건드리지 않는다. |
| **registry의 `.png` 키**<br>`src/assets/images.ts` | 의도된 구조다. 대본 32개가 이 키 문자열을 그대로 참조한다. "일관성 있게" 정리하면 전부 깨진다. |
| **선택지 셔플** | 위치 암기 방지 장치다. 통계를 고치려고 셔플을 없애는 건 게임을 부수는 것이다. |
| **3~16화 대본 턴 수** | 13턴으로 PRD와 일치한다. 어긋난 건 1·2화(10턴)와 남자 라인(9턴)뿐이고, 그건 작업 06 대기 항목이다. |
| **PROGRESS_REPORT.md** | Flutter 시절(2026-06-30) 문서다. 현재 코드와 안 맞는 게 맞지만, 폐기할지 갱신할지는 결정이 필요하다. 임의로 지우지 않는다. |

---

# 대기 항목

## 06 · 엔딩 난이도 조정 `HOLD` — 작업 05 이후

**파일:** `src/state/store.ts:198`

### 배경

성공/실패 기준이 모든 회차에서 `±5`로 고정인데 턴 수는 제각각이다. 성공에 필요한 정답 수를 계산하면:

| 회차 | 턴 | 성공 조건 | 실패 조건 |
|---|---|---|---|
| 남자 라인 전체 | 9 | 7/9 (78%) | ≤2 |
| 여자 1·2화 | 10 | 8/10 (**80%**) | ≤2 |
| 여자 3~16화 | 13 | 9/13 (69%) | ≤4 |

**신규 유저가 가장 먼저 보는 1·2화가 가장 어렵다.** 밸런스보다 이탈 문제에 가깝다.

### 지금 하지 않는 이유

턴 수를 통일할지 회차별 threshold를 둘지는 실제 플레이 분포를 봐야 정할 수 있다.
그 분포는 작업 05를 마쳐야 신뢰할 수 있다. **05의 데이터가 쌓이기 전에는 착수하지 않는다.**

---

이 지시서에 없는 문제를 발견하면 **고치지 말고 보고한다.**
범위를 넓히는 판단은 작업자가 아니라 지시하는 쪽에서 한다.
