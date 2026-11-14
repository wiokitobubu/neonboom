#!/usr/bin/env node
/* ==========================================================================
   NEON BOOM — renders every brand image with headless Chrome (or Edge).

     node tools/brand/build.mjs icons   app icons + launch screen   → assets/
     node tools/brand/build.mjs store   Play Store graphics         → store/
     node tools/brand/build.mjs         both

   Icons go to assets/android/res; "npm run sync" copies them into android/.
   Needs Google Chrome or Microsoft Edge installed (or set CHROME=/path/to/chrome).
   ========================================================================== */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, rmSync, mkdtempSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BRAND = pathToFileURL(join(ROOT, 'tools', 'brand', 'brand.html')).href;
const GAME = pathToFileURL(join(ROOT, 'www', 'index.html')).href;
const RES = join(ROOT, 'assets', 'android', 'res');
const STORE = join(ROOT, 'store');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- a tiny Chrome DevTools driver ---------------- */
function findChrome() {
  const c = [process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const p = c.find(x => x && existsSync(x));
  if (!p) { console.error('Chrome or Edge not found. Set CHROME=/path/to/chrome'); process.exit(1); }
  return p;
}

async function browser() {
  const port = 9400 + Math.floor(Math.random() * 400);
  const prof = mkdtempSync(join(os.tmpdir(), 'nb-brand-'));
  const proc = spawn(findChrome(), ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run',
    '--no-default-browser-check', '--allow-file-access-from-files', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch { /* starting */ }
  }
  if (!target) throw new Error('Chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'evaluate failed');
    return r.result?.result?.value;
  };
  await send('Runtime.enable'); await send('Page.enable');
  return {
    send, ev, errors,
    async open(url, w, h, dpr = 1, mobile = false) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile });
      await send('Page.navigate', { url });
      await sleep(1200);
    },
    async shot() { return Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'); },
    close() { ws.close(); proc.kill('SIGKILL'); setTimeout(() => rmSync(prof, { recursive: true, force: true }), 500); }
  };
}

function save(path, dataUrlOrBuf) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof dataUrlOrBuf === 'string' ? Buffer.from(dataUrlOrBuf.split(',')[1], 'base64') : dataUrlOrBuf);
  console.log('  ' + path.replace(ROOT + '/', '').replace(ROOT + '\\', ''));
}

