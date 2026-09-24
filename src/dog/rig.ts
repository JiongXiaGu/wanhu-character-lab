import type { Joint, Point } from '../livestock/types';

export const DOG_RIG_VERSION = 'wanhu-rural-dog-rig-v1';
export const DOG_BONES = { Root:0, Body:1, Neck:2, Head:3, Tail:4, FrontLegL:5, FrontLegR:6, RearLegL:7, RearLegR:8 } as const;
/** 犬独立的米制绑定，+Z前；四腿挂Root，隔离身体呼吸，不继承猪或坐骑。 */
export const DOG_JOINTS: readonly Joint[] = [
  {name:'Root',parent:-1,position:[0,0,0]},
  {name:'Body',parent:0,position:[0,.486,-.045]},
  {name:'Neck',parent:1,position:[0,.554,.255]},
  {name:'Head',parent:2,position:[0,.638,.335]},
  {name:'Tail',parent:1,position:[0,.586,-.386]},
  {name:'FrontLegL',parent:0,position:[-.113,.495,.177]},
  {name:'FrontLegR',parent:0,position:[.113,.495,.177]},
  {name:'RearLegL',parent:0,position:[-.120,.490,-.285]},
  {name:'RearLegR',parent:0,position:[.120,.490,-.285]},
];
export const DOG_LEGS = [DOG_BONES.FrontLegL,DOG_BONES.FrontLegR,DOG_BONES.RearLegL,DOG_BONES.RearLegR] as const;
/** 作者足底外包用于创建时接地烘焙；无脚掌骨、爪或运行时IK。 */
export function dogSole(bone:number): readonly Point[] {
  if(!DOG_LEGS.some(b=>b===bone))throw new Error(`不是犬腿骨：${bone}`);
  const [x,,z]=DOG_JOINTS[bone].position,front=bone<=DOG_BONES.FrontLegR;
  const center=z+(front?.027:-.007),width=front?.037:.036;
  return [[x-width,.007,center-.05],[x+width,.007,center-.05],[x+width,.007,center+.05],[x-width,.007,center+.05]];
}
