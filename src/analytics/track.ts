import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../state/store';

// 익명 플레이 통계 수집 — Supabase REST로 이벤트 한 줄씩 적재.
// 사용자 이름 등 개인정보는 보내지 않는다. 기기 식별은 앱이 만든 임의 UUID뿐.
// 환경변수가 없으면 조용히 아무것도 하지 않는다(로컬 개발·오프라인에서 그대로 동작).

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const enabled = Boolean(URL && KEY);

// 앱 켠 동안 재사용 — 매 이벤트마다 AsyncStorage를 읽지 않도록 한 번만 해석한다.
let deviceIdPromise: Promise<string> | null = null;

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function deviceId(): Promise<string> {
  if (deviceIdPromise == null) {
    deviceIdPromise = (async () => {
      const saved = await AsyncStorage.getItem('td_device_id');
      if (saved != null) return saved;
      const fresh = uuid();
      await AsyncStorage.setItem('td_device_id', fresh);
      return fresh;
    })();
  }
  return deviceIdPromise;
}

type Props = Record<string, string | number>;

/// 이벤트 한 건 전송. 실패는 삼킨다 — 통계 때문에 게임이 멈추면 안 된다.
export function track(
  name: string,
  opts: { episodeId?: string; props?: Props } = {},
): void {
  if (!enabled) return;
  void (async () => {
    try {
      const id = await deviceId();
      await fetch(`${URL}/rest/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: KEY as string,
          Authorization: `Bearer ${KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          device_id: id,
          name,
          line: useStore.getState().line,
          episode_id: opts.episodeId ?? null,
          props: opts.props ?? {},
        }),
      });
    } catch {
      // 네트워크 없음 등 — 통계는 유실돼도 무방
    }
  })();
}