/* ---------------- icons + splash ---------------- */
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function icons(b) {
  await b.open(BRAND, 400, 400);
  await b.ev('NBBrand.ready');
  const r = (k, w, h) => b.ev(`NBBrand.render(${JSON.stringify(k)}, ${w}, ${h || 0} || undefined)`);
  save(join(ROOT, 'assets', 'brand', 'icon-1024.png'), await r('icon', 1024));
  save(join(STORE, 'icon-512.png'), await r('icon', 512));
  for (const [d, k] of Object.entries(DENS)) {
    const a = Math.round(108 * k), l = Math.round(48 * k);
    save(join(RES, `mipmap-${d}`, 'ic_launcher_foreground.png'), await r('adaptiveFg', a));
    save(join(RES, `mipmap-${d}`, 'ic_launcher_background.png'), await r('adaptiveBg', a));
    save(join(RES, `mipmap-${d}`, 'ic_launcher_monochrome.png'), await r('monochrome', a));
    save(join(RES, `mipmap-${d}`, 'ic_launcher.png'), await r('legacy', l));
    save(join(RES, `mipmap-${d}`, 'ic_launcher_round.png'), await r('legacyRound', l));
  }
  // Launch screen: Android shows the adaptive icon on this colour (every Android version,
  // through the SplashScreen compat library), so a plain colour drawable is all it needs.
  save(join(RES, 'drawable', 'splash.xml'), Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/nb_background" />
</layer-list>
`));
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
  save(join(RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'), Buffer.from(adaptive));
  save(join(RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), Buffer.from(adaptive));
  save(join(RES, 'values', 'ic_launcher_background.xml'), Buffer.from(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#05030D</color>\n</resources>\n'));
}

/* ---------------- Play Store graphics ---------------- */
// Each scene stages the real game, then a headline is drawn above the capture.
const SCENES = [
  { file: '01-merge', title: 'MERGE THE CORES', sub: 'Two identical cores fuse into the next one', color: '#00F0FF', stage: 'board' },
  { file: '02-combo', title: 'CHAIN COMBOS', sub: 'Fast merges multiply every point', color: '#FF2BD6', stage: 'combo' },
  { file: '03-singularity', title: 'REACH THE SINGULARITY', sub: 'Eleven cores, from Spark to Singularity', color: '#9B6BFF', stage: 'home' },
  { file: '04-league', title: 'CLIMB THE LEAGUE', sub: 'A new weekly ranking every Monday', color: '#FFD640', stage: 'league' },
  { file: '05-overload', title: "DON'T OVERLOAD", sub: 'One core too many and the reactor blows', color: '#FF3D6E', stage: 'danger' }
];

const STAGE = `
window.__stage = async function (kind) {
  const g = NB.app.game, ui = NB.ui, p = NB.profile, wait = ms => new Promise(r => setTimeout(r, ms));
  p.tutorialDone = true; p.best = 48250; p.games = 37; p.merges = 1904; p.maxTier = 10;
  p.discovered = p.discovered.map((_, i) => i <= 10);
  p.league.division = 2; p.league.weekBest = 9800;
  NB.saveProfile();
  if (kind === 'home') { ui.showHome(); ui.refreshHome && ui.refreshHome(); await wait(1600); return; }
  if (kind === 'league') { ui.openLeague(); await wait(900); return; }
  NB.app.actions.newRun();
  await wait(500);
  ui.drawChain();
  const rows = kind === 'danger'
    ? [[8, 6, 7], [5, 9, 4], [6, 3, 5, 2], [7, 4, 8], [3, 6, 2], [5, 1, 7], [4, 6]]
    : [[8, 6, 7], [5, 9, 4], [3, 6, 2, 5], [1, 4, 0]];
  let y = 900;
  for (const row of rows) {
    const ws = row.map(t => NB.TIERS[t].r * 2), tot = ws.reduce((a, b) => a + b, 0);
    let x = 300 - tot / 2;
    row.forEach((t, i) => { x += ws[i] / 2; g.makeOrb(t, x, y - NB.TIERS[t].r, false); x += ws[i] / 2; });
    y -= Math.max(...ws) * 0.82;
  }
  await wait(kind === 'danger' ? 2200 : 2600);
  g.score = kind === 'danger' ? 27640 : kind === 'combo' ? 18930 : 12480;
  g.maxTier = 10; g.drops = 60;
  NB.bus.emit('score', { score: g.score, delta: 0 }); ui.scoreShown = g.score; ui.scoreTarget = g.score;
  g.aimX = 380;
  if (kind === 'combo') {
    g.combo = 4; g.lastMergeAt = g.clock;
    ui.combo(4, g.comboMult());
    g.fx.merge(210, 640, 4, 4); g.fx.merge(420, 560, 6, 4);
    await wait(260);
  }
  if (kind === 'board') { g.fx.merge(300, 520, 5, 1); await wait(240); }
  if (kind === 'danger') { g.danger = 1500; g.near = true; g.targetScale = 0.04; await wait(700); }
};`;

async function store(b) {
  // raw captures: a 360 × 640 phone at 3× = 1080 × 1920
  const raws = [];
  for (const s of SCENES) {
    await b.open(GAME, 360, 640, 3, true);
    await b.ev(STAGE);
    await b.ev(`__stage(${JSON.stringify(s.stage)})`);
    raws.push(await b.shot());
  }
  await b.open(BRAND, 400, 400);
  await b.ev('NBBrand.ready');
  save(join(STORE, 'feature-graphic.png'), await b.ev(`NBBrand.render('feature', 1024, 500)`));
  for (let i = 0; i < SCENES.length; i++) {
    const s = SCENES[i], src = 'data:image/png;base64,' + raws[i].toString('base64');
    const o = { title: s.title, sub: s.sub, color: s.color, src };
    save(join(STORE, 'screenshots', s.file + '.png'), await b.ev(`NBBrand.render('shot', 1080, 1920, ${JSON.stringify(o)})`));
    // a light copy for the website in docs/
    save(join(ROOT, 'docs', 'screenshots', s.file + '.webp'),
      await b.ev(`NBBrand.render('shot', 540, 960, ${JSON.stringify({ ...o, type: 'image/webp' })})`));
  }
}

/* The website in docs/ (GitHub Pages: home page + privacy policy) reuses the store art. */
function docs() {
  const DOCS = join(ROOT, 'docs');
  const pairs = [[join(STORE, 'icon-512.png'), join(DOCS, 'icon-512.png')],
    [join(STORE, 'feature-graphic.png'), join(DOCS, 'feature-graphic.png')],
    [join(ROOT, 'www', 'fonts', 'orbitron.woff2'), join(DOCS, 'fonts', 'orbitron.woff2')]];
  for (const [from, to] of pairs) if (existsSync(from)) { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); }
}

const what = process.argv[2] || 'all';
const b = await browser();
try {
  if (what === 'icons' || what === 'all') { console.log('Icons:'); await icons(b); }
  if (what === 'store' || what === 'all') { console.log('Play Store graphics:'); await store(b); }
  docs();
  if (b.errors.length) { console.error('Page errors:\n' + b.errors.join('\n')); process.exitCode = 1; }
} finally { b.close(); }
