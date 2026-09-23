import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { LIVESTOCK } from '../src/livestock/catalog';
import { createAnimalActor } from '../src/livestock/actor';
import { createPoseCache, POSE_FPS } from '../src/livestock/pose-cache';
import type { AnimalMeshData, LivestockLodId } from '../src/livestock/types';
import { CHICKEN_BONES as B } from '../src/chicken/rig';

/** 不再把若干各自闭合、彼此悬空的壳误判为完整动物。主体必须共享拓扑连接。 */
function continuousMain(data: AnimalMeshData, lod: LivestockLodId) {
  const main = data.parts.find(part => part.name === 'BodyNeckHead');
  assert(main, `${lod}缺少连续头颈主体`);
  assert(!data.parts.some(part => /^(Eye|Wattle|Wing|Foot|Head$|Neck$|Beak$)/.test(part.name)), '低档不能恢复独立头部小壳或翅片');
  if (lod === 'lod2') assert(!data.parts.some(part => part.name === 'Comb'), '远档不保留独立鸡冠');
  const vertices = new Set(Array.from({ length: main.count }, (_, i) => i + main.start));
  const neighbors = new Map<number, Set<number>>(), edges = new Map<string, number>();
  const faces: number[][] = [];
  for (let i = 0; i < data.indices.length; i += 3) {
    const tri = data.indices.slice(i, i + 3);
    if (!tri.every(v => vertices.has(v))) continue;
    faces.push(tri);
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3], key = `${Math.min(a,b)}/${Math.max(a,b)}`;
      if (!neighbors.has(a)) neighbors.set(a, new Set());
      neighbors.get(a)!.add(b); edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  const visited = new Set<number>(), pending = [main.start];
  while (pending.length) { const id = pending.pop()!; if (visited.has(id)) continue; visited.add(id); pending.push(...(neighbors.get(id) ?? [])); }
  assert.equal(visited.size, main.count, `${lod}主体存在断开的头/颈`);
  assert([...edges.values()].every(n => n === 2), `${lod}主体开口`);
  assert.equal(main.count - edges.size + faces.length, 2, `${lod}主体拓扑异常`);
  assert(faces.some(tri => new Set(tri.map(i => data.bones[i])).size > 1), '颈部不能仅有彼此独立的刚性壳');
  assert([...vertices].some(i => data.bones[i] === B.Head)); assert([...vertices].some(i => data.bones[i] === B.Body));
  return faces;
}

const definition = LIVESTOCK[0], reports: object[] = [];
for (const lod of ['lod1', 'lod2'] as const) {
  const actor = createAnimalActor(definition, lod), data = actor.data;
  const mainFaces = continuousMain(data, lod);
  assert.equal(data.indices.length / 3, lod === 'lod1' ? 72 : 36);
  assert.equal(data.positions.length, lod === 'lod1' ? 46 : 26);
  // 删除真实跨骨接口必须被拒绝，不能仅检查名字与面数。
  const broken = { ...data, indices: data.indices.filter((_, i) => {
    const tri = data.indices.slice(Math.floor(i/3)*3, Math.floor(i/3)*3+3);
    return new Set(tri.map(v => data.bones[v])).size === 1;
  }) };
  assert.throws(() => continuousMain(broken, lod));
  assert.throws(() => continuousMain({ ...data, parts: [...data.parts, { name: 'EyeL', start: 0, count: 1 }] }, lod));
  const source = actor.geometry.getAttribute('position'), firstRender = new Int32Array(data.positions.length).fill(-1);
  data.indices.forEach((v, i) => { if (firstRender[v] < 0) firstRender[v] = i; });
  const area = (points: Vector3[], tri: number[]) => points[tri[1]].clone().sub(points[tri[0]]).cross(points[tri[2]].clone().sub(points[tri[0]])).length();
  const bind = data.positions.map(p => new Vector3(...p)), bindAreas = mainFaces.map(f => area(bind, f));
  const beak = data.positions.reduce((best, p, i) => p[2] > data.positions[best][2] ? i : best, 0);
  const feet = data.positions.map((p, i) => p[1] <= .006 && (data.bones[i] === B.LegL || data.bones[i] === B.LegR) ? i : -1).filter(i => i >= 0);
  let poses = 0, minFoot = Infinity, minBeak = Infinity, minAreaRatio = Infinity;
  const sample = (motion: string, phase: number) => {
    actor.sample(motion, phase);
    return Array.from(firstRender, i => { const p = new Vector3().fromBufferAttribute(source, i); return actor.mesh.applyBoneTransform(i, p); });
  };
  for (const motion of definition.motions) {
    const first = sample(motion.id, 0), last = sample(motion.id, 1);
    first.forEach((p, i) => assert(p.distanceTo(last[i]) < 1e-5, `${lod}/${motion.id}循环接缝`));
    for (let f = 0; f <= 240; f++) {
      const points = sample(motion.id, f / 240); poses++;
      points.forEach(p => { assert(p.toArray().every(v => Number.isFinite(v) && Math.abs(v) < .8)); assert(p.y >= -.002, `${lod}/${motion.id}穿地`); });
      feet.forEach(i => { minFoot = Math.min(minFoot, points[i].y); assert(points[i].y >= -.001); });
      if (motion.id === 'peck') minBeak = Math.min(minBeak, points[beak].y);
      mainFaces.forEach((tri, i) => { const ratio = area(points, tri) / bindAreas[i]; minAreaRatio = Math.min(minAreaRatio, ratio); assert(ratio > .05, `${lod}/${motion.id}连续主体塌缩`); });
    }
  }
  assert(minBeak >= .001 && minBeak <= .035, `${lod}啄食喙未接地`);
  const cache = createPoseCache(definition, lod);
  for (const motion of definition.motions) {
    const frames = Math.max(2, Math.ceil(motion.duration * POSE_FPS));
    for (const frame of [0, Math.round(frames * .45), frames]) {
      const phase = frame / frames; actor.sample(motion.id, phase);
      const cached = cache.get(motion.id, phase).getAttribute('position');
      for (let i = 0; i < source.count; i++) {
        const actual = actor.mesh.applyBoneTransform(i, new Vector3().fromBufferAttribute(source, i));
        assert(actual.distanceTo(new Vector3().fromBufferAttribute(cached, i)) < 1e-6, `${lod}群体缓存与单只姿态不一致`);
      }
    }
  }
  reports.push({ lod, triangles: data.indices.length / 3, logicalVertices: data.positions.length, mainTriangles: mainFaces.length, poses, minFoot, minBeak, minAreaRatio, faultInjections: 2 });
  cache.dispose(); cache.dispose(); actor.dispose(); actor.dispose();
}
const dir = process.env.LIVESTOCK_CHECK_DIR ?? '/tmp/wanhu-livestock-checks'; mkdirSync(dir, { recursive: true });
const result = { result: 'passed', sourceSHA: process.env.REVIEW_HEAD_SHA ?? 'local', reports };
writeFileSync(`${dir}/lod-rebuild.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
