import { cloneCage, triCount } from '../v3/cage';
import type { Cage, Recipe, Region } from '../v3/types';
import { makeTop } from './assets/tops';
import { makeTrousers } from './assets/trousers';
import { makeFootwear } from './assets/footwear';
export { GARMENT_GEOMETRY_VERSION, BODY_HIDE_VERSION } from './assets/contract';
export { type GarmentPiece } from './assets/contract';

/** 主槽位装配：固定覆盖表只作用于皮肤，绝不按当前动作删面。 */
export function assembleGarments(body:Cage,recipe:Recipe){
  const pieces=[makeTop(recipe),makeTrousers(recipe),makeFootwear(recipe)].filter(p=>p!==undefined);
  const covered=new Set<Region>(pieces.flatMap(p=>p.covers));
  const c=cloneCage(body);
  c.faces=c.faces.filter(f=>!covered.has(f.region)).map(f=>({...f,color:'#c8956e',part:'skin' as const}));
  for(const piece of pieces){
    const offset=c.vertices.length;
    c.vertices.push(...piece.mesh.vertices);
    c.faces.push(...piece.mesh.faces.map(f=>({...f,v:f.v.map(i=>i+offset),part:piece.slot})));
    for(const [name,loop]of Object.entries(piece.openings))c.anchors[piece.slot+'.'+name]=loop.map(i=>i+offset);
  }
  const replacedTriangles=body.faces.filter(f=>covered.has(f.region)).reduce((n,f)=>n+f.v.length-2,0);
  const garments=pieces.map(p=>({id:p.id,slot:p.slot,version:p.version,triangles:triCount(p.mesh),covers:[...p.covers],openings:Object.keys(p.openings)}));
  return {surface:c,replacedTriangles,garments};
}

/** 装配结束移除不再引用的皮肤/头髻顶点；不保留失效资源占位。 */
export function compactSurface(c:Cage):Cage{
  const used=new Set(c.faces.flatMap(f=>f.v)),ids=[...used].sort((a,b)=>a-b),remap=new Map(ids.map((old,i)=>[old,i]));
  return {vertices:ids.map(i=>c.vertices[i]),faces:c.faces.map(f=>({...f,v:f.v.map(i=>remap.get(i)!)})),anchors:Object.fromEntries(Object.entries(c.anchors).filter(([,loop])=>loop.every(i=>used.has(i))).map(([name,loop])=>[name,loop.map(i=>remap.get(i)!)]))};
}
