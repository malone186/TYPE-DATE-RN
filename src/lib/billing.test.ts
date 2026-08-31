import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Purchase } from 'expo-iap';

const VERIFY_URL = 'https://project.supabase.co/functions/v1/verify-purchase';
process.env.EXPO_PUBLIC_VERIFY_PURCHASE_URL = VERIFY_URL;

type PurchaseListener = (purchase: Purchase) => void;

const doubles = vi.hoisted(() => {
  const state = {
    adRemoved: false,
    billingStatus: 'idle' as string,
    billingMessage: '',
    displayPrice: null as string | null,
    setBillingState: vi.fn((patch: Record<string, unknown>) => {
      if (typeof patch.status === 'string') state.billingStatus = patch.status;
      if (typeof patch.message === 'string') state.billingMessage = patch.message;
      if ('displayPrice' in patch) state.displayPrice = patch.displayPrice as string | null;
    }),
    setAdEntitlement: vi.fn((value: boolean) => {
      state.adRemoved = value;
    }),
  };
  return {
    state,
    track: vi.fn(),
    getAccessToken: vi.fn(async () => 'user-jwt' as string | null),
  };
});

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));
vi.mock('../state/store', () => ({ useStore: { getState: () => doubles.state } }));
vi.mock('../analytics/track', () => ({ track: doubles.track }));
vi.mock('./supabase', () => ({ getAccessToken: doubles.getAccessToken }));

function makeIap() {
  const listeners: { purchase: PurchaseListener[]; error: Array<(e: { code: string }) => void> } = {
    purchase: [],
    error: [],
  };
  return {
    listeners,
    initConnection: vi.fn(async () => true),
    endConnection: vi.fn(async () => true),
    fetchProducts: vi.fn(async () => [{ id: 'remove_ads', type: 'in-app', displayPrice: '₩2,200' }]),
    getAvailablePurchases: vi.fn(async () => [] as Purchase[]),
    finishTransaction: vi.fn(async () => undefined),
    restorePurchases: vi.fn(async () => undefined),
    requestPurchase: vi.fn(async () => undefined),
    purchaseUpdatedListener: vi.fn((cb: PurchaseListener) => {
      listeners.purchase.push(cb);
      return { remove: vi.fn() };
    }),
    purchaseErrorListener: vi.fn((cb: (e: { code: string }) => void) => {
      listeners.error.push(cb);
      return { remove: vi.fn() };
    }),
  };
}

type Iap = ReturnType<typeof makeIap>;
type Billing = typeof import('./billing');

function ownedPurchase(token = 'token-1'): Purchase {
  return {
    id: token,
    productId: 'remove_ads',
    purchaseToken: token,
    purchaseState: 'purchased',
    transactionId: 'GPA.1',
  } as unknown as Purchase;
}

// A Response body can only be read once, so every stubbed answer is built fresh per call.
function verifyResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      verified: true,
      entitled: true,
      isTest: false,
      status: 'purchased',
      acknowledged: true,
      retryRequired: false,
      ...overrides,
    }),
    { status: 200 },
  );
}

let iap: Iap;
let fetchMock: ReturnType<typeof vi.fn>;

function verifyCalls(): number {
  return fetchMock.mock.calls.filter((call) => String(call[0]) === VERIFY_URL).length;
}

// billing.ts pulls the native module in with require() so it can degrade on Expo Go and web.
// The test runner resolves that to the real package, which is not loadable here, so the double is
// seeded into the Node module cache under the same resolved path.
const nodeRequire = createRequire(import.meta.url);
const iapModulePath = nodeRequire.resolve('expo-iap');

function installIapDouble() {
  nodeRequire.cache[iapModulePath] = {
    id: iapModulePath,
    filename: iapModulePath,
    loaded: true,
    exports: iap,
  } as unknown as NodeJS.Module;
}

async function loadBilling(): Promise<Billing> {
  vi.resetModules();
  installIapDouble();
  return import('./billing');
}

// restoreRemoveAds also runs initialization, which reconciles once on its own. Tests that count
// server calls for a single purchase drive the store listener instead, which maps to exactly one
// processPurchase pass.
async function purchaseListener(billing: Billing): Promise<PurchaseListener> {
  billing.initBilling();
  await vi.waitFor(() => expect(iap.listeners.purchase.length).toBeGreaterThan(0));
  return iap.listeners.purchase[0];
}

beforeEach(() => {
  iap = makeIap();
  process.env.EXPO_PUBLIC_VERIFY_PURCHASE_URL = VERIFY_URL;
  doubles.state.adRemoved = false;
  doubles.state.billingStatus = 'idle';
  doubles.state.billingMessage = '';
  doubles.state.setBillingState.mockClear();
  doubles.state.setAdEntitlement.mockClear();
  doubles.track.mockClear();
  doubles.getAccessToken.mockClear();
  doubles.getAccessToken.mockResolvedValue('user-jwt');
  fetchMock = vi.fn(async () => verifyResponse());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete nodeRequire.cache[iapModulePath];
});

