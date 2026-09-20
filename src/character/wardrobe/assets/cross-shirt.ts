import { B, type Recipe } from '../../v3/types';
import { armBones, finishTop, sewSleeve, sewTorso, solidBand, torsoChest, torsoNeck, torsoRib, torsoWaist } from './top-seams';

/** 交领常服：斜襟是衣片中的连续缘边，领口到腰侧不再悬浮投影 ribbon。 */
export function makeCrossShirt(recipe:Recipe){
  const {primary:p,secondary:s,accent:a}=recipe.dyes;
  const torso=sewTorso([
    ['Hem',.985,.182,.115,[.065,.086,.107,.124],torsoWaist],
    ['BeltLow',1.055,.169,.108,[.065,.086,.107,.124],torsoWaist],
    ['Waist',1.095,.163,.108,[.065,.086,.103,.119],torsoWaist],
    ['Rib',1.18,.193,.124,[.078,.103,.119,.135],torsoRib],
    ['Chest',1.30,.220,.132,[.041,.066,.100,.124],torsoChest],
    ['Shoulder',1.405,.228,.118,[-.028,-.005,.018,.041],torsoChest],
    ['Facing',1.445,.083,.072,[-.049,-.028,.028,.049],torsoNeck],
    ['Neck',1.460,.067,.060,[-.046,-.029,.029,.046],torsoNeck],
  ],[[p,a,p,p,p,p],solidBand(a),[p,a,p,p,p,p],[p,a,p,p,p,p],[p,a,p,p,p,p],[p,a,s,a,p,p],solidBand(s)]);
  const cuffs:Record<string,number[]>={};
  for(const side of [1,-1] as const){
    const [u,l,h]=armBones(side);
    cuffs[side===1?'RightCuff':'LeftCuff']=sewSleeve(torso,side,[
      ['Shoulder',.25,1.302,0,.087,.080,[B.Chest,u,.16],p],
      ['Sleeve',.374,1.136,0,.073,.064,[u,l,.9],p],
      ['Elbow',.394,1.101,0,.065,.058,[u,l,.5],p],
      ['ElbowLower',.414,1.066,.002,.070,.061,[u,l,.08],p],
      ['WristFacing',.492,.932,.014,.064,.052,[l,h,.4],p],
      ['Cuff',.508,.904,.014,.064,.052,[l,h,.18],a],
    ]);
  }
  return finishTop(recipe,torso,cuffs,true);
}
