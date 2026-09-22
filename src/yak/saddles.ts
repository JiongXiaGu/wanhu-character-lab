import { CylinderGeometry } from 'three';
import { SaddleBuilder } from '../horse/saddles/geometry';
import type { SaddleId } from '../horse/saddles/catalog';
import type { SaddleProfile, ReinProfile, RiderFit } from '../mounts/types';
import type { BodyType } from '../character/v3/types';
import { YAK_JOINTS, yakBone } from './rig';

export const YAK_SADDLE_VERSION = 'wanhu-yak-saddles-m7-v1';
const spine = YAK_JOINTS[yakBone('Spine')].bindWorld, head = YAK_JOINTS[yakBone('Head')].bindWorld;
const BIT = [.207, .864, 1.545] as const;
/** 专属宽背厚织垫和低坐面，前缘顺应肩部坡度；旅行布包、卷包与绑绳是一件模块。 */
function buildSaddle(id: Exclude<SaddleId, 'none'>) {
  const b = new SaddleBuilder(), travel = id === 'travel', lift = travel ? .018 : 0;
  const cloth = travel ? '#6b7464' : '#9b6b50', leather = '#68503a', trim = '#b29b72';
  const xs = [-.57, -.42, -.21, 0, .21, .42, .57];
  b.plate([[-.50, 1.365], [-.16, 1.41], [.22, 1.49]].map(([z, y]) => ({ z, points: xs.map(x => [x, y + lift - .32 * (x / .57) ** 2] as [number, number]) })), .065, cloth);
  b.plate([[-.33, 1.49], [-.23, 1.46], [.01, 1.46], [.13, 1.52]].map(([z, y]) => ({ z, points: [[-.29, y + lift + .008], [0, y + lift], [.29, y + lift + .008]] as [number, number][] })), .052, leather);
  for (const s of [-1, 1]) {
    b.bar([s * .35, 1.37 + lift, -.32], [s * .35, 1.43 + lift, .17], .04, .04, '#7c674b');
    b.bar([s * .34, 1.39 + lift, .06], [s * .59, .80 + lift, .16], .032, .019, leather);
    b.band([s * .59, .755 + lift, .20], [0, 0, 1], [0, 1, 0], .079, .061, .013, .03, trim, 8);
    b.box([s * .49, 1.21 + lift, .12], [.028, .042, .045], trim);
    if (travel) {
      b.bundle([s * .63, 1.04, -.48], [.25, .35, .39], '#94866c');
      b.box([s * .63, 1.22, -.48], [.26, .032, .38], '#6b7464');
      b.box([s * .76, 1.04, -.48], [.017, .34, .036], leather);
      b.box([s * .77, 1.10, -.48], [.019, .04, .046], trim);
      b.bar([s * .29, 1.46, -.25], [s * .62, 1.24, -.42], .024, .019, '#b6a582');
    }
  }
  if (travel) {
    const roll = new CylinderGeometry(.10, .10, .62, 10, 1, false); roll.rotateZ(Math.PI / 2); roll.translate(0, 1.40, -.71); b.add(roll, '#898774');
    for (const x of [-.20, .20]) {
      b.band([x, 1.40, -.71], [0, 0, 1], [0, 1, 0], .104, .104, .010, .025, '#b6a582', 10);
      b.bar([x, 1.49, -.33], [x, 1.40, -.71], .018, .016, leather);
    }
  }
  return b.finish(spine);
}
function buildBridle() {
  const b = new SaddleBuilder(), leather = '#78624b', trim = '#b29b72';
  b.band([0, .864, 1.545], [1, 0, 0], [0, .866, .5], .203, .105, .009, .032, leather);
  b.band([0, 1.245, 1.145], [1, 0, 0], [0, .948, .318], .265, .214, .009, .025, leather);
  for (const s of [-1, 1]) {
    b.bar([s * BIT[0], BIT[1], BIT[2]], [s * .27, 1.25, 1.145], .019, .014, leather);
    b.band([s * BIT[0], BIT[1], BIT[2]], [0, 0, 1], [0, 1, 0], .023, .023, .008, .014, trim, 8);
  }
  return b.finish(head);
}
export const YAK_SADDLE_PROFILE: SaddleProfile = {
  backBone: 'Spine', headBone: 'Head',
  // 兼容字段表示鼻侧环，不是口内马衔铁。
  bitLeft: [-BIT[0] - head[0], BIT[1] - head[1], BIT[2] - head[2]],
  bitRight: [BIT[0] - head[0], BIT[1] - head[1], BIT[2] - head[2]],
  seat: id => id === 'none' ? null : [0, (id === 'travel' ? 1.478 : 1.46) - spine[1], .02],
  buildSaddle, buildBridle,
};
export const YAK_RIDER_FIT: Readonly<Record<BodyType, RiderFit>> = {
  male: { hipsLift: .18, thighDirection: [1.01, -.46, .43], upperArmDirection: [.30, -.91, .26], forearmDirection: [.08, .02, .995] },
  female: { hipsLift: .17, thighDirection: [1.04, -.48, .40], upperArmDirection: [.30, -.91, .26], forearmDirection: [.08, .02, .995] },
};
export const YAK_REIN_PROFILE: ReinProfile = { guideBone: 'Neck', guide: [.65, .10, .30], sideClearance: .04, sagScale: .42 };
