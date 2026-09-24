import { makeMilitaryBoots } from './military/boots';
import { B, rigid, type Cage, type Recipe } from '../../v3/types';
import { LEG, ring, bridge, face, orient } from '../../v3/cage';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';

/** 当前正式鞋款只保留布鞋；body 仅供裸模和内部检查。 */
export function makeFootwear(recipe:Recipe):GarmentPiece|undefined {
  const id=recipe.slots.shoes;
  if(id==='body')return;
  if(id==='military_boots')return makeMilitaryBoots(recipe);
  const c:Cage={vertices:[],faces:[],anchors:{}},sealedInterfaces:Record<string,number[]>={};
  for(const side of [1,-1]){
    const name=side===1?'Right':'Left',shin=side===1?B.RightShin:B.LeftShin,foot=side===1?B.RightFoot:B.LeftFoot;
    const profile=side===1?LEG:LEG.map(([x,z])=>[-x,-z]as[number,number]);
    const top=ring(c,'Shoe.'+name+'.Ankle',[side*.101,.108,0],[1,0,0],[0,0,1],profile,.043,.043,[shin,foot,.2]);
    const mid=ring(c,'Shoe.'+name+'.Instep',[side*.101,.064,.05],[1,0,0],[0,0,1],profile,.055,.109,rigid(foot));
    const sole=ring(c,'Shoe.'+name+'.Sole',[side*.101,0,.053],[1,0,0],[0,0,1],profile,.057,.114,rigid(foot));
    const color='#414441';
    bridge(c,top,mid,'foot',color);bridge(c,mid,sole,'foot',color);face(c,sole,'foot',color);face(c,[...top],'foot',color);
    sealedInterfaces[name+'Ankle']=top;
  }
  orient(c);c.anchors={...sealedInterfaces};
  return {id,slot:'shoes',version:GARMENT_GEOMETRY_VERSION,mesh:c,covers:['foot'],openings:{},sealedInterfaces};
}
