import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { B, BODY_TYPES, HAIR_STYLE_IDS, TOP_IDS, BOTTOM_IDS, createRecipe, emptySlots, type Recipe, type CharacterData } from '../src/character/v3/types';
import { triCount } from '../src/character/v3/cage';
import { makeCharacter } from '../src/character/v3/outfit';
import { TOP_PATTERNS, BOTTOM_PATTERNS } from '../src/character/wardrobe/patterns';
import { SLOT_OPTIONS, WARDROBE_LOOKS, parseRecipeFile, randomizeCharacter } from '../src/character/wardrobe/catalog';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import { makeFootwear } from '../src/character/wardrobe/assets/footwear';
import { makeHeavyArmorTop } from '../src/character/wardrobe/assets/military/heavy-top';
import { makeHeavyArmorSkirt } from '../src/character/wardrobe/assets/military/heavy-skirt';
import { sealGarmentInterfaces } from '../src/character/wardrobe/assets/seal-interfaces';
import type { GarmentPiece } from '../src/character/wardrobe/assets/contract';
import { SOLDIER_STYLE_IDS, SOLDIER_STYLE_CONTRACT } from '../src/soldier/contract';
import { SOLDIER_HELMETS } from '../src/soldier/identities';

// 测试自有期望值，不借用试衣预设来同时生成输入和预期，避免两个错误互相印证。
const levels = [
  { id: 'light', top: 'city_guard_brigandine', bottom: 'city_guard_trousers', topAsset: 'city-top', bottomAsset: 'city-trousers', topTriangles: 340, bottomTriangles: 260 },
  { id: 'medium', top: 'medium_armor', bottom: 'medium_armor_skirt', topAsset: 'medium-top', bottomAsset: 'medium-skirt', topTriangles: 386, bottomTriangles: 308 },
  { id: 'heavy', top: 'heavy_armor', bottom: 'heavy_armor_skirt', topAsset: 'heavy-top', bottomAsset: 'heavy-skirt', topTriangles: 432, bottomTriangles: 352 },
] as const;
const retired: readonly [keyof Recipe['slots'], string][] = [
  ['top', 'palace_guard_armor'], ['top', 'frontier_lamellar_armor'],
  ['bottom', 'palace_guard_skirt'], ['bottom', 'frontier_armor_skirt'],
  ['top', 'guard_light_armor'], ['top', 'archer_tunic'],
  ['bottom', 'guard_pants'], ['bottom', 'archer_pants'], ['bottom', 'loose_trousers'], ['shoes', 'boots'],
];
const outputDirectory = process.env.SOLDIER_CHECK_DIR || 'review';
const rows: { armorClass: string; bodyType: string; hairStyle: string; palette: string; topTriangles: number; bottomTriangles: number }[] = [];
let mixedCases = 0, randomCases = 0, rejectedFiles = 0, assemblyFaults = 0;

/** 不能只检查资产名：正式人物的真实衣面必须与原工厂的面、顶点语义及颜色逐一对应。 */
function assertAssembledPiece(data: CharacterData, piece: GarmentPiece): void {
  const descriptors = data.garments.filter(g => g.slot === piece.slot);
  assert.equal(descriptors.length, 1, `缺少或重复装配 ${piece.slot}`);
  assert.deepEqual(descriptors[0], { id: piece.id, slot: piece.slot, version: piece.version, triangles: triCount(piece.mesh), covers: [...piece.covers], openings: [] });
  assert.deepEqual(Object.keys(piece.openings), [], '必须沿原封口链路装配');
  const actual = data.surface.faces.filter(f => f.part === piece.slot);
  assert.equal(actual.reduce((n, f) => n + f.v.length - 2, 0), triCount(piece.mesh));
  const expectedFaces = piece.mesh.faces.map(f => ({ ids: f.v.map(i => piece.mesh.vertices[i].id), region: f.region, color: f.color }));
  assert.deepEqual(actual.map(f => ({ ids: f.v.map(i => data.surface.vertices[i].id), region: f.region, color: f.color })), expectedFaces);
  const weights = new Map(piece.mesh.vertices.map(v => [v.id, v.w]));
  for (const i of new Set(actual.flatMap(f => f.v))) assert.deepEqual(data.surface.vertices[i].w, weights.get(data.surface.vertices[i].id));
}

