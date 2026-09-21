import { makeShortBottom } from './short-bottoms';
import { straightClothRows, boundActionRows, type LegRow } from './authored-legs';
import { B, type Cage, type Recipe, type Weight } from '../../v3/types';
import { ring, bridge, vertex, face, orient } from '../../v3/cage';
import { KNEE, kneeWeights } from '../../v3/leg-deformation';
import { BOTTOM_PATTERNS } from '../patterns';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';

/** 独立裤装：腰臀和四片裆底保持；膝前后使用不同权重梯度，不压扁膝后截面。 */
export function makeTrousers(recipe:Recipe):GarmentPiece|undefined {
  const id=recipe.slots.bottom;if(id==='body')return;
  const pattern=BOTTOM_PATTERNS[id];if(!pattern)throw new Error('下装资产未注册：'+id);
  if(pattern.asset==='short-trousers'||pattern.asset==='short-skirt')return makeShortBottom(recipe);
  const authored=pattern.asset!=='classic';
  const c:Cage={vertices:[],faces:[],anchors:{}},{primary,secondary}=recipe.dyes;
  const profile:[number,number][]=[[-.45,.9],[.5,.9],[1,0],[.5,-.9],[-.45,-.9],[-.88,-.52],[-1,0],[-.88,.52]];
  const roots:number[][]=[],openings:Record<string,number[]>={};
  for(const side of [1,-1]){
    const right=side===1,name=right?'Right':'Left',thigh=right?B.RightThigh:B.LeftThigh,shin=right?B.RightShin:B.LeftShin,foot=right?B.RightFoot:B.LeftFoot;
    const directed=right?profile:profile.map(([x,z])=>[-x,-z] as [number,number]);
    const root=ring(c,`Pants.${name}.Root`,[side*.101,.94,0],[1,0,0],[0,0,1],directed,.09,.094,[B.Hips,thigh,.55]);
    for(const k of [5,6,7]){c.vertices[root[k]].p[1]=k===6?.855:.882;c.vertices[root[k]].w=[B.Hips,thigh,k===6?.35:.5];}
    roots.push(root);
    const legacyRows:[string,number,number,number,Weight][]=pattern.asset==='classic'?[
      ['Thigh',.805,.089*pattern.thigh,.087,[B.Hips,thigh,.28]],
      ['KneeUpper',KNEE.upperY,.064*pattern.knee,.061,[thigh,shin,.94]],
      ['Knee',KNEE.centerY,.060*pattern.knee,.058,[thigh,shin,.5]],
      ['KneeLower',KNEE.lowerY,.061*pattern.knee,.056,[thigh,shin,.06]],
      ['Calf',.29,.066*pattern.calf,.064,[shin,shin,1]],
      ['Cuff',pattern.hem,.046,.045,[shin,foot,.2]],
    ]:[];
    const rows:readonly LegRow[]=id==='loose_trousers'?straightClothRows(thigh,shin,foot):id==='guard_pants'?boundActionRows(thigh,shin,foot):legacyRows.map(([label,y,w,d,weights])=>[label,y,w,d,weights,pattern.asset==='classic'&&pattern.trim&&label==='Cuff'?'accent':'secondary']);
    let prev=root;
    for(let row=0;row<rows.length;row++){
      const [label,y,w,d,weights,color]=rows[row];
      const next=ring(c,`Pants.${name}.${label}`,[side*.101,y,0],[1,0,0],[0,0,1],directed,w,d,weights);
      // 行动裤只在大腿外侧留量，内侧裆底和关节位置不被整体膨胀。
      if(id==='guard_pants'&&label==='Thigh')for(const k of [1,2,3])c.vertices[next[k]].p[0]+=side*(k===2?.017:.010);
      if(label.startsWith('Knee')||label==='Calf')for(const i of next)c.vertices[i].w=kneeWeights(c.vertices[i].p,thigh,shin);
      bridge(c,prev,next,row<3?'thigh':'shin',recipe.dyes[color]);prev=next;
    }
    openings[name+'Cuff']=prev;
  }
  const [r,l]=roots;
  const right=[r[4],r[5],r[6],r[7],r[0]],left=[l[0],l[7],l[6],l[5],l[4]];
  for(let i=0;i<4;i++)face(c,[right[i],right[i+1],left[i+1],left[i]],'pelvis',secondary);
  const perimeter=[r[0],r[1],r[2],r[3],r[4],l[0],l[1],l[2],l[3],l[4]];
  const waist=perimeter.map((v,i)=>{const p=c.vertices[v].p;return vertex(c,`Pants.Waist.${i}`,[p[0]*.79,1.075,p[2]*.97],[B.Hips,B.Spine,.35]);});
  if(authored){
    const band=perimeter.map((v,i)=>{const p=c.vertices[v].p;return vertex(c,`Pants.WaistFacing.${i}`,[p[0]*.84,1.047,p[2]*.98],[B.Hips,B.Spine,.35]);});
    bridge(c,waist,band,'pelvis',primary);bridge(c,band,perimeter,'pelvis',secondary);
  }else bridge(c,waist,perimeter,'pelvis',secondary);
  openings.waist=waist;
  orient(c);c.anchors={...openings};
  return{id,slot:'bottom',version:GARMENT_GEOMETRY_VERSION,mesh:c,covers:['pelvis','thigh','shin'],openings};
}
