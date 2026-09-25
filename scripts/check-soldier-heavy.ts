import assert from 'node:assert/strict';
import { B, createRecipe, type Cage, type Weight } from '../src/character/v3/types';
import { triCount } from '../src/character/v3/cage';
import { kneeWeights } from '../src/character/v3/leg-deformation';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import type { GarmentPiece } from '../src/character/wardrobe/assets/contract';
import { assertGarmentPiece } from './check-garment-assets';

export const HEAVY_ARMOR_BUDGET = { top: 432, bottom: 348 } as const;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function connected(c: Cage) {
  assert.equal(new Set(c.vertices.map(v => v.id)).size, c.vertices.length);
  const links = c.vertices.map(() => new Set<number>());
  for (const f of c.faces) f.v.forEach((a, i) => { const b = f.v[(i + 1) % f.v.length]; links[a].add(b); links[b].add(a); });
  const seen = new Set<number>(), todo = [0];
  while (todo.length) { const i = todo.pop()!; if (seen.has(i)) continue; seen.add(i); todo.push(...links[i]); }
  assert.equal(seen.size, c.vertices.length, '重甲必须是单一连通衣壳，不允许独立外挂甲片');
}
function vertices(c: Cage, prefix: string) {
  const result = c.vertices.filter(v => v.id.startsWith(prefix));
  assert(result.length > 0, `缺少真实轮廓：${prefix}`); return result;
}
function extent(c: Cage, prefix: string, axis: number) { return Math.max(...vertices(c, prefix).map(v => Math.abs(v.p[axis]))); }

export function assertHeavyArmorTop(piece: GarmentPiece): void {
  assert.equal(piece.id, 'heavy_armor'); assert.equal(piece.slot, 'top');
  assertGarmentPiece(piece); connected(piece.mesh);
  assert.equal(triCount(piece.mesh), HEAVY_ARMOR_BUDGET.top); assert.equal(piece.mesh.vertices.length, 218);
  const torsoWeights: Record<string, Weight> = {
    Hem: [B.Hips, B.Spine, .35], Belt: [B.Hips, B.Spine, .35], BeltTop: [B.Hips, B.Spine, .35],
    Abdomen: [B.Spine, B.Chest, .35], Plate: [B.Spine, B.Chest, .14],
    Chest: [B.Chest, B.Chest, 1], Shoulder: [B.Chest, B.Chest, 1],
    Gorget: [B.Chest, B.Neck, .35], Collar: [B.Chest, B.Neck, .35], Neck: [B.Chest, B.Neck, .35],
  };
  for (const v of piece.mesh.vertices) {
    const arm = /^Top\.(Right|Left)\.(\w+)\.(\d+)$/.exec(v.id);
    if (arm) {
      const right = arm[1] === 'Right', upper = right ? B.RightUpperArm : B.LeftUpperArm, fore = right ? B.RightForearm : B.LeftForearm, hand = right ? B.RightHand : B.LeftHand;
      const weights: Record<string, Weight> = {
        HeavyShoulderRoot: [B.Chest, upper, .30], HeavyShoulderCrest: [B.Chest, upper, .08], HeavyShoulderRim: [upper, upper, 1], HeavyUpperGuard: [upper, upper, 1],
        ElbowUpper: [upper, fore, .90], Elbow: [upper, fore, .50], HeavyBracer: [upper, fore, .08], HeavyBracerLower: [fore, fore, 1], Cuff: [fore, hand, .18],
      };
      assert(weights[arm[2]], `未知重甲袖环 ${v.id}`); assert.deepEqual(v.w, weights[arm[2]], v.id); continue;
    }
    const torso = /^Top\.(\w+)\.(\d+)$/.exec(v.id); assert(torso && torsoWeights[torso[1]], v.id);
    const name = torso[1], column = Number(torso[2]); let expected = torsoWeights[name];
    if (name === 'Chest' || name === 'Shoulder') {
      const bone = [5, 6, 7].includes(column) ? B.RightUpperArm : [0, 9, 10].includes(column) ? B.LeftUpperArm : null;
      if (bone !== null) expected = [B.Chest, bone, name === 'Chest' ? .87 : .62];
    }
    assert.deepEqual(v.w, expected, v.id);
  }
  assert(extent(piece.mesh, 'Top.Plate.', 2) >= .170, '胸腹甲壳厚度不足');
  assert(extent(piece.mesh, 'Top.BeltTop.', 0) >= .190, '腰甲不能收回中甲体量');
  for (const side of ['Right', 'Left']) {
    assert(extent(piece.mesh, `Top.${side}.HeavyShoulderRim.`, 0) >= .420, '外肩必须有明确宽厚体量');
    assert(extent(piece.mesh, `Top.${side}.HeavyShoulderCrest.`, 2) >= .080, '护肩侧向厚度不足');
  }
}

