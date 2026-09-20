import { B, type Cage } from './types';
import { LEG, ring, face } from './cage';

/**
 * 皮肤骨盆专用拓扑：腰口8点接左右6点腿口，中间两块有宽度的裆底。
 * 不复制裤装、不增加补壳、不让一个中心点同时牵扯两条腿。
 * 返回腿口，由人体构造器继续连接原有大腿/膝/脚；所有操作仅在构造时执行。
 */
export function makeSkinPelvis(c: Cage, waist: number[]): [number[], number[]] {
  if (waist.length !== 8) throw new Error('固定皮肤腰口必须为8点');
  const roots: number[][] = [];
  for (const side of [1, -1]) {
    const right = side === 1, name = right ? 'Right' : 'Left';
    const thigh = right ? B.RightThigh : B.LeftThigh;
    const profile = right ? LEG : LEG.map(([x, z]) => [-x, -z] as [number, number]);
    const root = ring(c, `SkinPelvis.${name}.Root`, [side * .101, .94, 0], [1, 0, 0], [0, 0, 1], profile, .09, .09, [B.Hips, thigh, .55]);
    c.vertices[root[5]].p[1] = .855;
    c.vertices[root[5]].w = [B.Hips, thigh, .35];
    roots.push(root);
    for (let j = 0; j < 4; j++) {
      const offset = right ? 0 : 4;
      face(c, [waist[(offset + j) % 8], waist[(offset + j + 1) % 8], root[j + 1], root[j]], 'pelvis');
    }
  }
  const [r, l] = roots;
  face(c, [waist[4], r[4], l[0]], 'pelvis');
  face(c, [waist[0], l[4], r[0]], 'pelvis');
  face(c, [r[4], r[5], l[5], l[0]], 'pelvis');
  face(c, [r[5], r[0], l[4], l[5]], 'pelvis');
  return [r, l];
}
