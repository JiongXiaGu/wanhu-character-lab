import { buildChickenMesh } from '../chicken/geometry';
import { CHICKEN_JOINTS } from '../chicken/rig';
import { bakeChickenClips, CHICKEN_MOTIONS } from '../chicken/animation';
import type { LivestockDefinition } from './types';

export const LIVESTOCK: readonly LivestockDefinition[] = [{
  id: 'chicken_brown', name: '褐羽母鸡',
  description: '面向经营俯视的成年母鸡：短喙、小鸡冠、贴体翅与整块翘尾；仅一种标准精度，不可骑乘。',
  joints: CHICKEN_JOINTS, motions: CHICKEN_MOTIONS, buildMesh: buildChickenMesh, bakeClips: bakeChickenClips,
}];
export function livestockDefinition(id: string): LivestockDefinition {
  const definition = LIVESTOCK.find(value => value.id === id);
  if (!definition) throw new Error(`未知家畜：${id}`);
  return definition;
}