export function assertHeavyArmorSkirt(piece: GarmentPiece): void {
  assert.equal(piece.id, 'heavy_armor_skirt'); assert.equal(piece.slot, 'bottom');
  assertGarmentPiece(piece); connected(piece.mesh);
  assert.equal(triCount(piece.mesh), HEAVY_ARMOR_BUDGET.bottom); assert.equal(piece.mesh.vertices.length, 176);
  const hips = [1, .92, .74, .55, .43, .35, .29, .28];
  const perimeterDepth = [1, .88, 0, -.88, -1, -1, -.88, 0, .88, 1];
  for (const v of piece.mesh.vertices) {
    const shell = /^HeavyArmorSkirt\.(\d+)\.(\d+)$/.exec(v.id);
    if (shell) {
      const row = Number(shell[1]), column = Number(shell[2]), thigh = v.p[0] > 0 ? B.RightThigh : B.LeftThigh;
      assert(row < hips.length && column < perimeterDepth.length);
      const hipWeight = hips[row] + (1 - hips[row]) * .16 * (1 - perimeterDepth[column]);
      assert.deepEqual(v.w, row === 0 ? [B.Hips, B.Hips, 1] : [B.Hips, thigh, hipWeight], v.id);
      if (row === 0) near(v.p[1], 1.075);
      continue;
    }
    const liner = /^HeavyArmorLiner\.(Right|Left)\.(\w+)\.(\d+)$/.exec(v.id); assert(liner, v.id);
    const right = liner[1] === 'Right', thigh = right ? B.RightThigh : B.LeftThigh, shin = right ? B.RightShin : B.LeftShin, foot = right ? B.RightFoot : B.LeftFoot;
    const label = liner[2], column = Number(liner[3]);
    if (label === 'Entry') {
      const inner = [0, 4, 5, 6, 7].includes(column), end = column === 0 || column === 4;
      assert.deepEqual(v.w, [B.Hips, thigh, inner ? end ? .40 : column === 6 ? .35 : .50 : .12], v.id);
      if (inner) assert(v.p[1] >= .830, '真实裤腿出口必须向上拱起，不能用低位扇面挡腿');
    } else if (label.startsWith('Knee') || label === 'Calf') assert.deepEqual(v.w, kneeWeights(v.p, thigh, shin), v.id);
    else { assert.equal(label, 'Cuff'); assert.deepEqual(v.w, [shin, foot, .2]); }
  }
  assert(extent(piece.mesh, 'HeavyArmorSkirt.2.', 0) >= .245, '重甲腰下侧甲体量不足');
  assert(extent(piece.mesh, 'HeavyArmorSkirt.7.', 0) >= .285, '重甲不能退化为窄长中甲');
  assert(extent(piece.mesh, 'HeavyArmorSkirt.5.', 2) >= .190, '前后防护厚度不足');
  for (const v of vertices(piece.mesh, 'HeavyArmorSkirt.7.')) assert(v.p[1] >= .680 && v.p[1] <= .745, '不得靠继续加长裙摆冒充重甲');
  for (const sign of [-1, 1]) assert(piece.mesh.faces.some(f => f.v.every(i => piece.mesh.vertices[i].id.startsWith('HeavyArmorSkirt.')) && f.v.some(i => piece.mesh.vertices[i].p[0] < 0) && f.v.some(i => piece.mesh.vertices[i].p[0] > 0) && f.v.every(i => Math.sign(piece.mesh.vertices[i].p[2]) === sign)), '正背面都必须连续跨中线');
  const returnFace = piece.mesh.faces.find(f => f.v.some(i => piece.mesh.vertices[i].id === 'HeavyArmorLiner.Left.Entry.4') && f.v.some(i => piece.mesh.vertices[i].id === 'HeavyArmorSkirt.7.0'));
  assert(returnFace && returnFace.v.length === 4);
  const diagonal = [returnFace.v[0], returnFace.v[2]].map(i => piece.mesh.vertices[i].id).sort();
  assert.deepEqual(diagonal, ['HeavyArmorLiner.Right.Entry.0', 'HeavyArmorSkirt.7.9'].sort(), '裆口回收面必须保留经校验的对角线');
}

