import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { WORK_IDS, ACTIONS, type WorkId } from '../src/character/actions/catalog';
import { isBowId } from '../src/character/actions/bow';

// 独立矩阵与注册表双向核对，防止只登记动作名称而没有相位/截图覆盖。
const ACTION_REVIEW_MATRIX: Record<WorkId, number[]> = {
  pick:[0,.16,.375,.38,.385,.46,.75,1],
  place:[0,.35,.595,.60,.605,.655,.66,.665,1],
  carry_hold:[0,.25,.5,.75,1], carry_front:[0,.25,.5,.75,.999],
  carry_shoulder:[0,.25,.5,.75,.999], carry_back:[0,.25,.5,.75,.999],
  push:[0,.25,.5,.75,.999], pull:[0,.25,.5,.75,.999],
  hoe:[0,.25,.5,.515,.52,.525,.75,.999], hammer:[0,.25,.5,.515,.52,.525,.75,.999],
  bow_shot:[0,.18,.32,.52,.66,.715,.72,.725,.78,.86,1],
  bow_draw:[0,.18/.62,.5,.75,1], bow_aim:[0,.5,1],
  bow_aim_high:[0,.5,1], bow_aim_low:[0,.5,1],
  bow_release:[0,.06,(.72-.70)/.30,.075,.3,.6,1],
  bow_cancel:[0,.25,.5,.75,1],
};
assert.deepEqual(Object.keys(ACTION_REVIEW_MATRIX).sort(), [...WORK_IDS].sort());
const root = process.env.REVIEW_URL ?? 'http://127.0.0.1:4173';
const out = process.env.ACTION_REVIEW_DIR ?? 'review-actions';
await mkdir(out, { recursive:true });
const browser = await chromium.launch({ headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{ width:1600, height:1080 }, deviceScaleFactor:1 });
const errors: string[] = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
const records: { id:string; label:string; files:string[]; status?:unknown }[] = [];
const extras: string[] = [];
async function open(action: WorkId, view = 'free', display = 'beauty', phase = .25, extra: Record<string,string> = {}) {
  const query = new URLSearchParams({ review:'1', paused:'1', outfit:isBowId(action) ? 'archer' : 'farmer', action, view, display, phase:String(phase), ...extra });
  await page.goto(`${root}/?${query}`, { waitUntil:'networkidle' });
  await page.waitForFunction(id => window.__WANHU_REVIEW__?.work === id, action, { timeout:15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(p => window.__WANHU_REVIEW__!.seek(p), phase);
  await page.waitForTimeout(100);
  assert.equal(await page.locator('[role="alert"]').count(), 0);
}
async function status() { return page.evaluate(() => window.__WANHU_REVIEW__!.getStatus()); }
async function extra(name: string) {
  await page.screenshot({ path:`${out}/${name}.png`, fullPage:true }); extras.push(`${name}.png`);
}
try {
  for (const id of WORK_IDS) {
    const def = ACTIONS[id], record = { id, label:def.label, files:[] as string[], status:undefined as unknown };
    await mkdir(`${out}/${id}`, { recursive:true });
    for (const [view, display] of [['front','beauty'],['side','beauty'],['back','beauty'],['free','cage']]) {
      await open(id, view, display, def.reviewPhase);
      const file = `${id}/${view}-${display}.png`;
      await page.screenshot({ path:`${out}/${file}`, fullPage:true }); record.files.push(file);
    }
    await open(id, 'free', 'beauty', 0);
    const hashes: string[] = [];
    for (const [index, phase] of ACTION_REVIEW_MATRIX[id].entries()) {
      await page.evaluate(p => window.__WANHU_REVIEW__!.seek(p), phase); await page.waitForTimeout(90);
      const file = `${id}/frame-${String(index).padStart(2,'0')}-p${Math.round(phase * 1000)}.png`;
      const bytes = await page.locator('canvas').screenshot({ path:`${out}/${file}` });
      record.files.push(file); hashes.push(createHash('sha256').update(bytes).digest('hex'));
      assert.equal((await status()).eventCount, 0, `${id} 截图 seek 触发事件`);
    }
    if (def.playback !== 'hold' && id !== 'carry_hold') assert(new Set(hashes).size > 1, `${id} 只有一个静态姿势`);
    record.status = await status(); records.push(record);
    console.log('REVIEW', id, record.files.length, 'screenshots');
  }
  // 真实播放：完整射箭只能释放一箭，末帧与暂停不会再生成事件。
  await open('bow_shot');
  await page.getByRole('button', { name:'重播动作', exact:true }).click();
  await page.getByLabel('速度', { exact:true }).selectOption('2');
  await page.waitForFunction(() => window.__WANHU_REVIEW__?.getStatus().finished, undefined, { timeout:12000 });
  assert.equal((await status()).releaseCount, 1); assert.equal((await status()).eventCount, 2);
  await page.waitForTimeout(200); assert.equal((await status()).releaseCount, 1);
  assert.equal((await status()).phase, 1); assert.equal((await status()).arrowVisible, false);
  // 定位能还原飞行画面，但不生成游戏事件。
  await page.evaluate(() => window.__WANHU_REVIEW__!.seek(.78));
  assert.equal((await status()).arrowVisible, true); assert.equal((await status()).releaseCount, 0);
  await extra('bow-release-flight');
  await open('bow_aim');
  await page.getByLabel('播放', { exact:true }).click();
  await page.waitForFunction(() => window.__WANHU_REVIEW__!.getStatus().phase >= .999, undefined, { timeout:10000 });
  await page.waitForTimeout(200);
  assert.equal((await status()).finished, false); assert.equal((await status()).releaseCount, 0);
  assert.equal((await status()).arrowVisible, true);
  await page.getByRole('button', { name:'取消瞄准', exact:true }).click();
  await page.waitForFunction(() => window.__WANHU_REVIEW__!.getStatus().finished, undefined, { timeout:10000 });
  assert.equal((await status()).releaseCount, 0); assert.equal((await status()).arrowVisible, false);
  // 拾取、暂停和拖动仍沿用原有交互验证。
  await open('pick'); await page.getByRole('button', { name:'重播动作', exact:true }).click();
  await page.getByLabel('速度', { exact:true }).selectOption('2');
  await page.waitForFunction(() => window.__WANHU_REVIEW__!.getStatus().finished, undefined, { timeout:12000 });
  assert.equal((await status()).eventCount, 2); assert.equal((await status()).phase, 1);
  await page.getByRole('button', { name:'双手锄地', exact:true }).click();
  await page.waitForFunction(() => window.__WANHU_REVIEW__!.getStatus().eventCount >= 1, undefined, { timeout:10000 });
  await page.getByLabel('暂停', { exact:true }).click();
  const count = (await status()).eventCount; await page.waitForTimeout(150); assert.equal((await status()).eventCount, count);
  await page.getByLabel('动画进度', { exact:true }).evaluate(el => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '0.52');
    el.dispatchEvent(new Event('input', { bubbles:true }));
  });
  await page.waitForTimeout(100); assert.equal((await status()).eventCount, 0);
  await page.getByLabel('握点检查', { exact:true }).check(); await extra('hoe-contact-debug');
  // 三组代表动作的体型端点；射箭额外检查草帽混搭和高低瞄准。
  for (const id of ['bow_aim','bow_aim_high','bow_aim_low','carry_front','pick','hoe'] as const) {
    for (const shape of ['short','tall'] as const) {
      await open(id, 'free', 'beauty', ACTIONS[id].reviewPhase, isBowId(id) ? { headwear:'farmer_straw_hat' } : {});
      await page.getByLabel('身高', { exact:true }).press(shape === 'short' ? 'Home' : 'End');
      await page.getByLabel('体格', { exact:true }).press(shape === 'short' ? 'Home' : 'End');
      await page.evaluate(p => window.__WANHU_REVIEW__!.seek(p), ACTIONS[id].reviewPhase);
      await page.waitForTimeout(100); await extra(`${id}-${shape}-diy`);
      if (isBowId(id)) {
        assert.equal(await page.getByLabel('左手', { exact:true }).inputValue(), 'archer_bow');
        assert.equal(await page.getByLabel('背部', { exact:true }).inputValue(), 'archer_quiver');
      }
    }
  }
  await open('bow_aim', 'free', 'beauty', .5, { headwear:'farmer_straw_hat' });
  await page.getByLabel('握点检查', { exact:true }).check(); await extra('bow-hands-debug');
  await page.getByRole('button', { name:'待机', exact:true }).click();
  await page.waitForFunction(() => window.__WANHU_REVIEW__?.work === 'none');
  assert.equal(await page.getByLabel('头饰', { exact:true }).inputValue(), 'farmer_straw_hat');
  assert.equal(await page.getByLabel('左手', { exact:true }).inputValue(), 'archer_bow');
  await page.setViewportSize({ width:390, height:844 });
  await open('bow_shot', 'free', 'beauty', .66);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '移动端水平溢出');
  await extra('mobile-bow');
  assert.deepEqual(errors, []);
  assert.deepEqual(records.map(record => record.id).sort(), [...WORK_IDS].sort());
  for (const record of records) {
    assert.equal(record.files.length, 4 + ACTION_REVIEW_MATRIX[record.id as WorkId].length);
    for (const file of record.files) assert((await stat(`${out}/${file}`)).size > 2000, `${file} 截图为空或缺失`);
  }
  const report = {
    pass:true, sha:process.env.REVIEW_HEAD_SHA ?? process.env.GITHUB_SHA ?? 'local',
    testedMergeSha:process.env.GITHUB_SHA ?? 'local', actions:records, extras, errors,
    checks:['all actions have front / side / back / cage and actual phase files','release before / at / after','real playback / pause / hold / cancel','one arrow per shot','seek without events','DIY restored','shape endpoints','mobile'],
  };
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  await writeFile(`${out}/index.html`, `<!doctype html><html lang="zh"><meta charset="utf-8"><title>万户动作审查</title><style>body{font:15px system-ui;background:#16252b;color:#deded0;max-width:1440px;margin:30px auto;padding:20px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}img{max-width:100%}a{color:#ddc6a0}section{margin-top:35px}</style><h1>劳动与射箭 · Actions 截图</h1><p>Source ${report.sha}。自动检查通过不等于人工视觉审查通过。</p>${records.map(r => `<section><h2>${r.label} / ${r.id}</h2><div class="grid">${r.files.map(f => `<figure><a href="${f}"><img loading="lazy" src="${f}"></a><figcaption>${f}</figcaption></figure>`).join('')}</div></section>`).join('')}</html>`);
  console.log(`PASS: ${records.length} action reviews; screenshots require agent inspection.`);
} catch (error) {
  await page.screenshot({ path:`${out}/failure.png`, fullPage:true }).catch(() => {});
  await writeFile(`${out}/failure.json`, JSON.stringify({ error:String(error), errors, records }, null, 2));
  throw error;
} finally { await browser.close(); }
