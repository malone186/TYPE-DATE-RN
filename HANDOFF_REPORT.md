# TYPE DATE — 출시 인계장

작성일: 2026-08-31
기준: 작업 PC 로컬 검사 결과
대상 문서: [FRIEND_HANDOFF_PLAN.md](FRIEND_HANDOFF_PLAN.md)

인수인계 계획서 6절의 개발 담당 몫을 실행한 결과다. P0 코드 결함 세 건을 막고 자동 테스트를 새로 깔았다. EAS 빌드·서버 배포·스토어 설정은 계정 권한이 필요해 손대지 않았다.

| 구분 | 수치 |
|---|---|
| 로컬 검사 | 9건 실행 / 9건 통과 |
| 자동 테스트 | 67개 통과 (신규) |
| 막은 P0 | 3건 |
| 미검증 영역 | 6개 |

## 1. 이 PC에서 실제로 실행한 검사

아래는 오늘 실제로 돌린 명령과 그 출력이다. 다른 PC에서의 성공을 보장하지 않으니 코드를 받은 쪽에서 그대로 다시 실행한다.

| 명령 | 결과 | 상태 |
|---|---|---|
| `node --version` / `npm --version` | v24.18.0 / 11.16.0 | 기록 |
| `npm ci` | 성공. 낡아 있던 `node_modules`를 잠금 파일 기준으로 재설치 | 통과 |
| `npm run typecheck` | 오류 없음 | 통과 |
| `npm test` | 67개 통과 (Edge Function 26 + 결제 22 + 광고 19) | 신규 |
| `npm run verify:config` | 설정·보안 계약 통과. 검사 항목을 10건 늘림 | 통과 |
| `npx expo install --check` | Dependencies are up to date | 해결됨 |
| `npx expo-doctor` | 18/18 통과 | 통과 |
| `npx expo export --platform web` | 성공, 782개 모듈 번들 | 통과 |
| `git diff --check` | 공백 오류 없음 (줄바꿈 변환 경고만) | 통과 |
| `npx eas-cli whoami` | `Not logged in` — 로그인은 계정 주인이 직접 한다 | 미실행 |

계획서 4절은 `expo install --check`가 통과한다고 적었지만 이 PC에서는 실패했다. 설치본이 `package.json`보다 낡아 `expo@54.0.36`, `expo-constants@18.0.13`이 깔려 있었다. `npm ci`로 해소했고 이후 expo-doctor 18/18과 웹 번들 782 모듈로 계획서 기준선과 일치한다.

설치된 EAS CLI는 `eas-cli/23.0.0`으로 `eas.json`의 `>= 23.0.0` 요건을 만족한다.

## 2. 코드로 막은 결함

계획서 6절 P0 목록 중 소스에서 실재가 확인된 세 건이다. 각 항목은 수정과 함께 자동 검사를 붙여 다시 뚫리지 않게 했다.

### P0-1. 환경값이 빠지면 프로덕션 검사가 통째로 건너뛰던 문제

`app.config.js`가 `EXPO_PUBLIC_APP_ENV` 부재 시 development로 폴백했다. EAS에 변수를 등록하지 않거나 오타를 내면 프로덕션 검증 함수가 조용히 통과하고, 구글 공식 테스트 광고 ID가 실린 채 빌드가 나간다.

EAS가 넣어주는 `EAS_BUILD_PROFILE`과 `EXPO_PUBLIC_APP_ENV`가 정확히 일치하지 않으면 빌드를 실패시키도록 바꿨다. 프로필이 없는 로컬 실행은 종전대로 development로 돈다.

확인: 변수 누락·오타·프로필 불일치 각각을 `verify:config`가 회귀 검사로 잡는다.

### P0-2. 구글 공식 테스트 앱 ID가 프로덕션 검사를 통과하던 문제

광고 단위 ID는 공식 테스트 값을 명시적으로 거부했지만, 앱 ID는 형식만 검사했다. `ca-app-pub-3940256099942544~3347511713`은 형식이 맞아 그대로 통과했다.

앱 ID도 단위 ID와 같은 기준으로 공식 테스트 값을 거부하도록 바꿨다.

확인: 테스트 앱 ID·테스트 단위 ID·비 HTTPS 정책 URL을 각각 넣은 케이스가 모두 실패로 고정됐다.

### P0-3. 승인 실패가 장부에 pending으로 남고 아무도 재시도하지 않던 문제

