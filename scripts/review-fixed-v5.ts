import assert from 'node:assert/strict';
import {mkdir, stat, writeFile} from 'node:fs/promises';
import {chromium, type Page} from 'playwright';
import {MIXAMO_CLIPS} from '../src/character/mixamo/catalog';
import {applyLook} from '../src/character/wardrobe/catalog';
import {createRecipe, type Recipe} from '../src/character/v3/types';

// 独立补充验收，不替代原衣柜截图、视频或全 FBX 数值矩阵。
const base = process.env.REVIEW_URL ?? 'http://127.0.0.1:4173';
const dir = 'review-wardrobe/fixed-v5';
const storageKey = 'wanhu.character.wardrobe.v5';
const images: string[] = [], checks: string[] = [], errors: string[] = [];
let failure = '';
await mkdir(dir, {recursive: true});
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-webgl'],
});
const context = await browser.newContext({viewport: {width: 1600, height: 1000}});
const legacy = {...applyLook(createRecipe({bodyType: 'female'}), 'ceremony-female'), version: 4, height: 1.9, build: .8};
await context.addInitScript(({legacy}) => {
  // 记录真实读取，而不是仅检索 App 源码中的某个变量名。
  const reads: string[] = [];
  Object.defineProperty(window, '__WANHU_V5_STORAGE_READS__', {value: reads});
  const getItem = Storage.prototype.getItem;
  Storage.prototype.getItem = function(key: string) {
    if (this === localStorage) reads.push(String(key));
    return getItem.call(this, key);
  };
  for (let version = 1; version <= 4; version++) {
    localStorage.setItem(`wanhu.character.wardrobe.v${version}`, JSON.stringify({...legacy, version}));
  }
}, {legacy});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});

