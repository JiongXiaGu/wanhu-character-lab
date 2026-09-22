import type { AnimationClip, AnimationMixer, Bone, BufferGeometry, MeshStandardMaterial, Skeleton, SkeletonHelper, SkinnedMesh } from 'three';
import type { BodyType } from '../character/v3/types';
import type { HorseMeshData, HorseStats } from '../horse/types';
import type { SaddleId, Point } from '../horse/saddles/catalog';

export const MOUNT_IDS = ['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow', 'yak_black', 'buffalo_water'] as const;
export type MountId = typeof MOUNT_IDS[number];
export const MOUNT_MOTIONS = ['idle', 'walk', 'run', 'eat'] as const;
export type MountMotion = typeof MOUNT_MOTIONS[number];
export type MountSelection = MountMotion | 'bind';
export const MOUNT_FPS = 30;
/** 最小装配契约，不限制骨骼数量，也不生成通用四足模型。网格数据沿用现有双权重布局。 */
export interface MountActor {
  data: HorseMeshData; bones: Bone[]; skeleton: Skeleton; mesh: SkinnedMesh;
  material: MeshStandardMaterial; helper: SkeletonHelper; mixer: AnimationMixer; stats: HorseStats;
  reset(): void; sync(): void; dispose(): void;
}
export interface RiderFit {
  hipsLift: number; thighDirection: Point;
  /** 可选作者持缰方向；未配置的马/驴严格保留原M3手臂数值。X为右手方向，左手镜像。 */
  upperArmDirection?: Point; forearmDirection?: Point;
}
export interface SaddleProfile {
  backBone: string; headBone: string; bitLeft: Point; bitRight: Point;
  seat(id: SaddleId): Point | null;
  buildSaddle(id: Exclude<SaddleId, 'none'>): BufferGeometry;
  buildBridle(): BufferGeometry;
}
export interface ReinProfile { guideBone: string; guide: Point; sideClearance: number; sagScale: number }
export interface MountMotionDefinition { nativeId: string; duration: number; label: string; description: string }
export interface MountDefinition {
  id: MountId; name: string; description: string;
  createActor(): MountActor;
  bakeClips(): Map<MountMotion, AnimationClip>;
  motions: Readonly<Record<MountMotion, MountMotionDefinition>>;
  saddle: SaddleProfile; reins: ReinProfile; riderFit: Readonly<Record<BodyType, RiderFit>>;
  backPitch(motion: MountMotion, phase: number): number;
  frame: { bodyY: number; ridingY: number; bodyHalf: number; ridingHalf: number };
}
export interface MountPlayback { clip: MountSelection; phase: number; time: number; duration: number; loop: boolean; finished: boolean }
export function mountBone(actor: MountActor, name: string): Bone {
  const bone = actor.bones.find(value => value.name === name);
  if (!bone) throw new Error(`坐骑缺少挂接骨骼：${name}`);
  return bone;
}
