import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BODY_TYPES, HAIR_STYLE_IDS, createRecipe, type Cage, type Recipe } from '../src/character/v3/types';
import { makeCharacter } from '../src/character/v3/outfit';
import { parseRecipeFile, randomizeCharacter } from '../src/character/wardrobe/catalog';
import { applyPalaceGuard, applyFrontierGuard, applyCityGuard } from '../src/soldier/looks';
import { SOLDIER_IDENTITY_IDS, SOLDIER_HELMETS, identifySoldierHelmet, applySoldierIdentity } from '../src/soldier/identities';
import type { SoldierStyleId } from '../src/soldier/contract';

const styles = [
  { id: 'palace', apply: applyPalaceGuard, prefix: 'PalaceHelmet.' },
  { id: 'frontier', apply: applyFrontierGuard, prefix: 'FrontierHelmet.' },
  { id: 'city', apply: applyCityGuard, prefix: 'CityHelmet.' },
] as const;
function bounds(c: Cage, prefix: string) {
  const vertices = c.vertices.filter(v => v.id.startsWith(prefix));
  assert(vertices.length > 0, '缺少真实轮廓顶点: ' + prefix);
  const min = [0, 1, 2].map(axis => Math.min(...vertices.map(v => v.p[axis])));
  const max = [0, 1, 2].map(axis => Math.max(...vertices.map(v => v.p[axis])));
  assert([...min, ...max].every(Number.isFinite));
  return { min, max, width: max[0] - min[0], depth: max[2] - min[2] };
}
function withoutHelmet(c: Cage, prefix: string) {
  return {
    vertices: c.vertices.filter(v => !v.id.startsWith(prefix)),
    faces: c.faces.filter(f => f.v.every(i => !c.vertices[i].id.startsWith(prefix))).map(f => ({ ...f, v: f.v.map(i => c.vertices[i].id) })),
  };
}
/** 测量装配后的真实顶点，而不是作者参数；外廓与顶部投影同时有差异。 */
function assertSilhouette(style: SoldierStyleId, ordinary: Cage, captain: Cage) {
  const prefix = styles.find(s => s.id === style)!.prefix;
  const base = bounds(ordinary, prefix), next = bounds(captain, prefix);
  let ornament;
  if (style === 'palace') {
    const before = bounds(ordinary, 'PalaceHelmet.Plume.');
    ornament = bounds(captain, 'PalaceHelmet.Plume.');
    assert(ornament.width > before.width * 2.5, '宫卫队长的短缨须有明显横向差异');
    assert(ornament.width * ornament.depth > before.width * before.depth * 2.5, '宫卫顶部投影不能只有高度变化');
    assert(next.max[1] - base.max[1] > .02 && next.max[1] - base.max[1] < .05);
  } else {
    ornament = bounds(captain, prefix + (style === 'frontier' ? 'CaptainPlume.' : 'CaptainCrest.'));
    assert(next.max[1] - base.max[1] > .075 && next.max[1] - base.max[1] < .14, '队长顶饰需可见但克制');
    assert(ornament.width > (style === 'frontier' ? .08 : .17));
    assert(ornament.width * ornament.depth > .012, '顶部投影必须形成实质面积');
  }
  // 普通盔的所有安全帽壳/护颈坐标、拓扑与权重必须原封不动。
  const immutable = (c: Cage) => c.vertices.filter(v => v.id.startsWith(prefix + 'Shell.') || v.id.startsWith(prefix + 'Neck.'));
  assert.deepEqual(immutable(captain), immutable(ordinary));
  return { style, ordinaryHeight: base.max[1], captainHeight: next.max[1], ornamentWidth: ornament.width, ornamentDepth: ornament.depth };
}

