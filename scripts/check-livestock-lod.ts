import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { LIVESTOCK } from '../src/livestock/catalog';
import { createAnimalActor } from '../src/livestock/actor';
import { createPoseCache } from '../src/livestock/pose-cache';
import { CHICKEN_BONES as B } from '../src/chicken/rig';
import type { AnimalMeshData, LivestockLodId } from '../src/livestock/types';

const definition = LIVESTOCK[0];
function ids(data: AnimalMeshData, name: string): number[] {
  const part = data.parts.find(value => value.name === name);
  assert(part, `缺少必要体块 ${name}`);
  return Array.from({ length: part.count }, (_, i) => part.start + i);
}
/** 面数和闭合性都不能证明脖子存在：额外保护Body→Neck→Head的同一连通分量。 */
function assertNeckConnection(data: AnimalMeshData, lod: LivestockLodId) {
  const body = ids(data, 'Body'), neck = ids(data, 'Neck'), head = ids(data, 'Head');
  assert.equal(neck.length, 3, '低档颈截面必须保留');
  const [a, b, c] = neck.map(i => new Vector3(...data.positions[i]));
  assert(b.sub(a).cross(c.sub(a)).length() > .001, '颈截面被压成线或点');
  for (const i of neck) assert.equal(data.bones[i], B.Neck, '颈截面绑定错误');
  for (const i of head) assert.equal(data.bones[i], B.Head, '头部绑定错误');
  assert(!data.parts.some(p => /Eye|Wattle|Wing/.test(p.name)), '低档不恢复眼睛/肉垂/独立翅膀');
  if (lod === 'lod2') assert(!data.parts.some(p => p.name === 'Comb'), 'LOD2不保留鸡冠');
  const graph = data.positions.map(() => new Set<number>());
  for (let i = 0; i < data.indices.length; i += 3) {
    const f = data.indices.slice(i, i + 3);
    for (let j = 0; j < 3; j++) { graph[f[j]].add(f[(j + 1) % 3]); graph[f[(j + 1) % 3]].add(f[j]); }
  }
  const connected = new Set<number>(), stack = [body[0]];
  while (stack.length) { const i = stack.pop()!; if (connected.has(i)) continue; connected.add(i); stack.push(...graph[i]); }
  for (const name of ['Body', 'Neck', 'Head', 'Beak', 'Tail']) {
    assert(ids(data, name).every(i => connected.has(i)), `${lod}: ${name}与身体断开`);
  }
  assert.equal(connected.size, lod === 'lod1' ? 20 : 12, '连续主壳顶点数变化需重新审核');
  return connected;
}

