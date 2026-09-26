import assert from 'node:assert/strict';
import { B, createRecipe, type Cage, type Weight } from '../src/character/v3/types';
import { triCount } from '../src/character/v3/cage';
import { kneeWeights } from '../src/character/v3/leg-deformation';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import type { GarmentPiece } from '../src/character/wardrobe/assets/contract';
import { assertGarmentPiece } from './check-garment-assets';

export const HEAVY_ARMOR_BUDGET = { top: 432, bottom: 408 } as const;
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
  assert(extent(piece.mesh, 'Top.Plate.', 2) >= .205, '胸腹甲壳厚度不足');
  assert(extent(piece.mesh, 'Top.BeltTop.', 0) >= .225, '腰甲不能收回中甲体量');
  for (const side of ['Right', 'Left']) {
    assert(extent(piece.mesh, `Top.${side}.HeavyShoulderRim.`, 0) >= .440, '外肩必须有明确宽厚体量');
    assert(extent(piece.mesh, `Top.${side}.HeavyShoulderCrest.`, 2) >= .095, '护肩侧向厚度不足');
  }
}

export function assertHeavyArmorSkirt(piece: GarmentPiece): void {
  assert.equal(piece.id, 'heavy_armor_skirt'); assert.equal(piece.slot, 'bottom');
  assertGarmentPiece(piece); connected(piece.mesh);
  assert.equal(triCount(piece.mesh), HEAVY_ARMOR_BUDGET.bottom); assert.equal(piece.mesh.vertices.length, 206);
  const waistHips = [1, .72, .60], waistY = [1.205, 1.105, .980];
  const depth = [1, .88, 0, -.88, -1, -1, -.88, 0, .88, 1];
  const labels = ['Entry', 'Upper', 'LowerThigh', 'KneeUpper', 'Knee', 'KneeLower', 'Hem', 'HemEdge'];
  for (const v of piece.mesh.vertices) {
    const waist = /^HeavyArmorSkirt\.Waist\.(\d+)\.(\d+)$/.exec(v.id);
    if (waist) {
      const row = Number(waist[1]), col = Number(waist[2]); assert(row < 3 && col < 10);
      near(v.p[1], waistY[row]);
      assert.deepEqual(v.w, row === 0 ? [B.Hips, B.Hips, 1] : [B.Hips, v.p[0] > 0 ? B.RightThigh : B.LeftThigh, waistHips[row] + (1 - waistHips[row]) * .16 * (1 - depth[col])]);
      continue;
    }
    const leg = /^HeavyArmor(Skirt|Liner)\.(Right|Left)\.(\w+)\.(\d+)$/.exec(v.id); assert(leg, v.id);
    const right = leg[2] === 'Right', thigh = right ? B.RightThigh : B.LeftThigh, shin = right ? B.RightShin : B.LeftShin, foot = right ? B.RightFoot : B.LeftFoot;
    const label = leg[3], col = Number(leg[4]); assert(col < 8);
    if (leg[1] === 'Skirt') {
      assert(labels.includes(label));
      if (label === 'Entry') {
        const inner = [5, 6, 7].includes(col);
        assert.deepEqual(v.w, [B.Hips, thigh, inner ? col === 6 ? .35 : .50 : .64], v.id);
        near(v.p[1], inner ? col === 6 ? .855 : .882 : .940);
      } else if (label === 'Upper') assert.deepEqual(v.w, [B.Hips, thigh, .22], v.id);
      else assert.deepEqual(v.w, kneeWeights(v.p, thigh, shin), v.id);
      if (label === 'HemEdge') near(v.p[1], .360);
    } else {
      assert(['Opening', 'Calf', 'Cuff'].includes(label));
      assert.deepEqual(v.w, label === 'Cuff' ? [shin, foot, .2] : kneeWeights(v.p, thigh, shin), v.id);
      if (label === 'Opening') near(v.p[1], .335);
    }
  }
  for (const side of ['Right', 'Left']) {
    assert(extent(piece.mesh, `HeavyArmorSkirt.${side}.HemEdge.`, 0) >= .290, '长围裳必须保留宽轮廓，不可收成紧腿裤');
    assert(extent(piece.mesh, `HeavyArmorSkirt.${side}.Knee.`, 2) >= .143, '前后甲裳过膝后仍须有实质体量');
    assert(extent(piece.mesh, `HeavyArmorSkirt.${side}.HemEdge.`, 2) >= .125, '不能用单面装饰片代替厚围裳');
    const hem = vertices(piece.mesh, `HeavyArmorSkirt.${side}.HemEdge.`), hole = vertices(piece.mesh, `HeavyArmorLiner.${side}.Opening.`);
    assert.equal(hem.length, 8); assert.equal(hole.length, 8);
    assert(Math.max(...hem.map(v => Math.abs(v.p[0]))) - Math.max(...hole.map(v => Math.abs(v.p[0]))) > .12, '裙边须真实向腿出口回折');
    assert(hole.every(v => Math.abs(v.p[0]) > .035 && Math.abs(v.p[0]) < .165), '两条裤管出口不得封死、合并或横跨中线');
  }
  for (const sign of [-1, 1]) assert(piece.mesh.faces.some(f => f.v.every(i => piece.mesh.vertices[i].id.startsWith('HeavyArmorSkirt.')) && f.v.some(i => piece.mesh.vertices[i].p[0] < 0) && f.v.some(i => piece.mesh.vertices[i].p[0] > 0) && f.v.every(i => Math.sign(piece.mesh.vertices[i].p[2]) === sign)), '上段围裳正背均连续跨中线，下段分裳服务现有20骨活动');
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
    skirtWidthRatio: extent(bottom.mesh, 'HeavyArmorSkirt.Right.HemEdge.', 0) / extent(mediumBottom.mesh, 'MediumArmorSkirt.5.', 0),
    hemExtension: .685 - Math.min(...vertices(bottom.mesh, 'HeavyArmorSkirt.Right.HemEdge.').map(v => v.p[1])),
    skirtDepthRatio: extent(bottom.mesh, 'HeavyArmorSkirt.Right.Knee.', 2) / extent(mediumBottom.mesh, 'MediumArmorLiner.Right.Knee.', 2),
  };
  assert(silhouette.shoulderRatio > 1.16 && silhouette.torsoDepthRatio > 1.40 && silhouette.skirtWidthRatio > 1.15 && silhouette.skirtDepthRatio > 2.50 && silhouette.hemExtension > .30, '重甲必须从肩宽、胸腹厚度及裙甲体量同时区别中甲');
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
    (p: GarmentPiece) => { for (const v of vertices(p.mesh, 'HeavyArmorSkirt.Waist.0.')) v.p[1] -= .12; },
    (p: GarmentPiece) => { for (const side of ['Right', 'Left']) for (const v of vertices(p.mesh, `HeavyArmorSkirt.${side}.HemEdge.`)) v.p[1] = .685; },
    (p: GarmentPiece) => { p.mesh.vertices.find(v => v.id === 'HeavyArmorLiner.Right.Opening.0')!.p[0] = 0; },
    (p: GarmentPiece) => { p.mesh.vertices.find(v => v.id === 'HeavyArmorSkirt.Right.Upper.0')!.w[1] = B.LeftThigh; },
    (p: GarmentPiece) => { p.mesh.vertices.find(v => v.id === 'HeavyArmorSkirt.Right.Knee.4')!.w[2] = .35; },
    // 新拓扑保留历史失败权重反例的职责：S6-5 Entry=.50 曾在真实 Snatch 中反折。
    (p: GarmentPiece) => { for (const v of p.mesh.vertices) if (/^HeavyArmorSkirt\.(Right|Left)\.Entry\.[0-4]$/.test(v.id)) v.w[2] = .50; },
  ]) { const bad = structuredClone(bottom); mutate(bad); assert.throws(() => assertHeavyArmorSkirt(bad)); negativeCases++; }
  return { negativeCases, silhouette };
}
