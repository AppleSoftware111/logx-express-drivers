cd "D:\Work\Brazil\AI-powered Saas platform for drivers\apps\mobile"
$env:ANDROID_VERSION_CODE="2"
npm run build:apk:cloud

# LDPlayer only
npm run generate:assets
npm run build:apk:standalone:ldplayer