export function checkConnectedLods() {
  const reports = [];
  for (const [lod, triangles, vertices] of [['lod1', 56, 36], ['lod2', 28, 20]] as const) {
    const actor = createAnimalActor(definition, lod), data = actor.data;
    const position = actor.geometry.getAttribute('position');
    assert.equal(data.indices.length / 3, triangles); assert.equal(data.positions.length, vertices);
    const connected = assertNeckConnection(data, lod);
    const firstRender = new Map<number, number>();
    data.indices.forEach((logical, render) => { if (!firstRender.has(logical)) firstRender.set(logical, render); });
    const sample = (motion: string, phase: number): Vector3[] => {
      actor.sample(motion, phase);
      return data.positions.map((_, logical) => {
        const i = firstRender.get(logical)!;
        return actor.mesh.applyBoneTransform(i, new Vector3().fromBufferAttribute(position, i));
      });
    };
    let minGround = Infinity, minBeak = Infinity, minimumFaceArea2 = Infinity, densePoses = 0;
    for (const motion of definition.motions) {
      const start = sample(motion.id, 0), end = sample(motion.id, 1);
      start.forEach((p, i) => assert(p.distanceTo(end[i]) < 1e-5, `${lod}/${motion.id}循环首尾不一致`));
      for (let frame = 0; frame <= 240; frame++) {
        const actual = sample(motion.id, frame / 240); densePoses++;
        for (const p of actual) {
          assert(p.toArray().every(Number.isFinite)); assert(p.toArray().every(v => Math.abs(v) < .8));
          assert(p.y >= -.002, `${lod}/${motion.id}: 模型穿地 ${p.y}`); minGround = Math.min(minGround, p.y);
        }
        if (motion.id === 'peck') minBeak = Math.min(minBeak, ...ids(data, 'Beak').map(i => actual[i].y));
        // 验证真实蒙皮后的共享点仍重合，不只是作者索引在纸面上连通。
        for (let i = 0; i < data.indices.length; i++) {
          const p = actor.mesh.applyBoneTransform(i, new Vector3().fromBufferAttribute(position, i));
          assert(p.distanceTo(actual[data.indices[i]]) < 1e-7, '硬边展开后接缝分裂');
        }
        for (let i = 0; i < data.indices.length; i += 3) {
          const [a, b, c] = data.indices.slice(i, i + 3).map(id => actual[id]);
          const area2 = b.clone().sub(a).cross(c.clone().sub(a)).length();
          minimumFaceArea2 = Math.min(minimumFaceArea2, area2);
          assert(area2 > 1e-6, `${lod}/${motion.id}: 动画中三角面塌缩`);
        }
      }
    }
    assert(minBeak >= .001 && minBeak <= .035, `${lod}: 啄食未接近地面 ${minBeak}`);
    const cache = createPoseCache(definition, lod);
    for (const motion of definition.motions) {
      const frames = Math.max(2, Math.ceil(motion.duration * 24));
      for (const frame of [0, Math.round(frames / 4), Math.round(frames / 2), Math.round(frames * .75), frames]) {
        const phase = frame / frames, actual = sample(motion.id, phase), cached = cache.get(motion.id, phase).getAttribute('position');
        for (let i = 0; i < cached.count; i++) {
          assert(new Vector3().fromBufferAttribute(cached, i).distanceTo(actual[data.indices[i]]) < 1e-6, '群体缓存与真实骨骼姿态不同');
        }
      }
    }
    // 故障反例：旧版删颈、错误绑定、零厚颈、断头都必须被拒绝。
    const missing = structuredClone(data); missing.parts = missing.parts.filter(p => p.name !== 'Neck');
    assert.throws(() => assertNeckConnection(missing, lod));
    const wrong = structuredClone(data); ids(wrong, 'Neck').forEach(i => { wrong.bones[i] = B.Root; });
    assert.throws(() => assertNeckConnection(wrong, lod));
    const collapsed = structuredClone(data); ids(collapsed, 'Neck').forEach(i => { collapsed.positions[i] = [0, .35, .17]; });
    assert.throws(() => assertNeckConnection(collapsed, lod));
    const detached = structuredClone(data), neckIds = new Set(ids(data, 'Neck')), headIds = new Set(ids(data, 'Head'));
    detached.indices = [];
    for (let i = 0; i < data.indices.length; i += 3) {
      const f = data.indices.slice(i, i + 3);
      if (!(f.some(id => neckIds.has(id)) && f.some(id => headIds.has(id)))) detached.indices.push(...f);
    }
    assert.throws(() => assertNeckConnection(detached, lod));
    reports.push({ lod, triangles, logicalVertices: vertices, coreVertices: connected.size, densePoses, minGround, minBeak, minimumFaceArea2, cachedPoses: cache.size, faultInjections: 4 });
    cache.dispose(); cache.dispose(); actor.dispose(); actor.dispose();
  }
  const result = { sourceSHA: process.env.REVIEW_HEAD_SHA ?? 'local', result: 'passed', reports, boundary: '连续主壳、真实蒙皮与有限密集采样；不是所有连续时刻零自相交或用户美术认可。' };
  const dir = process.env.LIVESTOCK_CHECK_DIR ?? '/tmp/wanhu-livestock-checks';
  mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/lod-connected.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  return reports;
}
