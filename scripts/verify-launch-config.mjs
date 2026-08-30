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

const missingProductionEnv = { ...process.env };
for (const key of [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_PRIVACY_POLICY_URL',
  'EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID',
  'ADMOB_ANDROID_APP_ID',
]) delete missingProductionEnv[key];
missingProductionEnv.EXPO_PUBLIC_APP_ENV = 'production';
const production = spawnSync(process.execPath, ['-e', "require('./app.config.js')"], {
  cwd: rootPath,
  env: missingProductionEnv,
  encoding: 'utf8',
});

assert.notEqual(production.status, 0, 'production config must fail when required values are missing');
assert.match(production.stderr, /Missing required production configuration/);
assert.match(appConfig, /react-native-google-mobile-ads/);
assert.match(track, /apikey: KEY/);
assert.doesNotMatch(track, /Authorization:\s*`Bearer \$\{KEY\}`/);
assert.match(track, /!response\.ok/);
assert.match(billing, /verifyOnServer/);
assert.match(billing, /finishTransaction\(\{ purchase, isConsumable: false \}\)/);
assert.doesNotMatch(store, /getItem\('td_ad_removed'\)/);
assert.match(ads, /AdEventType\.OPENED/);
assert.match(migration, /unique \(purchase_token_hash\)/);
assert.match(migration, /revoke all on public\.purchase_transactions from anon, authenticated/);

console.log('launch config and security contracts passed');