async function recipe(): Promise<Recipe> {return page.evaluate(() => window.__WANHU_RECIPE__!());}
async function settle() {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function open(params: Record<string, string> = {}) {
  await page.goto(`${base}/?${new URLSearchParams({review: '1', pose: 'bind', paused: '1', ...params})}`);
  await page.waitForFunction(() => window.__WANHU_REVIEW__?.stats.bones === 20 && Boolean(window.__WANHU_RECIPE__));
  await settle();
}
async function shot(name: string, fullPage = false) {
  await settle();
  await page.screenshot({path: `${dir}/${name}.png`, fullPage});
  assert((await stat(`${dir}/${name}.png`)).size > 10000, name + ': empty screenshot');
  images.push(`${name}.png`);
}
async function waitRecipe(expected: Recipe) {
  await page.waitForFunction(value => JSON.stringify(window.__WANHU_RECIPE__!()) === value, JSON.stringify(expected));
  await settle();
}
async function assertStorageIsolation() {
  const reads = await page.evaluate(() => (window as unknown as {__WANHU_V5_STORAGE_READS__: string[]}).__WANHU_V5_STORAGE_READS__);
  assert.deepEqual(reads.filter(key => key.startsWith('wanhu.character.wardrobe.') && key !== storageKey), []);
  return reads;
}
async function waitMotion(id: string) {
  await page.waitForFunction(id => {
    const status = window.__WANHU_REVIEW__?.getStatus();
    return status?.mixamo?.id === id && status.mixamo.ready && !status.loading;
  }, id);
}
async function changeAtPhase(action: () => Promise<unknown>, phase: number) {
  const geometry = await page.evaluate(() => window.__WANHU_REVIEW__!.geometryId());
  await action();
  await page.waitForFunction(previous => window.__WANHU_REVIEW__!.geometryId() !== previous, geometry);
  await waitMotion('pilot-switches');
  await settle();
  assert(Math.abs((await page.evaluate(() => window.__WANHU_REVIEW__!.getStatus())).phase - phase) < 1e-6, 'appearance edit reset paused phase');
}
async function color(label: string, value: string) {
  // 系统颜色弹窗无法由无头浏览器操作；通过原生 input 事件走同一个 React handler。
  await page.getByLabel(label, {exact: true}).evaluate((element, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(element, value);
    element.dispatchEvent(new Event('input', {bubbles: true}));
    element.dispatchEvent(new Event('change', {bubbles: true}));
  }, value);
}
async function importValue(value: unknown) {
  await page.getByLabel('导入配方文件', {exact: true}).setInputFiles({
    name: 'invalid-v5.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)),
  });
  // 必须等本次异步文件读取结束，不能让上次残留错误提示提前满足断言。
  await page.waitForFunction(() => (document.querySelector('[aria-label="导入配方文件"]') as HTMLInputElement).value === '');
  await page.locator('.studio-notice.notice-error').waitFor();
}

try {
  const defaultRecipe = applyLook(createRecipe({bodyType: 'male'}), 'town-male');
  await open({height: '2.0', build: '1', lod: '0', palette: '4', outfit: 'guard', hat: 'false', equipment: 'true'});
  assert.deepEqual(await recipe(), defaultRecipe, 'retired URL changed appearance');
  await page.getByRole('button', {name: '恢复装扮', exact: true}).click();
  assert.deepEqual(await recipe(), defaultRecipe, 'legacy save was restored');
  assert((await page.getByRole('status').allTextContents()).some(text => text.includes('还没有保存')));
  const storageReads = await assertStorageIsolation();
  assert(storageReads.includes(storageKey), 'restore did not exercise V5 storage');
  for (const label of ['身高', '体格', '胖瘦', 'LOD']) assert.equal(await page.getByLabel(label, {exact: true}).count(), 0);
  assert.equal(await page.locator('[data-testid^="lod-"]').count(), 0);
  await shot('01-legacy-storage-and-url-isolation');
  checks.push('legacy V1-V4 keys not read; retired URL ignored; no retired controls');

  const phase = .37;
  await open({pose: '', mixamo: 'pilot-switches', phase: String(phase), view: 'three'});
  await waitMotion('pilot-switches');
  for (const bodyType of ['female', 'male'] as const) {
    await changeAtPhase(() => page.getByTestId(`body-type-${bodyType}`).click(), phase);
    assert.equal((await recipe()).bodyType, bodyType);
  }
  await changeAtPhase(() => page.getByLabel('上衣', {exact: true}).selectOption('rough_tunic'), phase);
  await changeAtPhase(() => page.getByLabel('下装', {exact: true}).selectOption('work_wrap'), phase);
  await changeAtPhase(() => page.getByLabel('发型', {exact: true}).selectOption('double_bun'), phase);
  for (const [label, value] of [['主布颜色', '#e8dcc8'], ['下装 / 内衬颜色', '#c8d8df'], ['缘边 / 腰带颜色', '#906040'], ['发色', '#543a29']]) {
    await changeAtPhase(() => color(label, value), phase);
  }
  const dyed = await recipe();
  assert.deepEqual(dyed.dyes, {primary: '#e8dcc8', secondary: '#c8d8df', accent: '#906040'});
  assert.equal(dyed.hairColor, '#543a29');
  await changeAtPhase(() => page.getByLabel('头饰', {exact: true}).selectOption('scholar_cap'), phase);
  await changeAtPhase(() => page.getByLabel('头饰', {exact: true}).selectOption('none'), phase);
  assert.equal((await recipe()).hairStyle, 'double_bun', 'taking off hat lost selected hair');
  await shot('02-dyes-hair-and-paused-phase');
  checks.push('both body switches, top, bottom, hair, three dyes, hair color and hat removal retain paused phase');

  const saved = await recipe();
  await page.getByRole('button', {name: '保存装扮', exact: true}).click();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__WANHU_RECIPE__));
  await page.getByRole('button', {name: '恢复装扮', exact: true}).click();
  await waitRecipe(saved);
  await waitMotion('pilot-switches');
  await assertStorageIsolation();
  await shot('03-v5-save-reload-restore');
  checks.push('V5 save survives page reload and restores every appearance field');

  const validStored = await page.evaluate(key => localStorage.getItem(key), storageKey);
  const invalid: unknown[] = [
    {...saved, version: 4}, {...saved, height: 1.8}, {...saved, hairStyle: 'auto'},
    {...saved, dyes: {primary: '#ffffff', secondary: '#ffffff'}},
    {...saved, slots: {...saved.slots, unknown: 'none'}},
  ];
  for (const field of Object.keys(saved)) {
    const incomplete = {...saved} as Record<string, unknown>; delete incomplete[field]; invalid.push(incomplete);
  }
  for (const value of invalid) {
    const geometry = await page.evaluate(() => window.__WANHU_REVIEW__!.geometryId());
    await importValue(value);
    assert.deepEqual(await recipe(), saved);
    assert.equal(await page.evaluate(() => window.__WANHU_REVIEW__!.geometryId()), geometry);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), validStored);
  }
  await shot('04-rejected-file-keeps-character');
  await page.getByRole('button', {name: '关闭提示', exact: true}).click();
  await page.evaluate(key => localStorage.setItem(key, '{broken'), storageKey);
  await page.getByRole('button', {name: '恢复装扮', exact: true}).click();
  assert.deepEqual(await recipe(), saved);
  assert((await page.getByRole('status').allTextContents()).some(text => text.includes('恢复失败')));
  await page.evaluate(({key, value}) => localStorage.setItem(key, value!), {key: storageKey, value: validStored});
  checks.push(`${invalid.length} rejected files preserve recipe, geometry and saved data; corrupt V5 storage is rejected`);

  const pilot = MIXAMO_CLIPS.find(clip => clip.id === 'pilot-switches');
  assert(pilot, 'required seated clip absent');
  assert.equal(await page.getByLabel('试衣动画', {exact: true}).locator('option').count(), MIXAMO_CLIPS.length + 1);
  for (const query of [pilot.label, pilot.file]) {
    await page.getByLabel('搜索动画', {exact: true}).fill(query);
    assert.equal(await page.getByTestId('mixamo-pilot-switches').count(), 1);
  }
  await page.getByRole('button', {name: `收藏 ${pilot.file}`, exact: true}).click();
  await page.getByLabel('搜索动画', {exact: true}).fill('');
  await page.getByRole('button', {name: '只看收藏', exact: true}).click();
  assert.equal(await page.getByRole('list', {name: '动画搜索结果'}).getByRole('listitem').count(), 1);
  await shot('05-search-and-favorite');
  await page.reload(); await page.waitForFunction(() => Boolean(window.__WANHU_REVIEW__));
  assert.equal(await page.getByRole('button', {name: `收藏 ${pilot.file}`, exact: true}).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', {name: '劳动动作', exact: true}).click();
  const labor = MIXAMO_CLIPS.filter(clip => clip.category === '劳动');
  assert(labor.length > 0);
  assert.equal(await page.getByRole('list', {name: '动画搜索结果'}).getByRole('listitem').count(), labor.length);
  await page.getByLabel('动画分类', {exact: true}).selectOption('全部');
  assert(MIXAMO_CLIPS.length > 1);
  const geometry = await page.evaluate(() => window.__WANHU_REVIEW__!.geometryId());
  await page.getByTestId(`mixamo-${MIXAMO_CLIPS[0].id}`).click(); await waitMotion(MIXAMO_CLIPS[0].id);
  await page.getByRole('button', {name: '下一个', exact: true}).click(); await waitMotion(MIXAMO_CLIPS[1].id);
  await page.getByRole('button', {name: '上一个', exact: true}).click(); await waitMotion(MIXAMO_CLIPS[0].id);
  assert.equal(await page.evaluate(() => window.__WANHU_REVIEW__!.geometryId()), geometry, 'animation navigation rebuilt geometry');
  await page.getByTestId('quick-pilot-switches').click(); await waitMotion('pilot-switches');
  await page.getByRole('button', {name: '暂停', exact: true}).click();
  await page.getByLabel('动画进度', {exact: true}).fill('.4');
  await settle();
  const beforeStep = await page.evaluate(() => window.__WANHU_REVIEW__!.getStatus());
  await page.getByRole('button', {name: '下一帧', exact: true}).click(); await settle();
  const afterStep = await page.evaluate(() => window.__WANHU_REVIEW__!.getStatus());
  assert(Math.abs(afterStep.phase - beforeStep.phase - 1 / (30 * beforeStep.mixamo!.duration)) < 1e-6);
  await page.getByRole('button', {name: '上一帧', exact: true}).click(); await settle();
  assert(Math.abs((await page.evaluate(() => window.__WANHU_REVIEW__!.getStatus())).phase - beforeStep.phase) < 1e-6);
  await page.getByLabel('源骨架同步对照', {exact: true}).check();
  await page.getByRole('button', {name: '侧面', exact: true}).click();
  await shot('06-source-comparison-and-frame-step');
  checks.push(`dynamic catalog ${MIXAMO_CLIPS.length} FBX; search, favorites across reload, labor filter, navigation, pause and exact frame stepping`);

  for (const width of [360, 768]) for (const bodyType of ['male', 'female']) {
    await page.setViewportSize({width, height: 915});
    await open({bodyType, look: `town-${bodyType}`});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}/${bodyType}: horizontal overflow`);
    await shot(`layout-${width}-${bodyType}`, true);
  }
  checks.push('360px and 768px layouts for both fixed bodies');
  assert.equal(images.length, 10);
  assert.deepEqual(errors, []);
} catch (error) {
  failure = error instanceof Error ? error.stack ?? error.message : String(error);
  // 失败画面也保存，但不将它算入通过矩阵。
  await page.screenshot({path: `${dir}/failure.png`, fullPage: true}).catch(() => {});
} finally {
  await writeFile(`${dir}/report.json`, JSON.stringify({
    sourceSha: process.env.REVIEW_HEAD_SHA ?? 'local', testedSha: process.env.GITHUB_SHA ?? 'local',
    passed: !failure && errors.length === 0, images: images.length, records: images, checks, errors, failure,
    visualReview: 'not-performed-by-script; downloaded images and continuous videos require separate review',
  }, null, 2));
  await context.close(); await browser.close();
}
if (failure || errors.length) throw new Error(failure || errors.join('\n'));
console.log(`PASS fixed V5 browser audit: ${checks.length} groups, ${images.length} screenshots; not an art approval.`);
