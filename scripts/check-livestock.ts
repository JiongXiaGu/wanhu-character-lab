import './check-livestock-pig';
import './check-livestock-goose';
import './check-livestock-duck';
import './check-livestock-lod';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { LIVESTOCK } from '../src/livestock/catalog';
import { createAnimalActor } from '../src/livestock/actor';
import { createCrowd, makePlacements, PHASE_COHORTS } from '../src/livestock/crowd';
import { selectLivestockLod } from '../src/livestock/lod';
import { createPoseCache } from '../src/livestock/pose-cache';
import { CROWD_COUNTS, LIVESTOCK_LOD_IDS } from '../src/livestock/types';
import { authorChickenPose } from '../src/chicken/animation';

const definition = LIVESTOCK[0], point = new Vector3();
function validateTopology(lod, triangles, logicalVertices) {
  const actor = createAnimalActor(definition, lod), data = actor.data;
  assert.equal(data.indices.length / 3, triangles); assert.equal(data.positions.length, logicalVertices); assert.equal(actor.bones.length, 8);
  assert(!data.parts.some(part => part.name.startsWith('Wing')), `${lod}不得恢复可见Wing部件`);
  assert(!data.bones.some(bone => bone === 6 || bone === 7), `${lod}不得给兼容Wing骨分配可见几何`);
  assert.equal(actor.geometry.getAttribute('position').count, triangles * 3); assert.equal(actor.geometry.groups.length, 0);
  for (const attribute of Object.values(actor.geometry.attributes)) assert([...attribute.array].every(Number.isFinite));
  const weights = actor.geometry.getAttribute('skinWeight');
  for (let i = 0; i < weights.count; i++) { assert.equal(weights.getX(i), 1); assert.equal(weights.getY(i) + weights.getZ(i) + weights.getW(i), 0); }
  const edgeCounts = new Map(), signedEdges = new Map();
  for (let i = 0; i < data.indices.length; i += 3) {
    const triangle = data.indices.slice(i, i + 3), [a, b, c] = triangle.map(index => new Vector3(...data.positions[index]));
    assert(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-12, `${lod}退化三角形`);
    for (let j = 0; j < 3; j++) {
      const x = triangle[j], y = triangle[(j + 1) % 3], key = `${Math.min(x, y)}/${Math.max(x, y)}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1); signedEdges.set(key, (signedEdges.get(key) ?? 0) + (x < y ? 1 : -1));
    }
  }
  assert([...edgeCounts.values()].every(value => value === 2), `${lod}所有体壳必须闭合`);
  assert([...signedEdges.values()].every(value => value === 0), `${lod}相邻面绕序必须一致`);
  actor.bind(); const pos = actor.geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) { point.fromBufferAttribute(pos, i); const original = point.clone(); actor.mesh.applyBoneTransform(i, point); assert(point.distanceTo(original) < 1e-6, `${lod} inverse bind失真`); }
  for (const motion of definition.motions) for (const phase of [0, .25, .5, .75, 1]) {
    actor.sample(motion.id, phase);
    for (let i = 0; i < pos.count; i++) { point.fromBufferAttribute(pos, i); actor.mesh.applyBoneTransform(i, point); assert([...point].every(Number.isFinite)); assert(point.y >= -.003, `${lod}/${motion.id}穿地`); }
  }
  actor.dispose(); actor.dispose();
}
for (const lod of definition.lods) validateTopology(lod.id, lod.triangles, lod.logicalVertices);
assert.equal(selectLivestockLod('auto', 100), 'lod0'); assert.equal(selectLivestockLod('auto', 40), 'lod1'); assert.equal(selectLivestockLod('auto', 10), 'lod2');
for (const lod of LIVESTOCK_LOD_IDS) assert.equal(selectLivestockLod(lod, 1), lod);

const actor = createAnimalActor(definition, 'lod0'), data = actor.data, pos = actor.geometry.getAttribute('position');
function sample(motion, phase) {
  actor.sample(motion, phase);
  return Array.from({ length: pos.count }, (_, i) => { point.fromBufferAttribute(pos, i); actor.mesh.applyBoneTransform(i, point); return point.toArray(); });
}
const beak = data.parts.find(part => part.name === 'Beak'), footParts = data.parts.filter(part => part.name.startsWith('Foot'));
const beakIndices = data.indices.map((logical, index) => logical >= beak.start && logical < beak.start + beak.count ? index : -1).filter(i => i >= 0);
const footIndices = data.indices.map((logical, index) => footParts.some(part => logical >= part.start && logical < part.start + part.count) ? index : -1).filter(i => i >= 0);
let minFoot = Infinity, minBeak = Infinity, poses = 0;
for (const motion of definition.motions) {
  const first = sample(motion.id, 0), last = sample(motion.id, 1);
  for (let v = 0; v < first.length; v++) assert(new Vector3(...first[v]).distanceTo(new Vector3(...last[v])) < 1e-5, `${motion.id}循环接缝`);
  for (let i = 0; i <= 240; i++) {
    const vertices = sample(motion.id, i / 240); poses++;
    for (const p of vertices) { assert(p.every(Number.isFinite)); assert(p[1] >= -.002, `${motion.id}模型穿地：${p[1]}`); assert(p.every(value => Math.abs(value) < .8), '异常拉伸'); }
    const feet = Math.min(...footIndices.map(index => vertices[index][1])); minFoot = Math.min(minFoot, feet); assert(feet >= -.001, `${motion.id}脚底穿地`);
    if (motion.id === 'peck') minBeak = Math.min(minBeak, ...beakIndices.map(index => vertices[index][1]));
  }
}
assert(minBeak >= .001 && minBeak <= .035, `啄食必须接近地面：${minBeak}`);
for (const motion of ['walk', 'run']) {
  const early = authorChickenPose(motion, .05).rotations[4][0], late = authorChickenPose(motion, .55).rotations[4][0];
  assert(late > early, '支撑腿必须向后扫，不能倒着走');
}
assert.throws(() => actor.sample('unknown', 0));
const cache = createPoseCache(definition, 'lod0'), size = cache.size;
for (const motion of definition.motions) {
  const geometry = cache.get(motion.id, 0), expected = sample(motion.id, 0), actual = geometry.getAttribute('position');
  for (let i = 0; i < actual.count; i++) { point.fromBufferAttribute(actual, i); assert(point.distanceTo(new Vector3(...expected[i])) < 1e-6); }
  assert.equal(cache.get(motion.id, -1), cache.get(motion.id, 0)); assert.equal(cache.get(motion.id, 4), cache.get(motion.id, 1));
}
assert.equal(cache.size, size); cache.dispose(); cache.dispose();
assert.deepEqual(makePlacements(100, 731), makePlacements(100, 731)); assert.notDeepEqual(makePlacements(100, 731), makePlacements(100, 732));
assert.throws(() => makePlacements(501, 731)); assert.throws(() => makePlacements(NaN, 731));
const crowd = createCrowd(definition, actor.material);
for (const lod of LIVESTOCK_LOD_IDS) for (const count of CROWD_COUNTS) {
  crowd.setLayout(count, 731); assert.equal(crowd.placements.length, count);
  for (const mixed of [false, true]) for (const motion of definition.motions) {
    crowd.update(.37, { mixed, motion: motion.id, loop: true }, lod);
    assert.equal(crowd.group.children.reduce((sum, mesh) => sum + mesh.count, 0), count);
    assert(crowd.batchCount <= definition.motions.length * PHASE_COHORTS);
  }
}
const cachedPoses = crowd.cachedPoses;
for (let i = 0; i < 60; i++) crowd.update(i / 30, { mixed: true, motion: 'walk', loop: true }, 'lod2');
assert.equal(crowd.cachedPoses, cachedPoses, '播放不新增姿态几何');
crowd.dispose(); crowd.dispose(); actor.dispose(); actor.dispose();
const result = { sha: process.env.REVIEW_HEAD_SHA ?? 'local', lods: Object.fromEntries(definition.lods.map(lod => [lod.id, { triangles: lod.triangles, logicalVertices: lod.logicalVertices }])), bones: 8, weights: 1, poses, minFoot, minBeak, cachedPoses, counts: CROWD_COUNTS, result: 'passed' };
const dir = process.env.LIVESTOCK_CHECK_DIR ?? '/tmp/wanhu-livestock-checks'; mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/numeric.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
