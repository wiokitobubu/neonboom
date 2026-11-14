#!/usr/bin/env node
/* ==========================================================================
   NEON BOOM — Android helper. Works the same on Windows, macOS and Linux.

     node tools/android.mjs setup     first time: installs and prepares the Android project
     node tools/android.mjs sync      after changing the game or js/ads-config.js
     node tools/android.mjs release   builds the signed files for Google Play (.aab + .apk)
     node tools/android.mjs doctor    checks that everything needed is installed

   The Windows .bat files in the project folder simply run these commands.
   Every change it makes to the android/ folder is safe to repeat.
   ========================================================================== */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import os from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = join(ROOT, 'android');
const RES = join(ANDROID, 'app', 'src', 'main', 'res');
const KEYS = join(ROOT, 'keys');
const WIN = process.platform === 'win32';
const TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

/* ---------------- console ---------------- */
const color = (c, s) => (process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s);
const ok = s => console.log(color('32', '  [OK] ') + s);
const info = s => console.log(color('36', '  [..] ') + s);
const warn = s => console.log(color('33', '  [!!] ') + s);
const title = s => console.log('\n' + color('35;1', '== ' + s));
class Stop extends Error {}
function fail(msg, help) {
  console.log('\n' + color('31;1', '  [X] ' + msg));
  if (help) console.log(color('31', '      ' + help.split('\n').join('\n      ')));
  throw new Stop(msg);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: WIN, cwd: ROOT, ...opts });
  if (r.error) fail(`Could not run ${cmd}: ${r.error.message}`);
  if (r.status !== 0) fail(`"${cmd} ${args.join(' ')}" stopped with an error (code ${r.status}).`, 'Read the lines just above this one.');
}
const read = p => readFileSync(p, 'utf8');
function write(p, s) {
  if (existsSync(p) && read(p) === s) return false;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, s);
  return true;
}

/* ---------------- project facts ---------------- */
const pkg = () => JSON.parse(read(join(ROOT, 'package.json')));
const capConfig = () => JSON.parse(read(join(ROOT, 'capacitor.config.json')));

function version() {
  const v = pkg().version;
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) fail(`package.json "version" must look like 1.0.0 (found "${v}").`);
  const [maj, min, pat] = m.slice(1).map(Number);
  if (min > 99 || pat > 99) fail('Keep the middle and last version numbers between 0 and 99.');
  return { name: v, code: maj * 10000 + min * 100 + pat };
}

function adsConfig() {
  const src = read(join(ROOT, 'www', 'js', 'ads-config.js'));
  const get = k => (new RegExp(k + "\\s*:\\s*'([^']*)'").exec(src) || [])[1] || '';
  const testMode = /TEST_MODE\s*:\s*true/.test(src);
  return { appId: get('APP_ID'), banner: get('BANNER'), interstitial: get('INTERSTITIAL'), rewarded: get('REWARDED'), testMode };
}

function checkAds(a) {
  if (!/^ca-app-pub-\d{16}~\d{10}$/.test(a.appId)) {
    fail(`The AdMob APP_ID in www/js/ads-config.js looks wrong: "${a.appId}"`,
      'It must look like ca-app-pub-1234567890123456~1234567890 (with a "~").');
  }
  for (const k of ['banner', 'interstitial', 'rewarded']) {
    if (!/^ca-app-pub-\d{16}\/\d{10}$/.test(a[k])) {
      fail(`The AdMob ${k.toUpperCase()} id in www/js/ads-config.js looks wrong: "${a[k]}"`,
        'Ad unit IDs look like ca-app-pub-1234567890123456/1234567890 (with a "/").');
    }
  }
}

/* ---------------- tools on this computer ---------------- */
function findJava() {
  const homes = [process.env.JAVA_HOME,
    ...(WIN ? ['C:\\Program Files\\Android\\Android Studio\\jbr', join(process.env.LOCALAPPDATA || '', 'Programs', 'Android Studio', 'jbr')]
      : process.platform === 'darwin' ? ['/Applications/Android Studio.app/Contents/jbr/Contents/Home', join(os.homedir(), 'Applications', 'Android Studio.app', 'Contents', 'jbr', 'Contents', 'Home')]
        : ['/opt/android-studio/jbr', join(os.homedir(), 'android-studio', 'jbr')])];
  return homes.find(h => h && existsSync(join(h, 'bin', WIN ? 'java.exe' : 'java'))) || null;
}

function findSdk() {
  const lp = join(ANDROID, 'local.properties');
  const fromLp = existsSync(lp) ? (/^sdk\.dir=(.*)$/m.exec(read(lp)) || [])[1] : null;
  const unesc = s => s && s.replace(/\\:/g, ':').replace(/\\\\/g, '\\');
  const dirs = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, unesc(fromLp),
    WIN ? join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
      : process.platform === 'darwin' ? join(os.homedir(), 'Library', 'Android', 'sdk') : join(os.homedir(), 'Android', 'Sdk')];
  return dirs.find(d => d && existsSync(join(d, 'platforms'))) || null;
}

