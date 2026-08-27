# TYPE DATE — 포트폴리오 제안서 (PPT 원고)

> 대상 리포지토리: https://github.com/malone186/TYPE-DATE-RN
> 기준 브랜치: `master` / 최신 커밋 `028ce81` (2026-08-20)
> 문서 목적: 포트폴리오 발표용 PPT 제작을 위한 슬라이드 단위 원고 및 기술 근거 정리

---

## 0. 이 문서 사용법

- 각 섹션 = 슬라이드 1장. `【슬라이드 구성】`은 지면에 배치할 요소, `【발표 스크립트】`는 말로 할 내용입니다.
- 코드 블록은 그대로 캡처해 슬라이드에 붙일 수 있도록 실제 리포지토리 코드에서 발췌했습니다.
- 모든 수치는 리포지토리 실측값입니다 (LOC·턴 수·커밋 수 등).
- 권장 분량: 핵심 18장 + 부록 4장. 발표 15분 기준.

---

# PART 1 — 프로젝트 개요

## 슬라이드 1 · 표지

**TYPE DATE**
MBTI 소개팅 시뮬레이션 모바일 앱 — React Native(Expo) + TypeScript + Supabase

- 개발 기간: 2026.07.14 ~ 2026.08.20 (커밋 57개, 약 5주)
- 형태: 2인 프로젝트 (기획·설계·구현·운영 도구까지 전 영역)
- 산출물: 모바일 앱(Android/iOS/Web) + 백엔드 스키마 + 운영자 분석 대시보드

【슬라이드 구성】 앱 로고(`assets/images/logo.png`) + 라벤더 그라디언트 배경 + 핵심 스택 뱃지 5개(React Native / TypeScript / Expo / Zustand / Supabase)

---

## 슬라이드 2 · 한 장 요약 (Executive Summary)

> "16번의 소개팅, 그 끝에 진짜 인연이 있다"

16가지 MBTI 캐릭터와 카카오톡 형식으로 소개팅을 진행하고, 선택 하나하나가 성향 축 점수로 쌓여
**16화 완주 시 '내가 진짜 끌리는 인연 유형'을 도출**하는 스토리 시뮬레이션 앱.

| 구분 | 실측 규모 |
|---|---|
| 총 코드 | **27,129 LOC** (TS/TSX 25,378 · SQL 449 · 대시보드 HTML/JS 1,302) |
| 소스 파일 | 76개 (`src/` 74 + `App.tsx` + `admin/index.html`) |
| 화면(Screen) | **14개** — React Navigation 네이티브 스택 |
| 공용 위젯 | 7개 파일 / 재사용 컴포넌트 20+ |
| 시나리오 콘텐츠 | **32화** (여자 라인 16 + 남자 라인 16) |
| 게임 턴 / 선택지 | **346턴 / 1,384개 선택지** (회차당 9~13턴 × 4지선다) |
| 대사 라인 | 1,635줄 (프롤로그·도입부·클로징·에필로그 포함) |
| DB 객체 | 테이블 4 · 집계 뷰 15 · SECURITY DEFINER 함수 2 |
| 에셋 | 이미지 111장 · 폰트 4종 · 효과음 2종 (총 44MB) |

【발표 스크립트】 "단순 토이 프로젝트가 아니라, 앱 → 백엔드 → 운영 대시보드까지 **서비스 한 사이클을 전부 만든** 프로젝트입니다."

---

## 슬라이드 3 · 문제 정의 & 제품 컨셉

**시장의 문제**

| 기존 MBTI/소개팅 앱 | 한계 |
|---|---|
| 단순 심리테스트 | 질문에 '정답'이 보여서 원하는 결과가 나옴 |
| 텍스트 결과만 제공 | 공유 동기가 없음 → 바이럴 안 됨 |
| 1회성 콘텐츠 | 재방문 이유가 없음 |
| 선택지가 뻔한 대화 게임 | 몰입이 끊기고 퀴즈처럼 느껴짐 |

**TYPE DATE의 해법**

1. **간접 측정** — "당신은 E입니까?"라고 묻지 않는다. 소개팅 대화 속 선택이 축 점수로 누적된다.
2. **이중 축 시스템** — 선택 1회에 2개 축이 동시에 기록되어 고를 때마다 실제로 고민된다.
3. **호감도와 성향의 의도적 불일치** — 캐릭터 개인 취향 기준이라 "MBTI 정답"을 노려도 호감을 못 얻는다.
4. **누적형 단일 채팅 스레드** — 도입부부터 마지막 턴까지 대화가 끊기지 않고 위로 쌓인다.
5. **완주 보상** — 16화 완주 시 최종 에필로그(가장 잘 맞았던 상대와의 연애 시작) 해금.

【슬라이드 구성】 좌: 기존 앱 문제 4개 / 우: 해법 5개 화살표 대응 다이어그램

---

## 슬라이드 4 · 사용자 플로우 (14개 화면)

```
Splash ─▶ LineSelect ─▶ NameInput ─▶ Prologue ─▶ CharacterSelect ─┐
(타이틀)   (남/여 라인)   (이름 입력)  (주선자 카톡)  (16 슬롯 그리드)  │
                                                                  ▼
                                                          CharacterProfile
                                                                  │
                                                                  ▼
                                                    BlindDateChat (핵심 화면)
                                        도입부 자동재생 → 9~13턴 ABCD 선택 → 클로징
                                                                  │
                              ┌───────────────────────────────────┤
                              ▼ (광고 미제거)                      ▼ (광고 제거 구매 시)
                      AdInterstitial ───────────────────▶  ResultReport
                                                          (4축 그래프 · 궁합 · 엔딩)
                                                                  │
                                       ┌──────────────────────────┼──────────────┐
                                       ▼                          ▼              ▼
                                    SnsCard                   Epilogue      (16화 완주)
                                  (공유 카드)              (주선자 카톡)    FinalEpilogue
                                                                          (최종 매칭 엔딩)

  설정 → Inquiry ─▶ InquiryThread   (1:1 문의 · 익명 인증 기반)
```

【발표 스크립트】 "14개 화면 전부가 하나의 네이티브 스택에 정의되어 있고, 라우트 파라미터를 TypeScript 타입으로 강제해 화면 간 계약을 컴파일 타임에 검증합니다."

