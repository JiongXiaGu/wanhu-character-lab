import { B, type Cage, type Recipe, type Vec3, type Weight } from '../../v3/types';
import { bridge, orient, vertex } from '../../v3/cage';
import { kneeWeights } from '../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';

// 两件真正的裙装共用有限的闭环缝制操作，不调用裤装或源皮肤生成器。
// 所有制作数据、权重和露肤在装配时一次确定；不读取动画、不增加骨骼。
type SkirtRow = readonly [name:string,y:number,width:number,depth:number];
const SHORT:readonly SkirtRow[]=[
  ['Waist',1.075,.146,.087],['WaistFacing',1.042,.158,.095],
  ['Hip',.940,.198,.113],['Seat',.805,.217,.123],
  ['Flare',.650,.242,.136],['HemFacing',.553,.258,.145],['Hem',.513,.260,.146],
];
const LONG:readonly SkirtRow[]=[
  ['Waist',1.075,.146,.087],['WaistFacing',1.042,.158,.095],
  ['Hip',.940,.198,.113],['Seat',.805,.221,.128],
  ['KneeUpper',.580,.253,.153],['Knee',.489,.266,.167],
  ['KneeLower',.400,.280,.179],['Calf',.255,.300,.194],
  ['HemFacing',.140,.313,.205],['Hem',.100,.317,.208],
];
// 前后中线位于面片中间而不是硬切开的裤缝；每个顶点仍最多双权重。
const SEGMENTS=12;
function skirtWeights(p:Vec3,row:number):Weight {
  if(row<2)return [B.Hips,B.Spine,.35];
  const right=p[0]>0,thigh=right?B.RightThigh:B.LeftThigh,shin=right?B.RightShin:B.LeftShin;
  if(row===2)return [B.Hips,thigh,.60];
  if(row===3)return [B.Hips,thigh,.28];
  return kneeWeights(p,thigh,shin);
}

export function makeContinuousSkirt(recipe:Recipe):GarmentPiece {
  const id=recipe.slots.bottom;
  if(id!=='true_short_skirt'&&id!=='long_skirt')throw new Error('未知连续裙装：'+id);
  const long=id==='long_skirt',rows=long?LONG:SHORT,c:Cage={vertices:[],faces:[],anchors:{}};
  const {primary,secondary,accent}=recipe.dyes;
  let previous:number[]=[];const openings:Record<string,number[]>={};
  for(let r=0;r<rows.length;r++){
    const [name,y,width,depth]=rows[r];
    const loop=Array.from({length:SEGMENTS},(_,k)=>{
      const angle=(k+.5)*Math.PI*2/SEGMENTS;
      const p:Vec3=[Math.sin(angle)*width,y,Math.cos(angle)*depth];
      return vertex(c,`Skirt.${name}.${k}`,p,skirtWeights(p,r));
    });
    if(r===0)openings.waist=loop;
    else bridge(c,previous,loop,r<3?'pelvis':long&&y<.489?'shin':'thigh',r===1?secondary:r===rows.length-1?accent:primary);
    previous=loop;
  }
  // 一圈连续下摆、一个共同穿腿口。闭合斜端面提供明确厚度，
  // 不用两条宽裤腿伪装裙子，也不在腿穿出的位置加会切腿的实心底盘。
  const inset=previous.map((vi,k)=>{const v=c.vertices[vi];return vertex(c,`Skirt.HemInset.${k}`,
    [v.p[0]-.007*Math.sin((k+.5)*Math.PI*2/SEGMENTS),v.p[1]-.008,v.p[2]-.007*Math.cos((k+.5)*Math.PI*2/SEGMENTS)],[...v.w]);});
  bridge(c,previous,inset,long?'shin':'thigh',accent);
  openings.hem=inset;orient(c);c.anchors={...openings};
  return{id,slot:'bottom',version:GARMENT_GEOMETRY_VERSION,mesh:c,covers:long?['pelvis','thigh','shin']:['pelvis','thigh'],openings};
}