서버는 Google 승인에 실패하면 `retryRequired`를 돌려주지만 앱이 그 값을 읽지도 않았다. 서버에는 토큰 해시만 있어 스스로 다시 승인 API를 부를 수도 없다.

원본 토큰을 가진 앱이 `finishTransaction`으로 클라이언트 승인을 마친 직후 한 번만 재검증하도록 했다. 실패해도 권한에는 영향이 없고 다음 foreground 조회가 이어받는다.

확인: 재검증 발생·미발생·재검증 실패 세 경우를 결제 테스트가 지킨다.

## 3. 새로 깐 자동 테스트

테스트 도구가 아예 없던 저장소에 Vitest를 dev 의존성으로 넣고 세 벌을 작성했다. `npm test`로 돈다.

| 대상 | 개수 | 지키는 것 |
|---|---|---|
| `verify-purchase` Edge Function | 26 | 인증 없는 호출·위조 Bearer·다른 앱 패키지·다른 상품·8KB 초과 토큰 거부, 조회 실패 시 권한 0, 장부에 원본 토큰이 아닌 해시만 기록, 사용자 ID는 클라이언트 값이 아닌 JWT에서, 승인 실패 시 재시도 신호 |
| `src/lib/billing.ts` | 22 | 서버 검증 전 권한 없음, 검증 실패 시 거래 미완료, 위조·잘린 응답 거부, 같은 구매 중복 통보 시 요청 1건, 동시 복원 시 조회 1회, 실패 후 잠금 해제, 연결 실패 후 재연결, 환불·취소 시 권한 회수 |
| `src/lib/ads.ts` | 19 | production에서 공식 테스트 단위·미설정 시 광고 요청 자체를 안 함, 동의 거부·동의 실패 시 요청 안 함, 동의는 앱당 1회만 수집, 개인정보 설정 재호출 후 동의 재조회, no fill·show 실패·load 예외에도 결과 화면으로 정확히 1회 진행, 화면 이탈 후 도착한 광고는 콜백 0회 |

Edge Function은 Deno에서 돌지만 이 PC에 Deno가 없어(`deno: command not found`) 테스트는 Node 러너에서 핸들러를 직접 호출하는 방식으로 짰다. `Deno.env`는 대역을 두고, 서비스 계정 서명은 실제 RS256 키를 생성해 통과시킨다. 배포 전 Deno 런타임 자체의 타입·실행 검사는 서버 담당이 따로 돌려야 한다.

## 4. 아직 아무도 확인하지 않은 것

여기를 성공으로 채우지 않는다. 아래 항목은 오늘 작업으로 전혀 진전되지 않았다. 코드가 통과했다는 사실과 실제로 동작한다는 사실은 다르다.

- Android APK/AAB 빌드와 실기기 설치, 네이티브 SDK 호환성
- 실제 결제 성공·복원·환불, 스토어 가격 조회
- 광고 표시·닫힘·no fill, 동의 흐름
- Supabase 마이그레이션 적용, RLS 격리, Edge Function 배포와 실행
- 공개 개인정보처리방침 URL, Play 내부 테스트 트랙
- 실제 플레이(남/여 라인 완주), 결과 화면, 작은 화면 UI

## 5. EAS 담당이 이어서 할 일

로그인은 계정 주인만 할 수 있어 여기서 멈췄다. 아래 순서 그대로 진행하면 된다. Windows PowerShell 기준이며 macOS/Linux에서는 `npm.cmd`·`npx.cmd` 대신 `npm`·`npx`를 쓴다.

### 5-1. 기준선 재확인