describe('server verification gates the entitlement', () => {
  it('grants the entitlement and finishes the transaction once the server verifies it', async () => {
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    const billing = await loadBilling();

    await expect(billing.restoreRemoveAds()).resolves.toBe('owned');
    expect(doubles.state.setAdEntitlement).toHaveBeenCalledWith(true);
    expect(iap.finishTransaction).toHaveBeenCalledWith({
      purchase: expect.objectContaining({ purchaseToken: 'token-1' }),
      isConsumable: false,
    });
  });

  it('never finishes the transaction when the verify server is unreachable', async () => {
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    fetchMock.mockRejectedValue(new Error('network down'));
    const billing = await loadBilling();

    await expect(billing.restoreRemoveAds()).resolves.toBe('error');
    expect(doubles.state.setAdEntitlement).not.toHaveBeenCalledWith(true);
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });

  it('never grants the entitlement on a non-OK verify response', async () => {
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    fetchMock.mockImplementation(async () => new Response('{}', { status: 500 }));
    const billing = await loadBilling();

    await expect(billing.restoreRemoveAds()).resolves.toBe('error');
    expect(doubles.state.setAdEntitlement).not.toHaveBeenCalledWith(true);
  });

  it('rejects a verify response whose shape does not match the contract', async () => {
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    // A forged or truncated body must not be read as an entitlement.
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ entitled: true }), { status: 200 }),
    );
    const billing = await loadBilling();

    await expect(billing.restoreRemoveAds()).resolves.toBe('error');
    expect(doubles.state.setAdEntitlement).not.toHaveBeenCalledWith(true);
  });

  it('does not escape as a rejection when the session lookup throws', async () => {
    // 세션 확보가 던지면 예외가 processPurchase를 지나 구매 리스너까지 올라가
    // 구매가 조용히 처리되지 않는 상태가 된다. 여기서 흡수해야 한다.
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    doubles.getAccessToken.mockRejectedValue(new Error('storage unavailable'));
    const billing = await loadBilling();

    await expect(billing.restoreRemoveAds()).resolves.toBe('error');
    expect(verifyCalls()).toBe(0);
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });

  it('does not call the server without a signed-in access token', async () => {
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    doubles.getAccessToken.mockResolvedValue(null);
    const billing = await loadBilling();

    await expect(billing.restoreRemoveAds()).resolves.toBe('error');
    expect(verifyCalls()).toBe(0);
  });

  it('sends the purchase token as a bearer-authenticated POST', async () => {
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    const billing = await loadBilling();
    await billing.restoreRemoveAds();

    const [url, init] = fetchMock.mock.calls.find((call) => String(call[0]) === VERIFY_URL)!;
    expect(url).toBe(VERIFY_URL);
    const request = init as RequestInit;
    expect(request.method).toBe('POST');
    expect((request.headers as Record<string, string>).Authorization).toBe('Bearer user-jwt');
    expect(JSON.parse(String(request.body))).toEqual({
      platform: 'android',
      productId: 'remove_ads',
      packageName: 'com.typedate.app',
      purchaseToken: 'token-1',
    });
  });

  it('revokes the entitlement when the server reports a refund', async () => {
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    fetchMock.mockImplementation(async () => verifyResponse({ entitled: false, status: 'refunded' }));
    const billing = await loadBilling();

    await expect(billing.restoreRemoveAds()).resolves.toBe('none');
    expect(doubles.state.setAdEntitlement).toHaveBeenCalledWith(false);
    expect(doubles.state.adRemoved).toBe(false);
  });

  it('revokes the entitlement when no purchase is on the account', async () => {
    iap.getAvailablePurchases.mockResolvedValue([]);
    const billing = await loadBilling();

    await expect(billing.restoreRemoveAds()).resolves.toBe('none');
    expect(doubles.state.setAdEntitlement).toHaveBeenCalledWith(false);
  });

  it('keeps a pending purchase out of the entitlement', async () => {
    iap.getAvailablePurchases.mockResolvedValue([
      { ...ownedPurchase(), purchaseState: 'pending' } as unknown as Purchase,
    ]);
    const billing = await loadBilling();

    await expect(billing.restoreRemoveAds()).resolves.toBe('pending');
    expect(verifyCalls()).toBe(0);
    expect(doubles.state.setAdEntitlement).not.toHaveBeenCalledWith(true);
  });

  it('ignores purchases of other products', async () => {
    iap.getAvailablePurchases.mockResolvedValue([
      { ...ownedPurchase(), productId: 'something_else' } as unknown as Purchase,
    ]);
    const billing = await loadBilling();

    await expect(billing.restoreRemoveAds()).resolves.toBe('none');
    expect(verifyCalls()).toBe(0);
  });
});

