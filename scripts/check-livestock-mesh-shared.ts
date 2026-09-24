import assert from 'node:assert/strict';
import { Quaternion, Ray, Vector3 } from 'three';
import type { AnimalActor } from '../src/livestock/types';

export function readSkinnedPoints(actor: AnimalActor): Vector3[] {
  actor.mesh.updateMatrixWorld(true); actor.skeleton.update();
  const source = actor.geometry.getAttribute('position');
  return Array.from({ length: source.count }, (_, i) => actor.mesh.applyBoneTransform(i, new Vector3().fromBufferAttribute(source, i)));
}

/** 原睡眠检查的真实渲染网格断言；供睡眠专项与新物种完整动作矩阵共同使用。 */
export function assertClosedSkinnedMesh(actor: AnimalActor, points: Vector3[], bind: Vector3[]): void {
  const data = actor.data, skin = actor.geometry.getAttribute('skinIndex'), weight = actor.geometry.getAttribute('skinWeight');
  const start = actor.geometry.drawRange.start, end = Math.min(points.length, start + actor.geometry.drawRange.count);
  const rotations = actor.bones.map(bone => bone.getWorldQuaternion(new Quaternion()));
  data.indices.forEach((id, i) => {
    assert.equal(skin.getX(i), data.bones[id], '实际逐点骨骼绑定不变');
    assert.equal(weight.getX(i), 1); assert.equal(weight.getY(i) + weight.getZ(i) + weight.getW(i), 0);
  });
  for (const part of data.parts) {
    const edges = new Map<string, number>(), directions = new Map<string, number>(); let volume = 0;
    for (let i = start; i + 2 < end; i += 3) {
      if (data.indices[i] < part.start || data.indices[i] >= part.start + part.count) continue;
      const [a, b, c] = points.slice(i, i + 3), normal = b.clone().sub(a).cross(c.clone().sub(a));
      const original = bind[i + 1].clone().sub(bind[i]).cross(bind[i + 2].clone().sub(bind[i]));
      assert(normal.length() > 1e-8 && normal.length() / original.length() > .20, `${part.name}/face${i / 3}退化或严重塌缩`);
      const guide = [0, 1, 2].reduce((sum, j) => sum.add(original.clone().applyQuaternion(rotations[data.bones[data.indices[i + j]]])), new Vector3());
      assert(normal.dot(guide) > 0, `${part.name}/face${i / 3}相对骨骼旋转发生翻面`);
      volume += a.dot(b.clone().cross(c)) / 6;
      const keys = [a, b, c].map(p => p.toArray().map(n => n.toFixed(7)).join('/'));
      for (let j = 0; j < 3; j++) {
        const a = keys[j], b = keys[(j + 1) % 3], key = a < b ? `${a}|${b}` : `${b}|${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1); directions.set(key, (directions.get(key) ?? 0) + (a < b ? 1 : -1));
      }
    }
    assert(edges.size > 0 && [...edges.values()].every(n => n === 2), `${part.name}实际网格开放边`);
    assert([...directions.values()].every(n => n === 0) && volume > 1e-10, `${part.name}网格绕序错误`);
  }
  const logical: Vector3[] = []; data.indices.forEach((id, i) => { logical[id] = points[i]; });
  const bodyFaces = Array.from({ length: data.indices.length / 3 }, (_, i) => data.indices.slice(i * 3, i * 3 + 3)).filter(ids => ids[0] < data.parts[0].count);
  const inside = (point: Vector3) => {
    const ray = new Ray(point, new Vector3(.923, .181, .339).normalize()), hit = new Vector3(); let hits = 0;
    for (const ids of bodyFaces) if (ray.intersectTriangle(logical[ids[0]], logical[ids[1]], logical[ids[2]], false, hit) && hit.distanceTo(point) > 1e-8) hits++;
    return hits % 2 === 1;
  };
  for (const part of data.parts.slice(1)) {
    if (part.name === 'Tail') assert(inside(logical[part.count === 4 ? part.start : part.start + part.count - 2]), '尾根离体');
    if (part.name.includes('Leg')) {
      const ids = Array.from({ length: part.count }, (_, i) => part.start + i), top = Math.max(...ids.map(i => data.positions[i][1]));
      for (const id of ids.filter(i => Math.abs(data.positions[i][1] - top) < 1e-8)) assert(inside(logical[id]), `${part.name}腿根离体：${logical[id].toArray()}`);
    }
  }
}
