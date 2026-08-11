import { DateResult } from '../types';

// Flutter Navigator 라우트 → React Navigation 네이티브 스택 파라미터.
export type RootStackParamList = {
  Splash: undefined;
  LineSelect: { next: 'NameInput' | 'CharacterSelect' };
  NameInput: undefined;
  Prologue: undefined;
  CharacterSelect: undefined;
  CharacterProfile: { characterId: string };
  BlindDateChat: undefined;
  AdInterstitial: { result: DateResult };
  ResultReport: { result: DateResult };
  SnsCard: { result: DateResult };
  Epilogue: { result: DateResult };
  FinalEpilogue: undefined;
};