describe('acknowledgement retry', () => {
  it('re-verifies once when the server could not acknowledge the purchase', async () => {
    fetchMock
      .mockImplementationOnce(async () => verifyResponse({ acknowledged: false, retryRequired: true }))
      .mockImplementation(async () => verifyResponse());
    const billing = await loadBilling();
    const notify = await purchaseListener(billing);

    notify(ownedPurchase());
    await vi.waitFor(() => expect(doubles.state.billingStatus).toBe('owned'));

    // The retry runs after finishTransaction, so the ledger sees the acknowledged purchase.
    expect(verifyCalls()).toBe(2);
    expect(iap.finishTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not re-verify when the server already acknowledged the purchase', async () => {
    const billing = await loadBilling();
    const notify = await purchaseListener(billing);

    notify(ownedPurchase());
    await vi.waitFor(() => expect(doubles.state.billingStatus).toBe('owned'));

    expect(verifyCalls()).toBe(1);
  });

  it('keeps the entitlement when the retry itself fails', async () => {
    fetchMock
      .mockImplementationOnce(async () => verifyResponse({ acknowledged: false, retryRequired: true }))
      .mockRejectedValue(new Error('network down'));
    const billing = await loadBilling();
    const notify = await purchaseListener(billing);

    notify(ownedPurchase());
    await vi.waitFor(() => expect(doubles.state.billingStatus).toBe('owned'));

    expect(doubles.state.adRemoved).toBe(true);
  });
});

describe('duplicate and concurrent work', () => {
  it('verifies a purchase once when the store reports it twice at the same time', async () => {
    const billing = await loadBilling();
    const notify = await purchaseListener(billing);

    const purchase = ownedPurchase();
    notify(purchase);
    notify(purchase);
    await vi.waitFor(() => expect(iap.finishTransaction).toHaveBeenCalled());

    expect(verifyCalls()).toBe(1);
    expect(iap.finishTransaction).toHaveBeenCalledTimes(1);
  });

  it('runs a single reconcile pass when restore is called concurrently', async () => {
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    const billing = await loadBilling();
    await billing.restoreRemoveAds();
    const settled = verifyCalls();

    const [first, second] = await Promise.all([
      billing.restoreRemoveAds(),
      billing.restoreRemoveAds(),
    ]);

    expect(first).toBe('owned');
    expect(second).toBe('owned');
    expect(verifyCalls() - settled).toBe(1);
  });

  it('releases the per-purchase lock so a failed verification can be retried', async () => {
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    fetchMock.mockRejectedValue(new Error('network down'));
    const billing = await loadBilling();

    await expect(billing.restoreRemoveAds()).resolves.toBe('error');

    fetchMock.mockImplementation(async () => verifyResponse());
    await expect(billing.restoreRemoveAds()).resolves.toBe('owned');
    expect(doubles.state.adRemoved).toBe(true);
  });

  it('reports one purchase event even after the store replays it', async () => {
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    const billing = await loadBilling();

    await billing.restoreRemoveAds();
    await billing.restoreRemoveAds();

    expect(doubles.track).toHaveBeenCalledTimes(1);
    expect(doubles.track).toHaveBeenCalledWith('remove_ads', {
      props: { product_id: 'remove_ads', source: 'restore' },
    });
  });

  it('tags a test purchase so it can be split out of revenue', async () => {
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    fetchMock.mockImplementation(async () => verifyResponse({ isTest: true }));
    const billing = await loadBilling();
    await billing.restoreRemoveAds();

    expect(doubles.track).toHaveBeenCalledWith('remove_ads', {
      props: { product_id: 'remove_ads', source: 'test' },
    });
  });
});

describe('connection failures', () => {
  it('recovers on the next attempt after the store connection fails', async () => {
    iap.initConnection.mockRejectedValue(new Error('billing unavailable'));
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    const billing = await loadBilling();

    await expect(billing.restoreRemoveAds()).resolves.toBe('error');

    iap.initConnection.mockResolvedValue(true);
    await expect(billing.restoreRemoveAds()).resolves.toBe('owned');
  });

  it('reports an error instead of finishing when the transaction cannot be closed', async () => {
    iap.getAvailablePurchases.mockResolvedValue([ownedPurchase()]);
    iap.finishTransaction.mockRejectedValue(new Error('finish failed'));
    const billing = await loadBilling();

    await expect(billing.restoreRemoveAds()).resolves.toBe('error');
    expect(doubles.state.billingMessage).toContain('마무리되지 않았습니다');
  });

  it('refuses to start a purchase when no verify server is configured', async () => {
    vi.resetModules();
    delete process.env.EXPO_PUBLIC_VERIFY_PURCHASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    installIapDouble();
    const billing = await import('./billing');

    await expect(billing.buyRemoveAds()).resolves.toBe(false);
    expect(iap.requestPurchase).not.toHaveBeenCalled();
  });

  it('opens the store purchase flow once the product is loaded', async () => {
    const billing = await loadBilling();

    await expect(billing.buyRemoveAds()).resolves.toBe(true);
    expect(iap.requestPurchase).toHaveBeenCalledWith({
      request: { google: { skus: ['remove_ads'] } },
      type: 'in-app',
    });
  });
});
