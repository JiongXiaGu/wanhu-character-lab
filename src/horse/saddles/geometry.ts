import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Point } from './catalog';

/** 只用于本批马具作者层；创建时合并闭合小壳，不在播放阶段生成。 */
export class SaddleBuilder {
  private parts: BufferGeometry[] = [];
  add(geometry: BufferGeometry, color: string) { geometry.deleteAttribute('uv'); geometry.userData.tint = color; this.parts.push(geometry); }
  box(center: Point, size: Point, color: string) { const g = new BoxGeometry(...size); g.translate(...center); this.add(g, color); }
  bar(a: Point, b: Point, width: number, depth: number, color: string) {
    const start = new Vector3(...a), end = new Vector3(...b), delta = end.clone().sub(start);
    if (delta.length() < 1e-6) throw new Error('马具带段长度不足');
    const g = new BoxGeometry(width, delta.length(), depth);
    g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize()));
    g.translate(...start.add(end).multiplyScalar(.5).toArray()); this.add(g, color);
  }
  plate(rows: { z: number; points: [number, number][] }[], thickness: number, color: string) {
    const n = rows[0].points.length, count = rows.length * n, p: number[] = [], ix: number[] = [];
    for (const dy of [0, -thickness]) for (const row of rows) for (const [x, y] of row.points) p.push(x, y + dy, row.z);
    const quad = (a: number, b: number, c: number, d: number) => ix.push(a, b, c, a, c, d);
    for (let r = 0; r < rows.length - 1; r++) for (let j = 0; j < n - 1; j++) {
      const a = r * n + j, b = a + n;
      quad(a, b, b + 1, a + 1); quad(a + count, a + 1 + count, b + 1 + count, b + count);
    }
    const boundary = [...Array.from({ length: n }, (_, j) => j), ...Array.from({ length: rows.length - 1 }, (_, r) => (r + 1) * n + n - 1),
      ...Array.from({ length: n - 1 }, (_, j) => count - 2 - j), ...Array.from({ length: rows.length - 2 }, (_, r) => (rows.length - 2 - r) * n)];
    boundary.forEach((a, i) => { const b = boundary[(i + 1) % boundary.length]; quad(a, b, b + count, a + count); }); this.raw(p, ix, color);
  }
  /** 闭合矩形截面环，用于皮带与脚蹬。 */
  band(center: Point, u: Point, v: Point, ru: number, rv: number, thickness: number, width: number, color: string, segments = 10) {
    const x = new Vector3(...u).normalize(), y = new Vector3(...v).normalize(), z = x.clone().cross(y).normalize();
    const c = new Vector3(...center), p: number[] = [], ix: number[] = [];
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2;
      for (const [dr, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const point = c.clone().addScaledVector(x, (ru + dr * thickness / 2) * Math.cos(a)).addScaledVector(y, (rv + dr * thickness / 2) * Math.sin(a)).addScaledVector(z, dz * width / 2);
        p.push(...point.toArray());
      }
    }
    for (let i = 0; i < segments; i++) for (let j = 0; j < 4; j++) {
      const a = i * 4 + j, b = ((i + 1) % segments) * 4 + j, c = ((i + 1) % segments) * 4 + (j + 1) % 4, d = i * 4 + (j + 1) % 4;
      ix.push(a, b, c, a, c, d);
    }
    this.raw(p, ix, color);
  }
  bundle(center: Point, size: Point, color: string) {
    const p: number[] = [], ix: number[] = [], profile = [[-1, -.65], [-.65, -1], [.65, -1], [1, -.65], [1, .65], [.65, 1], [-.65, 1], [-1, .65]];
    for (const y of [-.5, .5]) for (const [x, z] of profile) p.push(center[0] + x * size[0] / 2, center[1] + y * size[1], center[2] + z * size[2] / 2);
    for (let i = 0; i < 8; i++) { const j = (i + 1) % 8; ix.push(i, j, j + 8, i, j + 8, i + 8); }
    for (let i = 1; i < 7; i++) { ix.push(0, i + 1, i); ix.push(8, 8 + i, 8 + i + 1); } this.raw(p, ix, color);
  }
  raw(positions: number[], indices: number[], color: string) {
    let volume = 0; const a = new Vector3(), b = new Vector3(), c = new Vector3();
    for (let i = 0; i < indices.length; i += 3) { a.fromArray(positions, indices[i] * 3); b.fromArray(positions, indices[i + 1] * 3); c.fromArray(positions, indices[i + 2] * 3); volume += a.dot(b.cross(c)); }
    if (volume < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); this.add(g, color);
  }
  finish(origin: Point): BufferGeometry {
    const chunks: { start: number; count: number }[] = []; let offset = 0;
    const parts = this.parts.map(part => {
      // toNonIndexed不保证复制userData；颜色从原作者几何读取，不能整套变成默认棕色。
      const tint = new Color(part.userData.tint), g = part.toNonIndexed(); part.dispose();
      const colors = new Float32Array(g.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = tint.r; colors[i + 1] = tint.g; colors[i + 2] = tint.b; }
      g.setAttribute('color', new Float32BufferAttribute(colors, 3)); chunks.push({ start: offset, count: g.getAttribute('position').count }); offset += g.getAttribute('position').count; return g;
    });
    const result = mergeGeometries(parts, false); parts.forEach(g => g.dispose()); this.parts = [];
    if (!result) throw new Error('马具几何合并失败');
    result.applyMatrix4(new Matrix4().makeTranslation(-origin[0], -origin[1], -origin[2]));
    result.userData.shells = chunks; result.computeBoundingBox(); result.computeBoundingSphere(); return result;
  }
}
