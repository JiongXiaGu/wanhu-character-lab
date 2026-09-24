import { Ray, Vector3 } from 'three';
import type { AnimalMeshData, LivestockLodId, Point } from '../livestock/types';
import { CAT_BONES as B, CAT_JOINTS, CAT_LEGS, CAT_TAIL_ROOT } from './rig';

export const CAT_MESH_VERSION = 'wanhu-rural-orange-cat-mesh-v1';
const COAT = '#bc864c', CREAM = '#d0b895', SHADE = '#966537', NOSE = '#664438', EYE = '#242b22';
type Section = readonly [z: number, y: number, rx: number, ry: number, sides: number, bone: number, color?: string];

/** 独立猫作者截面：短口鼻、较圆颊部、细腰、完整猫足与长弯尾，不读取犬网格。 */
export function buildCatMesh(lod: LivestockLodId = 'lod0'): AnimalMeshData {
  if (!['lod0', 'lod1', 'lod2'].includes(lod)) throw new Error(`未知猫LOD：${lod}`);
  const data: AnimalMeshData = { positions: [], indices: [], bones: [], colors: [], parts: [], version: `${CAT_MESH_VERSION}/${lod}` };
  const add = (p: Point, bone: number, color = COAT) => {
    const id = data.positions.length; data.positions.push(p); data.bones.push(bone); data.colors.push(color); return id;
  };
  // 连续截面的连接算法只处理本资产拓扑，不生成或缩放其它动物。
  function bridge(a: number[], b: number[]) {
    let i = 0, j = 0;
    while (i < a.length || j < b.length) {
      if (j === b.length || (i < a.length && (i + 1) * b.length <= (j + 1) * a.length)) {
        data.indices.push(a[i % a.length], a[(i + 1) % a.length], b[j % b.length]); i++;
      } else { data.indices.push(a[i % a.length], b[(j + 1) % b.length], b[j % b.length]); j++; }
    }
  }
  const sections: readonly Section[] = lod === 'lod0' ? [
    [-.235, .282, .075, .084, 6, B.Body], [-.160, .290, .107, .105, 8, B.Body],
    [-.030, .284, .099, .094, 8, B.Body], [.095, .292, .091, .105, 8, B.Body],
    [.140, .325, .068, .082, 6, B.Neck], [.178, .373, .079, .075, 6, B.Head],
    [.250, .380, .098, .085, 8, B.Head], [.307, .356, .076, .062, 6, B.Head, CREAM],
    [.342, .342, .032, .026, 4, B.Head, CREAM], [.352, .342, .022, .017, 4, B.Head, NOSE],
  ] : lod === 'lod1' ? [
    [-.160, .290, .107, .105, 6, B.Body], [.095, .292, .091, .105, 6, B.Body],
    [.140, .325, .068, .082, 4, B.Neck], [.190, .375, .087, .080, 4, B.Head],
    [.278, .373, .095, .075, 4, B.Head], [.320, .345, .052, .035, 4, B.Head, CREAM],
    [.352, .342, .022, .017, 3, B.Head, NOSE],
  ] : [
    [-.160, .290, .107, .105, 4, B.Body], [.095, .292, .091, .105, 4, B.Body],
    [.140, .325, .068, .082, 3, B.Neck], [.250, .380, .098, .085, 4, B.Head],
    [.352, .342, .022, .017, 3, B.Head, NOSE],
  ];
  const rings = sections.map(([z, y, rx, ry, n, bone, color = COAT]) => {
    const angles = Array.from({ length: n }, (_, i) => Math.PI / 2 - (bone === B.Body ? Math.PI / n : 0) + i * 2 * Math.PI / n);
    const sx = Math.max(...angles.map(a => Math.abs(Math.cos(a)))), sy = Math.max(...angles.map(a => Math.abs(Math.sin(a))));
    return angles.map(a => add([rx * Math.cos(a) / sx, y + ry * Math.sin(a) / sy, z], bone, color === COAT && Math.sin(a) < -.35 ? CREAM : color));
  });
  rings.slice(1).forEach((ring, i) => bridge(rings[i], ring));
  const rear = add([0, .280, -.270], B.Body), first = rings[0], last = rings.at(-1)!;
  first.forEach((id, i) => data.indices.push(rear, first[(i + 1) % first.length], id));
  for (let i = 1; i < last.length - 1; i++) data.indices.push(last[0], last[i], last[i + 1]);
  data.parts.push({ name: 'BodyNeckHeadMuzzle', start: 0, count: data.positions.length });

  function solid(name: string, points: Point[], faces: number[][], bone: number, color = COAT) {
    const start = data.positions.length, center = points.reduce((sum, p) => sum.add(new Vector3(...p)), new Vector3()).divideScalar(points.length);
    points.forEach(p => add(p, bone, color));
    for (const face of faces) for (let j = 1; j < face.length - 1; j++) {
      const ids = [face[0], face[j], face[j + 1]], [a, b, c] = ids.map(i => new Vector3(...points[i]));
      if (b.sub(a).cross(c.sub(a)).dot(a.clone().sub(center)) < 0) [ids[1], ids[2]] = [ids[2], ids[1]];
      data.indices.push(...ids.map(i => start + i));
    }
    data.parts.push({ name, start, count: points.length }); return start;
  }
  const tetra = [[0, 1, 2], [0, 3, 1], [1, 3, 2], [2, 3, 0]];
  const prism = [[0, 1, 2], [3, 5, 4], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]];
  for (const bone of CAT_LEGS) {
    const side = Math.sign(CAT_JOINTS[bone].position[0]), front = bone <= B.FrontLegR;
    const top = front ? [.045, .307, .075, .018, .020] : [.048, .308, -.143, .020, .022];
    const middle = front ? [.074, .140, .104, .017, .019] : [.080, .143, -.180, .023, .027];
    const sole = front ? [.074, .006, .120, .026, .031] : [.080, .006, -.175, .026, .032];
    const rows = lod === 'lod0' || (lod === 'lod1' && !front) ? [top, middle, sole] : [top, sole];
    const n = lod === 'lod0' || (lod === 'lod1' && front) ? 4 : 3, start = data.positions.length;
    const shape = n === 4 ? [[1, 1], [-1, 1], [-1, -1], [1, -1]] : [[0, 1], [-1, -1], [1, -1]];
    const legRings = rows.map(([x, y, z, rx, rz]) => shape.map(([u, v]) => add([side * x + rx * u, y, z + rz * v], bone, y < .01 ? CREAM : COAT)));
    for (let r = 1; r < legRings.length; r++) bridge(legRings[r - 1], legRings[r]);
    const a = legRings[0], b = legRings.at(-1)!;
    for (let i = 1; i < n - 1; i++) { data.indices.push(a[0], a[i + 1], a[i]); data.indices.push(b[0], b[i], b[i + 1]); }
    data.parts.push({ name: CAT_JOINTS[bone].name, start, count: data.positions.length - start });
  }

  // 眼根从实际头面求交；小型深色闭合眼体，不使用白眼圈或透明贴片。
  const headFaces: number[][] = [];
  for (let i = 0; i < data.indices.length; i += 3) {
    const ids = data.indices.slice(i, i + 3);
    if (ids.every(id => id < data.parts[0].count && data.bones[id] === B.Head)) headFaces.push(ids);
  }
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    if (lod === 'lod0') {
      const base: Point[] = [[side * .028, .418, .213], [side * .079, .413, .258], [side * .084, .497, .211]];
      const start = solid(`Ear${suffix}`, [...base, ...base.map(([x, y, z]) => [x, y, z - .022] as Point)], prism, B.Head);
      data.colors[start + 2] = SHADE; data.colors[start + 5] = SHADE;
    } else solid(`Ear${suffix}`, [[side * .025, .413, .227], [side * .057, .401, .252], [side * .037, .411, .194], [side * .084, .497, .211]], tetra, B.Head, SHADE);
    if (lod === 'lod2') continue;
    const ray = new Ray(new Vector3(side * .3, .390, .285), new Vector3(-side, 0, 0));
    let distance = Infinity, contact = new Vector3(), normal = new Vector3();
    for (const ids of headFaces) {
      const [a, b, c] = ids.map(i => new Vector3(...data.positions[i])), hit = new Vector3();
      if (ray.intersectTriangle(a, b, c, true, hit) && hit.distanceToSquared(ray.origin) < distance) {
        distance = hit.distanceToSquared(ray.origin); contact = hit.clone(); normal = b.sub(a).cross(c.sub(a)).normalize();
      }
    }
    if (!Number.isFinite(distance)) throw new Error('猫眼缺少实际头面');
    const up = new Vector3(0, 1, 0).addScaledVector(normal, -normal.y).normalize(), forward = new Vector3().crossVectors(normal, up).normalize();
    const point = (u: number, v: number, h: number) => contact.clone().addScaledVector(forward, u).addScaledVector(up, v).addScaledVector(normal, h).toArray() as Point;
    if (lod === 'lod0') {
      const faces: number[][] = [];
      for (let i = 0; i < 4; i++) { const a = 1 + i, b = 1 + (i + 1) % 4; faces.push([0, b, a], [5, a, b]); }
      solid(`Eye${suffix}`, [point(0, 0, -.004), point(-.014, 0, 0), point(0, -.010, 0), point(.014, 0, 0), point(0, .010, 0), point(0, 0, .003)], faces, B.Head, EYE);
    } else solid(`Eye${suffix}`, [point(0, 0, -.004), point(-.014, -.005, .001), point(.014, -.005, .001), point(0, .010, .002)], tetra, B.Head, EYE);
  }
  // 三档都保留长尾的弯折轮廓；单根Tail骨，只做小幅摆动与整尾放松。
  const start = data.positions.length;
  const tailRows = lod === 'lod0' ? [[.335, -.255, .021], [.413, -.315, .020], [.510, -.330, .016], [.543, -.280, .011]] :
    lod === 'lod1' ? [[.335, -.255, .021], [.470, -.330, .018], [.543, -.280, .011]] : [[.360, -.270, .019], [.530, -.318, .014]];
  const tip: Point = [0, .527, -.249];
  const tailRings = tailRows.map(([y, z, r], k) => {
    const previous = k ? new Vector3(0, tailRows[k - 1][0], tailRows[k - 1][1]) : new Vector3(...CAT_TAIL_ROOT);
    const next = k < tailRows.length - 1 ? new Vector3(0, tailRows[k + 1][0], tailRows[k + 1][1]) : new Vector3(...tip);
    const tangent = next.sub(previous).normalize(), u = new Vector3(1, 0, 0), v = tangent.clone().cross(u).normalize();
    return Array.from({ length: 3 }, (_, i) => {
      const a = Math.PI / 2 + i * Math.PI * 2 / 3;
      return add(new Vector3(0, y, z).addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r).toArray(), B.Tail, k === tailRows.length - 1 ? SHADE : COAT);
    });
  });
  tailRings.slice(1).forEach((ring, i) => bridge(tailRings[i], ring));
  const rootId = add(CAT_TAIL_ROOT, B.Tail), tipId = add(tip, B.Tail, SHADE);
  for (let i = 0; i < 3; i++) { data.indices.push(rootId, tailRings[0][(i + 1) % 3], tailRings[0][i]); const end = tailRings.at(-1)!; data.indices.push(tipId, end[i], end[(i + 1) % 3]); }
  data.parts.push({ name: 'Tail', start, count: data.positions.length - start });
  return data;
}
