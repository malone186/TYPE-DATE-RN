# TYPE DATE 출시 체크리스트

> 작성일: 2026-08-30 · 기준 브랜치 `master`
> 범위: 출시까지 남은 작업. **SNS 공유 기능은 이번 범위에서 제외.**
> 표기: `[사장님]` = 계정·콘솔 권한이 필요해 개발자가 대신할 수 없는 일 / `[개발]` = 코드 작업

---

## 0. 지금까지 끝난 것

| | 내용 |
|---|---|
| 1:1 문의 연동 | Supabase 프로젝트 복구 + `.env.local` 생성. 문의 → DB 저장 실제 확인 완료 |
| 대시보드 로그인 게이트 | 로그인 전에 대시보드가 그대로 노출되던 CSS 버그 수정 |
| 대시보드 실행 | `npm run admin` → http://localhost:5174 |
| **인앱결제 코드** | `src/lib/billing.ts` 신규. 결제 확인 후에만 광고 제거가 열림 + 구매 복원 + 실매출 집계 |
| EAS 빌드 환경 | `eas.json` 3개 프로파일 + `expo-dev-client` 설치 |
| 개인정보 처리방침 | `PRIVACY_POLICY.md` 초안 (채워야 할 항목은 `[ ]` 표시) |

**아직 커밋되지 않았습니다.** 위 변경은 전부 작업 트리에만 있습니다.

---

## 1. 크리티컬 패스 — 제일 먼저 시작할 것

> **결제 프로필 심사에 며칠 걸립니다.** 다른 걸 먼저 하면 여기서 전체 일정이 막힙니다.

### 1-1. `[사장님]` Google Play Console 결제 준비

- [ ] Play Console에 앱 등록 — 패키지명 **`com.typedate.app`** (`app.json`에 이미 설정됨, 바꾸지 말 것)
- [ ] **결제 프로필 등록** ← 심사 리드타임 있음. 오늘 시작할 것
- [ ] 인앱 상품 생성
  - 상품 ID: **`remove_ads`** ← `src/lib/billing.ts`의 `REMOVE_ADS_SKU`와 **글자 하나까지 같아야 함**
  - 유형: 관리되는 상품(비소모성) — 한 번 사면 영구
  - 가격: 2,200원 (앱 표시 문구와 맞출 것)
- [ ] 라이선스 테스터에 본인 구글 계정 추가 → 실제 청구 없이 결제 테스트 가능
- [ ] 내부 테스트 트랙 생성

### 1-2. `[사장님]` Expo 계정 연결

현재 로그인 상태가 아닙니다(`Not logged in`). 계정 자격이 필요해 개발자가 대신할 수 없습니다.

```bash
npx eas-cli login          # Expo 계정 (무료 가입)
npx eas-cli init           # app.json에 projectId 기록 — 없으면 빌드 불가
```

### 1-3. `[사장님]` EAS 환경변수 등록 — **빠뜨리면 조용히 고장납니다**

`.env.local`은 `.gitignore` 대상이라 EAS 빌드 서버로 올라가지 않습니다. 등록하지 않으면 빌드된 앱에서 **문의와 통계가 아무 오류 없이 꺼진 채로 출시**됩니다.

```bash
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL \
  --value "https://odugzjsopjhekjmbrrnd.supabase.co" --visibility plaintext

npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value "sb_publishable_hlc2DNv220ysZYkrFOvI8A_uqeZQa23" --visibility plaintext
```

등록 후 확인:

```bash
npx eas-cli env:list
```

---

## 2. 빌드와 결제 검증

### 2-1. `[사장님]` 빌드 실행

```bash
npx eas-cli build --platform android --profile development   # 개발용 APK
npx eas-cli build --platform android --profile production    # Play 업로드용 AAB
```

### 2-2. 결제 테스트 경로 — **개발 빌드로는 안 됩니다**

Google Play Billing은 **Play를 통해 배포된 빌드에서만** 동작합니다. APK를 기기에 직접 설치하면 서명 키가 달라 결제가 실패합니다.

```
production 프로파일로 AAB 빌드
  → Play Console 내부 테스트 트랙에 업로드
  → 테스터를 라이선스 테스터로 등록
  → 테스터가 Play 스토어 링크로 설치
  → 이때부터 실제 결제 흐름 동작 (테스터는 청구 없음)
```

개발 빌드(`development`)는 결제 이외의 모든 것 — 화면·연출·문의·통계 — 을 실기기에서 확인하는 용도입니다.

### 2-3. `[개발]` 결제 실동작 검증 — **아직 한 번도 못 돌려봤음**

현재 검증된 범위는 "타입이 맞고, 웹에서 앱이 안 깨지고, 결제 없이 광고가 열리지 않는다"까지입니다. 실제 결제 흐름은 위 트랙이 준비돼야 확인 가능합니다.

- [ ] 구매 → 광고 제거가 실제로 켜지는가
- [ ] **앱 삭제 후 재설치 → 광고 제거가 복원되는가** (비소모성 상품은 복원 제공이 스토어 정책상 의무)
- [ ] 구매 취소·실패 시 앱이 멀쩡한가
- [ ] 대시보드 수익 현황에 `remove_ads` 이벤트가 `source: purchase`로 잡히는가
- [ ] 복원으로 열린 건은 `source: restore`로 구분되는가

---

## 3. `[개발]` 광고 SDK (AdMob) — 미착수

현재 `src/screens/AdInterstitialScreen.tsx`는 **5초 카운트다운만 도는 빈 박스**입니다. 광고 노출이 0이라 광고 수익도 0입니다.

