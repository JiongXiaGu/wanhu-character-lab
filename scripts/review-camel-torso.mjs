import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

// 用户要求建模审查时显式运行，不并入默认数值/浏览器检查，不运行手机矩阵。
const root = process.cwd(), output = path.resolve(process.env.CAMEL_TORSO_REVIEW_DIR || 'review/camel-torso');
await fs.mkdir(output, { recursive: true });
const sourceSHA = process.env.REVIEW_HEAD_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const shots = [], errors = [], sources = {};
let browser, server;
const report = { sourceSHA, result: 'failed', sources, shots, errors, visualApproval: false };
async function captureWorkspace(dir, label, port) {
  sources[label] = { sha: execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), geometrySHA256: createHash('sha256').update(await fs.readFile(path.join(dir, 'src/camel/geometry.ts'))).digest('hex') };
  server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), dir, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: dir, stdio: 'inherit' });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 200; i++) {
    assert(server.exitCode === null, 'review server exited');
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  assert(ready, 'review server did not start');
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); page.setDefaultTimeout(45000);
  page.on('pageerror', e => errors.push(`${label}: ${String(e)}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${label}: ${m.text()}`); });
  const cases = [
    ['body-three', 'mount', 'none', 'bind', 0, 'three'],
    ['body-left', 'mount', 'none', 'bind', 0, 'left'],
    ['rider-simple', 'riding', 'simple', 'pose', 0, 'three'],
  ];
  if (label === 'after') cases.push(
    ['body-rear', 'mount', 'none', 'bind', 0, 'rear-three'],
    ['body-front', 'mount', 'none', 'bind', 0, 'front'],
    ['rider-travel', 'riding', 'travel', 'Rider_Walk', .375, 'three'],
    ['rider-run', 'riding', 'simple', 'Rider_Run', .625, 'three'],
    ['body-eat', 'mount', 'none', 'eat', .5, 'left'],
  );
  for (const [name, lab, saddle, clip, phase, view] of cases) {
    const params = new URLSearchParams({ lab, mount: 'camel_bactrian', saddle, clip, phase: String(phase), paused: '1', review: '1', bodyType: 'male' });
    await page.goto(`${base}/?${params}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(lab => (lab === 'mount' ? window.__MOUNT_REVIEW__ : window.__RIDING_REVIEW__)?.mountId() === 'camel_bactrian', lab);
    await page.getByTestId(`${lab === 'mount' ? 'horse' : 'riding'}-view-${view}`).click();
    await page.waitForTimeout(120);
    const state = await page.evaluate(lab => { const r = lab === 'mount' ? window.__MOUNT_REVIEW__ : window.__RIDING_REVIEW__; return { finite: r.matricesFinite(), status: r.getStatus(), camera: r.cameraState(), stats: typeof r.stats === 'function' ? r.stats() : r.stats }; }, lab);
    assert(state.finite); assert.equal(await page.locator('canvas').count(), 1);
    const file = `${label}-${name}.png`; await page.locator('canvas').screenshot({ path: path.join(output, file) });
    shots.push({ file, label, lab, saddle, clip, phase, view, ...state });
  }
  await context.close(); server.kill('SIGTERM'); await new Promise(resolve => server.once('exit', resolve)); server = undefined;
}
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  if (process.env.CAMEL_BEFORE_DIR) await captureWorkspace(path.resolve(process.env.CAMEL_BEFORE_DIR), 'before', 4185);
  await captureWorkspace(root, 'after', 4186);
  const sheet = await browser.newPage({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 1 });
  const entries = [];
  for (const name of ['body-three', 'body-left', 'rider-simple']) for (const label of ['before', 'after']) {
    const shot = shots.find(s => s.file === `${label}-${name}.png`); if (!shot) continue;
    entries.push(`<article><h2>${label.toUpperCase()} / ${name} / ${sources[label].sha.slice(0, 8)}</h2><img src="data:image/png;base64,${(await fs.readFile(path.join(output, shot.file))).toString('base64')}"/></article>`);
  }
  await sheet.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;background:#263c3e;color:#eee4d0;font:14px Arial}main{display:grid;grid-template-columns:repeat(2,680px)}article{margin:0;border:1px solid #627072}h2{font-size:14px;margin:0;padding:12px}img{display:block;width:100%}</style></head><body><main>${entries.join('')}</main></body></html>`);
  await sheet.locator('img').evaluateAll(images => Promise.all(images.map(i => i.decode())));
  await sheet.screenshot({ path: path.join(output, 'before-after.png'), fullPage: true }); await sheet.close();
  assert.deepEqual(errors, []); report.result = 'passed';
} catch (error) { errors.push(String(error?.stack || error)); process.exitCode = 1; }
finally {
  server?.kill('SIGTERM'); await browser?.close();
  report.imageSHA256 = Object.fromEntries(await Promise.all((await fs.readdir(output)).filter(f => f.endsWith('.png')).map(async file => [file, createHash('sha256').update(await fs.readFile(path.join(output, file))).digest('hex')])));
  await fs.writeFile(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