assert.deepEqual(SOLDIER_IDENTITY_IDS, ['soldier', 'captain']);
const rows: unknown[] = [];
let negativeCases = 0;
for (const style of styles) for (const bodyType of BODY_TYPES) for (const hairStyle of HAIR_STYLE_IDS) {
  const source = createRecipe({ bodyType, hairStyle }), ordinary = style.apply(source), captain = style.apply(source, 'captain');
  const snapshot = JSON.stringify(ordinary);
  assert.deepEqual(applySoldierIdentity(ordinary, 'captain'), captain);
  assert.equal(JSON.stringify(ordinary), snapshot, '身份切换不得原地修改输入');
  assert.deepEqual(applySoldierIdentity(captain, 'soldier'), ordinary);
  assert.deepEqual({ ...captain, slots: { ...captain.slots, headwear: ordinary.slots.headwear } }, ordinary, '普通/队长只允许头饰差异');
  assert.deepEqual(identifySoldierHelmet(captain.slots.headwear), { style: style.id, identity: 'captain' });
  assert.deepEqual(parseRecipeFile(JSON.stringify(captain)), captain);
  assert.deepEqual(Object.keys(captain).sort(), ['version', 'bodyType', 'slots', 'dyes', 'hairStyle', 'hairColor'].sort());
  const a = makeCharacter(ordinary), b = makeCharacter(captain);
  assert.deepEqual(a.body, b.body); assert.deepEqual(a.joints, b.joints);
  assert.deepEqual(withoutHelmet(a.surface, style.prefix), withoutHelmet(b.surface, style.prefix), '头盔以外的网格不许改变');
  rows.push({ bodyType, hairStyle, ...assertSilhouette(style.id, a.surface, b.surface) });
  const mixed = createRecipe({ ...captain, slots: { ...captain.slots, top: 'work_vest', bottom: 'short_trousers', shoes: 'cloth_shoes', back: 'bamboo_basket', rightHand: 'none' }, dyes: { primary: '#577269', secondary: '#827357', accent: '#a29c83' } });
  const swapped = applySoldierIdentity(mixed, 'soldier');
  assert.deepEqual({ ...swapped, slots: { ...swapped.slots, headwear: mixed.slots.headwear } }, mixed, '混搭时身份按钮不能重置衣裤、背具、手持物或染色');
  assert.equal(randomizeCharacter(captain, 123, ['headwear']).slots.headwear, captain.slots.headwear);
  for (const value of [{ ...captain, soldierRole: 'captain' }, { ...captain, soldierIdentity: 'captain' }, { ...captain, rank: 1 }]) {
    assert.throws(() => parseRecipeFile(JSON.stringify(value))); negativeCases++;
  }
  // 将新外廓压回原形/压成细条，验证测量确实能拦截“看不出区别”。
  const bad = structuredClone(b.surface);
  if (style.id === 'palace') {
    for (const v of bad.vertices.filter(v => v.id.startsWith('PalaceHelmet.Plume.'))) v.p = [...a.surface.vertices.find(s => s.id === v.id)!.p];
  } else {
    for (const v of bad.vertices.filter(v => /CaptainPlume|CaptainCrest/.test(v.id))) v.p[0] *= .1;
  }
  assert.throws(() => assertSilhouette(style.id, a.surface, bad)); negativeCases++;
}
for (let seed = 0; seed < 64; seed++) {
  const r = randomizeCharacter(createRecipe(), seed);
  assert.equal(identifySoldierHelmet(r.slots.headwear), null, '军盔不能进入默认居民随机池');
}
const civilian = createRecipe();
assert.equal(applySoldierIdentity(civilian, 'captain'), civilian, '非军盔不能被身份按钮隐式换整套');
assert.equal(identifySoldierHelmet('none'), null);
assert.equal(new Set(Object.values(SOLDIER_HELMETS).flatMap(x => Object.values(x))).size, 6);
const report = { passed: true, rows, negativeCases, sourceSHA: process.env.REVIEW_HEAD_SHA ?? 'local', visualApproval: false, scope: 'Helmet-only identity, actual assembled silhouette and unchanged non-helmet geometry; visual recognition is reviewed separately.' };
const dir = process.env.SOLDIER_CHECK_DIR ?? 'review/soldier-numeric';
mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/identities.json`, JSON.stringify(report, null, 2));
console.log('SOLDIER_IDENTITIES', JSON.stringify(report));