이 PC 결과와 같은지 먼저 맞춘다. 하나라도 실패하면 그 단계를 기록하고 멈춘다.

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run verify:config
npx.cmd expo install --check
npx.cmd expo-doctor
```

### 5-2. 로그인과 프로젝트 연결

현재 저장소에는 `projectId`가 없으므로 `init`이 계정에 프로젝트를 만들거나 붙인다. 화면의 계정·대상을 읽고 진행하고, ID를 추정해서 손으로 넣지 않는다.

```powershell
npx.cmd eas-cli login
npx.cmd eas-cli whoami
npx.cmd eas-cli init
npx.cmd eas-cli project:info
```

`com.typedate.app`이 유지되는지, 기존 Play 앱이 있다면 서명 키를 새로 만들지 않는지 확인한다.

### 5-3. 환경 변수 등록

이 단계를 건너뛰면 이제 빌드가 실패한다. P0-1 가드가 프로필과 `EXPO_PUBLIC_APP_ENV`의 불일치를 잡기 때문이다. 조용히 테스트 광고가 실린 빌드가 나가는 것보다 낫다.

```powershell
npx.cmd eas-cli env:set --name EXPO_PUBLIC_APP_ENV --value development --environment development --visibility plaintext
npx.cmd eas-cli env:set --name EXPO_PUBLIC_APP_ENV --value preview --environment preview --visibility plaintext
npx.cmd eas-cli env:set --name EXPO_PUBLIC_APP_ENV --value production --environment production --visibility plaintext
```

나머지 변수는 아래 6절 표대로 각 환경에 등록한다.

### 5-4. 첫 전달물은 preview APK

다른 사람이 설치해 확인할 수 있는 독립 실행 APK다. Metro에 붙여 디버깅할 때만 development를 쓴다.

```powershell
npx.cmd eas-cli build --platform android --profile preview
```

완료 조건: 설치·실행·남녀 라인 플레이·결과 화면·설정 진입 확인. 서버가 준비되기 전이라 결제 검증 실패는 예상되지만 앱이 멈추면 안 된다. 이 단계에서 실결제는 누르지 않는다.

### 5-5. production AAB는 서버 검증 이후

Supabase 배포와 Play·AdMob 설정이 끝난 뒤에 만든다. 이 명령은 빌드일 뿐 스토어 제출이 아니다.

```powershell
npx.cmd eas-cli build --platform android --profile production
```

## 6. 환경 변수 등록표

`EXPO_PUBLIC_*`는 앱 번들에서 읽히므로 비밀을 넣지 않는다. 서비스 계정 JSON과 service-role 키는 여기가 아니라 Supabase 서버 secrets에 넣는다.

| 이름 | development / preview | production |
|---|---|---|
| `EXPO_PUBLIC_APP_ENV` | 프로필 이름과 동일 | `production` 필수 |
| `EXPO_PUBLIC_SUPABASE_URL` | 테스트 프로젝트 URL | 실제 프로젝트 URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | 해당 프로젝트 공개 키 | 해당 프로젝트 공개 키 |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | 테스트 링크 또는 미등록 | 공개 HTTPS 정책 URL |
| `ADMOB_ANDROID_APP_ID` | 생략 시 공식 테스트 앱 ID | `ca-app-pub-4049411890121523~9457501818` |
| `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID` | 생략 시 공식 테스트 단위 ID | `ca-app-pub-4049411890121523/4014542793` |
| `EXPO_PUBLIC_VERIFY_PURCHASE_URL` | 기본 경로와 다를 때만 등록 | 기본 경로와 다를 때만 등록 |

`EXPO_PUBLIC_VERIFY_PURCHASE_URL`을 빈 값으로 등록하지 않는다. 코드가 빈 문자열을 기본값으로 되돌리지 않는다.


### 6-1. AdMob 발급 현황

AdMob 콘솔에서 실제 ID 두 개가 발급됐고 형식·가드 검사를 통과했다. 두 값의 게시자 번호(`4049411890121523`)가 일치하는 것도 확인했다. AdMob ID는 배포된 APK에서 그대로 읽히는 공개 값이라 비밀이 아니다.

| 항목 | 값 | 상태 |
|---|---|---|
| Android 앱 ID | `ca-app-pub-4049411890121523~9457501818` | 발급·검증 완료 |
| 결과 화면 전면 광고 단위 | `ca-app-pub-4049411890121523/4014542793` | 발급·검증 완료 |

두 값은 작업 PC의 `.env.local`에만 넣어 뒀다. 이 파일은 `.gitignore` 대상이라 저장소로 전달되지 않으므로 EAS production 환경에 직접 등록해야 한다.

```powershell
npx.cmd eas-cli env:set --name ADMOB_ANDROID_APP_ID --value ca-app-pub-4049411890121523~9457501818 --environment production --visibility plaintext
npx.cmd eas-cli env:set --name EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID --value ca-app-pub-4049411890121523/4014542793 --environment production --visibility plaintext
```

development·preview에는 등록하지 않는다. 비워 두면 구글 공식 테스트 광고가 나간다. 개발 중 실제 광고를 클릭하면 무효 트래픽으로 계정이 정지될 수 있다.

`.env.local`의 실제 값으로 production 설정을 돌려 본 결과 AdMob 항목은 모두 통과했고, 남은 차단 사유는 하나다.

```text
Error: Missing required production configuration: EXPO_PUBLIC_PRIVACY_POLICY_URL
```

개인정보처리방침을 로그인 없이 열리는 HTTPS 페이지로 게시하고 그 주소를 `EXPO_PUBLIC_PRIVACY_POLICY_URL`에 등록하면 production 설정 검사가 통과한다.
## 7. 남은 항목과 담당

| 항목 | 담당 | 상태 |
|---|---|---|
| P0-4 · 서버 acknowledge와 클라이언트 `finishTransaction` 이중 승인의 실기기 동작 | 실기기 테스트 | 미검증 |
| P1 · 광고 SDK 동작·지연 로드·화면 이탈 처리 | 개발 (완료) / 실기기 | 코드 검증 19개 통과, 실기기 미검증 |
| P1 · 관리자 화면에서 누락 필드와 실제 0건을 구분하는 표시 | 개발 | 미착수 |
| P1 · 의존성 audit 경고 22건 (moderate 11 / high 11) | 개발 판단 필요 | 분류 완료 |
| Supabase 마이그레이션 적용·함수 배포·RLS 검증 | Supabase 권한 보유자 | 미착수 |
| Play 상품·내부 테스트·AdMob·정책 페이지 공개 | Play / AdMob 계정 주인 | 미착수 |

audit 경고를 실제로 들여다본 결과, 지금 잡히는 취약점은 전부 빌드 도구 쪽이다. postcss의 소스맵 경로 탐색, image-size 파서 무한 루프, js-yaml CPU 소모, brace-expansion 메모리 소모로, 출시된 앱 안에서 실행되는 코드가 아니라 번들링·prebuild 과정에서 도는 코드다. 대부분의 해결책이 `expo@57` 메이저 업그레이드라 지금 손대면 54 기준으로 잡아둔 모든 검증이 무효가 된다. `npm audit fix --force`는 실행하지 않았다.

## 8. 넘길 때 같이 챙길 것

변경은 아직 커밋하지 않았다. 기존 저장소를 clone하는 것만으로는 이번 작업이 전달되지 않는다.

| 파일 | 구분 | 내용 |
|---|---|---|
| `app.config.js` | 수정 | P0-1·P0-2 가드 |
| `src/lib/billing.ts` | 수정 | P0-3 승인 재시도 (10줄 추가) |
| `supabase/functions/verify-purchase/index.ts` | 수정 | 핸들러 `export` 한 곳 |
| `scripts/verify-launch-config.mjs` | 수정 | 설정 가드 회귀 검사 10건 추가 |
| `package.json`, `package-lock.json` | 수정 | `test` 스크립트, vitest dev 의존성 |
| `vitest.config.ts`, `tests/` | 신규 | 테스트 설정과 대역 |
| `src/lib/billing.test.ts` | 신규 | 결제 테스트 22개 |
| `src/lib/ads.test.ts` | 신규 | 광고 테스트 19개 |
| `supabase/functions/verify-purchase/index.test.ts` | 신규 | Edge Function 테스트 26개 |
| `HANDOFF_REPORT.md` | 신규 | 이 문서 |

잠금 파일에서 기존 패키지 중 버전이 움직인 것은 `nanoid 3.3.16 → 3.3.18` 하나뿐이고, 제거된 패키지는 없다. 나머지 91개 추가분은 전부 vitest 계열 dev 의존성이다. 설치 후 expo-doctor는 그대로 18/18을 통과했다.

`node_modules`, `dist`, `.env.local`, `.claude/settings.local.json`, 서비스 계정 JSON, 서명 키는 전달 대상에서 제외한다.

## 9. 함께 볼 문서

- [FRIEND_HANDOFF_PLAN.md](FRIEND_HANDOFF_PLAN.md): 인수인계 계획서 원본, 담당 구분과 전체 작업 순서
- [LUNA_LAUNCH_IMPLEMENTATION_PLAN.md](LUNA_LAUNCH_IMPLEMENTATION_PLAN.md): A~H 작업 범위와 테스트 매트릭스
- [LAUNCH_VERIFICATION.md](LAUNCH_VERIFICATION.md): 이전 로컬 명령 결과
- [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md): 계정·정책·스토어 준비 항목
- [PRIVACY_POLICY.md](PRIVACY_POLICY.md): 개인정보처리방침 초안

---

이 문서에 적힌 결과는 모두 작업 PC에서 실제로 실행해 얻은 것이다. 로그인·클라우드 빌드·DB 적용·함수 배포·스토어 제출은 실행하지 않았다. 미검증 항목은 실행한 사람이 기기·OS·빌드 ID·versionCode와 함께 채운다.