```ts
// src/navigation/types.ts — 라우트 파라미터를 타입으로 고정
export type RootStackParamList = {
  Splash: undefined;
  LineSelect: { next: 'NameInput' | 'CharacterSelect' };
  BlindDateChat: undefined;
  AdInterstitial: { result: DateResult };
  ResultReport: { result: DateResult };
  InquiryThread: { id: number; subject: string };
  // ...
};
```

---

# PART 2 — 시스템 아키텍처

## 슬라이드 5 · 전체 아키텍처

```
┌────────────────────── 클라이언트 (React Native / Expo) ──────────────────────┐
│                                                                             │
│  screens/ 14        widgets/ 7        state/ (Zustand)       theme/ (토큰)   │
│  화면 컴포넌트  ◀──▶   공용 UI    ◀──▶   단일 스토어     ◀──▶  light/dark      │
│       │                                    │                                │
│       │                                    ▼                                │
│       │                              AsyncStorage (이름·진행·설정·결과)       │
│       ▼                                                                     │
│  data/ 32화 시나리오 (전량 앱 번들 내장 → 오프라인 100% 동작)                   │
│       │                                                                     │
│  analytics/track.ts ── POST(REST, anon) ──┐   lib/supabase.ts ── 익명 로그인  │
└───────────────────────────────────────────┼─────────────────────────────────┘
                                            ▼
                        ┌──────────────────────────────────────────┐
                        │           Supabase (PostgreSQL)          │
                        │  events / inquiries / inquiry_messages   │
                        │  admins  + RLS 정책 + is_admin()         │
                        │  집계 뷰 15개 (security_invoker = on)     │
                        └──────────────────┬───────────────────────┘
                                           │ SELECT (관리자 계정만)
                                           ▼
                        ┌──────────────────────────────────────────┐
                        │  admin/index.html — 운영 대시보드          │
                        │  KPI · 퍼널 · 리텐션 · 오류 · 문의 응대     │
                        │  (차트 라이브러리 0개, SVG 직접 구현)       │
                        └──────────────────────────────────────────┘
```

**설계 원칙 3가지**
1. **게임은 네트워크에 의존하지 않는다.** 콘텐츠 전량 번들 내장 → 비행기 모드에서도 완주 가능.
2. **집계는 DB에서 끝낸다.** 브라우저는 결과 행만 받는다 (PostgREST 1000행 제한 회피 + 전송량 최소화).
3. **공개되는 키로는 아무것도 읽을 수 없다.** anon 키는 INSERT 전용, SELECT는 RLS로 전면 차단.

---

## 슬라이드 6 · 기술 스택과 선정 근거

| 레이어 | 선택 | 선정 이유 |
|---|---|---|
| 프레임워크 | **React Native 0.81 + Expo SDK 54** | 단일 코드베이스로 Android/iOS/Web 동시 배포. Expo Go QR로 즉시 시연 가능 → 포트폴리오 데모에 유리 |
| 언어 | **TypeScript 5.3** | 32화 × 1,384 선택지의 데이터 무결성을 타입으로 강제. `npm run typecheck`로 검증 |
| 상태관리 | **Zustand 5** | Redux 대비 보일러플레이트 없음. `useStore.getState()`로 **React 외부(타이머 콜백·analytics)에서도 최신 상태 접근** 가능한 점이 결정적 |
| 영속화 | **AsyncStorage** | 키-값이면 충분한 규모. SQLite는 과설계 |
| 내비게이션 | **React Navigation 6 (native-stack)** | 네이티브 스택 → 안드로이드 하드웨어 뒤로가기·전환 애니메이션이 OS 기본과 동일 |
| 백엔드 | **Supabase (PostgreSQL + RLS + Auth)** | 서버 코드 0줄로 인증·권한·집계 해결. 보안을 **DB 레벨**에 둘 수 있음 |
| 연출 | expo-audio / expo-haptics / expo-blur / expo-linear-gradient / react-native-svg | 카톡 감성 재현(도착음·진동·유리질 블러)에 필요한 최소 조합 |
| 배포 | Vercel (`expo export -p web`) | 웹 데모 즉시 공유. 대시보드는 **별도 프로젝트로 분리** (rewrite 충돌 방지) |

【발표 포인트】 "Zustand를 고른 진짜 이유는 문법이 짧아서가 아니라, **채팅 연출이 setTimeout 체인 위에서 돌기 때문에** 훅 밖에서 최신 세션 상태를 읽어야 했기 때문입니다."

---

## 슬라이드 7 · 기술적 도전 ① — Flutter → React Native 전면 이식

**배경:** 초기 프로토타입은 Flutter(Dart)로 제작되어 있었고, 배포 편의성과 웹 데모를 위해 RN으로 전면 이식했습니다.
기능·대본·에셋은 100% 동일하게 유지하고 언어와 프레임워크만 교체했습니다.

| Flutter | React Native | 이식 시 핵심 이슈 |
|---|---|---|
| Riverpod `Notifier` | Zustand `create` | Provider 트리 → 단일 스토어 슬라이스로 평탄화 |
| `shared_preferences` | AsyncStorage | 동기 API → **비동기**. 앱 시작 시 `loadPersisted()` 1회로 일괄 복원 |
| `ThemeExtension` / `context.colors` | 토큰 객체 + `useColors()` 훅 | `TypeDateTokens` 인터페이스로 light/dark 두 구현을 강제 |
| `TextStyle(height: 1.5)` (배수) | `lineHeight` (px) | **줄간격 단위 차이** — `fontSize * height`로 전량 환산 |
| `Color.withValues(alpha:)` | 직접 구현 `withAlpha()` | hex → rgba 문자열 변환 유틸 자체 제작 |
| `BackdropFilter` | expo-blur `BlurView` | iOS/Android/Web 3플랫폼 폴백 검증 |
| `AssetImage('경로문자열')` | **정적 require만 허용** | 런타임 문자열 경로 불가 → **이미지 레지스트리 패턴**으로 해결 (슬라이드 17) |

