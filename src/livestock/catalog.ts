import { CAT_DEFINITION } from '../cat/definition';
import { DOG_DEFINITION } from '../dog/definition';
import { PIG_DEFINITION } from '../pig/definition';
import { GOOSE_DEFINITION } from '../goose/definition';
import { DUCK_DEFINITION } from '../duck/definition';
import { buildChickenMesh } from '../chicken/geometry';
import { buildChickenLod1Mesh, buildChickenLod2Mesh } from '../chicken/lod';
import { CHICKEN_JOINTS } from '../chicken/rig';
import { bakeChickenClips, CHICKEN_MOTIONS } from '../chicken/animation';
import type { LivestockDefinition } from './types';

export const LIVESTOCK: readonly LivestockDefinition[] = [{
  id: 'chicken_brown', name: '褐羽母鸡',
  description: '面向经营俯视的成年母鸡：低档优先保留身体、颈部与短喙的连续轮廓；三档作者LOD，不可骑乘。',
  joints: CHICKEN_JOINTS, motions: CHICKEN_MOTIONS, buildMesh: buildChickenMesh,
  lods: [
    { id: 'lod0', label: 'LOD0', description: '近景检查 · 无独立翅膀', triangles: 132, logicalVertices: 92, buildMesh: buildChickenMesh },
    { id: 'lod1', label: 'LOD1', description: '连续头颈 · 简化细节', triangles: 72, logicalVertices: 46, buildMesh: buildChickenLod1Mesh },
    { id: 'lod2', label: 'LOD2', description: '完整轮廓 · 无头部配件', triangles: 36, logicalVertices: 26, buildMesh: buildChickenLod2Mesh },
  ],
  bakeClips: bakeChickenClips,
  habitats: [{ id: 'land', label: '陆地', defaultMotion: 'idle', duration: 9, mixed: [
    { motion: 'peck', weight: .48 }, { motion: 'idle', weight: .28 }, { motion: 'walk', weight: .24, radius: .25, laps: 1 },
  ] }],
}, DUCK_DEFINITION, GOOSE_DEFINITION, PIG_DEFINITION, DOG_DEFINITION, CAT_DEFINITION];
export function livestockDefinition(id: string): LivestockDefinition {
  const definition = LIVESTOCK.find(value => value.id === id);
  if (!definition) throw new Error(`未知家畜：${id}`);
  return definition;
}
