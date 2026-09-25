import { createRecipe, type Recipe, type CharacterSlots } from '../character/v3/types';
import { SOLDIER_STYLE_CONTRACT } from './contract';

/** 只有已完成的宫卫进入显式试衣入口；不加入居民随机池，不写入职业或兵种字段。 */
export const PALACE_GUARD_SLOTS:Readonly<CharacterSlots>={headwear:'palace_guard_helmet',top:'palace_guard_armor',bottom:'palace_guard_skirt',shoes:'military_boots',back:'none',leftHand:'none',rightHand:'military_spear'};
export function applyPalaceGuard(recipe:Recipe):Recipe {
  return createRecipe({...recipe,slots:{...PALACE_GUARD_SLOTS},dyes:{...SOLDIER_STYLE_CONTRACT.palace.palette}});
}
export function isPalaceGuard(recipe:Recipe):boolean {
  return (Object.keys(PALACE_GUARD_SLOTS) as (keyof CharacterSlots)[]).every(k=>recipe.slots[k]===PALACE_GUARD_SLOTS[k]);
}
