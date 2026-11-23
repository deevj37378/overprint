// Renders the subreddit icon (256×256 artwork, saved at 1024×1024) and banner (1920×384) in the riso style.
// SVG/HTML → PNG through the installed Google Chrome (DevTools protocol), using the bundled fonts.
// Usage: node tools/make-art.mjs   → writes assets/icon.png and assets/banner.png

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..'
);
const out = path.join(root, 'assets');
mkdirSync(out, { recursive: true });
const font = (file) =>
  pathToFileURL(path.join(root, 'node_modules/@fontsource', file)).href;

const INK = { blue: '#0078BF', pink: '#FF48B0', yellow: '#FFE800' };
const grain = `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/>
<feColorMatrix values="0 0 0 0 .13 0 0 0 0 .1 0 0 0 0 .08 0 0 0 .5 0"/></filter>
<filter id="rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="4" result="r"/><feTurbulence type="fractalNoise" baseFrequency=".5" result="s"/>
<feColorMatrix in="s" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.3 1.5" result="a"/><feComposite in="r" in2="a" operator="in"/></filter>`;

/** Cells (in grid units) for each ink: a little print with overlaps. */
const cells = (u, ox, oy, list) =>
  list
    .map(
      ([c, r, w = 1, h = 1]) =>
        `<rect x="${ox + c * u}" y="${oy + r * u}" width="${w * u}" height="${h * u}"/>`
    )
    .join('');

const page = (w, h, body) => `<!doctype html><html><head><style>
@font-face { font-family: 'Bricolage Grotesque'; font-weight: 800; src: url('${font('bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff2')}'); }
@font-face { font-family: 'DM Mono'; font-weight: 500; src: url('${font('dm-mono/files/dm-mono-latin-500-normal.woff2')}'); }
html,body { margin:0; width:${w}px; height:${h}px; overflow:hidden; background:#F4EFE6; }
svg { display:block; }
.ink { mix-blend-mode: multiply; }
</style></head><body>${body}</body></html>`;

const icon = () => {
  const u = 40;
  const ox = 48;
  const oy = 48;
  return page(
    256,
    256,
    `<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
<defs>${grain}</defs>
<rect width="256" height="256" rx="0" fill="#F4EFE6"/>
<g class="ink" fill="${INK.yellow}" filter="url(#rough)" transform="translate(1,2)">${cells(
      u,
      ox,
      oy,
      [
        [1, 0, 1, 4],
        [0, 2, 4, 1],
      ]
    )}</g>
<g class="ink" fill="${INK.pink}" filter="url(#rough)" transform="translate(2,-1)">${cells(
      u,
      ox,
      oy,
      [
        [2, 1, 2, 2],
        [3, 3],
      ]
    )}</g>
<g class="ink" fill="${INK.blue}" filter="url(#rough)" transform="translate(-1,0)">${cells(
      u,
      ox,
      oy,
      [
        [0, 0, 2, 1],
        [0, 1],
        [2, 0, 1, 2],
      ]
    )}</g>
<rect width="256" height="256" filter="url(#grain)" opacity=".35"/>
</svg>`
  );
};

const banner = () => {
  const u = 64;
  const ox = 1360;
  const oy = 64;
  return page(
    1920,
    384,
    `<div style="position:relative;width:1920px;height:384px">
<svg width="1920" height="384" viewBox="0 0 1920 384" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0">
<defs>${grain}</defs>
<g class="ink" fill="${INK.yellow}" filter="url(#rough)" transform="translate(2,3)">${cells(
      u,
      ox,
      oy,
      [
        [1, 0, 1, 4],
        [0, 2, 5, 1],
        [6, 1, 1, 3],
      ]
    )}</g>
<g class="ink" fill="${INK.pink}" filter="url(#rough)" transform="translate(3,-1)">${cells(
      u,
      ox,
      oy,
      [
        [2, 1, 2, 2],
        [3, 3],
        [5, 0, 2, 1],
        [6, 1],
      ]
    )}</g>
<g class="ink" fill="${INK.blue}" filter="url(#rough)">${cells(u, ox, oy, [
      [0, 0, 2, 1],
      [0, 1],
      [2, 0, 1, 2],
      [4, 2, 1, 2],
      [5, 3],
    ])}</g>
<g stroke="#221B16" stroke-width="3" opacity=".55"><path d="M1320 40h24M1332 28v24M1832 344h24M1844 332v24"/></g>
<rect width="1920" height="384" filter="url(#grain)" opacity=".35"/>
</svg>
<div style="position:absolute;left:120px;top:96px;font-family:'Bricolage Grotesque';font-weight:800;font-size:150px;letter-spacing:-0.03em;line-height:1">
  <span style="position:relative;display:block;color:${INK.yellow};transform:translate(6px,7px)">Overprint</span>
  <span class="ink" style="position:absolute;inset:0;color:${INK.pink};transform:translate(4px,-1px)">Overprint</span>
  <span class="ink" style="position:absolute;inset:0;color:${INK.blue}">Overprint</span>
</div>
<div style="position:absolute;left:126px;top:268px;font-family:'DM Mono';font-weight:500;font-size:30px;color:#221B16;letter-spacing:.02em">
  a daily riso-print puzzle · layer the inks, match the proof
</div>
</div>`
  );
};

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9800 + Math.floor(Math.random() * 100);
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'op-art-'))}`,
    '--allow-file-access-from-files',
    'about:blank',
  ],
  { stdio: 'ignore' }
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try {
    wsUrl = (
      await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    ).find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch {}
  if (!wsUrl) await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && pending.has(m.id)) pending.get(m.id)(m.result);
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

const tmp = mkdtempSync(path.join(tmpdir(), 'op-art-html-'));
for (const [name, w, h, html, scale] of [
  ['icon', 256, 256, icon(), 4],
  ['banner', 1920, 384, banner(), 1],
]) {
  const file = path.join(tmp, `${name}.html`);
  writeFileSync(file, html);
  await send('Emulation.setDeviceMetricsOverride', {
    width: w,
    height: h,
    deviceScaleFactor: scale,
    mobile: false,
  });
  await send('Page.navigate', { url: pathToFileURL(file).href });
  await sleep(1200);
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: w, height: h, scale: 1 },
  });
  writeFileSync(path.join(out, `${name}.png`), Buffer.from(data, 'base64'));
  // Reddit caps the app icon at 500 KB; the grain makes a full-colour PNG ~1.3 MB.
  // A 256-colour palette (ImageMagick) keeps the look at ~240 KB.
  if (name === 'icon') {
    const file = path.join(out, 'icon.png');
    execFileSync('magick', [
      file,
      '-dither',
      'FloydSteinberg',
      '-colors',
      '256',
      '-define',
      'png:compression-level=9',
      `PNG8:${file}`,
    ]);
  }
  console.log(`wrote assets/${name}.png (${w * scale}×${h * scale})`);
}
ws.close();
chrome.kill();
process.exit(0);
