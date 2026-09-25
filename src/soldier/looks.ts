import { createRecipe, type Recipe, type CharacterSlots } from '../character/v3/types';
import { SOLDIER_STYLE_CONTRACT } from './contract';
import { SOLDIER_HELMETS, type SoldierIdentity } from './identities';

/** 只有已制作真实资产的三套军装进入显式试衣入口；不加入居民随机池，不写入职业或兵种字段。 */
export const PALACE_GUARD_SLOTS:Readonly<CharacterSlots>={headwear:'palace_guard_helmet',top:'medium_armor',bottom:'medium_armor_skirt',shoes:'military_boots',back:'none',leftHand:'none',rightHand:'military_spear'};
export function applyPalaceGuard(recipe:Recipe,identity:SoldierIdentity='soldier'):Recipe {
  return createRecipe({...recipe,slots:{...PALACE_GUARD_SLOTS,headwear:SOLDIER_HELMETS.palace[identity]},dyes:{...SOLDIER_STYLE_CONTRACT.palace.palette}});
}
export function isPalaceGuard(recipe:Recipe):boolean {
  return (Object.keys(PALACE_GUARD_SLOTS) as (keyof CharacterSlots)[]).every(k=>k==='headwear'?(recipe.slots.headwear===SOLDIER_HELMETS.palace.soldier||recipe.slots.headwear===SOLDIER_HELMETS.palace.captain):recipe.slots[k]===PALACE_GUARD_SLOTS[k]);
}

/** 边疆与皇宫共用中甲几何；这里只切换边疆头盔与配色，保留原保存、撤销和固定男女路径。 */
export const FRONTIER_GUARD_SLOTS:Readonly<CharacterSlots>={headwear:'frontier_guard_helmet',top:'medium_armor',bottom:'medium_armor_skirt',shoes:'military_boots',back:'none',leftHand:'none',rightHand:'military_spear'};
export function applyFrontierGuard(recipe:Recipe,identity:SoldierIdentity='soldier'):Recipe {
  return createRecipe({...recipe,slots:{...FRONTIER_GUARD_SLOTS,headwear:SOLDIER_HELMETS.frontier[identity]},dyes:{...SOLDIER_STYLE_CONTRACT.frontier.palette}});
}
export function isFrontierGuard(recipe:Recipe):boolean {
  return (Object.keys(FRONTIER_GUARD_SLOTS) as (keyof CharacterSlots)[]).every(k=>k==='headwear'?(recipe.slots.headwear===SOLDIER_HELMETS.frontier.soldier||recipe.slots.headwear===SOLDIER_HELMETS.frontier.captain):recipe.slots[k]===FRONTIER_GUARD_SLOTS[k]);
}

/** 城市整套复用原七槽位和保存链路，不向配方写入身份、职业或军阶。 */
export const CITY_GUARD_SLOTS:Readonly<CharacterSlots>={headwear:'city_guard_helmet',top:'city_guard_brigandine',bottom:'city_guard_trousers',shoes:'military_boots',back:'none',leftHand:'none',rightHand:'military_spear'};
export function applyCityGuard(recipe:Recipe,identity:SoldierIdentity='soldier'):Recipe {
  return createRecipe({...recipe,slots:{...CITY_GUARD_SLOTS,headwear:SOLDIER_HELMETS.city[identity]},dyes:{...SOLDIER_STYLE_CONTRACT.city.palette}});
}
export function isCityGuard(recipe:Recipe):boolean {
  return (Object.keys(CITY_GUARD_SLOTS) as (keyof CharacterSlots)[]).every(k=>k==='headwear'?(recipe.slots.headwear===SOLDIER_HELMETS.city.soldier||recipe.slots.headwear===SOLDIER_HELMETS.city.captain):recipe.slots[k]===CITY_GUARD_SLOTS[k]);
}
