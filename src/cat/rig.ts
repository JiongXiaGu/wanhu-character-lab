import type { Joint, Point } from '../livestock/types';

export const CAT_RIG_VERSION = 'wanhu-rural-cat-rig-v1';
export const CAT_BONES = { Root: 0, Body: 1, Neck: 2, Head: 3, Tail: 4, FrontLegL: 5, FrontLegR: 6, RearLegL: 7, RearLegR: 8 } as const;
/** 猫自己的米制绑定，+Z朝前；整腿挂Root，隔离躯干呼吸。 */
export const CAT_JOINTS: readonly Joint[] = [
  { name: 'Root', parent: -1, position: [0, 0, 0] },
  { name: 'Body', parent: 0, position: [0, .285, -.02] },
  { name: 'Neck', parent: 1, position: [0, .321, .135] },
  { name: 'Head', parent: 2, position: [0, .374, .20] },
  { name: 'Tail', parent: 1, position: [0, .323, -.22] },
  { name: 'FrontLegL', parent: 0, position: [-.074, .287, .104] },
  { name: 'FrontLegR', parent: 0, position: [.074, .287, .104] },
  { name: 'RearLegL', parent: 0, position: [-.080, .282, -.160] },
  { name: 'RearLegR', parent: 0, position: [.080, .282, -.160] },
];
export const CAT_LEGS = [CAT_BONES.FrontLegL, CAT_BONES.FrontLegR, CAT_BONES.RearLegL, CAT_BONES.RearLegR] as const;
export const CAT_TAIL_ROOT: Point = [0, .313, -.216];
/** 作者足底外包，只在烘焙轨道时接地；无脚掌骨或运行时IK。 */
export function catSole(bone: number): readonly Point[] {
  if (!CAT_LEGS.some(value => value === bone)) throw new Error(`不是猫腿骨：${bone}`);
  const x = CAT_JOINTS[bone].position[0], front = bone <= CAT_BONES.FrontLegR;
  const z = front ? .120 : -.175, radius = front ? .031 : .032;
  return [[x - .026, .006, z - radius], [x + .026, .006, z - radius], [x + .026, .006, z + radius], [x - .026, .006, z + radius]];
}
