// Screenshot + tap automation for the local preview, using the installed Google Chrome over the
// DevTools protocol (no npm dependencies). Usage:
//   node tools/shoot.mjs jobs.json
// jobs.json: [{ "url": "...", "width": 390, "height": 844, "out": "shot.png",
//               "steps": [{ "wait": 500 }, { "tap": "[data-testid=stamp-s1]" }, { "eval": "..." },
//                         { "shot": "mid.png" }] }]
// Taps dispatch real touch events at the element's centre, like a finger would.

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333 + Math.floor(Math.random() * 500);
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'op-shoot-'))}`,
    '--no-first-run',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const connect = async () => {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (
        await fetch(`http://127.0.0.1:${PORT}/json/list`)
      ).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('Chrome did not start');
};

const ws = new WebSocket(await connect());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(String(event.data));
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push(
      `[console.${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`
    );
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    logs.push(
      `[exception] ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`
    );
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (msg) =>
      msg.error
        ? reject(new Error(`${method}: ${msg.error.message}`))
        : resolve(msg.result)
    );
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');

const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ?? 'eval failed'
    );
  return result.result.value;
};

const shot = async (file) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`saved ${file}`);
};

const tap = async (selector) => {
  const box = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) throw new Error(`No element for ${selector}`);
  const point = [{ x: box.x, y: box.y }];
  await send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: point,
  });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(60);
};

const key = async (k) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k });
};

for (const job of jobs) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: job.width,
    height: job.height,
    deviceScaleFactor: 2,
    mobile: job.width < 800,
  });
  await send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 1,
  });
  if (job.reducedMotion) {
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
  }
  await send('Page.navigate', { url: job.url });
  await sleep(job.settle ?? 1200);
  for (const step of job.steps ?? []) {
    if (step.wait) await sleep(step.wait);
    if (step.tap) await tap(step.tap);
    if (step.key) await key(step.key);
    if (step.eval)
      console.log('eval →', JSON.stringify(await evaluate(step.eval)));
    if (step.navigate) {
      await send('Page.navigate', { url: step.navigate });
      await sleep(step.settle ?? 1200);
    }
    if (step.shot) await shot(step.shot);
  }
  if (job.out) await shot(job.out);
}

if (logs.length) console.log(logs.join('\n'));
ws.close();
chrome.kill();
process.exit(0);