function nodeOk() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22) fail(`Node.js ${process.versions.node} is too old.`, 'Install the LTS version from https://nodejs.org (22 or newer), then try again.');
}

/* ---------------- patches for the android/ folder ---------------- */
function patchManifest() {
  const p = join(ANDROID, 'app', 'src', 'main', 'AndroidManifest.xml');
  let s = read(p);
  if (!s.includes('android:appCategory=')) s = s.replace('<application', '<application\n        android:appCategory="game"');
  if (!s.includes('android:screenOrientation=')) s = s.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"');
  if (!s.includes('com.google.android.gms.ads.APPLICATION_ID')) {
    s = s.replace('</application>',
`    <!-- AdMob. The App ID is copied from www/js/ads-config.js into res/values/admob.xml by "npm run sync". -->
        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="@string/admob_app_id" />
        <meta-data android:name="com.google.android.gms.ads.flag.OPTIMIZE_INITIALIZATION" android:value="true" />
        <meta-data android:name="com.google.android.gms.ads.flag.OPTIMIZE_AD_LOADING" android:value="true" />
    </application>`);
  }
  return write(p, s);
}

function patchStyles() {
  const p = join(RES, 'values', 'styles.xml');
  let s = read(p);
  if (!s.includes('android:windowBackground">@color/nb_background')) {
    s = s.replace(/(<style name="AppTheme\.NoActionBar"[^>]*>[\s\S]*?)(\s*<\/style>)/,
      '$1\n        <item name="android:windowBackground">@color/nb_background</item>$2');
  }
  if (!s.includes('windowSplashScreenBackground')) {
    s = s.replace(/(<style name="AppTheme\.NoActionBarLaunch"[^>]*>[\s\S]*?)(\s*<\/style>)/,
      '$1\n        <item name="windowSplashScreenBackground">@color/nb_background</item>' +
      '\n        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher</item>' +
      '\n        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>$2');
  }
  let changed = write(p, s);
  changed = write(join(RES, 'values', 'nb_colors.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="nb_background">#05030D</color>\n</resources>\n') || changed;
  return changed;
}

function patchStrings() {
  const p = join(RES, 'values', 'strings.xml');
  const name = capConfig().appName;
  let s = read(p)
    .replace(/(<string name="app_name">)[^<]*(<\/string>)/, `$1${name}$2`)
    .replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, `$1${name}$2`);
  return write(p, s);
}

