import assert from 'node:assert/strict';
import { B, createRecipe, type Cage, type Weight } from '../src/character/v3/types';
import { triCount } from '../src/character/v3/cage';
import { kneeWeights } from '../src/character/v3/leg-deformation';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import type { GarmentPiece } from '../src/character/wardrobe/assets/contract';
import { assertGarmentPiece } from './check-garment-assets';

export const HEAVY_ARMOR_BUDGET = { top: 568, bottom: 302 } as const;
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
  assert.equal(triCount(piece.mesh), HEAVY_ARMOR_BUDGET.top); assert.equal(piece.mesh.vertices.length, 286);
  const torsoWeights: Record<string, Weight> = {
    Hem: [B.Hips, B.Spine, .35], Fauld: [B.Hips, B.Spine, .35], FauldRim: [B.Hips, B.Spine, .35], Belt: [B.Hips, B.Spine, .35], BeltTop: [B.Hips, B.Spine, .35],
    Abdomen: [B.Spine, B.Chest, .35], AbdomenRim: [B.Spine, B.Chest, .25], Plate: [B.Spine, B.Chest, .14],
    Chest: [B.Chest, B.Chest, 1], Shoulder: [B.Chest, B.Chest, 1],
    Gorget: [B.Chest, B.Neck, .35], CollarBase: [B.Chest, B.Neck, .35], Collar: [B.Chest, B.Neck, .35], Neck: [B.Chest, B.Neck, .35],
  };
  for (const v of piece.mesh.vertices) {
    const arm = /^Top\.(Right|Left)\.(\w+)\.(\d+)$/.exec(v.id);
    if (arm) {
      const right = arm[1] === 'Right', upper = right ? B.RightUpperArm : B.LeftUpperArm, fore = right ? B.RightForearm : B.LeftForearm, hand = right ? B.RightHand : B.LeftHand;
      const weights: Record<string, Weight> = {
        MantleRoot: [B.Chest, upper, .30], MantleCrest: [B.Chest, upper, .08], MantleRim: [upper, upper, 1], ShoulderLame: [upper, upper, 1], UpperGuard: [upper, upper, 1],
        ElbowUpper: [upper, fore, .90], Elbow: [upper, fore, .50], BracerTop: [upper, fore, .08], BracerPlate: [fore, fore, 1], BracerRim: [fore, fore, 1], Cuff: [fore, hand, .18],
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
  assert(extent(piece.mesh, 'Top.Plate.', 2) >= .235, '胸腹甲壳厚度不足');
  assert(extent(piece.mesh, 'Top.BeltTop.', 0) >= .225, '腰甲不能收回中甲体量');
  for (const side of ['Right', 'Left']) {
    assert(extent(piece.mesh, `Top.${side}.MantleRim.`, 0) >= .460, '外肩必须有明确宽厚体量');
    assert(extent(piece.mesh, `Top.${side}.MantleCrest.`, 2) >= .115, '护肩侧向厚度不足');
  }
}

/** 外部前后长裳独立于内部裆口高度；不得用内部裤管代替完整裙身。 */
function assertLongWrapSilhouette(c: Cage): void {
  assert(!c.vertices.some(v => /^HeavyArmorSkirt\.(Right|Left)\./.test(v.id)), '外甲裳不能恢复两条独立宽裤腿');
  for (const side of ['Right', 'Left']) {
    const split = vertices(c, `HeavyArmorLiner.${side}.Opening.`);
    assert(split.every(v => v.p[1] >= .28 && v.p[1] <= .34), '窄腿出口须藏在裙边内侧，不以长裤管穿过外裙');
    assert(Math.max(...split.map(v => v.p[0])) - Math.min(...split.map(v => v.p[0])) > .04, '真实腿出口不能缩成线');
  }
  const ridge = vertices(c, 'HeavyArmorGusset.');
  assert.equal(ridge.length, 5);
  assert(Math.max(...ridge.map(v => v.p[1])) - Math.min(...ridge.map(v => v.p[1])) >= .11, '中央连接须保留纵向拱形，不退回低位跨腿平底');
  assert(!c.faces.some(f => f.v.every(i => /^HeavyArmorLiner\.(Right|Left)\.Opening\./.test(c.vertices[i].id)) && f.v.some(i => c.vertices[i].id.includes('.Right.')) && f.v.some(i => c.vertices[i].id.includes('.Left.'))), '两腿出口不得恢复直接横跨连接');
  for (const sign of [-1, 1]) {
    const candidates = c.faces.filter(f => f.v.every(i => c.vertices[i].id.startsWith('HeavyArmorSkirt.')))
      .map(f => f.v.map(i => c.vertices[i].p))
      .filter(ps => ps.some(p => p[0] < 0) && ps.some(p => p[0] > 0) && ps.every(p => Math.sign(p[2]) === sign));
    assert(candidates.some(ps => Math.min(...ps.map(p => p[1])) <= .345), '前后甲裳必须连续到小腿段');
    for (const y of [.82, .70, .60, .49, .40, .35]) assert(candidates.some(ps => Math.min(...ps.map(p => p[1])) <= y && Math.max(...ps.map(p => p[1])) >= y), '长甲裳中线不得留下裤管式缺口');
  }
}

export function assertHeavyArmorSkirt(piece: GarmentPiece): void {
  assert.equal(piece.id, 'heavy_armor_skirt'); assert.equal(piece.slot, 'bottom');
  assertGarmentPiece(piece); connected(piece.mesh);
  assert.equal(triCount(piece.mesh), HEAVY_ARMOR_BUDGET.bottom); assert.equal(piece.mesh.vertices.length, 153);
  // 独立作者契约：不从生产网格常量导入尺寸或环数。
  const rows = ['Waist', 'Yoke', 'Hip', 'Upper', 'Middle', 'KneeUpper', 'Knee', 'KneeLower', 'Lower', 'Hem'];
  const heights = [1.205, 1.105, .980, .850, .720, .580, .489, .449, .380, .345];
  const hipWeights = [1, .72, .60, .38, .18];
  const depthProfile = [1, .88, 0, -.88, -1, -1, -.88, 0, .88, 1];
  for (const label of rows) assert.equal(vertices(piece.mesh, `HeavyArmorSkirt.${label}.`).length, 10);
  for (const side of ['Right', 'Left']) for (const label of ['Opening', 'Calf', 'Cuff']) assert.equal(vertices(piece.mesh, `HeavyArmorLiner.${side}.${label}.`).length, 8);
  for (const v of piece.mesh.vertices) {
    const skirt = /^HeavyArmorSkirt\.(\w+)\.(\d+)$/.exec(v.id);
    if (skirt) {
      const row = rows.indexOf(skirt[1]), column = Number(skirt[2]); assert(row >= 0 && column < 10, v.id);
      near(v.p[1], heights[row]);
      const thigh = v.p[0] > 0 ? B.RightThigh : B.LeftThigh, shin = v.p[0] > 0 ? B.RightShin : B.LeftShin;
      const expected: Weight = row === 0 ? [B.Hips, B.Hips, 1] : row < 5
        ? [B.Hips, thigh, hipWeights[row] + (1 - hipWeights[row]) * .16 * (1 - depthProfile[column])]
        : kneeWeights(v.p, thigh, shin);
      assert.deepEqual(v.w, expected, v.id); continue;
    }
    const ridge = /^HeavyArmorGusset\.(\d+)$/.exec(v.id);
    if (ridge) {
      const k = Number(ridge[1]); assert(k < 5, v.id);
      near(v.p[0], 0); near(v.p[1], .330 + .030 * k); near(v.p[2], [-.04752, -.027456, 0, .027456, .04752][k]);
      assert.deepEqual(v.w, [B.LeftShin, B.RightShin, .5], '拱脊必须使用双腿对称静态权重'); continue;
    }
    const leg = /^HeavyArmorLiner\.(Right|Left)\.(\w+)\.(\d+)$/.exec(v.id); assert(leg, v.id);
    const right = leg[1] === 'Right', thigh = right ? B.RightThigh : B.LeftThigh, shin = right ? B.RightShin : B.LeftShin, foot = right ? B.RightFoot : B.LeftFoot;
    const label = leg[2], column = Number(leg[3]); assert(['Opening', 'Calf', 'Cuff'].includes(label) && column < 8, v.id);
    near(v.p[1], { Opening: .300, Calf: .270, Cuff: .095 }[label]!);
    let expected: Weight = label === 'Cuff' ? [shin, foot, .2] : kneeWeights(v.p, thigh, shin);
    if (label !== 'Cuff' && column >= 5) {
      const edge = (label === 'Opening' ? .066 : .062) * .9;
      const front = kneeWeights([v.p[0], v.p[1], edge], thigh, shin)[2];
      const back = kneeWeights([v.p[0], v.p[1], -edge], thigh, shin)[2];
      const planar = back + (front - back) * ((v.p[2] / edge + 1) * .5);
      expected = [thigh, shin, planar * .6 + expected[2] * .4];
    }
    assert.deepEqual(v.w, expected, v.id);
  }
  assertLongWrapSilhouette(piece.mesh);
  assert(extent(piece.mesh, 'HeavyArmorSkirt.Hem.', 0) >= .315, '整圈裙边必须宽于中甲，不可收成裤管');
  assert(extent(piece.mesh, 'HeavyArmorSkirt.Knee.', 2) >= .185, '膝部仍须属于完整厚甲裳');
  assert(extent(piece.mesh, 'HeavyArmorSkirt.Hem.', 2) >= .180, '裙边后片不能退化成单面装饰');
  for (const side of ['Right', 'Left']) {
    const hole = vertices(piece.mesh, `HeavyArmorLiner.${side}.Opening.`); assert.equal(hole.length, 8);
    assert(extent(piece.mesh, 'HeavyArmorSkirt.Hem.', 0) - Math.max(...hole.map(v => Math.abs(v.p[0]))) > .12, '裙边须真实向窄腿出口回折');
    assert(hole.every(v => Math.abs(v.p[0]) > .025 && Math.abs(v.p[0]) < .180), '两条腿出口不得封死、合并或横跨中线');
  }
}

export function checkHeavyArmor(): { negativeCases: number; silhouette: Record<string, number> } {
  const recipe = createRecipe({ slots: { top: 'heavy_armor', bottom: 'heavy_armor_skirt' } });
  const top = makeTop(recipe)!, bottom = makeTrousers(recipe)!;
  assertHeavyArmorTop(top); assertHeavyArmorSkirt(bottom);
  const medium = createRecipe({ slots: { top: 'medium_armor', bottom: 'medium_armor_skirt' } });
  const mediumTop = makeTop(medium)!, mediumBottom = makeTrousers(medium)!;
  const silhouette = {
    shoulderRatio: extent(top.mesh, 'Top.Right.MantleRim.', 0) / extent(mediumTop.mesh, 'Top.Right.PauldronRim.', 0),
    torsoDepthRatio: extent(top.mesh, 'Top.Plate.', 2) / extent(mediumTop.mesh, 'Top.Plate.', 2),
    skirtWidthRatio: extent(bottom.mesh, 'HeavyArmorSkirt.Hem.', 0) / extent(mediumBottom.mesh, 'MediumArmorSkirt.5.', 0),
    hemExtension: .685 - Math.min(...vertices(bottom.mesh, 'HeavyArmorSkirt.Hem.').map(v => v.p[1])),
    skirtDepthRatio: extent(bottom.mesh, 'HeavyArmorSkirt.Knee.', 2) / extent(mediumBottom.mesh, 'MediumArmorLiner.Right.Knee.', 2),
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
    (p: GarmentPiece) => { for (const v of vertices(p.mesh, 'HeavyArmorSkirt.Waist.')) v.p[1] -= .12; },
    (p: GarmentPiece) => { for (const v of vertices(p.mesh, 'HeavyArmorSkirt.Hem.')) v.p[1] = .685; },
    (p: GarmentPiece) => { p.mesh.vertices.find(v => v.id === 'HeavyArmorLiner.Right.Opening.0')!.p[0] = 0; },
    (p: GarmentPiece) => { p.mesh.vertices.find(v => v.id === 'HeavyArmorSkirt.Upper.0')!.w[1] = B.LeftThigh; },
    (p: GarmentPiece) => { p.mesh.vertices.find(v => v.id === 'HeavyArmorSkirt.Knee.4')!.w[2] = .35; },
    (p: GarmentPiece) => { for (const v of p.mesh.vertices) if (/^HeavyArmorLiner\.(Right|Left)\.Opening\.[0-4]$/.test(v.id)) v.w[2] = .50; },
  ]) { const bad = structuredClone(bottom); mutate(bad); assert.throws(() => assertHeavyArmorSkirt(bad)); negativeCases++; }
  const highSplit = structuredClone(bottom.mesh);
  highSplit.faces = highSplit.faces.filter(f => {
    const ps = f.v.map(i => highSplit.vertices[i]);
    return !(ps.every(v => v.id.startsWith('HeavyArmorSkirt.')) && ps.some(v => v.p[0] < 0) && ps.some(v => v.p[0] > 0) && Math.min(...ps.map(v => v.p[1])) < .65);
  });
  assert.throws(() => assertLongWrapSilhouette(highSplit)); negativeCases++;
  for (const sign of [-1, 1]) {
    const missingPanel = structuredClone(bottom.mesh);
    missingPanel.faces = missingPanel.faces.filter(f => !f.v.every(i => missingPanel.vertices[i].id.startsWith('HeavyArmorSkirt.') && Math.sign(missingPanel.vertices[i].p[2]) === sign));
    assert.throws(() => assertLongWrapSilhouette(missingPanel)); negativeCases++;
  }
  return { negativeCases, silhouette };
}
