import { Triangle, Vector3 } from 'three';
import { HorseMeshBuilder, type Section } from '../horse/geometry/builder';
import type { HorseWeight, Point3 } from '../horse/types';
import { weight } from './rig';

export const YAK_MESH_VERSION = 'wanhu-yak-mesh-m7-v1';
const COAT = '#3e3934', BACK = '#494139', SHADE = '#302e2b', NOSE = '#5a534c', HOOF = '#645b4e';
/** Body自身包含肩峰和左右长毛下摆；这些额外小壳只是胸毛、额毛、面侧毛与蓬尾。 */
export const YAK_FUR_PARTS = ['ChestFur', 'Forelock', 'LeftCheekFur', 'RightCheekFur', 'TailPlume'] as const;

interface MantleRow { z: number; w: number; top: number; side: number; hem: number; belly: number; skin: HorseWeight }
/** 牦牛专属连续毛披轮廓。横截面凹腹、两侧落毛，绝非桶身外另套一层壳。 */
function mantle(b: HorseMeshBuilder) {
  const values = [
    [-1.05, .12, 1.12, .98, .75, .89], [-.96, .32, 1.21, .93, .54, .65],
    [-.80, .435, 1.27, .94, .405, .61], [-.60, .47, 1.30, .98, .315, .60],
    [-.36, .49, 1.325, .97, .345, .60], [-.14, .50, 1.34, .99, .30, .60],
    [.08, .53, 1.39, 1.04, .325, .605], [.30, .56, 1.46, 1.08, .335, .625],
    [.48, .535, 1.485, 1.06, .38, .66], [.64, .36, 1.35, 1.00, .495, .73],
    [.76, .18, 1.23, .99, .78, .88],
  ];
  const rows: MantleRow[] = values.map(([z, w, top, side, hem, belly]) => ({ z, w, top, side, hem, belly,
    skin: z <= -.60 ? weight('Pelvis') : z < -.14 ? weight('Pelvis', 'Spine', (-.14 - z) / .46) : z < .48 ? weight('Spine', 'Chest', (.48 - z) / .62) : weight('Chest'),
  }));
  const rings = rows.map(r => {
    const h = r.top - r.side;
    const xy = [[r.w, r.side], [.90 * r.w, r.side + h * .55], [.68 * r.w, r.side + h * .86], [.35 * r.w, r.side + h * .98],
      [0, r.top], [-.35 * r.w, r.side + h * .98], [-.68 * r.w, r.side + h * .86], [-.90 * r.w, r.side + h * .55],
      [-r.w, r.side], [-1.025 * r.w, (r.side + r.hem) * .5], [-.90 * r.w, r.hem], [-.60 * r.w, r.hem + .06],
      [0, r.belly], [.60 * r.w, r.hem + .06], [.90 * r.w, r.hem], [1.025 * r.w, (r.side + r.hem) * .5]];
    return xy.map(([x, y]) => b.vertex([x, y, r.z], r.skin));
  });
  for (let r = 0; r < rows.length - 1; r++) for (let s = 0; s < 16; s++) {
    const n = (s + 1) % 16, a = rings[r][s], c = rings[r + 1][s], d = rings[r + 1][n], e = rings[r][n];
    const tint = s >= 9 && s <= 14 ? (r % 2 ? COAT : SHADE) : s >= 1 && s <= 6 ? BACK : COAT;
    // 左右对称剖分，避免一侧长毛的蒙皮插值比另一侧更硬。
    if (s < 4 || s >= 12) { b.triangle(a, e, c, tint, 'Body'); b.triangle(e, d, c, tint, 'Body'); }
    else { b.triangle(a, e, d, tint, 'Body'); b.triangle(a, d, c, tint, 'Body'); }
  }
  const first = b.vertex([0, (rows[0].top + rows[0].belly) / 2, rows[0].z], rows[0].skin);
  const lastRow = rows.at(-1)!, last = b.vertex([0, (lastRow.top + lastRow.belly) / 2, lastRow.z], lastRow.skin);
  for (let s = 0; s < 16; s++) {
    b.triangle(first, rings[0][(s + 1) % 16], rings[0][s], COAT, 'Body');
    b.triangle(last, rings.at(-1)![s], rings.at(-1)![(s + 1) % 16], COAT, 'Body');
  }
}
interface HornSection { p: Point3; u: number; v: number; color?: string }
/** 横向外展再上弯，随三维切线制作闭合角／小耳；根部与头壳有明确嵌合。 */
function sweep(b: HorseMeshBuilder, part: string, rows: HornSection[], skin: HorseWeight, color: string) {
  const sides = 8;
  const rings = rows.map((row, r) => {
    const tangent = new Vector3(...rows[Math.min(r + 1, rows.length - 1)].p).sub(new Vector3(...rows[Math.max(r - 1, 0)].p)).normalize();
    const u = new Vector3(0, 0, 1).cross(tangent).normalize(), v = tangent.clone().cross(u).normalize();
    if (u.lengthSq() < .9) throw new Error(`牦牛作者截面退化：${part}/${r}`);
    return Array.from({ length: sides }, (_, s) => b.vertex(new Vector3(...row.p).addScaledVector(u, Math.cos(s * Math.PI / 4) * row.u).addScaledVector(v, Math.sin(s * Math.PI / 4) * row.v).toArray() as Point3, skin));
  });
  for (let r = 0; r < rows.length - 1; r++) for (let s = 0; s < sides; s++) {
    const n = (s + 1) % sides, tint = rows[r].color ?? color;
    b.triangle(rings[r][s], rings[r][n], rings[r + 1][s], tint, part);
    b.triangle(rings[r][n], rings[r + 1][n], rings[r + 1][s], tint, part);
  }
  const first = b.vertex(rows[0].p, skin), last = b.vertex(rows.at(-1)!.p, skin);
  for (let s = 0; s < sides; s++) {
    const n = (s + 1) % sides;
    b.triangle(first, rings[0][n], rings[0][s], color, part);
    b.triangle(last, rings.at(-1)![s], rings.at(-1)![n], rows.at(-1)!.color ?? color, part);
  }
}
function detail(b: HorseMeshBuilder, part: string, surface: string, target: Point3, radius: Point3, color: string) {
  const wanted = new Vector3(...target), point = new Vector3(), center = new Vector3(), triangle = new Triangle(); let best = Infinity;
  for (const face of b.data.triangles.filter(f => f.part === surface)) {
    triangle.set(...face.indices.map(i => new Vector3(...b.data.vertices[i].position)) as [Vector3, Vector3, Vector3]);
    triangle.closestPointToPoint(wanted, point); const distance = point.distanceToSquared(wanted);
    if (distance < best) { best = distance; center.copy(point); }
  }
  if (!Number.isFinite(best)) throw new Error(`牦牛缺少细节承载面：${surface}`);
  b.gem(part, center.toArray() as Point3, radius, weight('Head'), color);
}
/** 作者值全部归牦牛所有，只复用低模壳连接工具；不读取其它物种的模型或骨架。 */
export function buildYakMesh() {
  const b = new HorseMeshBuilder(); b.data.version = YAK_MESH_VERSION; mantle(b);
  b.loft('Neck', [
    { p: [0, 1.13, .55], width: .34, depth: .29, skin: weight('Chest') },
    { p: [0, 1.13, .74], width: .32, depth: .27, skin: weight('Chest', 'NeckBase', .3) },
    { p: [0, 1.17, .90], width: .285, depth: .24, skin: weight('NeckBase', 'Neck', .5) },
    { p: [0, 1.23, 1.065], width: .22, depth: .20, skin: weight('Neck', 'Head', .4) },
  ], 12, COAT);
  b.loft('ChestFur', [
    { p: [0, 1.20, .69], width: .31, depth: .24, skin: weight('Chest', 'NeckBase', .85) },
    { p: [0, .97, .83], width: .33, depth: .24, skin: weight('Chest', 'NeckBase', .80) },
    { p: [0, .67, .94], width: .235, depth: .165, skin: weight('Chest', 'NeckBase', .70) },
    { p: [0, .39, .99], width: .13, depth: .08, skin: weight('Chest', 'NeckBase', .65) },
    { p: [0, .335, .995], width: .065, depth: .028, skin: weight('Chest', 'NeckBase', .65) },
  ], 10, SHADE);
  b.loft('Head', [
    { p: [0, 1.265, 1.01], width: .15, depth: .14, skin: weight('Head') },
    { p: [0, 1.225, 1.145], width: .255, depth: .20, skin: weight('Head') },
    { p: [0, 1.10, 1.29], width: .24, depth: .17, skin: weight('Head') },
    { p: [0, .97, 1.415], width: .215, depth: .135, skin: weight('Head') },
    { p: [0, .88, 1.51], width: .193, depth: .105, skin: weight('Head') },
    { p: [0, .86, 1.55], width: .18, depth: .095, skin: weight('Head') },
  ], 12, COAT);
  b.loft('NoseMirror', [
    { p: [0, .878, 1.512], width: .192, depth: .105, skin: weight('Head') },
    { p: [0, .846, 1.57], width: .18, depth: .095, skin: weight('Head') },
  ], 12, NOSE);
  b.loft('Forelock', [
    { p: [0, 1.36, 1.10], width: .21, depth: .085, skin: weight('Head') },
    { p: [0, 1.30, 1.22], width: .245, depth: .095, skin: weight('Head', 'Forelock', .65) },
    { p: [0, 1.18, 1.31], width: .18, depth: .07, skin: weight('Head', 'Forelock', .35) },
    { p: [0, 1.145, 1.32], width: .12, depth: .018, skin: weight('Forelock') },
  ], 10, SHADE);
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'Left' : 'Right';
    sweep(b, `${side}Horn`, [
      { p: [sign * .195, 1.305, 1.09], u: .065, v: .061 },
      { p: [sign * .36, 1.32, 1.00], u: .060, v: .055 },
      { p: [sign * .51, 1.365, .965], u: .045, v: .041 },
      { p: [sign * .61, 1.46, .975], u: .030, v: .026, color: '#a3987e' },
      { p: [sign * .65, 1.58, 1.01], u: .014, v: .012, color: '#776f5f' },
      { p: [sign * .64, 1.67, 1.065], u: .004, v: .004, color: '#4a4840' },
    ], weight('Head'), '#c0b497');
    sweep(b, `${side}Ear`, [
      { p: [sign * .21, 1.235, 1.14], u: .032, v: .041 },
      { p: [sign * .325, 1.26, 1.13], u: .042, v: .068 },
      { p: [sign * .40, 1.21, 1.17], u: .009, v: .015 },
    ], weight(`${side}Ear`), '#51483e');
    b.loft(`${side}CheekFur`, [
      { p: [sign * .20, 1.28, 1.11], width: .065, depth: .085, skin: weight('Head') },
      { p: [sign * .25, 1.17, 1.16], width: .09, depth: .12, skin: weight('Head') },
      { p: [sign * .27, 1.02, 1.235], width: .055, depth: .065, skin: weight('Head') },
      { p: [sign * .255, .98, 1.255], width: .016, depth: .021, skin: weight('Head') },
    ], 8, COAT);
    detail(b, `${side}Eye`, 'Head', [sign * .23, 1.24, 1.24], [.016, .018, .014], '#111712');
    detail(b, `${side}Nostril`, 'NoseMirror', [sign * .13, .88, 1.604], [.016, .010, .007], '#202721');
    for (const front of [true, false]) {
      const name = `${front ? 'Front' : 'Back'}${side}`, x = sign * (front ? .38 : .37);
      const upper = `${name}Upper`, middle = `${name}Middle`, lower = `${name}Lower`, foot = `${name}Foot`;
      // 毛量直接来自腿的作者截面，膝／飞节／下腿仍保留承重方向；不在外面悬挂碎毛片。
      const rows: Section[] = front ? [
        { p: [x, 1.14, .48], width: .18, depth: .20, skin: weight('Chest', upper, .55) },
        { p: [x, 1.02, .50], width: .165, depth: .185, skin: weight(upper) },
        { p: [x, .81, .52], width: .135, depth: .15, skin: weight(upper) },
        { p: [x, .585, .53], width: .108, depth: .12, skin: weight(upper, middle, .5) },
        { p: [x, .43, .53], width: .102, depth: .11, skin: weight(middle) },
        { p: [x, .30, .53], width: .073, depth: .077, skin: weight(middle) },
        { p: [x, .185, .53], width: .072, depth: .074, skin: weight(middle, lower, .5) },
        { p: [x, .09, .558], width: .095, depth: .08, skin: weight(lower, foot, .35) },
      ] : [
        { p: [x, 1.13, -.79], width: .18, depth: .21, skin: weight('Pelvis', upper, .5) },
        { p: [x, 1.01, -.76], width: .17, depth: .19, skin: weight(upper) },
        { p: [x, .85, -.65], width: .145, depth: .16, skin: weight(upper) },
        { p: [x, .73, -.57], width: .12, depth: .125, skin: weight(upper, middle, .5) },
        { p: [x, .52, -.675], width: .103, depth: .112, skin: weight(middle) },
        { p: [x, .33, -.78], width: .080, depth: .085, skin: weight(middle, lower, .5) },
        { p: [x, .18, -.77], width: .07, depth: .075, skin: weight(lower) },
        { p: [x, .09, -.76], width: .095, depth: .08, skin: weight(lower, foot, .35) },
      ];
      b.loft(`${name}Leg`, rows, 8, COAT);
      for (const outer of [false, true]) {
        const hx = x + sign * (outer ? .056 : -.056), z = front ? .565 : -.75;
        b.loft(`${name}${outer ? 'Outer' : 'Inner'}Hoof`, [
          { p: [hx, .132, z - .018], width: .042, depth: .075, skin: weight(foot) },
          { p: [hx, .057, z], width: .048, depth: .104, skin: weight(foot) },
          { p: [hx, .015, z + .004], width: .047, depth: .102, skin: weight(foot) },
        ], 8, HOOF);
      }
    }
  }
  b.loft('TailStem', [
    { p: [0, 1.18, -.985], width: .06, depth: .06, skin: weight('Tail') },
    { p: [0, 1.04, -1.115], width: .045, depth: .05, skin: weight('Tail') },
    { p: [0, .85, -1.185], width: .048, depth: .054, skin: weight('Tail', 'TailMiddle', .45) },
    { p: [0, .65, -1.22], width: .04, depth: .045, skin: weight('TailMiddle', 'TailEnd', .5) },
  ], 8, COAT);
  b.loft('TailPlume', [
    { p: [0, .99, -1.14], width: .062, depth: .066, skin: weight('Tail', 'TailMiddle', .65) },
    { p: [0, .82, -1.205], width: .13, depth: .14, skin: weight('TailMiddle') },
    { p: [0, .57, -1.245], width: .16, depth: .16, skin: weight('TailMiddle', 'TailEnd', .5) },
    { p: [0, .37, -1.26], width: .095, depth: .09, skin: weight('TailEnd') },
    { p: [0, .305, -1.255], width: .035, depth: .03, skin: weight('TailEnd') },
  ], 10, SHADE);
  return b.data;
}
