import type { AnimalMeshData, Point } from '../livestock/types';
import { CHICKEN_BONES as B } from './rig';

export const CHICKEN_LOD1_VERSION = 'wanhu-chicken-mesh-lod1-v2';
export const CHICKEN_LOD2_VERSION = 'wanhu-chicken-mesh-lod2-v2';
interface Ring { z: number; y: number; rx: number; ry: number; sides: number; bone: number; color: string }

/** 低档优先保留连续大形：躯干、颈、头、喙是同一闭合壳，接口共用逻辑顶点。 */
function builder(version: string) {
  const data: AnimalMeshData = { positions: [], indices: [], bones: [], colors: [], parts: [], version };
  function vertex(point: Point, bone: number, color: string) {
    const index = data.positions.length;
    data.positions.push(point); data.bones.push(bone); data.colors.push(color);
    return index;
  }
  function tube(rows: Ring[]) {
    const start = data.positions.length;
    const rings = rows.map(row => Array.from({ length: row.sides }, (_, i) => {
      const a = (row.sides === 4 ? Math.PI / 4 : Math.PI / 6) + i * Math.PI * 2 / row.sides;
      return vertex([Math.cos(a) * row.rx, row.y + Math.sin(a) * row.ry, row.z], row.bone, row.color);
    }));
    // 以环绕序连接不同边数的截面；不能用整壳质心翻面，颈部本来就是弯曲的非凸壳。
    for (let r = 1; r < rings.length; r++) {
      const a = rings[r - 1], b = rings[r]; let i = 0, j = 0;
      while (i < a.length || j < b.length) {
        const ai = a[i % a.length], bj = b[j % b.length];
        if (j === b.length || (i < a.length && (i + 1) * b.length <= (j + 1) * a.length)) {
          data.indices.push(ai, a[(i + 1) % a.length], bj); i++;
        } else { data.indices.push(ai, b[(j + 1) % b.length], bj); j++; }
      }
    }
    const rear = vertex([0, .245, -.195], B.Body, '#aa6b39');
    const tip = vertex([0, .434, .333], B.Head, '#dfaf50');
    const first = rings[0], last = rings[rings.length - 1];
    for (let i = 0; i < first.length; i++) data.indices.push(rear, first[(i + 1) % first.length], first[i]);
    for (let i = 0; i < last.length; i++) data.indices.push(last[i], last[(i + 1) % last.length], tip);
    data.parts.push({ name: 'BodyNeckHead', start, count: data.positions.length - start });
  }
  function solid(name: string, points: Point[], faces: number[][], bone: number, color: string) {
    const start = data.positions.length;
    const center = [0, 0, 0];
    points.forEach(p => p.forEach((v, i) => center[i] += v / points.length));
    points.forEach(p => vertex(p, bone, color));
    for (const face of faces) for (let k = 1; k < face.length - 1; k++) {
      const ids = [face[0], face[k], face[k + 1]], [a, b, c] = ids.map(i => points[i]);
      const u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i]);
      const normal = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
      if (normal.reduce((sum, n, i) => sum + n * (a[i] - center[i]), 0) < 0) [ids[1], ids[2]] = [ids[2], ids[1]];
      data.indices.push(...ids.map(i => start + i));
    }
    data.parts.push({ name, start, count: points.length });
  }
  const tetraFaces = [[0,1,2],[0,3,1],[1,3,2],[2,3,0]];
  function tetra(name: string, points: Point[], bone: number, color: string) { solid(name, points, tetraFaces, bone, color); }
  function legs(detailed: boolean) {
    for (const side of [-1, 1]) {
      const x = side * .063, bone = side < 0 ? B.LegL : B.LegR, name = side < 0 ? 'LegL' : 'LegR';
      // 低档腿与脚合成一个壳；仅保留短小支撑面，无独立脚趾；不更改骨骼或动作制作。
      const sole: Point[] = [[x-.009,.005,.014],[x+.009,.005,.014],[x,.005,-.010]];
      if (detailed) solid(name, [...sole, [x-.010,.193,.008],[x+.010,.193,.008],[x,.193,-.010]], [[0,1,2],[3,5,4],[0,3,4,1],[1,4,5,2],[2,5,3,0]], bone, '#c3954e');
      else tetra(name, [...sole, [x,.193,0]], bone, '#c3954e');
    }
  }
  function tail() { tetra('Tail', [[-.037,.273,-.153],[.037,.273,-.153],[0,.392,-.245],[0,.355,-.335]], B.Body, '#424d44'); }
  return { data, tube, tetra, legs, tail };
}

/** 72三角形/46逻辑点：48面连续主体，余量用于尾、单块鸡冠与合并腿脚。没有眼睛/肉垂/独立翅片。 */
export function buildChickenLod1Mesh(): AnimalMeshData {
  const b = builder(CHICKEN_LOD1_VERSION);
  b.tube([
    { z: -.155, y: .245, rx: .075, ry: .070, sides: 6, bone: B.Body, color: '#aa6b39' },
    { z: -.045, y: .260, rx: .135, ry: .108, sides: 6, bone: B.Body, color: '#aa6b39' },
    { z: .120, y: .300, rx: .085, ry: .084, sides: 6, bone: B.Body, color: '#aa6b39' },
    { z: .209, y: .426, rx: .044, ry: .040, sides: 3, bone: B.Neck, color: '#d59c59' },
    { z: .268, y: .447, rx: .037, ry: .040, sides: 3, bone: B.Head, color: '#dba564' },
  ]);
  b.tail();
  b.tetra('Comb', [[-.009,.444,.218],[.009,.444,.218],[0,.506,.239],[0,.451,.267]], B.Head, '#b94334');
  b.legs(true);
  return b.data;
}

/** 36三角形/26逻辑点：24面连续主体，4面尾，8面腿脚；远档不再保留任何头部小配件。 */
export function buildChickenLod2Mesh(): AnimalMeshData {
  const b = builder(CHICKEN_LOD2_VERSION);
  b.tube([
    { z: -.080, y: .260, rx: .165, ry: .150, sides: 4, bone: B.Body, color: '#aa6b39' },
    { z: .134, y: .315, rx: .090, ry: .098, sides: 4, bone: B.Body, color: '#aa6b39' },
    { z: .263, y: .439, rx: .045, ry: .040, sides: 4, bone: B.Head, color: '#dba564' },
  ]);
  b.tail(); b.legs(false);
  return b.data;
}
