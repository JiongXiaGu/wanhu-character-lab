import { CylinderGeometry } from 'three';
import { SaddleBuilder } from '../horse/saddles/geometry';
import type { SaddleId } from '../horse/saddles/catalog';
import type { SaddleProfile, ReinProfile, RiderFit } from '../mounts/types';
import type { BodyType } from '../character/v3/types';
import { DONKEY_JOINTS, donkeyBone } from './rig';

const spine = DONKEY_JOINTS[donkeyBone('Spine')].bindWorld, head = DONKEY_JOINTS[donkeyBone('Head')].bindWorld;
const BITS = { left: [-.127, 1.428, 1.090], right: [.127, 1.428, 1.090] } as const;
function buildSaddle(id: Exclude<SaddleId, 'none'>) {
  const b = new SaddleBuilder(), travel = id === 'travel', lift = travel ? .015 : 0;
  const leather = '#67503b', cloth = travel ? '#596957' : '#978660', trim = '#b49a65';
  const xs = [-.275, -.21, -.105, 0, .105, .21, .275];
  b.plate([-.37, .24].map(z => ({ z, points: xs.map(x => [x, 1.35 + lift - .20 * (x / .275) ** 2] as [number, number]) })), .018, cloth);
  b.plate([[-.27, 1.48, .16], [-.13, 1.385, .14], [.08, 1.385, .14], [.19, 1.475, .16]].map(([z, y, width]) => ({ z, points: [[-width, y + lift + .01], [0, y + lift], [width, y + lift + .01]] as [number, number][] })), .036, leather);
  for (const s of [-1, 1]) {
    b.bar([s * .19, 1.32 + lift, .06], [s * .428, .75 + lift, .10], .019, .012, leather);
    b.band([s * .428, .719 + lift, .137], [0, 0, 1], [0, 1, 0], .069, .059, .010, .023, trim, 8);
    b.box([s * .22, 1.29 + lift, .06], [.032, .035, .023], trim);
  }
  if (travel) {
    for (const s of [-1, 1]) {
      b.bundle([s * .359, 1.15, -.44], [.175, .22, .25], '#a18b61');
      b.box([s * .359, 1.264, -.44], [.184, .026, .235], '#6d6246');
      b.box([s * .449, 1.15, -.44], [.013, .215, .024], leather);
      b.box([s * .456, 1.195, -.44], [.015, .028, .032], trim);
      b.bar([s * .18, 1.39, -.25], [s * .335, 1.27, -.43], .022, .012, leather);
    }
    const roll = new CylinderGeometry(.067, .067, .43, 8, 1, false); roll.rotateZ(Math.PI / 2); roll.translate(0, 1.425, -.43); b.add(roll, '#8e9377');
    for (const x of [-.13, .13]) b.band([x, 1.425, -.43], [0, 0, 1], [0, 1, 0], .071, .071, .008, .02, leather, 8);
  }
  return b.finish(spine);
}
function buildBridle() {
  const b = new SaddleBuilder(), leather = '#4b3d30', trim = '#b49a65';
  b.band([0, 1.428, 1.079], [1, 0, 0], [0, .72, .694], .124, .102, .010, .028, leather);
  b.band([0, 1.647, .864], [1, 0, 0], [0, .75, .661], .143, .166, .009, .023, leather);
  for (const s of [-1, 1]) {
    b.bar([s * .132, 1.433, 1.080], [s * .147, 1.63, .88], .017, .010, leather);
    b.band([s * .132, 1.428, 1.090], [0, 0, 1], [0, 1, 0], .021, .021, .007, .010, trim, 8);
  }
  return b.finish(head);
}
export const DONKEY_SADDLE_PROFILE: SaddleProfile = {
  backBone: 'Spine', headBone: 'Head',
  bitLeft: [BITS.left[0] - head[0], BITS.left[1] - head[1], BITS.left[2] - head[2]],
  bitRight: [BITS.right[0] - head[0], BITS.right[1] - head[1], BITS.right[2] - head[2]],
  seat: id => id === 'none' ? null : [0, (id === 'travel' ? 1.400 : 1.385) - spine[1], .08],
  buildSaddle, buildBridle,
};
export const DONKEY_RIDER_FIT: Readonly<Record<BodyType, RiderFit>> = {
  male: { hipsLift: .13, thighDirection: [.60, -.72, .345] },
  female: { hipsLift: .12, thighDirection: [.66, -.68, .315] },
};
export const DONKEY_REIN_PROFILE: ReinProfile = { guideBone: 'NeckUpper', guide: [.245, .06, .025], sideClearance: .06, sagScale: .85 };
