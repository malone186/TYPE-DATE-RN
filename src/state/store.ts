import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlindDate, Choice, DateResult, Ending } from '../types';
import { allEpisodes, episode1, LineKey } from '../data';
import { allMaleEpisodes } from '../data/male';

// Flutter game_state.dart (Riverpod) → Zustand 이식.
// shared_preferences → AsyncStorage.

export type ThemeMode = 'light' | 'dark' | 'system';

const emptyAxis = (): Record<string, number> => ({
  E: 0, I: 0, N: 0, S: 0, T: 0, F: 0, J: 0, P: 0,
});

interface DateSession {
  date: BlindDate;
  currentTurnIndex: number; // 0-based
  likeScore: number;
  axisScore: Record<string, number>;
  choicePending: boolean; // 선택 결과(이펙트/반응) 처리 중인지
  lastChoice: Choice | null;
  history: Choice[]; // 완료된 턴들의 선택 — 누적 대화 로그 재구성용
}

interface AppState {
  // 테마 (Flutter themeModeProvider)
  themeMode: ThemeMode;
  cycleThemeMode: () => void;

  // 사운드 설정 — 화면 우측 상단 사운드 버튼에서 조절, AsyncStorage 영속화
  soundMuted: boolean;
  sfxVolume: number; // 0~1
  toggleSoundMuted: () => void;
  setSfxVolume: (v: number) => void;

  // 글자 크기 배율 — 설정창에서 조절, AsyncStorage 영속화
  fontScale: number;
  setFontScale: (v: number) => void;

  // 광고 제거 여부 — 설정창에서 구매, AsyncStorage 영속화
  adRemoved: boolean;
  removeAds: () => void;

  // 라인(남/여) — 스플래시 다음 선택 화면에서 결정, AsyncStorage 영속화
  line: LineKey;
  setLine: (line: LineKey) => Promise<void>;

  // 지금 플레이하려는 에피소드 (Flutter selectedEpisodeProvider)
  selectedEpisode: BlindDate;
  setSelectedEpisode: (d: BlindDate) => void;

  // 한 회차 진행 상태 (Flutter dateSessionProvider)
  session: DateSession;
  startSession: (date: BlindDate) => void;
  selectChoice: (choice: Choice) => void;
  advanceTurn: () => void;
  buildResult: () => DateResult;

  // 전체 진행 상황 (Flutter gameProgressProvider) — AsyncStorage 영속화
  results: Record<string, DateResult>;
  completedIds: Set<string>;
  totalCompleted: number;
  completeDate: (result: DateResult) => Promise<void>;
  isCompleted: (dateId: string) => boolean;

  // 사용자 이름 (Flutter userNameProvider) — AsyncStorage 영속화
  userName: string;
  setUserName: (name: string) => Promise<void>;

  // 앱 시작 시 영속 데이터 로드
  loadPersisted: () => Promise<void>;
}

const freshSession = (date: BlindDate): DateSession => ({
  date,
  currentTurnIndex: 0,
  likeScore: 0,
  axisScore: emptyAxis(),
  choicePending: false,
  lastChoice: null,
  history: [],
});

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/// 저장된 볼륨 문자열을 복원 — 저장된 적 없거나 손상된 값이면 기본값.
/// (0으로 저장한 경우도 그대로 살려야 하므로 null 여부로 판단한다)
function savedVolume(raw: string | null, fallback: number): number {
  if (raw == null) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? clamp01(v) : fallback;
}

/// 저장된 글자 배율을 복원 — 손상되거나 지원 범위 밖이면 기본값(1).
function savedFontScale(raw: string | null): number {
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0.8 && v <= 1.4 ? v : 1;
}

// 슬라이더를 끄는 동안 매 프레임 저장하지 않도록 잠깐 모았다가 한 번만 기록한다.
let volumeSaveTimer: ReturnType<typeof setTimeout> | null = null;
function saveVolumesSoon(sfx: number) {
  if (volumeSaveTimer != null) clearTimeout(volumeSaveTimer);
  volumeSaveTimer = setTimeout(() => {
    void AsyncStorage.setItem('td_sfx_volume', String(sfx));
  }, 400);
}

function currentTurn(s: DateSession) {
  return s.date.turns[s.currentTurnIndex];
}
function isLastTurn(s: DateSession) {
  return s.currentTurnIndex === s.date.turns.length - 1;
}

