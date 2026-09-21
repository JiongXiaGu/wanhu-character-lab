import { B, type Recipe } from '../../v3/types';
import { sewTorso, sewSleeve, finishTop, solidBand, torsoWaist, torsoRib, torsoChest, torsoNeck, armBones, type TorsoRow } from './top-seams';
import type { GarmentPiece } from './contract';

/** 宽松短袖短打：直落短衣身、偏侧搭襟和上臂袖口，区别于及肘劳作短衣。 */
export function makeShortJacket(recipe:Recipe):GarmentPiece {
  const {primary,secondary,accent}=recipe.dyes;
  const rows:readonly TorsoRow[]=[
    ['Hem',1.025,.191,.117,[-.091,-.076,-.061,-.046],torsoWaist],
    ['HemFacing',1.049,.191,.117,[-.091,-.076,-.061,-.046],torsoWaist],
    ['Rib',1.18,.204,.126,[-.076,-.061,-.046,-.031],torsoRib],
    ['Chest',1.30,.225,.132,[-.052,-.037,-.022,-.007],torsoChest],
    ['Shoulder',1.409,.232,.115,[-.038,-.023,-.008,.007],torsoChest],
    ['Neck',1.455,.071,.063,[-.024,-.012,.012,.024],torsoNeck],
  ];
  const front=[primary,accent,secondary,accent,primary,primary];
  const torso=sewTorso(rows,[solidBand(accent),front,front,front,front]);
  const cuffs:Record<string,number[]>={};
  for(const side of [1,-1] as const){
    const [upper]=armBones(side);
    cuffs[(side===1?'Right':'Left')+'Cuff']=sewSleeve(torso,side,[
      ['ShortSleeve',.262,1.286,0,.085,.079,[B.Chest,upper,.12],primary],
      ['ShortCuffFacing',.305,1.223,0,.080,.075,[upper,upper,1],secondary],
      ['ShortCuff',.316,1.207,0,.080,.075,[upper,upper,1],accent],
    ]);
  }
  const piece=finishTop(recipe,torso,cuffs,false);
  // 袖口位于上臂中段，不能整块隐藏 upperArm；原皮肤在衣袖内连续保留。
  piece.covers=['torso'];
  return piece;
}
