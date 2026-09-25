import { B, type Cage, type Recipe, type Weight } from '../../../v3/types';
import { ring, bridge, vertex, face, orient } from '../../../v3/cage';
import { KNEE, kneeWeights } from '../../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from '../contract';

/** 城市巡守军裤：独立腰头与窄小腿轮廓；不附腿板、不生成裙壳，只共享原膝权重操作。 */
export function makeCityTrousers(recipe:Recipe):GarmentPiece {
  const c:Cage={vertices:[],faces:[],anchors:{}},{primary:cloth,accent:belt,secondary:iron}=recipe.dyes;
  const profile:[number,number][]=[[-.45,.9],[.5,.9],[1,0],[.5,-.9],[-.45,-.9],[-.88,-.52],[-1,0],[-.88,.52]];
  const roots:number[][]=[],openings:Record<string,number[]>={};
  for(const side of [1,-1]){
    const right=side===1,name=right?'Right':'Left',thigh=right?B.RightThigh:B.LeftThigh,shin=right?B.RightShin:B.LeftShin,foot=right?B.RightFoot:B.LeftFoot;
    const directed=right?profile:profile.map(([x,z])=>[-x,-z] as [number,number]);
    const root=ring(c,`CityPants.${name}.Root`,[side*.101,.94,0],[1,0,0],[0,0,1],directed,.09,.094,[B.Hips,thigh,.55]);
    for(const k of [5,6,7]){c.vertices[root[k]].p[1]=k===6?.855:.882;c.vertices[root[k]].w=[B.Hips,thigh,k===6?.35:.5];}
    roots.push(root);
    const rows:readonly [string,number,number,number,Weight,string][]=[
      ['Thigh',.805,.086,.087,[B.Hips,thigh,.28],cloth],
      ['KneeUpper',KNEE.upperY,.064,.061,[thigh,shin,.94],cloth],
      ['Knee',KNEE.centerY,.060,.058,[thigh,shin,.5],cloth],
      ['KneeLower',KNEE.lowerY,.061,.056,[thigh,shin,.06],cloth],
      ['Calf',.29,.062,.060,[shin,shin,1],cloth],
      ['Cuff',.095,.046,.045,[shin,foot,.2],iron],
    ];
    let previous=root;
    for(let row=0;row<rows.length;row++){
      const [label,y,width,depth,w,color]=rows[row];
      const next=ring(c,`CityPants.${name}.${label}`,[side*.101,y,0],[1,0,0],[0,0,1],directed,width,depth,w);
      if(label.startsWith('Knee')||label==='Calf')for(const i of next)c.vertices[i].w=kneeWeights(c.vertices[i].p,thigh,shin);
      bridge(c,previous,next,row<3?'thigh':'shin',color);previous=next;
    }
    openings[name+'Cuff']=previous;
  }
  const [r,l]=roots,right=[r[4],r[5],r[6],r[7],r[0]],left=[l[0],l[7],l[6],l[5],l[4]];
  for(let i=0;i<4;i++)face(c,[right[i],right[i+1],left[i+1],left[i]],'pelvis',cloth);
  const perimeter=[r[0],r[1],r[2],r[3],r[4],l[0],l[1],l[2],l[3],l[4]];
  const waistband=perimeter.map((v,i)=>{const p=c.vertices[v].p;return vertex(c,`CityPants.BeltLow.${i}`,[p[0]*.84,1.028,p[2]],[B.Hips,B.Spine,.35]);});
  const waist=perimeter.map((v,i)=>{const p=c.vertices[v].p;return vertex(c,`CityPants.Waist.${i}`,[p[0]*.79,1.075,p[2]*.97],[B.Hips,B.Spine,.35]);});
  bridge(c,waist,waistband,'pelvis',belt);bridge(c,waistband,perimeter,'pelvis',cloth);openings.waist=waist;
  orient(c);c.anchors={...openings};
  return{id:recipe.slots.bottom,slot:'bottom',version:GARMENT_GEOMETRY_VERSION,mesh:c,covers:['pelvis','thigh','shin'],openings};
}
