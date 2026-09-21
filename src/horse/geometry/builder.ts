import type { HorseMeshData, HorseWeight, Point3 } from '../types';

export interface Section { p: Point3; width: number; depth: number; skin: HorseWeight; color?: string }
export const COAT = '#9b694c', COAT_DARK = '#84573f', MANE = '#332d29', HOOF = '#34332f', SOCK = '#cabc9c';
/** 只负责封闭低模截面连接，不在每帧生成几何，也不猜测骨权重。 */
export class HorseMeshBuilder {
  readonly data: HorseMeshData = { version: 'wanhu-horse-mesh-m1-v1', vertices: [], triangles: [] };
  vertex(position: Point3, weight: HorseWeight) {
    const id = this.data.vertices.length;
    this.data.vertices.push({ position: [...position], weight: [...weight] }); return id;
  }
  triangle(a: number, b: number, c: number, color: string, part: string) {
    this.data.triangles.push({ indices: [a, b, c], color, part });
  }
  loft(part: string, sections: readonly Section[], sides: number, color = COAT) {
    if (sections.length < 2 || sides < 3) throw new Error('截面不足');
    const rings: number[][] = [];
    sections.forEach((section, r) => {
      const before = sections[Math.max(0, r - 1)].p, after = sections[Math.min(sections.length - 1, r + 1)].p;
      const dy = after[1] - before[1], dz = after[2] - before[2], length = Math.hypot(dy, dz);
      if (length < 1e-6 || section.width <= 0 || section.depth <= 0) throw new Error(`非法截面 ${part}/${r}`);
      const vy = dz / length, vz = -dy / length;
      rings.push(Array.from({ length: sides }, (_, s) => {
        const theta = s * Math.PI * 2 / sides, u = Math.cos(theta) * section.width, v = Math.sin(theta) * section.depth;
        return this.vertex([section.p[0] + u, section.p[1] + v * vy, section.p[2] + v * vz], section.skin);
      }));
    });
    for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < sides; s++) {
      const next = (s + 1) % sides, a = rings[r][s], b = rings[r][next], c = rings[r + 1][s], d = rings[r + 1][next];
      const tint = sections[r].color ?? color;
      this.triangle(a, b, c, tint, part); this.triangle(b, d, c, tint, part);
    }
    const first = this.vertex(sections[0].p, sections[0].skin), lastSection = sections.at(-1)!;
    const last = this.vertex(lastSection.p, lastSection.skin), end = rings.at(-1)!;
    for (let s = 0; s < sides; s++) {
      const next = (s + 1) % sides;
      this.triangle(first, rings[0][next], rings[0][s], sections[0].color ?? color, part);
      this.triangle(last, end[s], end[next], lastSection.color ?? color, part);
    }
  }
  /** 小型闭合八面体用于眼睛／鼻孔；不制作眼球骨或高精度球体。 */
  gem(part: string, center: Point3, radius: Point3, skin: HorseWeight, color: string) {
    const ids: number[] = [];
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const p = [...center] as Point3; p[axis] += radius[axis] * sign; ids.push(this.vertex(p, skin));
    }
    for (const ix of [0, 1]) for (const iy of [2, 3]) for (const iz of [4, 5]) {
      const a = this.data.vertices[ids[ix]].position, b = this.data.vertices[ids[iy]].position, c = this.data.vertices[ids[iz]].position;
      const u = b.map((v, k) => v - a[k]), v = c.map((n, k) => n - a[k]);
      const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const outward = normal.reduce((sum, n, k) => sum + n * ((a[k] + b[k] + c[k]) / 3 - center[k]), 0);
      this.triangle(ids[ix], ids[outward > 0 ? iy : iz], ids[outward > 0 ? iz : iy], color, part);
    }
  }
}
