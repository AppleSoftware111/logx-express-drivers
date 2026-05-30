/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';

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
      // Allow HTTP to local/dev API (LAN or emulator). Remove for production HTTPS-only.
      usesCleartextTraffic: true,
    },
  },
};
