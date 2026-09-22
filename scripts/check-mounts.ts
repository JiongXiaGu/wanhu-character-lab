import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Matrix4, Vector3 } from 'three';
import { B, BODY_TYPES, TOP_IDS, BOTTOM_IDS, createRecipe } from '../src/character/v3/types';
import { MOUNTS, mountDefinition } from '../src/mounts/catalog';
import { MOUNT_MOTIONS, type MountId } from '../src/mounts/types';
import { createMountPlayer } from '../src/mounts/player';
import { createRidingPlayer, type RidingPlayer } from '../src/riding/riding-player';
import { RIDING_CLIP_IDS, ridingDefinition } from '../src/riding/types';
import { checkCamel } from './mount-camel-checks';
import { checkCattle } from './mount-cattle-checks';
import { checkBuffalo } from './mount-buffalo-checks';
import { DONKEY_JOINTS } from '../src/donkey/rig';
import { near, skinnedPoints, validateMountMesh, validateReins, validateSaddleShells } from './mount-check-helpers';

const sourceSHA = process.env.REVIEW_HEAD_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = process.env.RIDING_CHECK_DIR || join(tmpdir(), 'wanhu-riding-checks'); mkdirSync(output, { recursive: true });
let bodyPoses = 0, ridingPoses = 0, wardrobeCases = 0, swaps = 0, faults = 0;
const report: Record<string, unknown> = { sourceSHA }, ground: Record<string, unknown> = {};
function ridingPose(player: RidingPlayer, collision: boolean) {
  near(player.status().horsePhase, player.status().riderPhase, 1e-9);
  const d = player.definition, inverse = player.seat.matrixWorld.clone().invert();
  assert(player.seat.parent === player.mount.bones.find(b => b.name === d.saddle.backBone), 'seat detached');
  const hips = player.rider.bones[B.Hips].getWorldPosition(new Vector3()).applyMatrix4(inverse); near(hips.distanceTo(new Vector3(0, d.riderFit[player.rider.data.recipe.bodyType].hipsLift, 0)), 0);
  for (const [k, f, s] of [[B.RightShin, B.RightFoot, 1], [B.LeftShin, B.LeftFoot, -1]]) {
    const knee = player.rider.bones[k].getWorldPosition(new Vector3()).applyMatrix4(inverse), foot = player.rider.bones[f].getWorldPosition(new Vector3()).applyMatrix4(inverse);
    assert(s * knee.x > .33 && s * knee.x < .55, `donkey knee clearance: ${knee.toArray()}`); assert(s * foot.x > .37 && s * foot.x < .62, `donkey foot clearance: ${foot.toArray()}`);
    assert(knee.y < hips.y - .15 && foot.y < knee.y - .25 && foot.y > hips.y - .9);
  }
  for (const bone of [...player.mount.bones, ...player.rider.bones]) assert(bone.matrixWorld.elements.every(Number.isFinite));
  const rider = player.rider, matrices = rider.bones.map((bone, i) => new Matrix4().multiplyMatrices(bone.matrixWorld, rider.skeleton.boneInverses[i]));
  for (const v of rider.data.surface.vertices) {
    const [a, b, w] = v.w, p = new Vector3(...v.p).applyMatrix4(matrices[a]).multiplyScalar(w).add(new Vector3(...v.p).applyMatrix4(matrices[b]).multiplyScalar(1 - w)); assert(p.toArray().every(Number.isFinite));
  }
  validateReins(player, collision);
}
try {
  assert.deepEqual(MOUNTS.map(d => d.id), ['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow', 'buffalo_water']); assert.throws(() => mountDefinition('camel' as MountId)); faults++;
  const d = mountDefinition('donkey_gray'), actor = d.createActor(); assert.equal(actor.bones.length, 27); assert.equal(DONKEY_JOINTS.at(-1)?.name, 'RightEar');
  report.mesh = { ...actor.stats, shells: validateMountMesh(actor), version: actor.data.version };
  const vertex = actor.data.vertices[0], weight = [...vertex.weight]; vertex.weight[2] = Number.NaN; assert.throws(() => validateMountMesh(actor)); vertex.weight = weight as [number, number, number]; faults++;
  const player = createMountPlayer(actor, d), geometryId = actor.mesh.geometry.uuid;
  for (const motion of MOUNT_MOTIONS) {
    console.log('Checking donkey body', motion); player.select(motion); const clip = player.clips.get(motion)!;
    assert.equal(clip.name, d.motions[motion].nativeId); assert.equal(clip.tracks.length, 27); near(clip.duration, d.motions[motion].duration);
    for (const t of clip.tracks) { near(t.times[0], 0); near(t.times.at(-1)!, clip.duration); for (let i = 1; i < t.times.length; i++) assert(t.times[i] > t.times[i - 1]); assert(Array.from(t.values).every(Number.isFinite)); if (t.name.endsWith('quaternion')) for (let i = 0; i < t.values.length; i += 4) near(Math.hypot(...Array.from(t.values.slice(i, i + 4))), 1, 1e-5); }
    let hoof = Infinity, head = Infinity, first: number[][] | undefined;
    const hoofIds = new Set(actor.data.triangles.filter(f => f.part.endsWith('Hoof')).flatMap(f => f.indices)), headIds = new Set(actor.data.triangles.filter(f => f.part === 'Head').flatMap(f => f.indices));
    for (let i = 0; i <= 240; i++) {
      player.seek(i / 240); const points = skinnedPoints(actor); assert(points.every(p => p.toArray().every(Number.isFinite)));
      for (const vi of hoofIds) hoof = Math.min(hoof, points[vi].y); for (const vi of headIds) head = Math.min(head, points[vi].y);
      if (!i) first = points.map(p => p.toArray()); if (i === 240) points.forEach((p, j) => p.toArray().forEach((v, a) => near(v, first![j][a], 2e-6))); bodyPoses++;
    }
    console.log('Donkey ground', motion, { hoof, head }); ground[motion] = { hoof, head };
    assert(hoof >= -.012, `${motion}: hoof below ground ${hoof}`); assert(head >= 0, `${motion}: head through ground ${head}`);
    if (motion === 'eat') assert(head >= .01 && head <= .12, `Eat lowest head must be .01–.12m: ${head}`);
    player.setLoop(false); player.seek(.99); player.update(2); assert(player.status().finished); near(player.status().phase, 1); player.replay(); near(player.status().phase, 0);
    player.setLoop(true); player.seek(.99); player.update(d.motions[motion].duration * .03); near(player.status().phase, .02); assert.equal(actor.mesh.geometry.uuid, geometryId);
  }
  player.dispose(); actor.dispose();
  for (const gender of BODY_TYPES) {
    const recipe = createRecipe({ bodyType: gender }), original = JSON.stringify(recipe), riding = createRidingPlayer(recipe, 'simple', 'donkey_gray');
    assert.equal(riding.rider.bones.length, 20); assert.equal(riding.mount.bones.length, 27);
    const ids = { animal: riding.mount.mesh.geometry.uuid, rider: riding.rider.mesh.geometry.uuid, rein: riding.reins.mesh.geometry.uuid }, inverses = riding.rider.skeleton.boneInverses.map(m => [...m.elements]);
    for (const saddle of ['simple', 'travel'] as const) {
      riding.setSaddle(saddle); assert.deepEqual(riding.seat.position.toArray(), d.saddle.seat(saddle)); for (const mesh of riding.tack.meshes) validateSaddleShells(mesh.geometry);
      riding.select('pose'); ridingPose(riding, true);
      for (const motion of RIDING_CLIP_IDS) {
        console.log('Checking donkey rider', gender, saddle, motion); riding.select(motion); const before = riding.rider.bones.map(b => [...b.matrixWorld.elements]);
        for (let i = 0; i <= 240; i++) { riding.seek(i / 240); ridingPose(riding, true); ridingPoses++; }
        riding.rider.bones.forEach((b, i) => b.matrixWorld.elements.forEach((n, j) => near(n, before[i][j], 2e-6)));
        near(riding.status().duration, ridingDefinition(motion, 'donkey_gray').duration);
      }
    }
    assert.deepEqual({ animal: riding.mount.mesh.geometry.uuid, rider: riding.rider.mesh.geometry.uuid, rein: riding.reins.mesh.geometry.uuid }, ids);
    riding.seek(.375); riding.setLoop(false); const oldStatus = riding.status(); riding.setSaddle('none'); riding.update(5); riding.seek(.8); assert.deepEqual(riding.status(), oldStatus); assert(!riding.rider.mesh.visible && !riding.reins.mesh.visible);
    // 在无鞍冻结期间也能换种类，不丢失进度、外观，不强制装回鞍。
    for (let i = 0; i < 10; i++) {
      const previous = riding.mount, rein = riding.reins.mesh.geometry; let released = 0, reinReleased = 0;
      previous.mesh.geometry.addEventListener('dispose', () => released++); rein.addEventListener('dispose', () => reinReleased++);
      riding.setMount(i % 2 ? 'donkey_gray' : 'horse_chestnut'); swaps++;
      assert.equal(released, 1); assert.equal(reinReleased, 1); assert.equal(riding.rider.mesh.geometry.uuid, ids.rider); near(riding.status().phase, .375); assert.equal(riding.tack.id, 'none'); assert(!riding.canRide);
      assert.deepEqual(riding.rider.skeleton.boneInverses.map(m => [...m.elements]), inverses); assert.equal(JSON.stringify(riding.rider.data.recipe), original);
      let grips = 0; riding.rider.mesh.traverse(o => { if (/^(Left|Right)ReinGrip$/.test(o.name)) grips++; }); assert.equal(grips, 2);
    }
    riding.setSaddle('travel'); ridingPose(riding, true);
    const currentMount = riding.mount; assert.throws(() => riding.setMount('unknown' as MountId)); assert(riding.mount === currentMount); faults++;
    riding.mount.mesh.position.set(2, .5, -1); riding.mount.mesh.rotation.set(.04, .8, -.06); riding.mount.mesh.scale.setScalar(1.15); riding.update(0); ridingPose(riding, false);
    riding.reins.points[0][0].x += .1; assert.throws(() => validateReins(riding, false)); riding.update(0); faults++;
    riding.mount.mesh.position.set(0, 0, 0); riding.mount.mesh.rotation.set(0, 0, 0); riding.mount.mesh.scale.setScalar(1); riding.update(0);
    for (const top of TOP_IDS.filter(id => id !== 'body')) for (const bottom of BOTTOM_IDS.filter(id => id !== 'body')) {
      riding.setRecipe(createRecipe({ bodyType: gender, slots: { top, bottom } })); wardrobeCases++; riding.select('pose'); ridingPose(riding, false);
      for (const clip of RIDING_CLIP_IDS) { riding.select(clip); for (const p of [0, .25, .5, .75, 1]) { riding.seek(p); ridingPose(riding, false); } }
    }
    let released = 0; riding.rider.mesh.geometry.addEventListener('dispose', () => released++); riding.dispose(); riding.dispose(); assert.equal(released, 1);
  }
  assert.equal(bodyPoses, 964); assert.equal(ridingPoses, 2892); assert.equal(wardrobeCases, 70);
  report.camel = checkCamel();
  report.cattle = checkCattle();
  report.buffalo = checkBuffalo();
  Object.assign(report, { result: 'passed', ground, bodyPoses, ridingPoses, wardrobeCases, swaps, faults, boundary: 'Closed shells, bind/skin, ground, sparse body/rein intersections and lifecycle; no visual or full garment-contact approval.' });
  writeFileSync(join(output, 'mounts-checks.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  writeFileSync(join(output, 'mounts-checks.json'), JSON.stringify({ ...report, result: 'failed', bodyPoses, ridingPoses, wardrobeCases, ground, error: String(error instanceof Error ? error.stack : error) }, null, 2)); throw error;
}
