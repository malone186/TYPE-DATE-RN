import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 1:1 문의용 Supabase 클라이언트.
// 가입 절차 없이 signInAnonymously()로 익명 계정을 하나 만들어 스레드를 묶는다.
// JWT 기반이라 RLS가 auth.uid()로 "남의 문의 읽기"를 실제로 막을 수 있다.
//
// 트래킹(track.ts)은 계속 fetch로 anon 역할을 쓴다 — 로그인 여부와 무관하게 동작해야 하므로.

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseReady = Boolean(URL && KEY);

export const supabase: SupabaseClient | null = supabaseReady
  ? createClient(URL as string, KEY as string, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // 앱에는 OAuth 리다이렉트가 없다. 웹 빌드에서 URL을 훑지 않도록 꺼둔다.
        detectSessionInUrl: false,
      },
    })
  : null;

// 여러 화면에서 동시에 호출해도 로그인은 한 번만 일어나게 묶어둔다.
let signInPromise: Promise<string | null> | null = null;

/// 익명 세션을 보장하고 user id를 돌려준다. 실패하면 null.
export function ensureSignedIn(): Promise<string | null> {
  if (supabase == null) return Promise.resolve(null);
  signInPromise ??= attemptSignIn();
  return signInPromise;
}

async function attemptSignIn(): Promise<string | null> {
  const db = supabase;
  if (db == null) return null;
  try {
    const { data } = await db.auth.getSession();
    if (data.session != null) return data.session.user.id;
    const { data: created, error } = await db.auth.signInAnonymously();
    if (error != null) throw error;
    return created.user?.id ?? null;
  } catch {
    // 반환된 error든 던져진 예외든 실패한 시도는 캐시하지 않는다.
    // 캐시에 남기면 rejected promise가 앱 수명 내내 붙들려 문의·결제 검증이 복구되지 않는다.
    signInPromise = null;
    return null;
  }
}

// 구매 검증 함수 호출처럼 로그인 JWT가 필요한 작업에서만 사용한다.
// 통계 전송은 이 세션과 분리된 anon apikey 경로를 유지한다.
export async function getAccessToken(): Promise<string | null> {
  if (supabase == null) return null;
  const uid = await ensureSignedIn();
  if (uid == null) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
