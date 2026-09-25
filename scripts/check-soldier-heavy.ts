import assert from 'node:assert/strict';
import { B, BODY_TYPES, createRecipe, type Cage, type Recipe } from '../src/character/v3/types';
import { cloneCage, triCount } from '../src/character/v3/cage';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import type { GarmentPiece } from '../src/character/wardrobe/assets/contract';
import { assertGarmentPiece } from './check-garment-assets';
import { applySoldierLook, applySoldierStyle } from '../src/soldier/looks';
import { identifyArmorClass, applySoldierArmorClass, SOLDIER_ARMOR_SLOTS } from '../src/soldier/armor';
import { SOLDIER_ARMOR_CLASS_IDS, SOLDIER_STYLE_IDS } from '../src/soldier/contract';
import { SOLDIER_IDENTITY_IDS, applySoldierIdentity } from '../src/soldier/identities';
import { parseRecipeFile, randomizeCharacter, WARDROBE_LOOKS } from '../src/character/wardrobe/catalog';

function connected(c: Cage) {
  const neighbors = Array.from({ length: c.vertices.length }, () => new Set<number>());
  for (const f of c.faces) for (let i = 0; i < f.v.length; i++) { const a = f.v[i], b = f.v[(i + 1) % f.v.length]; neighbors[a].add(b); neighbors[b].add(a); }
  const seen = new Set<number>(), todo = [0];
  while (todo.length) { const n = todo.pop()!; if (seen.has(n)) continue; seen.add(n); todo.push(...neighbors[n]); }
  assert.equal(seen.size, c.vertices.length, '重甲必须为连通作者壳，不得添加游离外挂板');
}
export function assertHeavyArmorTop(piece: GarmentPiece): void {
  assertGarmentPiece(piece); connected(piece.mesh);
  assert.equal(piece.id, 'heavy_armor'); assert.equal(triCount(piece.mesh), 432); assert.equal(piece.mesh.vertices.length, 218);
  assert.deepEqual(piece.covers, ['torso', 'upperArm', 'forearm']);
  assert.equal(piece.sealedInterfaces!.waist.length, 11); assert.equal(piece.sealedInterfaces!.neck.length, 11);
  for (const side of ['Left', 'Right']) assert.equal(piece.sealedInterfaces![side + 'Cuff'].length, 6);
  for (const v of piece.mesh.vertices) {
    assert(v.id.startsWith('Top.')); assert(v.p.every(Number.isFinite) && v.w.every(Number.isFinite));
    let allowed: number[];
    if (v.id.startsWith('Top.Right.')) allowed = [B.Chest, B.RightUpperArm, B.RightForearm, B.RightHand];
    else if (v.id.startsWith('Top.Left.')) allowed = [B.Chest, B.LeftUpperArm, B.LeftForearm, B.LeftHand];
    else if (/^Top\.(Hem|Belt|BeltTop)\./.test(v.id)) allowed = [B.Hips, B.Spine];
    else if (/^Top\.(Abdomen|Rib|Plate)\./.test(v.id)) allowed = [B.Spine, B.Chest];
    else if (/^Top\.(Collar|Neck)\./.test(v.id)) allowed = [B.Chest, B.Neck];
    else allowed = [B.Chest, v.p[0] > 0 ? B.RightUpperArm : B.LeftUpperArm];
    assert(allowed.includes(v.w[0]) && allowed.includes(v.w[1]), '重甲上身错误骨骼: ' + v.id);
  }
}
export function assertHeavyArmorSkirt(piece: GarmentPiece): void {
  assertGarmentPiece(piece); connected(piece.mesh);
  const c = piece.mesh;
  assert.equal(piece.id, 'heavy_armor_skirt'); assert.equal(triCount(c), 328); assert.equal(c.vertices.length, 166);
  assert.deepEqual(piece.covers, ['pelvis', 'thigh', 'shin']);
  assert(c.vertices.every(v => v.id.startsWith('HeavyArmorSkirt.') || v.id.startsWith('HeavyArmorLiner.')));
  assert.equal(c.vertices.filter(v => v.id.startsWith('HeavyArmorSkirt.')).length, 70);
  assert.equal(piece.sealedInterfaces!.waist.length, 10);
  for (const side of ['Left', 'Right']) assert.equal(piece.sealedInterfaces![side + 'Cuff'].length, 8);
  const lookup = new Map(c.vertices.map((v, i) => [v.id, { v, i }]));
  const get = (id: string) => { const result = lookup.get(id); assert(result, '缺少重甲制作点: ' + id); return result; };
  const row = (n: number) => Array.from({ length: 10 }, (_, k) => get(`HeavyArmorSkirt.${n}.${k}`));
  for (let n = 0; n < 7; n++) {
    const ring = row(n);
    for (const { v } of ring) assert.deepEqual(v.w, n === 0 ? [B.Hips, B.Hips, 1] : [B.Hips, v.p[0] > 0 ? B.RightThigh : B.LeftThigh, [1, .88, .64, .48, .36, .29, .28][n]]);
    for (const [a, b] of [[0, 9], [4, 5]]) assert(c.faces.some(f => f.v.includes(ring[a].i) && f.v.includes(ring[b].i)), '重甲前后护面必须跨中线');
  }
  assert(row(0).every(x => x.v.p[1] > 1.075 && x.v.p[1] < 1.105), '重甲腰甲必须从腰起');
  assert(row(6).every(x => x.v.p[1] > .68 && x.v.p[1] < .76), '重甲不得靠加长裙摆冒充等级');
  assert(row(6)[2].v.p[0] > .29 && row(6)[0].v.p[2] > .215, '重甲必须保留宽厚的裙壳');
  for (const v of c.vertices) if (v.id.startsWith('HeavyArmorLiner.')) {
    const right = v.id.includes('.Right.'), thigh = right ? B.RightThigh : B.LeftThigh, shin = right ? B.RightShin : B.LeftShin, foot = right ? B.RightFoot : B.LeftFoot;
    const allowed = v.id.includes('.Entry.') ? [B.Hips, thigh] : v.id.includes('.Cuff.') ? [shin, foot] : [thigh, shin];
    assert(v.p.every(Number.isFinite) && v.w.every(Number.isFinite));
    assert(allowed.includes(v.w[0]) && allowed.includes(v.w[1]), '重甲裤管错误骨骼: ' + v.id);
  }
  for (const side of ['Right', 'Left']) for (const k of [0, 4, 5, 6, 7]) {
    const { v } = get(`HeavyArmorLiner.${side}.Entry.${k}`), end = k === 0 || k === 4;
    assert.equal(v.p[1], end ? .835 : k === 6 ? .850 : .865);
    assert.deepEqual(v.w, [B.Hips, side === 'Right' ? B.RightThigh : B.LeftThigh, end ? .40 : k === 6 ? .35 : .50]);
  }
  const face = c.faces.find(f => f.v.includes(get('HeavyArmorLiner.Left.Entry.4').i) && f.v.includes(get('HeavyArmorSkirt.6.0').i));
  assert(face && face.v.length === 4);
  assert.deepEqual([c.vertices[face.v[0]].id, c.vertices[face.v[2]].id].sort(), ['HeavyArmorLiner.Right.Entry.0', 'HeavyArmorSkirt.6.9'].sort());
}
function span(c: Cage, accept: (id: string) => boolean, axis: number) { const values = c.vertices.filter(v => accept(v.id)).map(v => v.p[axis]); assert(values.length > 0); return Math.max(...values) - Math.min(...values); }
export function assertHeavySilhouette(medium: Cage, heavy: Cage) {
  const shoulder = (c: Cage) => span(c, id => /Top\.(Right|Left)\.Pauldron/.test(id), 0);
  const chest = (c: Cage) => span(c, id => id.startsWith('Top.Chest.'), 2);
  const skirt = (c: Cage, kind: string, axis: number) => span(c, id => id.startsWith(kind + 'ArmorSkirt.'), axis);
  const result = { shoulderRatio: shoulder(heavy) / shoulder(medium), chestDepthRatio: chest(heavy) / chest(medium), skirtWidthRatio: skirt(heavy, 'Heavy', 0) / skirt(medium, 'Medium', 0), skirtDepthRatio: skirt(heavy, 'Heavy', 2) / skirt(medium, 'Medium', 2) };
  assert(result.shoulderRatio > 1.14, '重甲护肩大轮廓必须明显宽于中甲');
  assert(result.chestDepthRatio > 1.20, '重甲必须有真实厚胸壳');
  assert(result.skirtWidthRatio > 1.18 && result.skirtDepthRatio > 1.20, '重甲前后与侧面裙壳需要真实体量');
  return result;
}
function neutral(c: Cage) { const ids = c.vertices.map(v => v.id), accept = (id: string) => id.startsWith('Top.') || id.startsWith('HeavyArmor'); return { vertices: c.vertices.filter(v => accept(v.id)), faces: c.faces.filter(f => f.v.every(i => accept(ids[i]))).map(f => ({ v: f.v.map(i => ids[i]), region: f.region, part: f.part })) }; }
let negativeCases = 0;
const silhouettes = [];
for (const bodyType of BODY_TYPES) {
  const input = createRecipe({ bodyType }), heavy = makeCharacter(applySoldierLook(input, 'palace', 'soldier', 'heavy')).surface;
  const medium = makeCharacter(applySoldierLook(input, 'palace', 'soldier', 'medium')).surface;
  silhouettes.push({ bodyType, ...assertHeavySilhouette(medium, heavy) });
  for (const style of SOLDIER_STYLE_IDS) for (const identity of SOLDIER_IDENTITY_IDS) assert.deepEqual(neutral(makeCharacter(applySoldierLook(input, style, identity, 'heavy')).surface), neutral(heavy), 'Heavy 的几何不能跟随驻地或身份改变');
  for (const mutate of [
    (c: Cage) => { for (const v of c.vertices) if (/Top\.(Right|Left)\.Pauldron/.test(v.id)) v.p[0] *= .80; },
    (c: Cage) => { for (const v of c.vertices) if (v.id.startsWith('Top.Chest.')) v.p[2] *= .75; },
    (c: Cage) => { for (const v of c.vertices) if (v.id.startsWith('HeavyArmorSkirt.')) v.p[0] *= .80; },
    (c: Cage) => { for (const v of c.vertices) if (v.id.startsWith('HeavyArmorSkirt.')) v.p[2] *= .75; },
  ]) { const broken = cloneCage(heavy); mutate(broken); assert.throws(() => assertHeavySilhouette(medium, broken)); negativeCases++; }
}
const recipe = applySoldierLook(createRecipe(), 'palace', 'captain', 'heavy');
for (const [make, validate] of [[makeTop, assertHeavyArmorTop], [makeTrousers, assertHeavyArmorSkirt]] as const) {
  const piece = make(recipe)!; validate(piece);
  for (const mutate of [
    (p: GarmentPiece) => { p.mesh.faces.pop(); },
    (p: GarmentPiece) => { p.mesh.faces[0].v.reverse(); },
    (p: GarmentPiece) => { p.mesh.vertices[0].p[0] = NaN; },
    (p: GarmentPiece) => { p.mesh.vertices[0].w[2] = NaN; },
    (p: GarmentPiece) => { p.mesh.vertices[0].w = [B.LeftHand, B.LeftHand, 1]; },
    (p: GarmentPiece) => { p.mesh.faces[1] = structuredClone(p.mesh.faces[0]); },
  ]) { const bad = structuredClone(piece); mutate(bad); assert.throws(() => validate(bad)); negativeCases++; }
}
for (const armorClass of SOLDIER_ARMOR_CLASS_IDS) for (const style of SOLDIER_STYLE_IDS) for (const identity of SOLDIER_IDENTITY_IDS) {
  const r = applySoldierLook(createRecipe(), style, identity, armorClass), original = JSON.stringify(r);
  assert.equal(identifyArmorClass(r), armorClass); assert.deepEqual(parseRecipeFile(JSON.stringify(r)), r);
  for (const target of SOLDIER_STYLE_IDS) { const changed = applySoldierStyle(r, target); assert.equal(identifyArmorClass(changed), armorClass); assert.equal(changed.slots.top, r.slots.top); assert.equal(changed.slots.bottom, r.slots.bottom); }
  for (const target of SOLDIER_ARMOR_CLASS_IDS) { const changed = applySoldierArmorClass(r, target); assert.deepEqual({ ...changed, slots: { ...changed.slots, top: r.slots.top, bottom: r.slots.bottom } }, r); assert.deepEqual({ top: changed.slots.top, bottom: changed.slots.bottom }, SOLDIER_ARMOR_SLOTS[target]); }
  const changed = applySoldierIdentity(r, identity === 'soldier' ? 'captain' : 'soldier'); assert.deepEqual({ ...changed, slots: { ...changed.slots, headwear: r.slots.headwear } }, r);
  assert.equal(JSON.stringify(r), original);
}
assert.equal(identifyArmorClass(createRecipe({ ...recipe, slots: { ...recipe.slots, bottom: 'work_pants' } })), null);
for (const field of ['armorClass', 'serviceStyle', 'soldierIdentity', 'role', 'rank']) { assert.throws(() => parseRecipeFile(JSON.stringify({ ...recipe, [field]: 'heavy' }))); negativeCases++; }
assert(!WARDROBE_LOOKS.some(l => l.slots.top === 'heavy_armor' || l.slots.bottom === 'heavy_armor_skirt'));
for (let seed = 0; seed < 256; seed++) { const random = randomizeCharacter(createRecipe(), seed); assert.notEqual(random.slots.top, 'heavy_armor'); assert.notEqual(random.slots.bottom, 'heavy_armor_skirt'); }
console.log('HEAVY_ARMOR_CONTRACT', JSON.stringify({ passed: true, topTriangles: 432, topVertices: 218, bottomTriangles: 328, bottomVertices: 166, silhouettes, negativeCases, recipeFields: 6, slots: 7, bones: 20 }));