/** 此入口不启动 Actor、浏览器或动作准备；只验收衣柜到正式人物数据的静态链路。 */
function verifyRecipe(recipe: Recipe): CharacterData {
  const before = structuredClone(recipe);
  const restored = parseRecipeFile(JSON.stringify(recipe));
  assert.deepEqual(restored, recipe);
  assert.deepEqual(Object.keys(restored).sort(), ['version', 'bodyType', 'slots', 'dyes', 'hairStyle', 'hairColor'].sort());
  assert.deepEqual(Object.keys(restored.slots).sort(), Object.keys(emptySlots()).sort());
  const data = makeCharacter(recipe), roundTrip = makeCharacter(restored);
  assert.deepEqual(roundTrip, data, '文件往返后实际网格和配方都应一致');
  const pieces = [makeTop(recipe), makeTrousers(recipe), makeFootwear(recipe)].filter((p): p is GarmentPiece => p !== undefined);
  assert.equal(data.garments.length, pieces.length);
  pieces.forEach(piece => assertAssembledPiece(data, piece));
  const bare = makeCharacter(createRecipe({ ...recipe, slots: emptySlots() }));
  assert.deepEqual(data.body, bare.body, '换甲不能修改固定身体');
  assert.deepEqual(data.joints, bare.joints); assert.equal(data.joints.length, 20);
  const covered = new Set(pieces.flatMap(p => p.covers));
  assert(!data.surface.faces.some(f => f.part === 'skin' && covered.has(f.region)), '被衣物覆盖的皮肤必须按原表遮蔽');
  assert.equal(data.replacedTriangles, data.body.faces.filter(f => covered.has(f.region)).reduce((n, f) => n + f.v.length - 2, 0));
  for (const v of data.surface.vertices) {
    assert(v.p.every(Number.isFinite)); assert.equal(v.w.length, 3);
    assert(v.w.slice(0, 2).every(b => Number.isInteger(b) && b >= 0 && b < Object.keys(B).length));
    assert(Number.isFinite(v.w[2]) && v.w[2] >= 0 && v.w[2] <= 1);
  }
  if (recipe.slots.top === 'heavy_armor') assert.deepEqual(makeTop(recipe), sealGarmentInterfaces(makeHeavyArmorTop(recipe), recipe.dyes.primary), '重甲上装不能分派到中甲或占位工厂');
  if (recipe.slots.bottom === 'heavy_armor_skirt') assert.deepEqual(makeTrousers(recipe), sealGarmentInterfaces(makeHeavyArmorSkirt(recipe), recipe.dyes.secondary), '重甲下装必须使用独立工厂和原封口器');
  assert.deepEqual(recipe, before, '装配和文件入口均不能修改原配方');
  return data;
}

