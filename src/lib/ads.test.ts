import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_UNIT_ID = 'ca-app-pub-3940256099942544/1033173712';
const REAL_UNIT_ID = 'ca-app-pub-1234567890123456/1234567890';

type Listener = () => void;

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

function makeAdsSdk() {
  const listeners: Record<string, Listener[]> = {};
  const ad = {
    addAdEventListener: vi.fn((event: string, listener: Listener) => {
      (listeners[event] ??= []).push(listener);
      return () => {
        listeners[event] = (listeners[event] ?? []).filter((l) => l !== listener);
      };
    }),
    load: vi.fn(),
    show: vi.fn(async () => undefined),
  };
  return {
    listeners,
    ad,
    emit(event: string) {
      for (const listener of [...(listeners[event] ?? [])]) listener();
    },
    listenerCount() {
      return Object.values(listeners).reduce((sum, l) => sum + l.length, 0);
    },
    AdsConsent: {
      gatherConsent: vi.fn(async () => ({
        canRequestAds: true,
        privacyOptionsRequirementStatus: 'REQUIRED',
      })),
      showPrivacyOptionsForm: vi.fn(async () => ({
        canRequestAds: true,
        privacyOptionsRequirementStatus: 'REQUIRED',
      })),
    },
    AdEventType: { LOADED: 'loaded', OPENED: 'opened', CLOSED: 'closed', ERROR: 'error' },
    InterstitialAd: { createForAdRequest: vi.fn(() => ad) },
    TestIds: { INTERSTITIAL: TEST_UNIT_ID },
  };
}

type AdsSdk = ReturnType<typeof makeAdsSdk>;

let sdk: AdsSdk;

// ads.ts requires the native module so the app still runs on Expo Go and web. The test runner
// resolves that to the real package, so the double is seeded under the same resolved path.
const nodeRequire = createRequire(import.meta.url);
const adsModulePath = nodeRequire.resolve('react-native-google-mobile-ads');

async function loadAds(options: { appEnv?: string; unitId?: string } = {}) {
  vi.resetModules();
  if (options.appEnv == null) delete process.env.EXPO_PUBLIC_APP_ENV;
  else process.env.EXPO_PUBLIC_APP_ENV = options.appEnv;
  if (options.unitId == null) delete process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID;
  else process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID = options.unitId;

  nodeRequire.cache[adsModulePath] = {
    id: adsModulePath,
    filename: adsModulePath,
    loaded: true,
    exports: sdk,
  } as unknown as NodeJS.Module;

  return import('./ads');
}

function callbacks() {
  return { onOpened: vi.fn(), onClosed: vi.fn(), onError: vi.fn() };
}

beforeEach(() => {
  sdk = makeAdsSdk();
});

afterEach(() => {
  delete nodeRequire.cache[adsModulePath];
  delete process.env.EXPO_PUBLIC_APP_ENV;
  delete process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID;
});

