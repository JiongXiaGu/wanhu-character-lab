import assert from 'node:assert/strict';
import { Triangle, Vector3 } from 'three';
import type { MountActor } from '../src/mounts/types';
import { cattleBone } from '../src/cattle/rig';

export const CATTLE_AUTHOR_STATS = { triangles: 1956, logicalVertices: 1032, gpuVertices: 5868, bones: 28 };
const idsFor = (actor: MountActor, part: string) => [...new Set(actor.data.triangles.filter(face => face.part === part).flatMap(face => face.indices))].sort((a, b) => a - b);
function distanceTo(actor: MountActor, part: string, point: Vector3) {
  const triangle = new Triangle(), closest = new Vector3(); let distance = Infinity;
  for (const face of actor.data.triangles.filter(face => face.part === part)) {
    triangle.set(...face.indices.map(i => new Vector3(...actor.data.vertices[i].position)) as [Vector3, Vector3, Vector3]);
    triangle.closestPointToPoint(point, closest); distance = Math.min(distance, point.distanceTo(closest));
  }
  return distance;
}
function bounds(actor: MountActor, part: string) {
  const points = idsFor(actor, part).map(i => actor.data.vertices[i].position); assert(points.length > 0, `missing ${part}`);
  const min = [0, 1, 2].map(axis => Math.min(...points.map(p => p[axis]))), max = [0, 1, 2].map(axis => Math.max(...points.map(p => p[axis])));
  return { min, max, width: max[0] - min[0] };
}
function horns(actor: MountActor) {
  const left = idsFor(actor, 'LeftHorn'), right = idsFor(actor, 'RightHorn'); assert.equal(left.length, 42); assert.equal(right.length, 42);
  for (const i of [...left, ...right]) assert.deepEqual(actor.data.vertices[i].weight, [cattleBone('Head'), cattleBone('Head'), 1], 'horn must be rigid Head');
  const rp = right.map(i => new Vector3(...actor.data.vertices[i].position));
  for (const i of left) { const p = new Vector3(...actor.data.vertices[i].position); p.x *= -1; assert(rp.some(q => p.distanceTo(q) < 1e-8), 'asymmetric horn'); }
  const reports = [];
  for (const ids of [left, right]) {
    const centers = Array.from({ length: 5 }, (_, r) => ids.slice(r * 8, r * 8 + 8).reduce((p, i) => p.add(new Vector3(...actor.data.vertices[i].position)), new Vector3()).multiplyScalar(1 / 8));
    const outward = centers[1].clone().sub(centers[0]).normalize(), upward = centers[4].clone().sub(centers[3]).normalize();
    assert(outward.dot(upward) < .8, 'horn is a straight cone instead of a curved shell');
    const rootGap = distanceTo(actor, 'Head', centers[0]), tipGap = distanceTo(actor, 'Head', centers[4]);
    assert(rootGap < .04, `detached horn root: ${rootGap}`); assert(tipGap > .12, `horn buried in head: ${tipGap}`);
    assert(Math.abs(centers[4].x) > .40 && Math.abs(centers[4].x) < .50 && centers[4].y - centers[0].y > .20, 'horn silhouette');
    reports.push({ rootGap, tipGap, bend: outward.dot(upward) });
  }
  return reports;
}
function hooves(actor: MountActor) {
  const gaps: Record<string, number> = {};
  for (const leg of ['FrontLeft', 'FrontRight', 'BackLeft', 'BackRight']) {
    const sign = leg.endsWith('Right') ? 1 : -1;
    const inner = idsFor(actor, `${leg}InnerHoof`), outer = idsFor(actor, `${leg}OuterHoof`);
    assert.equal(inner.length, 26, `${leg}: missing inner toe`); assert.equal(outer.length, 26, `${leg}: missing outer toe`);
    for (const i of [...inner, ...outer]) assert.deepEqual(actor.data.vertices[i].weight, [cattleBone(`${leg}Foot`), cattleBone(`${leg}Foot`), 1], 'toe must be rigid Foot');
    const gap = Math.min(...outer.map(i => sign * actor.data.vertices[i].position[0])) - Math.max(...inner.map(i => sign * actor.data.vertices[i].position[0]));
    assert(gap > .008 && gap < .045, `${leg}: no real split hoof (${gap})`); gaps[leg] = gap;
  }
  return gaps;
}
function dewlap(actor: MountActor) {
  const ids = idsFor(actor, 'Dewlap'); assert.equal(ids.length, 34);
  for (const i of ids) { const [a, b, w] = actor.data.vertices[i].weight; assert.equal(a, cattleBone('Chest')); assert.equal(b, cattleBone('NeckBase')); assert(w > 0 && w < 1); }
}
function noseMirror(actor: MountActor) {
  const ids = idsFor(actor, 'NoseMirror'); assert.equal(ids.length, 26);
  for (const i of ids) assert.deepEqual(actor.data.vertices[i].weight, [cattleBone('Head'), cattleBone('Head'), 1]);
  const contact = Math.min(...ids.map(i => distanceTo(actor, 'Head', new Vector3(...actor.data.vertices[i].position))));
  assert(contact < .008, `floating nose mirror: ${contact}`); assert(bounds(actor, 'NoseMirror').width > .32); return contact;
}
/** 黄牛识别特征和真正会失败的反例；闭合性/姿态/地面仍走原有严格公共检查。 */
export function checkCattleAnatomy(actor: MountActor) {
  const body = bounds(actor, 'Body'), head = bounds(actor, 'Head'), neck = bounds(actor, 'Neck');
  assert(body.width > .90 && body.width < 1.05 && body.min[1] < .65 && body.max[1] < 1.45, 'cattle needs a low broad barrel');
  assert(head.width > .44 && neck.width > .54, 'cattle needs a broad head and thick short neck');
  const hornReport = horns(actor), hoofGaps = hooves(actor), noseContact = noseMirror(actor); dewlap(actor);
  let faults = 0;
  const hornIds = idsFor(actor, 'LeftHorn'), horn = actor.data.vertices[hornIds[0]], savedWeight = [...horn.weight] as [number, number, number];
  horn.weight = [cattleBone('Neck'), cattleBone('Neck'), 1]; assert.throws(() => horns(actor)); horn.weight = savedWeight; faults++;
  const x = horn.position[0]; horn.position[0] += .04; assert.throws(() => horns(actor)); horn.position[0] = x; faults++;
  const faces = actor.data.triangles.filter(face => face.part === 'FrontLeftInnerHoof');
  faces.forEach(face => { face.part = 'FrontLeftSingleHoof'; }); assert.throws(() => hooves(actor)); faces.forEach(face => { face.part = 'FrontLeftInnerHoof'; }); faults++;
  const toe = actor.data.vertices[idsFor(actor, 'FrontLeftOuterHoof')[0]], toeWeight = [...toe.weight] as [number, number, number];
  toe.weight = [cattleBone('FrontLeftLower'), cattleBone('FrontLeftLower'), 1]; assert.throws(() => hooves(actor)); toe.weight = toeWeight; faults++;
  const d = actor.data.vertices[idsFor(actor, 'Dewlap')[0]], dw = [...d.weight] as [number, number, number]; d.weight = [cattleBone('Head'), cattleBone('Head'), 1]; assert.throws(() => dewlap(actor)); d.weight = dw; faults++;
  const nose = idsFor(actor, 'NoseMirror'), saved = nose.map(i => actor.data.vertices[i].position[2]);
  nose.forEach(i => { actor.data.vertices[i].position[2] += .10; }); assert.throws(() => noseMirror(actor)); nose.forEach((i, j) => { actor.data.vertices[i].position[2] = saved[j]; }); faults++;
  return { body, head, neck, horns: hornReport, splitHooves: 8, hoofGaps, noseContact, faults };
}
