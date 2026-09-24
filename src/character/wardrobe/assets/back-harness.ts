import { type Cage, type Recipe, type Vec3, type Weight } from '../../v3/types';
import { add, sub, cross, dot, mul, vertex, bridge, orient } from '../../v3/cage';
import { isAuthoredBack } from './back-accessories';

interface Hit { p: Vec3; w: Weight }
/** 仅创建时对可见衣身/皮肤投影，背带继承该表面的双权重；不读取动画或求解碰撞。 */
function fit(c: Cage, origin: Vec3, direction: Vec3): Hit {
  let distance = -Infinity, hit: Hit | undefined;
  for (const f of c.faces) {
    if (f.region !== 'torso' && f.region !== 'neck') continue;
    for (let k = 1; k < f.v.length - 1; k++) {
      const vertices = [c.vertices[f.v[0]], c.vertices[f.v[k]], c.vertices[f.v[k + 1]]];
      const [a, b, d] = vertices.map(v => v.p), ab = sub(b, a), ad = sub(d, a);
      const h = cross(direction, ad), det = dot(ab, h);
      if (Math.abs(det) < 1e-10) continue;
      const s = sub(origin, a), u = dot(s, h) / det, q = cross(s, ab), v = dot(direction, q) / det;
      if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
      const t = dot(ad, q) / det;
      if (t < 0 || t <= distance) continue;
      const sums = new Map<number, number>();
      [1 - u - v, u, v].forEach((factor, i) => {
        const [a, b, blend] = vertices[i].w;
        sums.set(a, (sums.get(a) ?? 0) + Math.max(0, factor) * blend);
        sums.set(b, (sums.get(b) ?? 0) + Math.max(0, factor) * (1 - blend));
      });
      const sorted = [...sums].filter(([, value]) => value > 1e-8).sort((a, b) => b[1] - a[1]);
      const first = sorted[0], second = sorted[1] ?? first;
      if (!first) throw new Error('背带投影遇到无效权重');
      distance = t;
      hit = { p: add(origin, mul(direction, t)), w: [first[0], second[0], first[0] === second[0] ? 1 : first[1] / (first[1] + second[1])] };
    }
  }
  if (!hit) throw new Error(`背带制作投影未命中衣身：${origin.join(',')} / ${direction.join(',')}`);
  return hit;
}

/** 两条封闭薄实体肩带，独立于刚性篓/柴/书笈；不是新装备槽，也不要求衣服改拓扑。 */
export function makeBackHarness(surface: Cage, recipe: Recipe): Cage | undefined {
  if (!isAuthoredBack(recipe.slots.back)) return undefined;
  const c: Cage = { vertices: [], faces: [], anchors: {} };
  const color = recipe.slots.back === 'book_case' ? recipe.dyes.accent : '#776249';
  for (const side of [-1, 1]) {
    const x = side;
    const path: { origin: Vec3; normal: Vec3; width: Vec3 }[] = [
      { origin: [x * .105, 1.19, 0], normal: [0, 0, 1], width: [1, 0, 0] },
      { origin: [x * .115, 1.30, 0], normal: [0, 0, 1], width: [1, 0, 0] },
      { origin: [x * .125, 1.395, 0], normal: [0, 0, 1], width: [1, 0, 0] },
      { origin: [x * .125, 1.26, .034], normal: [0, 1, 0], width: [1, 0, 0] },
      { origin: [x * .125, 1.26, -.05], normal: [0, 1, 0], width: [1, 0, 0] },
      { origin: [x * .120, 1.38, 0], normal: [0, 0, -1], width: [1, 0, 0] },
      { origin: [x * .103, 1.19, 0], normal: [0, 0, -1], width: [1, 0, 0] },
      { origin: [0, 1.19, -.065], normal: [x, 0, 0], width: [0, -x, 0] },
      { origin: [0, 1.19, .065], normal: [x, 0, 0], width: [0, -x, 0] },
    ];
    const loops = path.map(({ origin, normal, width }, i) => {
      const edges = [-1, 1].map(s => fit(surface, add(origin, mul(width, s * .012)), normal));
      return [[0, .005], [0, .010], [1, .010], [1, .005]].map(([edge, clearance], j) => {
        const hit = edges[edge];
        return vertex(c, `BackHarness.${side}.${i}.${j}`, add(hit.p, mul(normal, clearance)), [...hit.w]);
      });
    });
    loops.forEach((loop, i) => bridge(c, loop, loops[(i + 1) % loops.length], 'equipment', color));
  }
  orient(c);
  return c;
}

export function appendBackHarness(target: Cage, recipe: Recipe): void {
  const piece = makeBackHarness(target, recipe);
  if (!piece) return;
  const offset = target.vertices.length;
  target.vertices.push(...piece.vertices);
  target.faces.push(...piece.faces.map(f => ({ ...f, v: f.v.map(i => i + offset) })));
}
