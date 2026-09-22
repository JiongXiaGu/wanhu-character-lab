import { horseClipDefinition } from '../horse/animation';
import type { HorseClipId, HorseStats } from '../horse/types';

export const RIDING_CLIP_IDS = ['Rider_Idle', 'Rider_Walk', 'Rider_Run'] as const;
export type RidingClipId = typeof RIDING_CLIP_IDS[number];
export type RidingSelection = RidingClipId | 'pose';
export const RIDING_VERSION = 'wanhu-riding-m2-v1';
export const RIDING_CLIPS: ReadonlyArray<{ id: RidingClipId; horse: HorseClipId; label: string; description: string }> = [
  { id: 'Rider_Idle', horse: 'Horse_Idle', label: '停驻', description: '稳定跨坐，保留轻微呼吸与上身变化。' },
  { id: 'Rider_Walk', horse: 'Horse_Walk', label: '步行', description: '骑手跟随马背，以同一相位采样。' },
  { id: 'Rider_Run', horse: 'Horse_Run', label: '奔跑', description: '上身稍前倾，保留有限缓冲；不是步行倍速。' },
];
export function ridingDefinition(id: RidingClipId) {
  const definition = RIDING_CLIPS.find(value => value.id === id);
  if (!definition) throw new Error(`未知骑乘片段：${id}`);
  return { ...definition, duration: horseClipDefinition(definition.horse).duration };
}
export function isRidingSelection(value: string | null): value is RidingSelection {
  return value === 'pose' || RIDING_CLIP_IDS.includes(value as RidingClipId);
}
export interface RidingPlayback {
  clip: RidingSelection; phase: number; time: number; duration: number;
  horsePhase: number; riderPhase: number; loop: boolean; finished: boolean;
}
export interface RidingStats {
  horse: HorseStats;
  rider: { triangles: number; logicalVertices: number; gpuVertices: number; bones: number };
}