```ts
// src/theme/colors.ts — 플랫폼 차이를 흡수한 알파 유틸
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

【발표 스크립트】 "단순 문법 번역이 아니라 **런타임 모델의 차이**를 매핑하는 작업이었습니다. 특히 RN 번들러는 정적 require만 허용해서, Flutter의 '경로 문자열로 이미지 로드' 구조를 통째로 재설계해야 했습니다."

---

# PART 3 — 핵심 구현

## 슬라이드 8 · 상태 관리 설계 (Zustand 단일 스토어)

**슬라이스 6종을 하나의 스토어에 구성** — 화면은 필요한 필드만 셀렉터로 구독해 리렌더 범위를 최소화합니다.

| 슬라이스 | 상태 | 영속화 |
|---|---|---|
| 테마 | `themeMode: light/dark/system` | O |
| 사운드 | `soundMuted`, `sfxVolume` | O (debounce 400ms) |
| 접근성 | `fontScale` (0.85~1.3) | O |
| 수익화 | `adRemoved` | O |
| 라인/진행 | `line`, `results`, `completedIds`, `totalCompleted` | O |
| 세션(휘발) | `session: { currentTurnIndex, likeScore, axisScore, choicePending, lastChoice, history }` | X (회차 단위) |

```ts
// src/state/store.ts — 슬라이더 조작 중 매 프레임 저장을 막는 debounce
let volumeSaveTimer: ReturnType<typeof setTimeout> | null = null;
function saveVolumesSoon(sfx: number) {
  if (volumeSaveTimer != null) clearTimeout(volumeSaveTimer);
  volumeSaveTimer = setTimeout(() => {
    void AsyncStorage.setItem('td_sfx_volume', String(sfx));
  }, 400);
}

// 손상된 저장값에도 앱이 죽지 않도록 복원 단계에서 방어
function savedFontScale(raw: string | null): number {
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0.8 && v <= 1.4 ? v : 1;  // 범위 밖이면 기본값
}
```

**설계 디테일 — 0과 null의 구분**
볼륨을 0으로 저장한 사용자와 저장한 적 없는 사용자를 구분해야 하므로, falsy 체크가 아니라 `raw == null`로 판정합니다.
(`if (!raw)`로 짰다면 음소거 설정이 매번 초기화되는 버그가 됩니다.)

---

## 슬라이드 9 · 기술적 도전 ② — 게임 로직: ABCD 이중 축 시스템

**핵심 설계:** 선택 1회 = 축 점수 2개 동시 기록. 사용자는 "성향 테스트를 푼다"는 자각 없이 데이터를 남깁니다.

```
턴 구조 (4지선다 = 2×2 조합)
  선택 A: Primary-①(E) + Secondary-①(N)      ❤️ +1
  선택 B: Primary-①(E) + Secondary-②(S)      💔 -1
  선택 C: Primary-②(I) + Secondary-①(N)      💔 -1
  선택 D: Primary-②(I) + Secondary-②(S)      ❤️ +1
       ↑ 성향 축(정체성)               ↑ 호감도(상대 개인 취향) — 서로 독립
```

- 회차당 9~13턴 × 2축 = **회차당 최대 26개 데이터 포인트**
- 축별 6~7회 반복 측정 → 단발 응답의 편향 제거
- **호감도와 성향은 독립 변수** — MBTI 정답을 노려도 그 상대에게 호감을 얻는다는 보장이 없음(의도된 설계)

```ts
// src/state/store.ts — 선택 1회에 두 축이 동시에 증가
selectChoice: (choice) => {
  const s = get().session;
  if (s.choicePending) return;              // 연타로 인한 이중 집계 차단
  const newAxis = { ...s.axisScore };
  newAxis[choice.primaryAxis]   = (newAxis[choice.primaryAxis]   ?? 0) + 1;
  newAxis[choice.secondaryAxis] = (newAxis[choice.secondaryAxis] ?? 0) + 1;
  set({ session: { ...s, likeScore: s.likeScore + choice.likeScore,
                   axisScore: newAxis, choicePending: true, lastChoice: choice } });
},

