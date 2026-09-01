// 웹 빌드에서 ads.ts 대신 쓰이는 스텁. Metro가 확장자로 골라간다.
//
// ads.ts는 require()로 react-native-google-mobile-ads를 부르고 Android가 아니면 건너뛴다.
// 런타임에는 안 실행되지만 Metro는 번들을 만들 때 require 대상을 정적으로 따라가고,
// 그 SDK가 네이티브 전용 모듈(codegenNativeComponent)을 참조해 웹 번들링이 실패한다.
// 여기서 API 모양만 같게 두면 웹 번들에 SDK가 아예 들어가지 않는다.
//
// 동작은 기존 웹 동작 그대로다 — 광고 없음, 동의 화면 없음.

export type AdConsentState = {
  available: boolean;
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
};

export function initAdConsent(): void {
  // 웹에는 광고 SDK가 없어 동의를 수집할 대상이 없다.
}

export async function showAdPrivacyOptions(): Promise<boolean> {
  // 열 수 있는 설정 화면이 없다. 호출부는 false를 받으면 안내 문구를 띄운다.
  return false;
}

export async function loadAndShowResultInterstitial(_callbacks: {
  onOpened: () => void;
  onClosed: () => void;
  onError: () => void;
  isCancelled?: () => boolean;
}): Promise<(() => void) | null> {
  // null을 돌려주면 결과 화면이 광고를 기다리지 않고 바로 진행한다.
  return null;
}
