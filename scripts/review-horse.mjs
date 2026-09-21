import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.REVIEW_URL ?? 'http://127.0.0.1:4173';
const output = path.resolve(process.env.HORSE_REVIEW_DIR ?? 'review/horse');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1040 }, deviceScaleFactor: 1 });
const page = await context.newPage(), errors = [], shots = [], interactions = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const report = { sourceSHA: process.env.REVIEW_HEAD_SHA ?? process.env.GITHUB_SHA ?? 'local', screenshots: shots, interactions, errors, passed: false };
const clips = [['Horse_Idle', 'idle'], ['Horse_Walk', 'walk'], ['Horse_Run', 'run'], ['Horse_Eat', 'eat']];
const phases = [0, .125, .25, .375, .5, .625, .75, .875];
const views = ['front', 'left', 'right', 'back', 'three', 'rear-three'];
const pause = async () => {
  const button = page.getByTestId('horse-play');
  if (!(await button.isDisabled()) && (await button.textContent()).includes('暂停')) await button.click();
  await page.waitForTimeout(100);
};
const select = async id => {
  await page.getByTestId(id).click(); await page.waitForFunction(id => window.__HORSE_REVIEW__?.getStatus().clip === id, id); await pause();
};
const seek = async phase => { await page.evaluate(phase => window.__HORSE_REVIEW__.seek(phase), phase); await page.waitForTimeout(35); };
const view = async name => { await page.getByTestId('horse-view-' + name).click(); await page.waitForTimeout(60); };
async function capture(name, metadata = {}) {
  const file = name + '.png';
  await page.getByTestId('horse-viewport').screenshot({ path: path.join(output, file) });
  const status = await page.evaluate(() => ({ status: window.__HORSE_REVIEW__.getStatus(), camera: window.__HORSE_REVIEW__.cameraState(), finite: window.__HORSE_REVIEW__.matricesFinite() }));
  assert(status.finite, `非法骨骼矩阵 ${name}`);
  shots.push({ file, ...metadata, ...status });
}
async function sheet(name, selected, columns = 3) {
  const sheetPage = await context.newPage(), width = 420, items = [];
  for (const item of selected) {
    const image = await fs.readFile(path.join(output, item.file));
    items.push(`<article><img src="data:image/png;base64,${image.toString('base64')}"/><p>${item.label ?? item.file.replace('.png', '')}</p></article>`);
  }
  await sheetPage.setViewportSize({ width: columns * width, height: 1000 });
  await sheetPage.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;background:#172a2e;color:#ddd8c6;font:12px Arial,sans-serif}h1{font-size:17px;letter-spacing:1px;font-weight:normal;margin:0;padding:18px}main{display:grid;grid-template-columns:repeat(${columns},${width}px)}article{margin:0;border:1px solid #455455}img{display:block;width:100%;background:#2b4044}p{margin:0;padding:9px 12px;font-size:11px}</style></head><body><h1>WANHU HORSE / ${name} / ${report.sourceSHA.slice(0, 8)}</h1><main>${items.join('')}</main></body></html>`);
  await sheetPage.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await sheetPage.screenshot({ path: path.join(output, name + '.jpg'), fullPage: true, quality: 92 }); await sheetPage.close();
}
try {
  await page.goto(base + '/?lab=horse&review=1&pose=bind&paused=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__HORSE_REVIEW__?.stats.triangles));
  await page.getByTestId('workspace-character').waitFor();
  assert.equal(await page.getByTestId('workspace-animal').getAttribute('aria-current'), 'page', '动物工坊入口未标记当前工作区');
  assert.equal(await page.getByTestId('workspace-character').getAttribute('href'), './', '人物工坊返回入口错误');
  const geometryId = await page.evaluate(() => window.__HORSE_REVIEW__.geometryId());
  report.stats = await page.evaluate(() => window.__HORSE_REVIEW__.stats);
  for (const angle of views) { await view(angle); await capture('static-' + angle, { clip: 'bind', view: angle, phase: 0 }); }
  await sheet('horse-static-overview', shots.filter(shot => shot.clip === 'bind'));
  for (const [id, label] of clips) {
    await select(id);
    assert.equal(await page.evaluate(() => window.__HORSE_REVIEW__.geometryId()), geometryId);
    for (const angle of ['front', 'left', 'three']) {
      await view(angle);
      for (const phase of phases) {
        await seek(phase); await capture(`${label}-${angle}-${String(Math.round(phase * 1000)).padStart(3, '0')}`, { clip: id, view: angle, phase });
      }
    }
    for (const [half, part] of [[0, 'a'], [1, 'b']]) {
      const group = [];
      for (const phase of phases.slice(half * 4, half * 4 + 4)) for (const angle of ['front', 'left', 'three']) group.push(shots.find(shot => shot.clip === id && shot.view === angle && shot.phase === phase));
      await sheet(`horse-${label}-${part}`, group);
    }
    await seek(.25);
    const before = await page.evaluate(() => window.__HORSE_REVIEW__.getStatus());
    await page.getByTestId('horse-next').click(); await page.waitForTimeout(100);
    const next = await page.evaluate(() => window.__HORSE_REVIEW__.getStatus());
    assert(Math.abs(next.time - before.time - 1 / 30) < .001, '逐帧不等于1/30秒');
    await page.getByTestId('horse-previous').click(); await page.waitForTimeout(100);
    const previous = await page.evaluate(() => window.__HORSE_REVIEW__.getStatus());
    assert(Math.abs(previous.time - before.time) < .001, '上一帧不能返回');
    await view('right');
    assert(Math.abs((await page.evaluate(() => window.__HORSE_REVIEW__.getStatus())).phase - .25) < .001, '切相机改变暂停相位');
    await page.getByTestId('horse-play').click(); await page.waitForTimeout(210); await pause();
    assert.notEqual((await page.evaluate(() => window.__HORSE_REVIEW__.getStatus())).phase, .25, '实际播放没有前进');
    interactions.push({ clip: id, checks: ['网格复用', '下一帧', '上一帧', '暂停换相机保相位', '真实播放推进'], passed: true });
  }
  await select('Horse_Run');
  await page.getByRole('checkbox', { name: '马动画循环', exact: true }).uncheck(); await seek(.98);
  await page.getByTestId('horse-play').click(); await page.waitForTimeout(500);
  assert((await page.evaluate(() => window.__HORSE_REVIEW__.getStatus())).finished, '单次动画没有结束保持');
  await page.getByRole('checkbox', { name: '马动画循环', exact: true }).check(); await seek(.98);
  await page.getByTestId('horse-play').click(); await page.waitForTimeout(300); await pause();
  assert((await page.evaluate(() => window.__HORSE_REVIEW__.getStatus())).phase < .9, '循环没有跨越末帧');
  await page.getByRole('combobox', { name: '马动画速度', exact: true }).selectOption('0.5'); await seek(.1);
  await page.getByTestId('horse-play').click(); await page.waitForTimeout(250); await pause();
  assert((await page.evaluate(() => window.__HORSE_REVIEW__.getStatus())).phase > .1, '变速播放未推进');
  interactions.push({ checks: ['单次结束保持', '末帧循环', '变速播放'], passed: true });
  await page.getByTestId('horse-bind').click(); await view('three');
  await page.getByTestId('horse-display-clay').click(); await capture('static-clay-three', { clip: 'bind', view: 'three', display: 'clay' });
  await page.getByTestId('horse-display-beauty').click(); await page.getByRole('checkbox', { name: '马骨架', exact: true }).check();
  await capture('static-skeleton-three', { clip: 'bind', view: 'three', skeleton: true });
  await page.getByRole('checkbox', { name: '马骨架', exact: true }).uncheck();
  await select('Horse_Idle'); await seek(.25); await view('three');
  await page.screenshot({ path: path.join(output, 'horse-workbench.png'), fullPage: true });
  await page.locator('.horse-topbar').screenshot({ path: path.join(output, 'workspace-switcher-animal.png') });
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(100);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '手机宽度横向溢出');
  await page.screenshot({ path: path.join(output, 'horse-mobile.png'), fullPage: true });
  // 回到人物默认入口仅做冒烟检查，原完整人物矩阵由六条正式Actions继续执行。
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.goto(base + '/?review=1&pose=bind&paused=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__WANHU_REVIEW__?.stats.triangles));
  assert.equal(await page.evaluate(() => window.__WANHU_REVIEW__.stats.bones), 20);
  assert.equal(await page.evaluate(() => window.__WANHU_RECIPE__().version), 5);
  await page.getByTestId('workspace-animal').waitFor();
  assert.equal(await page.getByTestId('workspace-character').getAttribute('aria-current'), 'page', '人物工坊入口未标记当前工作区');
  assert.equal(await page.getByTestId('workspace-animal').getAttribute('href'), '?lab=horse', '动物工坊入口地址错误');
  await page.locator('.topbar').screenshot({ path: path.join(output, 'workspace-switcher-character.png') });
  interactions.push({ checks: ['390px页面无横溢出', '原人物20骨骼', '原Recipe V5', '顶部人物/动物工作区切换'], passed: true });
  assert.equal(errors.length, 0, errors.join('\n')); report.passed = true;
} catch (error) {
  errors.push(String(error)); await page.screenshot({ path: path.join(output, 'horse-failure.png'), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  const files = (await fs.readdir(output)).filter(file => /\.(png|jpg)$/.test(file));
  report.imageSHA256 = Object.fromEntries(await Promise.all(files.map(async file => [file, crypto.createHash('sha256').update(await fs.readFile(path.join(output, file))).digest('hex')])));
  await fs.writeFile(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, stats: report.stats, screenshots: shots.length, interactions, errors }));
  await browser.close();
}
