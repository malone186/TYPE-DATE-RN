import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PRODUCT_ID = 'remove_ads';
const PACKAGE_NAME = 'com.jinnstudio.typedate';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const encoder = new TextEncoder();

type PurchaseStatus = 'purchased' | 'pending' | 'cancelled' | 'unknown';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToBytes(pem: string): Uint8Array {
  const encoded = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(encoded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256(value: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

async function googleAccessToken(): Promise<string> {
  const raw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  if (raw == null) throw new Error('google_credentials_missing');
  const serviceAccount = JSON.parse(raw) as { client_email?: string; private_key?: string };
  if (serviceAccount.client_email == null || serviceAccount.private_key == null) {
    throw new Error('google_credentials_invalid');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = base64Url(
    encoder.encode(
      JSON.stringify({
        iss: serviceAccount.client_email,
        scope: GOOGLE_SCOPE,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!tokenResponse.ok) throw new Error('google_token_request_failed');
  const tokenBody = (await tokenResponse.json()) as { access_token?: string };
  if (tokenBody.access_token == null) throw new Error('google_token_missing');
  return tokenBody.access_token;
}

function stringField(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : null;
}

// Exported so the test suite can drive the handler directly without binding a port.
export async function main(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (supabaseUrl == null || anonKey == null || serviceRoleKey == null) {
    return json({ error: 'server_configuration_missing' }, 503);
  }

  const authorization = req.headers.get('Authorization');
  const jwt = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (jwt == null || jwt.length > 8192) return json({ error: 'unauthorized' }, 401);

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: authData, error: authError } = await authClient.auth.getUser(jwt);
  if (authError != null || authData.user == null) return json({ error: 'unauthorized' }, 401);

  let input: Record<string, unknown>;
  try {
    input = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const platform = stringField(input.platform, 16);
  const productId = stringField(input.productId, 128);
  const packageName = stringField(input.packageName, 256);
  const purchaseToken = stringField(input.purchaseToken, 8192);
  if (
    platform !== 'android' ||
    productId !== PRODUCT_ID ||
    packageName !== PACKAGE_NAME ||
    purchaseToken == null
  ) {
    return json({ error: 'invalid_purchase_request' }, 400);
  }

  let googleResponse: Response;
  try {
    const token = await googleAccessToken();
    const endpoint =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${encodeURIComponent(PACKAGE_NAME)}/purchases/products/${encodeURIComponent(PRODUCT_ID)}/tokens/${encodeURIComponent(purchaseToken)}`;
    googleResponse = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return json({ error: 'store_verification_unavailable' }, 503);
  }

  if (!googleResponse.ok) {
    // Invalid tokens and store-side lookup errors never grant an entitlement.
    return json({ verified: false, entitled: false, isTest: false, status: 'unknown' });
  }

  const googlePurchase = (await googleResponse.json()) as Record<string, unknown>;
  const purchaseState = Number(googlePurchase.purchaseState);
  const status: PurchaseStatus =
    purchaseState === 0 ? 'purchased' : purchaseState === 2 ? 'pending' : purchaseState === 1 ? 'cancelled' : 'unknown';
  const isTest = Number(googlePurchase.purchaseType) === 0;
  const transactionId = stringField(googlePurchase.orderId, 256);
  const purchaseTimeMillis = Number(googlePurchase.purchaseTimeMillis);
  const purchaseTime = Number.isFinite(purchaseTimeMillis)
    ? new Date(purchaseTimeMillis).toISOString()
    : null;
  const tokenHash = await sha256(purchaseToken);
  let acknowledgementStatus: 'acknowledged' | 'pending' | 'not_required' = 'not_required';

  if (status === 'purchased' && Number(googlePurchase.acknowledgementState) === 0) {
    try {
      const token = await googleAccessToken();
      const acknowledgeEndpoint =
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
        `${encodeURIComponent(PACKAGE_NAME)}/purchases/products/${encodeURIComponent(PRODUCT_ID)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
      const acknowledgeResponse = await fetch(acknowledgeEndpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      acknowledgementStatus = acknowledgeResponse.ok ? 'acknowledged' : 'pending';
    } catch {
      acknowledgementStatus = 'pending';
    }
  } else if (status === 'purchased') {
    acknowledgementStatus = 'acknowledged';
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: ledgerError } = await serviceClient.from('purchase_transactions').upsert(
    {
      user_id: authData.user.id,
      platform,
      package_name: PACKAGE_NAME,
      product_id: PRODUCT_ID,
      transaction_id: transactionId,
      purchase_time: purchaseTime,
      status,
      is_test: isTest,
      acknowledgement_status: acknowledgementStatus,
      purchase_token_hash: tokenHash,
      last_verified_at: new Date().toISOString(),
    },
    { onConflict: 'purchase_token_hash' },
  );
  if (ledgerError != null) return json({ error: 'ledger_write_failed' }, 503);

  return json({
    verified: true,
    entitled: status === 'purchased',
    isTest,
    status,
    acknowledged: acknowledgementStatus === 'acknowledged',
    retryRequired: acknowledgementStatus === 'pending',
  });
}

Deno.serve((req) => main(req));
