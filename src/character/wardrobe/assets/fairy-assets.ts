import snapshot from './published/fairy.generated.json';
import type { Cage, GarmentDyes, Recipe, Region, Vec3, Weight } from '../../v3/types';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';

export const FAIRY_DEFAULT_DYES:GarmentDyes=snapshot.defaultDyes;

/** 保留各衣装作者Palette的色差；三色染色相对默认色改变，不把两件色表压成同一套RGB。 */
export function fairyColor(slot:'top'|'bottom',cell:number,dyes:GarmentDyes):string {
  const piece=snapshot.pieces.find(p=>p.slot===slot)!;
  const source=piece.palette[String(cell) as keyof typeof piece.palette];
  if(!source)throw new Error('仙裙发布快照缺少调色板格：'+cell);
  const key:keyof GarmentDyes=slot==='top'?(cell===8?'primary':'accent'):(cell===8?'secondary':cell===9?'primary':'accent');
  const linear=(hex:string,channel:number)=>{const value=parseInt(hex.slice(1+channel*2,3+channel*2),16)/255;return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);};
  return '#'+source.slice(0,3).map((value,channel)=>{
    const scaled=Math.min(1,Math.max(0,value*linear(dyes[key],channel)/linear(FAIRY_DEFAULT_DYES[key],channel)));
    const srgb=scaled<=.0031308?12.92*scaled:1.055*Math.pow(scaled,1/2.4)-.055;
    return Math.round(srgb*255).toString(16).padStart(2,'0');
  }).join('');
}

/** 两件Blender仙裙的发布快照；坐标已转换为网页基准，装配仅执行原有一次体型映射。 */
export function makeFairyGarment(recipe:Recipe,slot:'top'|'bottom'):GarmentPiece {
  const source=snapshot.pieces.find(piece=>piece.slot===slot);
  if(!source)throw new Error('仙裙发布快照缺少衣装槽位：'+slot);
  const dyeForCell:Record<number,string>=Object.fromEntries([8,9,10].map(cell=>[cell,fairyColor(slot,cell,recipe.dyes)]));
  const mesh:Cage={
    vertices:source.vertices.map((v,index)=>({id:(slot==='top'?'FairyJacket':'FairySkirt')+'.Vertex.'+index,p:[...v.p] as Vec3,w:[...v.w] as Weight})),
    faces:source.faces.map(face=>({v:[...face.v],region:face.region as Region,color:dyeForCell[face.cell],...('normals' in face?{authoredNormals:(face.normals as number[][]).map(normal=>[...normal] as Vec3)}:{})})),
    anchors:Object.fromEntries(Object.entries(source.sealedInterfaces).map(([name,loop])=>[name,[...loop]])),
  };
  return {id:slot==='top'?recipe.slots.top:recipe.slots.bottom,slot,version:GARMENT_GEOMETRY_VERSION,mesh,
    covers:[...source.covers] as Region[],openings:{},sealedInterfaces:structuredClone(mesh.anchors)};
}
