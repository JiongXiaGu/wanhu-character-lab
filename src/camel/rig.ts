import type { HorseJoint, HorseWeight } from '../horse/types';

export const CAMEL_RIG_VERSION = 'wanhu-camel-rig-m5-v1';
/** 独立29骨绑定：三段长颈、三段短尾；双峰随躯干蒙皮，不增加软体骨。 */
export const CAMEL_JOINTS: readonly HorseJoint[] = [
  { name: 'Root', parent: -1, bindWorld: [0, 0, 0] },
  { name: 'Pelvis', parent: 0, bindWorld: [0, 1.53, -.64] },
  { name: 'Spine', parent: 1, bindWorld: [0, 1.60, -.04] },
  { name: 'Chest', parent: 2, bindWorld: [0, 1.61, .60] },
  { name: 'NeckBase', parent: 3, bindWorld: [0, 1.50, .81] },
  { name: 'Neck', parent: 4, bindWorld: [0, 1.52, 1.24] },
  { name: 'NeckUpper', parent: 5, bindWorld: [0, 2.02, 1.48] },
  { name: 'Head', parent: 6, bindWorld: [0, 2.46, 1.72] },
  { name: 'FrontLeftUpper', parent: 3, bindWorld: [-.27, 1.51, .64] },
  { name: 'FrontLeftMiddle', parent: 8, bindWorld: [-.27, .88, .70] },
  { name: 'FrontLeftLower', parent: 9, bindWorld: [-.27, .23, .66] },
  { name: 'FrontLeftFoot', parent: 10, bindWorld: [-.27, .10, .74] },
  { name: 'FrontRightUpper', parent: 3, bindWorld: [.27, 1.51, .64] },
  { name: 'FrontRightMiddle', parent: 12, bindWorld: [.27, .88, .70] },
  { name: 'FrontRightLower', parent: 13, bindWorld: [.27, .23, .66] },
  { name: 'FrontRightFoot', parent: 14, bindWorld: [.27, .10, .74] },
  { name: 'BackLeftUpper', parent: 1, bindWorld: [-.28, 1.51, -.73] },
  { name: 'BackLeftMiddle', parent: 16, bindWorld: [-.28, 1.02, -.49] },
  { name: 'BackLeftLower', parent: 17, bindWorld: [-.28, .49, -.81] },
  { name: 'BackLeftFoot', parent: 18, bindWorld: [-.28, .10, -.70] },
  { name: 'BackRightUpper', parent: 1, bindWorld: [.28, 1.51, -.73] },
  { name: 'BackRightMiddle', parent: 20, bindWorld: [.28, 1.02, -.49] },
  { name: 'BackRightLower', parent: 21, bindWorld: [.28, .49, -.81] },
  { name: 'BackRightFoot', parent: 22, bindWorld: [.28, .10, -.70] },
  { name: 'Tail', parent: 1, bindWorld: [0, 1.71, -1.01] },
  { name: 'TailMiddle', parent: 24, bindWorld: [0, 1.32, -1.15] },
  { name: 'TailEnd', parent: 25, bindWorld: [0, 1.02, -1.19] },
  { name: 'LeftEar', parent: 7, bindWorld: [-.116, 2.51, 1.735] },
  { name: 'RightEar', parent: 7, bindWorld: [.116, 2.51, 1.735] },
];
export function camelBone(name: string): number {
  const index = CAMEL_JOINTS.findIndex(joint => joint.name === name);
  if (index < 0) throw new Error(`未知骆驼骨骼：${name}`);
  return index;
}
export function weight(a: string, b = a, w = 1): HorseWeight { return [camelBone(a), camelBone(b), w]; }