function run(): void {
  for (const level of levels) {
    assert.equal(TOP_IDS.filter(id => id === level.top).length, 1);
    assert.equal(BOTTOM_IDS.filter(id => id === level.bottom).length, 1);
    assert.equal(SLOT_OPTIONS.top.filter(o => o.id === level.top).length, 1);
    assert.equal(SLOT_OPTIONS.bottom.filter(o => o.id === level.bottom).length, 1);
    assert.equal(TOP_PATTERNS[level.top].asset, level.topAsset);
    assert.equal(BOTTOM_PATTERNS[level.bottom].asset, level.bottomAsset);
    for (const bodyType of BODY_TYPES) for (const hairStyle of HAIR_STYLE_IDS) for (const palette of SOLDIER_STYLE_IDS) {
      const recipe = createRecipe({ bodyType, hairStyle, slots: { ...emptySlots(), top: level.top, bottom: level.bottom, headwear: SOLDIER_HELMETS[palette].soldier, shoes: 'military_boots', rightHand: 'military_spear' }, dyes: { ...SOLDIER_STYLE_CONTRACT[palette].palette } });
      const data = verifyRecipe(recipe);
      assert.equal(data.garments.find(g => g.slot === 'top')!.triangles, level.topTriangles);
      assert.equal(data.garments.find(g => g.slot === 'bottom')!.triangles, level.bottomTriangles);
      rows.push({ armorClass: level.id, bodyType, hairStyle, palette, topTriangles: level.topTriangles, bottomTriangles: level.bottomTriangles });
    }
  }
  assert.equal(rows.length, 54);
  for (const bodyType of BODY_TYPES) for (const slots of [
    { top: 'heavy_armor', bottom: 'body' }, { top: 'body', bottom: 'heavy_armor_skirt' },
    { top: 'heavy_armor', bottom: 'city_guard_trousers' }, { top: 'medium_armor', bottom: 'heavy_armor_skirt' },
  ] as const) { verifyRecipe(createRecipe({ bodyType, slots: { ...emptySlots(), ...slots } })); mixedCases++; }

  const militaryTops = new Set<string>(levels.map(l => l.top)), militaryBottoms = new Set<string>(levels.map(l => l.bottom));
  const militaryHelmets = new Set<string>(Object.values(SOLDIER_HELMETS).flatMap(h => Object.values(h)));
  assert(WARDROBE_LOOKS.every(l => !militaryTops.has(l.slots.top) && !militaryBottoms.has(l.slots.bottom) && !militaryHelmets.has(l.slots.headwear)));
  for (const level of levels) for (const bodyType of BODY_TYPES) for (let seed = 0; seed < 64; seed++) {
    const input = createRecipe({ bodyType, slots: { top: level.top, bottom: level.bottom, headwear: 'palace_captain_helmet' } }), snapshot = structuredClone(input);
    const next = randomizeCharacter(input, seed);
    assert(!militaryTops.has(next.slots.top) && !militaryBottoms.has(next.slots.bottom) && !militaryHelmets.has(next.slots.headwear));
    assert.deepEqual(randomizeCharacter(input, seed), next, '相同种子仍可复现');
    const locked = randomizeCharacter(input, seed, ['top', 'bottom', 'headwear']);
    assert.equal(locked.slots.top, input.slots.top); assert.equal(locked.slots.bottom, input.slots.bottom); assert.equal(locked.slots.headwear, input.slots.headwear);
    const topOnly = randomizeCharacter(input, seed, ['top']);
    assert.equal(topOnly.slots.top, input.slots.top); assert(!militaryBottoms.has(topOnly.slots.bottom) && !militaryHelmets.has(topOnly.slots.headwear));
    assert.deepEqual(input, snapshot); randomCases++;
  }
  const heavy = createRecipe({ slots: { top: 'heavy_armor', bottom: 'heavy_armor_skirt' } });
  const reject = (raw: unknown) => { assert.throws(() => parseRecipeFile(JSON.stringify(raw))); rejectedFiles++; };
  for (const [slot, id] of retired) {
    assert(!SLOT_OPTIONS[slot].some(o => o.id === id));
    if (slot === 'top') assert(!Object.hasOwn(TOP_PATTERNS, id));
    if (slot === 'bottom') assert(!Object.hasOwn(BOTTOM_PATTERNS, id));
    reject({ ...heavy, slots: { ...heavy.slots, [slot]: id } });
  }
  for (const field of ['armorClass', 'serviceStyle', 'soldierIdentity', 'profession', 'role', 'rank']) reject({ ...heavy, [field]: 'heavy' });
  for (const [slot, id] of [['top', 'heavy_armor_skirt'], ['bottom', 'heavy_armor'], ['top', 'palace_heavy_armor'], ['top', 'frontier_heavy_armor'], ['top', 'city_heavy_armor'], ['bottom', 'missing_armor_skirt']] as const) reject({ ...heavy, slots: { ...heavy.slots, [slot]: id } });
  for (const key of Object.keys(heavy) as (keyof Recipe)[]) { const bad: Partial<Recipe> = structuredClone(heavy); delete bad[key]; reject(bad); }
  reject({ ...heavy, version: 4 }); reject({ ...heavy, slots: { ...heavy.slots, armor: 'heavy' } });
  reject({ ...heavy, dyes: { ...heavy.dyes, metallic: 1 } });
  // 证明装配断言会拒绝“有 ID 没有衣面”、假描述和被替换的衣面，不只测试正确样本。
  const actual = makeCharacter(heavy), piece = makeTop(heavy)!;
  for (const mutate of [
    (d: CharacterData) => { d.surface.faces = d.surface.faces.filter(f => f.part !== 'top'); },
    (d: CharacterData) => { d.garments.find(g => g.slot === 'top')!.id = 'medium_armor'; },
    (d: CharacterData) => { d.surface.faces.find(f => f.part === 'top')!.v.reverse(); },
  ]) { const bad = structuredClone(actual); mutate(bad); assert.throws(() => assertAssembledPiece(bad, piece)); assemblyFaults++; }
  assert.equal(randomCases, 384); assert.equal(mixedCases, 8); assert.equal(rejectedFiles, 31); assert.equal(assemblyFaults, 3);
}

let failure: unknown;
try { run(); } catch (error) { failure = error; }
const report = {
  passed: failure === undefined, stage: 'S6-2', sourceSHA: process.env.REVIEW_HEAD_SHA ?? null,
  rows, mixedCases, randomCases, randomModes: ['unlocked', 'explicit-armor-lock', 'top-only-lock'], rejectedFiles, assemblyFaults,
  motionReviewed: false, visualReviewed: false, browserReviewed: false,
  scope: 'Static wardrobe registration, independent factory dispatch, original sealing, actual assembled faces, body hiding, strict V5 roundtrip and random isolation only. S6-3 interaction, S6-4 motion/intersections and S6-5 WebGL review remain required.',
  ...(failure === undefined ? {} : { error: failure instanceof Error ? failure.stack : String(failure) }),
};
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(join(outputDirectory, 'soldier-wardrobe-integration.json'), JSON.stringify(report, null, 2) + '\n');
console.log('S6-2 WARDROBE INTEGRATION', JSON.stringify(report));
if (failure !== undefined) throw failure;
