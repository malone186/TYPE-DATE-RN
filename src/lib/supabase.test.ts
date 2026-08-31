import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_test';

type Session = { user: { id: string }; access_token: string } | null;

const auth = vi.hoisted(() => ({
  getSession: vi.fn(async (): Promise<{ data: { session: Session } }> => ({ data: { session: null } })),
  signInAnonymously: vi.fn(
    async (): Promise<{ data: { user: { id: string } | null }; error: Error | null }> => ({
      data: { user: { id: 'anon-1' } },
      error: null,
    }),
  ),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth }),
}));

async function loadSupabase() {
  vi.resetModules();
  return import('./supabase');
}

beforeEach(() => {
  auth.getSession.mockReset();
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.signInAnonymously.mockReset();
  auth.signInAnonymously.mockResolvedValue({ data: { user: { id: 'anon-1' } }, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ensureSignedIn', () => {
  it('signs in once when several callers ask at the same time', async () => {
    const { ensureSignedIn } = await loadSupabase();

    const [a, b, c] = await Promise.all([ensureSignedIn(), ensureSignedIn(), ensureSignedIn()]);

    expect([a, b, c]).toEqual(['anon-1', 'anon-1', 'anon-1']);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('reuses the existing session instead of creating another account', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'existing' }, access_token: 'jwt' } },
    });
    const { ensureSignedIn } = await loadSupabase();

    await expect(ensureSignedIn()).resolves.toBe('existing');
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('retries on the next call when sign-in returns an error', async () => {
    auth.signInAnonymously
      .mockResolvedValueOnce({ data: { user: null }, error: new Error('service down') })
      .mockResolvedValue({ data: { user: { id: 'anon-2' } }, error: null });
    const { ensureSignedIn } = await loadSupabase();

    await expect(ensureSignedIn()).resolves.toBeNull();
    await expect(ensureSignedIn()).resolves.toBe('anon-2');
  });

  it('retries on the next call when the session lookup throws', async () => {
    // A cached rejected promise would keep inquiries and purchase verification dead for the
    // whole app session, recoverable only by restarting the app.
    auth.getSession
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValue({ data: { session: null } });
    const { ensureSignedIn } = await loadSupabase();

    await expect(ensureSignedIn()).resolves.toBeNull();
    await expect(ensureSignedIn()).resolves.toBe('anon-1');
  });

  it('retries on the next call when sign-in itself throws', async () => {
    auth.signInAnonymously
      .mockRejectedValueOnce(new Error('network unreachable'))
      .mockResolvedValue({ data: { user: { id: 'anon-3' } }, error: null });
    const { ensureSignedIn } = await loadSupabase();

    await expect(ensureSignedIn()).resolves.toBeNull();
    await expect(ensureSignedIn()).resolves.toBe('anon-3');
  });

  it('never rejects, so callers do not have to guard the call', async () => {
    auth.getSession.mockRejectedValue(new Error('storage unavailable'));
    const { ensureSignedIn } = await loadSupabase();

    await expect(ensureSignedIn()).resolves.toBeNull();
  });
});

describe('getAccessToken', () => {
  it('returns the token of the established session', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'anon-1' }, access_token: 'jwt-abc' } },
    });
    const { getAccessToken } = await loadSupabase();

    await expect(getAccessToken()).resolves.toBe('jwt-abc');
  });

  it('returns null instead of throwing when sign-in fails', async () => {
    auth.signInAnonymously.mockRejectedValue(new Error('network unreachable'));
    const { getAccessToken } = await loadSupabase();

    await expect(getAccessToken()).resolves.toBeNull();
  });
});
