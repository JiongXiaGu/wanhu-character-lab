import assert from 'node:assert/strict';
import { Matrix4, Ray, Vector3, type BufferGeometry } from 'three';
import { YAK_FUR_PARTS } from '../src/yak/geometry';
import type { MountActor } from '../src/mounts/types';
import type { RidingPlayer } from '../src/riding/riding-player';

export function near(a: number, b: number, epsilon = 1e-6) { assert(Math.abs(a - b) <= epsilon, `${a} != ${b}`); }
export function skinnedPoints(actor: MountActor) {
  const matrices = actor.bones.map((bone, i) => new Matrix4().multiplyMatrices(bone.matrixWorld, actor.skeleton.boneInverses[i]));
  return actor.data.vertices.map(vertex => { const [a, b, w] = vertex.weight; return new Vector3(...vertex.position).applyMatrix4(matrices[a]).multiplyScalar(w).add(new Vector3(...vertex.position).applyMatrix4(matrices[b]).multiplyScalar(1 - w)); });
}
function validateTriangles(points: Vector3[], faces: number[][], name: string) {
  const edges = new Map<string, [number, number]>(); let volume = 0;
  for (const tri of faces) {
    assert(tri.length === 3 && tri.every(i => Number.isInteger(i) && i >= 0 && i < points.length), `${name}: invalid face`);
    const [a, b, c] = tri.map(i => points[i]); assert(new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).length() > 1e-10, `${name}: degenerate face`);
    volume += a.dot(b.clone().cross(c)) / 6;
    tri.forEach((from, i) => { const to = tri[(i + 1) % 3], key = from < to ? `${from}/${to}` : `${to}/${from}`, edge = edges.get(key) ?? [0, 0]; edge[0]++; edge[1] += from < to ? 1 : -1; edges.set(key, edge); });
  }
  for (const edge of edges.values()) { assert.equal(edge[0], 2, `${name}: open or non-manifold`); assert.equal(edge[1], 0, `${name}: inconsistent winding`); }
  assert(volume > 1e-9, `${name}: inverted or empty shell (${volume})`);
}
export function validateMountMesh(actor: MountActor) {
  const points = actor.data.vertices.map(vertex => {
    assert(vertex.position.every(Number.isFinite)); const [a, b, w] = vertex.weight;
    assert([a, b].every(i => Number.isInteger(i) && i >= 0 && i < actor.bones.length), 'unknown weight bone'); assert(Number.isFinite(w) && w >= 0 && w <= 1, 'illegal weight'); return new Vector3(...vertex.position);
  });
  const parts = new Map<string, number[][]>();
  for (const f of actor.data.triangles) { const faces = parts.get(f.part) ?? []; faces.push(f.indices); parts.set(f.part, faces); }
  for (const [name, faces] of parts) validateTriangles(points, faces, name);
  actor.bones.forEach((bone, i) => { const bind = new Matrix4().multiplyMatrices(bone.matrixWorld, actor.skeleton.boneInverses[i]); bind.elements.forEach((value, j) => near(value, j % 5 === 0 ? 1 : 0)); });
  return parts.size;
}
export function validateSaddleShells(geometry: BufferGeometry) {
  const p = geometry.getAttribute('position');
  for (const shell of geometry.userData.shells) {
    const points: Vector3[] = [], ids: number[] = [], index = new Map<string, number>();
    for (let i = shell.start; i < shell.start + shell.count; i++) {
      const v = new Vector3().fromBufferAttribute(p, i); assert(v.toArray().every(Number.isFinite));
      const key = v.toArray().map(n => Math.round(n * 1e6)).join(','); if (!index.has(key)) { index.set(key, points.length); points.push(v); } ids.push(index.get(key)!);
    }
    const faces = Array.from({ length: ids.length / 3 }, (_, i) => ids.slice(i * 3, i * 3 + 3)); validateTriangles(points, faces, 'saddle');
  }
}
export function validateReins(player: RidingPlayer, intersections = true) {
  const actor = player.mount, inverse = actor.mesh.matrixWorld.clone().invert(), pose = intersections ? skinnedPoints(actor) : [];
  const extraParts: readonly string[] = player.mountId === 'yak_black' ? YAK_FUR_PARTS : [];
  const faces = actor.data.triangles.filter(f => [...extraParts, 'Head', 'Neck', 'Body', 'FrontHump', 'BackHump', 'NoseMirror', 'LeftHorn', 'RightHorn', 'Dewlap'].includes(f.part));
  const ray = new Ray(), hit = new Vector3();
  for (let side = 0; side < 2; side++) {
    const points = player.reins.points[side], bit = (side === 0 ? player.tack.bitLeft : player.tack.bitRight).getWorldPosition(new Vector3()).applyMatrix4(inverse), grip = player.reins.grips[side].getWorldPosition(new Vector3()).applyMatrix4(inverse);
    assert(points.every(v => v.toArray().every(Number.isFinite)), 'non-finite rein'); near(bit.distanceTo(points[0]), 0); near(grip.distanceTo(points.at(-1)!), 0);
    if (!intersections) continue;
    const bitWorld = bit.clone().applyMatrix4(actor.mesh.matrixWorld);
    for (let i = 0; i < points.length - 1; i++) {
      ray.origin.copy(points[i]).applyMatrix4(actor.mesh.matrixWorld); const end = points[i + 1].clone().applyMatrix4(actor.mesh.matrixWorld), length = end.distanceTo(ray.origin); ray.direction.subVectors(end, ray.origin).normalize();
      for (const f of faces) {
        if (ray.intersectTriangle(pose[f.indices[0]], pose[f.indices[1]], pose[f.indices[2]], false, hit) && hit.distanceTo(ray.origin) < length - 1e-6) {
          assert(hit.distanceTo(bitWorld) < .006, `${player.mountId}/${player.rider.data.recipe.bodyType}/${player.tack.id}/${player.selection}/${player.status().phase}: rein ${side}/${i} crosses ${f.part}: ${hit.toArray()}`);
        }
      }
    }
  }
  assert(Array.from(player.reins.mesh.geometry.getAttribute('position').array).every(Number.isFinite), 'non-finite rein buffer');
}
