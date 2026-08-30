# TYPE DATE — Android 출시 준비 인수인계 기획서

작성일: 2026-08-31  
전달 대상: EAS 계정·Android 빌드를 담당할 친구 및 후속 개발 담당자  
기준: 현재 작업 폴더의 소스와 같은 날짜의 로컬 검사 결과

## 1. 먼저 알아야 할 현재 상태

TYPE DATE는 Expo / React Native로 만든 게임이다. Android 출시를 위해 결제·광고·통계·개인정보 관련 코드를 1차로 수정했다. 로컬 의존성 설치, 앱 타입 검사, Expo Doctor, 웹 번들은 통과했다.

**하지만 아직 Android APK/AAB를 만들어 설치한 결과가 없고, 결제·광고·서버의 실제 동작도 검증하지 않았다.** 후속 코드 보완도 남아 있으므로 EAS 로그인만 하면 출시가 끝나는 상태는 아니다.

친구가 우선 맡을 일은 **본인에게 권한이 있는 Expo 계정으로 프로젝트를 연결하고, 테스트용 Android 빌드를 만들어 전달하는 것**이다. Supabase·Google Play·AdMob 작업은 각 서비스 권한을 가진 사람이 별도로 담당한다. EAS 담당이라는 이유로 모든 서버·스토어 작업까지 맡는 것은 아니다.

