import { Vector3 } from 'three';
import type { AnimalMeshData, Point } from '../livestock/types';
import { CHICKEN_BONES as B } from './rig';

export const CHICKEN_LOD1_VERSION = 'wanhu-chicken-mesh-lod1-v1';
export const CHICKEN_LOD2_VERSION = 'wanhu-chicken-mesh-lod2-v1';
const TETRA = [[0, 1, 2], [0, 3, 1], [1, 3, 2], [2, 3, 0]];
const OCTA = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];

/** LOD1/2是独立闭合作者壳，不由运行时删三角形。两档继续使用8骨语义，但允许省略远处不可读部件。 */
function builder(version: string) {
  const data: AnimalMeshData = { positions: [], indices: [], bones: [], colors: [], parts: [], version };
  function part(name: string, points: Point[], faces: number[][], bone: number, color: string) {
    const start = data.positions.length, center = new Vector3();
    for (const p of points) center.add(new Vector3(...p));
    center.multiplyScalar(1 / points.length);
    data.positions.push(...points); data.bones.push(...points.map(() => bone)); data.colors.push(...points.map(() => color));
    for (const face of faces) for (let k = 1; k < face.length - 1; k++) {
      const ids = [face[0], face[k], face[k + 1]], a = new Vector3(...points[ids[0]]), b = new Vector3(...points[ids[1]]), c = new Vector3(...points[ids[2]]);
      const outward = a.clone().add(b).add(c).multiplyScalar(1 / 3).sub(center);
      if (b.clone().sub(a).cross(c.clone().sub(a)).dot(outward) < 0) [ids[1], ids[2]] = [ids[2], ids[1]];
      data.indices.push(...ids.map(i => i + start));
    }
    data.parts.push({ name, start, count: points.length });
  }
  function octa(name: string, c: Point, r: Point, bone: number, color: string) {
    const [x, y, z] = c, [rx, ry, rz] = r;
    part(name, [[x-rx,y,z],[x+rx,y,z],[x,y-ry,z],[x,y+ry,z],[x,y,z+rz],[x,y,z-rz]], OCTA, bone, color);
  }
  function tetra(name: string, points: Point[], bone: number, color: string) { part(name, points, TETRA, bone, color); }
  function triPrism(name: string, x: number, y0: number, y1: number, bone: number, color: string) {
    const points: Point[] = [[x-.013,y0,-.012],[x+.013,y0,-.012],[x,y0,.014],[x-.011,y1,-.006],[x+.011,y1,-.006],[x,y1,.012]];
    part(name, points, [[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]], bone, color);
  }
  return { data, part, octa, tetra, triPrism };
}

export function buildChickenLod1Mesh(): AnimalMeshData {
  const b = builder(CHICKEN_LOD1_VERSION);
  b.octa('Body', [0,.275,-.015], [.142,.132,.230], B.Body, '#aa6b39');
  b.octa('Head', [0,.448,.225], [.054,.056,.055], B.Head, '#dba564');
  b.tetra('Beak', [[0,.434,.333],[-.027,.451,.263],[.027,.451,.263],[0,.418,.268]], B.Head, '#dfaf50');
  b.tetra('Comb', [[-.010,.480,.215],[.010,.480,.215],[0,.531,.226],[0,.482,.260]], B.Head, '#b94334');
  b.tetra('Wattle', [[-.013,.425,.255],[.013,.425,.255],[0,.389,.260],[0,.421,.278]], B.Head, '#a53d32');
  b.tetra('Tail', [[-.040,.285,-.165],[.040,.285,-.165],[0,.395,-.330],[0,.235,-.300]], B.Body, '#424d44');
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R', leg = side < 0 ? B.LegL : B.LegR, wing = side < 0 ? B.WingL : B.WingR, x = side * .063;
    b.tetra('Wing'+suffix, [[side*.105,.310,.090],[side*.137,.236,.010],[side*.094,.235,-.135],[side*.098,.315,-.050]], wing, '#754c32');
    b.triPrism('Leg'+suffix, x, .028, .184, leg, '#c3954e');
    b.tetra('Foot'+suffix, [[x-.020,.026,.015],[x+.020,.026,.015],[x,.025,.105],[x,.010,-.045]], leg, '#c3954e');
    b.tetra('Eye'+suffix, [[side*.034,.455,.236],[side*.034,.441,.236],[side*.034,.448,.251],[side*.041,.448,.240]], B.Head, '#292922');
  }
  return b.data;
}

export function buildChickenLod2Mesh(): AnimalMeshData {
  const b = builder(CHICKEN_LOD2_VERSION);
  b.octa('Body', [0,.270,-.020], [.145,.135,.235], B.Body, '#a96a39');
  b.octa('Head', [0,.447,.226], [.056,.058,.058], B.Head, '#d9a05f');
  b.tetra('Beak', [[0,.432,.336],[-.030,.452,.261],[.030,.452,.261],[0,.415,.267]], B.Head, '#dfaf50');
  b.tetra('Comb', [[-.012,.478,.212],[.012,.478,.212],[0,.535,.226],[0,.481,.264]], B.Head, '#b94334');
  b.tetra('Tail', [[-.043,.285,-.165],[.043,.285,-.165],[0,.400,-.340],[0,.230,-.305]], B.Body, '#424d44');
  for (const side of [-1, 1]) {
    const x = side * .063, leg = side < 0 ? B.LegL : B.LegR, suffix = side < 0 ? 'L' : 'R';
    b.tetra('Leg'+suffix, [[x-.015,.030,.010],[x+.015,.030,.010],[x,.190,.000],[x,.025,-.065]], leg, '#c3954e');
  }
  return b.data;
}
