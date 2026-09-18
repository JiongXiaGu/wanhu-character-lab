import assert from "node:assert/strict";
import { edgeKey, cross, dot } from "../src/character/v3/cage";
import type { Cage } from "../src/character/v3/types";
/** 开口装饰允许边界；任何封闭部件都必须独立朝外，不能被人体的正体积掩盖。 */
export function assertComponentWinding(c: Cage) {
  const edges = new Map<string, { a: number; b: number; f: number }[]>();
  c.faces.forEach((f, fi) =>
    f.v.forEach((a, i) => {
      const b = f.v[(i + 1) % f.v.length],
        key = edgeKey(a, b),
        values = edges.get(key) ?? [];
      values.push({ a, b, f: fi });
      edges.set(key, values);
    }),
  );
  for (const list of edges.values()) {
    assert(list.length <= 2, "非流形装饰连接");
    if (list.length === 2) assert.equal(list[0].a, list[1].b, "装饰边绕序冲突");
  }
  const remaining = new Set(c.faces.map((_, i) => i));
  while (remaining.size) {
    const start = remaining.values().next().value!;
    remaining.delete(start);
    const stack = [start];
    let volume = 0,
      closed = true;
    while (stack.length) {
      const i = stack.pop()!,
        f = c.faces[i],
        a = c.vertices[f.v[0]].p;
      for (let k = 1; k < f.v.length - 1; k++)
        volume +=
          dot(a, cross(c.vertices[f.v[k]].p, c.vertices[f.v[k + 1]].p)) / 6;
      for (let k = 0; k < f.v.length; k++) {
        const list = edges.get(edgeKey(f.v[k], f.v[(k + 1) % f.v.length]))!;
        if (list.length !== 2) closed = false;
        for (const e of list) if (remaining.delete(e.f)) stack.push(e.f);
      }
    }
    if (closed)
      assert(
        volume > 1e-12,
        `封闭部件朝内：${c.vertices[c.faces[start].v[0]].id}`,
      );
  }
}
