import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUFFALO_JOINTS } from '../src/buffalo/rig';
import { CATTLE_JOINTS } from '../src/cattle/rig';
import { Triangle, Vector3 } from 'three';
import type { MountActor } from '../src/mounts/types';
import { buffaloBone } from '../src/buffalo/rig';

export const BUFFALO_AUTHOR_STATS = { triangles: 2056, logicalVertices: 1082, gpuVertices: 6168, bones: 28 };
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
  const left = idsFor(actor, 'LeftHorn'), right = idsFor(actor, 'RightHorn'); assert.equal(left.length, 50); assert.equal(right.length, 50);
  for (const i of [...left, ...right]) assert.deepEqual(actor.data.vertices[i].weight, [buffaloBone('Head'), buffaloBone('Head'), 1], 'horn must be rigid Head');
  const rp = right.map(i => new Vector3(...actor.data.vertices[i].position));
  for (const i of left) { const p = new Vector3(...actor.data.vertices[i].position); p.x *= -1; assert(rp.some(q => p.distanceTo(q) < 1e-8), 'asymmetric horn'); }
  const reports = [];
  for (const ids of [left, right]) {
    const centers = Array.from({ length: 6 }, (_, r) => ids.slice(r * 8, r * 8 + 8).reduce((p, i) => p.add(new Vector3(...actor.data.vertices[i].position)), new Vector3()).multiplyScalar(1 / 8));
    const outward = centers[1].clone().sub(centers[0]).normalize(), upward = centers[5].clone().sub(centers[4]).normalize();
    assert(outward.dot(upward) < .8, 'horn is a straight cone instead of a curved shell');
    const rootGap = distanceTo(actor, 'Head', centers[0]), tipGap = distanceTo(actor, 'Head', centers[5]);
    assert(rootGap < .04, `detached horn root: ${rootGap}`); assert(tipGap > .12, `horn buried in head: ${tipGap}`);
    assert(Math.abs(centers[5].x) > .78 && Math.abs(centers[5].x) < .90 && centers[5].y - centers[0].y > .23 && centers[5].y - centers[0].y < .40 && centers[5].z - centers[0].z < -.18, 'water buffalo horns must spread laterally, sweep back and turn up');
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
    for (const i of [...inner, ...outer]) assert.deepEqual(actor.data.vertices[i].weight, [buffaloBone(`${leg}Foot`), buffaloBone(`${leg}Foot`), 1], 'toe must be rigid Foot');
    const gap = Math.min(...outer.map(i => sign * actor.data.vertices[i].position[0])) - Math.max(...inner.map(i => sign * actor.data.vertices[i].position[0]));
    assert(gap > .008 && gap < .045, `${leg}: no real split hoof (${gap})`); gaps[leg] = gap;
  }
  return gaps;
}
function partCenter(actor: MountActor, part: string) {
  const ids = idsFor(actor, part); assert(ids.length > 0, `missing ${part}`);
  return ids.reduce((sum, i) => sum.add(new Vector3(...actor.data.vertices[i].position)), new Vector3()).multiplyScalar(1 / ids.length);
}
function legPlacement(actor: MountActor) {
  actor.bones[0].updateMatrixWorld(true);
  const body = bounds(actor, 'Body'), length = body.max[2] - body.min[2], reports: Record<string, unknown> = {};
  const joint = (name: string) => actor.bones[buffaloBone(name)].getWorldPosition(new Vector3());
  for (const side of ['Left', 'Right']) {
    const frontUpper = joint(`Front${side}Upper`), frontMiddle = joint(`Front${side}Middle`), frontFoot = joint(`Front${side}Foot`);
    const backUpper = joint(`Back${side}Upper`), backMiddle = joint(`Back${side}Middle`), backLower = joint(`Back${side}Lower`), backFoot = joint(`Back${side}Foot`);
    const frontShoulderInset = (body.max[2] - frontUpper.z) / length, rearHipInset = (backUpper.z - body.min[2]) / length;
    const frontAdvance = frontFoot.z - frontUpper.z, rearKneeAdvance = backMiddle.z - backUpper.z, rearHockReturn = backLower.z - backMiddle.z;
    assert(frontShoulderInset > .08 && frontShoulderInset < .18, `Front${side}: shoulder leg root drifted along body (${frontShoulderInset})`);
    assert(frontAdvance > .04 && frontAdvance < .105, `Front${side}: hoof is too far ahead of shoulder (${frontAdvance})`);
    assert(rearHipInset > .12 && rearHipInset < .20, `Back${side}: hind leg root is too far forward on the barrel (${rearHipInset})`);
    assert(rearKneeAdvance > .14 && rearKneeAdvance < .25, `Back${side}: stifle needs controlled forward break (${rearKneeAdvance})`);
    assert(rearHockReturn < -.16 && rearHockReturn > -.28, `Back${side}: hock must return behind the stifle (${rearHockReturn})`);
    assert(Math.abs(backFoot.z - backUpper.z) < .07, `Back${side}: planted hoof should return under the hindquarter`);
    const frontToe = partCenter(actor, `Front${side}InnerHoof`).add(partCenter(actor, `Front${side}OuterHoof`)).multiplyScalar(.5);
    const backToe = partCenter(actor, `Back${side}InnerHoof`).add(partCenter(actor, `Back${side}OuterHoof`)).multiplyScalar(.5);
    assert(Math.abs(frontToe.z - frontFoot.z) < .035, `Front${side}: hoof shell detached from Foot author point`);
    assert(Math.abs(backToe.z - backFoot.z) < .035, `Back${side}: hoof shell detached from Foot author point`);
    reports[side] = { frontShoulderInset, frontAdvance, rearHipInset, rearKneeAdvance, rearHockReturn, rearFootOffset: backFoot.z - backUpper.z };
  }
  return reports;
}
function dewlap(actor: MountActor) {
  const ids = idsFor(actor, 'Dewlap'); assert.equal(ids.length, 26);
  for (const i of ids) { const [a, b, w] = actor.data.vertices[i].weight; assert.equal(a, buffaloBone('Chest')); assert.equal(b, buffaloBone('NeckBase')); assert(w > 0 && w < 1); }
}
function noseMirror(actor: MountActor) {
  const ids = idsFor(actor, 'NoseMirror'); assert.equal(ids.length, 38);
  for (const i of ids) assert.deepEqual(actor.data.vertices[i].weight, [buffaloBone('Head'), buffaloBone('Head'), 1]);
  const contact = Math.min(...ids.map(i => distanceTo(actor, 'Head', new Vector3(...actor.data.vertices[i].position))));
  assert(contact < .008, `floating nose mirror: ${contact}`); assert(bounds(actor, 'NoseMirror').width > .40); return contact;
}
function eyes(actor: MountActor) {
  const report: Record<string, unknown> = {}, centers: Vector3[] = [];
  for (const side of ['Left', 'Right'] as const) {
    const part = `${side}Eye`, ids = idsFor(actor, part); assert.equal(ids.length, 6, `${part}: missing low-poly eye`);
    const box = bounds(actor, part), center = ids.reduce((sum, i) => sum.add(new Vector3(...actor.data.vertices[i].position)), new Vector3()).multiplyScalar(1 / ids.length);
    const height = box.max[1] - box.min[1], depth = box.max[2] - box.min[2];
    assert(box.width > .052 && box.width < .062, `${part}: eye width no longer readable (${box.width})`);
    assert(height > .048 && height < .058, `${part}: eye height no longer rounded (${height})`);
    assert(depth > .038 && depth < .048, `${part}: eye depth no longer readable (${depth})`);
    assert(center.y > 1.02 && center.y < 1.18, `${part}: eye drifted vertically on the long head`);
    assert(center.z > 1.22 && center.z < 1.36, `${part}: eye must stay forward-readable in three-quarter view`);
    assert(Math.abs(center.x) > .20 && Math.abs(center.x) < .31, `${part}: eye must remain on the side of the head`);
    for (const i of ids) assert.deepEqual(actor.data.vertices[i].weight, [buffaloBone('Head'), buffaloBone('Head'), 1]);
    centers.push(center); report[part] = { center: center.toArray(), width: box.width, height, depth };
  }
  const mirrored = centers[0].clone(); mirrored.x *= -1;
  assert(mirrored.distanceTo(centers[1]) < .001, 'asymmetric buffalo eyes');
  return report;
}
/** 水牛识别特征和真正会失败的反例；闭合性/姿态/地面仍走原有严格公共检查。 */
export function checkBuffaloAnatomy(actor: MountActor) {
  assert.notStrictEqual(BUFFALO_JOINTS, CATTLE_JOINTS);
  assert.notDeepEqual(BUFFALO_JOINTS.map(joint => joint.bindWorld), CATTLE_JOINTS.map(joint => joint.bindWorld), 'buffalo cannot reuse cattle binding');
  for (const file of ['geometry', 'rig', 'animation', 'saddles']) {
    const source = readFileSync(new URL(`../src/buffalo/${file}.ts`, import.meta.url), 'utf8');
    assert(!/from ['"]\.\.\/(cattle|yak|donkey|camel)\//.test(source), 'buffalo author module must not import another species author factory');
    assert(!/buildCattleMesh|CATTLE_JOINTS|CATTLE_SADDLE_PROFILE/.test(source), 'buffalo is not a recolored cattle factory');
  }
  const body = bounds(actor, 'Body'), head = bounds(actor, 'Head'), neck = bounds(actor, 'Neck');
  assert(body.width > 1.10 && body.width < 1.22 && body.min[1] > .40 && body.min[1] < .55 && body.max[1] < 1.31 && body.max[2] - body.min[2] > 1.95, 'water buffalo needs a long, low and broad body');
  assert(head.width > .53 && neck.width > .70 && head.max[1] < body.max[1] + .03 && head.max[2] - head.min[2] > .68, 'water buffalo needs a low elongated head and thick short neck');
  assert(bounds(actor, 'RightHorn').max[0] - bounds(actor, 'LeftHorn').min[0] > head.width * 2.8, 'horn spread must identify buffalo without coat color');
  for (const side of ['Left', 'Right']) {
    const ear = bounds(actor, `${side}Ear`); assert(ear.width > .33 && ear.max[1] - ear.min[1] < .22, 'buffalo ears must spread horizontally');
    for (const i of idsFor(actor, `${side}Ear`)) assert.deepEqual(actor.data.vertices[i].weight, [buffaloBone(`${side}Ear`), buffaloBone(`${side}Ear`), 1]);
  }
  for (const prefix of ['Front', 'Back']) for (const part of ['Upper', 'Middle', 'Lower', 'Foot']) {
    const left = actor.bones[buffaloBone(`${prefix}Left${part}`)].getWorldPosition(new Vector3()), right = actor.bones[buffaloBone(`${prefix}Right${part}`)].getWorldPosition(new Vector3()); left.x *= -1; assert(left.distanceTo(right) < 1e-8, 'asymmetric buffalo stance');
  }
  const hornReport = horns(actor), hoofGaps = hooves(actor), noseContact = noseMirror(actor), eyeReadability = eyes(actor), legs = legPlacement(actor); dewlap(actor);
  let faults = 0;
  const hornIds = idsFor(actor, 'LeftHorn'), horn = actor.data.vertices[hornIds[0]], savedWeight = [...horn.weight] as [number, number, number];
  horn.weight = [buffaloBone('Neck'), buffaloBone('Neck'), 1]; assert.throws(() => horns(actor)); horn.weight = savedWeight; faults++;
  const x = horn.position[0]; horn.position[0] += .04; assert.throws(() => horns(actor)); horn.position[0] = x; faults++;
  const faces = actor.data.triangles.filter(face => face.part === 'FrontLeftInnerHoof');
  faces.forEach(face => { face.part = 'FrontLeftSingleHoof'; }); assert.throws(() => hooves(actor)); faces.forEach(face => { face.part = 'FrontLeftInnerHoof'; }); faults++;
  const toe = actor.data.vertices[idsFor(actor, 'FrontLeftOuterHoof')[0]], toeWeight = [...toe.weight] as [number, number, number];
  toe.weight = [buffaloBone('FrontLeftLower'), buffaloBone('FrontLeftLower'), 1]; assert.throws(() => hooves(actor)); toe.weight = toeWeight; faults++;
  const d = actor.data.vertices[idsFor(actor, 'Dewlap')[0]], dw = [...d.weight] as [number, number, number]; d.weight = [buffaloBone('Head'), buffaloBone('Head'), 1]; assert.throws(() => dewlap(actor)); d.weight = dw; faults++;
  const nose = idsFor(actor, 'NoseMirror'), saved = nose.map(i => actor.data.vertices[i].position[2]);
  nose.forEach(i => { actor.data.vertices[i].position[2] += .10; }); assert.throws(() => noseMirror(actor)); nose.forEach((i, j) => { actor.data.vertices[i].position[2] = saved[j]; }); faults++;
  const eyeIds = idsFor(actor, 'LeftEye'), eyeSaved = eyeIds.map(i => [...actor.data.vertices[i].position] as [number, number, number]);
  const eyeCenter = eyeIds.reduce((sum, i) => sum.add(new Vector3(...actor.data.vertices[i].position)), new Vector3()).multiplyScalar(1 / eyeIds.length);
  eyeIds.forEach(i => { actor.data.vertices[i].position = new Vector3(...actor.data.vertices[i].position).sub(eyeCenter).multiplyScalar(.45).add(eyeCenter).toArray() as [number, number, number]; });
  assert.throws(() => eyes(actor)); eyeIds.forEach((i, j) => { actor.data.vertices[i].position = eyeSaved[j]; }); faults++;
  const frontFoot = actor.bones[buffaloBone('FrontLeftFoot')], frontZ = frontFoot.position.z;
  frontFoot.position.z += .08; actor.bones[0].updateMatrixWorld(true); assert.throws(() => legPlacement(actor)); frontFoot.position.z = frontZ; actor.bones[0].updateMatrixWorld(true); faults++;
  const backUpper = actor.bones[buffaloBone('BackLeftUpper')], backZ = backUpper.position.z;
  backUpper.position.z += .12; actor.bones[0].updateMatrixWorld(true); assert.throws(() => legPlacement(actor)); backUpper.position.z = backZ; actor.bones[0].updateMatrixWorld(true); faults++;
  // 左右一起拉直，仍保留镜像、角根和横展，确保曲率检查不是被对称检查偶然代替。
  const bothHorns = ['LeftHorn', 'RightHorn'].map(part => idsFor(actor, part));
  const savedHorns = bothHorns.map(ids => ids.map(i => [...actor.data.vertices[i].position] as [number, number, number]));
  try {
    for (const ids of bothHorns) {
      const centers = Array.from({ length: 6 }, (_, r) => ids.slice(r * 8, r * 8 + 8).reduce((sum, i) => sum.add(new Vector3(...actor.data.vertices[i].position)), new Vector3()).multiplyScalar(1 / 8));
      for (let r = 1; r < 5; r++) {
        const delta = centers[0].clone().lerp(centers[5], r / 5).sub(centers[r]);
        for (const i of ids.slice(r * 8, r * 8 + 8)) actor.data.vertices[i].position = new Vector3(...actor.data.vertices[i].position).add(delta).toArray() as [number, number, number];
      }
    }
    assert.throws(() => horns(actor), /straight cone/); faults++;
  } finally { bothHorns.forEach((ids, side) => ids.forEach((i, j) => { actor.data.vertices[i].position = savedHorns[side][j]; })); }
  // 保留两趾名称和Foot刚性绑定，仅把外趾移进内趾，真实分缝必须报错。
  const outerIds = idsFor(actor, 'FrontLeftOuterHoof'), outerX = outerIds.map(i => actor.data.vertices[i].position[0]);
  try { outerIds.forEach(i => { actor.data.vertices[i].position[0] += .014; }); assert.throws(() => hooves(actor), /no real split hoof/); faults++; }
  finally { outerIds.forEach((i, j) => { actor.data.vertices[i].position[0] = outerX[j]; }); }
  return { body, head, neck, horns: hornReport, splitHooves: 8, hoofGaps, noseContact, eyeReadability, legs, faults };
}
