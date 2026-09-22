"""Temporary M8 authoring transaction. Removed before integration; never run at app runtime."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
def read(path): return (root / path).read_text()
def write(path, text):
    p = root / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)
def replace(path, before, after, count=1):
    text = read(path)
    assert text.count(before) >= count, (path, before)
    write(path, text.replace(before, after, count))
def renamed(text):
    return text.replace('CATTLE', 'BUFFALO').replace('Cattle', 'Buffalo').replace('cattle_yellow', 'buffalo_water').replace('cattle', 'buffalo').replace('黄牛', '水牛').replace('m6-v2', 'm8-v1').replace('m6-v1', 'm8-v1')

assert not (root / 'src/buffalo/geometry.ts').exists(), 'Do not overwrite authored follow-up edits.'
write('src/buffalo/rig.ts', '''import type { HorseJoint, HorseWeight } from '../horse/types';

export const BUFFALO_RIG_VERSION = 'wanhu-buffalo-rig-m8-v1';
/** 水牛独立28骨；低头、低宽背和纵向承重点均在米制绑定空间作者化。 */
export const BUFFALO_JOINTS: readonly HorseJoint[] = [
  { name: 'Root', parent: -1, bindWorld: [0, 0, 0] },
  { name: 'Pelvis', parent: 0, bindWorld: [0, 1.00, -.78] },
  { name: 'Spine', parent: 1, bindWorld: [0, 1.05, -.18] },
  { name: 'Chest', parent: 2, bindWorld: [0, 1.07, .52] },
  { name: 'NeckBase', parent: 3, bindWorld: [0, 1.00, .69] },
  { name: 'Neck', parent: 4, bindWorld: [0, 1.09, .96] },
  { name: 'Head', parent: 5, bindWorld: [0, 1.11, 1.17] },
  { name: 'FrontLeftUpper', parent: 3, bindWorld: [-.375, 1.04, .59] },
  { name: 'FrontLeftMiddle', parent: 7, bindWorld: [-.375, .58, .61] },
  { name: 'FrontLeftLower', parent: 8, bindWorld: [-.375, .18, .61] },
  { name: 'FrontLeftFoot', parent: 9, bindWorld: [-.375, .077, .65] },
  { name: 'FrontRightUpper', parent: 3, bindWorld: [.375, 1.04, .59] },
  { name: 'FrontRightMiddle', parent: 11, bindWorld: [.375, .58, .61] },
  { name: 'FrontRightLower', parent: 12, bindWorld: [.375, .18, .61] },
  { name: 'FrontRightFoot', parent: 13, bindWorld: [.375, .077, .65] },
  { name: 'BackLeftUpper', parent: 1, bindWorld: [-.385, 1.04, -.91] },
  { name: 'BackLeftMiddle', parent: 15, bindWorld: [-.385, .73, -.71] },
  { name: 'BackLeftLower', parent: 16, bindWorld: [-.385, .31, -.92] },
  { name: 'BackLeftFoot', parent: 17, bindWorld: [-.385, .077, -.88] },
  { name: 'BackRightUpper', parent: 1, bindWorld: [.385, 1.04, -.91] },
  { name: 'BackRightMiddle', parent: 19, bindWorld: [.385, .73, -.71] },
  { name: 'BackRightLower', parent: 20, bindWorld: [.385, .31, -.92] },
  { name: 'BackRightFoot', parent: 21, bindWorld: [.385, .077, -.88] },
  { name: 'Tail', parent: 1, bindWorld: [0, 1.13, -1.16] },
  { name: 'TailMiddle', parent: 23, bindWorld: [0, .77, -1.27] },
  { name: 'TailEnd', parent: 24, bindWorld: [0, .43, -1.30] },
  { name: 'LeftEar', parent: 6, bindWorld: [-.23, 1.10, 1.18] },
  { name: 'RightEar', parent: 6, bindWorld: [.23, 1.10, 1.18] },
];
export function buffaloBone(name: string): number {
  const index = BUFFALO_JOINTS.findIndex(joint => joint.name === name);
  if (index < 0) throw new Error(`未知水牛骨骼：${name}`);
  return index;
}
export function weight(a: string, b = a, w = 1): HorseWeight { return [buffaloBone(a), buffaloBone(b), w]; }
''')
# The sweep and embedded-detail construction algorithms are reusable tools, not animal author data.
helpers = read('src/cattle/geometry.ts')
helpers = helpers[:helpers.index('/** 独立黄牛作者截面')]
helpers = renamed(helpers).replace("const COAT = '#b88c50', PALE = '#c8aa76', SHADE = '#987342', NOSE = '#4d493c', HOOF = '#454035';", "const COAT = '#535b5b', PALE = '#646967', SHADE = '#434a49', NOSE = '#303b3c', HOOF = '#343b39';")
write('src/buffalo/geometry.ts', helpers + '''/** 独立水牛作者资源：低长头、横展后弯角和低宽沉腹，不调用其他动物的作者网格。 */
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
''')
anim = renamed(read('src/cattle/animation.ts'))
start = anim.index('export const BUFFALO_MOTIONS:')
end = anim.index('/** 仅在创建AnimationClip')
anim = anim[:start] + '''export const BUFFALO_MOTIONS: Readonly<Record<MountMotion, MountMotionDefinition>> = {
  idle: { nativeId: 'Buffalo_Idle', duration: 5.8, label: '停驻', description: '低沉宽体缓慢呼吸，横耳和长尾轻摆。' },
  walk: { nativeId: 'Buffalo_Walk', duration: 2.0, label: '步行', description: '慢而重的中等步幅，背部起伏克制，前后肢承重清楚。' },
  run: { nativeId: 'Buffalo_Run', duration: 1.15, label: '奔跑', description: '短距离沉重快跑，增加后肢推地，不采用赛马式疾驰。' },
  eat: { nativeId: 'Buffalo_Eat', duration: 7.2, label: '进食', description: '低位宽头和短颈一起下压，近地停留扫动后缓慢抬头。' },
};
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
/** 水牛独立作者曲线；低位脚向-Z后掠，高位回到+Z，不倒放或镜像修正方向。 */
export function authorBuffaloPose(id: MountMotion, phase: number) {
  const p = ((phase % 1) + 1) % 1, a = 2 * Math.PI * p;
  const rotations: Point3[] = BUFFALO_JOINTS.map(() => [0, 0, 0]), pelvisOffset: Point3 = [0, 0, 0];
  const put = (name: string, x: number, y = 0, z = 0) => { rotations[buffaloBone(name)] = [x, y, z]; };
  put('LeftEar', .019 * Math.sin(a + .3), .015 * Math.sin(2 * a), .035 * Math.sin(a));
  put('RightEar', .018 * Math.sin(a - .4), -.013 * Math.sin(2 * a + .2), -.032 * Math.sin(a + .6));
  put('Tail', .011 * Math.sin(a), 0, .070 * Math.sin(a));
  put('TailMiddle', .019 * Math.sin(a - .3), 0, .11 * Math.sin(a - .35));
  put('TailEnd', .016 * Math.sin(a - .6), 0, .13 * Math.sin(a - .65));
  if (id === 'idle') {
    pelvisOffset[1] = .002 * Math.sin(a); put('Chest', .0028 * Math.sin(a));
    put('NeckBase', .0035 * Math.sin(a), .004 * Math.sin(a)); put('Neck', -.004 * Math.sin(a));
    put('Head', .006 * Math.sin(a + .3), -.004 * Math.sin(a));
  } else if (id === 'eat') {
    const down = p < .28 ? smooth(p / .28) : p < .73 ? 1 : 1 - smooth((p - .73) / .27);
    put('NeckBase', .80 * down); put('Neck', -.02 * down);
    put('Head', .045 * down + .004 * down * Math.sin(4 * a), .012 * down * Math.sin(2 * a));
  } else {
    const run = id === 'run', pitch = (run ? .016 : .004) * Math.sin(a - .35);
    const roll = (run ? .009 : .006) * Math.sin(a), spine = -(run ? .006 : .002) * Math.sin(a - .35), chest = .003 * Math.sin(a + .2);
    pelvisOffset[1] = run ? .018 + .013 * Math.sin(2 * a - .3) : .006 + .003 * Math.sin(2 * a);
    put('Pelvis', pitch, 0, roll); put('Spine', spine); put('Chest', chest);
    put('NeckBase', (run ? .017 : .006) + (run ? .014 : .009) * Math.sin(a - .3), 0, -roll * .3);
    put('Neck', -.007 * Math.sin(a - .3)); put('Head', .008 * Math.sin(a + .2));
    const phases = run ? { FrontLeft: 0, BackRight: .09, FrontRight: .5, BackLeft: .59 } : { FrontLeft: 0, BackRight: .05, FrontRight: .5, BackLeft: .55 };
    for (const leg of ['FrontLeft', 'FrontRight', 'BackLeft', 'BackRight'] as const) {
      const q = 2 * Math.PI * ((phases[leg] - p + 1) % 1), front = leg.startsWith('Front'), swing = Math.max(0, Math.sin(q));
      const upper = -(run ? front ? .38 : .27 : front ? .18 : .155) * Math.cos(q);
      const middle = (run ? front ? .72 : .47 : front ? .42 : .29) * swing * swing;
      const lower = -(front ? .15 : run ? .41 : .26) * swing * swing;
      put(`${leg}Upper`, upper); put(`${leg}Middle`, middle); put(`${leg}Lower`, lower);
      put(`${leg}Foot`, -(pitch + (front ? spine + chest : 0) + upper + middle + lower), 0, -roll);
    }
  }
  return { rotations, pelvisOffset };
}
''' + anim[end:]
write('src/buffalo/animation.ts', anim)
write('src/buffalo/saddles.ts', '''import { CylinderGeometry } from 'three';
import { SaddleBuilder } from '../horse/saddles/geometry';
import type { SaddleId } from '../horse/saddles/catalog';
import type { SaddleProfile, ReinProfile, RiderFit } from '../mounts/types';
import type { BodyType } from '../character/v3/types';
import { BUFFALO_JOINTS, buffaloBone } from './rig';

export const BUFFALO_SADDLE_VERSION = 'wanhu-buffalo-saddles-m8-v1';
const spine = BUFFALO_JOINTS[buffaloBone('Spine')].bindWorld, head = BUFFALO_JOINTS[buffaloBone('Head')].bindWorld;
const BIT = [.232, .812, 1.685] as const;
/** 水牛低宽厚垫独立作者几何；不调用其他物种鞍具或扩大人物配方。 */
function buildSaddle(id: Exclude<SaddleId, 'none'>) {
  const b = new SaddleBuilder(), travel = id === 'travel', lift = travel ? .016 : 0;
  const cloth = travel ? '#65766c' : '#84644f', leather = '#66503b', trim = '#af9768';
  const xs = [-.58, -.43, -.23, 0, .23, .43, .58];
  b.plate([-.48, .30].map(z => ({ z, points: xs.map(x => [x, 1.344 + lift - .32 * (x / .58) ** 2] as [number, number]) })), .04, cloth);
  b.plate([[-.34, 1.408, .265], [-.19, 1.386, .265], [.14, 1.386, .26], [.26, 1.414, .255]].map(([z, y, w]) => ({ z, points: [[-w, y + lift + .007], [0, y + lift], [w, y + lift + .007]] as [number, number][] })), .048, leather);
  for (const s of [-1, 1]) {
    b.bar([s * .34, 1.27 + lift, -.34], [s * .34, 1.27 + lift, .23], .038, .042, '#75694c');
    b.bar([s * .35, 1.26 + lift, .03], [s * .60, .77 + lift, .13], .029, .016, leather);
    b.band([s * .60, .735 + lift, .16], [0, 0, 1], [0, 1, 0], .079, .06, .012, .03, trim, 8);
    b.box([s * .49, 1.12 + lift, .055], [.030, .040, .043], trim);
    if (travel) {
      b.bundle([s * .642, 1.035, -.56], [.25, .32, .37], '#a19270');
      b.box([s * .642, 1.201, -.56], [.255, .030, .35], '#607167');
      b.box([s * .776, 1.035, -.56], [.016, .31, .035], leather);
      b.box([s * .785, 1.09, -.56], [.018, .036, .044], trim);
      b.bar([s * .29, 1.355, -.31], [s * .642, 1.205, -.47], .022, .015, leather);
    }
  }
  if (travel) {
    const roll = new CylinderGeometry(.073, .073, .56, 8, 1, false); roll.rotateZ(Math.PI / 2); roll.translate(0, 1.335, -.79); b.add(roll, '#8d8870');
    for (const x of [-.18, .18]) {
      b.band([x, 1.335, -.79], [0, 0, 1], [0, 1, 0], .077, .077, .009, .023, leather, 8);
      b.bar([x, 1.365, -.36], [x, 1.31, -.79], .016, .014, leather);
    }
  }
  return b.finish(spine);
}
function buildBridle() {
  const b = new SaddleBuilder(), leather = '#67553f', trim = '#af9768';
  // bitLeft/Right是鼻侧缰绳挂点，不代表马式口内衔铁；面带放在角根前下方。
  b.band([0, .815, 1.678], [1, 0, 0], [0, .866, .5], .229, .109, .009, .029, leather);
  b.band([0, 1.02, 1.315], [1, 0, 0], [0, .87, .49], .258, .174, .009, .024, leather);
  for (const s of [-1, 1]) {
    b.bar([s * BIT[0], BIT[1], BIT[2]], [s * .254, 1.025, 1.31], .018, .012, leather);
    b.band([s * BIT[0], BIT[1], BIT[2]], [0, 0, 1], [0, 1, 0], .022, .022, .007, .012, trim, 8);
  }
  return b.finish(head);
}
export const BUFFALO_SADDLE_PROFILE: SaddleProfile = {
  backBone: 'Spine', headBone: 'Head',
  bitLeft: [-BIT[0] - head[0], BIT[1] - head[1], BIT[2] - head[2]],
  bitRight: [BIT[0] - head[0], BIT[1] - head[1], BIT[2] - head[2]],
  seat: id => id === 'none' ? null : [0, (id === 'travel' ? 1.402 : 1.386) - spine[1], .10],
  buildSaddle, buildBridle,
};
export const BUFFALO_RIDER_FIT: Readonly<Record<BodyType, RiderFit>> = {
  male: { hipsLift: .17, thighDirection: [.845, -.57, .365], upperArmDirection: [.235, -.915, .335], forearmDirection: [-.018, .04, .999] },
  female: { hipsLift: .16, thighDirection: [.875, -.55, .365], upperArmDirection: [.235, -.915, .335], forearmDirection: [-.018, .04, .999] },
};
export const BUFFALO_REIN_PROFILE: ReinProfile = { guideBone: 'Neck', guide: [.59, .35, .34], sideClearance: .04, sagScale: .30 };
''')

# Register only this real species. No yak placeholder or generic bovine generator.
replace('src/mounts/types.ts', "'cattle_yellow'] as const", "'cattle_yellow', 'buffalo_water'] as const")
replace('src/mounts/catalog.ts', "import { HORSE_REIN_PROFILE", "import { buildBuffaloMesh } from '../buffalo/geometry';\nimport { BUFFALO_JOINTS } from '../buffalo/rig';\nimport { authorBuffaloPose, bakeBuffaloClips, BUFFALO_MOTIONS } from '../buffalo/animation';\nimport { BUFFALO_REIN_PROFILE, BUFFALO_RIDER_FIT, BUFFALO_SADDLE_PROFILE } from '../buffalo/saddles';\nimport { HORSE_REIN_PROFILE")
replace('src/mounts/catalog.ts', "];\nexport function isMountId", """  { id: 'buffalo_water', name: '水牛', description: '低长头、横展后弯角、低沉宽体与真实分趾蹄；南方水田家养水牛的独立作者资产。', createActor: () => makeMountActor(buildBuffaloMesh(), BUFFALO_JOINTS, 'WanhuBuffalo'),
    bakeClips: bakeBuffaloClips, motions: BUFFALO_MOTIONS, saddle: BUFFALO_SADDLE_PROFILE, reins: BUFFALO_REIN_PROFILE, riderFit: BUFFALO_RIDER_FIT,
    backPitch(id, p) { const pose = authorBuffaloPose(id, p); return pose.rotations[1][0] + pose.rotations[2][0]; },
    frame: { bodyY: .91, ridingY: 1.18, bodyHalf: 1.63, ridingHalf: 1.72 },
  },
];
export function isMountId""")
replace('src/mounts/catalog.ts', '(Horse|Donkey|Camel|Cattle)_', '(Horse|Donkey|Camel|Cattle|Buffalo)_')

# Preserve the entire original species matrices. The new module owns only buffalo expectations.
anatomy = renamed(read('scripts/mount-cattle-anatomy-checks.ts'))
anatomy = anatomy.replace('triangles: 1956, logicalVertices: 1032, gpuVertices: 5868', 'triangles: 2056, logicalVertices: 1082, gpuVertices: 6168')
anatomy = anatomy.replace('assert.equal(left.length, 42); assert.equal(right.length, 42);', 'assert.equal(left.length, 50); assert.equal(right.length, 50);')
anatomy = anatomy.replace('length: 5', 'length: 6').replace('centers[4]', 'centers[5]').replace('sub(centers[3])', 'sub(centers[4])')
anatomy = anatomy.replace("assert(Math.abs(centers[5].x) > .40 && Math.abs(centers[5].x) < .50 && centers[5].y - centers[0].y > .20, 'horn silhouette');", "assert(Math.abs(centers[5].x) > .78 && Math.abs(centers[5].x) < .90 && centers[5].y - centers[0].y > .23 && centers[5].y - centers[0].y < .40 && centers[5].z - centers[0].z < -.18, 'water buffalo horns must spread laterally, sweep back and turn up');")
anatomy = anatomy.replace("assert.equal(ids.length, 34);", "assert.equal(ids.length, 26);")
anatomy = anatomy.replace("const ids = idsFor(actor, 'NoseMirror'); assert.equal(ids.length, 26);", "const ids = idsFor(actor, 'NoseMirror'); assert.equal(ids.length, 38);")
anatomy = anatomy.replace("bounds(actor, 'NoseMirror').width > .32", "bounds(actor, 'NoseMirror').width > .40")
anatomy = anatomy.replace("assert(body.width > .90 && body.width < 1.05 && body.min[1] < .65 && body.max[1] < 1.45, 'buffalo needs a low broad barrel');", "assert(body.width > 1.10 && body.width < 1.22 && body.min[1] > .40 && body.min[1] < .55 && body.max[1] < 1.31 && body.max[2] - body.min[2] > 1.95, 'water buffalo needs a long, low and broad body');")
anatomy = anatomy.replace("assert(head.width > .44 && neck.width > .54, 'buffalo needs a broad head and thick short neck');", "assert(head.width > .53 && neck.width > .70 && head.max[1] < body.max[1] + .03 && head.max[2] - head.min[2] > .68, 'water buffalo needs a low elongated head and thick short neck');\n  assert(bounds(actor, 'RightHorn').max[0] - bounds(actor, 'LeftHorn').min[0] > head.width * 2.8, 'horn spread must identify buffalo without coat color');\n  for (const side of ['Left', 'Right']) {\n    const ear = bounds(actor, `${side}Ear`); assert(ear.width > .33 && ear.max[1] - ear.min[1] < .22, 'buffalo ears must spread horizontally');\n    for (const i of idsFor(actor, `${side}Ear`)) assert.deepEqual(actor.data.vertices[i].weight, [buffaloBone(`${side}Ear`), buffaloBone(`${side}Ear`), 1]);\n  }\n  for (const prefix of ['Front', 'Back']) for (const part of ['Upper', 'Middle', 'Lower', 'Foot']) {\n    const left = actor.bones[buffaloBone(`${prefix}Left${part}`)].getWorldPosition(new Vector3()), right = actor.bones[buffaloBone(`${prefix}Right${part}`)].getWorldPosition(new Vector3()); left.x *= -1; assert(left.distanceTo(right) < 1e-8, 'asymmetric buffalo stance');\n  }")
write('scripts/mount-buffalo-anatomy-checks.ts', anatomy)
checks = renamed(read('scripts/mount-cattle-checks.ts')).replace('MOUNT_MOTIONS, type MountActor', 'MOUNT_IDS, MOUNT_MOTIONS, type MountActor')
checks = checks.replace('seat.y > 1.46 && seat.y < 1.53', 'seat.y > 1.36 && seat.y < 1.43')
old_tour = "['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'buffalo_water', 'horse_chestnut', 'donkey_gray', 'camel_bactrian', 'buffalo_water'] as const"
new_tour = "[...MOUNT_IDS.filter(id => id !== 'buffalo_water'), 'buffalo_water', ...MOUNT_IDS.filter(id => id !== 'buffalo_water'), 'buffalo_water'] as MountId[]"
assert old_tour in checks
checks = checks.replace(old_tour, new_tour).replace('assert.equal(swaps, 32)', 'assert.equal(swaps, 8 * MOUNT_IDS.length)')
write('scripts/mount-buffalo-checks.ts', checks)
replace('scripts/check-mounts.ts', "import { checkCattle } from './mount-cattle-checks';", "import { checkCattle } from './mount-cattle-checks';\nimport { checkBuffalo } from './mount-buffalo-checks';")
replace('scripts/check-mounts.ts', 'report.cattle = checkCattle();', 'report.cattle = checkCattle();\n  report.buffalo = checkBuffalo();')
replace('scripts/check-mounts.ts', "['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow']);", "['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow', 'buffalo_water']);")

browser = renamed(read('scripts/mount-cattle-browser.mjs'))
browser = browser.replace('1956', '2056').replace('5.2', '5.8').replace('1.05', '1.15').replace('6.8', '7.2').replace('1.8', '2.0')
browser = browser.replace("['buffalo_water', 28, 2.0]", "['cattle_yellow', 28, 1.8], ['buffalo_water', 28, 2.0]")
browser = browser.replace("['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'buffalo_water']", "['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow', 'buffalo_water']")
browser = browser.replace('all four species', 'all five species').replace('fourth species', 'water buffalo species')
needle = "  await page.goto(`${base}/?lab=mount&mount=buffalo_water&clip=Buffalo_Walk&paused=1&phase=.375`);"
assert needle in browser
browser = browser.replace(needle, "  await page.goto(`${base}/?lab=mount&mount=buffalo_water&pose=bind&paused=1`);\n  await page.waitForFunction(() => window.__MOUNT_REVIEW__?.mountId() === 'buffalo_water');\n  assert.equal((await body()).status.clip, 'bind'); assert((await body()).finite);\n  checks.push('water buffalo static bind body is a real finite 28-bone asset');\n" + needle)
write('scripts/mount-buffalo-browser.mjs', browser)
replace('scripts/check-mounts-browser.mjs', "import { checkCattleBrowser } from './mount-cattle-browser.mjs';", "import { checkCattleBrowser } from './mount-cattle-browser.mjs';\nimport { checkBuffaloBrowser } from './mount-buffalo-browser.mjs';")
replace('scripts/check-mounts-browser.mjs', 'await checkCattleBrowser(page, base, checks);', 'await checkCattleBrowser(page, base, checks);\n  await checkBuffaloBrowser(page, base, checks);')
for path in ['scripts/check-mounts-browser.mjs', 'scripts/check-riding-browser.mjs', 'scripts/check-saddles-browser.mjs']:
    # Only registry membership/count assertions, never cut old species tests or trajectories.
    text = read(path)
    text = text.replace("['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow']", "['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow', 'buffalo_water']")
    text = text.replace("['栗色马', '灰驴', '双峰骆驼', '黄牛']", "['栗色马', '灰驴', '双峰骆驼', '黄牛', '水牛']")
    write(path, text)
replace('.github/workflows/targeted-checks.yml', 'src/cattle/*|src/cattle/**/*|', 'src/cattle/*|src/cattle/**/*|src/buffalo/*|src/buffalo/**/*|')
replace('.github/workflows/targeted-checks.yml', 'scripts/mount-cattle-*)', 'scripts/mount-cattle-*|scripts/mount-buffalo-*)')

write('Documentation/水牛.md', '''# 水牛：本体与骑乘

## 定位与边界

buffalo_water是中国南方水田、河谷和湿润农业地区的家养耕作型水牛，可使用普通或旅行鞍骑乘。低长头、横展后弯角、低宽沉重躯干与横耳构成识别，不依赖深灰色把黄牛冒充水牛。不是非洲水牛、美洲野牛、瘤牛或幻想动物。

接手基线6119c8d0d717e64e230493a531c63abc14f34b78中只有栗色马、灰驴、双峰骆驼和黄牛，没有牦牛。本轮只增加真实完成的水牛；未给yak_black添加占位或顺手制作另一物种。以后合并其他物种时仍以目录和代码为准。

本轮没有牛车、犁、牛轭、耕田、游泳、涉水、泥地、驮运库存、上下坐骑、群体AI、Root Motion、地形或腿部IK、绳物理与布料物理。

## 资产所有权与轮廓

src/buffalo/geometry.ts独立拥有全部作者截面、头角、横耳、颜色、垂皮、尾干与分趾；rig.ts独立拥有绑定；animation.ts独立拥有四动作；saddles.ts拥有两套水牛鞍、鼻带、鼻侧环、BUFFALO_RIDER_FIT和BUFFALO_REIN_PROFILE。只复用低模壳、蒙皮装配、播放器与既有骑乘接口，不调用黄牛或其他动物的网格／鞍具工厂。

本体2056三角形、1082逻辑顶点、6168硬边渲染顶点、28骨，27个闭合作者壳。各壳允许指定作者重叠，不意味着全身为单一焊接流形。独立的十段躯干截面形成比黄牛更长、更低、更宽的身体，腹线沉重而背线相对平；低长头与短粗颈向前下方伸出。短毛深灰皮肤通过少量腹部色差保留结构，不使用纯黑掩盖形状。

横角由六个三维切线截面连接：角根嵌入头侧，先向左右展开，再向后收，外段向上而尖端收细。没有角盾、巨大半圆月牙或两根直锥。角刚性随Head，不增加角骨。鼻镜是独立闭合壳，与头部作者贴合；眼和鼻孔中心投到实际承载三角面，不在运行时贴附。大耳横展并略垂，各自随耳骨轻摆。

## 骨架、承重与偶蹄

28骨包括Root／Pelvis／Spine／Chest、两段短颈与Head、四腿各Upper／Middle／Lower／Foot、三段尾和双耳。米制、+X右／+Y上／+Z前，最多双权重，真实inverse bind。绑定是水牛自己的绝对作者位置，不导入黄牛骨架充当新资产。

前腿从肩胸承重点落下，前蹄仅轻微前探。后腿根位于后躯，后膝向前折、飞节向后收、后蹄回到臀部承重区；不把后腿根放到腹部中央。自动检查以Body纵向范围约束前肩、后臀比例，并约束前蹄前探、后膝和飞节折线、左右对称及蹄壳贴合，避免重演黄牛首稿腿位偏前。

每只Foot有InnerHoof和OuterHoof两个真实独立闭合趾壳，共八壳，中间留几何缝隙，不是黑线或单蹄。趾壳刚性随对应Foot。尾干比黄牛更长，末端小毛束，不使用牦牛长毛轮廓。

## 四动作

| 语义 | 原生片段 | 时长 | 表现 |
|---|---|---:|---|
| idle | Buffalo_Idle | 5.8秒 | 克制呼吸、横耳轻动、长尾慢摆 |
| walk | Buffalo_Walk | 2.0秒 | 沉稳中等步幅、低起伏、对角腿略错相 |
| run | Buffalo_Run | 1.15秒 | 沉重短跑、后肢推地加大，不作赛马飞驰 |
| eat | Buffalo_Eat | 7.2秒 | 宽鼻镜随短颈低头近地、停留扫动再抬起 |

每秒30帧作者烘焙、首尾闭合。Root无水平位移，无缩放轨道；运行时只采样已制作片段。蹄底竖向留量在创建片段时用作者前向变换标定，不在播放中求解地形或脚步。Walk和Run检查四脚有向轨迹，低位向后、高位向前；禁止倒放时钟或镜像模型修方向。蹄底-0.012米与进食最低头0.01–0.12米门槛保持。

## 水牛鞍与骑手

none／simple／travel语义不变。普通水牛鞍是低宽厚垫、低鞍桥与简化蹬带；旅行款增加左右布袋、小卷包和绑绳，仍是一个完整模块。没有袋子、鞍垫或绳索子槽位。

鼻带和面带位于角根前下方。bitLeft／bitRight沿用现有字段，但代表鼻侧缰绳挂点，不是马衔铁。BUFFALO_REIN_PROFILE提供独立颈侧导向；双绳仍使用原固定拓扑和同帧更新顺序，不增加物理或手部IK。

BUFFALO_RIDER_FIT分别指定男女坐高、较宽大腿方向与低宽持缰方向，坐点保持低位，不能靠大幅抬高人物回避宽背适配。人物仍20骨，先独立绑定再挂接；Recipe V5、衣柜、FBX、Cap和原inverse bind不变。

同物种换鞍不重建人物、动物或绳；换物种保留人物Geometry、inverse bind、装扮、动作语义和归一化相位。none冻结骑乘并隐藏人物／绳，但允许保留none切换物种。完整共同契约见多坐骑、骑乘与马鞍文档，不在此复制实现。

## 检查与验收

统一入口npm run check:mounts，专项为mount-buffalo-checks.ts和mount-buffalo-anatomy-checks.ts，没有永久check:buffalo命令。闭合性、非退化、体积／绕序、独立绑定、双权重、头角刚性和对称、根尖接触、横展曲率、鼻镜／眼鼻接触、横耳、八趾真实分缝和腿位比例均受检查。

追加964本体姿态、2892男女／两鞍／三动作稠密骑姿、70套衣裤关键相位和全部真实物种有鞍／无鞍循环切换；检查原人物inverse bind保持、换鞍复用、端点、非法ID恢复和dispose幂等。旧马、灰驴、骆驼、黄牛矩阵保留，地面、缰绳6毫米制作接触、跨坐范围和生命周期门槛不放宽。

check:mounts-browser追加真实桌面Chromium静态本体、四动作、男女／双鞍的静态和三骑姿、none、全部物种与双模式往返、相位／循环／暂停／Orbit相机／未保存装扮保持、坏缓存和单Canvas检查。不覆盖人物工坊存档，不留下隐藏动物。

数值或交互通过不代表美术已获认可。仍需用户确认第一眼是否像水牛、低头与低沉宽体、横角大小与曲率、横耳、前后腿承重、分趾、沉重步态、贴背鞍垫、男女跨坐及缰绳是否穿角。有限采样不能证明所有连续时刻衣物／鞍具／绳面零穿插；连续封底裙和手持物仍保留试验提示。

## 体验入口

本体：?lab=mount&mount=buffalo_water&pose=bind&paused=1

普通静态骑姿：?lab=riding&mount=buffalo_water&saddle=simple&clip=pose&paused=1

旅行步行：?lab=riding&mount=buffalo_water&saddle=travel&clip=Rider_Walk

女性旅行：?lab=riding&mount=buffalo_water&saddle=travel&bodyType=female&clip=Rider_Run&paused=1
''')
replace('README.md', '当前坐骑是栗色马、灰驴、双峰骆驼和黄牛。', '当前坐骑是栗色马、灰驴、双峰骆驼、黄牛和水牛。')
replace('README.md', '## M6：可骑乘黄牛', '''## M8：可骑乘水牛

buffalo_water使用独立低长头、横展后弯角、低沉宽体、横耳与八个分趾壳；2056三角形、1082逻辑点、28骨。不是黄牛换色缩放。Buffalo_Idle／Walk／Run／Eat分别5.8／2.0／1.15／7.2秒；普通／旅行水牛鞍、鼻侧缰具和男女骑姿均有独立作者配置，人物V5、20骨、衣柜及FBX不改。

本体：?lab=mount&mount=buffalo_water&pose=bind&paused=1；旅行骑乘：?lab=riding&mount=buffalo_water&saddle=travel&clip=Rider_Walk。仍使用原动物工坊两个模式和种类／整体鞍具两个选择。接手时牦牛尚未合入，不展示假牦牛。检查和视觉验收边界见[水牛](Documentation/水牛.md)。

## M6：可骑乘黄牛''')
replace('AGENTS.md', '# AGENTS · 衣冠工坊V5与四种坐骑', '# AGENTS · 衣冠工坊V5与多坐骑')
replace('AGENTS.md', '## 接手', '''## M8水牛与当前任务范围

用户已明确批准buffalo_water独立水牛和最终合入main；旧M6不做第五物种的阶段限制不阻止本任务。接手main 6119c8d中没有yak_black，本轮不制作或假装存在牦牛。先阅读《水牛.md》，再按最新远端真实目录工作。

src/buffalo独立拥有2056三角形／1082逻辑点／28骨、低长头、横展后弯角、低沉宽体、横耳、八个分趾壳、四动作、两水牛鞍、BUFFALO_RIDER_FIT及BUFFALO_REIN_PROFILE。不调用其他牛类作者工厂、不新增BovineSystem、不改人物20骨／V5／FBX／衣柜／Cap。共用播放器和生命周期保持。

水牛检查追加至check:mounts及其真实桌面浏览器专项，旧物种矩阵不减。腿位从第一版纳入Body纵向比例约束；蹄底、进食、端点、跨坐、绑定和释放门槛不放宽。没有牛车、耕田、涉水、IK或物理。自动检查不代替用户美术验收，最终只保留原三条正式Actions。

## 接手''')
for path, paragraph in [
 ('Documentation/多坐骑与灰驴.md', 'M8新增真实buffalo_water水牛，src/buffalo独立拥有模型、28骨、四动作和两鞍适配。两工作台自动读取同一目录，不新增页面或空牦牛选项。专项追加至check:mounts和现有浏览器检查，保留此前全部物种矩阵。独立低头／宽角／低宽躯干与腿位作者规则见《水牛.md》。'),
 ('Documentation/骑乘与坐骑挂接.md', 'M8水牛的BUFFALO_RIDER_FIT归src/buffalo/saddles.ts所有，分别适配男女的低宽背跨坐及低宽持缰；人物20骨、Recipe V5、独立绑定、稳定Seat、唯一时钟和换鞍复用不变。水牛不修改原马／驴／骆驼／黄牛作者参数，详细验收边界见《水牛.md》。'),
 ('Documentation/马鞍与缰绳.md', 'M8水牛simple／travel是src/buffalo/saddles.ts独立作者资产，使用低宽厚垫、旅行双袋和小卷包。BUFFALO_REIN_PROFILE提供水牛颈侧导向，bitLeft／bitRight是鼻侧挂点，不是马衔铁；固定双绳及原6毫米制作接触门槛不变。没有新装备槽、实时绳物理或整头免检，具体作者规则见《水牛.md》。')
]:
    write(path, read(path).rstrip() + '\n\n## M8：水牛接入\n\n' + paragraph + '\n')
print('M8 staged independent assets, additive tests, registry, workflow paths and ownership documents.')