export function checkHeavyArmor(): { negativeCases: number; silhouette: Record<string, number> } {
  const recipe = createRecipe({ slots: { top: 'heavy_armor', bottom: 'heavy_armor_skirt' } });
  const top = makeTop(recipe)!, bottom = makeTrousers(recipe)!;
  assertHeavyArmorTop(top); assertHeavyArmorSkirt(bottom);
  const medium = createRecipe({ slots: { top: 'medium_armor', bottom: 'medium_armor_skirt' } });
  const mediumTop = makeTop(medium)!, mediumBottom = makeTrousers(medium)!;
  const silhouette = {
    shoulderRatio: extent(top.mesh, 'Top.Right.HeavyShoulderRim.', 0) / extent(mediumTop.mesh, 'Top.Right.PauldronRim.', 0),
    torsoDepthRatio: extent(top.mesh, 'Top.Plate.', 2) / extent(mediumTop.mesh, 'Top.Plate.', 2),
    skirtWidthRatio: extent(bottom.mesh, 'HeavyArmorSkirt.7.', 0) / extent(mediumBottom.mesh, 'MediumArmorSkirt.5.', 0),
    skirtDepthRatio: extent(bottom.mesh, 'HeavyArmorSkirt.5.', 2) / extent(mediumBottom.mesh, 'MediumArmorSkirt.3.', 2),
  };
  assert(silhouette.shoulderRatio > 1.12 && silhouette.torsoDepthRatio > 1.20 && silhouette.skirtWidthRatio > 1.15 && silhouette.skirtDepthRatio > 1.20, '重甲必须从肩宽、胸腹厚度及裙甲体量同时区别中甲');
  let negativeCases = 0;
  for (const [piece, check] of [[top, assertHeavyArmorTop], [bottom, assertHeavyArmorSkirt]] as const) {
    const mutations: ((p: GarmentPiece) => void)[] = [
      p => { p.mesh.faces.pop(); }, p => { p.mesh.faces[0].v.reverse(); }, p => { p.mesh.faces.push(structuredClone(p.mesh.faces[0])); },
      p => { p.mesh.vertices[0].p[0] = NaN; }, p => { p.mesh.vertices[0].w[2] = NaN; }, p => { p.mesh.vertices[0].w = [B.Head, B.Head, 1]; },
      p => { for (const v of p.mesh.vertices) v.p[0] *= .65; }, p => { for (const v of p.mesh.vertices) v.p[2] *= .70; },
    ];
    for (const mutate of mutations) { const bad = structuredClone(piece); mutate(bad); assert.throws(() => check(bad)); negativeCases++; }
  }
  for (const mutate of [
    (p: GarmentPiece) => { for (const v of vertices(p.mesh, 'HeavyArmorSkirt.0.')) v.p[1] -= .12; },
    (p: GarmentPiece) => { for (const v of vertices(p.mesh, 'HeavyArmorSkirt.7.')) v.p[1] -= .12; },
    (p: GarmentPiece) => { p.mesh.vertices.find(v => v.id === 'HeavyArmorLiner.Right.Entry.0')!.p[1] = .70; },
    (p: GarmentPiece) => { p.mesh.vertices.find(v => v.id === 'HeavyArmorSkirt.3.0')!.w[1] = B.LeftThigh; },
    (p: GarmentPiece) => { p.mesh.vertices.find(v => v.id === 'HeavyArmorSkirt.5.4')!.w[2] = .35; },
  ]) { const bad = structuredClone(bottom); mutate(bad); assert.throws(() => assertHeavyArmorSkirt(bad)); negativeCases++; }
  return { negativeCases, silhouette };
}
