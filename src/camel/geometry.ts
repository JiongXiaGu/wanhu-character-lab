import { HorseMeshBuilder, type Section } from '../horse/geometry/builder';
import { weight } from './rig';

export const CAMEL_MESH_VERSION = 'wanhu-camel-mesh-m5-v1';
const COAT = '#b29a73', PALE = '#ccb791', WOOL = '#8a7050', PAD = '#75634f';
/** 作者截面独立制作；只共用闭合小壳工具，不调用马/驴模型或整体缩放。 */
export function buildCamelMesh() {
  const b = new HorseMeshBuilder(); b.data.version = CAMEL_MESH_VERSION;
  b.loft('Body', [
    { p: [0, 1.58, -1.06], width: .11, depth: .17, skin: weight('Pelvis') },
    { p: [0, 1.51, -.91], width: .31, depth: .34, skin: weight('Pelvis') },
    { p: [0, 1.47, -.67], width: .395, depth: .40, skin: weight('Pelvis') },
    { p: [0, 1.45, -.32], width: .425, depth: .415, skin: weight('Pelvis', 'Spine', .25) },
    { p: [0, 1.47, .04], width: .425, depth: .425, skin: weight('Spine') },
    { p: [0, 1.48, .38], width: .405, depth: .415, skin: weight('Spine', 'Chest', .35) },
    { p: [0, 1.52, .68], width: .33, depth: .37, skin: weight('Chest') },
    { p: [0, 1.55, .91], width: .16, depth: .26, skin: weight('Chest') },
  ], 12, COAT);
  for (const face of b.data.triangles) {
    const y = face.indices.reduce((sum, i) => sum + b.data.vertices[i].position[1], 0) / 3;
    if (y < 1.20) face.color = PALE;
  }
  // 两峰各自为闭合厚壳，下缘埋入背部；中央留出真实鞍谷而非峰顶坐点。
  b.loft('BackHump', [
    { p: [0, 1.72, -.70], width: .32, depth: .34, skin: weight('Pelvis', 'Spine', .45) },
    { p: [0, 2.04, -.72], width: .28, depth: .30, skin: weight('Pelvis', 'Spine', .45) },
    { p: [0, 2.34, -.76], width: .175, depth: .19, skin: weight('Pelvis', 'Spine', .45), color: WOOL },
    { p: [0, 2.49, -.77], width: .05, depth: .065, skin: weight('Pelvis', 'Spine', .45), color: WOOL },
  ], 10, COAT);
  b.loft('FrontHump', [
    { p: [0, 1.74, .64], width: .32, depth: .35, skin: weight('Spine', 'Chest', .55) },
    { p: [0, 2.08, .66], width: .28, depth: .30, skin: weight('Spine', 'Chest', .55) },
    { p: [0, 2.38, .70], width: .175, depth: .19, skin: weight('Spine', 'Chest', .55), color: WOOL },
    { p: [0, 2.52, .71], width: .05, depth: .065, skin: weight('Spine', 'Chest', .55), color: WOOL },
  ], 10, COAT);
  b.loft('Neck', [
    { p: [0, 1.51, .78], width: .235, depth: .26, skin: weight('Chest', 'NeckBase', .4) },
    { p: [0, 1.40, 1.04], width: .185, depth: .205, skin: weight('NeckBase') },
    { p: [0, 1.51, 1.24], width: .145, depth: .17, skin: weight('NeckBase', 'Neck', .25) },
    { p: [0, 1.78, 1.40], width: .125, depth: .16, skin: weight('Neck') },
    { p: [0, 2.04, 1.49], width: .115, depth: .15, skin: weight('Neck', 'NeckUpper', .35) },
    { p: [0, 2.31, 1.58], width: .11, depth: .135, skin: weight('NeckUpper') },
    { p: [0, 2.48, 1.70], width: .115, depth: .13, skin: weight('NeckUpper', 'Head', .4) },
  ], 10, COAT);
  b.loft('Head', [
    { p: [0, 2.48, 1.67], width: .095, depth: .115, skin: weight('Head') },
    { p: [0, 2.50, 1.82], width: .13, depth: .14, skin: weight('Head') },
    { p: [0, 2.435, 1.99], width: .115, depth: .105, skin: weight('Head') },
    { p: [0, 2.395, 2.16], width: .11, depth: .08, skin: weight('Head'), color: PALE },
    { p: [0, 2.385, 2.25], width: .095, depth: .065, skin: weight('Head'), color: PALE },
  ], 10, COAT);
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'Left' : 'Right', ear = `${side}Ear`;
    b.loft(ear, [
      { p: [sign * .11, 2.51, 1.735], width: .033, depth: .035, skin: weight(ear) },
      { p: [sign * .18, 2.565, 1.685], width: .057, depth: .027, skin: weight(ear), color: WOOL },
      { p: [sign * .215, 2.60, 1.64], width: .017, depth: .012, skin: weight(ear), color: WOOL },
    ], 6, COAT);
    b.gem(`${side}Eye`, [sign * .124, 2.493, 1.88], [.010, .013, .019], weight('Head'), '#342c24');
    // 小壳嵌入吻侧，不能复制旧驴鼻孔的悬空前向偏移。
    b.gem(`${side}Nostril`, [sign * .096, 2.42, 2.186], [.012, .012, .019], weight('Head'), '#554534');
    for (const front of [true, false]) {
      const n = `${front ? 'Front' : 'Back'}${side}`, x = sign * (front ? .27 : .28);
      const u = `${n}Upper`, m = `${n}Middle`, l = `${n}Lower`, foot = `${n}Foot`;
      const rows: Section[] = front ? [
        { p: [x, 1.62, .63], width: .14, depth: .18, skin: weight('Chest', u, .50) },
        { p: [x, 1.47, .65], width: .115, depth: .14, skin: weight(u) },
        { p: [x, 1.14, .675], width: .067, depth: .083, skin: weight(u) },
        { p: [x, .88, .70], width: .063, depth: .07, skin: weight(u, m, .5), color: WOOL },
        { p: [x, .72, .69], width: .047, depth: .055, skin: weight(m) },
        { p: [x, .45, .67], width: .041, depth: .047, skin: weight(m) },
        { p: [x, .23, .66], width: .048, depth: .054, skin: weight(m, l, .5), color: WOOL },
        { p: [x, .115, .72], width: .06, depth: .06, skin: weight(l, foot, .35), color: PAD },
      ] : [
        { p: [x, 1.64, -.73], width: .16, depth: .19, skin: weight('Pelvis', u, .50) },
        { p: [x, 1.47, -.70], width: .125, depth: .15, skin: weight(u) },
        { p: [x, 1.23, -.58], width: .084, depth: .10, skin: weight(u) },
        { p: [x, 1.02, -.49], width: .072, depth: .087, skin: weight(u, m, .5) },
        { p: [x, .75, -.65], width: .057, depth: .069, skin: weight(m) },
        { p: [x, .49, -.81], width: .06, depth: .068, skin: weight(m, l, .5), color: WOOL },
        { p: [x, .28, -.765], width: .042, depth: .05, skin: weight(l) },
        { p: [x, .115, -.705], width: .059, depth: .058, skin: weight(l, foot, .35), color: PAD },
      ];
      b.loft(`${n}Leg`, rows, 8, COAT);
      const z = front ? .74 : -.70;
      b.loft(`${n}Pad`, [
        { p: [x, .14, z - .025], width: .065, depth: .09, skin: weight(foot) },
        { p: [x, .065, z], width: .132, depth: .157, skin: weight(foot) },
        { p: [x, .021, z + .004], width: .126, depth: .153, skin: weight(foot) },
      ], 10, PAD);
      // 两个前趾共享脚骨，前端轻微分叉；不是黑色硬马蹄。
      for (const toe of [-1, 1]) b.loft(`${n}${toe < 0 ? 'Inner' : 'Outer'}Toe`, [
        { p: [x + toe * .06, .094, z + .115], width: .044, depth: .052, skin: weight(foot) },
        { p: [x + toe * .06, .026, z + .128], width: .05, depth: .06, skin: weight(foot) },
      ], 6, '#927956');
    }
  }
  b.loft('NeckFringe', [
    { p: [0, 1.30, 1.06], width: .075, depth: .053, skin: weight('NeckBase') },
    { p: [0, 1.46, 1.39], width: .061, depth: .042, skin: weight('NeckBase', 'Neck', .25) },
    { p: [0, 1.80, 1.535], width: .047, depth: .037, skin: weight('Neck') },
    { p: [0, 2.08, 1.63], width: .032, depth: .025, skin: weight('NeckUpper') },
  ], 4, WOOL);
  b.loft('Beard', [
    { p: [0, 2.36, 1.88], width: .064, depth: .048, skin: weight('Head') },
    { p: [0, 2.255, 1.925], width: .047, depth: .047, skin: weight('Head') },
    { p: [0, 2.20, 1.95], width: .012, depth: .015, skin: weight('Head') },
  ], 6, WOOL);
  b.loft('TailStem', [
    { p: [0, 1.73, -1.015], width: .031, depth: .037, skin: weight('Tail') },
    { p: [0, 1.40, -1.145], width: .026, depth: .028, skin: weight('Tail') },
    { p: [0, 1.22, -1.165], width: .023, depth: .028, skin: weight('TailMiddle') },
    { p: [0, .94, -1.20], width: .024, depth: .033, skin: weight('TailEnd') },
  ], 6, COAT);
  b.loft('TailTuft', [
    { p: [0, 1.02, -1.195], width: .028, depth: .035, skin: weight('TailEnd') },
    { p: [0, .85, -1.22], width: .057, depth: .065, skin: weight('TailEnd') },
    { p: [0, .76, -1.235], width: .018, depth: .023, skin: weight('TailEnd') },
  ], 6, WOOL);
  return b.data;
}
