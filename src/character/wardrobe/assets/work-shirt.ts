import { B, type Recipe } from '../../v3/types';
import { armBones, finishTop, sewSleeve, sewTorso, solidBand, torsoChest, torsoNeck, torsoRib, torsoWaist } from './top-seams';

/** 劳作短衣：短身、素领短门襟、卷袖口。没有叠穿槽位或身体补偿。 */
export function makeWorkShirt(recipe:Recipe){
  const {primary:p,secondary:s,accent:a}=recipe.dyes;
  const straight=[-.036,-.014,.014,.036] as const;
  const torso=sewTorso([
    ['Hem',1.045,.165,.108,straight,torsoWaist],
    ['Waist',1.085,.159,.104,straight,torsoWaist],
    ['Rib',1.18,.188,.120,straight,torsoRib],
    ['Chest',1.30,.212,.125,straight,torsoChest],
    ['Shoulder',1.405,.218,.114,straight,torsoChest],
    ['Facing',1.445,.078,.066,[-.034,-.014,.014,.034],torsoNeck],
    ['Neck',1.460,.065,.058,[-.032,-.013,.013,.032],torsoNeck],
  ],[solidBand(a),solidBand(p),solidBand(p),[p,p,s,p,p,p],[p,p,s,p,p,p],solidBand(s)]);
  const cuffs:Record<string,number[]>={};
  for(const side of [1,-1] as const){
    const [u,l]=armBones(side);
    cuffs[side===1?'RightCuff':'LeftCuff']=sewSleeve(torso,side,[
      ['Shoulder',.25,1.302,0,.077,.074,[B.Chest,u,.16],p],
      ['Sleeve',.362,1.157,0,.063,.061,[u,l,.98],p],
      ['RolledEdge',.370,1.143,0,.070,.066,[u,l,.93],s],
      ['Cuff',.383,1.120,0,.069,.065,[u,l,.75],s],
    ]);
  }
  return finishTop(recipe,torso,cuffs,false);
}