describe('ad unit selection', () => {
  it('uses the SDK test unit outside production', async () => {
    const ads = await loadAds({ appEnv: 'preview' });
    await ads.loadAndShowResultInterstitial(callbacks());

    expect(sdk.InterstitialAd.createForAdRequest).toHaveBeenCalledWith(TEST_UNIT_ID);
  });

  it('uses the configured unit in production', async () => {
    const ads = await loadAds({ appEnv: 'production', unitId: REAL_UNIT_ID });
    await ads.loadAndShowResultInterstitial(callbacks());

    expect(sdk.InterstitialAd.createForAdRequest).toHaveBeenCalledWith(REAL_UNIT_ID);
  });

  it('requests no ad when production is left on the public test unit', async () => {
    // Serving Google's sample unit in production earns no revenue and violates AdMob policy.
    const ads = await loadAds({ appEnv: 'production', unitId: TEST_UNIT_ID });
    const result = await ads.loadAndShowResultInterstitial(callbacks());

    expect(sdk.InterstitialAd.createForAdRequest).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('requests no ad when production has no unit configured', async () => {
    const ads = await loadAds({ appEnv: 'production' });
    const result = await ads.loadAndShowResultInterstitial(callbacks());

    expect(sdk.InterstitialAd.createForAdRequest).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

describe('consent gates the request', () => {
  it('requests no ad when consent withholds ad serving', async () => {
    sdk.AdsConsent.gatherConsent.mockResolvedValue({
      canRequestAds: false,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });
    const ads = await loadAds({ appEnv: 'preview' });
    const result = await ads.loadAndShowResultInterstitial(callbacks());

    expect(sdk.InterstitialAd.createForAdRequest).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('requests no ad when the consent form itself fails', async () => {
    sdk.AdsConsent.gatherConsent.mockRejectedValue(new Error('consent unavailable'));
    const ads = await loadAds({ appEnv: 'preview' });
    const result = await ads.loadAndShowResultInterstitial(callbacks());

    expect(sdk.InterstitialAd.createForAdRequest).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('gathers consent once no matter how many screens ask', async () => {
    const ads = await loadAds({ appEnv: 'preview' });
    ads.initAdConsent();
    await ads.loadAndShowResultInterstitial(callbacks());
    await ads.loadAndShowResultInterstitial(callbacks());

    expect(sdk.AdsConsent.gatherConsent).toHaveBeenCalledTimes(1);
  });

  it('re-reads consent after the privacy options form is shown', async () => {
    const ads = await loadAds({ appEnv: 'preview' });
    ads.initAdConsent();

    await expect(ads.showAdPrivacyOptions()).resolves.toBe(true);
    expect(sdk.AdsConsent.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
    expect(sdk.AdsConsent.gatherConsent).toHaveBeenCalledTimes(2);
  });

  it('reports failure when the privacy options form cannot open', async () => {
    sdk.AdsConsent.showPrivacyOptionsForm.mockRejectedValue(new Error('not available'));
    const ads = await loadAds({ appEnv: 'preview' });

    await expect(ads.showAdPrivacyOptions()).resolves.toBe(false);
  });
});

describe('one show, one result', () => {
  it('shows the ad as soon as it loads', async () => {
    const ads = await loadAds({ appEnv: 'preview' });
    await ads.loadAndShowResultInterstitial(callbacks());

    sdk.emit('loaded');
    expect(sdk.ad.show).toHaveBeenCalledTimes(1);
  });

  it('stops forwarding opened once the ad has closed', async () => {
    const cb = callbacks();
    const ads = await loadAds({ appEnv: 'preview' });
    await ads.loadAndShowResultInterstitial(cb);

    sdk.emit('opened');
    sdk.emit('closed');
    sdk.emit('opened');

    // This module forwards every live opened event; AdInterstitialScreen holds the once-per-screen
    // guard that keeps the ad_shown metric at one. What is guaranteed here is that nothing fires
    // after the ad settles.
    expect(cb.onOpened).toHaveBeenCalledTimes(1);
  });

  it('continues exactly once when the ad closes', async () => {
    const cb = callbacks();
    const ads = await loadAds({ appEnv: 'preview' });
    await ads.loadAndShowResultInterstitial(cb);

    sdk.emit('opened');
    sdk.emit('closed');
    sdk.emit('closed');

    expect(cb.onClosed).toHaveBeenCalledTimes(1);
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it('does not report an error after the ad already closed', async () => {
    const cb = callbacks();
    const ads = await loadAds({ appEnv: 'preview' });
    await ads.loadAndShowResultInterstitial(cb);

    sdk.emit('closed');
    sdk.emit('error');

    expect(cb.onClosed).toHaveBeenCalledTimes(1);
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it('continues once on a no-fill or load error', async () => {
    const cb = callbacks();
    const ads = await loadAds({ appEnv: 'preview' });
    await ads.loadAndShowResultInterstitial(cb);

    sdk.emit('error');
    sdk.emit('error');

    expect(cb.onError).toHaveBeenCalledTimes(1);
    expect(cb.onClosed).not.toHaveBeenCalled();
  });

  it('continues when the ad loads but cannot be shown', async () => {
    const cb = callbacks();
    sdk.ad.show.mockRejectedValue(new Error('show failed'));
    const ads = await loadAds({ appEnv: 'preview' });
    await ads.loadAndShowResultInterstitial(cb);

    sdk.emit('loaded');
    await vi.waitFor(() => expect(cb.onError).toHaveBeenCalledTimes(1));
  });

  it('continues when the load call throws synchronously', async () => {
    const cb = callbacks();
    sdk.ad.load.mockImplementation(() => {
      throw new Error('sdk not initialised');
    });
    const ads = await loadAds({ appEnv: 'preview' });
    await ads.loadAndShowResultInterstitial(cb);

    expect(cb.onError).toHaveBeenCalledTimes(1);
  });
});

describe('leaving the screen', () => {
  it('drops every listener when the caller cleans up', async () => {
    const ads = await loadAds({ appEnv: 'preview' });
    const cleanup = await ads.loadAndShowResultInterstitial(callbacks());

    expect(sdk.listenerCount()).toBeGreaterThan(0);
    cleanup?.();
    expect(sdk.listenerCount()).toBe(0);
  });

  it('fires no callback for an ad that arrives after cleanup', async () => {
    const cb = callbacks();
    const ads = await loadAds({ appEnv: 'preview' });
    const cleanup = await ads.loadAndShowResultInterstitial(cb);

    cleanup?.();
    sdk.emit('loaded');
    sdk.emit('opened');
    sdk.emit('closed');
    sdk.emit('error');

    expect(sdk.ad.show).not.toHaveBeenCalled();
    expect(cb.onOpened).not.toHaveBeenCalled();
    expect(cb.onClosed).not.toHaveBeenCalled();
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it('never requests an ad for a screen the user already left', async () => {
    const ads = await loadAds({ appEnv: 'preview' });
    const result = await ads.loadAndShowResultInterstitial({
      ...callbacks(),
      isCancelled: () => true,
    });

    expect(sdk.InterstitialAd.createForAdRequest).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
