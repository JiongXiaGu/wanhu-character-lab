import { HorseMeshBuilder, type Section } from '../horse/geometry/builder';
import { weight } from './rig';
import type { Point3 } from '../horse/types';

export const DONKEY_MESH_VERSION = 'wanhu-donkey-mesh-m4-v1';
const GRAY = '#827f72', PALE = '#c4bd9f', DARK = '#514f45', HOOF = '#383c36';
/** 独立作者截面：短粗躯干、较短腿、长耳、浅吻和尾端毛束，不由整马scale/换色生成。 */
export function buildDonkeyMesh() {
  const b = new HorseMeshBuilder(); b.data.version = DONKEY_MESH_VERSION;
  b.loft('Body', [
    { p: [0, 1.07, -.81], width: .08, depth: .12, skin: weight('Pelvis') },
    { p: [0, 1.025, -.68], width: .25, depth: .27, skin: weight('Pelvis') },
    { p: [0, .99, -.49], width: .295, depth: .32, skin: weight('Pelvis') },
    { p: [0, .995, -.20], width: .31, depth: .32, skin: weight('Pelvis', 'Spine', .30) },
    { p: [0, .995, .10], width: .295, depth: .315, skin: weight('Spine') },
    { p: [0, 1.00, .34], width: .27, depth: .30, skin: weight('Spine', 'Chest', .2) },
    { p: [0, 1.025, .49], width: .205, depth: .25, skin: weight('Chest') },
    { p: [0, 1.045, .57], width: .07, depth: .14, skin: weight('Chest') },
  ], 12, GRAY);
  for (const f of b.data.triangles) {
    const y = f.indices.reduce((sum, i) => sum + b.data.vertices[i].position[1], 0) / 3;
    if (y < .79) f.color = PALE;
  }
  b.loft('Neck', [
    { p: [0, 1.08, .425], width: .22, depth: .24, skin: weight('Chest') },
    { p: [0, 1.22, .50], width: .18, depth: .22, skin: weight('Chest', 'Neck', .20) },
    { p: [0, 1.37, .60], width: .135, depth: .175, skin: weight('Neck') },
    { p: [0, 1.49, .69], width: .105, depth: .14, skin: weight('Neck', 'NeckUpper', .4) },
    { p: [0, 1.61, .77], width: .091, depth: .125, skin: weight('NeckUpper') },
    { p: [0, 1.68, .80], width: .085, depth: .115, skin: weight('NeckUpper', 'Head', .35) },
  ], 10, GRAY);
  b.loft('Head', [
    { p: [0, 1.72, .78], width: .075, depth: .10, skin: weight('Head') },
    { p: [0, 1.655, .86], width: .133, depth: .155, skin: weight('Head') },
    { p: [0, 1.525, .99], width: .116, depth: .125, skin: weight('Head') },
    { p: [0, 1.405, 1.10], width: .111, depth: .09, skin: weight('Head'), color: PALE },
    { p: [0, 1.345, 1.16], width: .102, depth: .079, skin: weight('Head'), color: PALE },
  ], 10, GRAY);
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'Left' : 'Right', ear = `${side}Ear`;
    b.loft(ear, [
      { p: [sign * .080, 1.685, .81], width: .037, depth: .032, skin: weight(ear) },
      { p: [sign * .087, 1.785, .795], width: .052, depth: .026, skin: weight(ear) },
      { p: [sign * .11, 1.945, .765], width: .041, depth: .021, skin: weight(ear) },
      { p: [sign * .12, 2.065, .755], width: .010, depth: .010, skin: weight(ear) },
    ], 6, GRAY);
    b.loft(`${ear}Inner`, [
      { p: [sign * .087, 1.785, .818], width: .023, depth: .006, skin: weight(ear) },
      { p: [sign * .109, 1.932, .785], width: .020, depth: .006, skin: weight(ear) },
      { p: [sign * .119, 2.025, .773], width: .005, depth: .003, skin: weight(ear) },
    ], 4, '#b7a58c');
    b.gem(`${side}Eye`, [sign * .129, 1.651, .904], [.014, .018, .020], weight('Head'), '#232923');
    b.gem(`${side}Nostril`, [sign * .077, 1.371, 1.217], [.012, .014, .008], weight('Head'), DARK);
    for (const front of [true, false]) {
      const n = `${front ? 'Front' : 'Back'}${side}`, x = sign * (front ? .20 : .215);
      const u = `${n}Upper`, m = `${n}Middle`, l = `${n}Lower`, h = `${n}Hoof`;
      const rows: Section[] = front ? [
        { p: [x, 1.13, .385], width: .104, depth: .13, skin: weight('Chest', u, .50) },
        { p: [x, 1.04, .40], width: .095, depth: .115, skin: weight(u) },
        { p: [x, .835, .435], width: .066, depth: .08, skin: weight(u) },
        { p: [x, .625, .455], width: .051, depth: .058, skin: weight(u, m, .5) },
        { p: [x, .50, .455], width: .042, depth: .048, skin: weight(m) },
        { p: [x, .31, .448], width: .038, depth: .042, skin: weight(m), color: DARK },
        { p: [x, .19, .445], width: .046, depth: .053, skin: weight(m, l, .5), color: DARK },
        { p: [x, .127, .48], width: .04, depth: .045, skin: weight(l), color: DARK },
        { p: [x, .083, .505], width: .052, depth: .057, skin: weight(l, h, .35), color: DARK },
      ] : [
        { p: [x, 1.14, -.52], width: .124, depth: .15, skin: weight('Pelvis', u, .55) },
        { p: [x, 1.045, -.515], width: .115, depth: .135, skin: weight(u) },
        { p: [x, .895, -.43], width: .095, depth: .105, skin: weight(u) },
        { p: [x, .760, -.345], width: .071, depth: .081, skin: weight(u, m, .5) },
        { p: [x, .56, -.485], width: .063, depth: .072, skin: weight(m) },
        { p: [x, .39, -.62], width: .052, depth: .061, skin: weight(m, l, .5) },
        { p: [x, .245, -.60], width: .038, depth: .043, skin: weight(l), color: DARK },
        { p: [x, .13, -.585], width: .040, depth: .048, skin: weight(l), color: DARK },
        { p: [x, .083, -.58], width: .051, depth: .057, skin: weight(l, h, .35), color: DARK },
      ];
      b.loft(`${n}Leg`, rows, 8, GRAY);
      const z = front ? .527 : -.557;
      b.loft(`${n}Hoof`, [
        { p: [x, .119, z - .016], width: .059, depth: .068, skin: weight(h) },
        { p: [x, .054, z], width: .082, depth: .103, skin: weight(h) },
        { p: [x, .016, z + .003], width: .079, depth: .100, skin: weight(h) },
      ], 8, HOOF);
    }
  }
  // 短鬃沿颈背，尾部是细尾杆加末端毛束，而非马的长整片尾巴。
  b.loft('Mane', [
    { p: [0, 1.26, .305], width: .021, depth: .037, skin: weight('Chest', 'Neck', .25) },
    { p: [0, 1.455, .458], width: .023, depth: .047, skin: weight('Neck') },
    { p: [0, 1.625, .602], width: .020, depth: .043, skin: weight('NeckUpper') },
    { p: [0, 1.735, .695], width: .016, depth: .025, skin: weight('Head') },
  ], 4, DARK);
  b.loft('TailStem', [
    { p: [0, 1.22, -.775], width: .026, depth: .028, skin: weight('Tail') },
    { p: [0, .98, -.91], width: .021, depth: .023, skin: weight('Tail') },
    { p: [0, .74, -.925], width: .018, depth: .021, skin: weight('Tail', 'TailEnd', .4) },
    { p: [0, .61, -.94], width: .019, depth: .024, skin: weight('TailEnd') },
  ], 6, GRAY);
  b.loft('TailTuft', [
    { p: [0, .73, -.925], width: .03, depth: .033, skin: weight('TailEnd') },
    { p: [0, .585, -.952], width: .055, depth: .062, skin: weight('TailEnd') },
    { p: [0, .48, -.975], width: .017, depth: .018, skin: weight('TailEnd') },
  ], 6, DARK);
  return b.data;
}
