import { CylinderGeometry } from 'three';
import { SaddleBuilder } from '../horse/saddles/geometry';
import type { SaddleId } from '../horse/saddles/catalog';
import type { SaddleProfile, ReinProfile, RiderFit } from '../mounts/types';
import type { BodyType } from '../character/v3/types';
import { CATTLE_JOINTS, cattleBone } from './rig';

export const CATTLE_SADDLE_VERSION = 'wanhu-cattle-saddles-m6-v1';
const spine = CATTLE_JOINTS[cattleBone('Spine')].bindWorld, head = CATTLE_JOINTS[cattleBone('Head')].bindWorld;
const BIT = [.180, 1.09, 1.434] as const;
/** 低、宽、平的牛背厚垫；两款均为整体模块，不调用马鞍/驼鞍作者工厂。 */
function buildSaddle(id: Exclude<SaddleId, 'none'>) {
  const b = new SaddleBuilder(), travel = id === 'travel', lift = travel ? .016 : 0;
  const cloth = travel ? '#737650' : '#985b43', leather = '#725535', trim = '#b29a66';
  const xs = [-.49, -.36, -.18, 0, .18, .36, .49];
  b.plate([-.39, .34].map(z => ({ z, points: xs.map(x => [x, 1.445 + lift - .34 * (x / .49) ** 2] as [number, number]) })), .04, cloth);
  b.plate([[-.29, 1.505, .245], [-.17, 1.485, .245], [.15, 1.485, .245], [.28, 1.515, .24]].map(([z, y, w]) => ({ z, points: [[-w, y + lift + .007], [0, y + lift], [w, y + lift + .007]] as [number, number][] })), .05, leather);
  for (const s of [-1, 1]) {
    b.bar([s * .29, 1.37 + lift, -.28], [s * .29, 1.37 + lift, .26], .035, .045, '#756143');
    b.bar([s * .30, 1.35 + lift, .10], [s * .53, .85 + lift, .18], .028, .016, leather);
    b.band([s * .53, .805 + lift, .205], [0, 0, 1], [0, 1, 0], .077, .06, .012, .028, trim, 8);
    b.box([s * .43, 1.18 + lift, .13], [.029, .041, .039], trim);
    if (travel) {
      b.bundle([s * .55, 1.12, -.43], [.23, .30, .35], '#a79364');
      b.box([s * .55, 1.274, -.43], [.235, .030, .33], '#6b704c');
      b.box([s * .673, 1.12, -.43], [.016, .29, .034], leather);
      b.box([s * .683, 1.17, -.43], [.018, .036, .043], trim);
      b.bar([s * .26, 1.46, -.25], [s * .55, 1.28, -.37], .021, .015, leather);
    }
  }
  if (travel) {
    const roll = new CylinderGeometry(.071, .071, .48, 8, 1, false); roll.rotateZ(Math.PI / 2); roll.translate(0, 1.48, -.60); b.add(roll, '#8d8360');
    for (const x of [-.15, .15]) {
      b.band([x, 1.48, -.60], [0, 0, 1], [0, 1, 0], .075, .075, .009, .022, leather, 8);
      b.bar([x, 1.48, -.29], [x, 1.44, -.60], .015, .014, leather);
    }
  }
  return b.finish(spine);
}
function buildBridle() {
  const b = new SaddleBuilder(), leather = '#675039', trim = '#b29a66';
  // 鼻带与左右鼻侧环；bitLeft/Right沿用契约字段，不表示牛嘴里有马衔铁。
  b.band([0, 1.09, 1.434], [1, 0, 0], [0, .866, .5], .176, .103, .009, .028, leather);
  b.band([0, 1.425, 1.07], [1, 0, 0], [0, .948, .318], .244, .196, .009, .023, leather);
  for (const s of [-1, 1]) {
    b.bar([s * .18, 1.09, 1.434], [s * .24, 1.43, 1.08], .017, .012, leather);
    b.band([s * BIT[0], BIT[1], BIT[2]], [0, 0, 1], [0, 1, 0], .021, .021, .007, .012, trim, 8);
  }
  return b.finish(head);
}
export const CATTLE_SADDLE_PROFILE: SaddleProfile = {
  backBone: 'Spine', headBone: 'Head',
  bitLeft: [-BIT[0] - head[0], BIT[1] - head[1], BIT[2] - head[2]],
  bitRight: [BIT[0] - head[0], BIT[1] - head[1], BIT[2] - head[2]],
  seat: id => id === 'none' ? null : [0, (id === 'travel' ? 1.501 : 1.485) - spine[1], .06],
  buildSaddle, buildBridle,
};
export const CATTLE_RIDER_FIT: Readonly<Record<BodyType, RiderFit>> = {
  male: { hipsLift: .16, thighDirection: [.81, -.57, .35], upperArmDirection: [.18, -.92, .35], forearmDirection: [-.04, .10, .99] },
  female: { hipsLift: .15, thighDirection: [.84, -.54, .35], upperArmDirection: [.18, -.92, .35], forearmDirection: [-.04, .10, .99] },
};
export const CATTLE_REIN_PROFILE: ReinProfile = { guideBone: 'Neck', guide: [.50, .39, .25], sideClearance: .035, sagScale: .45 };