export const useStore = create<AppState>((set, get) => ({
  themeMode: 'light',
  cycleThemeMode: () => {
    const next: ThemeMode =
      get().themeMode === 'light' ? 'dark' : get().themeMode === 'dark' ? 'system' : 'light';
    set({ themeMode: next });
    void AsyncStorage.setItem('td_theme_mode', next);
  },

  soundMuted: false,
  sfxVolume: 0.8,
  toggleSoundMuted: () => {
    const next = !get().soundMuted;
    set({ soundMuted: next });
    void AsyncStorage.setItem('td_sound_muted', next ? 'true' : 'false');
  },
  setSfxVolume: (v) => {
    const next = clamp01(v);
    set({ sfxVolume: next });
    saveVolumesSoon(next);
  },

  fontScale: 1,
  setFontScale: (v) => {
    set({ fontScale: v });
    void AsyncStorage.setItem('td_font_scale', String(v));
  },

  adRemoved: false,
  removeAds: () => {
    set({ adRemoved: true });
    void AsyncStorage.setItem('td_ad_removed', 'true');
  },

  line: 'female',
  setLine: async (line) => {
    set({ line });
    await AsyncStorage.setItem('td_line', line);
  },

  selectedEpisode: episode1,
  setSelectedEpisode: (d) => set({ selectedEpisode: d }),

  session: freshSession(episode1),
  startSession: (date) => set({ session: freshSession(date) }),

  selectChoice: (choice) => {
    const s = get().session;
    if (s.choicePending) return;
    const newAxis = { ...s.axisScore };
    newAxis[choice.primaryAxis] = (newAxis[choice.primaryAxis] ?? 0) + 1;
    newAxis[choice.secondaryAxis] = (newAxis[choice.secondaryAxis] ?? 0) + 1;
    set({
      session: {
        ...s,
        likeScore: s.likeScore + choice.likeScore,
        axisScore: newAxis,
        choicePending: true,
        lastChoice: choice,
      },
    });
  },

  advanceTurn: () => {
    const s = get().session;
    if (isLastTurn(s)) return;
    const choice = s.lastChoice;
    set({
      session: {
        ...s,
        currentTurnIndex: s.currentTurnIndex + 1,
        choicePending: false,
        lastChoice: null,
        history: choice == null ? s.history : [...s.history, choice],
      },
    });
  },

  buildResult: () => {
    const s = get().session;
    const score = s.likeScore;
    const ending: Ending =
      score >= 5 ? 'success' : score <= -5 ? 'fail' : 'friend';
    const ei = (s.axisScore['E'] ?? 0) >= (s.axisScore['I'] ?? 0) ? 'E' : 'I';
    const tf = (s.axisScore['T'] ?? 0) >= (s.axisScore['F'] ?? 0) ? 'T' : 'F';
    const styleType = `${ei}${tf}`;
    return {
      dateId: s.date.id,
      likeScore: score,
      ending,
      axisScore: s.axisScore,
      styleType,
      completedAt: Date.now(),
    };
  },

  results: {},
  completedIds: new Set<string>(),
  totalCompleted: 0,

  completeDate: async (result) => {
    const st = get();
    const newResults = { ...st.results, [result.dateId]: result };
    const newCompleted = new Set(st.completedIds);
    newCompleted.add(result.dateId);
    set({
      results: newResults,
      completedIds: newCompleted,
      totalCompleted: newCompleted.size,
    });
    await AsyncStorage.setItem(`td_${result.dateId}_completed`, 'true');
    // 최종 에필로그(최고 매칭 상대 선정)에 호감도가 필요하므로 결과 전체를 영속화.
    await AsyncStorage.setItem(`td_${result.dateId}_result`, JSON.stringify(result));
  },

  isCompleted: (dateId) => get().completedIds.has(dateId),

  userName: '',
  setUserName: async (name) => {
    set({ userName: name });
    await AsyncStorage.setItem('td_user_name', name);
  },

  loadPersisted: async () => {
    const name = (await AsyncStorage.getItem('td_user_name')) ?? '';
    const savedLine = (await AsyncStorage.getItem('td_line')) as LineKey | null;
    const savedTheme = (await AsyncStorage.getItem('td_theme_mode')) as ThemeMode | null;
    const savedMuted = await AsyncStorage.getItem('td_sound_muted');
    const savedSfx = await AsyncStorage.getItem('td_sfx_volume');
    const savedScale = await AsyncStorage.getItem('td_font_scale');
    const savedAdRemoved = await AsyncStorage.getItem('td_ad_removed');
    const completed = new Set<string>();
    const savedResults: Record<string, DateResult> = {};
    for (const e of [...allEpisodes, ...allMaleEpisodes]) {
      const v = await AsyncStorage.getItem(`td_${e.id}_completed`);
      if (v === 'true') completed.add(e.id);
      const raw = await AsyncStorage.getItem(`td_${e.id}_result`);
      if (raw != null) {
        try {
          savedResults[e.id] = JSON.parse(raw) as DateResult;
        } catch {
          // 손상된 저장값은 무시 — 완료 플래그만으로 진행 가능
        }
      }
    }
    set({
      userName: name,
      themeMode:
        savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system'
          ? savedTheme
          : 'light',
      line: savedLine === 'male' || savedLine === 'female' ? savedLine : 'female',
      soundMuted: savedMuted === 'true',
      sfxVolume: savedVolume(savedSfx, 0.8),
      fontScale: savedFontScale(savedScale),
      adRemoved: savedAdRemoved === 'true',
      completedIds: completed,
      totalCompleted: completed.size,
      results: savedResults,
    });
  },
}));

// 편의 셀렉터 (컴포넌트에서 파생값 계산에 사용)
export function sessionCurrentTurn(s: DateSession) {
  return currentTurn(s);
}
export function sessionIsLastTurn(s: DateSession) {
  return isLastTurn(s);
}
export function sessionProgress(s: DateSession) {
  return s.currentTurnIndex / s.date.turns.length;
}
export type { DateSession };