EAS는 Expo의 클라우드 빌드 서비스다. 이 프로젝트에서는 Android 설치용 APK와 Play 업로드용 AAB를 만드는 데 사용한다. 빌드가 성공해도 Play 심사나 출시가 자동으로 완료되는 것은 아니다. [Expo 빌드 안내](https://docs.expo.dev/build/setup/)

## 2. 유지할 범위와 식별값

| 항목 | 현재 값 / 원칙 |
|---|---|
| 앱 이름 / slug | TYPE DATE / `type-date` |
| 앱 버전 | `1.0.0` |
| Android package | `com.typedate.app` — 임의 변경 금지 |
| 광고 제거 상품 | `remove_ads` — 비소모성 일회성 구매 |
| 가격 | 한국 목표 2,200원. 앱 표시 가격은 Google Play 상품 조회 결과 사용 |
| Expo / React Native | `~54.0.37` / `0.81.5` |
| 주요 네이티브 라이브러리 | `expo-iap` 설치 버전 5.4.1, `react-native-google-mobile-ads` 15.8.3 |
| 중복 의존성 수정 | `expo-constants` 18.0.14 직접 지정, 중복 제거 |
| 우선 플랫폼 | Android. 웹 번들 유지 |
| 이번 범위 제외 | iOS 출시, SNS 공유 신규 개발, 스토리·캐릭터·게임 디자인 개편 |

## 3. 지금까지 한 작업

아래의 “구현”은 소스에 반영했다는 뜻이다. 실기기 성공이나 모든 예외 조건 통과를 뜻하지 않는다.

| 분야 | 소스에 반영한 내용 | 주요 파일 |
|---|---|---|
| 결제 | 상품 조회·스토어 가격, 구매 상태 안내, 구매 복원, 앱 시작/foreground 소유 내역 조회, 검증 후 광고 제거 처리 | `src/lib/billing.ts`, `src/state/store.ts` |
| 구매 검증 서버 | 익명 사용자 JWT 확인, Google Play 구매 조회·승인 요청, 토큰 해시로 거래 중복 방지 | `supabase/functions/verify-purchase/index.ts` |
| 구매 원장 | 구매 상태·테스트 여부·승인 상태·구매시각 저장, 관리자 조회 정책 | `supabase/migrations/202608310001_purchase_transactions.sql` |
| 광고 | SDK/설정 플러그인 추가, UMP 동의 요청, 테스트 광고 선택, 표시/닫힘/실패 콜백, 결과 화면 대기 제한 | `src/lib/ads.ts`, `src/screens/AdInterstitialScreen.tsx` |
| 분석 | 공개 키를 Bearer JWT로 보내던 코드 제거, HTTP 오류 진단, 환경·스키마 버전 태그 | `src/analytics/track.ts` |
| 집계 | 구매/복원/테스트/레거시 이벤트 분리, 검증된 거래 수와 광고 수익 추정치 분리 | 두 번째 migration, `supabase/schema.sql`, `admin/index.html` |
| 설정 화면 | 스토어 가격, 구매 복원, 개인정보처리방침 링크와 실패 안내, 광고 개인정보 설정, 스크롤 | `src/widgets/SettingsSheet.tsx` |
| 앱 초기화 | 저장 정보 복원 후 결제·광고 동의 초기화, 결제 정리 함수 연결 | `App.tsx`, `src/lib/supabase.ts` |
| 빌드 설정 | EAS 환경 지정, 동적 config, 정사각형 아이콘 사용, 환경값 예시 | `eas.json`, `app.config.js`, `.env.example` |
| 검사·문서 | 간단한 config/소스 계약 검사, 실제 데이터 흐름에 맞춘 개인정보·관리자 문서 정리 | `scripts/verify-launch-config.mjs`, 출시 관련 문서 |

기존 `td_ad_removed` 플래그는 구매 증거로 인정하지 않도록 변경했다. 새 로컬 캐시는 마지막으로 검증된 광고 제거 상태를 보관한다. 오프라인에서 이 상태를 유지하는 정책이므로 환불 반영이 다음 온라인 조회까지 지연될 수 있다.

## 4. 실제 검증한 것과 아직 검증하지 않은 것

아래 결과는 전달자 PC에서 앞선 구현 작업 중 실행한 결과다. 친구 PC에서의 성공을 보장하지 않으므로 코드를 받은 뒤 다시 실행한다.

| 명령 | 실제 결과 |
|---|---|
| `npm.cmd ci` | 성공. 최종 설치에서 audit 경고 23건: moderate 11 / high 12 |
| `npm.cmd run typecheck` | 성공 |
| `npm.cmd run verify:config` | 성공 |
| `npx.cmd expo install --check` | 의존성 정합성 통과 |
| `npx.cmd expo-doctor` | **18/18 통과**. 이전 중복 의존성 문제 해결됨 |
| `npx.cmd expo export --platform web --output-dir dist` | 성공, 782개 모듈 번들 |
| `git diff --check` | 성공, 줄바꿈 변환 경고만 있음 |
| `npx.cmd eas-cli whoami` | 전달자 PC에서는 `Not logged in`. 친구 계정 상태는 미확인 |

`verify:config`는 설정 누락 시 실패하는지와 일부 소스 문자열을 검사한다. 결제·광고 SDK를 실행하는 mock 테스트나 거래 동시성 테스트가 아니다. 앱 타입 검사에서도 Deno용 Edge Function은 제외되어 있다.

미검증: Android 빌드/설치, 네이티브 SDK 호환성, 결제 성공·복원·환불, 광고 표시·동의, Supabase 원격 RLS, migration 적용, Edge Function 실행, 작은 화면 UI, 실제 플레이, 공개 개인정보처리방침 URL.

## 5. 담당 구분

| 담당 | 해야 할 일 | 완료 시 넘길 것 |
|---|---|---|
| 전달자 / 앱 소유자 | 최신 코드 제공, 프로젝트 소유 계정과 운영 정보 확정, 필요한 권한 초대 | 소스 기준 커밋 또는 스냅샷, 운영 정보 |
| 친구 — EAS·빌드 담당 | 로그인, 올바른 프로젝트 연결, 환경 등록 확인, APK/AAB 빌드, 서명 관리 | EAS 프로젝트/빌드 링크, APK 또는 AAB, 오류 로그 요약 |
| 개발 담당 | 아래 6절 코드 보완, 회귀 테스트, 네이티브 오류 수정 | 수정 코드·검사 증거 |
| Supabase·Google API 권한 보유자 | 테스트 DB 적용, 함수·secrets 설정, Play API 권한, RLS 검증 | 적용 migration 목록, 테스트 결과 |
| Play·AdMob 계정 소유자 | 상품·테스터·광고·동의·정책·출시 설정 | 콘솔 준비 상태, 내부 테스트 링크 |

한 사람이 여러 역할을 맡아도 되지만 각 서비스의 접근 권한을 먼저 확인한다. 비밀번호를 공유하기보다 적절한 프로젝트/조직 권한을 부여한다.

## 6. 후속 개발자가 먼저 보완할 사항

인수인계 문서 작성 시 소스를 다시 확인한 결과다. 이 문서 작성에서는 앱 코드를 추가 수정하지 않았다.

| 우선순위 | 현재 확인된 한계 | 다음 작업 / 통과 조건 |
|---|---|---|
| P0 | production 검사는 `EXPO_PUBLIC_APP_ENV`가 정확히 `production`일 때만 실행된다. 누락되면 development로 처리된다 | production 빌드에서 환경값 누락/불일치도 실패하도록 보완하고 각각 테스트 |
| P0 | AdMob 광고 단위의 샘플 ID는 거르지만 앱 ID 검사는 형식만 확인한다 | production에서 공식 테스트 앱 ID도 거부하도록 보완 |
| P0 | 서버는 승인 실패를 `pending`으로 저장하지만 독립적인 영속 재시도 작업은 없다. 원장에는 토큰 해시만 있다 | 앱 미실행·재설치 상황의 재시도 방식과 안전한 토큰 접근 방식을 설계·구현. 해시만으로 Google 승인 API를 다시 호출할 수 없음 |
| P0 | 서버 acknowledge와 클라이언트 `finishTransaction`을 모두 호출한다 | 설치 SDK에서 중복 승인 처리·재시도·정상 종료 동작 확인. 비소모성 상품을 소비하지 않음 |
| P0 | 결제 초기 연결 실패 후 재연결, 상품 조회 중 연타, 구매/복원 중첩의 동작 테스트가 없다 | 재연결 시 리스너 복구, 요청 1건, 잠금 해제, 예외 처리에 대한 실행 테스트 추가 |
| P0 | Edge Function의 Deno 타입/실행 검사와 호출 남용 제한이 준비되지 않았다 | 인증·잘못된 입력·위조 토큰·시간 초과·호출 제한 검증 후 테스트 환경 배포 |
| P1 | 광고 코드의 SDK 초기화·동의 실패·늦은 로드·화면 이탈 처리는 실기기 미검증 | 지원 API를 확인하고 광고 1회 표시/결과 1회 전환, 광고 제거 사용자의 요청 차단 검증 |
| P1 | 관리자 화면은 누락 필드를 0으로 다룰 수 있고 연결 상태 안내가 충분하지 않다 | 검증 미연동/조회 실패와 실제 0건을 구분하는 표시 보완 |
| P1 | 의존성 audit 경고가 남아 있다 | 실행 앱 영향과 개발 도구 영향을 분류해 필요한 수정만 적용. `audit fix --force` 일괄 실행 금지 |

개발용 APK 생성은 위 코드 검토와 병행할 수 있다. 판매 활성화와 운영용 배포는 P0 보완 및 결제 검증이 끝난 뒤 진행한다.

## 7. 친구가 진행할 EAS 작업 순서

### 7-1. 최신 소스 받기

현재 변경 사항은 **아직 커밋하지 않은 상태**다. 기존 저장소를 clone하는 것만으로 이번 작업이 전달되지 않을 수 있다. 전달자는 변경을 검토한 커밋 또는 최신 소스 스냅샷을 제공하고, 친구는 받은 기준을 기록한다.

기존 추적 파일의 수정본뿐 아니라 다음 신규 파일/폴더도 반드시 포함한다.

- `app.config.js`, `.env.example`, `scripts/verify-launch-config.mjs`
- `src/lib/ads.ts`, `supabase/functions/verify-purchase/`, `supabase/migrations/`
- `LUNA_LAUNCH_IMPLEMENTATION_PLAN.md`, `LAUNCH_VERIFICATION.md`, 이 문서

`node_modules`, `dist`, 개인 `.claude/settings.local.json`, `.env.local`, 서비스 계정 JSON, 서명 키, 로그인 토큰은 소스 전달 대상에서 제외한다. `git add .`나 작업 폴더 전체 압축으로 개인 설정과 비밀 파일을 섞지 않는다. 현재 `.gitignore`가 모든 비밀 파일 이름을 자동 차단하는 것은 아니다.

### 7-2. 친구 PC에서 기준선 확인

프로젝트 최상위 폴더에서 아래 명령을 각각 실행하고 실패한 단계는 따로 기록한다. Windows PowerShell 예시이며 macOS/Linux에서는 `npm.cmd`와 `npx.cmd` 대신 `npm`, `npx`를 쓴다.

```powershell
node --version
npm.cmd --version
npm.cmd ci
npm.cmd run typecheck
npm.cmd run verify:config
npx.cmd expo install --check
npx.cmd expo-doctor
```

의존성을 임의로 최신 버전으로 올리지 않는다. 현재 잠금 파일을 기준으로 시작하고, 사용한 Node/npm 버전도 결과에 남긴다.

### 7-3. 로그인 및 프로젝트 연결

```powershell
npx.cmd eas-cli --version
npx.cmd eas-cli login
npx.cmd eas-cli whoami
```

Expo 대시보드에서 앱을 소유할 계정/조직과 기존 `type-date` 프로젝트가 있는지 확인한다. 현재 로컬 `app.json`에는 EAS `projectId`가 없다. 기존 프로젝트가 있으면 해당 ID로 연결하고, 없을 때만 소유 계정을 확인하여 생성한다.

```powershell
npx.cmd eas-cli init --help
npx.cmd eas-cli init
npx.cmd eas-cli project:info
```

`init`은 프로젝트 연결/생성을 수행하므로 화면의 계정과 대상을 읽고 진행한다. 기존 프로젝트 연결 옵션은 설치 CLI 도움말로 확인한다. 동적 `app.config.js`가 있으므로 자동 기록이 안 되면 실제 확인한 `extra.eas.projectId`를 config에 반영한 뒤 다시 확인한다. ID를 추정해서 넣지 않는다. [EAS CLI 참고](https://docs.expo.dev/eas/cli/)

완료 조건: 올바른 계정/프로젝트가 확인되고 `com.typedate.app`이 유지된다. 기존 Play 앱이 있다면 서명 키를 새로 바꾸지 말고 기존 업로드 키/Play App Signing 관계부터 확인한다.

### 7-4. 환경 변수 등록

`eas.json`에는 development / preview / production 환경 선택이 이미 있다. **환경을 선택하는 설정이 `EXPO_PUBLIC_APP_ENV` 변수까지 자동 생성하지는 않는다.** 각 EAS 환경에 별도로 등록한다. [EAS 환경 변수](https://docs.expo.dev/eas/environment-variables/)

| 이름 | development / preview | production | 저장 위치 |
|---|---|---|---|
| `EXPO_PUBLIC_APP_ENV` | 해당 환경 이름 | `production` 필수 | EAS 환경 변수 |
| `EXPO_PUBLIC_SUPABASE_URL` | 테스트 프로젝트 URL 권장 | 실제 프로젝트 URL | EAS 환경 변수 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | 해당 프로젝트 공개 키 | 해당 프로젝트 공개 키 | EAS 환경 변수 |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | 테스트 링크 또는 미등록 | 실제 공개 HTTPS 정책 URL | EAS 환경 변수 |
| `ADMOB_ANDROID_APP_ID` | 아래 공식 테스트 앱 ID | 실제 앱 ID | EAS 환경 변수, config용 |
| `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID` | 아래 공식 테스트 광고 단위 ID | 실제 전면 광고 ID | EAS 환경 변수 |
| `EXPO_PUBLIC_VERIFY_PURCHASE_URL` | 원칙적으로 미등록 | 원칙적으로 미등록 | 기본 경로와 다를 때만 HTTPS URL 등록 |

현재 코드에서 사용하는 테스트 값:

```text
Android 앱 ID: ca-app-pub-3940256099942544~3347511713
전면 광고 단위 ID: ca-app-pub-3940256099942544/1033173712
```

구매 검증 URL을 등록하지 않으면 `<SUPABASE_URL>/functions/v1/verify-purchase`가 사용된다. 현재 코드는 빈 문자열을 기본값으로 바꾸지 않으므로 **선택 변수를 빈 값으로 등록하지 않는다.** `.env.example`의 빈 항목을 그대로 운영 환경에 복사하지 않는다.

EAS 대시보드에서 값을 등록하거나 CLI `env:set`을 사용한다. 환경 이름만 넣는 예시는 다음과 같다. URL·공개 키도 해당 환경에 각각 등록한다. [환경 변수 등록 방법](https://docs.expo.dev/eas/environment-variables/manage/)

```powershell
npx.cmd eas-cli env:set --help
npx.cmd eas-cli env:set --name EXPO_PUBLIC_APP_ENV --value development --environment development --visibility plaintext
npx.cmd eas-cli env:set --name EXPO_PUBLIC_APP_ENV --value preview --environment preview --visibility plaintext
npx.cmd eas-cli env:set --name EXPO_PUBLIC_APP_ENV --value production --environment production --visibility plaintext
```

앱/config가 읽는 공개 값은 빌드 설정 평가 시 접근 가능한 가시성으로 등록한다. `EXPO_PUBLIC_*`는 앱 번들에서 읽을 수 있으므로 비밀을 넣지 않는다. 서비스 계정 JSON·service-role key는 이 표의 앱 환경값이 아니다. [Expo 환경 변수 사용](https://docs.expo.dev/eas/environment-variables/usage/)

### 7-5. 첫 Android 테스트 빌드

친구가 설치 파일을 전달해 다른 사람이 확인하게 하려면 **preview APK를 첫 전달물로 권장**한다. 개발자가 Metro 서버와 연결해 디버깅할 때는 development를 사용한다.

| 프로파일 | 산출물 | 용도 |
|---|---|---|
| `development` | 개발 클라이언트 APK | 개발 서버에 연결해 디버깅 |
| `preview` | 독립 실행 APK | 다른 사람에게 전달해 기본 동작 확인 |
| `production` | AAB | 준비 완료 후 Play 내부 테스트/출시 후보 업로드 |

첫 전달용 빌드:

```powershell
npx.cmd eas-cli build --platform android --profile preview
```

개발 디버깅이 필요할 때:

```powershell
npx.cmd eas-cli build --platform android --profile development
npx.cmd expo start --dev-client
```

development 앱의 JavaScript는 개발 서버의 환경값도 영향을 받으므로 친구 PC의 로컬 테스트 설정을 별도로 맞춘다. native 모듈을 바꾸면 개발 클라이언트도 다시 빌드한다. [개발 빌드 안내](https://docs.expo.dev/develop/development-builds/introduction/)

빌드 전에 계정 사용량/비용과 코드 업로드 범위를 확인한다. 동일한 package의 기존 앱과 서명이 다르면 설치가 충돌할 수 있다. 앱 삭제로 해결하기 전에 로컬 게임 진행 데이터가 사라질 수 있음을 확인한다.

완료 조건: APK 설치·앱 실행·남/여 라인 플레이·결과 화면·설정 접근 확인. 서버가 미준비인 경우 결제 검증 실패는 예상되지만 앱이 멈추면 안 된다. 이 단계에서는 실광고를 클릭하지 않는다.

## 8. 서버·스토어 담당자의 후속 작업

### 8-1. Supabase / 구매 검증

1. 대상 Supabase 프로젝트를 확정하고 가능하면 테스트 프로젝트부터 사용한다. 익명 로그인이 사용 가능한지 확인한다.
2. 기존 DB의 테이블·RLS·뷰 정의와 migration 적용 이력을 먼저 확인하고 백업한다.
3. 신규 프로젝트라면 기본 schema를 검토하여 적용한다. 기존 프로젝트에는 무조건 전체 schema를 재실행하지 않는다.
4. 기존 프로젝트에서 미적용 상태라면 `202608310001_purchase_transactions.sql` → `202608310002_monetization_views.sql` 순서로 적용한다. 두 번째 파일은 뷰를 교체하므로 의존 뷰·권한을 확인한다. `CASCADE`로 강제 해결하지 않는다.
5. Google Play Developer API 권한을 가진 서비스 계정과 함수용 secrets를 준비한다.
6. Deno 검사·mock·보안 테스트 및 6절 보완 후 `verify-purchase` 함수를 테스트 프로젝트에 배포한다. 함수 배포는 EAS 앱 빌드와 별개다.
7. 실제 테스트 구매로 검증·원장 중복 방지·승인·복원을 확인하고 RLS 사용자 A/B/관리자 검사를 실행한다.

함수는 `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` 또는 `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 읽는다. Supabase가 제공하는 기본 환경값은 실제 존재 여부를 확인하고, Google 자격은 서버 secrets로 등록한다. 함수 인증을 무작정 끄지 말고 게이트웨이/JWT 설정과 코드의 사용자 검증을 함께 확인한다. [함수 배포](https://supabase.com/docs/guides/functions/deploy), [서버 환경 변수](https://supabase.com/docs/guides/functions/secrets)

서버 비밀은 Git·EAS 공개 변수·앱·관리자 HTML·채팅에 넣지 않는다. purchaseToken 원문을 분석 이벤트나 로그에 남기지 않는다.

되돌림 준비: 기존 뷰 정의/권한과 함수 버전을 저장해 두고 테스트 환경에서 복구 절차를 확인한다. 장애 시 원장·이벤트·사용자를 삭제하지 말고 이전 코드/뷰로 복구하는 방향을 우선한다. 현재 별도 자동 rollback 스크립트는 없다.

### 8-2. Google Play / AdMob / 개인정보

- Google Play에 `com.typedate.app`과 비소모성 상품 `remove_ads`를 준비한다. 실제 판매 상태와 가격을 확인한다.
- 내부 테스트 참여 계정과 라이선스 테스터를 각각 확인한다. 내부 테스트 참여만으로 무료 결제가 보장되지 않는다. [Google 결제 테스트](https://developer.android.com/google/play/billing/test)
- AdMob의 실제 앱 ID·전면 광고 ID·동의 메시지·앱 확인 상태를 준비한다. 출시 국가/대상 연령에 맞춰 설정한다.
- `PRIVACY_POLICY.md`의 운영자·연락처·보유 기간·리전·삭제 절차를 확정하고 로그인 없이 열리는 HTTPS 페이지로 게시한다.
- Data Safety, 광고 포함 여부, 콘텐츠 등급, 계정 삭제 요건 해당 여부를 실제 앱 동작과 대조한다.
- 신규 개인 개발자 계정 등의 테스트/프로덕션 접근 요건은 해당 계정의 현재 Play Console 안내로 확인한다. 계정마다 적용 여부가 다르므로 일정 확정 전에 확인한다.

## 9. 출시 후보 테스트와 완료 조건

서버 검증과 production 보호 장치가 준비된 뒤에만 다음 빌드를 만든다. 이 명령은 AAB 빌드이며 스토어 제출 명령이 아니다.

```powershell
npx.cmd eas-cli build --platform android --profile production
```

Play 담당자가 내부 테스트 트랙에 올리고 초대받은 라이선스 테스터가 Play에서 설치한다. production 환경 광고 테스트는 테스트 기기 설정을 확인한 뒤 진행한다.

| 분야 | 필수 시나리오 | 통과 조건 |
|---|---|---|
| 게임 | 남/여 각각 한 회차, 광고 실패/오프라인 | 결과 보존, 앱 진행 가능 |
| 구매 | 성공·취소·실패·pending·연타 | 검증 전 권한 없음, 요청 중복 없음 |
| 복원 | 재시작·재설치·같은 Play 계정 다른 기기 | 권한 복원, 거래 중복/신규 매출 과대 집계 없음 |
| 서버 | 위조/다른 상품·동시 요청·승인 실패 | 부정 권한 0, 원장 1건, 승인 재시도 증거 |
| 환불/장애 | 환불 후 조회·검증 서버 장애 | 확정 취소와 일시 장애 구분, 정책대로 권한 갱신 |
| 광고 | load만 성공·표시·닫힘·no fill·지연·중복 이벤트 | load 이벤트로 노출 집계 안 함, 표시 1회/결과 전환 1회 |
| 동의/광고 제거 | 동의 불가·설정 재선택·구매 보유 | 동의 상태 준수, 광고 제거 사용자의 요청/표시 없음 |
| 보안 | anon·사용자 A/B·관리자 | 원본 보호, 문의 격리, 관리자 답변 위조 불가 |
| 집계 | 운영 구매 1건+재처리+복원+테스트+레거시 | 검증 운영 거래는 1건, 추정치와 정산액 분리 |
| 설정/정책 | 작은 화면·큰 글씨·다크 모드·링크 실패 | 복원/문의/정책 접근, 실패 안내, 실제 정책 페이지 공개 |

실행한 기기·OS·빌드 ID·versionCode·결과를 남긴다. 빌드 성공, 테스트 구매 성공, 실결제 정산 성공은 각각 구분한다. 미검증을 성공으로 채우지 않는다.

## 10. 친구가 전달해 줄 결과

비밀값을 제외하고 아래 양식으로 공유하면 후속 작업을 바로 이어갈 수 있다.

```text
받은 소스 커밋/스냅샷:
Expo 소유 계정/조직 및 프로젝트 링크:
EAS 프로젝트 연결 결과:
사용 Node / npm / EAS CLI 버전:
빌드 프로파일 / 환경:
환경 변수 등록 여부(값 제외):
EAS 빌드 링크 / 빌드 ID:
APK 또는 AAB 전달 위치:
package / version / versionCode:
설치 기기 / Android 버전:
실행·플레이·설정 결과:
결제·광고·서버 검증 결과 또는 미검증 사유:
오류 단계 및 민감정보를 지운 로그:
남은 담당자 작업:
```

친구에게 보낼 짧은 설명:

> TYPE DATE Android 빌드 인수인계를 부탁해. 결제·광고·통계 관련 코드는 1차 반영했고 로컬 타입 검사, Expo Doctor 18/18, 웹 번들은 통과했어. 아직 APK/AAB와 실제 결제·광고 검증은 안 했고 서버/운영 준비 및 코드 보완도 남아 있어. 우선 최신 소스를 받아 네 EAS 계정에서 올바른 프로젝트로 연결하고, development/preview 환경을 설정한 뒤 preview APK와 빌드 링크를 전달해줘. 서버나 스토어 권한이 필요한 작업은 담당자를 따로 정하자. 상세 순서와 주의사항은 이 문서를 보면 돼.

## 11. 함께 볼 문서

- [원래 구현 기획안](LUNA_LAUNCH_IMPLEMENTATION_PLAN.md): A~H 작업 범위와 전체 테스트 매트릭스
- [실행 검증 기록](LAUNCH_VERIFICATION.md): 앞선 로컬 명령 결과
- [출시 체크리스트](LAUNCH_CHECKLIST.md): 계정·정책·스토어 준비 항목
- [개인정보처리방침 초안](PRIVACY_POLICY.md): 운영자 확정·공개 필요
- [관리자 안내](admin/README.md): 집계와 관리자 사용 안내

기존 문서의 체크 표시는 소스 반영과 동작 검증을 혼용할 수 있다. 인수인계 시에는 이 문서의 미검증/보완 항목과 실제 테스트 증거를 함께 기준으로 삼는다. 이번 문서 작성 중 로그인·빌드·DB 적용·배포·제출은 실행하지 않았다.
