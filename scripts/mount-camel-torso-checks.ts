import assert from 'node:assert/strict';
import type { MountActor } from '../src/mounts/types';
import { CAMEL_JOINTS } from '../src/camel/rig';

export const CAMEL_SCULPT_STATS = { triangles: 2280, logicalVertices: 1198, gpuVertices: 6840, bones: 29 };
/** 验证连续双峰拓扑，而不是只改峰高数字、保留两个相交底盖。 */
export function checkCamelTorso(actor: MountActor) {
  assert(!actor.data.triangles.some(f => /^(Front|Back)Hump$/.test(f.part)), 'detached hump shells returned');
  const faces = actor.data.triangles.filter(f => f.part === 'Body');
  const ids = new Set(faces.flatMap(f => f.indices));
  assert.equal(faces.length, 800); assert.equal(ids.size, 402);
  const edges = new Map<string, number>(), adjacency = new Map<number, Set<number>>();
  for (const { indices } of faces) indices.forEach((a, i) => {
    const b = indices[(i + 1) % 3], key = a < b ? `${a}/${b}` : `${b}/${a}`;
    edges.set(key, (edges.get(key) ?? 0) + 1);
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a)!.add(b);
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(b)!.add(a);
  });
  assert([...edges.values()].every(count => count === 2), 'body/peak seam is open or non-manifold');
  const visited = new Set<number>(), queue = [ids.values().next().value!];
  while (queue.length) { const i = queue.pop()!; if (visited.has(i)) continue; visited.add(i); queue.push(...adjacency.get(i)!); }
  assert.equal(visited.size, ids.size, 'humps must share the torso surface, not be disconnected caps');
  assert.equal(ids.size - edges.size + faces.length, 2, 'unexpected torso topology');
  const key = (x: number, y: number, z: number) => [x, y, z].map(n => Math.round(n * 1e6)).join('/');
  const mirror = new Map([...ids].map(i => { const p = actor.data.vertices[i].position; return [key(...p), i] as const; }));
  const heights = new Map<number, number>();
  for (const i of ids) {
    const { position: [x, y, z], weight } = actor.data.vertices[i], other = mirror.get(key(-x, y, z));
    assert(other !== undefined, 'torso symmetry broken');
    assert.deepEqual(weight, actor.data.vertices[other].weight, 'mirror skin weights differ');
    assert(weight.slice(0, 2).every(bone => ['Pelvis', 'Spine', 'Chest'].includes(CAMEL_JOINTS[bone].name)));
    heights.set(z, Math.max(y, heights.get(z) ?? -Infinity));
  }
  const profile = [...heights].sort((a, b) => a[0] - b[0]);
  const peaks = profile.filter((p, i) => i > 0 && i < profile.length - 1 && p[1] > 2.3 && p[1] > profile[i - 1][1] && p[1] > profile[i + 1][1]);
  assert.equal(peaks.length, 2, 'silhouette must have two distinct rounded humps');
  assert(peaks[0][0] < -.5 && peaks[1][0] > .5);
  for (const [z, y] of peaks) {
    // 新的较矮圆钝美术基线；不修改地面、穿插或动画门槛。
    assert(y > 2.32 && y < 2.43, `hump crest outside sculpt envelope: ${y}`);
    assert(profile.filter(p => Math.abs(p[0] - z) < .13 && p[1] > y - .075).length >= 2, 'needle-like crest');
  }
  const valley = profile.filter(p => p[0] >= -.28 && p[0] <= .28).map(p => p[1]);
  assert(Math.max(...valley) < 1.96 && Math.min(...valley) > 1.8, 'hump valley no longer fits the existing saddle');
  return { connectedShells: 1, vertices: ids.size, triangles: faces.length, edges: edges.size, openEdges: 0, euler: 2, peaks, valley: [Math.min(...valley), Math.max(...valley)] };
}
