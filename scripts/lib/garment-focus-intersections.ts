import type { Cage, Vec3 } from '../../src/character/v3/types';

export type Triangle = [Vec3, Vec3, Vec3];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const dot = (a: Vec3, b: Vec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

/** 与既有 tailoring 检查相同的严格非共面贯穿判定及容差。没有服装豁免。 */
export function pierces(a: Vec3, b: Vec3, p: Triangle): boolean {
  const e1=sub(p[1],p[0]), e2=sub(p[2],p[0]), d=sub(b,a), h=cross(d,e2), det=dot(e1,h);
  if (Math.abs(det)<1e-11) return false;
  const s=sub(a,p[0]), inv=1/det, u=inv*dot(s,h);
  if (u<=1e-6 || u>=1-1e-6) return false;
  const q=cross(s,e1), v=inv*dot(d,q), t=inv*dot(e2,q);
  return v>1e-6 && u+v<1-1e-6 && t>1e-6 && t<1-1e-6;
}
export function triangles(c: Cage, lowerOnly=false): { indices: number[][]; focus: boolean[] } {
  const indices: number[][]=[], focus: boolean[]=[];
  for (const f of c.faces) {
    if (lowerOnly && !['pelvis','thigh','shin'].includes(f.region)) continue;
    for (let k=1;k<f.v.length-1;k++) {
      indices.push([f.v[0],f.v[k],f.v[k+1]]); focus.push(f.part==='top');
    }
  }
  return {indices,focus};
}
export function skinPoints(c: Cage, matrices: Float32Array): Vec3[] {
  return c.vertices.map(v=>{
    const p: Vec3=[0,0,0];
    for (const [bone,w] of [[v.w[0],v.w[2]],[v.w[1],1-v.w[2]]]) {
      const k=bone*16;
      for (let a=0;a<3;a++) p[a]+=w*(matrices[k+a]*v.p[0]+matrices[k+4+a]*v.p[1]+matrices[k+8+a]*v.p[2]+matrices[k+12+a]);
    }
    return p;
  });
}
/** focus 只限定“包含本轮 top”的三角对；下装自身仍由原全目录检查负责。 */
export function findIntersections(c: Cage, points: Vec3[], indices: number[][], focus?: boolean[]) {
  const tris=indices.map(ix=>{
    const p=ix.map(i=>points[i]) as Triangle;
    return {p,lo:[0,1,2].map(a=>Math.min(...p.map(v=>v[a]))),hi:[0,1,2].map(a=>Math.max(...p.map(v=>v[a])))};
  });
  const order=tris.map((_,i)=>i).sort((a,b)=>tris[a].lo[0]-tris[b].lo[0]);
  let testedPairs=0, hits=0;
  const examples: {a:string[];b:string[]}[]=[];
  for (let ai=0;ai<order.length;ai++) {
    const a=order[ai],x=tris[a];
    for (let bi=ai+1;bi<order.length;bi++) {
      const b=order[bi],y=tris[b];
      if (y.lo[0]>x.hi[0]) break;
      if (focus && !focus[a] && !focus[b]) continue;
      if (x.hi[1]<y.lo[1] || y.hi[1]<x.lo[1] || x.hi[2]<y.lo[2] || y.hi[2]<x.lo[2] || indices[a].some(i=>indices[b].includes(i))) continue;
      testedPairs++;
      if (![0,1,2].some(t=>pierces(x.p[t],x.p[(t+1)%3],y.p)||pierces(y.p[t],y.p[(t+1)%3],x.p))) continue;
      hits++;
      if (examples.length<8) examples.push({a:indices[a].map(i=>c.vertices[i].id),b:indices[b].map(i=>c.vertices[i].id)});
    }
  }
  return {testedPairs,hits,examples};
}
