cd "D:\Work\Brazil\AI-powered Saas platform for drivers\apps\mobile"
$env:EXPO_PUBLIC_API_URL="https://your-api-domain.com"
npx expo prebuild --platform android --clean
cd android
$env:NODE_ENV="development"
.\gradlew.bat assembleDebug --no-daemon -PreactNativeArchitectures=x86_64





cd "D:\Work\Brazil\AI-powered Saas platform for drivers\apps\mobile"
npm run generate:assets
npm run build:apk:standalone:ldplayer