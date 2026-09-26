import { isHeavyHeadwear } from '../character/wardrobe/heavy-equipment';
import { patchSlots, type HeadwearId, type Recipe } from '../character/v3/types';
import { SOLDIER_STYLE_IDS, type SoldierStyleId, type SoldierArmorClassId } from './contract';

/** 仅为试衣/预设的两态身份；原 SoldierRoleId 仍表示规划兵种，不向 Recipe 加字段。 */
export const SOLDIER_IDENTITY_IDS = ['soldier', 'captain'] as const;
export type SoldierIdentity = typeof SOLDIER_IDENTITY_IDS[number];
export const SOLDIER_IDENTITY_NAMES: Readonly<Record<SoldierIdentity, string>> = {
  soldier: '普通士兵',
  captain: '队长',
};
export const SOLDIER_HELMETS = {
  palace: { soldier: 'palace_guard_helmet', captain: 'palace_captain_helmet' },
  frontier: { soldier: 'frontier_guard_helmet', captain: 'frontier_captain_helmet' },
  city: { soldier: 'city_guard_helmet', captain: 'city_captain_helmet' },
} as const satisfies Readonly<Record<SoldierStyleId, Readonly<Record<SoldierIdentity, HeadwearId>>>>;

export const HEAVY_SOLDIER_HELMETS = {
  palace: { soldier: 'palace_heavy_helmet', captain: 'palace_heavy_captain_helmet' },
  frontier: { soldier: 'frontier_heavy_helmet', captain: 'frontier_heavy_captain_helmet' },
  city: { soldier: 'city_heavy_helmet', captain: 'city_heavy_captain_helmet' },
} as const satisfies Readonly<Record<SoldierStyleId, Readonly<Record<SoldierIdentity, HeadwearId>>>>;

/** 仅用于试衣默认选择；实际保存的仍只有 headwear 资产 ID。 */
export function soldierHelmetFor(style: SoldierStyleId, identity: SoldierIdentity, armorClass: SoldierArmorClassId): HeadwearId {
  return (armorClass === 'heavy' ? HEAVY_SOLDIER_HELMETS : SOLDIER_HELMETS)[style][identity];
}

/** 从真实头饰反推显示选择，使导入、撤销、恢复和手动混搭不会留下过期的身份状态。 */
export function identifySoldierHelmet(headwear: HeadwearId): { style: SoldierStyleId; identity: SoldierIdentity } | null {
  for (const style of SOLDIER_STYLE_IDS) {
    for (const identity of SOLDIER_IDENTITY_IDS) {
      if (SOLDIER_HELMETS[style][identity] === headwear || HEAVY_SOLDIER_HELMETS[style][identity] === headwear) return { style, identity };
    }
  }
  return null;
}

/** 身份切换只改当前军盔：绝不重置混搭衣裤、鞋靴、手持物、染色或头发。非军盔不隐式换整套。 */
export function applySoldierIdentity(recipe: Recipe, identity: SoldierIdentity): Recipe {
  const current = identifySoldierHelmet(recipe.slots.headwear);
  return current ? patchSlots(recipe, { headwear: soldierHelmetFor(current.style, identity, isHeavyHeadwear(recipe.slots.headwear) ? 'heavy' : 'medium') }) : recipe;
}
