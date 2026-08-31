import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const appConfig = read('app.config.js');
const track = read('src/analytics/track.ts');
const billing = read('src/lib/billing.ts');
const store = read('src/state/store.ts');
const ads = read('src/lib/ads.ts');
const migration = read('supabase/migrations/202608310001_purchase_transactions.sql');

const TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_UNIT_ID = 'ca-app-pub-3940256099942544/1033173712';
const REAL_APP_ID = 'ca-app-pub-1234567890123456~1234567890';
const REAL_UNIT_ID = 'ca-app-pub-1234567890123456/1234567890';

// The host shell may already export app variables (a loaded .env.local, a previous build). Each case
// starts from a cleaned environment so the assertions below describe the config, not the machine.
function cleanEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('EXPO_PUBLIC_') || key.startsWith('ADMOB_') || key === 'EAS_BUILD_PROFILE') {
      delete env[key];
    }
  }
  return env;
}

function loadConfig(overrides) {
  return spawnSync(process.execPath, ['-e', "require('./app.config.js')"], {
    cwd: rootPath,
    env: { ...cleanEnv(), ...overrides },
    encoding: 'utf8',
  });
}

const fullProduction = {
  EAS_BUILD_PROFILE: 'production',
  EXPO_PUBLIC_APP_ENV: 'production',
  EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://example.com/privacy',
  ADMOB_ANDROID_APP_ID: REAL_APP_ID,
  EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID: REAL_UNIT_ID,
};

function assertRejected(name, overrides, pattern) {
  const result = loadConfig(overrides);
  assert.notEqual(result.status, 0, `${name}: config must fail`);
  assert.match(result.stderr, pattern, `${name}: unexpected failure reason`);
}

function assertAccepted(name, overrides) {
  const result = loadConfig(overrides);
  assert.equal(result.status, 0, `${name}: config must load\n${result.stderr}`);
}

// A production build must never fall back to development when the app env is absent or mistyped.
assertRejected(
  'production profile without EXPO_PUBLIC_APP_ENV',
  { EAS_BUILD_PROFILE: 'production' },
  /must match the EAS build profile/,
);
assertRejected(
  'production profile with mismatched EXPO_PUBLIC_APP_ENV',
  { EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_APP_ENV: 'development' },
  /must match the EAS build profile/,
);
assertRejected(
  'preview profile with mismatched EXPO_PUBLIC_APP_ENV',
  { EAS_BUILD_PROFILE: 'preview', EXPO_PUBLIC_APP_ENV: 'production' },
  /must match the EAS build profile/,
);
assertRejected(
  'production without required values',
  { EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_APP_ENV: 'production' },
  /Missing required production configuration/,
);

// Google's public sample IDs must never reach a production build.
assertRejected(
  'production with the official test AdMob app ID',
  { ...fullProduction, ADMOB_ANDROID_APP_ID: TEST_APP_ID },
  /ADMOB_ANDROID_APP_ID must be a real AdMob Android app ID/,
);
assertRejected(
  'production with the official test AdMob unit ID',
  { ...fullProduction, EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID: TEST_UNIT_ID },
  /EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID must be a real AdMob unit ID/,
);
assertRejected(
  'production with a non-HTTPS privacy policy URL',
  { ...fullProduction, EXPO_PUBLIC_PRIVACY_POLICY_URL: 'http://example.com/privacy' },
  /must be an HTTPS URL in production/,
);

assertAccepted('production with real values', fullProduction);
assertAccepted('preview profile', { EAS_BUILD_PROFILE: 'preview', EXPO_PUBLIC_APP_ENV: 'preview' });
assertAccepted('local run without a build profile', {});

assert.match(appConfig, /react-native-google-mobile-ads/);
assert.match(track, /apikey: KEY/);
assert.doesNotMatch(track, /Authorization:\s*`Bearer \$\{KEY\}`/);
assert.match(track, /!response\.ok/);
assert.match(billing, /verifyOnServer/);
assert.match(billing, /finishTransaction\(\{ purchase, isConsumable: false \}\)/);
assert.match(billing, /retryRequired/);
assert.doesNotMatch(store, /getItem\('td_ad_removed'\)/);
assert.match(ads, /AdEventType\.OPENED/);
assert.match(migration, /unique \(purchase_token_hash\)/);
assert.match(migration, /revoke all on public\.purchase_transactions from anon, authenticated/);

console.log('launch config and security contracts passed');
