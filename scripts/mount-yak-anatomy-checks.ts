import assert from 'node:assert/strict';
import { Ray, Triangle, Vector3 } from 'three';
import type { MountActor } from '../src/mounts/types';
import { yakBone } from '../src/yak/rig';
import { YAK_FUR_PARTS } from '../src/yak/geometry';
import { skinnedPoints, validateMountMesh } from './mount-check-helpers';

export const YAK_AUTHOR_STATS = { triangles: 2328, logicalVertices: 1224, gpuVertices: 6984, bones: 29 };
const idsFor = (actor: MountActor, part: string) => [...new Set(actor.data.triangles.filter(f => f.part === part).flatMap(f => f.indices))].sort((a, b) => a - b);
function distanceTo(actor: MountActor, part: string, point: Vector3, points = actor.data.vertices.map(v => new Vector3(...v.position))) {
  const triangle = new Triangle(), closest = new Vector3(); let distance = Infinity;
  for (const f of actor.data.triangles.filter(f => f.part === part)) {
    triangle.set(points[f.indices[0]], points[f.indices[1]], points[f.indices[2]]); triangle.closestPointToPoint(point, closest); distance = Math.min(distance, point.distanceTo(closest));
  }
  return distance;
}
function bounds(actor: MountActor, part: string) {
  const points = idsFor(actor, part).map(i => actor.data.vertices[i].position); assert(points.length, `missing ${part}`);
  const min = [0, 1, 2].map(a => Math.min(...points.map(p => p[a]))), max = [0, 1, 2].map(a => Math.max(...points.map(p => p[a])));
  return { min, max, width: max[0] - min[0] };
}
function inside(actor: MountActor, part: string, point: Vector3, points: Vector3[]) {
  const ray = new Ray(point, new Vector3(.731, .473, .491).normalize()), hit = new Vector3(), distances: number[] = [];
  for (const f of actor.data.triangles.filter(f => f.part === part)) if (ray.intersectTriangle(points[f.indices[0]], points[f.indices[1]], points[f.indices[2]], false, hit)) {
    const d = point.distanceTo(hit); if (!distances.some(v => Math.abs(v - d) < 1e-7)) distances.push(d);
  }
  return distances.length % 2 === 1;
}
/** 仅比较作者根圈／根盖与相邻实体，不给毛壳整件相交豁免。姿态检查使用真实蒙皮点。 */
export function checkYakFurAttachments(actor: MountActor, posed = false) {
  const points = posed ? skinnedPoints(actor) : actor.data.vertices.map(v => new Vector3(...v.position));
  const owners: Record<typeof YAK_FUR_PARTS[number], string[]> = {
    ChestFur: ['Body', 'Neck'], Forelock: ['Head'], LeftCheekFur: ['Head'], RightCheekFur: ['Head'], TailPlume: ['TailStem'],
  };
  const gaps: Record<string, number> = {};
  for (const part of YAK_FUR_PARTS) {
    const ids = idsFor(actor, part); assert(ids.length > 10, `missing fur shell ${part}`);
    const sides = part.includes('Cheek') ? 8 : 10, anchors = [...ids.slice(0, sides), ids.at(-2)!];
    let attached = false, gap = Infinity;
    for (const i of anchors) for (const owner of owners[part]) {
      const d = distanceTo(actor, owner, points[i], points); gap = Math.min(gap, d);
      if (inside(actor, owner, points[i], points) || d < .006) attached = true;
    }
    assert(attached, `${part}: root detached from ${owners[part]} (${gap})`); gaps[part] = gap;
  }
  return gaps;
}
function mantle(actor: MountActor) {
  const ids = idsFor(actor, 'Body'), faces = actor.data.triangles.filter(f => f.part === 'Body'); assert.equal(ids.length, 178);
  const edges = new Set<string>(), neighbors = new Map<number, Set<number>>();
  for (const f of faces) f.indices.forEach((a, i) => { const b = f.indices[(i + 1) % 3]; edges.add([a, b].sort((x, y) => x - y).join('/')); (neighbors.get(a) ?? (neighbors.set(a, new Set()), neighbors.get(a)!)).add(b); });
  const seen = new Set<number>(), stack = [ids[0]];
  while (stack.length) { const i = stack.pop()!; if (seen.has(i)) continue; seen.add(i); for (const j of neighbors.get(i)!) stack.push(j); }
  assert.equal(seen.size, ids.length, 'mantle and body must share one connected surface'); assert.equal(ids.length - edges.size + faces.length, 2);
  const points = ids.map(i => actor.data.vertices[i]), allowed = ['Pelvis', 'Spine', 'Chest'].map(yakBone);
  for (const v of points) {
    assert(v.weight.slice(0, 2).every(i => allowed.includes(i)), 'mantle must follow only the trunk');
    const mirrored = points.find(q => Math.abs(q.position[0] + v.position[0]) < 1e-8 && Math.abs(q.position[1] - v.position[1]) < 1e-8 && Math.abs(q.position[2] - v.position[2]) < 1e-8);
    assert(mirrored, 'asymmetric mantle'); assert.deepEqual(mirrored.weight, v.weight, 'asymmetric mantle skin');
  }
  const body = bounds(actor, 'Body'); assert(body.width > 1.10 && body.width < 1.20 && body.min[1] > .25 && body.min[1] < .35 && body.max[1] < 1.51);
  const front = points.filter(v => v.position[2] > .05), rear = points.filter(v => v.position[2] < -.6);
  const rise = Math.max(...front.map(v => v.position[1])) - Math.max(...rear.map(v => v.position[1])); assert(rise > .17 && rise < .27, 'shoulder mass must rise above hindquarter');
  assert(Math.max(...front.map(v => Math.abs(v.position[0]))) > 1.15 * Math.max(...rear.map(v => Math.abs(v.position[0]))), 'forequarter too narrow');
  // 两侧裙毛比中腹低20厘米以上，不允许回退为光滑桶身加一排小碎片。
  for (const r of [3, 4, 5, 6, 7, 8]) {
    const row = ids.slice(r * 16, r * 16 + 16).map(i => actor.data.vertices[i].position);
    assert(row[12][1] - row[10][1] > .20 && row[12][1] - row[14][1] > .20, 'missing continuous low side skirt');
    assert(Math.abs(row[10][0]) > .4 && row[10][2] === row[12][2]);
  }
  return { ...body, connectedVertices: seen.size, euler: ids.length - edges.size + faces.length, shoulderRise: rise };
}
function horns(actor: MountActor) {
  const left = idsFor(actor, 'LeftHorn'), right = idsFor(actor, 'RightHorn'); assert.equal(left.length, 50); assert.equal(right.length, 50);
  for (const i of [...left, ...right]) assert.deepEqual(actor.data.vertices[i].weight, [yakBone('Head'), yakBone('Head'), 1]);
  const rp = right.map(i => new Vector3(...actor.data.vertices[i].position));
  for (const i of left) { const p = new Vector3(...actor.data.vertices[i].position); p.x *= -1; assert(rp.some(q => p.distanceTo(q) < 1e-8), 'asymmetric yak horns'); }
  return [left, right].map(ids => {
    const centers = Array.from({ length: 6 }, (_, r) => ids.slice(r * 8, r * 8 + 8).reduce((p, i) => p.add(new Vector3(...actor.data.vertices[i].position)), new Vector3()).multiplyScalar(1 / 8));
    const outward = centers[1].clone().sub(centers[0]).normalize(), up = centers[5].clone().sub(centers[4]).normalize();
    const rootGap = distanceTo(actor, 'Head', centers[0]), tipGap = distanceTo(actor, 'Head', centers[5]);
    assert(rootGap < .04, `detached horn root ${rootGap}`); assert(tipGap > .35, 'horn buried in head');
    assert(outward.dot(up) < .4 && Math.abs(outward.x) > .8 && up.y > .75, 'horn must spread outward then turn upward');
    assert(Math.abs(centers[5].x) > .60 && Math.abs(centers[5].x) < .69 && centers[5].y - centers[0].y > .30, 'yak horn silhouette');
    return { rootGap, tipGap, bend: outward.dot(up) };
  });
}
function hooves(actor: MountActor) {
  const gaps: Record<string, number> = {};
  for (const leg of ['FrontLeft', 'FrontRight', 'BackLeft', 'BackRight']) {
    const sign = leg.endsWith('Right') ? 1 : -1, inner = idsFor(actor, `${leg}InnerHoof`), outer = idsFor(actor, `${leg}OuterHoof`);
    assert.equal(inner.length, 26); assert.equal(outer.length, 26);
    for (const i of [...inner, ...outer]) assert.deepEqual(actor.data.vertices[i].weight, [yakBone(`${leg}Foot`), yakBone(`${leg}Foot`), 1]);
    const gap = Math.min(...outer.map(i => sign * actor.data.vertices[i].position[0])) - Math.max(...inner.map(i => sign * actor.data.vertices[i].position[0]));
    assert(gap > .008 && gap < .045, `${leg}: no geometric toe split`); gaps[leg] = gap;
  }
  return gaps;
}
function legs(actor: MountActor) {
  actor.bones[0].updateMatrixWorld(true); const body = bounds(actor, 'Body'), length = body.max[2] - body.min[2];
  const joint = (name: string) => actor.bones[yakBone(name)].getWorldPosition(new Vector3()), reports: Record<string, unknown> = {};
  for (const side of ['Left', 'Right']) {
    const front = joint(`Front${side}Upper`), foot = joint(`Front${side}Foot`), back = joint(`Back${side}Upper`), knee = joint(`Back${side}Middle`), hock = joint(`Back${side}Lower`), hindFoot = joint(`Back${side}Foot`);
    const shoulderInset = (body.max[2] - front.z) / length, hipInset = (back.z - body.min[2]) / length;
    assert(shoulderInset > .08 && shoulderInset < .18); assert(hipInset > .12 && hipInset < .20);
    assert(foot.z - front.z > .04 && foot.z - front.z < .105, 'front foot too far ahead of load');
    assert(knee.z - back.z > .14 && knee.z - back.z < .25); assert(hock.z - knee.z < -.16 && hock.z - knee.z > -.28);
    assert(Math.abs(hindFoot.z - back.z) < .07);
    for (const prefix of ['Front', 'Back']) {
      const name = `${prefix}${side}`, legIds = idsFor(actor, `${name}Leg`); assert.equal(legIds.length, 66);
      const foot = joint(`${name}Foot`), toeIds = [...idsFor(actor, `${name}InnerHoof`), ...idsFor(actor, `${name}OuterHoof`)];
      const center = toeIds.reduce((p, i) => p.add(new Vector3(...actor.data.vertices[i].position)), new Vector3()).multiplyScalar(1 / toeIds.length);
      assert(Math.abs(center.x - foot.x) < .002 && Math.abs(center.z - foot.z) < .035);
      // 上段腿毛与Body同处承重区域，下段收窄，不能挂在身体外另作无根壳。
      const root = actor.data.vertices[legIds.at(-2)!].position, lo = bounds(actor, `${name}Leg`);
      assert(root[2] > body.min[2] && root[2] < body.max[2] && Math.abs(root[0]) < body.width / 2);
      assert(lo.min[1] < .11 && lo.max[1] > 1.10 && lo.width > .33);
    }
    reports[side] = { shoulderInset, hipInset, frontAdvance: foot.z - front.z, kneeAdvance: knee.z - back.z, hockReturn: hock.z - knee.z };
  }
  return reports;
}
function hairWeights(actor: MountActor) {
  const allowed: Record<string, string[]> = { ChestFur: ['Chest', 'NeckBase'], Forelock: ['Head', 'Forelock'], LeftCheekFur: ['Head'], RightCheekFur: ['Head'], TailPlume: ['Tail', 'TailMiddle', 'TailEnd'] };
  for (const part of YAK_FUR_PARTS) for (const i of idsFor(actor, part)) assert(actor.data.vertices[i].weight.slice(0, 2).every(j => allowed[part].map(yakBone).includes(j)), `wrong fur skin ${part}`);
}
function nose(actor: MountActor) {
  const ids = idsFor(actor, 'NoseMirror'); assert.equal(ids.length, 26);
  for (const i of ids) assert.deepEqual(actor.data.vertices[i].weight, [yakBone('Head'), yakBone('Head'), 1]);
  const gap = Math.min(...ids.map(i => distanceTo(actor, 'Head', new Vector3(...actor.data.vertices[i].position))));
  assert(gap < .008 && bounds(actor, 'NoseMirror').width > .36, `detached nose ${gap}`); return gap;
}
/** 牦牛作者结构与故障注入：必须检测缺毛、飘毛、坏绑定、单蹄、错腿位，而非只测目录可切换。 */
export function checkYakAnatomy(actor: MountActor) {
  const body = mantle(actor), hornReport = horns(actor), hoofGaps = hooves(actor), legReport = legs(actor), noseContact = nose(actor);
  hairWeights(actor); const attachments = checkYakFurAttachments(actor);
  const head = bounds(actor, 'Head'), neck = bounds(actor, 'Neck'), chest = bounds(actor, 'ChestFur'), tail = bounds(actor, 'TailPlume');
  assert(head.width > .50 && head.max[1] < 1.43 && neck.width > .65 && neck.max[2] - neck.min[2] < .85, 'low broad head / short thick neck');
  assert(chest.width > .64 && chest.min[1] < .36 && tail.width > .30, 'insufficient chest hair or tail volume');
  let faults = 0;
  const mutate = (part: string, action: (ids: number[]) => void, test: () => unknown) => {
    const ids = idsFor(actor, part), saved = ids.map(i => structuredClone(actor.data.vertices[i]));
    try { action(ids); assert.throws(test); faults++; } finally { ids.forEach((i, j) => { actor.data.vertices[i] = saved[j]; }); }
  };
  mutate('LeftHorn', ids => { actor.data.vertices[ids[0]].weight = [yakBone('Neck'), yakBone('Neck'), 1]; }, () => horns(actor));
  mutate('LeftHorn', ids => { actor.data.vertices[ids[0]].position[0] += .04; }, () => horns(actor));
  mutate('FrontLeftOuterHoof', ids => { actor.data.vertices[ids[0]].weight = [yakBone('FrontLeftLower'), yakBone('FrontLeftLower'), 1]; }, () => hooves(actor));
  const toeFaces = actor.data.triangles.filter(f => f.part === 'FrontLeftInnerHoof');
  toeFaces.forEach(f => { f.part = 'SingleHoof'; }); assert.throws(() => hooves(actor)); toeFaces.forEach(f => { f.part = 'FrontLeftInnerHoof'; }); faults++;
  mutate('ChestFur', ids => { actor.data.vertices[ids[0]].weight = [yakBone('Head'), yakBone('Head'), 1]; }, () => hairWeights(actor));
  for (const part of YAK_FUR_PARTS) mutate(part, ids => ids.forEach(i => { actor.data.vertices[i].position[0] += 1; }), () => checkYakFurAttachments(actor));
  mutate('NoseMirror', ids => ids.forEach(i => { actor.data.vertices[i].position[2] += .12; }), () => nose(actor));
  mutate('Body', ids => { for (const i of ids) if (actor.data.vertices[i].position[1] < .58) actor.data.vertices[i].position[1] = .59; }, () => mantle(actor));
  mutate('Body', ids => { actor.data.vertices[ids[0]].weight = [yakBone('Head'), yakBone('Head'), 1]; }, () => mantle(actor));
  const faceIndex = actor.data.triangles.findIndex(f => f.part === 'ChestFur'), removed = actor.data.triangles.splice(faceIndex, 1)[0];
  assert.throws(() => validateMountMesh(actor)); actor.data.triangles.splice(faceIndex, 0, removed); faults++;
  for (const [name, dz] of [['FrontLeftFoot', .08], ['BackLeftUpper', .12]] as const) {
    const bone = actor.bones[yakBone(name)], z = bone.position.z; bone.position.z += dz; actor.bones[0].updateMatrixWorld(true);
    assert.throws(() => legs(actor)); bone.position.z = z; actor.bones[0].updateMatrixWorld(true); faults++;
  }
  return { body, head, neck, chest, tail, horns: hornReport, splitHooves: 8, hoofGaps, legs: legReport, attachments, noseContact, faults };
}
