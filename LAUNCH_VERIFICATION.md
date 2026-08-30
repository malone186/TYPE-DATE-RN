# TYPE DATE 출시 준비 검증 기록

검증일: 2026-08-31  
범위: 로컬 코드·설정·migration·문서의 1차 검증  
판정: 코드 준비 단계. 실기기·원격 운영·스토어 출시 검증 완료가 아님.

## 실행 결과

| 명령 | 결과 | 비고 |
|---|---|---|
| `npm.cmd ci` | 통과 | 잠금 파일 기준 설치. npm audit 경고는 별도 검토 항목으로 남김 |
| `npm.cmd run typecheck` | 통과 | 앱 TypeScript 검사 |
| `npm.cmd run verify:config` | 통과 | production 필수 설정 차단, 인증/결제/광고/SQL 계약 검사 |
| `npx.cmd expo install --check` | 통과 | 의존성 정합성 확인 |
| `npx.cmd expo-doctor` | 18/18 통과 | `expo-constants@18.0.14`를 직접 고정해 중복 제거 |
| `npx.cmd expo export --platform web --output-dir dist` | 통과 | 782개 모듈 번들. `dist`는 무시 파일로 커밋하지 않음 |
| `npx.cmd eas-cli whoami` | 미로그인 | 계정 입력이 필요한 EAS 단계라 빌드는 실행하지 않음 |
| `git diff --check` | 통과 | 줄바꿈 변환 경고만 출력 |

초기 `expo-doctor`의 중복 의존성은 `npm dedupe`로 해결되지 않았다. Expo 54.0.37과 호환되는 `expo-constants@18.0.14`를 직접 고정한 뒤 중복이 제거되어 전체 검사가 통과했다.

EAS CLI는 설치되었지만 현재 계정이 로그인되지 않았다. 프로젝트 연결·환경 변수 등록·빌드·제출 명령은 계정 확인 전 실행하지 않았다.

## 로컬에서 확인한 계약

- 운영 설정에 Supabase URL/공개 키/공개 개인정보처리방침 URL/실제 AdMob ID가 없으면 config 검사가 실패한다. development와 preview에서는 서비스 없는 실행 및 테스트 광고 경계를 유지한다.
- 분석 REST 요청은 공개 `apikey`만 전송하고 공개 키를 `Authorization: Bearer`로 사용하지 않는다. HTTP 오류와 네트워크 오류는 개발 진단으로 분류하며 게임 흐름을 막지 않는다.
- `remove_ads`는 상품 조회와 서버 검증 뒤에만 entitlement를 켠다. pending·취소·검증 실패에서는 권한을 주지 않으며, 거래 토큰 원문을 이벤트/로그/원장에 저장하지 않는다.
- 기존 `td_ad_removed` 로컬 플래그는 검증된 구매로 승격하지 않는다. 검증된 entitlement만 캐시하고 foreground/시작/수동 복원에서 다시 조회한다.
- 전면 광고 `ad_shown`은 SDK `OPENED` 이벤트에서 한 번만 기록한다. 로드 실패·동의 불가·3초 초과·닫힘은 결과 화면으로 한 번만 진행한다.
- 구매 원장은 token hash UNIQUE를 사용하고, 운영 구매·테스트 구매·복원 관측·레거시 이벤트를 관리자 집계에서 분리한다.

## 아직 실행하지 않은 검증

다음은 계정·원격 환경·네이티브 빌드가 필요하므로 이번 작업에서 실행하지 않았다.

- Android development/preview/production 네이티브 빌드와 실제 설치 버전 확인
- Google Play 내부 테스트의 정상 구매, 취소, 오류, pending, 복원, 재설치, 환불 및 acknowledge 재시도
- Supabase Edge Function 배포와 실제 Google Play Developer API 검증
- 원격 Supabase migration 적용, RLS 사용자 A/B 및 관리자 격리 테스트
- 실제 AdMob/UMP 동의 양식, 테스트 기기 광고 표시, production 광고 ID 검증
- 로그인 없이 접근 가능한 공개 개인정보처리방침 URL 게시 및 내용 대조
- EAS 프로젝트·환경 변수·Play 계정 요건·상품 판매 상태·AdMob 콘솔 상태 확인

Edge Function은 Deno 런타임용이며 현재 로컬 앱 TypeScript 검사에서 제외했다. 이 함수는 `supabase functions deploy` 전 Deno/ Supabase 환경에서 별도로 타입·권한·실 API 검증을 해야 한다.

## 소유자 확인 후 남은 출시 차단 항목

1. Play 개발자 계정의 비공개 테스트 요건, 상품 `remove_ads` 판매 상태, 라이선스 테스터를 확인한다.
2. 실제 Supabase 프로젝트에 migration을 순서대로 적용하고 Edge Function secrets·Google 서비스 계정 권한을 설정한다.
3. 공개 HTTPS 개인정보처리방침 URL, 운영자 연락처, 보유 기간, 리전, 삭제 요청 절차를 확정한다.
4. AdMob 앱/광고 단위 ID와 동의 설정을 production EAS 환경에 등록하고 실기기에서 확인한다.
5. 위 외부 검증 증거가 모인 뒤에만 출시 가능 여부와 제출을 별도로 판정한다.

이번 기록은 운영 DB 변경, 데이터 삭제, 외부 배포, 실결제 또는 스토어 제출을 승인하지 않는다.
