import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import { createClipClock } from '../src/animation/clip-clock';
import { HORSE_JOINTS, HORSE_RIG_VERSION, localBind } from '../src/horse/rig';
import { createHorseActor } from '../src/horse/skinning';
import { createHorsePlayer } from '../src/horse/player';
import { HORSE_CLIP_IDS } from '../src/horse/types';
import { HORSE_ANIMATION_VERSION, horseClipDefinition } from '../src/horse/animation';

const actor = createHorseActor(), player = createHorsePlayer(actor), { data } = actor;
const vector = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
const close = (actual: number, expected: number, epsilon = 1e-6) => assert(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const groups = new Map<string, { triangles: number; volume: number; edges: Map<string, number> }>();
assert.equal(new Set(HORSE_JOINTS.map(j => j.name)).size, HORSE_JOINTS.length);
HORSE_JOINTS.forEach((joint, index) => {
  assert(joint.bindWorld.every(Number.isFinite)); assert(joint.parent < index && joint.parent >= -1);
  assert.equal(joint.parent === -1, index === 0); assert(localBind(index).every(Number.isFinite));
});
for (const vertex of data.vertices) {
  assert(vertex.position.every(Number.isFinite));
  const [first, second, weight] = vertex.weight;
  assert(Number.isInteger(first) && first >= 0 && first < actor.bones.length);
  assert(Number.isInteger(second) && second >= 0 && second < actor.bones.length);
  assert(Number.isFinite(weight) && weight >= 0 && weight <= 1); close(weight + (1 - weight), 1);
  assert(new Set([...(weight > 0 ? [first] : []), ...(weight < 1 ? [second] : [])]).size <= 2);
}
for (const triangle of data.triangles) {
  assert.equal(new Set(triangle.indices).size, 3);
  triangle.indices.forEach(index => assert(Number.isInteger(index) && index >= 0 && index < data.vertices.length));
  a.fromArray(data.vertices[triangle.indices[0]].position); b.fromArray(data.vertices[triangle.indices[1]].position); c.fromArray(data.vertices[triangle.indices[2]].position);
  const twiceArea = b.clone().sub(a).cross(c.clone().sub(a)).length();
  assert(twiceArea > 1e-9, `退化面 ${triangle.part}: ${twiceArea}`);
  const group = groups.get(triangle.part) ?? { triangles: 0, volume: 0, edges: new Map<string, number>() };
  group.triangles++; group.volume += a.dot(b.clone().cross(c)) / 6;
  for (let edge = 0; edge < 3; edge++) {
    const pair = [triangle.indices[edge], triangle.indices[(edge + 1) % 3]].sort((x, y) => x - y), key = pair.join(':');
    group.edges.set(key, (group.edges.get(key) ?? 0) + 1);
  }
  groups.set(triangle.part, group);
}
for (const [part, group] of groups) {
  assert(group.volume > 0, `反向封闭壳 ${part}`);
  for (const count of group.edges.values()) assert.equal(count, 2, `非封闭/非流形边 ${part}`);
}
const positionKey = (position: number[]) => position.map(v => Math.round(v * 1e6)).join(',');
const positions = new Set(data.vertices.map(vertex => positionKey(vertex.position)));
for (const vertex of data.vertices) assert(positions.has(positionKey([-vertex.position[0], vertex.position[1], vertex.position[2]])), '绑定几何左右不对称');

function skinned(index: number, target: T.Vector3) {
  const vertex = data.vertices[index], [first, second, weight] = vertex.weight;
  a.fromArray(vertex.position).applyMatrix4(actor.skeleton.boneInverses[first]).applyMatrix4(actor.bones[first].matrixWorld).multiplyScalar(weight);
  b.fromArray(vertex.position).applyMatrix4(actor.skeleton.boneInverses[second]).applyMatrix4(actor.bones[second].matrixWorld).multiplyScalar(1 - weight);
  return target.copy(a).add(b);
}
player.select('bind'); actor.sync();
let bindError = 0;
data.vertices.forEach((vertex, index) => { skinned(index, vector); bindError = Math.max(bindError, vector.distanceTo(new T.Vector3(...vertex.position))); });
assert(bindError < 1e-6, `inverse bind错误 ${bindError}`);
const geometryId = actor.mesh.geometry.uuid;
const reports: Record<string, unknown> = {};
const vertexParts = data.vertices.map(() => new Set<string>());
data.triangles.forEach(triangle => triangle.indices.forEach(index => vertexParts[index].add(triangle.part)));
for (const id of HORSE_CLIP_IDS) {
  const clip = player.clips.get(id); assert(clip, `缺少动作 ${id}`);
  close(clip.duration, horseClipDefinition(id).duration);
  for (const track of clip.tracks) {
    assert(!track.name.startsWith('Root.') && !track.name.endsWith('.scale'), `不允许Root Motion/缩放轨道 ${track.name}`);
    assert(Array.from(track.times).every(Number.isFinite) && Array.from(track.values).every(Number.isFinite));
    for (let i = 1; i < track.times.length; i++) assert(track.times[i] > track.times[i - 1]);
    if (track.name.endsWith('.quaternion')) for (let i = 0; i < track.values.length; i += 4) close(Math.hypot(...Array.from(track.values.slice(i, i + 4))), 1);
  }
  player.select(id); player.seek(0);
  const first = data.vertices.map((_, index) => skinned(index, new T.Vector3()).clone());
  const firstMatrices = actor.bones.map(bone => bone.matrixWorld.clone());
  player.seek(1);
  let seam = 0;
  data.vertices.forEach((_, index) => { seam = Math.max(seam, skinned(index, vector).distanceTo(first[index])); });
  actor.bones.forEach((bone, index) => bone.matrixWorld.elements.forEach((value, e) => close(value, firstMatrices[index].elements[e])));
  assert(seam < 1e-6, `循环接缝 ${id}: ${seam}`);
  const bounds = new T.Box3(), backBounds = new T.Box3(); let minimumHoof = Infinity, minimumHead = Infinity;
  const hoofRanges: Record<string, [number, number]> = {};
  for (let frame = 0; frame <= 240; frame++) {
    player.seek(frame / 240); assert.equal(actor.mesh.geometry.uuid, geometryId);
    for (const bone of actor.bones) {
      assert(bone.matrixWorld.elements.every(Number.isFinite)); assert(Math.abs(bone.matrixWorld.determinant() - 1) < 1e-5);
    }
    assert(Array.from(actor.skeleton.boneMatrices).every(Number.isFinite));
    data.vertices.forEach((_, index) => {
      skinned(index, vector); assert(vector.toArray().every(Number.isFinite));
      assert(Math.max(Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z)) < 8, `异常爆炸 ${id}/${frame}`);
      bounds.expandByPoint(vector);
      for (const part of vertexParts[index]) if (part.endsWith('Hoof')) {
        minimumHoof = Math.min(minimumHoof, vector.y); const range = hoofRanges[part] ?? [Infinity, -Infinity];
        range[0] = Math.min(range[0], vector.y); range[1] = Math.max(range[1], vector.y); hoofRanges[part] = range;
      } else if (part === 'Head') minimumHead = Math.min(minimumHead, vector.y);
    });
    const spine = actor.bones[2]; backBounds.expandByPoint(spine.getWorldPosition(vector));
    const up = new T.Vector3(0, 1, 0).applyQuaternion(spine.getWorldQuaternion(new T.Quaternion()));
    assert(up.y > .98, '马背异常翻转或大幅折叠');
  }
  assert(backBounds.getSize(vector).y < .2, '马背垂直位移异常');
  reports[id] = { duration: clip.duration, tracks: clip.tracks.length, samples: 241, seamMaxMeters: seam,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, backVerticalRange: backBounds.getSize(vector).y,
    minimumHoofY: minimumHoof, minimumHeadY: minimumHead, hoofRanges };
  // 大量循环更新和结束保持独立于离散截图。
  player.setLoop(true); player.seek(.99); player.update(clip.duration * 3 + clip.duration * .12); close(player.status().phase, .11);
  player.setLoop(false); player.seek(.99); player.update(clip.duration); close(player.status().phase, 1); assert(player.status().finished);
  player.update(clip.duration * 10); close(player.status().phase, 1); player.replay(); close(player.status().phase, 0);
}
const clock = createClipClock(2, true); clock.advance(NaN); clock.advance(Infinity); clock.advance(-1); close(clock.time, 0);
clock.seek(NaN); close(clock.phase, 0); clock.seek(3); close(clock.phase, 1); clock.advance(.1); close(clock.phase, .05);
clock.seek(-1); close(clock.phase, 0); clock.setLoop(false); clock.advance(10); assert(clock.finished); clock.replay(); assert(!clock.finished);
assert.throws(() => createClipClock(0, true)); assert.throws(() => createClipClock(NaN, true));
assert.notDeepEqual(player.clips.get('Horse_Walk')!.tracks.map(track => Array.from(track.values)), player.clips.get('Horse_Run')!.tracks.map(track => Array.from(track.values)));
const report = { passed: true, sourceSHA: process.env.REVIEW_HEAD_SHA ?? process.env.GITHUB_SHA ?? 'local',
  stats: actor.stats, meshVersion: data.version, rigVersion: HORSE_RIG_VERSION, motionVersion: HORSE_ANIMATION_VERSION,
  inverseBindMaximumError: bindError, sampledPoses: 241 * 4, sampledLogicalVertices: 241 * 4 * data.vertices.length,
  parts: Object.fromEntries([...groups].map(([name, group]) => [name, { triangles: group.triangles, signedVolume: group.volume }])),
  skeleton: HORSE_JOINTS, clips: reports,
  boundaries: ['闭合壳在颈根、腿根和鬃尾处有固定制作重叠；本检查不是全网格零相交证明。', '最低蹄和头高度是诊断数据；蹄步态与穿插仍需实际浏览器多相位看图。'] };
fs.mkdirSync('review/horse', { recursive: true }); fs.writeFileSync('review/horse/checks.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2)); player.dispose(); actor.dispose();
