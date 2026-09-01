import { AppState, Platform } from 'react-native';
import type { Product, Purchase } from 'expo-iap';
import { useStore } from '../state/store';
import { track } from '../analytics/track';
import { getAccessToken } from './supabase';
import type { BillingStatus } from '../state/store';

// 광고 제거 인앱 결제의 유일한 경계.
// 네이티브 스토어 결과 → 서버 검증 → entitlement 반영 → 거래 완료 순서만 허용한다.

export const REMOVE_ADS_SKU = 'remove_ads';
export const billingSupported = Platform.OS === 'android';

const PACKAGE_NAME = 'com.jinnstudio.typedate';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const VERIFY_URL =
  process.env.EXPO_PUBLIC_VERIFY_PURCHASE_URL ??
  (SUPABASE_URL == null ? null : `${SUPABASE_URL}/functions/v1/verify-purchase`);

type IapModule = typeof import('expo-iap');
type PurchaseSource = 'purchase' | 'restore';
type ProcessResult = 'owned' | 'pending' | 'none' | 'error';

interface VerifyResponse {
  verified: boolean;
  entitled: boolean;
  isTest: boolean;
  status: 'purchased' | 'pending' | 'cancelled' | 'refunded' | 'not_owned' | 'unknown';
  // 서버가 Google 승인에 실패해 장부가 pending으로 남았을 때만 true.
  retryRequired: boolean;
}

let iapModule: IapModule | null | undefined;
let connecting: Promise<IapModule | null> | null = null;
let initPromise: Promise<void> | null = null;
let purchaseUpdatedSubscription: { remove: () => void } | null = null;
let purchaseErrorSubscription: { remove: () => void } | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let currentProduct: Product | null = null;
let reconcilePromise: Promise<ProcessResult> | null = null;
const processingPurchases = new Set<string>();

function setBillingState(status: BillingStatus, message = '') {
  useStore.getState().setBillingState({ status, message });
}

function loadIap(): IapModule | null {
  if (iapModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      iapModule = billingSupported ? (require('expo-iap') as IapModule) : null;
    } catch {
      // Expo Go·웹처럼 네이티브 모듈이 없는 환경에서는 결제만 비활성화한다.
      iapModule = null;
    }
  }
  return iapModule;
}

function connect(): Promise<IapModule | null> {
  if (connecting == null) {
    connecting = (async () => {
      const m = loadIap();
      if (m == null) return null;
      try {
        await m.initConnection();
        return m;
      } catch {
        connecting = null;
        return null;
      }
    })();
  }
  return connecting;
}

function isRemoveAds(purchase: Purchase): boolean {
  return purchase.productId === REMOVE_ADS_SKU;
}

function purchaseKey(purchase: Purchase): string {
  return purchase.purchaseToken ?? purchase.transactionId ?? purchase.id;
}

async function fetchProduct(m: IapModule): Promise<Product | null> {
  try {
    const products = await m.fetchProducts({ skus: [REMOVE_ADS_SKU], type: 'in-app' });
    const found = products?.find((item) => item.id === REMOVE_ADS_SKU) ?? null;
    const product = found != null && found.type === 'in-app' ? (found as Product) : null;
    currentProduct = product;
    useStore.getState().setBillingState({ displayPrice: product?.displayPrice ?? null });
    return product;
  } catch {
    currentProduct = null;
    useStore.getState().setBillingState({ displayPrice: null });
    return null;
  }
}

async function verifyOnServer(purchase: Purchase): Promise<VerifyResponse | null> {
  if (VERIFY_URL == null || purchase.purchaseToken == null) return null;

  try {
    // 세션 확보도 try 안에서 한다. 밖에 두면 던져진 예외가 processPurchase를 지나
    // 구매 리스너까지 올라가 구매가 조용히 처리되지 않는다.
    const accessToken = await getAccessToken();
    if (accessToken == null) return null;
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        platform: 'android',
        productId: REMOVE_ADS_SKU,
        packageName: PACKAGE_NAME,
        purchaseToken: purchase.purchaseToken,
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as Partial<VerifyResponse>;
    if (
      typeof body.verified !== 'boolean' ||
      typeof body.entitled !== 'boolean' ||
      typeof body.isTest !== 'boolean' ||
      typeof body.status !== 'string'
    ) {
      return null;
    }
    return {
      verified: body.verified,
      entitled: body.entitled,
      isTest: body.isTest,
      status: body.status as VerifyResponse['status'],
      retryRequired: body.retryRequired === true,
    };
  } catch {
    return null;
  }
}

