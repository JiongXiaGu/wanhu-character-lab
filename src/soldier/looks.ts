import { createRecipe, type Recipe, type CharacterSlots } from '../character/v3/types';
import { SOLDIER_STYLE_CONTRACT, type SoldierStyleId, type SoldierArmorClassId } from './contract';
import { SOLDIER_HELMETS, identifySoldierHelmet, type SoldierIdentity } from './identities';
import { SOLDIER_ARMOR_SLOTS, identifyArmorClass } from './armor';

/** 显式军人外观预设；试衣概念不写入 Recipe，也不加入随机居民池。 */
export function applySoldierLook(recipe: Recipe, style: SoldierStyleId, identity: SoldierIdentity, armorClass: SoldierArmorClassId): Recipe {
  return createRecipe({ ...recipe, slots: { ...SOLDIER_ARMOR_SLOTS[armorClass], headwear: SOLDIER_HELMETS[style][identity], shoes: 'military_boots', back: 'none', leftHand: 'none', rightHand: 'military_spear' }, dyes: { ...SOLDIER_STYLE_CONTRACT[style].palette } });
}

/** 切驻地保留已选等级与身份；尚无完整甲装时才使用驻地的首次试衣默认值。 */
export function applySoldierStyle(recipe: Recipe, style: SoldierStyleId): Recipe {
  const helmet = identifySoldierHelmet(recipe.slots.headwear), armorClass = identifyArmorClass(recipe);
  if (helmet && armorClass) return createRecipe({ ...recipe, slots: { ...recipe.slots, headwear: SOLDIER_HELMETS[style][helmet.identity] }, dyes: { ...SOLDIER_STYLE_CONTRACT[style].palette } });
  return applySoldierLook(recipe, style, helmet?.identity ?? 'soldier', armorClass ?? SOLDIER_STYLE_CONTRACT[style].armorClass);
}

export const PALACE_GUARD_SLOTS: Readonly<CharacterSlots> = { headwear: 'palace_guard_helmet', ...SOLDIER_ARMOR_SLOTS.medium, shoes: 'military_boots', back: 'none', leftHand: 'none', rightHand: 'military_spear' };
export const FRONTIER_GUARD_SLOTS: Readonly<CharacterSlots> = { ...PALACE_GUARD_SLOTS, headwear: 'frontier_guard_helmet' };
export const CITY_GUARD_SLOTS: Readonly<CharacterSlots> = { ...PALACE_GUARD_SLOTS, ...SOLDIER_ARMOR_SLOTS.light, headwear: 'city_guard_helmet' };
// 这三项是明确的首次进入预设，不作为已选甲装的驻地切换函数。
export const applyPalaceGuard = (recipe: Recipe, identity: SoldierIdentity = 'soldier') => applySoldierLook(recipe, 'palace', identity, 'medium');
export const applyFrontierGuard = (recipe: Recipe, identity: SoldierIdentity = 'soldier') => applySoldierLook(recipe, 'frontier', identity, 'medium');
export const applyCityGuard = (recipe: Recipe, identity: SoldierIdentity = 'soldier') => applySoldierLook(recipe, 'city', identity, 'light');

function isGuard(recipe: Recipe, style: SoldierStyleId): boolean {
  return identifySoldierHelmet(recipe.slots.headwear)?.style === style && identifyArmorClass(recipe) !== null && recipe.slots.shoes === 'military_boots' && recipe.slots.rightHand === 'military_spear' && recipe.slots.leftHand === 'none' && recipe.slots.back === 'none';
}
export const isPalaceGuard = (recipe: Recipe) => isGuard(recipe, 'palace');
export const isFrontierGuard = (recipe: Recipe) => isGuard(recipe, 'frontier');
export const isCityGuard = (recipe: Recipe) => isGuard(recipe, 'city');