// 엔딩 판정 + 소개팅 스타일 4유형(E/I × T/F) 도출
buildResult: () => {
  const s = get().session;
  const ending: Ending = s.likeScore >= 5 ? 'success'
                       : s.likeScore <= -5 ? 'fail' : 'friend';
  const ei = (s.axisScore['E'] ?? 0) >= (s.axisScore['I'] ?? 0) ? 'E' : 'I';
  const tf = (s.axisScore['T'] ?? 0) >= (s.axisScore['F'] ?? 0) ? 'T' : 'F';
  return { dateId: s.date.id, likeScore: s.likeScore, ending,
           axisScore: s.axisScore, styleType: `${ei}${tf}`, completedAt: Date.now() };
},
```

**추가 장치 — 위치 학습 방지**
데이터상 '좋은 답'이 특정 위치에 몰려 있어도 외울 수 없도록, 턴마다 선택지 순서를 Fisher–Yates로 섞고 A~D 라벨을 재부여합니다.

```ts
// src/screens/BlindDateChatScreen.tsx
function shuffleChoices(choices: Choice[]): Choice[] {
  const arr = [...choices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const labels = ['A', 'B', 'C', 'D'];
  return arr.map((ch, i) => ({ ...ch, label: labels[i] ?? ch.label }));  // 라벨은 위치 기준 재부여
}
```

---

## 슬라이드 10 · 기술적 도전 ③ — 채팅 연출 엔진 (760 LOC)

**목표:** "게임 대화창"이 아니라 **실제 카카오톡을 하는 리듬**을 재현한다.

**① 메시지 길이에 비례한 타이핑 지연**
```ts
// 짧은 말은 빨리, 긴 말은 천천히 — 사람이 치는 속도를 모사
function typingDelayFor(text: string): number {
  return Math.max(800, Math.min(2000, 450 + text.length * 24));
}
// 하한 800ms는 도착음(1.06초)이 겹쳐 들리지 않도록 확보한 값
```

**② 4단계 타이머 체인** — 한 턴이 진행되는 실제 순서
```
[내 질문 말풍선 350ms] → [상대 "입력 중..." 표시 + 타이핑음 루프]
   → [NPC 메시지 도착 + 도착음 + 오토스크롤] → [선택지 4개 노출]
   → 선택 → [햅틱 진동(호감/비호감 구분)] → [호감도 이펙트 850ms]
   → [상대 반응 "입력 중..."] → [반응 메시지] → [650ms 후 다음 턴 또는 클로징 씬]
```

**③ Stale closure 방지 — ref 미러링**
setTimeout 콜백은 생성 시점의 state를 캡처하므로, 카운터·대사 배열은 state와 ref를 동시에 갱신했습니다.
```ts
const openingRevealCountRef = useRef(0);
const setOpeningReveal = (n: number) => {
  openingRevealCountRef.current = n;   // 타이머 콜백이 읽는 값
  setOpeningRevealCount(n);            // 렌더링이 읽는 값
};
const getSession = () => useStore.getState().session;  // 훅 밖에서 최신 세션 접근
```

**④ 언마운트 안전성** — 화면 이탈 시 타이머가 죽은 컴포넌트를 건드리지 않도록 이중 방어
```ts
useEffect(() => {
  mounted.current = true;
  return () => {
    mounted.current = false;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  };
}, []);
// 모든 콜백 첫 줄: if (!mounted.current) return;
```

**⑤ 이름 토큰 치환** — 대본에 `{name}씨` 토큰을 심고 런타임에 사용자 이름으로 교체, 미입력 시 중립 호칭으로 폴백
```ts
function applyName(text: string, userName: string): string {
  const trimmed = userName.trim();
  return text.split('{name}씨').join(trimmed.length === 0 ? '그쪽' : `${trimmed}씨`);
}
```

【발표 스크립트】 "연출 코드가 전체 화면 중 가장 큰 760줄인 이유는, **비동기 타이머 체인 위에서 상태 일관성을 지키는 일**이 이 앱의 실질적 난이도였기 때문입니다."

---

## 슬라이드 11 · 콘텐츠 데이터 아키텍처 (32화 이중 라인)

**규모:** 여자 라인 16화 + 남자 라인 16화 = **32화, 346턴, 1,384 선택지, 대사 1,635줄**

```ts
// src/types/index.ts — 한 회차를 완결적으로 기술하는 단일 타입
export interface BlindDate {
  id: string;
  character: TDCharacter;                       // 프로필·이미지·MBTI
  turns: Turn[];                                // 9~13턴 × Choice 4개
  openingScript: ChatLine[];                    // 도착·인사·착석 (자동 진행)
  closingScripts: Record<Ending, ChatLine[]>;   // 엔딩 3종별 마무리 씬
  styleInfo: Record<string, StyleInfo>;         // EF/ET/IF/IT 유형별 결과 보고서
}
```

**라인 추상화** — 남/여 두 세계관을 코드 분기 없이 데이터로 전환
```ts
export const LINE_DATA: Record<LineKey, LineData> = {
  female: { episodes: allEpisodes,     slots: allCharacterSlots,
            prologueLines, prologueContact: '최민준',  firstEpisode: episode1 },
  male:   { episodes: allMaleEpisodes, slots: allMaleCharacterSlots,
            prologueLines: malePrologueLines, prologueContact: '예린 💍',
            firstEpisode: maleEpisodeEsfp },
};
// 진행 중 화면은 dateId만으로 라인을 역추적 — 파라미터를 화면마다 나를 필요가 없다
export function lineForDateId(dateId: string): LineKey {
  return allMaleEpisodes.some((e) => e.id === dateId) ? 'male' : 'female';
}
```

**최종 에필로그 — 16화 완주 보상 로직**
```ts
// 엔딩 등급(success > friend > fail) → 동률이면 호감도 → 그래도 같으면 먼저 만난 사람
const ENDING_RANK: Record<string, number> = { success: 2, friend: 1, fail: 0 };
// 전원 fail로 끝난 경우까지 별도 엔딩(주선자 친구와의 마무리)으로 분기 — 엣지 케이스에도 서사 제공
export function isNoMatch(match: FinalMatch): boolean {
  return match.result.ending === 'fail';
}
```

【발표 포인트】 "32화를 하드코딩 분기 없이 **데이터 구조로 흡수**했기 때문에, 신규 라인 추가 비용이 '데이터 파일 + LINE_DATA 한 줄'입니다."

---

## 슬라이드 12 · 디자인 시스템 · 반응형 · 접근성

**① 디자인 토큰 (14개 시맨틱 토큰 × light/dark 2세트)**
```ts
export interface TypeDateTokens {
  bg; surface; border; textPrimary; textSecondary; textMuted;
  accentCoral; accentCoralSoft; accentCoralSoftText;
  accentLavender; accentLavenderText; accentLavenderDeep; breakBlue; success;
}
// 인터페이스로 강제 → 다크 토큰 하나라도 빠지면 컴파일 에러 (다크모드 누락 원천 차단)
export function useColors(): TypeDateTokens { return useIsDark() ? darkTokens : lightTokens; }
```
테마 모드는 light / dark / **system(OS 연동)** 3단 순환.

**② 반응형 — 정비례 스케일링을 쓰지 않은 이유**
```ts
// 폭에 정비례시키면 폴드 접힘(280px)에서 글자가 못 읽을 만큼 작아지고, 태블릿에선 우스꽝스럽게 커진다.
// → 차이의 35%만 반영하고 상하한으로 묶는다.
export function useDeviceScale(): number {
  const raw = 1 + (useContentWidth() / 390 - 1) * 0.35;
  return Math.max(0.9, Math.min(1.12, raw));   // 280→0.90  390→1.00  600→1.12
}
export const CONTENT_MAX_WIDTH = 600;  // 배경은 화면 전체, 콘텐츠만 600px로 묶어 가운데 정렬
```
→ 갤럭시 Z 폴드 접힘(280dp)부터 태블릿/웹 와이드까지 한 코드로 대응.

**③ 접근성** — 설정에서 글자 배율 4단계(0.85 / 1.0 / 1.15 / 1.3) 제공, 전체 텍스트 스타일에 일괄 반영.

**④ 브랜드 무드 구현** — `GlowBackground`(SVG 라디얼 그라디언트 블롭) + `GlassPanel`(BlurView 유리질 패널)로
사진·그라디언트 어떤 배경 위에서도 텍스트 가독성이 유지되도록 반투명 필(`MonologuePill`) 처리.

**⑤ 점수 비노출 원칙** — 호감도는 숫자로 절대 노출하지 않고 **색·움직임·진동**으로만 전달
```ts
// LikeEffectOverlay: 호감=코랄 테두리 플래시 + 하트 파편 8방향 / 비호감=회색 플래시 + X 파편 낙하 (850ms)
void Haptics.notificationAsync(choice.likeScore > 0
  ? Haptics.NotificationFeedbackType.Success
  : Haptics.NotificationFeedbackType.Warning);
```

---

# PART 4 — 백엔드 · 데이터 · 운영

## 슬라이드 13 · 기술적 도전 ④ — 보안 우선 백엔드 설계 (RLS)

**전제:** 클라이언트에 박히는 `anon` 키는 **반드시 공개된다**고 가정하고 설계.

```sql
-- 앱은 쓰기만 한다
create policy "anon can insert events" on public.events
  for insert to anon with check (true);

-- 읽기는 admins 테이블에 등록된 계정만
create policy "admins can read events" on public.events
  for select to authenticated using (public.is_admin());
```

**핵심 인사이트 — "로그인했으면 관리자"는 취약점이다**
1:1 문의를 위해 익명 로그인(`signInAnonymously`)을 쓰는 순간 **모든 앱 사용자가 `authenticated` 역할**이 됩니다.
역할만으로 판정하면 전체 트래킹 데이터가 유출됩니다. 그래서 별도 `admins` 화이트리스트 + `SECURITY DEFINER` 함수로 판정합니다.

```sql
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;   -- 익명 호출 차단
grant execute on function public.is_admin() to authenticated;
-- admins 테이블 자체는 RLS 정책을 하나도 만들지 않음 = 클라이언트에서 전부 거부
```

**1:1 문의 — 답변 위조 차단**
```sql
-- 사용자는 자기 스레드에 sender='user'로만 쓸 수 있다 (운영자 답변 위조 불가)
create policy "write own thread" on public.inquiry_messages for insert to authenticated
  with check (
    (public.is_admin() and sender = 'admin')
    or (sender = 'user' and exists (
          select 1 from public.inquiries i where i.id = inquiry_id and i.user_id = auth.uid()))
  );
```

**개인정보 최소 수집** — 사용자 이름·기기정보·위치·광고 식별자를 **전송하지 않음**. 기기 구분은 앱이 최초 실행 시 생성한 임의 UUID 하나뿐.

---

## 슬라이드 14 · 분석 파이프라인 (수집 → 집계 → 대시보드)

**① 수집 (9종 이벤트)** — `app_open` / `screen_view` / `episode_start` / `choice` / `episode_quit` / `episode_complete` / `error` / `ad_shown` / `remove_ads`

```ts
// src/analytics/track.ts — 3가지 설계 원칙
export function track(name: string, opts = {}): void {
  if (!enabled) return;                 // ① 환경변수 없으면 조용히 비활성 (로컬 개발이 통계를 오염시키지 않음)
  void (async () => {
    try { await fetch(`${URL}/rest/v1/events`, { /* ... */ }); }
    catch { /* ② 실패는 삼킨다 — 통계 때문에 게임이 멈추면 안 된다 */ }
  })();                                 // ③ await 하지 않음 — UI 스레드를 절대 막지 않는다
}
```

**② 화면 추적을 한 곳에서** — 14개 화면에 코드를 심는 대신 `NavigationContainer` 리스너 1곳에서 처리 → 화면이 늘어나도 자동 추적
```ts
const navRef = createNavigationContainerRef();
function logScreen() {
  const name = navRef.getCurrentRoute()?.name;
  if (name != null && name !== lastScreen) {
    lastScreen = name;
    track('screen_view', { props: { screen: name } });
  }
}
<NavigationContainer ref={navRef} onReady={logScreen} onStateChange={logScreen}>
```

**③ 집계 — SQL 뷰 15개**

| 뷰 | 답하는 질문 |
|---|---|
| `v_daily_active` | 일별 활성/신규 기기 |
| `v_onboarding` | 온보딩 어느 화면에서 이탈하는가 |
| `v_retention` | D1 / D7 코호트 재방문율 |
| `v_episode_funnel` | 회차별 시작 대비 완주율 |
| **`v_continuation`** | **이 회차를 끝낸 사람이 다음 회차를 시작했는가** |
| `v_turn_reach` / `v_quit_turn` | 몇 번째 턴에서 이탈·포기하는가 |
| `v_choice_rate` / `v_choice_balance` | 선택률 분포 / 죽은 선택지·몰표 선택지 경고 |
| `v_ending_dist` / `v_style_dist` | 엔딩·성향 유형 분포 (밸런스 검증) |
| `v_errors` | 화면·메시지별 오류 집계 |
| `v_monetization` / `_daily` | 광고 노출·광고 제거 전환 |

**연재형 서비스에 맞춘 지표 설계** — `v_continuation`은 "완주율"이 아니라 **"완주 후 다음 화로 넘어갔는가"**를 봅니다.
해금 순서에 의존하지 않도록 '다음 회차'가 아니라 '이후의 아무 회차'로 정의했습니다. 완주율이 높아도 여기서 끊기면 이탈이기 때문입니다.

```sql
create or replace view public.v_continuation with (security_invoker = on) as
with done as (
  select device_id, episode_id, min(created_at) as done_at
  from public.events where name = 'episode_complete' group by 1, 2
)
select d.episode_id, count(*) as finishers,
       count(*) filter (where nx.went) as continued,
       round(100.0 * count(*) filter (where nx.went) / nullif(count(*),0), 1) as continue_rate
from done d
cross join lateral (
  select exists (select 1 from public.events e
                 where e.device_id = d.device_id and e.name = 'episode_start'
                   and e.episode_id is distinct from d.episode_id
                   and e.created_at > d.done_at) as went
) nx
group by 1 order by continue_rate nulls last;
```

---

## 슬라이드 15 · 운영자 대시보드 (의존성 0개, 1,302줄 단일 파일)

**구성 6페이지** — 대시보드 / 1:1 문의 / 회차 상세 / 콘텐츠 품질 / 수익 현황 / 앱 오류

**차별점: 차트 라이브러리를 쓰지 않았습니다.**
Chart.js·Recharts 등을 붙이지 않고 `lineChart` · `barsH` · `barsV` · `stacked` · `sparkBars` 5종을 **SVG로 직접 구현**했습니다.
- 근거: 번들 사이즈, CDN 장애 의존, 커스텀 툴팁/테마 대응 비용
- 결과: 외부 차트 의존성 0, 라이트/다크 테마 CSS 변수로 완전 대응, 단일 HTML 파일로 배포

```js
// 집계는 DB에서 끝내고 브라우저는 결과만 받는다 (PostgREST 1000행 제한 회피)
async function q(view, build) { let query = sb.from(view).select('*'); /* ... */ }
```

**운영 관점 UX**
- 답변 대기 문의가 목록 상단으로 자동 정렬
- 관리자 미등록 상태로 로그인하면 **실행할 SQL을 UID와 함께 화면에 띄워줌** (운영자가 복붙만 하면 됨)
- 수익 화면에 "이건 추정치다"를 명시 — 광고/결제 SDK 미연동 상태이므로 `remove_ads`는 매출이 아니라 **전환 의사**임을 UI와 문서에 모두 경고

---

## 슬라이드 16 · 안정성 — 크래시를 사용자 문의로 알게 되지 않도록

**2중 오류 포착 + 텔레메트리**

```ts
// ① 렌더 중 오류 → ErrorBoundary가 잡고, 빈 화면 대신 복구 안내 UI 표시
componentDidCatch(error: Error) {
  track('error', { props: {
    message: String(error?.message ?? error).slice(0, 200),  // 길면 집계 시 같은 오류가 갈라짐 → 절단
    screen: this.props.screen(),                             // 어디서 터졌는지
    fatal: 'render',
  }});
}

// ② 타이머·비동기에서 터진 오류 → 전역 핸들러. 기존 핸들러(개발 중 빨간 화면)는 그대로 이어서 호출
const prevGlobalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((e, isFatal) => {
  track('error', { props: { message: String(e?.message ?? e).slice(0, 200),
                            screen: lastScreen, fatal: isFatal ? 'fatal' : 'async' } });
  prevGlobalHandler(e, isFatal);
});
```
→ `v_errors` 뷰에서 **화면 × 메시지 × 종류(render/fatal/async)** 별로 집계되어 대시보드에 노출됩니다.

**진행 손실 방지 — 저장 순서 설계**
```ts
// 진행 저장과 완주 기록을 '광고 화면으로 이동하기 전에' 수행
void completeDate(result);          // 광고에서 이탈해도 이번 회차는 완료로 남는다
track('episode_complete', { ... }); // 광고에서 이탈해도 완주 통계는 남는다
navigation.replace(adRemoved ? 'ResultReport' : 'AdInterstitial', { result });
```

**손상 데이터 방어** — AsyncStorage의 JSON이 깨져 있어도 앱이 죽지 않고 완료 플래그만으로 진행
```ts
try { savedResults[e.id] = JSON.parse(raw) as DateResult; }
catch { /* 손상된 저장값은 무시 — 완료 플래그만으로 진행 가능 */ }
```

---

## 슬라이드 17 · 성능 최적화

| 항목 | 조치 | 효과 |
|---|---|---|
| 화면 전환 시 이미지 깜빡임 | 앱 시작 시 `Asset.loadAsync(allImages)`로 111장 일괄 프리캐시 | 전환 지연 제거 |
| 스플래시 타이밍 | 폰트 4종 + 이미지 로드 완료까지 `preventAutoHideAsync()`로 유지 | 빈 화면 노출 0 |
| 앱 용량 | 캐릭터 이미지 전량 PNG → **JPEG 변환** (레지스트리 키는 `.png` 유지해 데이터 수정 없이 교체) | 에셋 경량화 |
| 오디오 | 플레이어를 앱 전체에서 **싱글턴 1개씩만** 생성해 재사용 | 메시지 연속 도착 시 재로드 없음 |
| 저장 I/O | 볼륨 슬라이더 400ms debounce | 드래그 중 매 프레임 쓰기 방지 |
| 상태 구독 | 화면별 셀렉터 구독(`useStore(s => s.fontScale)`) | 불필요한 리렌더 차단 |
| 대시보드 | 집계를 SQL 뷰에서 종료, 브라우저는 결과 행만 수신 | 전송량 최소화 + 1000행 제한 회피 |

```ts
// RN 번들러는 정적 require만 허용 → Flutter의 문자열 경로를 모듈로 매핑하는 레지스트리 패턴
const registry: Record<string, ImageSourcePropType> = {
  'assets/images/ENFP_female.png': require('../../assets/images/ENFP_female.jpg'),
  // ... 111개. 데이터의 imagePath 문자열이 그대로 이 맵의 키가 된다
};
```

**오프라인 완전 동작** — 콘텐츠 32화가 전량 번들에 내장되어 네트워크 없이 완주 가능. 통계/문의만 온라인 기능이며, 둘 다 실패해도 게임 진행을 막지 않습니다.

---

# PART 5 — 문제 해결 사례

## 슬라이드 18 · 트러블슈팅 ① — 익명 사용자 1명이 대시보드를 영구 정지시킬 수 있었던 취약점 `P0`

**현상 / 리스크**
집계 뷰 7곳에서 `(props ->> 'turn')::int`로 직접 캐스팅하고 있었습니다.
익명 사용자가 `{"turn":"x"}` 이벤트를 **단 1건** 삽입하면 `v_turn_reach` · `v_quit_turn` · `v_choice_rate` · `v_choice_balance` **4개 뷰가 전부 `22P02` 오류로 사망**합니다.
게다가 `events`에 DELETE 정책이 없어 **대시보드에서 그 행을 지울 수도 없었습니다** (SQL 에디터로 직접 접속해야 복구).

**조치 3단**
```sql
-- 1) 실패해도 null을 돌려주는 안전 캐스트
create or replace function public.safe_int(value text) returns integer
language plpgsql immutable strict as $$
begin return value::integer;
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end; $$;

