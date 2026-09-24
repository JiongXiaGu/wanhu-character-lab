import type { LivestockDefinition } from '../livestock/types';
import { buildGooseMesh } from './geometry';
import { GOOSE_JOINTS, GOOSE_WATERLINE } from './rig';
import { GOOSE_MOTIONS, bakeGooseClips } from './animation';

export const GOOSE_DEFINITION: LivestockDefinition = {
  id: 'goose_domestic_white', name: '白色家鹅',
  description: '暖白厚身、挺立双段长颈、窄长橙喙与蹼足；没有可见翅膀，水陆动作独立制作，睡觉仅限陆地。',
  joints: GOOSE_JOINTS, motions: GOOSE_MOTIONS, bakeClips: bakeGooseClips, buildMesh: () => buildGooseMesh('lod0'),
  referenceHeight: .86,
  lods: [
    { id: 'lod0', label: 'LOD0', description: '完整长颈 · 眼睛与嘴根', triangles: 154, logicalVertices: 87, buildMesh: () => buildGooseMesh('lod0') },
    { id: 'lod1', label: 'LOD1', description: '双段颈部 · 连续主壳', triangles: 82, logicalVertices: 47, buildMesh: () => buildGooseMesh('lod1') },
    { id: 'lod2', label: 'LOD2', description: '保留长颈 · 嘴与蹼足', triangles: 44, logicalVertices: 28, buildMesh: () => buildGooseMesh('lod2') },
  ],
  habitats: [
    { id: 'land', label: '陆地', defaultMotion: 'idle_land', duration: 6, mixed: [
      { motion: 'idle_land', weight: .30 }, { motion: 'walk', weight: .30, radius: .16, laps: 1 }, { motion: 'graze', weight: .40 },
    ] },
    { id: 'water', label: '水面', defaultMotion: 'idle_water', duration: 6, waterline: GOOSE_WATERLINE, mixed: [
      { motion: 'idle_water', weight: .35 }, { motion: 'swim', weight: .45, radius: .20, laps: 1 }, { motion: 'feed_water', weight: .20 },
    ] },
  ],
};
