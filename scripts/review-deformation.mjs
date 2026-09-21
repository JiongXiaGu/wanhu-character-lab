import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const quick = process.argv.includes('--quick');
const stage = process.env.REVIEW_STAGE ?? 'after';
assert(/^[a-zA-Z0-9_-]+$/.test(stage), 'Invalid review stage');
const root = `review-deformation/${stage}`;
const base = process.env.REVIEW_URL ?? 'http://127.0.0.1:4173';
assert(['http:', 'https:'].includes(new URL(base).protocol));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const checkoutSha = git('rev-parse', 'HEAD');
const dirtyTrackedFiles = git('status', '--porcelain', '--untracked-files=no');
const captureEnvironment = process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local-browser';
await mkdir(root, { recursive: true });

const errors = [], records = [];
let browser, context, page, failure = '';
async function capture(bodyType, fit, clip, view, display, phase) {
  const query = new URLSearchParams({
    review: '1', paused: '1', preset: 'body', bodyType, top: 'body',
    bottom: fit === 'skin' ? 'body' : 'work_pants', shoes: 'body',
    headwear: 'none', back: 'none', leftHand: 'none', rightHand: 'none', view, display,
    ...(clip === 'bind' ? { pose: 'bind' } : { mixamo: clip }),
  });
  await page.goto(`${base}/?${query}`);
  await page.waitForFunction(() => window.__WANHU_REVIEW__?.stats.bones === 20);
  if (clip !== 'bind') await page.waitForFunction(() => window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
  const recipe = await page.evaluate(() => window.__WANHU_RECIPE__());
  assert.equal(recipe.bodyType, bodyType);
  assert.equal(recipe.slots.bottom, fit === 'skin' ? 'body' : 'work_pants');
  recipe.dyes = { primary: '#d4c4a9', secondary: '#d5d2c5', accent: '#6f7b78' };
  await page.getByLabel('导入配方文件', { exact: true }).setInputFiles({
    name: 'review.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(recipe)),
  });
  await page.waitForFunction(() => window.__WANHU_RECIPE__().dyes.secondary === '#d5d2c5');
  if (clip !== 'bind') await page.waitForFunction(() => window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
  await page.evaluate(value => window.__WANHU_REVIEW__.seek(value), phase);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const status = await page.evaluate(() => window.__WANHU_REVIEW__.getStatus());
  if (clip !== 'bind') assert(Math.abs(status.phase - phase) < 1e-6);
  assert(!status.loadError);
  const camera = await page.evaluate(() => window.__WANHU_REVIEW__.cameraState());
  const stats = await page.evaluate(() => window.__WANHU_REVIEW__.stats);
  const box = await page.getByTestId('viewport').boundingBox();
  assert(box && box.width > 0 && box.height > 0);
  const file = `${bodyType}-${fit}-${clip}-${view}-${display}-${phase}.png`;
  await page.getByTestId('viewport').screenshot({ path: `${root}/${file}` });
  records.push({ file, bodyType, fit, clip, view, display, phase, camera, stats, viewport: { width: box.width, height: box.height } });
}

try {
  browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-webgl'] });
  context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const poses = quick ? [['bind', 0], ['pilot-switches', 0.5]] : [['bind', 0], ['pilot-switches', 0.5], ['snatch', 0.05]];
  for (const bodyType of ['male', 'female']) {
    for (const fit of ['skin', 'pants']) {
      for (const [clip, phase] of poses) {
        // free 是既有默认斜视相机，three 是三视图分屏，二者不能混淆。
        for (const view of ['front', 'side', 'back', 'free']) {
          for (const display of quick ? ['beauty'] : ['beauty', 'cage']) {
            await capture(bodyType, fit, clip, view, display, phase);
          }
        }
      }
    }
  }
  if (!quick) {
    for (const bodyType of ['male', 'female']) for (const fit of ['skin', 'pants']) {
      for (const clip of ['pilot-switches', 'snatch', 'jogging']) for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
        await capture(bodyType, fit, clip, 'side', 'unlit', phase);
      }
    }
  }
  assert.equal(records.length, quick ? 32 : 156);
  assert.deepEqual(errors, []);
} catch (error) {
  failure = String(error);
  throw error;
} finally {
  await writeFile(`${root}/report.json`, JSON.stringify({
    sourceSha: process.env.REVIEW_HEAD_SHA ?? checkoutSha,
    checkoutSha, dirtyTrackedFiles, captureEnvironment, serverUrl: base,
    stage, mode: quick ? 'quick' : 'full', records, errors, failure,
    passed: !failure && !errors.length, manualApproval: false, videoCapture: false,
    note: 'Actual browser screenshots, not source-geometry reconstruction. Checkout SHA is recorded; a separately supplied REVIEW_URL must serve that checkout. Image review and full numerical/interaction checks are separate.',
  }, null, 2));
  await context?.close();
  await browser?.close();
}
console.log(`PASS ${captureEnvironment}: ${records.length} screenshots; manual review remains separate`);
