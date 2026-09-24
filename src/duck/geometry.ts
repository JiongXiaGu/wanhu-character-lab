import type { AnimalMeshData, LivestockLodId, Point } from '../livestock/types';
import { DUCK_BONES as B, DUCK_SOLE } from './rig';

export const DUCK_MESH_VERSION = 'wanhu-domestic-duck-mesh-v6';
interface Ring { z: number; y: number; rx: number; ry: number; sides: number; bone: number; color: string }
const feather = '#ab865b', chest = '#c6a577', head = '#b49163', bill = '#c8a044', foot = '#c49a43';

/** 三档保留连续尾身颈头扁喙主壳；用户已取消可见翅膀与翼区色块设计。 */
export function buildDuckMesh(lod: LivestockLodId = 'lod0'): AnimalMeshData {
  if (!['lod0', 'lod1', 'lod2'].includes(lod)) throw new Error(`未知鸭LOD：${lod}`);
  const data: AnimalMeshData = { positions: [], indices: [], bones: [], colors: [], parts: [], version: `${DUCK_MESH_VERSION}/${lod}` };
  const vertex = (p: Point, bone: number, color: string) => {
    const i = data.positions.length; data.positions.push(p); data.bones.push(bone); data.colors.push(color); return i;
  };
  function tube(rows: Ring[]) {
    const start = data.positions.length;
    const rings = rows.map((r, row) => Array.from({ length: r.sides }, (_, i) => {
      const a = Math.PI / 2 + Math.PI * 2 * i / r.sides;
      return vertex([Math.cos(a) * r.rx, r.y + Math.sin(a) * r.ry, r.z], r.bone, r.color);
    }));
    for (let r = 1; r < rings.length; r++) {
      const a = rings[r - 1], b = rings[r]; let i = 0, j = 0;
      while (i < a.length || j < b.length) {
        if (j === b.length || (i < a.length && (i + 1) * b.length <= (j + 1) * a.length)) {
          data.indices.push(a[i % a.length], a[(i + 1) % a.length], b[j % b.length]); i++;
        } else { data.indices.push(a[i % a.length], b[(j + 1) % b.length], b[j % b.length]); j++; }
      }
    }
    const rear = vertex([0, .274, -.305], B.Body, '#71694e');
    const first = rings[0], last = rings[rings.length - 1];
    for (let i = 0; i < first.length; i++) data.indices.push(rear, first[(i + 1) % first.length], first[i]);
    // 扁喙在前端封闭；没有尖喙锥或独立漂浮的嘴。
    for (let i = 1; i < last.length - 1; i++) data.indices.push(last[0], last[i], last[i + 1]);
    data.parts.push({ name: 'BodyNeckHeadBill', start, count: data.positions.length - start });
  }
  function solid(name: string, points: Point[], faces: number[][], bone: number, color: string) {
    const start = data.positions.length, center = [0, 0, 0];
    points.forEach(p => p.forEach((v, i) => center[i] += v / points.length));
    points.forEach(p => vertex(p, bone, color));
    for (const face of faces) for (let k = 1; k < face.length - 1; k++) {
      const ids = [face[0], face[k], face[k + 1]], [a, b, c] = ids.map(i => points[i]);
      const u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i]);
      const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
      if (n.reduce((s, n, i) => s + n * (a[i] - center[i]), 0) < 0) [ids[1], ids[2]] = [ids[2], ids[1]];
      data.indices.push(...ids.map(i => start + i));
    }
    data.parts.push({ name, start, count: points.length });
  }
  const r = (z: number, y: number, rx: number, ry: number, sides: number, bone = B.Body as number, color = feather): Ring => ({ z, y, rx, ry, sides, bone, color });
  if (lod === 'lod0') tube([
    r(-.235,.233,.064,.061,6), r(-.125,.219,.169,.112,8), r(.045,.233,.153,.118,8),
    r(.123,.275,.079,.066,6,B.Body,chest), r(.178,.366,.044,.044,6,B.Neck,chest),
    r(.247,.397,.060,.053,6,B.Head,head), r(.302,.382,.051,.026,4,B.Head,head),
    r(.371,.378,.054,.012,4,B.Head,bill),
  ]);
  else if (lod === 'lod1') tube([
    r(-.130,.223,.162,.116,6), r(.096,.252,.124,.104,6),
    r(.177,.361,.047,.045,3,B.Neck,chest), r(.266,.398,.063,.052,4,B.Head,head),
    r(.371,.378,.064,.014,4,B.Head,bill),
  ]);
  else tube([
    r(-.115,.226,.171,.119,6), r(.127,.285,.080,.075,3,B.Body,chest),
    r(.269,.399,.066,.051,3,B.Head,head), r(.371,.378,.066,.014,3,B.Head,bill),
  ]);
  const tetra = [[0,1,2],[0,3,1],[1,3,2],[2,3,0]];
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R', x = side * .077, leg = side < 0 ? B.LegL : B.LegR;
    const sole = DUCK_SOLE.map(([px,y,z]) => [x+px,y,z] as Point);
    if (lod !== 'lod2') solid('Leg'+suffix, [...sole, [x-.010,.172,-.054],[x+.010,.172,-.054],[x,.172,-.073]], [[0,1,2],[3,5,4],[0,3,4,1],[1,4,5,2],[2,5,3,0]], leg, foot);
    else solid('Leg'+suffix, [...sole, [x,.172,-.060]], tetra, leg, foot);
    if (lod === 'lod0') {
      solid('Eye'+suffix, [[side*.045,.418,.262],[side*.045,.406,.262],[side*.042,.412,.273],[side*.052,.412,.265]], tetra, B.Head, '#2c3028');
    }
  }
  return data;
}
