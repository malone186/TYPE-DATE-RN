# TYPE DATE 출시 체크리스트 — 검토 반영본

> 검토일: 2026-08-31 · 코드 기준 HEAD: `f16249b`
> 범위: Android 우선 출시 준비. SNS 공유 신규 개발·iOS 동시 출시는 이번 계획에서 제외한다.
> 이번 작업은 로컬 코드·설정·migration·문서와 자동 검사까지 수행했다. 운영 DB 적용·실기기/스토어 검증·스토어 제출을 완료했다는 뜻이 아니다.
> 상세 실행 명세: [LUNA_LAUNCH_IMPLEMENTATION_PLAN.md](LUNA_LAUNCH_IMPLEMENTATION_PLAN.md)

## 0. 현재 상태와 기존 문서 정정

| 항목 | 확인 결과 |
|---|---|
| 커밋 상태 | 기존 사용자 변경(`LAUNCH_CHECKLIST.md`, 미추적 개인 설정)은 보존. 이번 작업 변경은 아직 커밋하지 않음 |
| 결제 | 상품 조회·스토어 표시 가격·중복 방지·복원·foreground 재조회·서버 검증 후 entitlement/finish 순서를 구현. 실기기 성공 증거는 없음 |
| 타입 검사 | `npm.cmd ci` 후 `npm.cmd run typecheck` 통과 |
| 대시보드 수익 | 구매/복원/테스트/레거시를 분리하고, 검증 거래 수와 광고 eCPM 추정치를 구분. 정산액 집계 완료 아님 |
| 광고 | `react-native-google-mobile-ads@15.8.3`과 UMP 동의 경계, `OPENED` 기준 이벤트, 3초 fallback 구현. 실기기/콘솔 검증은 없음 |
| EAS | 3개 프로파일에 environment 추가. projectId·원격 변수·AdMob 실제 ID는 미확인 |
| 문의·통계 | publishable `apikey` 전송·HTTP 실패 진단 구현. 운영 DB/RLS 적용과 실제 전송 성공은 별도 검증 필요 |
| 개인정보 | 실제 익명 계정·device_id·선택 이메일·SDK/결제 흐름을 반영. 사업자/연락처/보유 기간/리전은 운영자 확정 필요 |

### 반드시 고친 판단

