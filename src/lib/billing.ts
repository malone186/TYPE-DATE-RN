import { Platform } from 'react-native';
import type { Purchase } from 'expo-iap';
import { useStore } from '../state/store';
import { track } from '../analytics/track';

// 광고 제거 인앱 결제 (Google Play Billing / StoreKit).
//
// 이 파일이 결제의 유일한 경계다. 화면은 buyRemoveAds()만 부르고, 구매 성공 판정은
// 여기서만 내린다 — 버튼이 직접 removeAds()를 켜면 결제 없이 유료 기능이 열린다.
//
// 결제는 네이티브 모듈이라 웹·Expo Go에서는 동작하지 않는다. 그 환경에서도 앱이
// 그대로 돌아가야 하므로 모듈을 정적 import하지 않고 여기서만 지연 로딩한다.

/// 스토어에 등록할 상품 ID — Play Console·App Store Connect의 상품 ID와 반드시 같아야 한다.
export const REMOVE_ADS_SKU = 'remove_ads';

/// 광고 제거 가격(원) — 버튼 문구와 수익 집계가 같은 값을 보게 한 곳에 둔다.
/// 실제 청구액은 스토어에 등록한 가격이며, 이 값은 표시·집계용이다.
export const AD_REMOVE_PRICE = 2200;

export const billingSupported = Platform.OS === 'ios' || Platform.OS === 'android';

type IapModule = typeof import('expo-iap');

let iapModule: IapModule | null | undefined;

/// 네이티브 모듈을 한 번만 불러온다. 지원하지 않는 환경이면 null.
function iap(): IapModule | null {
  if (iapModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      iapModule = billingSupported ? (require('expo-iap') as IapModule) : null;
    } catch {
      // Expo Go처럼 네이티브 모듈이 빠진 빌드 — 결제만 비활성화하고 앱은 계속 돈다.
      iapModule = null;
    }
  }
  return iapModule;
}

let connecting: Promise<IapModule | null> | null = null;

/// 스토어 연결을 보장한다. 실패하면 null.
function connect(): Promise<IapModule | null> {
  if (connecting == null) {
    connecting = (async () => {
      const m = iap();
      if (m == null) return null;
      try {
        await m.initConnection();
        return m;
      } catch {
        // 다음 시도에서 다시 붙어볼 수 있게 캐시를 비운다.
        connecting = null;
        return null;
      }
    })();
  }
  return connecting;
}

const isRemoveAds = (p: Purchase) => p.productId === REMOVE_ADS_SKU;

/// 구매 확정 — 여기가 유료 기능이 열리는 유일한 지점이다.
/// Android는 3일 안에 finishTransaction을 부르지 않으면 구글이 자동 환불한다.
async function grantRemoveAds(m: IapModule, purchase: Purchase, source: 'purchase' | 'restore') {
  try {
    await m.finishTransaction({ purchase, isConsumable: false });
  } catch {
    // 확정에 실패해도 이미 결제된 건이므로 기능은 열어준다. 다음 실행에서 다시 확정된다.
  }
  if (useStore.getState().adRemoved) return; // 이미 열려 있으면 집계를 중복해 남기지 않는다
  useStore.getState().removeAds();
  // 결제가 실제로 성공한 지점 — 이 이벤트가 대시보드의 실매출 집계가 된다.
  track('remove_ads', { props: { price: AD_REMOVE_PRICE, source } });
}

/// 앱 시작 시 1회. 스토어에 연결하고, 구매 결과 리스너를 걸고, 지난 구매를 복원한다.
///
/// 복원이 필요한 이유 — 광고 제거 여부는 기기 안 플래그로만 남는다. 앱을 지우거나
/// 기기를 바꾸면 그 플래그가 사라지므로, 스토어가 가진 구매 이력을 진실로 삼아 되살린다.
/// (비소모성 상품은 스토어 정책상 복원 경로를 반드시 제공해야 한다)
export function initBilling(): void {
  void (async () => {
    const m = await connect();
    if (m == null) return;

    m.purchaseUpdatedListener((purchase) => {
      if (!isRemoveAds(purchase)) return;
      if (purchase.purchaseState !== 'purchased') return; // 결제 대기(pending)는 아직 아니다
      void grantRemoveAds(m, purchase, 'purchase');
    });

    // 취소·결제 실패는 스토어가 자체 화면으로 안내하므로 앱에서 따로 띄우지 않는다.
    m.purchaseErrorListener(() => {});

    try {
      const purchases = await m.getAvailablePurchases();
      const owned = purchases.find(isRemoveAds);
      if (owned != null) await grantRemoveAds(m, owned, 'restore');
    } catch {
      // 네트워크 없음 등 — 다음 실행에서 다시 복원된다.
    }
  })();
}

/// 구매 요청. 결과는 이 함수가 아니라 purchaseUpdatedListener로 돌아온다.
/// 스토어 결제창을 띄우지 못한 경우에만 false.
export async function buyRemoveAds(): Promise<boolean> {
  const m = await connect();
  if (m == null) return false;
  try {
    await m.requestPurchase({
      request: { apple: { sku: REMOVE_ADS_SKU }, google: { skus: [REMOVE_ADS_SKU] } },
      type: 'in-app',
    });
    return true;
  } catch {
    return false;
  }
}
