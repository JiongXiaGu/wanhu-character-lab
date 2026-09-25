import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BODY_TYPES, HAIR_STYLE_IDS, createRecipe, type Cage } from '../src/character/v3/types';
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
  return { min, max, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
}
function withoutHelmet(c: Cage, prefix: string) {
  return {
    vertices: c.vertices.filter(v => !v.id.startsWith(prefix)),
    faces: c.faces.filter(f => f.v.every(i => !c.vertices[i].id.startsWith(prefix))).map(f => ({ ...f, v: f.v.map(i => c.vertices[i].id) })),
  };
}
function ornamentPrefix(style: SoldierStyleId): string {
  return styles.find(s => s.id === style)!.prefix + (style === 'palace' ? 'Plume.' : style === 'frontier' ? 'CaptainPlume.' : 'CaptainCrest.');
}
/** 新授权为细高竖饰：旧“越宽越好”的外观条件已撤销，结构/绑定/穿插门槛不变。 */
function assertSilhouette(style: SoldierStyleId, ordinary: Cage, captain: Cage) {
  const prefix = styles.find(s => s.id === style)!.prefix, crest = ornamentPrefix(style);
  const base = bounds(ordinary, prefix), next = bounds(captain, prefix), ornament = bounds(captain, crest);
  const shell = bounds(captain, prefix + 'Shell.');
  const summit = bounds(captain, prefix + 'Shell.' + (style === 'palace' ? 'Finial.' : 'Ridge.'));
  const root = bounds(captain, crest + 'Base.'), body = bounds(captain, crest + 'Body.'), upper = bounds(captain, crest + 'Upper.');
  const tip = captain.vertices.find(v => v.id === crest + 'Tip')!.p;
  assert(ornament.height > .17 && ornament.height < .27, '顶饰必须细高但不做仪仗长翎');
  assert(ornament.width > .035 && ornament.width < .061, '不能恢复宽冠/毛团，也不能细成不可读的线');
  assert(ornament.depth > .026 && ornament.depth < .065, '保持真实体积，不能恢复肥厚后拖');
  assert(ornament.height / ornament.width > 3.7 && ornament.height / ornament.width < 6, '竖饰高宽比必须收束');
  assert(next.max[1] - base.max[1] > .085 && next.max[1] - base.max[1] < .24, '与普通盔须有明确竖向差异');
  assert(Math.abs(ornament.max[0] + ornament.min[0] - shell.max[0] - shell.min[0]) < 1e-8, '顶饰不能横向偏心');
  assert(Math.abs(tip[0] - (root.min[0] + root.max[0]) / 2) < 1e-8, '尖端必须位于盔顶中线');
  assert(Math.abs(tip[2] - (root.min[2] + root.max[2]) / 2) < .03, '只允许克制后倾，不能形成拖尾');
  assert(tip[1] > upper.max[1] && upper.min[1] > body.max[1], '顶饰必须向上收尖');
  assert(upper.width < body.width * .65 && upper.depth < body.depth * .7, '上端不能恢复平台或宽头');
  assert(shell.max[1] - root.min[1] > .004 && shell.max[1] - root.min[1] < .014, '底座需嵌入盔顶，不能悬空或沉入盔壳');
  assert(root.min[0] > summit.min[0] && root.max[0] < summit.max[0] && root.min[2] > summit.min[2] && root.max[2] < summit.max[2], '小底座须落在原盔顶截面内');
  // 原安全帽壳/护颈的坐标、权重、拓扑、面色全部相同，而不只比较头盔外的衣裤。
  const immutable = (c: Cage) => {
    const accept = (id: string) => id.startsWith(prefix + 'Shell.') || id.startsWith(prefix + 'Neck.');
    return {
      vertices: c.vertices.filter(v => accept(v.id)),
      faces: c.faces.filter(f => f.v.every(i => accept(c.vertices[i].id))).map(f => ({ ...f, v: f.v.map(i => c.vertices[i].id) })),
    };
  };
  assert.deepEqual(immutable(captain), immutable(ordinary));
  return { style, ordinaryHeight: base.max[1], captainHeight: next.max[1], ornamentHeight: ornament.height, ornamentWidth: ornament.width, ornamentDepth: ornament.depth, heightWidthRatio: ornament.height / ornament.width };
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
  // 每个坏样本都变形真实装配结果；拦截旧的宽矮轮廓、过细、拖尾、偏心、悬空与宽头。
  const crest = ornamentPrefix(style.id), rootY = bounds(b.surface, crest + 'Base.').min[1];
  const badShapes: readonly [string, (c: Cage) => void][] = [
    ['旧宽冠', c => { for (const v of c.vertices) if (v.id.startsWith(crest)) v.p[0] *= 4; }],
    ['矮短饰', c => { for (const v of c.vertices) if (v.id.startsWith(crest)) v.p[1] = rootY + (v.p[1] - rootY) * .35; }],
    ['不可读细线', c => { for (const v of c.vertices) if (v.id.startsWith(crest)) v.p[0] *= .1; }],
    ['肥厚拖尾', c => { for (const v of c.vertices) if (v.id.startsWith(crest)) v.p[2] -= (v.p[1] - rootY) * .7; }],
    ['尖端偏心', c => { c.vertices.find(v => v.id === crest + 'Tip')!.p[0] += .015; }],
    ['悬空底座', c => { for (const v of c.vertices) if (v.id.startsWith(crest)) v.p[1] += .03; }],
    ['宽头平台', c => { for (const v of c.vertices) if (v.id.startsWith(crest + 'Upper.')) v.p[0] *= 2.5; }],
    ['移植普通盔壳', c => { c.vertices.find(v => v.id.startsWith(style.prefix + 'Shell.Base.'))!.p[1] -= .001; }],
  ];
  for (const [name, mutate] of badShapes) {
    const bad = structuredClone(b.surface); mutate(bad);
    assert.throws(() => assertSilhouette(style.id, a.surface, bad), name + ' 必须被拒绝'); negativeCases++;
  }
}
for (let seed = 0; seed < 64; seed++) {
  const r = randomizeCharacter(createRecipe(), seed);
  assert.equal(identifySoldierHelmet(r.slots.headwear), null, '军盔不能进入默认居民随机池');
}
const civilian = createRecipe();
assert.equal(applySoldierIdentity(civilian, 'captain'), civilian, '非军盔不能被身份按钮隐式换整套');
assert.equal(identifySoldierHelmet('none'), null);
assert.equal(new Set(Object.values(SOLDIER_HELMETS).flatMap(x => Object.values(x))).size, 6);
const report = { passed: true, rows, negativeCases, sourceSHA: process.env.REVIEW_HEAD_SHA ?? 'local', visualApproval: false, scope: 'Helmet-only identity, actual slender assembled silhouette, centered embedded root and unchanged non-helmet geometry; visual recognition is reviewed separately.' };
const dir = process.env.SOLDIER_CHECK_DIR ?? 'review/soldier-numeric';
mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/identities.json`, JSON.stringify(report, null, 2));
console.log('SOLDIER_IDENTITIES', JSON.stringify(report));
