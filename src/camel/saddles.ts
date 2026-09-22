import { CylinderGeometry } from 'three';
import { SaddleBuilder } from '../horse/saddles/geometry';
import type { SaddleId } from '../horse/saddles/catalog';
import type { SaddleProfile, ReinProfile, RiderFit } from '../mounts/types';
import type { BodyType } from '../character/v3/types';
import { CAMEL_JOINTS, camelBone } from './rig';

export const CAMEL_SADDLE_VERSION = 'wanhu-camel-saddles-m5-v1';
const spine = CAMEL_JOINTS[camelBone('Spine')].bindWorld, head = CAMEL_JOINTS[camelBone('Head')].bindWorld;
const BIT = [.125, 2.414, 2.14] as const;
/** 普通/旅行都是整套驼鞍；厚垫坐在两峰之间，不把马鞍放大套在峰顶。 */
function buildSaddle(id: Exclude<SaddleId, 'none'>) {
  const b = new SaddleBuilder(), travel = id === 'travel', lift = travel ? .018 : 0;
  const cloth = travel ? '#706d4d' : '#8f5141', leather = '#69513a', trim = '#b49a65';
  const xs = [-.435, -.32, -.16, 0, .16, .32, .435];
  b.plate([-.36, .30].map(z => ({ z, points: xs.map(x => [x, 1.985 + lift - .36 * (x / .435) ** 2] as [number, number]) })), .035, cloth);
  b.plate([[-.27, 2.055, .205], [-.15, 2.025, .19], [.12, 2.025, .19], [.24, 2.055, .205]].map(([z, y, w]) => ({ z, points: [[-w, y + lift + .015], [0, y + lift], [w, y + lift + .015]] as [number, number][] })), .06, leather);
  for (const s of [-1, 1]) {
    // 侧架与脚蹬避开两个驼峰；装饰结构全部闭合。
    b.bar([s * .255, 1.90 + lift, -.30], [s * .255, 1.90 + lift, .25], .035, .045, '#756143');
    b.bar([s * .27, 1.88 + lift, .09], [s * .48, 1.35 + lift, .14], .026, .015, leather);
    b.band([s * .48, 1.305 + lift, .18], [0, 0, 1], [0, 1, 0], .075, .065, .012, .028, trim, 8);
    b.box([s * .38, 1.72 + lift, .10], [.027, .043, .040], trim);
    if (travel) {
      b.bundle([s * .49, 1.55, -.48], [.245, .34, .39], '#a18b61');
      b.box([s * .49, 1.727, -.48], [.252, .034, .365], '#62674d');
      b.box([s * .617, 1.55, -.48], [.017, .33, .037], leather);
      b.box([s * .628, 1.61, -.48], [.019, .04, .046], trim);
      b.bar([s * .22, 1.99, -.25], [s * .49, 1.73, -.39], .028, .015, leather);
      b.bundle([s * .46, 1.50, .29], [.145, .235, .17], '#80634b');
      b.bar([s * .38, 1.86, .22], [s * .46, 1.63, .29], .018, .012, leather);
    }
  }
  if (travel) {
    // 卷毯放在后峰后下方，不横穿峰体或挤占骑手坐面。
    const roll = new CylinderGeometry(.08, .08, .55, 8, 1, false); roll.rotateZ(Math.PI / 2); roll.translate(0, 1.91, -1.01); b.add(roll, '#817d61');
    for (const x of [-.17, .17]) {
      b.band([x, 1.91, -1.01], [0, 0, 1], [0, 1, 0], .084, .084, .01, .025, leather, 8);
      b.bar([x, 1.92, -.30], [x * 2, 1.77, -.66], .022, .015, leather);
    }
  }
  return b.finish(spine);
}
function buildBridle() {
  const b = new SaddleBuilder(), leather = '#564333', trim = '#b49a65';
  // 鼻带与鼻侧挂环，无衔铁；bit字段只是共享端点契约，不要求挂在嘴里。
  b.band([0, 2.407, 2.14], [1, 0, 0], [0, .985, .173], .12, .088, .009, .028, leather);
  b.band([0, 2.49, 1.78], [1, 0, 0], [0, .998, -.06], .14, .145, .009, .025, leather);
  for (const s of [-1, 1]) {
    b.bar([s * .13, 2.414, 2.14], [s * .14, 2.495, 1.80], .018, .012, leather);
    b.band([s * .13, BIT[1], BIT[2]], [0, 0, 1], [0, 1, 0], .021, .021, .007, .011, trim, 8);
  }
  return b.finish(head);
}
export const CAMEL_SADDLE_PROFILE: SaddleProfile = {
  backBone: 'Spine', headBone: 'Head',
  bitLeft: [-BIT[0] - head[0], BIT[1] - head[1], BIT[2] - head[2]],
  bitRight: [BIT[0] - head[0], BIT[1] - head[1], BIT[2] - head[2]],
  seat: id => id === 'none' ? null : [0, (id === 'travel' ? 2.043 : 2.025) - spine[1], .01],
  buildSaddle, buildBridle,
};
export const CAMEL_RIDER_FIT: Readonly<Record<BodyType, RiderFit>> = {
  male: { hipsLift: .14, thighDirection: [.70, -.64, .33], upperArmDirection: [.08, -.84, .54], forearmDirection: [-.20, .36, .92] },
  female: { hipsLift: .13, thighDirection: [.76, -.61, .32], upperArmDirection: [.08, -.84, .54], forearmDirection: [-.20, .36, .92] },
};
export const CAMEL_REIN_PROFILE: ReinProfile = { guideBone: 'NeckUpper', guide: [.42, .12, -.05], sideClearance: .055, sagScale: .60 };
