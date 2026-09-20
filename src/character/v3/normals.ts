import type {Cage,Vec3} from './types';
import {add,mul,dot,sub,unit,polygonNormal} from './cage';

/**
 * 只在新衣面髋臀/腿根共享法线；颜色分缝仍拆渲染顶点。
 * 依据逻辑拓扑累加角度加权法线，不做距离焊接或逐帧重算法线。
 * 源人体与领口/腰带/帽冠保持原硬边；两端渐退，避免整个人物塑料化。
 */
export function surfaceCornerNormals(c:Cage):Vec3[][] {
  const normals=c.faces.map(f=>polygonNormal(c,f));
  if(!c.anchors.SeatGusset)return c.faces.map((f,i)=>f.v.map(()=>normals[i]));
  const selected=c.faces.map(f=>f.region==='pelvis'||f.region==='thigh');
  const sums=new Map<number,Vec3>();
  c.faces.forEach((f,fi)=>{
    if(!selected[fi])return;
    for(let k=0;k<f.v.length;k++){
      const vi=f.v[k],p=c.vertices[vi].p;
      const a=unit(sub(c.vertices[f.v[(k+f.v.length-1)%f.v.length]].p,p));
      const b=unit(sub(c.vertices[f.v[(k+1)%f.v.length]].p,p));
      const angle=Math.acos(Math.max(-1,Math.min(1,dot(a,b))));
      sums.set(vi,add(sums.get(vi)??[0,0,0],mul(normals[fi],angle)));
    }
  });
  return c.faces.map((f,fi)=>f.v.map(vi=>{
    const id=c.vertices[vi].id;
    if(!selected[fi]||/^(Waist|RightKneeUpper|LeftKneeUpper)\./.test(id))return normals[fi];
    const sum=sums.get(vi);if(!sum||Math.hypot(...sum)<1e-8)return normals[fi];
    return unit(add(mul(normals[fi],.15),mul(unit(sum),.85)));
  }));
}
