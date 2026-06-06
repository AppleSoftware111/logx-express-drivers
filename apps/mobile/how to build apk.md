cd "D:\Work\Brazil\AI-powered Saas platform for drivers\apps\mobile"
$env:EXPO_PUBLIC_API_URL="https://api.yourdomain.com"
$env:APP_VARIANT="production"
$env:ANDROID_VERSION_CODE="2"
npm run generate:assets
npm run build:apk:standalone:ldplayer