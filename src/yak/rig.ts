import type { HorseJoint, HorseWeight } from '../horse/types';

export const YAK_RIG_VERSION = 'wanhu-yak-rig-m7-v1';
/** 独立米制绑定：低宽前躯、低头、短腿、三段蓬尾；仅一根额毛骨，不是毛发系统。 */
export const YAK_JOINTS: readonly HorseJoint[] = [
  { name: 'Root', parent: -1, bindWorld: [0, 0, 0] },
  { name: 'Pelvis', parent: 0, bindWorld: [0, 1.02, -.62] },
  { name: 'Spine', parent: 1, bindWorld: [0, 1.04, -.14] },
  { name: 'Chest', parent: 2, bindWorld: [0, 1.13, .43] },
  { name: 'NeckBase', parent: 3, bindWorld: [0, 1.00, .56] },
  { name: 'Neck', parent: 4, bindWorld: [0, 1.125, .87] },
  { name: 'Head', parent: 5, bindWorld: [0, 1.23, 1.10] },
  { name: 'FrontLeftUpper', parent: 3, bindWorld: [-.38, 1.04, .50] },
  { name: 'FrontLeftMiddle', parent: 7, bindWorld: [-.38, .57, .53] },
  { name: 'FrontLeftLower', parent: 8, bindWorld: [-.38, .18, .53] },
  { name: 'FrontLeftFoot', parent: 9, bindWorld: [-.38, .075, .56] },
  { name: 'FrontRightUpper', parent: 3, bindWorld: [.38, 1.04, .50] },
  { name: 'FrontRightMiddle', parent: 11, bindWorld: [.38, .57, .53] },
  { name: 'FrontRightLower', parent: 12, bindWorld: [.38, .18, .53] },
  { name: 'FrontRightFoot', parent: 13, bindWorld: [.38, .075, .56] },
  { name: 'BackLeftUpper', parent: 1, bindWorld: [-.37, 1.02, -.78] },
  { name: 'BackLeftMiddle', parent: 15, bindWorld: [-.37, .72, -.57] },
  { name: 'BackLeftLower', parent: 16, bindWorld: [-.37, .32, -.78] },
  { name: 'BackLeftFoot', parent: 17, bindWorld: [-.37, .075, -.76] },
  { name: 'BackRightUpper', parent: 1, bindWorld: [.37, 1.02, -.78] },
  { name: 'BackRightMiddle', parent: 19, bindWorld: [.37, .72, -.57] },
  { name: 'BackRightLower', parent: 20, bindWorld: [.37, .32, -.78] },
  { name: 'BackRightFoot', parent: 21, bindWorld: [.37, .075, -.76] },
  { name: 'Tail', parent: 1, bindWorld: [0, 1.16, -.99] },
  { name: 'TailMiddle', parent: 23, bindWorld: [0, .88, -1.17] },
  { name: 'TailEnd', parent: 24, bindWorld: [0, .55, -1.22] },
  { name: 'LeftEar', parent: 6, bindWorld: [-.21, 1.235, 1.14] },
  { name: 'RightEar', parent: 6, bindWorld: [.21, 1.235, 1.14] },
  { name: 'Forelock', parent: 6, bindWorld: [0, 1.35, 1.10] },
];
export function yakBone(name: string): number {
  const index = YAK_JOINTS.findIndex(joint => joint.name === name);
  if (index < 0) throw new Error(`未知牦牛骨骼：${name}`);
  return index;
}
export function weight(a: string, b = a, w = 1): HorseWeight { return [yakBone(a), yakBone(b), w]; }
