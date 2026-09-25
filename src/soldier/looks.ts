import { createRecipe, type Recipe, type CharacterSlots } from '../character/v3/types';
import { SOLDIER_STYLE_CONTRACT } from './contract';

/** 只有已制作真实资产的宫卫与边军进入显式试衣入口；不加入居民随机池，不写入职业或兵种字段。 */
export const PALACE_GUARD_SLOTS:Readonly<CharacterSlots>={headwear:'palace_guard_helmet',top:'palace_guard_armor',bottom:'palace_guard_skirt',shoes:'military_boots',back:'none',leftHand:'none',rightHand:'military_spear'};
export function applyPalaceGuard(recipe:Recipe):Recipe {
  return createRecipe({...recipe,slots:{...PALACE_GUARD_SLOTS},dyes:{...SOLDIER_STYLE_CONTRACT.palace.palette}});
}
export function isPalaceGuard(recipe:Recipe):boolean {
  return (Object.keys(PALACE_GUARD_SLOTS) as (keyof CharacterSlots)[]).every(k=>recipe.slots[k]===PALACE_GUARD_SLOTS[k]);
}

/** 边军整套仍只是一份普通外观配方；保留原保存、撤销和固定男女路径。 */
export const FRONTIER_GUARD_SLOTS:Readonly<CharacterSlots>={headwear:'frontier_guard_helmet',top:'frontier_lamellar_armor',bottom:'frontier_armor_skirt',shoes:'military_boots',back:'none',leftHand:'none',rightHand:'military_spear'};
export function applyFrontierGuard(recipe:Recipe):Recipe {
  return createRecipe({...recipe,slots:{...FRONTIER_GUARD_SLOTS},dyes:{...SOLDIER_STYLE_CONTRACT.frontier.palette}});
}
export function isFrontierGuard(recipe:Recipe):boolean {
  return (Object.keys(FRONTIER_GUARD_SLOTS) as (keyof CharacterSlots)[]).every(k=>recipe.slots[k]===FRONTIER_GUARD_SLOTS[k]);
}