- [ ] `react-native-google-mobile-ads` 설치 + config plugin 설정
- [ ] AdMob 계정에서 앱 등록 → 앱 ID를 `app.json`에 기록
- [ ] 전면 광고 단위 생성
- [ ] `AdInterstitialScreen`의 자리표시자 박스를 실제 광고 뷰로 교체
- [ ] **`track('ad_shown')`을 '광고 로드 성공' 콜백으로 이동** ← 지금은 화면 진입 시점이라 노출 수가 부풀려짐. 해당 위치에 주석 있음
- [ ] `adRemoved`가 켜진 사용자에게 광고가 안 뜨는지 확인

> 결제와 광고 둘 다 없으면 수익이 0입니다. 결제만 막아둔 현재 상태로 출시하면 매출이 나올 구멍이 없습니다.

---

## 4. `[사장님]` 개인정보 처리방침

`PRIVACY_POLICY.md`의 `[ ]` 항목을 채우고 웹에 게시해야 합니다.

- [ ] 사업자명 / 개인정보 보호책임자 이름
- [ ] **연락받을 이메일** (스토어 필수)
- [ ] 보유 기간 (초안에 1년으로 예시 기입)
- [ ] Supabase 프로젝트 리전
- [ ] 시행일
- [ ] **공개 URL로 게시** — GitHub Pages·Vercel·노션 공개 페이지 무엇이든 가능. 파일만으로는 제출 불가
- [ ] Play Console → 앱 콘텐츠 → 개인정보처리방침에 URL 등록
- [ ] 앱 설정 화면에 방침 링크 노출 `[개발]`

### 데이터 수집 신고 — 방침 내용과 반드시 일치시킬 것

- [ ] Google Play 데이터 보안(Data Safety) 양식
- [ ] App Store 앱 개인정보 보호(App Privacy) — iOS 병행 시

**AdMob 연동 후에는 방침을 반드시 갱신해야 합니다.** 지금 초안은 "광고 식별자 수집 안 함 / 추적 안 함"으로 적혀 있는데, AdMob을 붙이는 순간 사실과 달라집니다. 갱신하지 않으면 심사 반려 또는 앱 내림 사유입니다. 상세 항목은 `PRIVACY_POLICY.md` 부록 참조.

---

## 5. 출시 직전에 할 것

### 5-1. `[사장님]` 더미 데이터 삭제

**지금 지우면 그동안 테스트하면서 또 쌓입니다. 스토어 제출 직전에** Supabase SQL Editor에서 실행하세요.

먼저 건수 확인:

```sql
select 'events' as t, count(*) from public.events
union all select 'inquiries', count(*) from public.inquiries
union all select 'inquiry_messages', count(*) from public.inquiry_messages
union all select '익명계정', count(*) from auth.users where is_anonymous;
```

확인 후 삭제 (**되돌릴 수 없음**):

```sql
delete from public.events;      -- 테스트 기간 분석 이벤트
delete from public.inquiries;   -- 문의 (메시지는 FK cascade로 함께 삭제)
delete from auth.users where is_anonymous;   -- 테스트로 생긴 익명 계정 (선택)
```

남길 문의가 있으면 `where id <> N`으로 제외하세요.

### 5-2. `[사장님]` 스토어 등록 정보

- [ ] 앱 스크린샷 (바탕화면 `TYPE_DATE_스크린샷` 폴더에 7장 있음)
- [ ] 앱 설명 / 짧은 설명
- [ ] 아이콘·피처 그래픽
- [ ] 콘텐츠 등급 설문
- [ ] 타겟 연령층 (방침상 만 14세 미만 비대상으로 작성됨 — 일치시킬 것)

### 5-3. `[개발]` 최종 점검

- [ ] `npm run typecheck` 통과
- [ ] `app.json`의 `version` 확인 (현재 `1.0.0`)
- [ ] 작업 트리 변경분 커밋

---

## 6. 알아둘 함정

| | |
|---|---|
| **Supabase 무료 플랜 정지** | 일정 기간 미사용 시 자동 정지됨. 이번에 겪은 원인이 이것. 데이터는 안 지워지고 복구에 2~5분. **발표·시연 직전 살아있는지 확인** |
| **상품 ID 불일치** | Play Console 상품 ID ≠ `REMOVE_ADS_SKU`면 결제가 조용히 실패 |
| **EAS 환경변수 누락** | 빌드는 성공하는데 앱에서 문의·통계만 안 됨. 오류 메시지가 안 뜨는 설계라 원인 찾기 어려움 |
| **결제 테스트 착각** | 개발 빌드 APK로는 Play Billing 테스트 불가 |
| **광고 제거 복원** | 구현은 했으나 실기기 미검증. 이게 안 되면 돈 낸 사용자에게 광고가 다시 나옴 |
| **`.env.local`** | 로컬 개발용. 커밋되지 않으며 EAS에도 안 올라감 |

---

## 7. 권장 순서

```
1. Play Console 결제 프로필 등록          ← 오늘 시작 (심사 리드타임)
2. Expo 로그인 + eas init + 환경변수
3. AdMob 연동                            [개발]
4. development 빌드 → 실기기 전반 확인
5. production 빌드 → 내부 테스트 트랙 → 결제·복원 검증
6. 개인정보 처리방침 게시 + 데이터 신고
7. 스토어 등록 정보 준비
8. 더미 데이터 삭제 → 제출
```

1·2는 사장님, 3은 개발이라 **병렬로 진행 가능**합니다.