-- 2) 정규식 필터 + null 필터 (상호 보완)
where props ->> 'turn' ~ '^[0-9]+$'                    -- ' 3 ', '+5', '-7' 같은 비정상 값 제거
  and public.safe_int(props ->> 'turn') is not null    -- '99999999999' 같은 범위 초과 제거

-- 3) 관리자 전용 DELETE 정책 추가 → 오염 행을 대시보드에서 직접 삭제 가능
```

**검증 방식이 핵심** — 원격 Supabase에 관리자 세션이 없어 조회가 불가능했으므로(설계상 정상),
**PGlite(WASM PostgreSQL)에 `schema.sql`을 수정 없이 그대로 실행**해 재현 → 수정 전/후를 대조 검증했습니다.
Supabase 전용 객체(`auth.uid()`, `anon` 롤 등)만 테스트 스텁으로 채우고 스키마 파일은 단 한 줄도 건드리지 않았습니다.
결과: 정적 검증 9항목 전부 PASS, 기존 위험 캐스팅 잔존 0건.

【발표 스크립트】 "코드 리뷰 지적을 그대로 받아들이지 않고 **재현 가능한 환경을 만들어 교차 검증**한 뒤 작업했습니다. 검증 보고서는 `WORK_ORDER_01_VERIFICATION.md`에 남아 있습니다."

---

## 슬라이드 19 · 트러블슈팅 ② — 한글이 빈 네모(tofu)로 깨지던 문제

- **현상:** 빠르게 이어지는 대사에서 일부 한글 글자가 순간적으로 □로 표시됨.
- **원인:** 폰트를 번들링하지 않고 시스템 폰트에 의존 → 렌더러가 없는 글리프를 만나면 **런타임에 원격 폰트를 fetch**하는 동안 글자가 깨져 보임.
- **해결:** Pretendard 4종(Regular/Medium/SemiBold/Bold)을 직접 번들링하고 `useFonts`로 정식 등록, **로드 완료 전에는 스플래시를 유지**해 미완성 화면 자체를 노출하지 않도록 변경.
- **교훈:** "폰트가 있다"와 "폰트가 **로드 완료됐다**"는 다르다. 로딩 게이트를 UI 진입 조건으로 삼아야 한다.

```ts
const [fontsLoaded] = useFonts({ 'Pretendard-Regular': require('...'), /* 4종 */ });
const ready = fontsLoaded && imagesLoaded;
useEffect(() => { if (ready) void SplashScreen.hideAsync(); }, [ready]);
if (!ready) return null;   // 준비 전에는 아무것도 그리지 않는다
```

---

## 슬라이드 20 · 트러블슈팅 ③ — "버그처럼 보였지만 버그가 아니었던 것"

- **현상:** 자동화 검증 중 선택 후 다음 턴으로 넘어가는 타이머가 멈춤.
- **원인 추적:** 검증용 Chrome 창이 다른 창에 가려지자 브라우저의 **창 가림(occlusion) 감지**가 탭을 백그라운드로 간주해 타이머를 쓰로틀링. 창을 전면으로 되돌리자 즉시 정상 동작.
- **판단:** **자동화 테스트 환경 고유 현상이며 앱 버그가 아님.** 실사용 중에는 사용자가 화면을 보고 있으므로 발생하지 않음.
- **조치:** 코드 수정 없음. 대신 **원인과 판단 근거를 문서로 기록**해 다음 사람이 같은 시간을 쓰지 않게 함.

【발표 포인트】 "증상이 보인다고 바로 고치면 멀쩡한 코드를 망칩니다. **재현 조건을 좁혀 원인 계층을 확정**하고, '고치지 않는다'는 결정도 근거와 함께 남겼습니다."

---

## 슬라이드 21 · 개발 프로세스 & 코드 품질

**① 문서 주도 개발** — 코드보다 문서가 먼저

| 문서 | 역할 |
|---|---|
| `TYPE_DATE_PRD_v1.7.md` (62KB) | 제품 요구사항 — 화면 명세·게임 로직·데이터 모델·전체 대본 |
| `TYPE_DATE_UI_DESIGN_SPEC_v1.0.md` | 컬러 토큰·타입 스케일 명세 (코드의 `colors.ts`/`textStyles.ts`와 1:1 대응) |
| `WORK_ORDER.md` | 리뷰 지적을 **교차 검증한 뒤** 사실로 확인된 것만 작업으로 등록 |
| `WORK_ORDER_01_VERIFICATION.md` | 작업별 검증 보고서 (정적 검증 + 런타임 재현 결과) |
| `admin/README.md` | 운영 인수인계 문서 — 세팅·수집 항목·한계·보안 근거 |

**② 작업 규칙 (WORK_ORDER 공통 규칙에서 발췌)**
1. 기존 코드는 승인 전 수정하지 않는다 — "무엇을/어떻게/왜"를 먼저 보고한다.
2. 한 작업 = 한 커밋 = 한 PR.
3. 지시서에 없는 리팩터링·포매팅을 곁들이지 않는다. **바뀐 줄은 전부 한 항목으로 설명될 수 있어야 한다.**
4. 검증 결과를 PR 본문에 첨부한다. **"될 것 같다"는 통과가 아니다.**

**③ 코드에 '왜'를 남긴다** — 이 프로젝트의 주석은 동작 설명이 아니라 **의사결정 기록**입니다.
```ts
// 폭에 정비례시키면 폴드 접힘(280)에서 글자가 읽기 힘들 만큼 작아지고
// 태블릿에서는 우스꽝스럽게 커진다. 그래서 차이의 35%만 반영하고 상하한으로 묶는다.

