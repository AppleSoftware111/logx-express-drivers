/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const buildProfile = process.env.EAS_BUILD_PROFILE ?? process.env.APP_VARIANT ?? 'development';
const isProductionProfile = buildProfile === 'production';
const fallbackApiUrl = isProductionProfile ? undefined : 'http://10.0.2.2:4000';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? appJson.expo.extra?.apiUrl ?? fallbackApiUrl;

function deriveVersionCode(appVersion) {
  const [major = '1', minor = '0', patch = '0'] = String(appVersion).split('.');
  const safeMajor = Number.parseInt(major, 10) || 1;
  const safeMinor = Number.parseInt(minor, 10) || 0;
  const safePatch = Number.parseInt(patch, 10) || 0;
  return safeMajor * 10000 + safeMinor * 100 + safePatch;
}

const versionCode = Number.parseInt(
  process.env.ANDROID_VERSION_CODE ?? String(deriveVersionCode(appJson.expo.version)),
  10
);

if (!API_URL) {
  throw new Error(
    'Missing EXPO_PUBLIC_API_URL for mobile build. Set it explicitly for production builds.'
  );
}

if (Number.isNaN(versionCode) || versionCode < 1) {
  throw new Error('ANDROID_VERSION_CODE must be a positive integer.');
}

if (
  isProductionProfile &&
  /(10\.0\.2\.2|192\.168\.|localhost|127\.0\.0\.1|your-api-domain\.com|example\.com)/i.test(API_URL)
) {
  throw new Error(
    `Invalid EXPO_PUBLIC_API_URL for production build: "${API_URL}". Use the real production API URL.`
  );
}

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      apiUrl: API_URL,
      eas: {
        projectId: '7140c221-d11a-4db6-944c-af967019f065',
      },
    },
    android: {
      ...appJson.expo.android,
      versionCode,
      usesCleartextTraffic: !isProductionProfile && API_URL.startsWith('http://'),
    },
  },
};
