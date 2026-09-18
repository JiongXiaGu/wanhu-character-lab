import type { Cage, Face, Region, Vec3, Weight } from "./types";
export const add = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const sub = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const mul = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];
export const dot = (a: Vec3, b: Vec3) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const unit = (a: Vec3): Vec3 => mul(a, 1 / (Math.hypot(...a) || 1));
export const triCount = (c: Cage) =>
  c.faces.reduce((n, f) => n + f.v.length - 2, 0);
export function vertex(c: Cage, id: string, p: Vec3, w: Weight): number {
  c.vertices.push({ id, p, w });
  return c.vertices.length - 1;
}
export function face(c: Cage, v: number[], region: Region, color?: string) {
  c.faces.push({ v, region, color });
}
export function bridge(
  c: Cage,
  a: number[],
  b: number[],
  region: Region,
  color?: string,
) {
  if (a.length !== b.length) throw Error("固定接口采样数不一致");
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    face(c, [a[i], a[j], b[j], b[i]], region, color);
  }
}
export function ring(
  c: Cage,
  id: string,
  center: Vec3,
  u: Vec3,
  v: Vec3,
  profile: readonly (readonly [number, number])[],
  width: number,
  depth: number,
  w: Weight,
): number[] {
  return profile.map(([x, z], i) =>
    vertex(
      c,
      `${id}.${i}`,
      add(center, add(mul(u, x * width), mul(v, z * depth))),
      [...w],
    ),
  );
}
export const OCT: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.76, 0.78],
  [1, 0],
  [0.76, -0.78],
  [0, -1],
  [-0.76, -0.78],
  [-1, 0],
  [-0.76, 0.78],
];
export const HEX: readonly (readonly [number, number])[] = [
  [-0.5, 0.866],
  [-1, 0],
  [-0.5, -0.866],
  [0.5, -0.866],
  [1, 0],
  [0.5, 0.866],
];
export const LEG: readonly (readonly [number, number])[] = [
  [-0.5, 0.866],
  [0.5, 0.866],
  [1, 0],
  [0.5, -0.866],
  [-0.5, -0.866],
  [-1, 0],
];
export const BOX: readonly (readonly [number, number])[] = [
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
];
export const edgeKey = (a: number, b: number) =>
  a < b ? `${a}:${b}` : `${b}:${a}`;
/** 建立时为固定面图确定一致的方向；不按屏幕投影猜正反面。 */
export function orient(c: Cage) {
  const edges = new Map<string, { f: number; a: number; b: number }[]>();
  c.faces.forEach((f, fi) =>
    f.v.forEach((a, i) => {
      const b = f.v[(i + 1) % f.v.length],
        k = edgeKey(a, b);
      const arr = edges.get(k) ?? [];
      arr.push({ f: fi, a, b });
      edges.set(k, arr);
    }),
  );
  const flips = new Map<number, boolean>();
  for (let seed = 0; seed < c.faces.length; seed++) {
    if (flips.has(seed)) continue;
    flips.set(seed, false);
    const todo = [seed],
      component: number[] = [];
    while (todo.length) {
      const fi = todo.pop()!;
      component.push(fi);
      const f = c.faces[fi];
      f.v.forEach((a, i) => {
        const b = f.v[(i + 1) % f.v.length];
        for (const e of edges.get(edgeKey(a, b)) ?? []) {
          if (e.f === fi) continue;
          const expected = flips.get(fi)! !== (a === e.a);
          if (flips.has(e.f)) {
            if (flips.get(e.f) !== expected) throw Error("不可定向或重复连接");
          } else {
            flips.set(e.f, expected);
            todo.push(e.f);
          }
        }
      });
    }
    let vol = 0;
    for (const fi of component) {
      const f = c.faces[fi];
      if (flips.get(fi)) f.v.reverse();
      const a = c.vertices[f.v[0]].p;
      for (let k = 1; k < f.v.length - 1; k++)
        vol +=
          dot(a, cross(c.vertices[f.v[k]].p, c.vertices[f.v[k + 1]].p)) / 6;
    }
    if (vol < 0) for (const fi of component) c.faces[fi].v.reverse();
  }
}
export function cloneCage(c: Cage): Cage {
  return {
    vertices: c.vertices.map((v) => ({ id: v.id, p: [...v.p], w: [...v.w] })),
    faces: c.faces.map((f) => ({ ...f, v: [...f.v] })),
    anchors: Object.fromEntries(
      Object.entries(c.anchors).map(([k, v]) => [k, [...v]]),
    ),
  };
}
/** 胶合是通过共享顶点索引完成；不是空间距离焊接。 */
export function polygonNormal(c: Cage, f: Face): Vec3 {
  let n: Vec3 = [0, 0, 0];
  const a = c.vertices[f.v[0]].p;
  for (let k = 1; k < f.v.length - 1; k++)
    n = add(
      n,
      cross(sub(c.vertices[f.v[k]].p, a), sub(c.vertices[f.v[k + 1]].p, a)),
    );
  return unit(n);
}
