import { mountDefinition } from '../mounts/catalog';
import type { MountId, MountMotion } from '../mounts/types';
import type { HorseClipId, HorseStats } from '../horse/types';

export const RIDING_CLIP_IDS = ['Rider_Idle', 'Rider_Walk', 'Rider_Run'] as const;
export type RidingClipId = typeof RIDING_CLIP_IDS[number];
export type RidingSelection = RidingClipId | 'pose';
export const RIDING_VERSION = 'wanhu-riding-m4-v1';
export const RIDING_CLIPS: ReadonlyArray<{ id: RidingClipId; motion: MountMotion; horse: HorseClipId; label: string; description: string }> = [
  { id: 'Rider_Idle', motion: 'idle', horse: 'Horse_Idle', label: '停驻', description: '稳定跨坐，轻微呼吸与上身变化。' },
  { id: 'Rider_Walk', motion: 'walk', horse: 'Horse_Walk', label: '步行', description: '跟随当前坐骑，以同一相位采样。' },
  { id: 'Rider_Run', motion: 'run', horse: 'Horse_Run', label: '奔跑', description: '使用当前坐骑的奔跑节奏与骑姿校准。' },
];
export function ridingDefinition(id: RidingClipId, mountId: MountId = 'horse_chestnut') {
  const definition = RIDING_CLIPS.find(value => value.id === id); if (!definition) throw new Error(`未知骑乘片段：${id}`);
  return { ...definition, duration: mountDefinition(mountId).motions[definition.motion].duration };
}
export function isRidingSelection(value: string | null): value is RidingSelection { return value === 'pose' || RIDING_CLIP_IDS.includes(value as RidingClipId); }
export interface RidingPlayback { clip: RidingSelection; phase: number; time: number; duration: number; horsePhase: number; riderPhase: number; loop: boolean; finished: boolean }
export interface RidingStats { horse: HorseStats; rider: { triangles: number; logicalVertices: number; gpuVertices: number; bones: number } }
