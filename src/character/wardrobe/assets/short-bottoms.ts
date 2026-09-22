import { B, type Cage, type Recipe, type Weight } from '../../v3/types';
import { ring, bridge, face, vertex, orient } from '../../v3/cage';
import { kneeWeights } from '../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';

/** 封口短裤：保留有限宽裆底，裤脚与腰口直接 Cap。 */
export function makeShortBottom(recipe:Recipe):GarmentPiece {
  const id=recipe.slots.bottom;
  if(id!=='short_trousers')throw new Error('未知短下装：'+id);
  const c:Cage={vertices:[],faces:[],anchors:{}};
  const {primary,secondary,accent}=recipe.dyes;
  const profile:[number,number][]=[[-.45,.9],[.5,.9],[1,0],[.5,-.9],[-.45,-.9],[-.88,-.52],[-1,0],[-.88,.52]];
  const roots:number[][]=[],sealedInterfaces:Record<string,number[]>={};
  for(const side of [1,-1]){
    const name=side===1?'Right':'Left',thigh=side===1?B.RightThigh:B.LeftThigh,shin=side===1?B.RightShin:B.LeftShin;
    const directed=side===1?profile:profile.map(([x,z])=>[-x,-z] as [number,number]);
    const root=ring(c,`Shorts.${name}.Root`,[side*.101,.94,0],[1,0,0],[0,0,1],directed,.09,.094,[B.Hips,thigh,.55]);
    for(const k of [5,6,7]){c.vertices[root[k]].p[1]=k===6?.855:.882;c.vertices[root[k]].w=[B.Hips,thigh,k===6?.35:.5];}
    roots.push(root);let prev=root;
    const rows:readonly [string,number,number,number][]=[
      ['Thigh',.805,.098,.092],['CuffFacing',.550,.087,.081],['Cuff',.507,.087,.081],
    ];
    const inner:readonly [number,number][]=[[.089,.087],[.075,.090],[.075,.090]];
    for(let r=0;r<rows.length;r++){
      const [label,y,width,depth]=rows[r];
      const w:Weight=r===0?[B.Hips,thigh,.28]:[thigh,shin,1];
      const next=ring(c,`Shorts.${name}.${label}`,[side*.101,y,0],[1,0,0],[0,0,1],directed,width,depth,w);
      const [innerWidth,innerDepth]=inner[r];
      for(const k of [0,4,5,6,7])c.vertices[next[k]].p=[side*(.101+profile[k][0]*innerWidth),y,side*profile[k][1]*innerDepth];
      if(r>0)for(const vi of next)c.vertices[vi].w=kneeWeights(c.vertices[vi].p,thigh,shin);
      if(r>0)for(const vi of next){const v=c.vertices[vi];v.p[0]=side*.101+(v.p[0]-side*.101)*1.1;v.p[2]*=1.1;v.w[2]=v.w[2]*.65+(r===rows.length-1?.60:.80)*.35;}
      bridge(c,prev,next,'thigh',r===rows.length-1?accent:secondary);prev=next;
    }
    face(c,[...prev],'thigh',accent);sealedInterfaces[name+'Cuff']=prev;
  }
  const [rightRoot,leftRoot]=roots;
  const r=[rightRoot[4],rightRoot[5],rightRoot[6],rightRoot[7],rightRoot[0]],l=[leftRoot[0],leftRoot[7],leftRoot[6],leftRoot[5],leftRoot[4]];
  for(let i=0;i<4;i++)face(c,[r[i],r[i+1],l[i+1],l[i]],'pelvis',secondary);
  const perimeter=[rightRoot[0],rightRoot[1],rightRoot[2],rightRoot[3],rightRoot[4],leftRoot[0],leftRoot[1],leftRoot[2],leftRoot[3],leftRoot[4]];
  const waist=perimeter.map((vi,i)=>{const p=c.vertices[vi].p;return vertex(c,`Shorts.Waist.${i}`,[p[0]*.79,1.075,p[2]*.97],[B.Hips,B.Spine,.35]);});
  const band=perimeter.map((vi,i)=>{const p=c.vertices[vi].p;return vertex(c,`Shorts.WaistFacing.${i}`,[p[0]*.84,1.047,p[2]*.98],[B.Hips,B.Spine,.35]);});
  bridge(c,waist,band,'pelvis',primary);bridge(c,band,perimeter,'pelvis',secondary);
  face(c,[...waist.slice(2),...waist.slice(0,2)],'pelvis',primary);sealedInterfaces.waist=waist;
  orient(c);c.anchors={...sealedInterfaces};
  return{id,slot:'bottom',version:GARMENT_GEOMETRY_VERSION,mesh:c,covers:['pelvis','thigh'],openings:{},sealedInterfaces};
}
