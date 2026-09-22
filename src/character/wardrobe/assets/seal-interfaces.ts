import type { Cage, Face, Vec3 } from '../../v3/types';
import { cross, sub, dot, edgeKey } from '../../v3/cage';
import type { GarmentPiece } from './contract';

/**
 * 只封作者显式声明的接口，不扫描并自动掩盖未知破洞。
 * 沿用原顶点和权重；选择合法扇分根，保留单个 n-gon 与原硬边法线规则。
 */
export function sealGarmentInterfaces(piece:GarmentPiece,color:string):GarmentPiece {
  const entries=Object.entries(piece.openings);
  if(!entries.length)return piece; // 已验收背心／短裤／布鞋保持逐面不变。
  if(!/^#[0-9a-f]{6}$/i.test(color))throw new Error(`${piece.id}: 封口缺少明确衣料颜色`);
  const c=piece.mesh;
  const edges=new Map<string,{a:number;b:number;face:Face}[]>();
  for(const f of c.faces)for(let k=0;k<f.v.length;k++){
    const a=f.v[k],b=f.v[(k+1)%f.v.length],key=edgeKey(a,b);
    const owners=edges.get(key)??[];owners.push({a,b,face:f});edges.set(key,owners);
  }
  const caps:Face[]=[],sealed={...piece.sealedInterfaces},claimed=new Set<string>();
  for(const [name,loop] of entries){
    if(name in sealed)throw new Error(`${piece.id}/${name}: 开口与封口重复声明`);
    if(loop.length<3||new Set(loop).size!==loop.length||loop.some(i=>!Number.isInteger(i)||i<0||i>=c.vertices.length))throw new Error(`${piece.id}/${name}: 非法接口环`);
    const owners=loop.map((a,k)=>{
      const key=edgeKey(a,loop[(k+1)%loop.length]),edge=edges.get(key);
      if(claimed.has(key)||edge?.length!==1)throw new Error(`${piece.id}/${name}: 接口不是独立边界`);
      claimed.add(key);return edge[0];
    });
    const forward=owners[0].a===loop[0];
    if(owners.some((e,k)=>(e.a===loop[k])!==forward))throw new Error(`${piece.id}/${name}: 接口绕序不一致`);
    // 与已定向衣壳的边方向相反。此后不再 reverse 整个多边形，避免改变扇分根。
    const winding=forward?[loop[0],...loop.slice(1).reverse()]:[...loop];
    caps.push({v:capFan(c,winding,`${piece.id}/${name}`),region:owners[0].face.region,color});
    sealed[name]=[...loop];
  }
  // 全部接口成功后一次提交，失败时不留下半封口资源。
  c.faces.push(...caps);piece.openings={};piece.sealedInterfaces=sealed;
  c.anchors={...c.anchors,...sealed};
  return piece;
}

function capFan(c:Cage,loop:number[],label:string):number[]{
  const origin=c.vertices[loop[0]].p,normal:Vec3=[0,0,0];
  for(let i=1;i<loop.length-1;i++){
    const n=cross(sub(c.vertices[loop[i]].p,origin),sub(c.vertices[loop[i+1]].p,origin));
    for(let a=0;a<3;a++)normal[a]+=n[a];
  }
  const length=Math.hypot(...normal);
  if(!Number.isFinite(length)||length<=1e-10)throw new Error(`${label}: 接口面积退化`);
  for(let a=0;a<3;a++)normal[a]/=length;
  // 正投影中所有扇片必须严格同向；共线的前襟切点不可直接用作根。
  let best:number[]|undefined,bestArea=0;
  for(let start=0;start<loop.length;start++){
    const order=[...loop.slice(start),...loop.slice(0,start)],root=c.vertices[order[0]].p;
    let area=Infinity;
    for(let i=1;i<order.length-1;i++){
      const n=cross(sub(c.vertices[order[i]].p,root),sub(c.vertices[order[i+1]].p,root));
      area=Math.min(area,dot(n,normal));
    }
    if(area>1e-10&&area>bestArea){best=order;bestArea=area;}
  }
  if(!best)throw new Error(`${label}: 无无退化扇分，需修正作者接口，不能跳过封口`);
  return best;
}
