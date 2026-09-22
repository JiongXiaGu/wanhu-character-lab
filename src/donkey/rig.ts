import type { HorseJoint, HorseWeight } from '../horse/types';

/** 灰驴独立绑定；前25个是四足语义，另加两耳骨，不修改马的25骨调色板。 */
export const DONKEY_JOINTS: readonly HorseJoint[] = [
  { name: 'Root', parent: -1, bindWorld: [0, 0, 0] },
  { name: 'Pelvis', parent: 0, bindWorld: [0, 1.04, -.44] },
  { name: 'Spine', parent: 1, bindWorld: [0, 1.085, -.08] },
  { name: 'Chest', parent: 2, bindWorld: [0, 1.12, .34] },
  { name: 'Neck', parent: 3, bindWorld: [0, 1.10, .47] },
  { name: 'NeckUpper', parent: 4, bindWorld: [0, 1.42, .67] },
  { name: 'Head', parent: 5, bindWorld: [0, 1.625, .79] },
  { name: 'FrontLeftUpper', parent: 3, bindWorld: [-.20, 1.04, .40] },
  { name: 'FrontLeftMiddle', parent: 7, bindWorld: [-.20, .625, .455] },
  { name: 'FrontLeftLower', parent: 8, bindWorld: [-.20, .19, .445] },
  { name: 'FrontLeftHoof', parent: 9, bindWorld: [-.20, .087, .505] },
  { name: 'FrontRightUpper', parent: 3, bindWorld: [.20, 1.04, .40] },
  { name: 'FrontRightMiddle', parent: 11, bindWorld: [.20, .625, .455] },
  { name: 'FrontRightLower', parent: 12, bindWorld: [.20, .19, .445] },
  { name: 'FrontRightHoof', parent: 13, bindWorld: [.20, .087, .505] },
  { name: 'BackLeftUpper', parent: 1, bindWorld: [-.215, 1.045, -.515] },
  { name: 'BackLeftMiddle', parent: 15, bindWorld: [-.215, .760, -.345] },
  { name: 'BackLeftLower', parent: 16, bindWorld: [-.215, .39, -.62] },
  { name: 'BackLeftHoof', parent: 17, bindWorld: [-.215, .087, -.58] },
  { name: 'BackRightUpper', parent: 1, bindWorld: [.215, 1.045, -.515] },
  { name: 'BackRightMiddle', parent: 19, bindWorld: [.215, .760, -.345] },
  { name: 'BackRightLower', parent: 20, bindWorld: [.215, .39, -.62] },
  { name: 'BackRightHoof', parent: 21, bindWorld: [.215, .087, -.58] },
  { name: 'Tail', parent: 1, bindWorld: [0, 1.20, -.79] },
  { name: 'TailEnd', parent: 23, bindWorld: [0, .73, -.91] },
  { name: 'LeftEar', parent: 6, bindWorld: [-.083, 1.705, .82] },
  { name: 'RightEar', parent: 6, bindWorld: [.083, 1.705, .82] },
];
export const DONKEY_RIG_VERSION = 'wanhu-donkey-rig-m4-v1';
export function donkeyBone(name: string) { const i = DONKEY_JOINTS.findIndex(j => j.name === name); if (i < 0) throw new Error(`未知灰驴骨骼：${name}`); return i; }
export function weight(a: string, b = a, w = 1): HorseWeight { return [donkeyBone(a), donkeyBone(b), w]; }
