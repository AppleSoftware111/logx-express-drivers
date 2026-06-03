/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const buildProfile = process.env.EAS_BUILD_PROFILE ?? process.env.APP_VARIANT ?? 'development';
const isProductionProfile = buildProfile === 'production';
const fallbackApiUrl = isProductionProfile ? undefined : 'http://10.0.2.2:4000';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? appJson.expo.extra?.apiUrl ?? fallbackApiUrl;

if (!API_URL) {
  throw new Error(
    'Missing EXPO_PUBLIC_API_URL for mobile build. Set it explicitly for production builds.'
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
      versionCode: 1,
      usesCleartextTraffic: !isProductionProfile && API_URL.startsWith('http://'),
    },
  },
};
