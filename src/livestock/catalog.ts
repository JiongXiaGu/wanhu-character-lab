import { buildChickenMesh } from '../chicken/geometry';
import { buildChickenLod1Mesh, buildChickenLod2Mesh } from '../chicken/lod';
import { CHICKEN_JOINTS } from '../chicken/rig';
import { bakeChickenClips, CHICKEN_MOTIONS } from '../chicken/animation';
import type { LivestockDefinition } from './types';

export const LIVESTOCK: readonly LivestockDefinition[] = [{
  id: 'chicken_brown', name: '褐羽母鸡',
  description: '面向经营俯视的成年母鸡：短喙、小鸡冠、贴体翅与整块翘尾；三档作者LOD，不可骑乘。',
  joints: CHICKEN_JOINTS, motions: CHICKEN_MOTIONS, buildMesh: buildChickenMesh,
  lods: [
    { id: 'lod0', label: 'LOD0', description: '近景检查', triangles: 140, logicalVertices: 100, buildMesh: buildChickenMesh },
    { id: 'lod1', label: 'LOD1', description: '常规经营视角', triangles: 72, logicalVertices: 64, buildMesh: buildChickenLod1Mesh },
    { id: 'lod2', label: 'LOD2', description: '高空与大群体', triangles: 36, logicalVertices: 32, buildMesh: buildChickenLod2Mesh },
  ],
  bakeClips: bakeChickenClips,
}];
export function livestockDefinition(id: string): LivestockDefinition {
  const definition = LIVESTOCK.find(value => value.id === id);
  if (!definition) throw new Error(`未知家畜：${id}`);
  return definition;
}