function writeAdmobId(appId) {
  return write(join(RES, 'values', 'admob.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by tools/android.mjs from www/js/ads-config.js. Edit that file, not this one. -->
<resources>
    <string name="admob_app_id" translatable="false">${appId}</string>
</resources>
`);
}

function writeMainActivity() {
  const id = capConfig().appId;
  const p = join(ANDROID, 'app', 'src', 'main', 'java', ...id.split('.'), 'MainActivity.java');
  return write(p,
`package ${id};

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * NEON BOOM: a full-screen game.
 * The status and navigation bars stay hidden (a swipe from the edge shows them for a
 * moment), and the screen never dims while the app is open.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        bars.hide(WindowInsetsCompat.Type.systemBars());
    }
}
`);
}

function patchGradle() {
  const p = join(ANDROID, 'app', 'build.gradle');
  let s = read(p);
  if (!s.includes('nbPackage')) {
    s = s.replace("apply plugin: 'com.android.application'\n",
`apply plugin: 'com.android.application'

// NEON BOOM: the version comes from package.json; the release signing key from
// keys/keystore.properties, which "npm run release" creates and git never stores.
def nbPackage = new groovy.json.JsonSlurper().parse(rootProject.file('../package.json'))
def nbVersion = nbPackage.version.tokenize('.').collect { it.toInteger() }
def nbKeystoreFile = rootProject.file('../keys/keystore.properties')
def nbKeystore = new Properties()
if (nbKeystoreFile.exists()) { nbKeystoreFile.withInputStream { nbKeystore.load(it) } }
`);
    s = s.replace(/versionCode \d+/, 'versionCode nbVersion[0] * 10000 + nbVersion[1] * 100 + nbVersion[2]');
    s = s.replace(/versionName "[^"]*"/, 'versionName nbPackage.version');
    s = s.replace('    buildTypes {',
`    signingConfigs {
        release {
            if (nbKeystoreFile.exists()) {
                storeFile rootProject.file('../keys/' + nbKeystore['storeFile'])
                storePassword nbKeystore['storePassword']
                keyAlias nbKeystore['keyAlias']
                keyPassword nbKeystore['keyPassword']
            }
        }
    }
    buildTypes {`);
    s = s.replace(/(release \{\n\s*)(minifyEnabled false)/, '$1if (nbKeystoreFile.exists()) { signingConfig signingConfigs.release }\n            $2');
  }
  if (!s.includes('nbPackage') || !s.includes('signingConfig signingConfigs.release')) {
    fail('Could not update android/app/build.gradle automatically.', 'Delete the android folder and run setup again.');
  }
  return write(p, s);
}

/* Icons and splash screens: drawn by tools/brand, stored in assets/android/res. */
function copyBrandRes() {
  const src = join(ROOT, 'assets', 'android', 'res');
  if (!existsSync(src)) { warn('assets/android/res is missing: the default icons stay.'); return 0; }
  let n = 0;
  (function walk(d) {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const dst = join(RES, relative(src, p));
        if (!existsSync(dst) || !readFileSync(dst).equals(readFileSync(p))) { mkdirSync(dirname(dst), { recursive: true }); copyFileSync(p, dst); n++; }
      }
    }
  })(src);
  // Capacitor's default vector icon and splash pictures are replaced by the files above.
  const stale = [join(RES, 'drawable-v24', 'ic_launcher_foreground.xml'), join(RES, 'drawable', 'ic_launcher_background.xml')];
  if (existsSync(join(src, 'drawable', 'splash.xml'))) {
    for (const d of readdirSync(RES)) if (d.startsWith('drawable')) stale.push(join(RES, d, 'splash.png'));
  }
  for (const old of stale) {
    if (existsSync(old)) {
      rmSync(old); n++;
      const dir = dirname(old);
      if (!readdirSync(dir).length) rmSync(dir, { recursive: true });
    }
  }
  return n;
}

function syncWebVersion() {
  const v = version().name;
  const p = join(ROOT, 'www', 'js', 'config.js');
  return write(p, read(p).replace(/NB\.VERSION = '[^']*'/, `NB.VERSION = '${v}'`));
}

function syncCapacitorRuntime() {
  const from = join(ROOT, 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js');
  const to = join(ROOT, 'www', 'js', 'vendor', 'capacitor.js');
  if (!existsSync(from)) fail('node_modules is missing.', 'Run "npm install" first (1-setup.bat does it for you).');
  return write(to, read(from));
}

/* ================= commands ================= */
function sync() {
  title('Sync: game → Android project');
  nodeOk();
  if (!existsSync(join(ROOT, 'node_modules'))) run('npm', ['install', '--no-audit', '--no-fund']);
  if (!existsSync(ANDROID)) fail('The android folder is missing.', 'Run setup first: double-click 1-setup.bat (or: npm run setup).');
  const ads = adsConfig();
  checkAds(ads);
  const v = version();
  if (syncCapacitorRuntime()) info('Updated www/js/vendor/capacitor.js');
  if (syncWebVersion()) info(`Game version set to ${v.name}`);
  const changed = [
    writeAdmobId(ads.appId) && 'AdMob App ID', patchManifest() && 'AndroidManifest.xml', patchStyles() && 'theme and splash colours',
    patchStrings() && 'app name', writeMainActivity() && 'MainActivity (full screen)', patchGradle() && 'build.gradle (version + signing)'
  ].filter(Boolean);
  const icons = copyBrandRes();
  if (changed.length) info('Updated: ' + changed.join(', '));
  if (icons) info(`Copied ${icons} icon / splash files`);
  run('npx', ['cap', 'sync', 'android']);
  ok(`Android project is up to date. Version ${v.name} (build ${v.code}).`);
  if (ads.testMode || ads.appId === TEST_APP_ID) warn('Ads are in TEST mode: "Test Ad" labels, no money. Perfect while testing.');
  else ok('Ads: REAL mode with your own IDs.');
}

function setup() {
  title('NEON BOOM setup');
  nodeOk();
  ok(`Node.js ${process.versions.node}`);
  run('npm', ['install', '--no-audit', '--no-fund']);
  if (!existsSync(ANDROID)) { info('Creating the Android project…'); run('npx', ['cap', 'add', 'android']); }
  sync();
  doctor(true);
  console.log('\n  Next: open the project in Android Studio (1-setup.bat does it), plug in your phone, press the green ▶ button.');
}

function ensureKeystore(javaHome) {
  const props = join(KEYS, 'keystore.properties');
  if (existsSync(props)) { ok('Upload key found in keys/'); return; }
  title('Creating your upload key (one time only)');
  const keytool = join(javaHome, 'bin', WIN ? 'keytool.exe' : 'keytool');
  const pass = randomBytes(18).toString('base64url');
  const file = 'neonboom-upload.jks';
  mkdirSync(KEYS, { recursive: true });
  const r = spawnSync(keytool, ['-genkeypair', '-keystore', join(KEYS, file), '-storetype', 'PKCS12', '-alias', 'upload',
    '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000', '-storepass', pass, '-keypass', pass,
    '-dname', 'CN=Neon Boom Upload Key'], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) fail('keytool could not create the key.');
  writeFileSync(props, `# NEON BOOM upload key. KEEP A COPY OF THIS FOLDER SOMEWHERE SAFE. Never share it, never put it on GitHub.\nstoreFile=${file}\nstorePassword=${pass}\nkeyAlias=upload\nkeyPassword=${pass}\n`);
  writeFileSync(join(KEYS, 'README.txt'),
`This folder holds the key that signs NEON BOOM for Google Play.

  * Back up the whole "keys" folder now (USB stick, Google Drive, password manager).
  * Never send it to anyone, never upload it to GitHub (.gitignore already blocks it).
  * If you lose it, Google Play support can reset it, but it takes days.
`);
  ok('Created keys/neonboom-upload.jks and keys/keystore.properties');
  warn('BACK UP THE "keys" FOLDER NOW (USB stick or Google Drive). Every future update must be signed with it.');
}

function release() {
  title('Release build for Google Play');
  nodeOk();
  const ads = adsConfig();
  checkAds(ads);
  if (!ads.testMode && ads.appId === TEST_APP_ID) {
    fail('TEST_MODE is false but the AdMob IDs are still Google\'s test IDs.', 'Paste your own IDs in www/js/ads-config.js, or set TEST_MODE back to true.');
  }
  const javaHome = findJava();
  if (!javaHome) fail('Java was not found.', 'Install Android Studio (it includes Java): https://developer.android.com/studio');
  const sdk = findSdk();
  if (!sdk) fail('The Android SDK was not found.', 'Open Android Studio once and finish its setup wizard; it downloads the SDK.');
  ok('Java: ' + javaHome);
  ok('Android SDK: ' + sdk);
  const lp = join(ANDROID, 'local.properties');
  if (!existsSync(lp)) writeFileSync(lp, 'sdk.dir=' + sdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:') + '\n');

  sync();
  ensureKeystore(javaHome);

  const v = version();
  title(`Building version ${v.name} (build ${v.code})… the first time takes a few minutes`);
  const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk };
  run(WIN ? 'gradlew.bat' : './gradlew', ['bundleRelease', 'assembleRelease'], { cwd: ANDROID, env });

  const out = join(ROOT, 'release');
  mkdirSync(out, { recursive: true });
  const base = `NeonBoom-${v.name}`;
  const aab = join(ANDROID, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
  const apk = join(ANDROID, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  if (!existsSync(aab)) fail('The .aab file was not produced.');
  copyFileSync(aab, join(out, base + '.aab'));
  if (existsSync(apk)) copyFileSync(apk, join(out, base + '.apk'));
  title('Done');
  ok(`release/${base}.aab  → upload this one to Google Play Console`);
  if (existsSync(apk)) ok(`release/${base}.apk  → or copy this one to a phone to install it directly`);
  if (ads.testMode) warn('This build shows TEST ads. Fine for internal / closed testing. For the public release: TEST_MODE: false + your real IDs.');
  console.log('\n  Next upload: raise "version" in package.json first (1.0.0 → 1.0.1). Google refuses the same build number twice.');
}

function doctor(quiet) {
  if (!quiet) title('Doctor');
  const line = (good, s) => (good ? ok : warn)(s);
  line(true, `Node.js ${process.versions.node}`);
  line(existsSync(join(ROOT, 'node_modules')), 'npm packages installed');
  line(existsSync(ANDROID), 'android/ project present');
  const j = findJava(), s = findSdk();
  line(!!j, 'Java (from Android Studio): ' + (j || 'not found, install Android Studio'));
  line(!!s, 'Android SDK: ' + (s || 'not found, open Android Studio once'));
  const a = adsConfig();
  line(!a.testMode && a.appId !== TEST_APP_ID, `AdMob: ${a.testMode ? 'TEST mode' : 'real ads'}, App ID ${a.appId === TEST_APP_ID ? '(Google test ID)' : a.appId}`);
  line(existsSync(join(KEYS, 'keystore.properties')), 'Upload key: ' + (existsSync(join(KEYS, 'keystore.properties')) ? 'keys/keystore.properties' : 'not created yet (the release command creates it)'));
  const v = version();
  line(true, `Version ${v.name} (build ${v.code}) · app id ${capConfig().appId}`);
}

const cmd = process.argv[2] || 'doctor';
const commands = { setup, sync, release, doctor: () => doctor(false) };
if (!commands[cmd]) { console.log('Usage: node tools/android.mjs setup | sync | release | doctor'); process.exit(1); }
try { commands[cmd](); }
catch (e) { if (!(e instanceof Stop)) console.error(e); process.exit(1); }