- 개발 APK도 **라이선스 테스터·패키지 일치 등 조건을 충족하면** Play Billing 테스트가 가능하다. 최종 출시 검증은 Play 내부 테스트 설치 경로를 사용한다. 내부 테스트 참여만으로 무료 결제가 보장되지 않는다. [Google 결제 테스트](https://developer.android.com/google/play/billing/test)
- 전면 광고는 일반 React View 안에 삽입하는 방식이 아니라 SDK 전체 화면 표시 흐름이다. `LOADED`는 노출이 아니다. 현재 문서화된 라이브러리에서는 `OPENED`가 표시 확인 이벤트이며, 설치 버전의 API를 확인해야 한다. [광고 표시](https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads), [이벤트 정의](https://github.com/invertase/react-native-google-mobile-ads/blob/main/src/AdEventType.ts)
- `source: purchase` 이벤트만으로 실제 결제 검증·중복 제거·환불 반영·정산이 되는 것은 아니다.
- 관리자 콘솔 작업도 권한이 위임되면 개발자가 수행할 수 있다. 다만 계정 소유자만 결정할 사업자 정보·약관·결제 수단·공개 제출은 구분한다.
- 데이터 전체 삭제를 출시 필수 단계로 삼지 않는다. 기존 정보는 보존하고 테스트 범위를 식별해 제외하는 방식을 우선한다.

## 1. 소유자 확인 — 일정에 먼저 반영

- [ ] Play 개발자 계정 유형·생성일·프로덕션 접근 상태 확인.
- [ ] 2023-11-13 이후 생성한 개인 계정이라면 적용 여부 확인: 최소 12명이 연속 14일 참여하는 비공개 테스트 후 프로덕션 접근 신청. 내부 테스트와 별개다. [공식 요구사항](https://support.google.com/googleplay/android-developer/answer/14151465)
- [ ] 결제 프로필·신원/기기 확인 등 콘솔의 실제 미완료 항목 확인. 심사 기간은 보장하지 않음.
- [ ] 패키지 `com.typedate.app` 유지.
- [ ] 비소모성 일회성 상품 `remove_ads` 등록·판매 가능 상태 확인. 한국 기준 목표 가격 2,200원. 앱은 스토어 상품 가격을 조회해 표시.
- [ ] 내부 테스트 참여 계정과 라이선스 테스트 계정을 각각 등록하고 실제 구매 계정 일치 확인.
- [ ] AdMob 앱 ID·전면 광고 단위 ID 발급. 광고 송출 준비/검토 상태, 콘솔이 요구하는 앱 소유권 확인·app-ads.txt 작업 확인.
- [ ] 운영자/책임자·문의 이메일·보유 기간·실제 Supabase 리전·공개 방침 URL·출시 국가/연령층 확정.
- [ ] Expo 프로젝트 소유 계정과 연결 대상 확인. 이미 연결된 프로젝트를 중복 생성하지 않음.

## 2. 개발 준비와 빌드 환경

- [x] 기존 변경을 보존하고 잠금 파일 기준 `npm.cmd ci` 후 `npm.cmd run typecheck` 통과.
- [ ] 필요 시 `npx.cmd eas-cli whoami` → 로그인 → 기존 프로젝트 확인 → `init` 순으로 진행.
- [x] `eas.json`의 development / preview / production에 대응 `environment` 명시.
- [ ] EAS 각 환경에 Supabase URL·공개 키와 해당 환경 설정 등록. `.env.local` 전달을 전제로 하지 않음.
- [ ] 공개 키/프로젝트 URL을 문서에 실제 값으로 복제하지 않음. `EXPO_PUBLIC_*`는 앱에서 읽을 수 있으므로 비밀 저장소가 아님.
- [x] production 설정 누락·테스트 광고 ID·미완성 방침 URL을 config/계약 검사에서 차단. 로컬 데모는 서비스 없는 상태로 실행 가능.
- [ ] 현재 CLI 도움말로 환경변수 명령 확인. 공식 예시는 `env:set`; 기존 `env:create` 사용 가능 여부는 설치 CLI에서 확인.

PowerShell 명령 예시 — 소유자 확인 후 실제 값으로 입력한다.

```powershell
npx.cmd eas-cli --version
npx.cmd eas-cli env:set --help
npx.cmd eas-cli env:set --name EXPO_PUBLIC_SUPABASE_URL --value "<SUPABASE_URL>" --environment production --visibility plaintext
npx.cmd eas-cli env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<PUBLISHABLE_OR_ANON_KEY>" --environment production --visibility plaintext
npx.cmd eas-cli env:list --environment production
```

development/preview도 각각 확인한다. 값이 공개형이어도 전체 키를 로그/보고서에 출력할 필요는 없다. [Expo 환경변수](https://docs.expo.dev/eas/environment-variables/)

## 3. 출시를 막는 코드 작업

- [x] 통계 REST 인증 수정: publishable 키를 JWT처럼 Bearer에 넣지 않음. 공개 `apikey`와 사용자 JWT 역할 구분.
- [x] 통계 HTTP 비정상 상태 감지·민감정보 없는 개발 진단 추가. 게임 진행은 계속 허용.
- [x] 상품 조회·스토어 가격 표시·결제 전역 중복 방지·취소/실패/대기 안내(실기기 미검증).
- [x] 수동 구매 복원, 구매·복원 동일한 구매상태 검증, 재시도/리스너 수명 관리(실기기 미검증).
- [x] 서버 구매 검증 함수·거래별 중복 방지·승인 재시도·환불/취소 권한 갱신 준비. 배포·실 API 검증은 미완료.
- [x] 광고 SDK·동의 흐름·테스트 광고·웹/Expo Go 대체 동작 구현(실기기 미검증).
- [x] 광고 닫힘/오류/광고 없음/시간 초과 시 결과 화면으로 정확히 한 번 진행.
- [x] 광고 제거 사용자와 소유권 확인 중 광고 요청 차단.
- [x] 구매/복원/테스트/과거 더미 이벤트 분리. 검증 안 된 이벤트를 실매출로 표시하지 않음.
- [x] 설정에 개인정보처리방침 링크와 광고 개인정보 선택 진입점 추가.
- [x] `admin/README.md`·SQL 주석·화면 문구의 “결제 없이 광고 제거” 설명 정리.
- [ ] RLS를 UI 로그인 게이트와 별개로 검증.

공개 키와 JWT는 다르다. [Supabase API 키](https://supabase.com/docs/guides/getting-started/api-keys)
검증·권한 부여·구매 승인은 구분해서 처리한다. [Google 구매 보안](https://developer.android.com/google/play/billing/security)

## 4. 개인정보와 운영

- [x] “이름을 입력받지 않음” → 게임 호칭은 로컬 입력, 문의 이메일은 선택 수집으로 구분.
- [x] UUID·익명 계정이 있다는 이유만으로 “식별 불가능/연결 안 됨”이라고 단정하지 않음. 문의에 device_id·email·user_id가 함께 저장되는 현재 구조 반영.
- [x] 회차 결과 일부가 분석 이벤트로 전송된다는 사실 반영.
- [x] 이메일 자동 발송·자동 파기·즉시 삭제 등 구현/운영 증거 없는 약속 삭제 또는 실제 절차 마련.
- [x] AdMob/Google Play의 수집·처리 내용을 문서에 반영. iOS ATT는 실제 추적 용도에 따라 검토하도록 정리.
- [ ] 삭제 요청을 식별·처리하는 절차와 연락처 마련. 문의 기능 장애 시 외부 연락 경로 확보.
- [ ] 공개 방침은 로그인 없이 열리는 활성 URL, 지역 제한 없는 일반 웹 페이지로 준비. Google Play 요구사항에 맞춰 PDF 등 부적절한 게시 형식 제외.
- [ ] Data Safety·광고 포함 여부·콘텐츠 등급·대상 연령·국가 설정을 실제 동작과 대조.

[Google 사용자 데이터 정책](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en), [Google 광고 동의](https://developers.google.com/admob/android/privacy), [Apple 추적 기준](https://developer.apple.com/app-store/user-privacy-and-data-use/)

## 5. 검증과 출시 판정

- [x] 의존성 설치 후 타입 검사, Expo 호환성 진단, 웹 export. 로컬 명령 결과는 `LAUNCH_VERIFICATION.md`에 기록했고, 중복 `expo-constants` 수정 후 Expo Doctor 18/18 통과.
- [ ] Android development 빌드에서 핵심 플레이·문의·통계·광고 예외 처리 검증.
- [ ] Play 내부 테스트 AAB에서 구매/취소/실패/대기/복원/재설치/환불 검증.
- [ ] 광고 노출 1회=분석 표시 이벤트 1회, 로드만 성공=0회.
- [ ] 구매 복원 및 테스트 구매는 신규 유료 매출에 포함되지 않음.
- [ ] 데이터 격리: 익명 사용자 A가 B의 문의를 읽거나 답변을 위조하지 못함.
- [ ] 테스트 대상 이벤트는 태그·거래 검증 결과·명시적 범위로 제외. 과거 분류 불가 데이터는 보존하고 수익 산식에서 제외.
- [ ] 삭제가 정말 필요하면 대상 ID 목록·백업·예상 cascade 영향·복구 절차를 검토한 뒤 별도 승인. 전체 `auth.users` 익명 계정 삭제 금지.
- [ ] 실제 설치한 빌드의 package/version/versionCode·SDK target API·권한을 제출 시점 Play 요구사항과 확인.
- [ ] 스크린샷·설명·아이콘·피처 그래픽을 현재 빌드와 대조. 기존 바탕화면 이미지 존재/사용 가능 여부는 재확인.
- [ ] 소유자 입력과 스토어 테스트 증거가 비어 있으면 “코드 준비 완료”와 “출시 가능”을 구분해 보고.
- [ ] 변경 파일만 검토 후 커밋. `git add .`로 무관한 개인 설정을 포함하지 않음.

## 6. 진행 순서

1. 계정 요건·비공개 테스트 필요 여부·상품·AdMob·운영 정보 확인.
2. 로컬 의존성/환경 및 Supabase 통계 인증 문제 해결.
3. 결제 안정화와 서버 검증 → 수익 집계 계약 확정.
4. 광고 및 동의 → 개인정보/설정/운영 문서 정합성.
5. 로컬 자동 검사 → 개발 실기기 → Play 내부 테스트.
6. 필요 시 비공개 테스트와 프로덕션 접근 승인.
7. 제출 자료·운영 상태·증거 점검 → 소유자의 출시 승인.

계정 준비와 로컬 개발은 동시에 진행할 수 있다. 이 문서는 외부 배포·실결제·운영 DB 삭제의 실행 승인이 아니다.
