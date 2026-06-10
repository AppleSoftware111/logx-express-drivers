import fs from 'node:fs';
import path from 'node:path';

const sdkRoot =
  process.env.ANDROID_SDK_ROOT ??
  process.env.ANDROID_HOME ??
  (process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
    : null);

if (!sdkRoot) {
  throw new Error('Could not determine Android SDK root. Set ANDROID_SDK_ROOT or ANDROID_HOME.');
}

const cmakeVersion = process.env.ANDROID_CMAKE_VERSION ?? '3.31.6';
const cmakeDir = path.join(sdkRoot, 'cmake', cmakeVersion);
const ndkVersion = process.env.ANDROID_NDK_VERSION ?? '26.1.10909125';
const ndkDir = path.join(sdkRoot, 'ndk', ndkVersion);
const androidDir = path.resolve(process.cwd(), 'android');

if (!fs.existsSync(androidDir)) {
  throw new Error(`Android directory not found at ${androidDir}. Run expo prebuild first.`);
}

if (!fs.existsSync(path.join(cmakeDir, 'bin', process.platform === 'win32' ? 'cmake.exe' : 'cmake'))) {
  throw new Error(
    `Required CMake version ${cmakeVersion} was not found at ${cmakeDir}. Install it with sdkmanager first.`
  );
}

const properties = [
  `sdk.dir=${sdkRoot.replace(/\\/g, '\\\\')}`,
  `cmake.dir=${cmakeDir.replace(/\\/g, '\\\\')}`,
];

if (fs.existsSync(ndkDir)) {
  properties.push(`ndk.dir=${ndkDir.replace(/\\/g, '\\\\')}`);
}

fs.writeFileSync(path.join(androidDir, 'local.properties'), `${properties.join('\n')}\n`, 'utf8');
console.log(`Wrote android/local.properties using SDK ${sdkRoot} and CMake ${cmakeVersion}`);
