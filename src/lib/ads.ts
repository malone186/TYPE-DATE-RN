import { Platform } from 'react-native';

type ConsentInfo = {
  canRequestAds: boolean;
  privacyOptionsRequirementStatus: string;
};

type AdsModule = {
  AdsConsent: {
    gatherConsent: () => Promise<ConsentInfo>;
    showPrivacyOptionsForm: () => Promise<ConsentInfo>;
  };
  AdEventType: {
    LOADED: string;
    OPENED: string;
    CLOSED: string;
    ERROR: string;
  };
  InterstitialAd: {
    createForAdRequest: (adUnitId: string) => {
      addAdEventListener: (event: string, listener: () => void) => () => void;
      load: () => void;
      show: () => Promise<void>;
    };
  };
  TestIds: { INTERSTITIAL: string };
};

export type AdConsentState = {
  available: boolean;
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
};

const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
const CONFIGURED_AD_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID;

let adsModule: AdsModule | null | undefined;
let consentPromise: Promise<AdConsentState> | null = null;

function loadAdsModule(): AdsModule | null {
  if (adsModule === undefined) {
    if (Platform.OS !== 'android') {
      adsModule = null;
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        adsModule = require('react-native-google-mobile-ads') as AdsModule;
      } catch {
        adsModule = null;
      }
    }
  }
  return adsModule;
}

function isProductionAdUnit(value: string | undefined): value is string {
  return (
    value != null &&
    /^ca-app-pub-\d{16}\/\d{10}$/.test(value) &&
    value !== 'ca-app-pub-3940256099942544/1033173712'
  );
}

function adUnitId(m: AdsModule): string | null {
  if (APP_ENV === 'production') return isProductionAdUnit(CONFIGURED_AD_UNIT_ID) ? CONFIGURED_AD_UNIT_ID : null;
  return m.TestIds.INTERSTITIAL;
}

async function gatherConsent(m: AdsModule): Promise<AdConsentState> {
  try {
    const info = await m.AdsConsent.gatherConsent();
    return {
      available: true,
      canRequestAds: info.canRequestAds === true,
      privacyOptionsRequired: info.privacyOptionsRequirementStatus === 'REQUIRED',
    };
  } catch {
    // SDK가 마지막으로 알고 있는 유효 상태를 읽을 API가 없는 경우 광고를 생략한다.
    return { available: true, canRequestAds: false, privacyOptionsRequired: false };
  }
}

export function initAdConsent(): void {
  if (consentPromise != null) return;
  const m = loadAdsModule();
  consentPromise = Promise.resolve(
    m == null ? { available: false, canRequestAds: false, privacyOptionsRequired: false } : gatherConsent(m),
  );
}

async function getConsent(m: AdsModule): Promise<AdConsentState> {
  if (consentPromise == null) consentPromise = gatherConsent(m);
  return consentPromise;
}

export async function showAdPrivacyOptions(): Promise<boolean> {
  const m = loadAdsModule();
  if (m == null) return false;
  try {
    await m.AdsConsent.showPrivacyOptionsForm();
    consentPromise = gatherConsent(m);
    return true;
  } catch {
    return false;
  }
}

export async function loadAndShowResultInterstitial(callbacks: {
  onOpened: () => void;
  onClosed: () => void;
  onError: () => void;
  isCancelled?: () => boolean;
}): Promise<(() => void) | null> {
  const m = loadAdsModule();
  if (m == null) return null;
  const consent = await getConsent(m);
  if (callbacks.isCancelled?.()) return null;
  const unitId = adUnitId(m);
  if (!consent.canRequestAds || unitId == null) return null;

  let cancelled = false;
  let settled = false;
  const ad = m.InterstitialAd.createForAdRequest(unitId);
  const removeListeners: Array<() => void> = [];
  const cleanup = () => {
    cancelled = true;
    while (removeListeners.length > 0) removeListeners.pop()?.();
  };
  const fail = () => {
    if (cancelled || settled) return;
    settled = true;
    cleanup();
    callbacks.onError();
  };

  removeListeners.push(
    ad.addAdEventListener(m.AdEventType.LOADED, () => {
      if (cancelled) return;
      void ad.show().catch(fail);
    }),
  );
  removeListeners.push(
    ad.addAdEventListener(m.AdEventType.OPENED, () => {
      if (cancelled || settled) return;
      callbacks.onOpened();
    }),
  );
  removeListeners.push(
    ad.addAdEventListener(m.AdEventType.CLOSED, () => {
      if (cancelled || settled) return;
      settled = true;
      cleanup();
      callbacks.onClosed();
    }),
  );
  removeListeners.push(ad.addAdEventListener(m.AdEventType.ERROR, fail));

  try {
    ad.load();
  } catch {
    fail();
  }
  return cleanup;
}
