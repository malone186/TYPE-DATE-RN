import { useWindowDimensions } from 'react-native';

// 이 앱은 세로 폰 기준으로 그려졌다. 태블릿이나 넓은 웹 창에서 그대로 늘리면
// 글줄이 지나치게 길어지고 말풍선이 화면을 가로질러 읽기 어려워진다.
// 그래서 배경(그라디언트·블롭)은 화면 전체를 채우되 콘텐츠만 이 폭으로 묶어 가운데 정렬한다.
// 폰에서는 화면이 이 값보다 좁으므로 아무것도 달라지지 않는다.

export const CONTENT_MAX_WIDTH = 600;

/// 콘텐츠가 실제로 차지하는 폭.
/// 그리드 칸 크기처럼 폭을 직접 계산하는 곳은 창 너비 대신 반드시 이 값을 써야
/// 태블릿에서 칸이 컨테이너 밖으로 삐져나가지 않는다.
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  return Math.min(width, CONTENT_MAX_WIDTH);
}

/// 배율 기준이 되는 폭 — 요즘 표준 폰(갤럭시 S 표준, 아이폰 15)의 대략치.
const BASE_WIDTH = 390;

/// 화면 크기에 따른 완만한 배율.
/// 폭에 정비례시키면 폴드 접힘(280)에서 글자가 읽기 힘들 만큼 작아지고
/// 태블릿에서는 우스꽝스럽게 커진다. 그래서 차이의 35%만 반영하고 상하한으로 묶는다.
///   280 → 0.90   360 → 0.97   390 → 1.00   430 → 1.04   600(태블릿) → 1.12
export function useDeviceScale(): number {
  const cw = useContentWidth();
  const raw = 1 + (cw / BASE_WIDTH - 1) * 0.35;
  return Math.max(0.9, Math.min(1.12, raw));
}

/// 고정 폭 팝오버가 좁은 기기에서 화면을 넘지 않도록 줄여준다.
/// (설정 패널 288px은 폴드 접힘 280dp에서 그대로 넘쳤다)
export function useFittedWidth(preferred: number, margin = 24): number {
  return Math.min(preferred, useContentWidth() - margin);
}
