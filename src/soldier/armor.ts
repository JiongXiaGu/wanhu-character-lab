import { patchSlots, type CharacterSlots, type Recipe } from '../character/v3/types';
import { SOLDIER_ARMOR_CLASS_IDS, type SoldierArmorClassId } from './contract';

/** 甲装等级只拥有上衣/下装配对，驻地没有独占的重甲副本。轻甲沿用现有作者 ID。 */
export const SOLDIER_ARMOR_SLOTS = {
  light: { top: 'city_guard_brigandine', bottom: 'city_guard_trousers' },
  medium: { top: 'medium_armor', bottom: 'medium_armor_skirt' },
  heavy: { top: 'heavy_armor', bottom: 'heavy_armor_skirt' },
} as const satisfies Readonly<Record<SoldierArmorClassId, Readonly<Pick<CharacterSlots, 'top' | 'bottom'>>>>;
export const SOLDIER_ARMOR_NAMES: Readonly<Record<SoldierArmorClassId, string>> = { light: '轻甲', medium: '中甲', heavy: '重甲' };

/** 完整配对才显示等级；混搭不猜测，导入/撤销/恢复永远以真实槽位为准。 */
export function identifyArmorClass(recipe: Recipe): SoldierArmorClassId | null {
  return SOLDIER_ARMOR_CLASS_IDS.find(id => recipe.slots.top === SOLDIER_ARMOR_SLOTS[id].top && recipe.slots.bottom === SOLDIER_ARMOR_SLOTS[id].bottom) ?? null;
}

/** 只换两件甲装；身体、头盔、身份、染色、头发、鞋与随身装备全部保持。 */
export function applySoldierArmorClass(recipe: Recipe, armorClass: SoldierArmorClassId): Recipe {
  return patchSlots(recipe, SOLDIER_ARMOR_SLOTS[armorClass]);
}
