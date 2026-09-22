import type { HorseJoint, HorseWeight } from '../horse/types';

export const CATTLE_RIG_VERSION = 'wanhu-cattle-rig-m6-v2';
/** 黄牛独立28骨：短颈两段、四腿各四骨、细尾三段、双耳；角不新增骨骼。 */
export const CATTLE_JOINTS: readonly HorseJoint[] = [
  { name: 'Root', parent: -1, bindWorld: [0, 0, 0] },
  { name: 'Pelvis', parent: 0, bindWorld: [0, 1.12, -.57] },
  { name: 'Spine', parent: 1, bindWorld: [0, 1.14, -.07] },
  { name: 'Chest', parent: 2, bindWorld: [0, 1.18, .44] },
  { name: 'NeckBase', parent: 3, bindWorld: [0, 1.055, .48] },
  { name: 'Neck', parent: 4, bindWorld: [0, 1.27, .76] },
  { name: 'Head', parent: 5, bindWorld: [0, 1.435, 1.0] },
  { name: 'FrontLeftUpper', parent: 3, bindWorld: [-.31, 1.12, .48] },
  { name: 'FrontLeftMiddle', parent: 7, bindWorld: [-.31, .62, .515] },
  { name: 'FrontLeftLower', parent: 8, bindWorld: [-.31, .18, .515] },
  { name: 'FrontLeftFoot', parent: 9, bindWorld: [-.31, .075, .56] },
  { name: 'FrontRightUpper', parent: 3, bindWorld: [.31, 1.12, .48] },
  { name: 'FrontRightMiddle', parent: 11, bindWorld: [.31, .62, .515] },
  { name: 'FrontRightLower', parent: 12, bindWorld: [.31, .18, .515] },
  { name: 'FrontRightFoot', parent: 13, bindWorld: [.31, .075, .56] },
  { name: 'BackLeftUpper', parent: 1, bindWorld: [-.32, 1.12, -.71] },
  { name: 'BackLeftMiddle', parent: 15, bindWorld: [-.32, .78, -.51] },
  { name: 'BackLeftLower', parent: 16, bindWorld: [-.32, .35, -.73] },
  { name: 'BackLeftFoot', parent: 17, bindWorld: [-.32, .075, -.69] },
  { name: 'BackRightUpper', parent: 1, bindWorld: [.32, 1.12, -.71] },
  { name: 'BackRightMiddle', parent: 19, bindWorld: [.32, .78, -.51] },
  { name: 'BackRightLower', parent: 20, bindWorld: [.32, .35, -.73] },
  { name: 'BackRightFoot', parent: 21, bindWorld: [.32, .075, -.69] },
  { name: 'Tail', parent: 1, bindWorld: [0, 1.28, -.92] },
  { name: 'TailMiddle', parent: 23, bindWorld: [0, .94, -1.015] },
  { name: 'TailEnd', parent: 24, bindWorld: [0, .62, -1.025] },
  { name: 'LeftEar', parent: 6, bindWorld: [-.20, 1.40, 1.025] },
  { name: 'RightEar', parent: 6, bindWorld: [.20, 1.40, 1.025] },
];
export function cattleBone(name: string): number {
  const index = CATTLE_JOINTS.findIndex(joint => joint.name === name);
  if (index < 0) throw new Error(`未知黄牛骨骼：${name}`);
  return index;
}
export function weight(a: string, b = a, w = 1): HorseWeight { return [cattleBone(a), cattleBone(b), w]; }
