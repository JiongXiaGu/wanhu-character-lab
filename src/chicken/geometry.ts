import { Vector3 } from 'three';
import type { AnimalMeshData, Point } from '../livestock/types';
import { CHICKEN_BONES as B, FOOT_POINTS } from './rig';

export const CHICKEN_MESH_VERSION = 'wanhu-chicken-mesh-v3';
/** 140 tris / 100逻辑点；13个闭合体壳 + 两片零厚度身体侧面翅，每侧正反共4面。 */
export function buildChickenMesh(): AnimalMeshData {
  const data: AnimalMeshData = { positions: [], indices: [], bones: [], colors: [], parts: [], version: CHICKEN_MESH_VERSION };
  const tetra = [[0, 1, 2], [0, 3, 1], [1, 3, 2], [2, 3, 0]];
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
  function rings(name: string, rows: Point[][], bone: number, color: string) {
    const n = rows[0].length, faces: number[][] = [Array.from({ length: n }, (_, i) => i)];
    for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < n; i++) faces.push([r * n + i, r * n + (i + 1) % n, (r + 1) * n + (i + 1) % n, (r + 1) * n + i]);
    faces.push(Array.from({ length: n }, (_, i) => (rows.length - 1) * n + i));
    part(name, rows.flat(), faces, bone, color);
  }
  function prism(name: string, halfWidth: number, yz: [number, number][], bone: number, color: string) {
    const p: Point[] = [-halfWidth, halfWidth].flatMap(x => yz.map(([y, z]) => [x, y, z] as Point));
    part(name, p, [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]], bone, color);
  }
  function wing(side: number, suffix: string, bone: number) {
    const start = data.positions.length;
    // 短而收拢的小叶片；贴在身体中侧部，法线以左右方向为主，不放到背顶。
    // 四点沿原Body侧面留约4mm视觉层次，避免深度冲突，但不形成实体厚度。
    const points: Point[] = [[side*.1082,.295,.060],[side*.1117,.265,-.005],[side*.1158,.245,-.080],[side*.1125,.280,-.020]];
    data.positions.push(...points); data.bones.push(...points.map(() => bone)); data.colors.push(...points.map(() => '#865333'));
    for (const face of [[0,1,3],[1,2,3]]) {
      const [a,b,c] = side > 0 ? face : [face[0],face[2],face[1]];
      // 反向索引复用同一组位置，厚度严格为0；硬边展开分别生成正反法线。
      data.indices.push(start+a,start+b,start+c,start+a,start+c,start+b);
    }
    data.parts.push({ name: 'Wing'+suffix, start, count: points.length });
  }
  const bodyRows = [[-.185, .245, .055, .060], [-.095, .250, .130, .108], [.065, .270, .120, .130], [.160, .300, .058, .075]];
  rings('Body', bodyRows.map(([z, y, rx, ry]) => Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 6 + i * Math.PI / 3; return [Math.cos(a) * rx, y + Math.sin(a) * ry, z] as Point;
  })), B.Body, '#aa6b39');
  rings('Neck', [[.285, .125, .048, .045], [.415, .211, .034, .035]].map(([y, z, rx, rz]) => Array.from({ length: 4 }, (_, i) => {
    const a = Math.PI / 4 + i * Math.PI / 2; return [Math.cos(a) * rx, y, z + Math.sin(a) * rz] as Point;
  })), B.Neck, '#d59c59');
  rings('Head', [[.175, .442, .039, .043], [.225, .444, .052, .052], [.268, .435, .032, .033]].map(([z, y, rx, ry]) => Array.from({ length: 4 }, (_, i) => {
    const a = Math.PI / 4 + i * Math.PI / 2; return [Math.cos(a) * rx, y + Math.sin(a) * ry, z] as Point;
  })), B.Head, '#dba564');
  part('Beak', [[0, .434, .333], [-.026, .450, .262], [.026, .450, .262], [0, .419, .266]], tetra, B.Head, '#dfaf50');
  prism('Comb', .009, [[.480, .207], [.480, .256], [.531, .225]], B.Head, '#b94334');
  part('Wattle', [[-.013, .424, .255], [.013, .424, .255], [0, .389, .260], [0, .420, .277]], tetra, B.Head, '#a53d32');
  prism('Tail', .039, [[.235, -.175], [.392, -.245], [.355, -.335]], B.Body, '#424d44');
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R', leg = side < 0 ? B.LegL : B.LegR, wingBone = side < 0 ? B.WingL : B.WingR, x = side * .063;
    wing(side, suffix, wingBone);
    rings('Leg' + suffix, [.022, .184].map(y => Array.from({ length: 3 }, (_, i) => [x + Math.cos(i * Math.PI * 2 / 3) * .013, y, Math.sin(i * Math.PI * 2 / 3) * .013] as Point)), leg, '#c3954e');
    part('Foot' + suffix, FOOT_POINTS.map(([px, py, pz]) => [px + x, py, pz] as Point), tetra, leg, '#c3954e');
    // 浅闭合眼壳嵌入头侧；不另建球体或悬浮黑点。
    part('Eye' + suffix, [[side * .034, .455, .236], [side * .034, .441, .236], [side * .034, .448, .251], [side * .041, .448, .240]], tetra, B.Head, '#292922');
  }
  return data;
}
