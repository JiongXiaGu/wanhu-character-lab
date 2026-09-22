import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Matrix4, Ray, Vector3, type BufferGeometry } from 'three';
import { B, BODY_TYPES, createRecipe } from '../src/character/v3/types';
import { createHorseActor } from '../src/horse/skinning';
import { createHorsePlayer } from '../src/horse/player';
import { HORSE_CLIP_IDS } from '../src/horse/types';
import { createSaddleActor } from '../src/horse/saddles/saddle-actor';
import { SADDLES, SADDLE_VERSION, saddleDefinition, type SaddleId } from '../src/horse/saddles/catalog';
import { createRidingPlayer, type RidingPlayer } from '../src/riding/riding-player';
import { RIDING_CLIP_IDS } from '../src/riding/types';
import { REIN_SEGMENTS } from '../src/riding/reins';

const near = (a: number, b: number, epsilon = 1e-6) => assert(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const output = process.env.RIDING_CHECK_DIR || join(tmpdir(), 'wanhu-riding-checks'); mkdirSync(output, { recursive: true });
const sourceSHA = process.env.REVIEW_HEAD_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
let poses = 0, headNeckSegments = 0, horseOnlyPoses = 0, faultInjections = 0, maximumEndpointError = 0;
const budgets: Record<string, number> = {};
function closedShell(geometry: BufferGeometry, start: number, count: number) {
  const p = geometry.getAttribute('position'), edges = new Map<string, { count: number; orientation: number }>(), v = new Map<string, number>();
  const ids: number[] = [], points: Vector3[] = [];
  for (let i = start; i < start + count; i++) {
    const point = new Vector3().fromBufferAttribute(p, i); assert(point.toArray().every(Number.isFinite));
    const key = point.toArray().map(value => Math.round(value * 1e6)).join(',');
    if (!v.has(key)) { v.set(key, v.size); points.push(point); } ids.push(v.get(key)!);
  }
  let volume = 0;
  for (let i = 0; i < count; i += 3) {
    const tri = ids.slice(i, i + 3), [a, b, c] = tri.map(index => points[index]);
    assert(new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).length() > 1e-10, 'degenerate saddle face');
    volume += a.dot(b.clone().cross(c)) / 6;
    tri.forEach((from, j) => { const to = tri[(j + 1) % 3], key = from < to ? `${from}/${to}` : `${to}/${from}`, edge = edges.get(key) ?? { count: 0, orientation: 0 }; edge.count++; edge.orientation += from < to ? 1 : -1; edges.set(key, edge); });
  }
  for (const edge of edges.values()) { assert.equal(edge.count, 2, 'open/non-manifold saddle shell'); assert.equal(edge.orientation, 0, 'inconsistent saddle winding'); }
  assert(volume > 1e-9, 'inverted/zero-volume saddle shell');
}
function endpoints(player: RidingPlayer) {
  const inverse = player.horse.mesh.matrixWorld.clone().invert();
  for (let side = 0; side < 2; side++) {
    const bit = (side === 0 ? player.tack.bitLeft : player.tack.bitRight).getWorldPosition(new Vector3()).applyMatrix4(inverse);
    const grip = player.reins.grips[side].getWorldPosition(new Vector3()).applyMatrix4(inverse);
    const points = player.reins.points[side], error = Math.max(bit.distanceTo(points[0]), grip.distanceTo(points.at(-1)!));
    assert(error < 1e-6, `rein detached from current-frame anchors: ${error}`); maximumEndpointError = Math.max(maximumEndpointError, error);
    assert.equal(player.reins.grips[side].parent, player.rider.bones[side === 0 ? B.LeftHand : B.RightHand]);
    assert(points.every(point => point.toArray().every(Number.isFinite)), 'non-finite rein');
    assert(points.every(point => (side === 0 ? -1 : 1) * point.x > .10), 'reins crossed neck centerline');
  }
  assert(Array.from(player.reins.mesh.geometry.getAttribute('position').array).every(Number.isFinite));
}
function noHeadNeckCrossing(player: RidingPlayer) {
  const horse = player.horse, matrices = horse.bones.map((bone, i) => new Matrix4().multiplyMatrices(bone.matrixWorld, horse.skeleton.boneInverses[i]));
  const points = horse.data.vertices.map(vertex => {
    const [a, b, w] = vertex.weight;
    return new Vector3(...vertex.position).applyMatrix4(matrices[a]).multiplyScalar(w).add(new Vector3(...vertex.position).applyMatrix4(matrices[b]).multiplyScalar(1 - w));
  });
  const faces = horse.data.triangles.filter(face => ['Head', 'Neck', 'Body'].includes(face.part));
  const ray = new Ray(), end = new Vector3(), hit = new Vector3(), bit = new Vector3();
  for (let side = 0; side < 2; side++) {
    bit.copy(player.reins.points[side][0]).applyMatrix4(horse.mesh.matrixWorld);
    for (let segment = 0; segment < REIN_SEGMENTS; segment++) {
      ray.origin.copy(player.reins.points[side][segment]).applyMatrix4(horse.mesh.matrixWorld);
      end.copy(player.reins.points[side][segment + 1]).applyMatrix4(horse.mesh.matrixWorld);
      const length = ray.origin.distanceTo(end); ray.direction.subVectors(end, ray.origin).normalize();
      for (const face of faces) {
        const [a, b, c] = face.indices;
        if (ray.intersectTriangle(points[a], points[b], points[c], false, hit) && hit.distanceTo(ray.origin) < length - 1e-6) {
          // 嘴环附近6毫米制作接触以外，中心线不允许穿越头、颈或躯干壳。
          assert(hit.distanceTo(bit) < .006, `${player.rider.data.recipe.bodyType}/${player.tack.id}/${player.selection}/${player.status().phase}: rein ${side}/${segment} crosses ${face.part} at ${hit.toArray()}`);
        }
      }
      headNeckSegments++;
    }
  }
}
try {
  assert.deepEqual(SADDLES.map(value => value.id), ['none', 'simple', 'travel']);
  assert.equal(saddleDefinition('none').seat, null); assert.throws(() => saddleDefinition('missing' as SaddleId)); faultInjections++;
  for (const bodyType of BODY_TYPES) {
    const recipe = createRecipe({ bodyType }), player = createRidingPlayer(recipe), original = JSON.stringify(recipe);
    const horseId = player.horse.mesh.geometry.uuid, riderId = player.rider.mesh.geometry.uuid, reinId = player.reins.mesh.geometry.uuid;
    const buffer = player.reins.mesh.geometry.getAttribute('position').array;
    for (const saddle of ['simple', 'travel'] as const) {
      player.setSaddle(saddle); assert.deepEqual(player.seat.position.toArray(), saddleDefinition(saddle).seat);
      assert.equal(player.tack.root.parent, player.horse.bones[2]); assert.equal(player.tack.bridleRoot.parent, player.horse.bones[6]);
      budgets[saddle] = player.tack.stats().triangles;
      for (const mesh of player.tack.meshes) {
        for (const shell of mesh.geometry.userData.shells) closedShell(mesh.geometry, shell.start, shell.count);
        const colors = mesh.geometry.getAttribute('color'); const unique = new Set(Array.from({ length: colors.count }, (_, i) => `${colors.getX(i)},${colors.getY(i)},${colors.getZ(i)}`));
        assert(unique.size >= 2, 'author colors lost while merging');
      }
      const saddleGeometries = player.tack.stats().geometries;
      player.select('pose'); endpoints(player); noHeadNeckCrossing(player);
      for (const clip of RIDING_CLIP_IDS) {
        player.select(clip); let first: number[] | undefined;
        for (let frame = 0; frame <= 120; frame++) {
          player.seek(frame / 120); endpoints(player); noHeadNeckCrossing(player); poses++;
          const current = Array.from(player.reins.mesh.geometry.getAttribute('position').array);
          if (frame === 0) first = current;
          if (frame === 120) current.forEach((value, i) => near(value, first![i], 2e-6));
          near(player.status().horsePhase, player.status().riderPhase, 1e-9);
        }
      }
      assert.deepEqual(player.tack.stats().geometries, saddleGeometries); assert.equal(player.reins.mesh.geometry.getAttribute('position').array, buffer);
    }
    assert.equal(player.horse.mesh.geometry.uuid, horseId); assert.equal(player.rider.mesh.geometry.uuid, riderId); assert.equal(player.reins.mesh.geometry.uuid, reinId);
    player.seek(.375); player.setLoop(false); const before = player.status(); player.setSaddle('none');
    assert(!player.canRide); assert(!player.rider.mesh.visible); assert(!player.reins.mesh.visible); assert.equal(player.tack.meshes.length, 0);
    player.update(1); player.seek(.7); player.step(1); player.replay(); player.select('Rider_Walk'); assert.deepEqual(player.status(), before);
    player.setSaddle('simple'); assert(player.canRide && player.rider.mesh.visible && player.reins.mesh.visible); assert.deepEqual(player.status(), before);
    player.horse.mesh.position.set(2, .3, -1); player.horse.mesh.rotation.set(.08, .8, -.05); player.horse.mesh.scale.setScalar(1.2); player.update(0); endpoints(player);
    player.setRecipe(createRecipe({ bodyType: bodyType === 'male' ? 'female' : 'male' })); endpoints(player); near(player.status().phase, .375);
    assert.equal(player.horse.mesh.geometry.uuid, horseId); assert.equal(player.reins.mesh.geometry.uuid, reinId); assert.equal(JSON.stringify(recipe), original);
    player.reins.points[0][0].x += .1; assert.throws(() => endpoints(player)); player.update(0); faultInjections++;
    player.reins.mesh.geometry.getAttribute('position').setX(10, Number.NaN); assert.throws(() => endpoints(player)); player.update(0); faultInjections++;
    const owned = [...player.tack.meshes.map(mesh => mesh.geometry), player.reins.mesh.geometry], disposed = owned.map(() => 0);
    owned.forEach((geometry, i) => geometry.addEventListener('dispose', () => disposed[i]++)); player.dispose(); player.dispose(); disposed.forEach(value => assert.equal(value, 1));
  }
  const horse = createHorseActor(), player = createHorsePlayer(horse), tack = createSaddleActor(horse, 'travel');
  const id = horse.mesh.geometry.uuid;
  for (const clip of HORSE_CLIP_IDS) {
    player.select(clip);
    for (let frame = 0; frame <= 120; frame++) { player.seek(frame / 120); assert([...tack.root.matrixWorld.elements, ...tack.bridleRoot.matrixWorld.elements].every(Number.isFinite)); horseOnlyPoses++; }
  }
  tack.select('none'); player.update(.1); assert.equal(horse.mesh.geometry.uuid, id); assert.equal(tack.meshes.length, 0); tack.dispose(); player.dispose(); horse.dispose();
  assert.equal(poses, 1452); assert.equal(horseOnlyPoses, 484);
  const report = { result: 'passed', sourceSHA, version: SADDLE_VERSION, budgets, reinTriangles: 200, poses, horseOnlyPoses, headNeckSegments, maximumEndpointError, faultInjections,
    boundary: 'Closed asset shells, same-frame endpoints and finite sampled centerline crossings. Not rope physics, finger IK, full saddle/garment collision or visual approval.' };
  writeFileSync(join(output, 'saddles-checks.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  writeFileSync(join(output, 'saddles-checks.json'), JSON.stringify({ result: 'failed', sourceSHA, poses, horseOnlyPoses, failure: String(error instanceof Error ? error.stack : error) }, null, 2)); throw error;
}
