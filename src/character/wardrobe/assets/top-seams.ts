import { B, type Cage, type Recipe, type Vec3, type Weight } from '../../v3/types';
import { HEX, ring, bridge, face, vertex, orient } from '../../v3/cage';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';

/** 有限的缝片操作。款式坐标/袖筒由各资产制作，不接受人体或可编辑版型参数。 */
export type TorsoRow = readonly [name:string, y:number, width:number, depth:number, cuts:readonly [number,number,number,number], weights:Weight];
export type SleeveRow = readonly [name:string, x:number, y:number, z:number, width:number, depth:number, weights:Weight, color:string];
export interface SewnTorso { mesh:Cage; loops:number[][]; chest:number[]; shoulder:number[] }

export function sewTorso(rows:readonly TorsoRow[], colors:readonly (readonly string[])[]):SewnTorso {
  if(colors.length!==rows.length-1)throw new Error('衣片色区行数不匹配');
  const mesh:Cage={vertices:[],faces:[],anchors:{}};
  const loops=rows.map(([name,y,width,depth,cuts,weights])=>{
    const edge=.76*width;
    if(cuts.some((x,i)=>x<=-edge||x>=edge||(i>0&&x<=cuts[i-1])))throw new Error(`衣片前襟切线次序错误：${name}`);
    // 前襟上的切线是共享索引，不是浮在衣身上的领条。相邻色块拥有同一条缝。
    const front=[-edge,...cuts,edge].map(x=>[x,y,depth*(1-.22*Math.abs(x)/edge)] as Vec3);
    const points:Vec3[]=[...front,[width,y,0],[edge,y,-.78*depth],[0,y,-depth],[-edge,y,-.78*depth],[-width,y,0]];
    return points.map((p,i)=>vertex(mesh,`Top.${name}.${i}`,p,[...weights]));
  });
  const chestIndex=rows.findIndex(r=>r[0]==='Chest');
  if(chestIndex<0||rows[chestIndex+1][0]!=='Shoulder')throw new Error('固定袖窿缺少胸肩接口');
  for(let row=0;row<loops.length-1;row++)for(let j=0;j<11;j++){
    if(row===chestIndex&&[5,6,9,10].includes(j))continue;
    const band=colors[row];
    face(mesh,[loops[row][j],loops[row][(j+1)%11],loops[row+1][(j+1)%11],loops[row+1][j]],'torso',band[j<5?j:5]);
  }
  return{mesh,loops,chest:loops[chestIndex],shoulder:loops[chestIndex+1]};
}

export function sewSleeve(torso:SewnTorso,side:1|-1,rows:readonly SleeveRow[]):number[]{
  const {mesh,chest,shoulder}=torso,right=side===1,name=right?'Right':'Left';
  const upper=right?B.RightUpperArm:B.LeftUpperArm;
  const socket=right?[chest[5],chest[6],chest[7],shoulder[7],shoulder[6],shoulder[5]]:[chest[0],chest[10],chest[9],shoulder[9],shoulder[10],shoulder[0]];
  socket.forEach((v,i)=>mesh.vertices[v].w=[B.Chest,upper,i<3?.87:.62]);
  let prev=socket;
  for(const [label,x,y,z,width,depth,weights,color]of rows){
    const next=ring(mesh,`Top.${name}.${label}`,[side*x,y,z],[side*.866,.5,0],[0,0,1],HEX,width,depth,weights);
    bridge(mesh,prev,next,y>1.12?'upperArm':'forearm',color);prev=next;
  }
  return prev;
}

export function finishTop(recipe:Recipe,torso:SewnTorso,cuffs:Record<string,number[]>,long:boolean):GarmentPiece{
  const openings={waist:torso.loops[0],neck:torso.loops.at(-1)!,...cuffs};
  orient(torso.mesh);torso.mesh.anchors={...openings};
  return{id:recipe.slots.top,slot:'top',version:GARMENT_GEOMETRY_VERSION,mesh:torso.mesh,covers:long?['torso','upperArm','forearm']:['torso','upperArm'],openings};
}
export const solidBand=(color:string):readonly string[]=>[color,color,color,color,color,color];
export const torsoWaist:Weight=[B.Hips,B.Spine,.35];
export const torsoRib:Weight=[B.Spine,B.Chest,.35];
export const torsoChest:Weight=[B.Chest,B.Chest,1];
export const torsoNeck:Weight=[B.Chest,B.Neck,.35];
export function armBones(side:1|-1){return side===1?[B.RightUpperArm,B.RightForearm,B.RightHand] as const:[B.LeftUpperArm,B.LeftForearm,B.LeftHand] as const;}
