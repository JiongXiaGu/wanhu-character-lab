import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Matrix4, Vector3 } from 'three';
import { B, BODY_TYPES, TOP_IDS, BOTTOM_IDS, createRecipe } from '../src/character/v3/types';
import { createRidingPlayer, type RidingPlayer } from '../src/riding/riding-player';
import { RIDER_FIT, RIDER_SEAT_OFFSET } from '../src/riding/rider-seat';
import { RIDING_CLIP_IDS, RIDING_VERSION, ridingDefinition, type RidingPlayback } from '../src/riding/types';
import { RIDER_POSE_VERSION } from '../src/riding/rider-pose';

const near = (a: number, b: number, epsilon = 1e-6) => assert(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
let poses = 0, vertexSamples = 0, wardrobeCases = 0;
// 与下方完整现役衣柜循环一致；不因军装新增而保留旧阶段固定的35/70组。
const wardrobeCasesPerBody = TOP_IDS.filter(id => id !== 'body').length * BOTTOM_IDS.filter(id => id !== 'body').length;
const extremes = { minimumKneeX: Infinity, minimumFootX: Infinity, maximumSeatError: 0 };
function checkSync(status: RidingPlayback) { near(status.horsePhase, status.riderPhase, 1e-9); near(status.phase, status.horsePhase, 1e-9); }
function checkPose(player: RidingPlayer, vertices = true) {
  assert.equal(player.horse.bones.length, 25); assert.equal(player.rider.bones.length, 20);
  // 只断言身份条件，故障注入失败时不让assert格式化整棵带循环引用的Three.js场景。
  assert(player.seat.parent === player.horse.bones[2], 'RiderSeat must follow horse Spine');
  assert(player.rider.mesh.parent === player.riderRoot, 'rider must be attached to RiderRoot');
  checkSync(player.status());
  const bones = [...player.horse.bones, ...player.rider.bones];
  for (const bone of [...bones, player.seat, player.riderRoot]) assert(bone.matrixWorld.elements.every(Number.isFinite), `non-finite ${bone.name}`);
  for (const skeleton of [player.horse.skeleton, player.rider.skeleton]) assert(Array.from(skeleton.boneMatrices).every(Number.isFinite));
  const inverseSeat = player.seat.matrixWorld.clone().invert();
  const inSeat = (index: number) => player.rider.bones[index].getWorldPosition(new Vector3()).applyMatrix4(inverseSeat);
  const hips = inSeat(B.Hips), lift = RIDER_FIT[player.rider.data.recipe.bodyType].hipsLift;
  const error = hips.distanceTo(new Vector3(0, lift, 0));
  assert(error < 1e-6, `pelvis drift: ${error}`);
  // 只把通过门槛的正常数据写入统计，不将故意注入的0.2m漂移混为运行结果。
  extremes.maximumSeatError = Math.max(extremes.maximumSeatError, error);
  for (const [kneeIndex, footIndex, sign] of [[B.RightShin, B.RightFoot, 1], [B.LeftShin, B.LeftFoot, -1]]) {
    const knee = inSeat(kneeIndex), foot = inSeat(footIndex);
    // 骨性标记的粗边界，不把它冒充逐三角服饰碰撞证明。
    assert(sign * knee.x > .37 && sign * knee.x < .55, `knee does not straddle: ${knee.toArray()}`);
    assert(sign * foot.x > .40 && sign * foot.x < .60, `foot crosses barrel: ${foot.toArray()}`);
    assert(knee.y < hips.y - .15 && knee.y > hips.y - .40, 'knee height');
    assert(foot.y < knee.y - .25 && foot.y > hips.y - .9, 'foot height');
    extremes.minimumKneeX = Math.min(extremes.minimumKneeX, sign * knee.x);
    extremes.minimumFootX = Math.min(extremes.minimumFootX, sign * foot.x);
  }
  if (vertices) {
    const actor = player.rider, matrices = actor.bones.map((bone, index) => new Matrix4().multiplyMatrices(bone.matrixWorld, actor.skeleton.boneInverses[index]));
    const a = new Vector3(), b = new Vector3();
    for (const vertex of actor.data.surface.vertices) {
      const [first, second, weight] = vertex.w;
      a.fromArray(vertex.p).applyMatrix4(matrices[first]).multiplyScalar(weight);
      b.fromArray(vertex.p).applyMatrix4(matrices[second]).multiplyScalar(1 - weight); a.add(b);
      assert(Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z), `non-finite skinned vertex ${vertex.id}`); vertexSamples++;
    }
    // 同时核对真正SkinnedMesh路径，捕捉父变换重复应用/重新bind一类错误。
    const positions = actor.mesh.geometry.getAttribute('position'), indices = actor.mesh.geometry.getAttribute('skinIndex'), weights = actor.mesh.geometry.getAttribute('skinWeight');
    for (const index of [0, Math.floor(positions.count / 2), positions.count - 1]) {
      const bind = new Vector3().fromBufferAttribute(positions, index);
      const expected = bind.clone().applyMatrix4(matrices[indices.getX(index)]).multiplyScalar(weights.getX(index));
      expected.add(bind.clone().applyMatrix4(matrices[indices.getY(index)]).multiplyScalar(weights.getY(index)));
      const actual = actor.mesh.localToWorld(actor.mesh.applyBoneTransform(index, bind.clone()));
      assert(actual.distanceTo(expected) < 1e-5, 'SkinnedMesh bind or parent transform applied twice');
    }
  }
  poses++;
}
for (const bodyType of BODY_TYPES) {
  console.log(`Riding dense sampling: ${bodyType}`);
  const recipe = createRecipe({ bodyType }), original = JSON.stringify(recipe), player = createRidingPlayer(recipe);
  const horseId = player.horse.mesh.geometry.uuid, riderId = player.rider.mesh.geometry.uuid;
  const inverses = player.rider.skeleton.boneInverses.map(matrix => [...matrix.elements]);
  checkPose(player); near(player.status().duration, 0);
  assert.deepEqual(player.seat.position.toArray(), [...RIDER_SEAT_OFFSET]);
  for (const [id, clip] of player.riderClips) {
    assert.equal(clip.tracks.length, 20);
    near(clip.duration, id === 'pose' ? 1 : ridingDefinition(id).duration);
    for (const track of clip.tracks) {
      assert(track.name.endsWith('.quaternion'), 'rider must not duplicate mount translation');
      assert(track.times.length >= 2); near(track.times[0], 0); near(track.times.at(-1)!, clip.duration);
      for (let i = 1; i < track.times.length; i++) assert(track.times[i] > track.times[i - 1]);
      for (let i = 0; i < track.values.length; i += 4) near(Math.hypot(...Array.from(track.values.slice(i, i + 4))), 1, 1e-5);
    }
  }
  for (const id of RIDING_CLIP_IDS) {
    player.select(id); player.seek(0);
    const first = player.rider.bones.map(bone => bone.matrixWorld.clone());
    let changed = false;
    for (let frame = 0; frame <= 240; frame++) {
      player.seek(frame / 240); checkPose(player);
      if (frame > 0 && frame < 240 && player.rider.bones[B.Spine].matrixWorld.elements.some((value, i) => Math.abs(value - first[B.Spine].elements[i]) > 1e-4)) changed = true;
    }
    assert(changed, `${id} is a frozen statue`);
    player.rider.bones.forEach((bone, i) => bone.matrixWorld.elements.forEach((value, axis) => near(value, first[i].elements[axis], 2e-6)));
    player.setLoop(false); player.seek(.99); player.update(2); near(player.status().phase, 1); assert(player.status().finished); checkSync(player.status());
    player.update(2); near(player.status().phase, 1);
    player.replay(); near(player.status().phase, 0); assert(!player.status().finished);
    player.setLoop(true); player.seek(.99); player.update(ridingDefinition(id).duration * .03); near(player.status().phase, .02); checkSync(player.status());
    player.seek(.4); player.step(1); near(player.status().time, .4 * ridingDefinition(id).duration + 1 / 30); player.step(-1); near(player.status().phase, .4);
    console.log(`PASS ${bodyType} ${id}: 241 poses, seam and playback contract`);
  }
  assert.equal(player.horse.mesh.geometry.uuid, horseId); assert.equal(player.rider.mesh.geometry.uuid, riderId);
  assert.deepEqual(player.rider.skeleton.boneInverses.map(matrix => [...matrix.elements]), inverses);
  player.seek(Number.NaN); near(player.status().phase, 0); player.update(Number.NaN); player.update(-3); checkPose(player);
  player.horse.mesh.position.set(2.1, .7, -1.3); player.horse.mesh.rotation.y = .8; player.horse.mesh.scale.setScalar(1.17); player.update(0); checkPose(player);
  player.horse.mesh.position.set(0, 0, 0); player.horse.mesh.rotation.set(0, 0, 0); player.horse.mesh.scale.setScalar(1); player.update(0);
  player.seek(.375); player.setLoop(false);
  assert(player.setRecipe(createRecipe({ bodyType: bodyType === 'male' ? 'female' : 'male', slots: { top: 'work_vest', bottom: 'short_trousers' } })));
  near(player.status().phase, .375); assert(!player.status().loop); assert.equal(player.horse.mesh.geometry.uuid, horseId); assert.notEqual(player.rider.mesh.geometry.uuid, riderId); checkPose(player);
  assert.equal(JSON.stringify(recipe), original);
  assert.throws(() => checkSync({ ...player.status(), riderPhase: player.status().phase + .1 }));
  player.seat.removeFromParent(); assert.throws(() => checkPose(player, false), /RiderSeat must follow horse Spine/); player.horse.bones[2].add(player.seat); player.update(0);
  player.riderRoot.position.y += .2; player.update(0); assert.throws(() => checkPose(player, false), /pelvis drift/); player.riderRoot.position.y -= .2; player.update(0);
  player.rider.bones[B.Head].matrixWorld.elements[0] = Number.NaN; assert.throws(() => checkPose(player, false), /non-finite/); player.update(0); checkPose(player);
  let horseDisposed = 0, riderDisposed = 0;
  player.horse.mesh.geometry.addEventListener('dispose', () => horseDisposed++); player.rider.mesh.geometry.addEventListener('dispose', () => riderDisposed++);
  player.dispose(); player.dispose(); assert.equal(horseDisposed, 1); assert.equal(riderDisposed, 1);
  console.log(`PASS ${bodyType}: instance transform, recipe replacement, 4 fault injections and disposal`);
}
for (const bodyType of BODY_TYPES) {
  const player = createRidingPlayer(createRecipe({ bodyType }));
  for (const top of TOP_IDS.filter(id => id !== 'body')) for (const bottom of BOTTOM_IDS.filter(id => id !== 'body')) {
    player.setRecipe(createRecipe({ bodyType, slots: { top, bottom } })); wardrobeCases++;
    player.select('pose'); checkPose(player);
    for (const clip of RIDING_CLIP_IDS) {
      player.select(clip);
      for (const phase of [0, .25, .5, .75, 1]) { player.seek(phase); checkPose(player); }
    }
  }
  player.dispose(); console.log(`PASS ${bodyType}: ${wardrobeCasesPerBody} wardrobe constructions and sampled poses (not intersection approval)`);
}
assert.equal(wardrobeCases, BODY_TYPES.length * wardrobeCasesPerBody, 'all current bodies x active tops x active bottoms');
const sourceSHA = process.env.REVIEW_HEAD_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const report = { result: 'passed', sourceSHA, version: RIDING_VERSION, poseVersion: RIDER_POSE_VERSION, denseAnimationPoses: 1446,
  totalPoseChecks: poses, vertexSamples, wardrobeCases, faultInjections: 8, ...extremes,
  boundary: 'Landmark, matrix, skinning, time and construction checks. Not a triangle-intersection or visual approval.' };
const output = process.env.RIDING_CHECK_DIR || join(tmpdir(), 'wanhu-riding-checks'); mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'checks.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
