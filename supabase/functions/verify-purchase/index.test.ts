import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from './index';
import { supabaseDouble } from '../../../tests/mocks/supabase-js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PURCHASE_TOKEN = 'purchase-token-abc';
const AUTH_HEADER = { Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json' };
const VALID_BODY = {
  platform: 'android',
  productId: 'remove_ads',
  packageName: 'com.typedate.app',
  purchaseToken: PURCHASE_TOKEN,
};

// The function signs the service-account assertion with a real RS256 key, so the suite generates
// one instead of stubbing the signing path away.
async function generateServiceAccountJson(): Promise<string> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  let binary = '';
  for (const byte of pkcs8) binary += String.fromCharCode(byte);
  const lines = btoa(binary).match(/.{1,64}/g) ?? [];
  const pem = ['-----BEGIN PRIVATE KEY-----', ...lines, '-----END PRIVATE KEY-----'].join('\n');
  return JSON.stringify({
    client_email: 'verifier@type-date.iam.gserviceaccount.com',
    private_key: pem,
  });
}

type Route = { token?: () => Response; lookup?: () => Response; acknowledge?: () => Response };

function stubFetch(routes: Route) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url === TOKEN_URL) {
      return (
        routes.token?.() ??
        new Response(JSON.stringify({ access_token: 'google-access-token' }), { status: 200 })
      );
    }
    if (url.endsWith(':acknowledge')) {
      return routes.acknowledge?.() ?? new Response('{}', { status: 200 });
    }
    return routes.lookup?.() ?? new Response('{}', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

function purchaseLookup(overrides: Record<string, unknown> = {}) {
  return () =>
    new Response(
      JSON.stringify({
        purchaseState: 0,
        purchaseType: 1,
        acknowledgementState: 1,
        orderId: 'GPA.1111-2222-3333',
        purchaseTimeMillis: '1756600000000',
        ...overrides,
      }),
      { status: 200 },
    );
}

function request(body: unknown, headers: Record<string, string> = AUTH_HEADER, method = 'POST') {
  return new Request('https://functions.example.com/verify-purchase', {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

let serviceAccountJson: string;

beforeAll(async () => {
  serviceAccountJson = await generateServiceAccountJson();
});

beforeEach(() => {
  supabaseDouble.reset();
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = serviceAccountJson;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request surface', () => {
  it('answers the CORS preflight', async () => {
    const response = await main(request(null, {}, 'OPTIONS'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('rejects non-POST methods', async () => {
    const response = await main(request(null, AUTH_HEADER, 'GET'));
    expect(response.status).toBe(405);
  });

  it('refuses to run when server secrets are missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await main(request(VALID_BODY));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'server_configuration_missing' });
  });
});

describe('authentication', () => {
  it('rejects a request with no Authorization header', async () => {
    const response = await main(request(VALID_BODY, { 'Content-Type': 'application/json' }));
    expect(response.status).toBe(401);
    expect(supabaseDouble.rows).toHaveLength(0);
  });

  it('rejects a header that is not a Bearer token', async () => {
    const response = await main(request(VALID_BODY, { Authorization: 'Basic user-jwt' }));
    expect(response.status).toBe(401);
  });

  it('rejects a JWT the auth server does not accept', async () => {
    supabaseDouble.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid claim' },
    });
    const response = await main(request(VALID_BODY));
    expect(response.status).toBe(401);
    expect(supabaseDouble.rows).toHaveLength(0);
  });

  it('verifies the caller with the anon key, never the service role key', async () => {
    stubFetch({ lookup: purchaseLookup() });
    await main(request(VALID_BODY));
    expect(supabaseDouble.keys[0]).toBe('anon-key');
    expect(supabaseDouble.getUser).toHaveBeenCalledWith('user-jwt');
  });
});

describe('input validation', () => {
  it('rejects malformed JSON', async () => {
    const bad = new Request('https://functions.example.com/verify-purchase', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: '{not json',
    });
    expect((await main(bad)).status).toBe(400);
  });

  it.each([
    ['another app package', { ...VALID_BODY, packageName: 'com.attacker.app' }],
    ['another product', { ...VALID_BODY, productId: 'premium_forever' }],
    ['another platform', { ...VALID_BODY, platform: 'ios' }],
    ['a missing token', { ...VALID_BODY, purchaseToken: '' }],
    ['an oversized token', { ...VALID_BODY, purchaseToken: 'x'.repeat(8193) }],
  ])('rejects %s without calling Google', async (_label, body) => {
    const calls = stubFetch({});
    const response = await main(request(body));
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
    expect(supabaseDouble.rows).toHaveLength(0);
  });
});

describe('entitlement decisions', () => {
  it('grants nothing when Google does not recognise the token', async () => {
    stubFetch({ lookup: () => new Response('{"error":"not found"}', { status: 404 }) });
    const body = await (await main(request(VALID_BODY))).json();
    expect(body).toMatchObject({ verified: false, entitled: false });
    expect(supabaseDouble.rows).toHaveLength(0);
  });

  it('grants nothing when the store lookup itself fails', async () => {
    stubFetch({ token: () => new Response('{}', { status: 500 }) });
    const response = await main(request(VALID_BODY));
    expect(response.status).toBe(503);
    expect(supabaseDouble.rows).toHaveLength(0);
  });

  it('grants the entitlement for a completed purchase and writes one ledger row', async () => {
    stubFetch({ lookup: purchaseLookup() });
    const body = await (await main(request(VALID_BODY))).json();
    expect(body).toMatchObject({
      verified: true,
      entitled: true,
      status: 'purchased',
      acknowledged: true,
    });
    expect(supabaseDouble.rows).toHaveLength(1);
    expect(supabaseDouble.rows[0].options).toEqual({ onConflict: 'purchase_token_hash' });
  });

  it('withholds the entitlement while the purchase is pending', async () => {
    stubFetch({ lookup: purchaseLookup({ purchaseState: 2 }) });
    const body = await (await main(request(VALID_BODY))).json();
    expect(body).toMatchObject({ verified: true, entitled: false, status: 'pending' });
  });

  it('withholds the entitlement for a cancelled purchase', async () => {
    stubFetch({ lookup: purchaseLookup({ purchaseState: 1 }) });
    const body = await (await main(request(VALID_BODY))).json();
    expect(body).toMatchObject({ entitled: false, status: 'cancelled' });
  });

  it('flags a test purchase so revenue reporting can exclude it', async () => {
    stubFetch({ lookup: purchaseLookup({ purchaseType: 0 }) });
    const body = await (await main(request(VALID_BODY))).json();
    expect(body).toMatchObject({ entitled: true, isTest: true });
  });

  it('reports a failed ledger write instead of claiming success', async () => {
    stubFetch({ lookup: purchaseLookup() });
    supabaseDouble.upsert.mockResolvedValue({ error: { message: 'permission denied' } });
    const response = await main(request(VALID_BODY));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'ledger_write_failed' });
  });
});

describe('acknowledgement', () => {
  it('acknowledges a purchase Google has not yet acknowledged', async () => {
    const calls = stubFetch({ lookup: purchaseLookup({ acknowledgementState: 0 }) });
    const body = await (await main(request(VALID_BODY))).json();
    expect(calls.some((url) => url.endsWith(':acknowledge'))).toBe(true);
    expect(body).toMatchObject({ acknowledged: true, retryRequired: false });
  });

  it('asks the client to retry when the acknowledgement call fails', async () => {
    stubFetch({
      lookup: purchaseLookup({ acknowledgementState: 0 }),
      acknowledge: () => new Response('{}', { status: 500 }),
    });
    const body = await (await main(request(VALID_BODY))).json();
    // The entitlement still stands; only the ledger is behind, so the client re-verifies.
    expect(body).toMatchObject({ entitled: true, acknowledged: false, retryRequired: true });
    expect(supabaseDouble.rows[0].row.acknowledgement_status).toBe('pending');
  });

  it('does not re-acknowledge a purchase Google already acknowledged', async () => {
    const calls = stubFetch({ lookup: purchaseLookup({ acknowledgementState: 1 }) });
    await main(request(VALID_BODY));
    expect(calls.some((url) => url.endsWith(':acknowledge'))).toBe(false);
  });
});

describe('stored data', () => {
  it('stores only a hash of the purchase token', async () => {
    stubFetch({ lookup: purchaseLookup() });
    await main(request(VALID_BODY));
    const { row } = supabaseDouble.rows[0];
    expect(JSON.stringify(row)).not.toContain(PURCHASE_TOKEN);
    expect(row.purchase_token_hash).toEqual(expect.any(String));
  });

  it('binds the row to the authenticated user, not to a client-supplied id', async () => {
    stubFetch({ lookup: purchaseLookup() });
    supabaseDouble.getUser.mockResolvedValue({ data: { user: { id: 'real-user' } }, error: null });
    await main(request({ ...VALID_BODY, userId: 'spoofed-user' }));
    expect(supabaseDouble.rows[0].row.user_id).toBe('real-user');
  });

  it('writes the ledger with the service role key', async () => {
    stubFetch({ lookup: purchaseLookup() });
    await main(request(VALID_BODY));
    expect(supabaseDouble.keys).toContain('service-role-key');
  });
});
