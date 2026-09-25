import { makeTrouserShell } from './trouser-shell';
import { makePalaceSkirt } from './military/palace-skirt';
import { makeFrontierSkirt } from './military/frontier-skirt';
import { makeContinuousSkirt } from './skirts';
import { makeShortBottom } from './short-bottoms';
import { sealGarmentInterfaces } from './seal-interfaces';
import { type Recipe } from '../../v3/types';
import { BOTTOM_PATTERNS } from '../patterns';
import { type GarmentPiece } from './contract';

/** 长裤腰口／双裤口、连续裙腰口使用原裤布／腰头色区封闭；已封短裤保持不变。 */
export function makeTrousers(recipe:Recipe):GarmentPiece|undefined {
  const piece=makeAuthoredBottom(recipe);
  return piece?sealGarmentInterfaces(piece,recipe.dyes.secondary):undefined;
}

/** 保留下装只分为封口短裤、连续裙装和两种简洁实用长裤。 */
function makeAuthoredBottom(recipe:Recipe):GarmentPiece|undefined {
  const id=recipe.slots.bottom;if(id==='body')return;
  const pattern=BOTTOM_PATTERNS[id];if(!pattern)throw new Error('下装资产未注册：'+id);
  if(pattern.asset==='short-trousers')return makeShortBottom(recipe);
  if(pattern.asset==='continuous-short-skirt'||pattern.asset==='continuous-long-skirt')return makeContinuousSkirt(recipe);
  if(pattern.asset==='palace-skirt')return makePalaceSkirt(recipe);
  if(pattern.asset==='frontier-skirt')return makeFrontierSkirt(recipe);
  if(pattern.asset!=='classic')throw new Error('未知长裤构造器');
  return makeTrouserShell(recipe,pattern);
}
