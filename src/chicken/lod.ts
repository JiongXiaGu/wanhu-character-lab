import { Vector3 } from 'three';
import type { AnimalMeshData, Point } from '../livestock/types';
import { CHICKEN_BONES as B } from './rig';

export const CHICKEN_LOD1_VERSION = 'wanhu-chicken-mesh-lod1-v2';
export const CHICKEN_LOD2_VERSION = 'wanhu-chicken-mesh-lod2-v2';

/** 低档优先保留连接关系。尾、身、颈、头、喙是一张共用逻辑顶点的闭合表面。
 * 各截面仍为单骨刚性权重，跨截面的面承担过渡；不是几个会脱开的独立闭合小块。
 * 不重写LOD0、不改8骨绑定/动作，不在播放时补洞或重新建模。 */
function buildConnectedChicken(coarse: boolean): AnimalMeshData {
  const data: AnimalMeshData = {
    positions: [], indices: [], bones: [], colors: [], parts: [],
    version: coarse ? CHICKEN_LOD2_VERSION : CHICKEN_LOD1_VERSION,
  };
  function vertices(name: string, points: Point[], bone: number, color: string): number[] {
    const start = data.positions.length;
    data.positions.push(...points);
    data.bones.push(...points.map(() => bone));
    data.colors.push(...points.map(() => color));
    data.parts.push({ name, start, count: points.length });
    return points.map((_, i) => start + i);
  }
  function ring(name: string, sides: number, y: number, z: number, rx: number, ry: number, bone: number, color: string, dy = 1, dz = 0): number[] {
    return vertices(name, Array.from({ length: sides }, (_, i) => {
      const angle = Math.PI / 2 + i * Math.PI * 2 / sides;
      return [Math.cos(angle) * rx, y + Math.sin(angle) * ry * dy, z + Math.sin(angle) * ry * dz] as Point;
    }), bone, color);
  }
  /** 连接不同边数的同向截面；只使用已有顶点，不能在颈两端复制出裂缝。 */
  function join(a: number[], b: number[]) {
    let i = 0, j = 0;
    while (i < a.length || j < b.length) {
      const ai = a[i % a.length], bj = b[j % b.length];
      const nextA = (i + 1) * b.length, nextB = (j + 1) * a.length;
      if (nextA === nextB) {
        const an = a[(i + 1) % a.length], bn = b[(j + 1) % b.length];
        data.indices.push(ai, an, bn, ai, bn, bj); i++; j++;
      } else if (nextA < nextB) {
        data.indices.push(ai, a[(i + 1) % a.length], bj); i++;
      } else {
        data.indices.push(ai, b[(j + 1) % b.length], bj); j++;
      }
    }
  }
  function tetra(name: string, points: Point[], bone: number, color: string) {
    const ids = vertices(name, points, bone, color);
    const center = points.reduce((sum, p) => sum.add(new Vector3(...p)), new Vector3()).multiplyScalar(.25);
    for (const face of [[0, 1, 2], [0, 3, 1], [1, 3, 2], [2, 3, 0]]) {
      const [a, b, c] = face.map(i => new Vector3(...points[i]));
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      if (normal.dot(a.clone().sub(center)) < 0) [face[1], face[2]] = [face[2], face[1]];
      data.indices.push(...face.map(i => ids[i]));
    }
  }

  const tail = vertices('Tail', [[0, .374, -.315]], B.Body, '#424d44')[0];
  const sections = coarse ? [
    ring('Body', 4, .261, -.050, .122, .117, B.Body, '#aa6b39'),
    ring('Neck', 3, .332, .156, .052, .049, B.Neck, '#c18a4f', .65, -.76),
    ring('Head', 3, .445, .235, .049, .041, B.Head, '#dba564'),
  ] : [
    ring('Rump', 4, .253, -.170, .057, .063, B.Body, '#805c3c'),
    ring('Body', 4, .258, -.065, .126, .118, B.Body, '#aa6b39'),
    ring('Chest', 4, .295, .115, .080, .083, B.Body, '#aa6b39'),
    ring('Neck', 3, .359, .173, .039, .040, B.Neck, '#c18a4f', .65, -.76),
    ring('Head', 3, .446, .238, .050, .044, B.Head, '#dba564'),
  ];
  // 喙直接收成头壳前端，不再叠一个独立尖块。
  const beak = vertices('Beak', [[0, .434, .328]], B.Head, '#dfaf50')[0];
  const first = sections[0], last = sections[sections.length - 1];
  for (let i = 0; i < first.length; i++) data.indices.push(tail, first[(i + 1) % first.length], first[i]);
  for (let i = 1; i < sections.length; i++) join(sections[i - 1], sections[i]);
  for (let i = 0; i < last.length; i++) data.indices.push(last[i], last[(i + 1) % last.length], beak);

  for (const side of [-1, 1]) {
    const x = side * .063, bone = side < 0 ? B.LegL : B.LegR, suffix = side < 0 ? 'L' : 'R';
    const bottom: Point[] = [[x - .014, .008, .024], [x + .014, .008, .024], [x, .008, -.016]];
    if (coarse) {
      tetra('Leg' + suffix, [...bottom, [x, .193, 0]], bone, '#c3954e');
    } else {
      // 窄三棱柱同时给出腿与最低限度的落地轮廓，不增加脚趾壳。
      const lower = vertices('Foot' + suffix, bottom, bone, '#c3954e');
      const upper = vertices('Leg' + suffix, [[x - .011, .186, .007], [x + .011, .186, .007], [x, .186, -.010]], bone, '#c3954e');
      data.indices.push(lower[0], lower[2], lower[1]);
      join(lower, upper);
      data.indices.push(upper[0], upper[1], upper[2]);
    }
  }
  if (!coarse) {
    // 仅剩一个小鸡冠；LOD1已删除眼睛、肉垂和翅膀小壳，LOD2连鸡冠也删除。
    tetra('Comb', [[-.008, .468, .230], [.008, .468, .230], [0, .468, .268], [0, .510, .241]], B.Head, '#b94334');
  }
  return data;
}

/** 56 tris / 36逻辑点：连续主壳36面、两腿16面、小鸡冠4面。 */
export function buildChickenLod1Mesh(): AnimalMeshData { return buildConnectedChicken(false); }
/** 28 tris / 20逻辑点：连续主壳20面、两腿8面；没有独立头部细节。 */
export function buildChickenLod2Mesh(): AnimalMeshData { return buildConnectedChicken(true); }
