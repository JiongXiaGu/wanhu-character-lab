import type {Vec3} from '../v3/types';
import type {PropId} from './catalog';
/** 道具局部坐标，单位米（1.76m 标准体型）；与人物世界坐标及腕骨原点分开。 */
export const PROP_ANCHORS = {
  crate: {rightGrip:[.198,.135,-.055],leftGrip:[-.198,.135,-.055],groundCenter:[0,.17,.52]},
  timber: {rightGrip:[0,-.072,.27]},
  firewood: {rightGrip:[.145,.025,.345],leftGrip:[-.145,.025,.345]},
  wheelbarrow: {rightGrip:[.245,.955,.29],leftGrip:[-.245,.955,.29],interactionRoot:[0,0,0],wheelCenter:[0,.225,1.30]},
  hoe: {rightGrip:[0,1.19,0],leftGrip:[0,.99,0],toolContact:[0,-.02,-.01]},
  hammer: {rightGrip:[0,.065,0],toolContact:[0,.38,0],supportHand:[-.16,.886,.37]},
} satisfies Record<PropId,Record<string,Vec3>>;
export const WHEEL_RADIUS=.225;
