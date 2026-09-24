import { B, rigid, type Cage, type Recipe } from '../../../v3/types';
import { LEG, ring, bridge, face, orient } from '../../../v3/cage';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from '../contract';

/** 短筒军靴，筒口与裤脚允许明确的内藏接触；不删除整段小腿。 */
export function makeMilitaryBoots(recipe:Recipe):GarmentPiece {
  const c:Cage={vertices:[],faces:[],anchors:{}},sealedInterfaces:Record<string,number[]>={};
  for(const side of [1,-1]){
    const name=side===1?'Right':'Left',shin=side===1?B.RightShin:B.LeftShin,foot=side===1?B.RightFoot:B.LeftFoot;
    const profile=side===1?LEG:LEG.map(([x,z])=>[-x,-z] as [number,number]);
    const top=ring(c,`MilitaryBoot.${name}.Ankle`,[side*.101,.275,0],[1,0,0],[0,0,1],profile,.072,.074,rigid(shin));
    const ankle=ring(c,`MilitaryBoot.${name}.Bend`,[side*.101,.108,0],[1,0,0],[0,0,1],profile,.049,.049,[shin,foot,.2]);
    const mid=ring(c,`MilitaryBoot.${name}.Instep`,[side*.101,.064,.053],[1,0,0],[0,0,1],profile,.059,.118,rigid(foot));
    const sole=ring(c,`MilitaryBoot.${name}.Sole`,[side*.101,0,.056],[1,0,0],[0,0,1],profile,.061,.122,rigid(foot));
    bridge(c,top,ankle,'foot','#414441');bridge(c,ankle,mid,'foot','#414441');bridge(c,mid,sole,'foot','#343735');
    face(c,sole,'foot','#343735');face(c,top,'foot','#414441');sealedInterfaces[name+'Ankle']=top;
  }
  orient(c);c.anchors={...sealedInterfaces};
  return{id:recipe.slots.shoes,slot:'shoes',version:GARMENT_GEOMETRY_VERSION,mesh:c,covers:['foot'],openings:{},sealedInterfaces};
}
