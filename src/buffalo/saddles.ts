import { CylinderGeometry } from 'three';
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
