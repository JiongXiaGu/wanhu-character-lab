import { B, type Recipe } from '../../v3/types';
import { armBones, finishTop, sewSleeve, sewTorso, solidBand, torsoChest, torsoNeck, torsoRib, torsoWaist } from './top-seams';

/** 半臂配内衬：外袖→缘边→内缩环→内袖共用边界；省略不可见内层。 */
export function makeHalfSleeve(recipe:Recipe){
  const {primary:p,secondary:s,accent:a}=recipe.dyes;
  const torso=sewTorso([
    ['Hem',1.015,.178,.118,[-.047,-.032,.032,.047],torsoWaist],
    ['Waist',1.085,.168,.112,[-.044,-.029,.029,.044],torsoWaist],
    ['Rib',1.18,.194,.126,[-.048,-.031,.031,.048],torsoRib],
    ['Chest',1.30,.222,.133,[-.048,-.031,.031,.048],torsoChest],
    ['Shoulder',1.405,.229,.121,[-.048,-.031,.031,.048],torsoChest],
    ['Facing',1.445,.079,.070,[-.044,-.028,.028,.044],torsoNeck],
    ['Neck',1.460,.065,.058,[-.041,-.025,.025,.041],torsoNeck],
  ],[solidBand(a),[p,a,s,a,p,p],[p,a,s,a,p,p],[p,a,s,a,p,p],[p,a,s,a,p,p],solidBand(s)]);
  const cuffs:Record<string,number[]>={};
  for(const side of [1,-1] as const){
    const [u,l,h]=armBones(side);
    cuffs[side===1?'RightCuff':'LeftCuff']=sewSleeve(torso,side,[
      ['Shoulder',.25,1.302,0,.096,.086,[B.Chest,u,.16],p],
      ['OuterSleeve',.317,1.218,0,.090,.080,[u,u,1],p],
      ['OuterEdge',.330,1.199,0,.090,.080,[u,u,1],a],
      ['InnerInset',.330,1.199,0,.053,.051,[u,u,1],s],
      ['Sleeve',.374,1.136,0,.055,.053,[u,l,.9],s],
      ['Elbow',.394,1.101,0,.049,.048,[u,l,.5],s],
      ['ElbowLower',.414,1.066,.002,.052,.049,[u,l,.08],s],
      ['InnerFacing',.492,.932,.014,.035,.034,[l,h,.4],s],
      ['Cuff',.508,.904,.014,.035,.034,[l,h,.18],a],
    ]);
  }
  return finishTop(recipe,torso,cuffs,true);
}
