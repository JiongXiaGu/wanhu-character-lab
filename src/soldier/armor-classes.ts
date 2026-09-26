import { identifySoldierHelmet, soldierHelmetFor } from './identities';
import { patchSlots, type CharacterSlots, type Recipe } from '../character/v3/types';
import { SOLDIER_ARMOR_CLASS_IDS, type SoldierArmorClassId } from './contract';

/** 甲装等级拥有上下装选择；驻地、身份和保存协议不拥有第二份等级状态。 */
export const SOLDIER_ARMOR_SLOTS = {
  light: { top: 'city_guard_brigandine', bottom: 'city_guard_trousers' },
  medium: { top: 'medium_armor', bottom: 'medium_armor_skirt' },
  heavy: { top: 'heavy_armor', bottom: 'heavy_armor_skirt' },
} as const satisfies Readonly<Record<SoldierArmorClassId, Readonly<Pick<CharacterSlots, 'top' | 'bottom'>>>>;

export const SOLDIER_ARMOR_NAMES: Readonly<Record<SoldierArmorClassId, string>> = {
  light: '轻甲', medium: '中甲', heavy: '重甲',
};

/** 混搭不强行归类；导入、撤销与恢复后直接从真实上下装重算。 */
export function identifySoldierArmor(recipe: Recipe): SoldierArmorClassId | null {
  return SOLDIER_ARMOR_CLASS_IDS.find(id => {
    const slots = SOLDIER_ARMOR_SLOTS[id];
    return recipe.slots.top === slots.top && recipe.slots.bottom === slots.bottom;
  }) ?? null;
}

/** 换等级应用共享上下装及同驻地/身份的军盔；自由选择的非军盔和其它装备不动。 */
export function applySoldierArmor(recipe: Recipe, armorClass: SoldierArmorClassId): Recipe {
  const helmet = identifySoldierHelmet(recipe.slots.headwear);
  return patchSlots(recipe, { ...SOLDIER_ARMOR_SLOTS[armorClass], ...(helmet ? { headwear: soldierHelmetFor(helmet.style, helmet.identity, armorClass) } : {}) });
}
