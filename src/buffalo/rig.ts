import type { HorseJoint, HorseWeight } from '../horse/types';

export const BUFFALO_RIG_VERSION = 'wanhu-buffalo-rig-m8-v1';
/** 水牛独立28骨；低头、低宽背和纵向承重点均在米制绑定空间作者化。 */
export const BUFFALO_JOINTS: readonly HorseJoint[] = [
  { name: 'Root', parent: -1, bindWorld: [0, 0, 0] },
  { name: 'Pelvis', parent: 0, bindWorld: [0, 1.00, -.78] },
  { name: 'Spine', parent: 1, bindWorld: [0, 1.05, -.18] },
  { name: 'Chest', parent: 2, bindWorld: [0, 1.07, .52] },
  { name: 'NeckBase', parent: 3, bindWorld: [0, 1.00, .69] },
  { name: 'Neck', parent: 4, bindWorld: [0, 1.09, .96] },
  { name: 'Head', parent: 5, bindWorld: [0, 1.11, 1.17] },
  { name: 'FrontLeftUpper', parent: 3, bindWorld: [-.375, 1.04, .59] },
  { name: 'FrontLeftMiddle', parent: 7, bindWorld: [-.375, .58, .61] },
  { name: 'FrontLeftLower', parent: 8, bindWorld: [-.375, .18, .61] },
  { name: 'FrontLeftFoot', parent: 9, bindWorld: [-.375, .077, .65] },
  { name: 'FrontRightUpper', parent: 3, bindWorld: [.375, 1.04, .59] },
  { name: 'FrontRightMiddle', parent: 11, bindWorld: [.375, .58, .61] },
  { name: 'FrontRightLower', parent: 12, bindWorld: [.375, .18, .61] },
  { name: 'FrontRightFoot', parent: 13, bindWorld: [.375, .077, .65] },
  { name: 'BackLeftUpper', parent: 1, bindWorld: [-.385, 1.04, -.91] },
  { name: 'BackLeftMiddle', parent: 15, bindWorld: [-.385, .73, -.71] },
  { name: 'BackLeftLower', parent: 16, bindWorld: [-.385, .31, -.92] },
  { name: 'BackLeftFoot', parent: 17, bindWorld: [-.385, .077, -.88] },
  { name: 'BackRightUpper', parent: 1, bindWorld: [.385, 1.04, -.91] },
  { name: 'BackRightMiddle', parent: 19, bindWorld: [.385, .73, -.71] },
  { name: 'BackRightLower', parent: 20, bindWorld: [.385, .31, -.92] },
  { name: 'BackRightFoot', parent: 21, bindWorld: [.385, .077, -.88] },
  { name: 'Tail', parent: 1, bindWorld: [0, 1.13, -1.16] },
  { name: 'TailMiddle', parent: 23, bindWorld: [0, .77, -1.27] },
  { name: 'TailEnd', parent: 24, bindWorld: [0, .43, -1.30] },
  { name: 'LeftEar', parent: 6, bindWorld: [-.23, 1.10, 1.18] },
  { name: 'RightEar', parent: 6, bindWorld: [.23, 1.10, 1.18] },
];
export function buffaloBone(name: string): number {
  const index = BUFFALO_JOINTS.findIndex(joint => joint.name === name);
  if (index < 0) throw new Error(`未知水牛骨骼：${name}`);
  return index;
}
export function weight(a: string, b = a, w = 1): HorseWeight { return [buffaloBone(a), buffaloBone(b), w]; }