// (0으로 저장한 경우도 그대로 살려야 하므로 null 여부로 판단한다)

// 집계는 SQL 뷰에서 끝내고 브라우저는 결과만 받는다. PostgREST 기본 1000행 제한에
// 걸리지 않게 하려는 구조이니, 원본 events를 그대로 불러오는 식으로 바꾸지 말 것.
```

**④ 타입 안전** — `npm run typecheck` (`tsc --noEmit`)로 32화 콘텐츠 데이터까지 전량 타입 검증.

---

## 슬라이드 22 · 수익 모델 · 배포 · 로드맵

**수익 모델 (3단계 설계)**

| 단계 | 조건 | 내용 |
|---|---|---|
| 1단계 | 출시 초기 | 완전 무료·광고 없음 → 바이럴 집중 |
| 2단계 | 다운로드 1만+ | 결과 리포트 앞 전면 광고 + 광고 제거 2,200원 |
| 3단계 | 콘텐츠 확장 | 여자 라인 무료 유지 / 남자 라인 확장팩 유료 |

**현재 상태를 정직하게 표기** (포트폴리오 신뢰도 포인트)
- `AdInterstitialScreen`은 5초 카운트다운만 도는 **자리표시자** — 광고 SDK 미연동
- `removeAds()`는 결제 없이 로컬 플래그만 설정 — 결제 SDK 미연동
- 따라서 대시보드 '수익 현황'은 **추정치**이며, 코드·문서·대시보드 UI 세 곳 모두에 이를 명시
- **교체 지점을 미리 설계해 둠**: 광고는 '로드 성공' 콜백, 결제는 '결제 성공' 콜백으로 `track()` 호출 위치만 옮기면 동일 화면이 그대로 실수익 집계로 전환 (해당 위치에 주석 표시)

**배포**
- 앱: Expo (Android `com.typedate.app` / iOS 병행, 태블릿 지원)
- 웹 데모: `npx expo export -p web` → Vercel (SPA rewrite 설정 포함)
- 대시보드: `admin/` 폴더를 **별도 Vercel 프로젝트**로 분리 배포 (게임 rewrite 규칙과 충돌 방지)

**로드맵**
① 광고/결제 SDK 연동 → 추정 수익을 실측으로 전환 ② 문의 답변 푸시 알림 ③ `v_choice_balance` 경고 기반 선택지 밸런싱 ④ 신규 캐릭터 라인 확장

---

## 슬라이드 23 · 회고 — 이 프로젝트에서 증명한 역량

| 역량 | 근거 |
|---|---|
| **크로스플랫폼 앱 개발** | RN + Expo로 Android/iOS/Web 단일 코드베이스, 14화면·27K LOC |
| **프레임워크 마이그레이션** | Flutter/Dart → RN/TS 전면 이식 (상태관리·테마·에셋 파이프라인 재설계) |
| **복잡한 비동기 UI 제어** | 타이머 체인 기반 채팅 연출, stale closure·언마운트 안전성 해결 |
| **데이터 모델링** | 32화 콘텐츠를 분기 없이 흡수하는 라인 추상화 구조 |
| **백엔드 & 보안** | RLS 기반 권한 설계, "익명 로그인 = authenticated" 함정 사전 차단 |
| **데이터 분석 설계** | 이벤트 9종 → 뷰 15개. 연재형 서비스에 맞는 `continuation` 지표 자체 정의 |
| **운영 도구 개발** | 의존성 0의 SVG 차트 대시보드 6페이지 + 문의 응대 시스템 |
| **문제 해결 태도** | P0 취약점을 PGlite로 재현·검증 후 수정, '고치지 않는다'는 판단도 근거와 함께 문서화 |

**가장 크게 배운 것**
> "동작하는 코드"와 "운영 가능한 서비스"는 다르다.
> 크래시가 나면 사용자 문의로 알게 되고, 이벤트 한 줄이 대시보드를 멈추며, 공개된 키 하나가 전체 데이터를 노출한다.
> 이번 프로젝트에서 가장 많은 시간을 쓴 곳은 기능이 아니라 **그 세 가지를 미리 막는 설계**였다.

---

# 부록 (선택 슬라이드)

## 부록 A · 데이터 모델 전문

```ts
interface TDCharacter { id; name; age; job; location; mbti; intro; tags[];
                        isUnlocked; imagePath?; facePath?; backgroundPath?; }
