import { B, rigid, type Cage, type Recipe, type Vec3 } from '../v3/types';
import { OCT, BOX, ring, bridge, face, vertex, orient } from '../v3/cage';

export const PALACE_EQUIPMENT_VERSION='wanhu-palace-equipment-v1';
export const MILITARY_SPEAR_GRIP:Vec3=[.530,.865,.025];
function append(target:Cage,piece:Cage){orient(piece);const n=target.vertices.length;target.vertices.push(...piece.vertices);target.faces.push(...piece.faces.map(f=>({...f,v:f.v.map(i=>i+n)})));}

/** 一体盔壳、后颈护片、闭合低模缨束；全部刚性随Head，无发片和新骨。 */
export function addPalaceHelmet(target:Cage,recipe:Recipe):void {
  const c:Cage={vertices:[],faces:[],anchors:{}},w=rigid(B.Head),{primary,secondary,accent}=recipe.dyes;
  const rows=[['Base',1.704,.137,.137],['Brow',1.727,.137,.138],['Dome',1.777,.126,.130],['Crown',1.853,.075,.076],['Finial',1.901,.019,.021]] as const;
  const loops=rows.map(([id,y,x,z])=>ring(c,`PalaceHelmet.Shell.${id}`,[0,y,-.006],[1,0,0],[0,0,1],OCT,x,z,w));
  for(let i=0;i<loops.length-1;i++)bridge(c,loops[i],loops[i+1],'equipment',i===0?accent:secondary);
  face(c,loops[0],'equipment',accent);face(c,loops.at(-1)!,'equipment',secondary);
  const strips:number[][]=[];
  for(const [label,y,radius] of [['OuterTop',1.720,.145],['OuterLow',1.588,.159],['InnerLow',1.591,.149],['InnerTop',1.720,.135]] as const){
    strips.push([2,3,4,5,6].map(i=>vertex(c,`PalaceHelmet.Neck.${label}.${i}`,[OCT[i][0]*radius,y,OCT[i][1]*radius-.006],w)));
  }
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)face(c,[strips[i][j],strips[i][j+1],strips[(i+1)%4][j+1],strips[(i+1)%4][j]],'equipment',i===1?accent:secondary);
  face(c,strips.map(s=>s[0]),'equipment',secondary);face(c,strips.map(s=>s[4]).reverse(),'equipment',secondary);
  const base=ring(c,'PalaceHelmet.Plume.Base',[0,1.893,-.006],[1,0,0],[0,0,1],BOX,.016,.020,w);
  const mid=ring(c,'PalaceHelmet.Plume.Mid',[0,1.974,-.036],[1,0,0],[0,0,1],BOX,.035,.043,w);
  const tip=vertex(c,'PalaceHelmet.Plume.Tip',[0,1.990,-.109],w);
  face(c,base,'equipment',primary);bridge(c,base,mid,'equipment',primary);
  for(let i=0;i<4;i++)face(c,[mid[i],mid[(i+1)%4],tip],'equipment',primary);
  append(target,c);
}

/** 只负责绑定空间的闭合武器几何。姿态随RightHand，不锁世界竖直、不做手部IK。 */
export function addMilitarySpear(target:Cage,recipe:Recipe):void {
  const c:Cage={vertices:[],faces:[],anchors:{}},w=rigid(B.RightHand),[x,,z]=MILITARY_SPEAR_GRIP;
  const profile=Array.from({length:6},(_,i)=>[Math.sin(i*Math.PI/3),Math.cos(i*Math.PI/3)] as [number,number]);
  const rings=[.080,.865,1.800,1.850].map((y,i)=>ring(c,`MilitarySpear.Shaft.${i}`,[x,y,z],[1,0,0],[0,0,1],profile,i>1?.016:.012,i>1?.016:.012,w));
  for(let i=0;i<3;i++)bridge(c,rings[i],rings[i+1],'equipment',i===2?recipe.dyes.accent:'#665039');
  face(c,rings[0],'equipment','#665039');face(c,rings[3],'equipment',recipe.dyes.accent);
  const blade=ring(c,'MilitarySpear.Blade.Base',[x,1.841,z],[1,0,0],[0,0,1],BOX,.012,.006,w);
  const widest=ring(c,'MilitarySpear.Blade.Edge',[x,1.912,z],[1,0,0],[0,0,1],BOX,.034,.009,w);
  const tip=vertex(c,'MilitarySpear.Blade.Tip',[x,2.030,z],w);
  face(c,blade,'equipment','#868b87');bridge(c,blade,widest,'equipment','#868b87');
  for(let i=0;i<4;i++)face(c,[widest[i],widest[(i+1)%4],tip],'equipment',i%2?'#868b87':'#a2a69f');
  append(target,c);
}
