// PRD §10 데이터 모델 기반 — Flutter models.dart 이식

export interface TDCharacter {
  id: string;
  name: string;
  age: number;
  job: string;
  location: string;
  mbti: string;
  intro: string;
  tags: string[];
  isUnlocked: boolean;
  imagePath?: string | null; // 원본 asset 경로 문자열 (image registry 키로 사용)
  facePath?: string | null; // 얼굴 위주 크롭 — 프로필 사진용
  backgroundPath?: string | null; // 소개팅 장소 배경 — 채팅 화면 photoBackground용
}

export interface Choice {
  label: string; // A / B / C / D
  text: string;
  primaryAxis: string;
  secondaryAxis: string;
  likeScore: number; // +1 or -1
  npcReaction: string;
}

export interface Turn {
  turnNumber: number;
  npcMessage: string;
  monologue: string;
  isPlayerInitiated: boolean;
  playerPrompt?: string | null; // isPlayerInitiated일 때 먼저 보여줄 내 질문
  choices: Choice[]; // A,B,C,D
}

export type Ending = 'success' | 'friend' | 'fail';

export const ALL_ENDINGS: Ending[] = ['success', 'friend', 'fail'];

/// 카톡 모방 채팅 한 줄 (프롤로그/에필로그/소개팅 도입부용)
export interface ChatLine {
  sender: string; // 'me' or character name
  text: string;
  isSystemNote?: boolean; // [화면 설명] 류 — 가운데 정렬 안내문
  isMonologue?: boolean; // 주인공 속마음 — 이탤릭 가운데 정렬
}

export interface StyleInfo {
  code: string; // EF/ET/IF/IT
  emoji: string;
  title: string;
  summary: string;
  goodPoint: string;
  badPoint: string;
  compatibilityStars: string; // e.g. ★★★★★
  compatibilityComment: string;
  endingMessages: Record<Ending, string>;
}

export interface BlindDate {
  id: string;
  character: TDCharacter;
  turns: Turn[];
  openingScript: ChatLine[]; // 도착·인사·착석 — 선택지 없이 자동 진행되는 도입부
  closingScripts: Record<Ending, ChatLine[]>; // 마지막 턴 종료 후 결과별 클로징 씬
  styleInfo: Record<string, StyleInfo>; // EF/ET/IF/IT — 이 상대 기준의 유형별 보고서
}

export interface DateResult {
  dateId: string;
  likeScore: number;
  ending: Ending;
  axisScore: Record<string, number>; // E,I,N,S,T,F,J,P
  styleType: string; // EF/ET/IF/IT
  completedAt: number; // epoch ms
}

/// DateResult.axisLetters — 4축 문자 조합 (models.dart의 getter 이식)
export function axisLetters(axisScore: Record<string, number>): string {
  const ei = (axisScore['E'] ?? 0) >= (axisScore['I'] ?? 0) ? 'E' : 'I';
  const ns = (axisScore['N'] ?? 0) >= (axisScore['S'] ?? 0) ? 'N' : 'S';
  const tf = (axisScore['T'] ?? 0) >= (axisScore['F'] ?? 0) ? 'T' : 'F';
  const jp = (axisScore['J'] ?? 0) >= (axisScore['P'] ?? 0) ? 'J' : 'P';
  return `${ei}${ns}${tf}${jp}`;
}
