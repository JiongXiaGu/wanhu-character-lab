import assert from 'node:assert/strict';
import { mkdir, stat, writeFile, rename } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';

const dir = 'review-tailoring';
const base = process.env.REVIEW_URL ?? 'http://127.0.0.1:4173';
const records: string[] = [], videos: string[] = [], errors: string[] = [];
const clips = ['jogging', 'shooting-arrow', 'pilot-switches'] as const;
const phases = [0, .125, .25, .375, .5, .625, .75, .875, 1];
const samples = [
  { id: 'labor', look: 'plain', top: 'rough_tunic', bottom: 'loose_trousers' },
  { id: 'daily', look: 'town', top: 'cross_jacket', bottom: 'pleated_skirt' },
  { id: 'ceremony', look: 'ceremony', top: 'ceremony_robe', bottom: 'robe_skirt' },
] as const;
let failure = '';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-webgl'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
function observe(p: Page): void {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
}
observe(page);
function params(sample: typeof samples[number], bodyType: string): Record<string, string> {
  return { look: `${sample.look}-${bodyType}`, bodyType, top: sample.top, bottom: sample.bottom,
    leftHand: 'none', rightHand: 'none', back: 'none', headwear: 'none' };
}
async function open(p: Page, values: Record<string, string>): Promise<void> {
  await p.goto(`${base}/?${new URLSearchParams({ review: '1', pose: 'bind', paused: '1', ...values })}`);
  await p.waitForFunction(() => window.__WANHU_REVIEW__?.stats.bones === 20);
  if (values.mixamo) await p.waitForFunction(() => window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
  assert.equal(await p.locator('.error-panel').count(), 0);
  assert(await p.locator('canvas').isVisible());
}
async function shot(name: string): Promise<void> {
  await page.waitForTimeout(140);
  await page.screenshot({ path: `${dir}/${name}.png` });
  assert((await stat(`${dir}/${name}.png`)).size > 10000);
  records.push(`${name}.png`);
}
async function seek(p: Page, phase: number): Promise<void> {
  await p.evaluate(t => window.__WANHU_REVIEW__!.seek(t), phase);
  assert(Math.abs((await p.evaluate(() => window.__WANHU_REVIEW__!.getStatus().phase)) - phase) < 1e-5);
}
try {
  // Three independent silhouettes, two bodies and two actual mesh levels.
  for (const sample of samples) for (const bodyType of ['male', 'female']) for (const lod of ['0', '2']) {
    const key = `${sample.id}-${bodyType}-lod${lod}`;
    await open(page, { ...params(sample, bodyType), lod });
    for (const [view, label] of [['front', '正面'], ['side', '侧面'], ['back', '背面']]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await shot(`${key}-bind-${view}`);
    }
    await page.getByRole('button', { name: '素模', exact: true }).click();
    await page.getByRole('button', { name: '正面', exact: true }).click();
    await shot(`${key}-clay`);
    for (const mixamo of clips) {
      await open(page, { ...params(sample, bodyType), lod, pose: '', mixamo, view: 'three' });
      for (const phase of phases) {
        await seek(page, phase);
        await shot(`${key}-${mixamo}-${String(Math.round(phase * 1000)).padStart(4, '0')}`);
      }
    }
    console.log('REVIEW tailoring', key);
  }
  // Body extremes are examined in the user's seated test, not only in a bind pose.
  for (const sample of samples) for (const bodyType of ['male', 'female']) for (const [height, build] of [['1.58', '0'], ['1.92', '1']]) {
    await open(page, { ...params(sample, bodyType), height, build, lod: '0', pose: '', mixamo: 'pilot-switches', view: 'three' });
    for (const phase of [.125, .5, .875]) {
      await seek(page, phase);
      await shot(`${sample.id}-${bodyType}-${height}-seated-${Math.round(phase * 1000)}`);
    }
  }
  // Changing LOD must really rebuild a smaller garment without rewriting Recipe or time.
  for (const bodyType of ['male', 'female']) {
    await open(page, { ...params(samples[2], bodyType), pose: '', mixamo: 'pilot-switches', phase: '.45', lod: '0', view: 'side' });
    const before = await page.evaluate(() => ({ recipe: JSON.stringify(window.__WANHU_RECIPE__!()), phase: window.__WANHU_REVIEW__!.getStatus().phase,
      triangles: window.__WANHU_REVIEW__!.stats.triangles, geometry: window.__WANHU_REVIEW__!.geometryId() }));
    for (const lod of ['2', '0']) {
      await page.getByLabel('模型细节', { exact: true }).selectOption(lod);
      await page.waitForFunction(expected => window.__WANHU_REVIEW__?.getLod() === expected && window.__WANHU_REVIEW__?.getStatus().mixamo?.ready, Number(lod));
      const after = await page.evaluate(() => ({ recipe: JSON.stringify(window.__WANHU_RECIPE__!()), phase: window.__WANHU_REVIEW__!.getStatus().phase,
        triangles: window.__WANHU_REVIEW__!.stats.triangles, geometry: window.__WANHU_REVIEW__!.geometryId() }));
      assert.equal(after.recipe, before.recipe); assert(Math.abs(after.phase - before.phase) < 1e-6);
      assert.notEqual(after.geometry, before.geometry);
      if (lod === '2') assert(after.triangles < before.triangles); else assert.equal(after.triangles, before.triangles);
      await shot(`lod-switch-${bodyType}-${lod}`);
    }
  }
  // Full continuous sitting clips for all three silhouettes; no chair or console is faked.
  const videoCases = samples.flatMap(sample => ['male', 'female'].map(bodyType => ({ sample, bodyType, id: 'pilot-switches' })));
  for (const bodyType of ['male', 'female']) for (const id of ['jogging', 'shooting-arrow']) videoCases.push({ sample: samples[2], bodyType, id });
  for (const { sample, bodyType, id } of videoCases) {
    const vc = await browser.newContext({ viewport: { width: 1600, height: 1000 }, recordVideo: { dir, size: { width: 1600, height: 1000 } } });
    const vp = await vc.newPage(), video = vp.video()!;
    observe(vp);
    try {
      await open(vp, { ...params(sample, bodyType), pose: '', mixamo: id, view: 'side', lod: '0' });
      await vp.getByRole('button', { name: '播放', exact: true }).click();
      await vp.waitForFunction(() => {
        const state = window.__WANHU_REVIEW__!.getStatus();
        if (state.finished) return true;
        const w = window as unknown as { __tailoringCycles?: { phase: number; count: number } };
        const cycles = w.__tailoringCycles ??= { phase: state.phase, count: 0 };
        if (state.phase < cycles.phase - .5) cycles.count++;
        cycles.phase = state.phase;
        return cycles.count >= 2;
      }, undefined, { timeout: 60000, polling: 100 });
      await vp.waitForTimeout(300);
    } finally {
      await vc.close();
      const name = `${sample.id}-${bodyType}-${id}-continuous.webm`;
      await rename(await video.path(), `${dir}/${name}`); videos.push(name);
    }
  }
  // Mobile controls must remain usable after adding the LOD and seated shortcut.
  for (const bodyType of ['male', 'female']) {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto(`${base}/?bodyType=${bodyType}&look=town-${bodyType}`);
    await page.waitForSelector('canvas');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByRole('button', { name: '坐姿试衣', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="mixamo-status"]')?.textContent?.includes('秒'));
    assert.equal(await page.getByLabel('试衣动画', { exact: true }).inputValue(), 'pilot-switches');
    await shot(`mobile-${bodyType}-seated`);
  }
  const expectedImages = 3 * 2 * 2 * (4 + clips.length * phases.length) + 3 * 2 * 2 * 3 + 4 + 2;
  assert.equal(records.length, expectedImages); assert.equal(videos.length, 10); assert.deepEqual(errors, []);
} catch (e) { failure = String(e); throw e; }
finally {
  const report = { sourceSha: process.env.REVIEW_HEAD_SHA ?? 'local', testedSha: process.env.GITHUB_SHA ?? 'local',
    passed: !failure && !errors.length, images: records.length, records, continuousVideos: videos, errors, failure,
    criticalClips: clips, bodyTypes: ['male', 'female'], garmentLods: [0, 2],
    note: '实际浏览器渲染、完整坐姿视频与 LOD 状态测试；文件生成成功不等于人工视觉验收，LOD2 仅简化衣物。' };
  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  await writeFile(`${dir}/index.html`, `<!doctype html><meta charset="utf-8"><title>Tailoring Review</title><style>body{font:16px sans-serif;background:#eee;color:#243}main{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0}img,video{width:100%}</style><h1>Tailoring ${report.sourceSha}</h1><p>Generated: ${report.passed} ${report.failure}</p><main>${records.map(f => `<figure><img loading="lazy" src="${f}"><figcaption>${f}</figcaption></figure>`).join('')}</main>${videos.map(f => `<video controls src="${f}"></video>`).join('')}`);
  await context.close(); await browser.close();
}
console.log('PASS tailoring browser matrix, seated fitting, LOD continuity and full videos.');