async function processPurchase(purchase: Purchase, source: PurchaseSource): Promise<ProcessResult> {
  if (!isRemoveAds(purchase)) return 'none';

  if (purchase.purchaseState === 'pending') {
    setBillingState('pending', '결제가 완료되면 광고 제거가 적용됩니다.');
    return 'pending';
  }
  if (purchase.purchaseState !== 'purchased') {
    setBillingState('error', '구매 상태를 확인하지 못했습니다. 다시 시도해 주세요.');
    return 'error';
  }
  if ('isSuspendedAndroid' in purchase && purchase.isSuspendedAndroid === true) {
    setBillingState('error', '결제 상태를 확인할 수 없습니다. Google Play에서 결제 수단을 확인해 주세요.');
    return 'error';
  }

  const key = purchaseKey(purchase);
  if (processingPurchases.has(key)) return 'pending';
  processingPurchases.add(key);
  setBillingState('verifying', '구매를 확인하는 중…');

  try {
    const verification = await verifyOnServer(purchase);
    if (verification == null) {
      setBillingState('error', '구매 확인 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      return 'error';
    }
    if (!verification.verified || !verification.entitled) {
      if (verification.status === 'cancelled' || verification.status === 'refunded') {
        useStore.getState().setAdEntitlement(false);
        setBillingState('ready', '구매 권한이 없습니다.');
        return 'none';
      }
      setBillingState('error', '구매를 확인하지 못했습니다. 광고 제거가 적용되지 않았습니다.');
      return 'error';
    }

    const wasOwned = useStore.getState().adRemoved;
    useStore.getState().setAdEntitlement(true);

    // 서버 검증 이후에만 플랫폼 거래를 완료한다. 실패하면 다음 실행에서 재시도한다.
    try {
      const m = await connect();
      if (m == null) throw new Error('billing_unavailable');
      await m.finishTransaction({ purchase, isConsumable: false });
    } catch {
      setBillingState('error', '구매는 확인됐지만 마무리되지 않았습니다. 다음 실행에서 다시 시도합니다.');
      return 'error';
    }

    // 서버 승인이 실패하면 장부는 pending으로 남는다. 서버에는 토큰 해시만 있어 스스로 재시도할 수 없으므로,
    // 원본 토큰을 가진 클라이언트가 승인 직후 한 번만 재검증한다. 실패해도 권한에는 영향이 없고
    // 다음 foreground 조회가 다시 시도한다.
    if (verification.retryRequired) {
      await verifyOnServer(purchase);
    }

    if (!wasOwned) {
      track('remove_ads', {
        props: {
          product_id: REMOVE_ADS_SKU,
          source: verification.isTest ? 'test' : source,
        },
      });
    }
    setBillingState('owned', '광고가 제거되었습니다.');
    return 'owned';
  } finally {
    processingPurchases.delete(key);
  }
}

async function reconcilePurchases(m: IapModule): Promise<ProcessResult> {
  if (reconcilePromise != null) return reconcilePromise;
  reconcilePromise = (async () => {
    setBillingState('checking', '구매 상태를 확인하는 중…');
    try {
      const purchases = await m.getAvailablePurchases();
      const owned = purchases.find(
        (purchase) => isRemoveAds(purchase) && purchase.purchaseState === 'purchased',
      );
      if (owned != null) return processPurchase(owned, 'restore');

      const pending = purchases.find(
        (purchase) => isRemoveAds(purchase) && purchase.purchaseState === 'pending',
      );
      if (pending != null) return processPurchase(pending, 'restore');

      useStore.getState().setAdEntitlement(false);
      setBillingState('ready', '구매한 상품이 없습니다.');
      return 'none';
    } catch {
      setBillingState('error', '구매 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      return 'error';
    } finally {
      reconcilePromise = null;
    }
  })();
  return reconcilePromise;
}

function installListeners(m: IapModule) {
  if (purchaseUpdatedSubscription == null) {
    purchaseUpdatedSubscription = m.purchaseUpdatedListener((purchase) => {
      if (!isRemoveAds(purchase)) return;
      void processPurchase(purchase, 'purchase').catch(() => {
        setBillingState('error', '구매를 처리하지 못했습니다. 다시 시도해 주세요.');
      });
    });
  }
  if (purchaseErrorSubscription == null) {
    purchaseErrorSubscription = m.purchaseErrorListener((error) => {
      if (error.code === 'user-cancelled') {
        setBillingState(useStore.getState().adRemoved ? 'owned' : 'ready', '');
      } else {
        setBillingState('error', '결제를 시작하지 못했습니다. 다시 시도해 주세요.');
      }
    });
  }
}

async function initialize() {
  if (!billingSupported) {
    setBillingState('error', '이 환경에서는 인앱 결제를 사용할 수 없습니다.');
    return;
  }

  const m = await connect();
  if (m == null) {
    setBillingState('error', '결제 서비스를 사용할 수 없습니다. Play 스토어 앱에서 다시 시도해 주세요.');
    return;
  }

  installListeners(m);
  const product = await fetchProduct(m);
  await reconcilePurchases(m);
  if (product == null && !useStore.getState().adRemoved) {
    setBillingState('error', '상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  appStateSubscription ??= AppState.addEventListener('change', (state) => {
    if (state === 'active') void reconcilePurchases(m);
  });
}

/// 앱 시작 시 결제 연결·상품 조회·리스너·복원을 한 번만 초기화한다.
export function initBilling(): void {
  if (initPromise == null) initPromise = initialize();
}

/// 설정 화면의 명시적 구매 복원.
export async function restoreRemoveAds(): Promise<ProcessResult> {
  initBilling();
  await initPromise;
  const m = await connect();
  if (m == null) {
    setBillingState('error', '결제 서비스를 사용할 수 없습니다.');
    return 'error';
  }
  try {
    await m.restorePurchases();
  } catch {
    // Android는 getAvailablePurchases가 복원 조회 역할을 하므로 아래 조회를 계속한다.
  }
  return reconcilePurchases(m);
}

/// 구매 요청의 반환값은 최종 결과가 아니다. 실제 결과는 listener에서 처리한다.
export async function buyRemoveAds(): Promise<boolean> {
  if (!billingSupported || VERIFY_URL == null) {
    setBillingState('error', '구매 확인 서버가 준비되지 않았습니다.');
    return false;
  }
  initBilling();
  await initPromise;
  const m = await connect();
  if (m == null) {
    setBillingState('error', '결제 서비스를 사용할 수 없습니다.');
    return false;
  }
  if (useStore.getState().billingStatus === 'purchasing') return false;
  if (currentProduct == null) currentProduct = await fetchProduct(m);
  if (currentProduct == null) {
    setBillingState('error', '상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return false;
  }

  setBillingState('purchasing', '결제 창을 여는 중…');
  try {
    await m.requestPurchase({
      request: { google: { skus: [REMOVE_ADS_SKU] } },
      type: 'in-app',
    });
    return true;
  } catch {
    setBillingState('error', '결제를 시작하지 못했습니다. 다시 시도해 주세요.');
    return false;
  }
}

/// 앱 종료·개발 중 재초기화 때 리스너와 연결을 해제한다.
export async function disposeBilling(): Promise<void> {
  purchaseUpdatedSubscription?.remove();
  purchaseErrorSubscription?.remove();
  appStateSubscription?.remove();
  purchaseUpdatedSubscription = null;
  purchaseErrorSubscription = null;
  appStateSubscription = null;
  const m = iapModule;
  initPromise = null;
  connecting = null;
  currentProduct = null;
  if (m != null) {
    try {
      await m.endConnection();
    } catch {
      // 정리 실패는 앱 종료를 막지 않는다.
    }
  }
  iapModule = undefined;
}
