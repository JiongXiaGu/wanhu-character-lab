import { Triangle, Vector3 } from 'three';
import { HorseMeshBuilder, type Section } from '../horse/geometry/builder';
import type { HorseWeight, Point3 } from '../horse/types';
import { weight } from './rig';

export const BUFFALO_MESH_VERSION = 'wanhu-buffalo-mesh-m8-v1';
const COAT = '#535b5b', PALE = '#646967', SHADE = '#434a49', NOSE = '#303b3c', HOOF = '#343b39';
interface SweepSection { p: Point3; u: number; v: number; color?: string }
/** 只供水牛横耳和弯角使用的作者壳：截面随三维切线，不能用两根直锥冒充牛角。 */
function sweep(b: HorseMeshBuilder, part: string, rows: readonly SweepSection[], skin: HorseWeight, color: string) {
  const sides = 8, rings: number[][] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r], before = rows[Math.max(0, r - 1)].p, after = rows[Math.min(rows.length - 1, r + 1)].p;
    const tangent = new Vector3(...after).sub(new Vector3(...before)).normalize();
    const u = new Vector3(0, 0, 1).cross(tangent).normalize(), v = tangent.clone().cross(u).normalize();
    if (u.lengthSq() < .9) throw new Error(`水牛作者截面退化：${part}/${r}`);
    rings.push(Array.from({ length: sides }, (_, i) => {
      const angle = i * Math.PI * 2 / sides;
      return b.vertex(new Vector3(...row.p).addScaledVector(u, Math.cos(angle) * row.u).addScaledVector(v, Math.sin(angle) * row.v).toArray() as Point3, skin);
    }));
  }
  for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < sides; s++) {
    const n = (s + 1) % sides, a = rings[r][s], c = rings[r + 1][s];
    b.triangle(a, rings[r][n], c, rows[r].color ?? color, part);
    b.triangle(rings[r][n], rings[r + 1][n], c, rows[r].color ?? color, part);
  }
  const first = b.vertex(rows[0].p, skin), last = b.vertex(rows.at(-1)!.p, skin);
  for (let s = 0; s < sides; s++) {
    const n = (s + 1) % sides;
    b.triangle(first, rings[0][n], rings[0][s], color, part);
    b.triangle(last, rings.at(-1)![s], rings.at(-1)![n], rows.at(-1)!.color ?? color, part);
  }
}
/** 细节中心投到实际作者三角面上，形成嵌入小壳；不是播放时的贴附或碰撞求解。 */
function detail(b: HorseMeshBuilder, part: string, surface: string, target: Point3, radius: Point3, color: string) {
  const wanted = new Vector3(...target), point = new Vector3(), center = new Vector3(), triangle = new Triangle(); let best = Infinity;
  for (const face of b.data.triangles.filter(face => face.part === surface)) {
    triangle.set(...face.indices.map(i => new Vector3(...b.data.vertices[i].position)) as [Vector3, Vector3, Vector3]);
    triangle.closestPointToPoint(wanted, point); const distance = point.distanceToSquared(wanted);
    if (distance < best) { best = distance; center.copy(point); }
  }
  if (!Number.isFinite(best)) throw new Error(`水牛缺少细节承载面：${surface}`);
  b.gem(part, center.toArray() as Point3, radius, weight('Head'), color);
}
/** 独立水牛作者资源：低长头、横展后弯角和低宽沉腹，不调用其他动物的作者网格。 */
export function buildBuffaloMesh() {
  const b = new HorseMeshBuilder(); b.data.version = BUFFALO_MESH_VERSION;
  b.loft('Body', [
    { p: [0, 1.01, -1.18], width: .14, depth: .16, skin: weight('Pelvis') },
    { p: [0, .93, -1.045], width: .395, depth: .32, skin: weight('Pelvis') },
    { p: [0, .89, -.84], width: .51, depth: .382, skin: weight('Pelvis') },
    { p: [0, .872, -.60], width: .565, depth: .413, skin: weight('Pelvis', 'Spine', .55) },
    { p: [0, .865, -.31], width: .578, depth: .432, skin: weight('Spine') },
    { p: [0, .875, 0], width: .575, depth: .435, skin: weight('Spine') },
    { p: [0, .91, .29], width: .548, depth: .412, skin: weight('Spine', 'Chest', .40) },
    { p: [0, .985, .51], width: .46, depth: .355, skin: weight('Chest') },
    { p: [0, 1.025, .68], width: .325, depth: .285, skin: weight('Chest') },
    { p: [0, 1.02, .79], width: .19, depth: .225, skin: weight('Chest') },
  ], 12, COAT);
  // 只作者化背线，保留低沉腹线；没有整动物非等比缩放。
  for (const vertex of b.data.vertices) if (vertex.position[1] > 1.29) vertex.position[1] = 1.29 + (vertex.position[1] - 1.29) * .30;
  for (const face of b.data.triangles) if (face.indices.reduce((sum, i) => sum + b.data.vertices[i].position[1], 0) / 3 < .68) face.color = PALE;
  b.loft('Neck', [
    { p: [0, 1.04, .58], width: .36, depth: .30, skin: weight('Chest') },
    { p: [0, 1.065, .75], width: .335, depth: .28, skin: weight('Chest', 'NeckBase', .35) },
    { p: [0, 1.105, .915], width: .29, depth: .245, skin: weight('NeckBase', 'Neck', .60) },
    { p: [0, 1.13, 1.03], width: .25, depth: .22, skin: weight('Neck') },
    { p: [0, 1.12, 1.15], width: .20, depth: .18, skin: weight('Neck', 'Head', .30) },
  ], 12, COAT);
  b.loft('Dewlap', [
    { p: [0, .955, .72], width: .135, depth: .125, skin: weight('Chest', 'NeckBase', .75) },
    { p: [0, .83, .87], width: .12, depth: .115, skin: weight('Chest', 'NeckBase', .55) },
    { p: [0, .77, .98], width: .045, depth: .04, skin: weight('Chest', 'NeckBase', .35) },
  ], 8, PALE);
  b.loft('Head', [
    { p: [0, 1.14, 1.055], width: .18, depth: .155, skin: weight('Head') },
    { p: [0, 1.105, 1.19], width: .275, depth: .19, skin: weight('Head') },
    { p: [0, 1.005, 1.34], width: .248, depth: .173, skin: weight('Head') },
    { p: [0, .91, 1.50], width: .23, depth: .145, skin: weight('Head') },
    { p: [0, .835, 1.64], width: .225, depth: .11, skin: weight('Head') },
    { p: [0, .80, 1.695], width: .205, depth: .10, skin: weight('Head') },
  ], 12, COAT);
  b.loft('NoseMirror', [
    { p: [0, .825, 1.643], width: .218, depth: .11, skin: weight('Head') },
    { p: [0, .799, 1.697], width: .211, depth: .098, skin: weight('Head') },
    { p: [0, .788, 1.729], width: .185, depth: .084, skin: weight('Head') },
  ], 12, NOSE);
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'Left' : 'Right';
    // 横展占主导，外段后收再上挑；没有角盾，也不是黄牛角放大。
    sweep(b, `${side}Horn`, [
      { p: [sign * .224, 1.172, 1.175], u: .073, v: .067 },
      { p: [sign * .385, 1.195, 1.151], u: .068, v: .060 },
      { p: [sign * .585, 1.219, 1.08], u: .052, v: .045 },
      { p: [sign * .748, 1.274, .97], u: .037, v: .033 },
      { p: [sign * .840, 1.379, .90], u: .020, v: .018, color: '#8a8576' },
      { p: [sign * .854, 1.457, .922], u: .004, v: .004, color: '#555a52' },
    ], weight('Head'), '#b2aa92');
    sweep(b, `${side}Ear`, [
      { p: [sign * .228, 1.10, 1.18], u: .033, v: .060 },
      { p: [sign * .387, 1.09, 1.195], u: .069, v: .109, color: '#77746c' },
      { p: [sign * .555, 1.035, 1.225], u: .045, v: .095, color: '#77746c' },
      { p: [sign * .608, 1.03, 1.246], u: .009, v: .018 },
    ], weight(`${side}Ear`), COAT);
    detail(b, `${side}Eye`, 'Head', [sign * .25, 1.124, 1.245], [.017, .018, .015], '#222c2b');
    detail(b, `${side}Nostril`, 'NoseMirror', [sign * .155, .821, 1.764], [.020, .010, .008], '#202a2b');
    for (const front of [true, false]) {
      const name = `${front ? 'Front' : 'Back'}${side}`, x = sign * (front ? .375 : .385);
      const upper = `${name}Upper`, middle = `${name}Middle`, lower = `${name}Lower`, foot = `${name}Foot`;
      const rows: Section[] = front ? [
        { p: [x, 1.12, .585], width: .150, depth: .175, skin: weight('Chest', upper, .50) },
        { p: [x, 1.00, .592], width: .140, depth: .160, skin: weight(upper) },
        { p: [x, .78, .606], width: .096, depth: .109, skin: weight(upper) },
        { p: [x, .596, .612], width: .077, depth: .081, skin: weight(upper, middle, .5) },
        { p: [x, .43, .612], width: .065, depth: .071, skin: weight(middle) },
        { p: [x, .29, .612], width: .058, depth: .065, skin: weight(middle) },
        { p: [x, .182, .612], width: .071, depth: .076, skin: weight(middle, lower, .5), color: SHADE },
        { p: [x, .12, .632], width: .075, depth: .081, skin: weight(lower), color: SHADE },
        { p: [x, .09, .65], width: .091, depth: .080, skin: weight(lower, foot, .35), color: SHADE },
      ] : [
        { p: [x, 1.13, -.92], width: .170, depth: .193, skin: weight('Pelvis', upper, .50) },
        { p: [x, 1.015, -.88], width: .158, depth: .178, skin: weight(upper) },
        { p: [x, .86, -.80], width: .133, depth: .145, skin: weight(upper) },
        { p: [x, .74, -.71], width: .101, depth: .116, skin: weight(upper, middle, .5) },
        { p: [x, .535, -.816], width: .086, depth: .094, skin: weight(middle) },
        { p: [x, .323, -.92], width: .073, depth: .081, skin: weight(middle, lower, .5) },
        { p: [x, .22, -.907], width: .062, depth: .069, skin: weight(lower), color: SHADE },
        { p: [x, .13, -.89], width: .073, depth: .080, skin: weight(lower), color: SHADE },
        { p: [x, .09, -.88], width: .094, depth: .082, skin: weight(lower, foot, .35), color: SHADE },
      ];
      b.loft(`${name}Leg`, rows, 8, COAT);
      for (const outer of [false, true]) {
        const hx = x + sign * (outer ? .058 : -.058), z = front ? .653 : -.874;
        b.loft(`${name}${outer ? 'Outer' : 'Inner'}Hoof`, [
          { p: [hx, .138, z - .014], width: .044, depth: .078, skin: weight(foot) },
          { p: [hx, .060, z], width: .051, depth: .113, skin: weight(foot) },
          { p: [hx, .016, z + .004], width: .050, depth: .110, skin: weight(foot) },
        ], 8, HOOF);
      }
    }
  }
  b.loft('TailStem', [
    { p: [0, 1.13, -1.15], width: .030, depth: .030, skin: weight('Tail') },
    { p: [0, .98, -1.23], width: .025, depth: .027, skin: weight('Tail') },
    { p: [0, .77, -1.27], width: .021, depth: .023, skin: weight('Tail', 'TailMiddle', .45) },
    { p: [0, .59, -1.29], width: .018, depth: .020, skin: weight('TailMiddle') },
    { p: [0, .43, -1.30], width: .018, depth: .021, skin: weight('TailMiddle', 'TailEnd', .40) },
    { p: [0, .30, -1.32], width: .019, depth: .022, skin: weight('TailEnd') },
  ], 6, COAT);
  b.loft('TailTuft', [
    { p: [0, .43, -1.30], width: .025, depth: .030, skin: weight('TailEnd') },
    { p: [0, .29, -1.325], width: .058, depth: .060, skin: weight('TailEnd') },
    { p: [0, .215, -1.34], width: .014, depth: .018, skin: weight('TailEnd') },
  ], 8, '#383e3c');
  return b.data;
}
