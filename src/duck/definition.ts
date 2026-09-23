import type { LivestockDefinition } from '../livestock/types';
import { buildDuckMesh } from './geometry';
import { DUCK_JOINTS, DUCK_WATERLINE } from './rig';
import { DUCK_MOTIONS, bakeDuckClips } from './animation';

export const DUCK_DEFINITION: LivestockDefinition = {
  id: 'duck_domestic_brown', name: '褐羽家鸭',
  description: '宽圆低身、短颈扁喙与靠后蹼足；陆地含奔跑，水面含漂浮、游泳和浅扎水。',
  joints: DUCK_JOINTS, motions: DUCK_MOTIONS, bakeClips: bakeDuckClips, buildMesh: () => buildDuckMesh('lod0'),
  referenceHeight: .45,
  lods: [
    { id: 'lod0', label: 'LOD0', description: '近景 · 蹼足 · 无独立翅膀', triangles: 118, logicalVertices: 69, buildMesh: () => buildDuckMesh('lod0') },
    { id: 'lod1', label: 'LOD1', description: '连续头颈 · 简化侧面细节', triangles: 60, logicalVertices: 36, buildMesh: () => buildDuckMesh('lod1') },
    { id: 'lod2', label: 'LOD2', description: '完整轮廓 · 保留扁喙', triangles: 36, logicalVertices: 24, buildMesh: () => buildDuckMesh('lod2') },
  ],
  habitats: [
    { id: 'land', label: '陆地', defaultMotion: 'idle_land', duration: 6, mixed: [
      { motion: 'idle_land', weight: .35 }, { motion: 'walk', weight: .40, radius: .25, laps: 1 }, { motion: 'feed_land', weight: .25 },
    ] },
    { id: 'water', label: '水面', defaultMotion: 'idle_water', duration: 6, waterline: DUCK_WATERLINE, mixed: [
      { motion: 'idle_water', weight: .40 }, { motion: 'swim', weight: .45, radius: .30, laps: 1 }, { motion: 'dabble', weight: .15 },
    ] },
  ],
};
