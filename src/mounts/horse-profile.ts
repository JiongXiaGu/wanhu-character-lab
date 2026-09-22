import { HORSE_JOINTS, horseBone } from '../horse/rig';
import { BIT_BIND, buildBridle, buildSaddle } from '../horse/saddles/assets';
import { saddleDefinition } from '../horse/saddles/catalog';
import type { RiderFit, ReinProfile, SaddleProfile } from './types';
import type { BodyType } from '../character/v3/types';

/** M3已认可的马挂接数据，数值原样保留。新动物使用自己的作者配置。 */
export const HORSE_RIDER_FIT: Readonly<Record<BodyType, RiderFit>> = {
  male: { hipsLift: .13, thighDirection: [.72, -.63, .29] },
  female: { hipsLift: .12, thighDirection: [.77, -.59, .245] },
};
export const HORSE_REIN_PROFILE: ReinProfile = { guideBone: 'NeckUpper', guide: [.275, .085, .03], sideClearance: .065, sagScale: 1 };
const head = HORSE_JOINTS[horseBone('Head')].bindWorld;
export const HORSE_SADDLE_PROFILE: SaddleProfile = {
  backBone: 'Spine', headBone: 'Head',
  bitLeft: [BIT_BIND.left[0] - head[0], BIT_BIND.left[1] - head[1], BIT_BIND.left[2] - head[2]],
  bitRight: [BIT_BIND.right[0] - head[0], BIT_BIND.right[1] - head[1], BIT_BIND.right[2] - head[2]],
  seat: id => saddleDefinition(id).seat, buildSaddle, buildBridle,
};
