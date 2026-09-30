import { B, type Cage, type Recipe, type Vec3, type Weight } from '../../v3/types';
import { bridge, face, orient, vertex } from '../../v3/cage';
import { kneeWeights } from '../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';

// 独立高腰裙纸样：高裙头三段、纵向浅折棱、克制展开。不是 long_skirt 平移。
// 前后深度分别制作；臀下不鼓球，不增加实时布料或第三权重。
type Row=readonly [name:string,y:number,width:number,front:number,back:number,fold:number];
const ROWS:readonly Row[]=[
  // 裙头两圈约一厘米固定留量，包住短襦衣摆；不读取 top 或姿态临时改形。
  // 纵向高度和 BandFoot 以下原版型不变，避免交界轮廓互切成锯齿露片。
  ['Waist',1.205,.197,.139,.138,0],
  ['BandMid',1.170,.196,.137,.137,0],
  ['BandFoot',1.125,.177,.121,.121,0],
  ['Hip',.980,.202,.127,.124,.004],
  ['Seat',.805,.232,.143,.137,.007],
  ['KneeUpper',.580,.269,.171,.160,.009],
  ['Knee',.489,.281,.183,.175,.010],
  ['KneeLower',.400,.296,.195,.187,.011],
  ['Calf',.255,.317,.211,.206,.012],
  ['HemFacing',.140,.332,.221,.214,.012],
  ['Hem',.100,.335,.224,.216,.012],
];
const SEGMENTS=16;
function weights(p:Vec3,row:number):Weight {
  if(row<3)return [B.Spine,B.Chest,[.30,.45,.60][row]];
  const thigh=p[0]>0?B.RightThigh:B.LeftThigh,shin=p[0]>0?B.RightShin:B.LeftShin;
  if(row===3)return [B.Hips,thigh,.72];
  if(row===4)return [B.Hips,thigh,.28];
  return kneeWeights(p,thigh,shin);
}
export function makeCourtMaidSkirt(recipe:Recipe):GarmentPiece {
  const c:Cage={vertices:[],faces:[],anchors:{}}, {primary,secondary,accent}=recipe.dyes;
  const openings:Record<string,number[]>={};let previous:number[]=[];
  ROWS.forEach(([name,y,width,front,back,fold],r)=>{
    const loop=Array.from({length:SEGMENTS},(_,k)=>{
      const t=(k+.5)*2*Math.PI/SEGMENTS,depth=Math.cos(t)>=0?front:back;
      const inset=(k%2===0?0:fold);
      const exponent=r<3?.75:r===3?.90:1;
      const profile=(v:number)=>Math.sign(v)*Math.pow(Math.abs(v),exponent);
      const p:Vec3=[profile(Math.sin(t))*(width-inset),y,profile(Math.cos(t))*(depth-inset*.6)];
      if(r>=5&&Math.abs(Math.sin(t))<.3)p[0]=Math.sign(p[0])*Math.max(Math.abs(p[0]),width*.26);
      return vertex(c,`MaidSkirt.${name}.${k}`,p,weights(p,r));
    });
    if(r===0)openings.waist=loop;
    else bridge(c,previous,loop,r<3?'torso':r<5?'pelvis':y<.489?'shin':'thigh',r<3?accent:r===ROWS.length-1?accent:secondary);
    previous=loop;
  });
  const inset=previous.map((vi,k)=>{
    const v=c.vertices[vi],t=(k+.5)*2*Math.PI/SEGMENTS;
    return vertex(c,`MaidSkirt.HemInset.${k}`,[v.p[0]-.007*Math.sin(t),v.p[1]-.008,v.p[2]-.007*Math.cos(t)],[...v.w]);
  });
  bridge(c,previous,inset,'shin',accent);
  const center=vertex(c,'MaidSkirt.HemCenter',[0,.05,-.04],[B.RightShin,B.LeftShin,.5]);
  for(let k=0;k<SEGMENTS;k++)face(c,[inset[k],inset[(k+1)%SEGMENTS],center],'shin',primary);
  orient(c);c.anchors={...openings,closedHem:inset};
  return{id:recipe.slots.bottom,slot:'bottom',version:GARMENT_GEOMETRY_VERSION,mesh:c,covers:['pelvis','thigh','shin'],openings};
}