interface Choice      { label; text; primaryAxis; secondaryAxis; likeScore; npcReaction; }
interface Turn        { turnNumber; npcMessage; monologue; isPlayerInitiated; playerPrompt?; choices: Choice[]; }
interface ChatLine    { sender; text; isSystemNote?; isMonologue?; }
interface StyleInfo   { code; emoji; title; summary; goodPoint; badPoint;
                        compatibilityStars; compatibilityComment; endingMessages: Record<Ending,string>; }
interface DateResult  { dateId; likeScore; ending; axisScore: Record<string,number>; styleType; completedAt; }

// 4축 문자 조합 도출 — 결과 리포트의 '나 vs 상대' 궁합 비교에 사용
export function axisLetters(axisScore: Record<string, number>): string {
  const ei = (axisScore['E'] ?? 0) >= (axisScore['I'] ?? 0) ? 'E' : 'I';
  const ns = (axisScore['N'] ?? 0) >= (axisScore['S'] ?? 0) ? 'N' : 'S';
  const tf = (axisScore['T'] ?? 0) >= (axisScore['F'] ?? 0) ? 'T' : 'F';
  const jp = (axisScore['J'] ?? 0) >= (axisScore['P'] ?? 0) ? 'J' : 'P';
  return `${ei}${ns}${tf}${jp}`;
}
```

## 부록 B · 결과 리포트 화면 (731 LOC)

'종이 문서' 콘셉트의 분석 리포트 — 표지(도장 스탬프) + 본문 구성.
- 4축 막대 그래프: 우세한 쪽 레이블을 크고 굵게 + 강조색 처리 → 기울기가 한눈에 보임
- **나 vs 상대 궁합 비교 그리드**: 플레이 중 누적된 `axisScore` → `axisLetters()`로 계산한 내 성향 4글자와, 캐릭터 고정 `mbti` 4글자를 축 순서대로 1:1 비교, 상단에 "4개 성향 중 N개 일치" 요약
- 유형(EF/ET/IF/IT)별 잘한 점·아쉬운 점·엔딩 메시지는 **캐릭터마다 별도 텍스트** 보유
- 진입 시 `Animated`로 막대 그래프가 채워지는 연출

## 부록 C · 화면별 코드 규모 (상위)

| 화면/모듈 | LOC | 비고 |
|---|---|---|
| `BlindDateChatScreen` | 760 | 핵심 게임플레이 — 도입부·턴·이펙트·클로징 |
| `ResultReportScreen` | 731 | 분석 리포트 + 궁합 비교 |
| `widgets/common.tsx` | 535 | GlowBackground·GlassPanel·아바타·슬라이더 등 공용 |
| `supabase/schema.sql` | 449 | 테이블 4 · 뷰 15 · 함수 2 · RLS 정책 |
| `KakaoChatView` | 339 | 프롤로그/에필로그 카톡 뷰 (자동 진행 + 건너뛰기) |
| `FinalEpilogueScreen` | 206 | 3씬 최종 엔딩 시퀀스 |
| `admin/index.html` | 1,302 | 대시보드 6페이지 + SVG 차트 5종 |

## 부록 D · PPT 제작 가이드

- **컬러 팔레트** (앱 토큰 그대로 사용 시 통일감 상승)
  - 배경 `#EAE3F6` / 서피스 `#FFFFFF` / 본문 `#2B2723` / 보조 텍스트 `#9C948A`
  - 강조 코랄 `#FF6F5E` / 라벤더 `#B8A8E8` / 딥 라벤더 `#534AB7` / 성공 `#1D9E75`
  - 다크 슬라이드용: 배경 `#201B30` / 서피스 `#2C2742` / 텍스트 `#F5F0EA`
- **폰트**: Pretendard (앱과 동일)
- **캡처 권장 화면 6컷**: ① 캐릭터 선택 그리드 ② 소개팅 채팅(선택지 노출 상태) ③ 호감도 이펙트 순간 ④ 결과 리포트 4축 그래프 ⑤ SNS 공유 카드 ⑥ 관리자 대시보드
- **슬라이드 비중**: 개요 3장 / 아키텍처 3장 / 구현 5장 / 백엔드·데이터 4장 / 트러블슈팅 3장 / 마무리 2장
- **강조할 3대 셀링 포인트**: ① 앱+백엔드+운영도구 풀사이클 ② 보안(RLS)·안정성 설계 ③ 근거를 남기는 개발 프로세스
