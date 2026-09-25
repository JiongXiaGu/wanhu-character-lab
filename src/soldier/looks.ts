import { createRecipe, type Recipe, type CharacterSlots } from '../character/v3/types';
import { SOLDIER_STYLE_CONTRACT, type SoldierStyleId, type SoldierArmorClassId } from './contract';
import { SOLDIER_HELMETS, identifySoldierHelmet, type SoldierIdentity } from './identities';
import { SOLDIER_ARMOR_SLOTS, identifySoldierArmor } from './armor-classes';

/** 首次进入的默认长枪搭配；等级选择不受默认驻地绑定。 */
export const PALACE_GUARD_SLOTS:Readonly<CharacterSlots>={headwear:'palace_guard_helmet',top:'medium_armor',bottom:'medium_armor_skirt',shoes:'military_boots',back:'none',leftHand:'none',rightHand:'military_spear'};
export const FRONTIER_GUARD_SLOTS:Readonly<CharacterSlots>={headwear:'frontier_guard_helmet',top:'medium_armor',bottom:'medium_armor_skirt',shoes:'military_boots',back:'none',leftHand:'none',rightHand:'military_spear'};
export const CITY_GUARD_SLOTS:Readonly<CharacterSlots>={headwear:'city_guard_helmet',top:'city_guard_brigandine',bottom:'city_guard_trousers',shoes:'military_boots',back:'none',leftHand:'none',rightHand:'military_spear'};

/** 显式整套入口用于初次试衣、URL 和数值矩阵，不建立正式军人身份协议。 */
export function applySoldierLoadout(recipe:Recipe,style:SoldierStyleId,armorClass:SoldierArmorClassId,identity:SoldierIdentity='soldier'):Recipe {
  return createRecipe({...recipe,slots:{...PALACE_GUARD_SLOTS,...SOLDIER_ARMOR_SLOTS[armorClass],headwear:SOLDIER_HELMETS[style][identity]},dyes:{...SOLDIER_STYLE_CONTRACT[style].palette}});
}
export function applyPalaceGuard(recipe:Recipe,identity:SoldierIdentity='soldier'):Recipe {
  return applySoldierLoadout(recipe,'palace','medium',identity);
}
export function applyFrontierGuard(recipe:Recipe,identity:SoldierIdentity='soldier'):Recipe {
  return applySoldierLoadout(recipe,'frontier','medium',identity);
}
export function applyCityGuard(recipe:Recipe,identity:SoldierIdentity='soldier'):Recipe {
  return applySoldierLoadout(recipe,'city','light',identity);
}

/** 已有军盔或完整甲装时，驻地只拥有 palette 和 helmet；首次从居民装进入才应用默认整套。 */
export function applySoldierStyle(recipe:Recipe,style:SoldierStyleId):Recipe {
  const helmet=identifySoldierHelmet(recipe.slots.headwear);
  if(!helmet&&!identifySoldierArmor(recipe))return applySoldierLoadout(recipe,style,SOLDIER_STYLE_CONTRACT[style].armorClass);
  return createRecipe({...recipe,slots:{...recipe.slots,headwear:SOLDIER_HELMETS[style][helmet?.identity??'soldier']},dyes:{...SOLDIER_STYLE_CONTRACT[style].palette}});
}
function isGuard(recipe:Recipe,style:SoldierStyleId):boolean {
  return identifySoldierHelmet(recipe.slots.headwear)?.style===style&&identifySoldierArmor(recipe)!==null&&
    recipe.slots.shoes==='military_boots'&&recipe.slots.back==='none'&&recipe.slots.leftHand==='none'&&recipe.slots.rightHand==='military_spear';
}
export function isPalaceGuard(recipe:Recipe):boolean {return isGuard(recipe,'palace');}
export function isFrontierGuard(recipe:Recipe):boolean {return isGuard(recipe,'frontier');}
export function isCityGuard(recipe:Recipe):boolean {return isGuard(recipe,'city');}
