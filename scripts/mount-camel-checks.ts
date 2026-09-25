import assert from 'node:assert/strict';
import { Matrix4, Triangle, Vector3 } from 'three';
import { B, BODY_TYPES, TOP_IDS, BOTTOM_IDS, createRecipe } from '../src/character/v3/types';
import { mountDefinition, initialMountMotion } from '../src/mounts/catalog';
import { createMountPlayer } from '../src/mounts/player';
import { MOUNT_MOTIONS, type MountActor, type MountId } from '../src/mounts/types';
import { CAMEL_JOINTS, camelBone } from '../src/camel/rig';
import { createRidingPlayer, type RidingPlayer } from '../src/riding/riding-player';
import { RIDING_CLIP_IDS } from '../src/riding/types';
import { near, skinnedPoints, validateMountMesh, validateReins, validateSaddleShells } from './mount-check-helpers';
import { CAMEL_SCULPT_STATS, checkCamelTorso } from './mount-camel-torso-checks';

/** 有向脚轨迹面积：低位向后、高位向前才为正；只检查摆腿角度会漏掉倒放。 */
function forwardFootLoop(points: Vector3[]): number {
  let area = 0;
  for (let i = 1; i < points.length; i++) area += (points[i - 1].y + points[i].y) * .5 * (points[i].z - points[i - 1].z);
  assert(area > .003, `foot cycle is reversed or degenerate: ${area}`);
  return area;
}
function facialContact(actor: MountActor, part: string): number {
  const ids = new Set(actor.data.triangles.filter(face => face.part === part).flatMap(face => face.indices));
  assert.equal(ids.size, 6, `${part}: missing low-poly detail`);
  const center = new Vector3();
  for (const i of ids) {
    const vertex = actor.data.vertices[i]; assert.deepEqual(vertex.weight, [camelBone('Head'), camelBone('Head'), 1]); center.add(new Vector3(...vertex.position));
  }
  center.multiplyScalar(1 / ids.size);
  const triangle = new Triangle(), point = new Vector3(); let distance = Infinity;
  for (const face of actor.data.triangles.filter(face => face.part === 'Head')) {
    triangle.set(...face.indices.map(i => new Vector3(...actor.data.vertices[i].position)) as [Vector3, Vector3, Vector3]);
    triangle.closestPointToPoint(center, point); distance = Math.min(distance, center.distanceTo(point));
  }
  assert(distance < .006, `${part}: floating detail (${distance})`); return distance;
}
function checkRider(player: RidingPlayer, intersections: boolean) {
  near(player.status().horsePhase, player.status().riderPhase, 1e-9);
  assert.equal(player.mount.bones.length, 29); assert.equal(player.rider.bones.length, 20);
  const inverse = player.seat.matrixWorld.clone().invert(), hips = player.rider.bones[B.Hips].getWorldPosition(new Vector3()).applyMatrix4(inverse);
  assert(player.seat.parent === player.mount.bones[camelBone('Spine')]);
  near(hips.distanceTo(new Vector3(0, player.definition.riderFit[player.rider.data.recipe.bodyType].hipsLift, 0)), 0);
  for (const [k, f, sign] of [[B.RightShin, B.RightFoot, 1], [B.LeftShin, B.LeftFoot, -1]]) {
    const knee = player.rider.bones[k].getWorldPosition(new Vector3()).applyMatrix4(inverse), foot = player.rider.bones[f].getWorldPosition(new Vector3()).applyMatrix4(inverse);
    assert(sign * knee.x > .33 && sign * knee.x < .55); assert(sign * foot.x > .37 && sign * foot.x < .62);
    assert(knee.y < hips.y - .15 && foot.y < knee.y - .25 && foot.y > hips.y - .9);
  }
  for (const actor of [player.mount, player.rider]) for (const bone of actor.bones) assert(bone.matrixWorld.elements.every(Number.isFinite));
  const rider = player.rider, matrices = rider.bones.map((bone, i) => new Matrix4().multiplyMatrices(bone.matrixWorld, rider.skeleton.boneInverses[i]));
  for (const vertex of rider.data.surface.vertices) {
    const [a, b, w] = vertex.w, p = new Vector3(...vertex.p).applyMatrix4(matrices[a]).multiplyScalar(w).add(new Vector3(...vertex.p).applyMatrix4(matrices[b]).multiplyScalar(1 - w));
    assert(p.toArray().every(Number.isFinite));
  }
  validateReins(player, intersections); // Body连续表面已包含两峰，不豁免前峰与持缰曲线。
}
/** 并入check:mounts，旧灰驴矩阵保留，不能以新物种检查替换老回归。 */
export function checkCamel() {
  const d = mountDefinition('camel_bactrian'), actor = d.createActor(), player = createMountPlayer(actor, d);
  let bodyPoses = 0, ridingPoses = 0, wardrobeCases = 0, swaps = 0, faults = 0;
  const ground: Record<string, unknown> = {}, gait: Record<string, unknown> = {};
  assert.deepEqual(actor.stats, CAMEL_SCULPT_STATS);
  assert.equal(validateMountMesh(actor), 29); assert.equal(CAMEL_JOINTS.length, 29);
  CAMEL_JOINTS.forEach((joint, i) => assert(joint.parent < i && (i === 0 ? joint.parent === -1 : joint.parent >= 0)));
  const torso = checkCamelTorso(actor);
  // 缺面/重新拆成独立峰两种故障均必须被连续网格检查拒绝。
  const firstFace = actor.data.triangles[0], oldPart = firstFace.part;
  firstFace.part = 'FrontHump'; assert.throws(() => checkCamelTorso(actor)); firstFace.part = oldPart;
  const lastFace = actor.data.triangles.pop()!;
  const bodyFace = actor.data.triangles.shift()!;
  assert.throws(() => checkCamelTorso(actor)); actor.data.triangles.unshift(bodyFace); actor.data.triangles.push(lastFace);
  const facial = Object.fromEntries(['LeftNostril', 'RightNostril', 'LeftEye', 'RightEye'].map(name => [name, facialContact(actor, name)]));
  const nostrilIds = new Set(actor.data.triangles.filter(face => face.part === 'LeftNostril').flatMap(face => face.indices));
  for (const i of nostrilIds) actor.data.vertices[i].position[2] += .08;
  assert.throws(() => facialContact(actor, 'LeftNostril')); faults++;
  for (const i of nostrilIds) actor.data.vertices[i].position[2] -= .08;
  const weight = actor.data.vertices[0].weight[2]; actor.data.vertices[0].weight[2] = Number.NaN;
  assert.throws(() => validateMountMesh(actor)); actor.data.vertices[0].weight[2] = weight; faults++;
  const feet = new Set(actor.data.triangles.filter(face => face.part.endsWith('Pad') || face.part.endsWith('Toe')).flatMap(face => face.indices));
  const heads = new Set(actor.data.triangles.filter(face => face.part === 'Head').flatMap(face => face.indices));
  const geometry = actor.mesh.geometry.uuid, inverses = actor.skeleton.boneInverses.map(m => [...m.elements]);
  for (const motion of MOUNT_MOTIONS) {
    console.log('Checking camel body', motion); player.select(motion); const clip = player.clips.get(motion)!;
    assert.equal(initialMountMotion(clip.name), motion); assert.equal(clip.name, d.motions[motion].nativeId); near(clip.duration, d.motions[motion].duration);
    assert.equal(clip.tracks.length, 29); assert(!clip.tracks.some(track => track.name.startsWith('Root.') || track.name.endsWith('.scale')));
    for (const track of clip.tracks) {
      near(track.times[0], 0); near(track.times.at(-1)!, clip.duration); assert(Array.from(track.values).every(Number.isFinite));
      for (let i = 1; i < track.times.length; i++) assert(track.times[i] > track.times[i - 1]);
      if (track.name.endsWith('.quaternion')) for (let i = 0; i < track.values.length; i += 4) near(Math.hypot(...Array.from(track.values.slice(i, i + 4))), 1, 1e-5);
    }
    let foot = Infinity, head = Infinity, first: Vector3[] = [];
    const trajectories = ['FrontLeft', 'FrontRight', 'BackLeft', 'BackRight'].map(leg => ({ leg, bone: actor.bones[camelBone(`${leg}Foot`)], points: [] as Vector3[] }));
    for (let i = 0; i <= 240; i++) {
      player.seek(i / 240); const points = skinnedPoints(actor); assert(points.every(p => p.toArray().every(Number.isFinite)));
      for (const j of feet) foot = Math.min(foot, points[j].y); for (const j of heads) head = Math.min(head, points[j].y);
      near(actor.bones[1].position.x, 0); near(actor.bones[1].position.z, CAMEL_JOINTS[1].bindWorld[2]);
      if (!i) first = points; if (i === 240) points.forEach((p, j) => near(p.distanceTo(first[j]), 0, 2e-6));
      trajectories.forEach(t => t.points.push(t.bone.getWorldPosition(new Vector3()))); bodyPoses++;
    }
    assert(foot >= -.012, `${motion}: pad through ground ${foot}`); assert(head >= 0, `${motion}: head through ground ${head}`);
    if (motion === 'eat') assert(head >= .01 && head <= .12, `camel Eat head outside .01–.12m: ${head}`);
    ground[motion] = { foot, head };
    if (motion === 'walk' || motion === 'run') {
      gait[motion] = Object.fromEntries(trajectories.map(t => {
        const area = forwardFootLoop(t.points); assert.throws(() => forwardFootLoop([...t.points].reverse())); faults++; return [t.leg, area];
      }));
    }
    player.setLoop(false); player.seek(.99); player.update(2); assert(player.status().finished); near(player.status().phase, 1);
    player.replay(); near(player.status().phase, 0); player.setLoop(true); player.seek(.99); player.update(d.motions[motion].duration * .03); near(player.status().phase, .02);
    assert.equal(actor.mesh.geometry.uuid, geometry); assert.deepEqual(actor.skeleton.boneInverses.map(m => [...m.elements]), inverses);
  }
  player.dispose(); actor.dispose();
  for (const gender of BODY_TYPES) {
    const riding = createRidingPlayer(createRecipe({ bodyType: gender }), 'simple', 'camel_bactrian');
    const original = JSON.stringify(riding.rider.data.recipe), riderId = riding.rider.mesh.geometry.uuid, animalId = riding.mount.mesh.geometry.uuid, reinId = riding.reins.mesh.geometry.uuid;
    const binds = riding.rider.skeleton.boneInverses.map(m => [...m.elements]);
    for (const saddle of ['simple', 'travel'] as const) {
      riding.setSaddle(saddle); for (const mesh of riding.tack.meshes) validateSaddleShells(mesh.geometry);
      const seat = riding.seat.getWorldPosition(new Vector3()); assert(seat.z > -.30 && seat.z < .30 && seat.y > 1.98 && seat.y < 2.10, 'seat must remain in the hump valley');
      riding.select('pose'); checkRider(riding, true);
      for (const clip of RIDING_CLIP_IDS) {
        console.log('Checking camel rider', gender, saddle, clip); riding.select(clip); const first = riding.rider.bones.map(b => [...b.matrixWorld.elements]);
        for (let i = 0; i <= 240; i++) { riding.seek(i / 240); checkRider(riding, true); ridingPoses++; }
        riding.rider.bones.forEach((b, i) => b.matrixWorld.elements.forEach((value, j) => near(value, first[i][j], 2e-6)));
      }
    }
    assert.equal(riding.rider.mesh.geometry.uuid, riderId); assert.equal(riding.mount.mesh.geometry.uuid, animalId); assert.equal(riding.reins.mesh.geometry.uuid, reinId);
    riding.select('Rider_Walk'); riding.seek(.375); riding.setLoop(false);
    for (const saddle of ['none', 'travel'] as const) {
      riding.setSaddle(saddle);
      const before = riding.status(); if (saddle === 'none') { riding.update(5); riding.seek(.8); assert.deepEqual(riding.status(), before); }
      for (const id of ['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'horse_chestnut', 'donkey_gray', 'camel_bactrian'] as const) {
        const old = riding.mount.mesh.geometry, oldRein = riding.reins.mesh.geometry; let released = 0, reinReleased = 0;
        old.addEventListener('dispose', () => released++); oldRein.addEventListener('dispose', () => reinReleased++);
        riding.setMount(id); swaps++; assert.equal(released, 1); assert.equal(reinReleased, 1); assert.equal(riding.rider.mesh.geometry.uuid, riderId);
        assert.deepEqual(riding.rider.skeleton.boneInverses.map(m => [...m.elements]), binds); assert.equal(JSON.stringify(riding.rider.data.recipe), original);
        near(riding.status().phase, .375); assert.equal(riding.status().loop, false); assert.equal(riding.tack.id, saddle);
        assert.equal(riding.rider.mesh.visible, saddle !== 'none'); assert.equal(riding.reins.mesh.visible, saddle !== 'none');
        if (saddle !== 'none') validateReins(riding, true);
        let grips = 0; riding.rider.mesh.traverse(o => { if (/^(Left|Right)ReinGrip$/.test(o.name)) grips++; }); assert.equal(grips, 2);
      }
    }
    const mount = riding.mount; assert.throws(() => riding.setMount('missing_camel' as MountId)); assert(riding.mount === mount); faults++;
    riding.mount.mesh.position.set(2, .5, -1); riding.mount.mesh.rotation.set(.04, .8, -.06); riding.mount.mesh.scale.setScalar(1.15); riding.update(0); checkRider(riding, false);
    riding.reins.points[0][0].x += .1; assert.throws(() => validateReins(riding, false)); faults++; riding.update(0);
    riding.mount.mesh.position.set(0, 0, 0); riding.mount.mesh.rotation.set(0, 0, 0); riding.mount.mesh.scale.setScalar(1); riding.update(0);
    for (const top of TOP_IDS.filter(id => id !== 'body')) for (const bottom of BOTTOM_IDS.filter(id => id !== 'body')) {
      riding.setRecipe(createRecipe({ bodyType: gender, slots: { top, bottom } })); wardrobeCases++; riding.select('pose'); checkRider(riding, false);
      for (const clip of RIDING_CLIP_IDS) { riding.select(clip); for (const phase of [0, .25, .5, .75, 1]) { riding.seek(phase); checkRider(riding, false); } }
    }
    let released = 0; riding.rider.mesh.geometry.addEventListener('dispose', () => released++); riding.dispose(); riding.dispose(); assert.equal(released, 1);
  }
  assert.equal(bodyPoses, 964); assert.equal(ridingPoses, 2892);
  // 完整现役衣柜笛卡尔积，保留旧服饰及新增军装的全部姿态采样。
  assert.equal(wardrobeCases, BODY_TYPES.length * TOP_IDS.filter(id => id !== 'body').length * BOTTOM_IDS.filter(id => id !== 'body').length); assert.equal(swaps, 24);
  return { result: 'passed', mesh: { ...CAMEL_SCULPT_STATS, shells: 29 }, torso, torsoFaults: 2, ground, gait, facial, bodyPoses, ridingPoses, wardrobeCases, swaps, faults,
    boundary: 'Authored in-place gait; sparse rein intersections include the continuous hump/body surface. Not full garment/saddle/contact or visual approval.' };
}
