export const MIXAMO_SCHEMA = 1;
export const RETARGET_VERSION = 'wanhu-mixamo-2';
/** 索引与目标 20 Bone ID 一致；Root 为目标生成的原点，不取自 FBX。 */
export const SOURCE_BONES = [
  '', 'Hips', 'Spine', 'Spine2', 'Neck', 'Head',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftUpLeg', 'LeftLeg', 'LeftFoot',
] as const;
/** 手/足端点用于骨段校准；头顶端点仅用于源骨架显示，不代表面朝向。 */
export const SOURCE_ENDPOINTS = ['HeadTop_End', 'RightHandMiddle1', 'LeftHandMiddle1', 'RightToeBase', 'LeftToeBase'] as const;
export const SAMPLE_BONES = [...SOURCE_BONES, ...SOURCE_ENDPOINTS] as const;
export const SAMPLE_BONE_COUNT = SAMPLE_BONES.length;
export const SAMPLE_PARENTS = [-1, 0, 1, 2, 3, 4, 3, 6, 7, 8, 3, 10, 11, 12, 1, 14, 15, 1, 17, 18, 5, 9, 13, 16, 19] as const;
export const CALIBRATION_CHILD = [-1, 2, 3, 4, 5, 20, 7, 8, 9, 21, 11, 12, 13, 22, 15, 16, 23, 18, 19, 24] as const;

/** 离线提取的源动作。positions 和 bindPositions 以米为单位，尚未按目标体型缩放。 */
export interface MixamoMotionData {
  schema: number;
  id: string;
  source: {
    provider: 'Mixamo' | 'BVH'; file: string; sha256: string; clipName: string; extractorVersion?: string;
    uniqueBones: number; rawBoneNodes: number; tracks: number;
    threeVersion: string; axisConversion: string;
  };
  duration: number;
  fps: number;
  times: number[];
  names: string[];
  parents: number[];
  bindPositions: number[];
  /** 每帧每个目标语义骨骼相对源绑定姿态的世界旋转差，xyzw。 */
  worldDeltas: number[];
  /** 每帧 25 个源关节点的位置；只用于重定向和源骨架对照，不含外部网格。 */
  positions: number[];
}

export function validateMixamoData(data: MixamoMotionData, id: string): void {
  const count = data?.times?.length;
  if (data?.schema !== MIXAMO_SCHEMA || data.id !== id || !Number.isFinite(data.duration) || data.duration <= 0 || data.duration > 120 || !count || count < 2 || count > 7202)
    throw new Error('Mixamo 动画数据版本、ID 或时长无效，请运行 npm run prepare:mixamo。');
  const equal = (a: readonly unknown[], b: readonly unknown[]) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
  if (!equal(data.names, SAMPLE_BONES) || !equal(data.parents, SAMPLE_PARENTS)) throw new Error('Mixamo 关节映射不匹配。');
  for (const [array, length] of [[data.bindPositions, SAMPLE_BONE_COUNT * 3], [data.worldDeltas, count * 20 * 4], [data.positions, count * SAMPLE_BONE_COUNT * 3]] as const) {
    if (!Array.isArray(array) || array.length !== length || !array.every(Number.isFinite)) throw new Error('Mixamo 采样数组损坏。');
  }
  if (!Number.isFinite(data.fps) || data.fps <= 0 || data.times[0] !== 0 || Math.abs(data.times[count - 1] - data.duration) > 1e-5 || data.times.some((v, i) => !Number.isFinite(v) || (i > 0 && v <= data.times[i - 1]))) throw new Error('Mixamo 时间轴必须严格递增且包含完整末帧。');
  for (let i = 0; i < data.worldDeltas.length; i += 4) {
    if (Math.abs(Math.hypot(...data.worldDeltas.slice(i, i + 4)) - 1) > 1e-4) throw new Error('Mixamo 四元数没有归一化。');
  }
}
