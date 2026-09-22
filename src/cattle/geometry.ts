import { Triangle, Vector3 } from 'three';
import { HorseMeshBuilder, type Section } from '../horse/geometry/builder';
import type { HorseWeight, Point3 } from '../horse/types';
import { weight } from './rig';

export const CATTLE_MESH_VERSION = 'wanhu-cattle-mesh-m6-v2';
const COAT = '#b88c50', PALE = '#c8aa76', SHADE = '#987342', NOSE = '#4d493c', HOOF = '#454035';
interface SweepSection { p: Point3; u: number; v: number; color?: string }
/** 只供黄牛横耳和弯角使用的作者壳：截面随三维切线，不能用两根直锥冒充牛角。 */
function sweep(b: HorseMeshBuilder, part: string, rows: readonly SweepSection[], skin: HorseWeight, color: string) {
  const sides = 8, rings: number[][] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r], before = rows[Math.max(0, r - 1)].p, after = rows[Math.min(rows.length - 1, r + 1)].p;
    const tangent = new Vector3(...after).sub(new Vector3(...before)).normalize();
    const u = new Vector3(0, 0, 1).cross(tangent).normalize(), v = tangent.clone().cross(u).normalize();
    if (u.lengthSq() < .9) throw new Error(`黄牛作者截面退化：${part}/${r}`);
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
  if (!Number.isFinite(best)) throw new Error(`黄牛缺少细节承载面：${surface}`);
  b.gem(part, center.toArray() as Point3, radius, weight('Head'), color);
}
/** 独立黄牛作者截面，不读取或缩放任何马、驴、骆驼网格。 */
export function buildCattleMesh() {
  const b = new HorseMeshBuilder(); b.data.version = CATTLE_MESH_VERSION;
  b.loft('Body', [
    { p: [0, 1.095, -.96], width: .10, depth: .12, skin: weight('Pelvis') },
    { p: [0, 1.035, -.82], width: .34, depth: .33, skin: weight('Pelvis') },
    { p: [0, 1.025, -.62], width: .43, depth: .395, skin: weight('Pelvis') },
    { p: [0, 1.00, -.33], width: .475, depth: .415, skin: weight('Pelvis', 'Spine', .40) },
    { p: [0, .995, .04], width: .485, depth: .425, skin: weight('Spine') },
    { p: [0, 1.04, .32], width: .455, depth: .425, skin: weight('Spine', 'Chest', .40) },
    { p: [0, 1.105, .51], width: .345, depth: .34, skin: weight('Chest') },
    { p: [0, 1.145, .63], width: .16, depth: .205, skin: weight('Chest') },
  ], 12, COAT);
  // 桶状腹部保留；只压平背线，不把整个动物作非等比缩放。
  for (const vertex of b.data.vertices) if (vertex.position[1] > 1.36) vertex.position[1] = 1.36 + (vertex.position[1] - 1.36) * .45;
  for (const face of b.data.triangles) if (face.indices.reduce((sum, i) => sum + b.data.vertices[i].position[1], 0) / 3 < .78) face.color = PALE;
  b.loft('Neck', [
    { p: [0, 1.16, .43], width: .29, depth: .30, skin: weight('Chest') },
    { p: [0, 1.22, .59], width: .28, depth: .285, skin: weight('Chest', 'NeckBase', .35) },
    { p: [0, 1.285, .73], width: .245, depth: .245, skin: weight('NeckBase', 'Neck', .60) },
    { p: [0, 1.36, .87], width: .205, depth: .21, skin: weight('Neck') },
    { p: [0, 1.425, .965], width: .17, depth: .175, skin: weight('Neck', 'Head', .30) },
  ], 12, COAT);
  b.loft('Dewlap', [
    { p: [0, 1.17, .59], width: .10, depth: .18, skin: weight('Chest', 'NeckBase', .75) },
    { p: [0, 1.045, .75], width: .095, depth: .19, skin: weight('Chest', 'NeckBase', .65) },
    { p: [0, .905, .875], width: .06, depth: .115, skin: weight('Chest', 'NeckBase', .45) },
    { p: [0, .86, .935], width: .025, depth: .045, skin: weight('Chest', 'NeckBase', .35) },
  ], 8, PALE);
  b.loft('Head', [
    { p: [0, 1.46, .94], width: .135, depth: .14, skin: weight('Head') },
    { p: [0, 1.42, 1.07], width: .235, depth: .19, skin: weight('Head') },
    { p: [0, 1.32, 1.19], width: .215, depth: .165, skin: weight('Head') },
    { p: [0, 1.22, 1.30], width: .195, depth: .14, skin: weight('Head') },
    { p: [0, 1.125, 1.405], width: .178, depth: .105, skin: weight('Head'), color: PALE },
    { p: [0, 1.09, 1.445], width: .16, depth: .095, skin: weight('Head'), color: PALE },
  ], 12, COAT);
  b.loft('NoseMirror', [
    { p: [0, 1.105, 1.409], width: .175, depth: .105, skin: weight('Head') },
    { p: [0, 1.075, 1.461], width: .164, depth: .095, skin: weight('Head') },
  ], 12, NOSE);
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'Left' : 'Right';
    sweep(b, `${side}Horn`, [
      { p: [sign * .17, 1.48, .985], u: .064, v: .061 },
      { p: [sign * .29, 1.505, .965], u: .055, v: .052 },
      { p: [sign * .38, 1.565, .96], u: .039, v: .037 },
      { p: [sign * .43, 1.665, .98], u: .020, v: .018, color: '#77715a' },
      { p: [sign * .435, 1.73, 1.01], u: .004, v: .004, color: '#47483e' },
    ], weight('Head'), '#b7a77d');
    sweep(b, `${side}Ear`, [
      { p: [sign * .19, 1.40, 1.025], u: .032, v: .04 },
      { p: [sign * .32, 1.42, 1.015], u: .057, v: .085 },
      { p: [sign * .465, 1.36, 1.045], u: .041, v: .074, color: PALE },
      { p: [sign * .515, 1.345, 1.06], u: .008, v: .012 },
    ], weight(`${side}Ear`), COAT);
    detail(b, `${side}Eye`, 'Head', [sign * .214, 1.438, 1.113], [.015, .018, .015], '#262b23');
    detail(b, `${side}Nostril`, 'NoseMirror', [sign * .118, 1.10, 1.493], [.016, .010, .007], '#252b25');
    for (const front of [true, false]) {
      const name = `${front ? 'Front' : 'Back'}${side}`, x = sign * (front ? .31 : .32);
      const upper = `${name}Upper`, middle = `${name}Middle`, lower = `${name}Lower`, foot = `${name}Foot`;
      const rows: Section[] = front ? [
        { p: [x, 1.22, .47], width: .135, depth: .16, skin: weight('Chest', upper, .50) },
        { p: [x, 1.09, .48], width: .125, depth: .14, skin: weight(upper) },
        { p: [x, .86, .50], width: .089, depth: .098, skin: weight(upper) },
        { p: [x, .64, .515], width: .070, depth: .074, skin: weight(upper, middle, .5) },
        { p: [x, .49, .515], width: .059, depth: .064, skin: weight(middle) },
        { p: [x, .30, .515], width: .052, depth: .060, skin: weight(middle) },
        { p: [x, .185, .515], width: .064, depth: .069, skin: weight(middle, lower, .5), color: SHADE },
        { p: [x, .12, .535], width: .069, depth: .075, skin: weight(lower), color: SHADE },
        { p: [x, .087, .555], width: .083, depth: .073, skin: weight(lower, foot, .35), color: SHADE },
      ] : [
        { p: [x, 1.21, -.70], width: .15, depth: .18, skin: weight('Pelvis', upper, .50) },
        { p: [x, 1.095, -.68], width: .145, depth: .16, skin: weight(upper) },
        { p: [x, .94, -.59], width: .12, depth: .135, skin: weight(upper) },
        { p: [x, .79, -.51], width: .091, depth: .10, skin: weight(upper, middle, .5) },
        { p: [x, .58, -.62], width: .077, depth: .089, skin: weight(middle) },
        { p: [x, .365, -.73], width: .065, depth: .074, skin: weight(middle, lower, .5) },
        { p: [x, .23, -.72], width: .055, depth: .060, skin: weight(lower), color: SHADE },
        { p: [x, .13, -.70], width: .066, depth: .07, skin: weight(lower), color: SHADE },
        { p: [x, .087, -.69], width: .083, depth: .074, skin: weight(lower, foot, .35), color: SHADE },
      ];
      b.loft(`${name}Leg`, rows, 8, COAT);
      // 每个Foot下两个独立闭合趾壳，沿X保留真实分趾缝，不画一条黑线冒充偶蹄。
      for (const outer of [false, true]) {
        const hx = x + sign * (outer ? .052 : -.052), z = front ? .565 : -.68;
        b.loft(`${name}${outer ? 'Outer' : 'Inner'}Hoof`, [
          { p: [hx, .132, z - .018], width: .039, depth: .073, skin: weight(foot) },
          { p: [hx, .057, z], width: .046, depth: .102, skin: weight(foot) },
          { p: [hx, .015, z + .004], width: .045, depth: .10, skin: weight(foot) },
        ], 8, HOOF);
      }
    }
  }
  b.loft('TailStem', [
    { p: [0, 1.28, -.905], width: .028, depth: .029, skin: weight('Tail') },
    { p: [0, 1.10, -1.0], width: .024, depth: .025, skin: weight('Tail') },
    { p: [0, .94, -1.015], width: .021, depth: .023, skin: weight('Tail', 'TailMiddle', .45) },
    { p: [0, .73, -1.02], width: .018, depth: .02, skin: weight('TailMiddle', 'TailEnd', .6) },
    { p: [0, .55, -1.03], width: .019, depth: .022, skin: weight('TailEnd') },
  ], 6, COAT);
  b.loft('TailTuft', [
    { p: [0, .625, -1.025], width: .028, depth: .03, skin: weight('TailEnd') },
    { p: [0, .48, -1.04], width: .06, depth: .064, skin: weight('TailEnd') },
    { p: [0, .385, -1.055], width: .016, depth: .018, skin: weight('TailEnd') },
  ], 8, '#665437');
  return b.data;
}
