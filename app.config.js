const TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const TEST_ANDROID_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

// EAS Build sets EAS_BUILD_PROFILE to the profile name. When it is present the app env must
// match it, so a missing or mistyped EXPO_PUBLIC_APP_ENV fails the build instead of silently
// falling back to development and shipping test ad IDs.
const buildProfile = process.env.EAS_BUILD_PROFILE;
const declaredAppEnv = process.env.EXPO_PUBLIC_APP_ENV;

function resolveAppEnv() {
  if (buildProfile != null && buildProfile !== '') {
    if (declaredAppEnv !== buildProfile) {
      throw new Error(
        `EXPO_PUBLIC_APP_ENV must match the EAS build profile: profile="${buildProfile}", ` +
          `EXPO_PUBLIC_APP_ENV="${declaredAppEnv ?? ''}"`,
      );
    }
    return declaredAppEnv;
  }
  return declaredAppEnv ?? 'development';
}

const appEnv = resolveAppEnv();

function isPlaceholder(value) {
  return value == null || value.trim() === '' || /<|\[|your-project|your-/.test(value);
}

function validateProductionConfig() {
  if (appEnv !== 'production') return;
  const required = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_PRIVACY_POLICY_URL',
    'EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID',
    'ADMOB_ANDROID_APP_ID',
  ];
  const missing = required.filter((name) => isPlaceholder(process.env[name]));
  if (missing.length > 0) {
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  }
  if (!/^https:\/\//.test(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL)) {
    throw new Error('EXPO_PUBLIC_PRIVACY_POLICY_URL must be an HTTPS URL in production');
  }
  if (
    !/^ca-app-pub-\d{16}~\d{10}$/.test(process.env.ADMOB_ANDROID_APP_ID) ||
    process.env.ADMOB_ANDROID_APP_ID === TEST_ANDROID_APP_ID
  ) {
    throw new Error('ADMOB_ANDROID_APP_ID must be a real AdMob Android app ID in production');
  }
  if (
    !/^ca-app-pub-\d{16}\/\d{10}$/.test(process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID) ||
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID === TEST_ANDROID_INTERSTITIAL_ID
  ) {
    throw new Error('EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID must be a real AdMob unit ID in production');
  }
}

validateProductionConfig();

module.exports = ({ config }) => ({
  ...config,
  // Expo config validation requires square icon assets. The title screen keeps using logo_mark.png.
  icon: './assets/images/logo.png',
  android: {
    ...config.android,
    adaptiveIcon: {
      ...config.android?.adaptiveIcon,
      foregroundImage: './assets/images/logo.png',
    },
  },
  plugins: [
    ...(config.plugins ?? []),
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: process.env.ADMOB_ANDROID_APP_ID ?? TEST_ANDROID_APP_ID,
        // iOS ad requests remain disabled; this prevents the native SDK from crashing if an existing iOS build is made.
        iosAppId: TEST_IOS_APP_ID,
        optimizeInitialization: true,
        optimizeAdLoading: true,
      },
    ],
  ],
});
