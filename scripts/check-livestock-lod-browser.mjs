import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

// 显式补充低档近景证据；不改原浏览器回归和截图矩阵。依赖此模块完成后才启动原检查。
const screenshots = process.argv.includes('--screenshots');
const dir = process.env.LIVESTOCK_CHECK_DIR ?? '/tmp/wanhu-livestock-checks', base = 'http://127.0.0.1:4188';
mkdirSync(dir, { recursive: true }); if (screenshots) mkdirSync('review/livestock', { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4188', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let log = '', browser, page;
server.stdout.on('data', d => { log += d; }); server.stderr.on('data', d => { log += d; });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw new Error(log); try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
  assert(ready, 'LOD检查页面未启动');
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [], cases = [], images = [];
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const snapshot = () => page.evaluate(() => window.__LIVESTOCK_REVIEW__.snapshot());
  for (const [lod, triangles, logicalVertices] of [['lod1', 72, 46], ['lod2', 36, 26]]) {
    for (const motion of ['idle', 'walk', 'run', 'peck']) {
      const phase = motion === 'idle' ? .15 : .45, view = motion === 'peck' ? 'left' : 'three';
      await page.goto(`${base}/?lab=livestock&count=1&lod=${lod}&clip=${motion}&phase=${phase}&paused=1&view=${view}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(id => window.__LIVESTOCK_REVIEW__?.snapshot().lod === id, lod); await page.waitForTimeout(200);
      const before = await snapshot();
      assert.equal(before.triangles, triangles); assert.equal(before.logicalVertices, logicalVertices); assert.equal(before.motion, motion); assert.equal(before.playing, false);
      assert(Math.abs(before.phase - phase) < 1e-6); assert.equal(await page.locator('canvas').count(), 1);
      // 真实切换档位，确保不会重置暂停相位、动作和相机；返回时重用相同几何。
      await page.getByTestId('livestock-lod-lod0').click(); await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__.snapshot().lod === 'lod0');
      await page.getByTestId(`livestock-lod-${lod}`).click(); await page.waitForFunction(id => window.__LIVESTOCK_REVIEW__.snapshot().lod === id, lod);
      const after = await snapshot();
      assert.equal(after.geometryId, before.geometryId); assert.equal(after.phase, before.phase); assert.equal(after.motion, before.motion); assert.deepEqual(after.camera, before.camera);
      if (screenshots && (motion === 'idle' || motion === 'peck')) {
        const index = lod === 'lod1' ? (motion === 'idle' ? '05' : '06') : (motion === 'idle' ? '07' : '08');
        const name = `${index}-${lod}-${motion === 'idle' ? 'single' : 'peck'}.png`;
        await page.locator('.livestock-viewport').screenshot({ path: `review/livestock/${name}` });
        images.push({ name, lod, motion, phase, triangles, camera: after.camera });
      }
      cases.push({ lod, motion, triangles, logicalVertices, phase });
    }
  }
  assert.deepEqual(errors, []);
  const result = { result: 'passed', sourceSHA: process.env.REVIEW_HEAD_SHA ?? 'local', viewport: '1600x1000', cases, images, errors };
  writeFileSync(`${dir}/lod-browser.json`, JSON.stringify(result, null, 2));
  if (screenshots) writeFileSync('review/livestock/lod-evidence.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  if (screenshots && page && !page.isClosed()) await page.screenshot({ path: 'review/livestock/lod-failure.png', fullPage: true }).catch(() => {});
  writeFileSync(`${dir}/lod-browser-failure.txt`, `${error.stack ?? error}\n${log}`); throw error;
} finally { await browser?.close(); server.kill('SIGTERM'); }
