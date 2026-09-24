import type { AnimalMeshData, LivestockLodId, Point } from '../livestock/types';
import { GOOSE_BONES as B, GOOSE_SOLE } from './rig';

export const GOOSE_MESH_VERSION = 'wanhu-white-goose-mesh-v1';
interface Ring { z: number; y: number; rx: number; ry: number; sides: number; tilt: number; bone: number; color: string }
const feather = '#d8d3c6', chest = '#e0d9c8', bill = '#ce8e36', foot = '#c88a37';
/** 朝向沿颈部中心线变化的截面；不是将鸭网格缩放或把长颈做成相交的小壳。 */
export function buildGooseMesh(lod: LivestockLodId = 'lod0'): AnimalMeshData {
  if (!['lod0', 'lod1', 'lod2'].includes(lod)) throw new Error(`未知鹅LOD：${lod}`);
  const data: AnimalMeshData = { positions: [], indices: [], bones: [], colors: [], parts: [], version: `${GOOSE_MESH_VERSION}/${lod}` };
  const vertex = (p: Point, bone: number, color: string) => {
    const index = data.positions.length;
    data.positions.push(p); data.bones.push(bone); data.colors.push(color); return index;
  };
  const r = (z: number, y: number, rx: number, ry: number, sides: number, tilt = 0, bone = B.Body as number, color = feather): Ring => ({ z, y, rx, ry, sides, tilt, bone, color });
  const rows: Ring[] = lod === 'lod0' ? [
    r(-.300,.285,.075,.070,6), r(-.170,.275,.190,.140,8), r(.035,.310,.178,.157,8,.10),
    r(.145,.350,.098,.090,6,.60,B.Body,chest), r(.175,.435,.050,.052,6,1.37,B.NeckBase,chest),
    r(.160,.550,.036,.041,6,1.62,B.NeckBase), r(.175,.670,.034,.038,6,1.23,B.NeckTip),
    r(.215,.760,.036,.042,6,.95,B.NeckTip), r(.285,.790,.057,.048,6,.12,B.Head),
    r(.334,.783,.049,.032,4,0,B.Head,bill), r(.421,.763,.033,.017,4,0,B.Head,bill),
  ] : lod === 'lod1' ? [
    r(-.170,.280,.193,.145,6), r(.060,.315,.173,.148,6,.10), r(.155,.380,.075,.076,4,.90,B.Body,chest),
    r(.163,.510,.041,.045,4,1.52,B.NeckBase), r(.178,.660,.040,.043,4,1.25,B.NeckTip),
    r(.220,.760,.040,.045,4,.90,B.NeckTip), r(.298,.792,.067,.053,3,0,B.Head),
    r(.421,.763,.038,.020,3,0,B.Head,bill),
  ] : [
    r(-.140,.290,.220,.160,4), r(.145,.370,.110,.100,3,.70,B.Body,chest),
    r(.165,.540,.047,.050,3,1.50,B.NeckBase), r(.185,.700,.045,.050,3,1.15,B.NeckTip),
    r(.287,.790,.073,.058,3,0,B.Head), r(.421,.763,.040,.020,3,0,B.Head,bill),
  ];
  const rings = rows.map((row, index) => Array.from({ length: row.sides }, (_, i) => {
    const a = Math.PI / 2 + i * Math.PI * 2 / row.sides, s = Math.sin(a);
    // 嘴根的小隆起直接并入截面，不额外放一个悬空额瘤。
    const forehead = lod === 'lod0' && index === 9 && s > .9 ? .018 : 0;
    return vertex([Math.cos(a)*row.rx, row.y+s*row.ry*Math.cos(row.tilt)+forehead, row.z-s*row.ry*Math.sin(row.tilt)], row.bone, row.color);
  }));
  // 共享接口顶点连接不同边数的截面，三档均为尾—身—双段颈—头—喙的连续闭合主壳。
  for (let k = 1; k < rings.length; k++) {
    const a = rings[k-1], b = rings[k]; let i = 0, j = 0;
    while (i < a.length || j < b.length) {
      if (j === b.length || (i < a.length && (i+1)*b.length <= (j+1)*a.length)) {
        data.indices.push(a[i%a.length], a[(i+1)%a.length], b[j%b.length]); i++;
      } else { data.indices.push(a[i%a.length], b[(j+1)%b.length], b[j%b.length]); j++; }
    }
  }
  const tail = vertex([0,.337,-.380],B.Body,feather), first = rings[0], last = rings[rings.length-1];
  for (let i=0;i<first.length;i++) data.indices.push(tail,first[(i+1)%first.length],first[i]);
  for (let i=1;i<last.length-1;i++) data.indices.push(last[0],last[i],last[i+1]);
  data.parts.push({ name: 'BodyNeckHeadBill', start: 0, count: data.positions.length });
  function solid(name: string, points: Point[], faces: number[][], bone: number, color: string) {
    const start = data.positions.length, center = [0,0,0];
    points.forEach(p=>p.forEach((v,i)=>center[i]+=v/points.length));
    points.forEach(p=>vertex(p,bone,color));
    for (const face of faces) for (let k=1;k<face.length-1;k++) {
      const ids=[face[0],face[k],face[k+1]], [a,b,c]=ids.map(i=>points[i]);
      const u=b.map((v,i)=>v-a[i]), v=c.map((n,i)=>n-a[i]);
      const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      if(n.reduce((sum,value,i)=>sum+value*(a[i]-center[i]),0)<0) [ids[1],ids[2]]=[ids[2],ids[1]];
      data.indices.push(...ids.map(i=>start+i));
    }
    data.parts.push({name,start,count:points.length});
  }
  const tetra=[[0,1,2],[0,3,1],[1,3,2],[2,3,0]];
  for (const side of [-1,1]) {
    const suffix=side<0?'L':'R', x=side*.094, bone=side<0?B.LegL:B.LegR;
    const sole=GOOSE_SOLE.map(([px,y,z])=>[x+px,y,z] as Point);
    if(lod==='lod2') solid('Leg'+suffix,[...sole,[x,.260,-.040]],tetra,bone,foot);
    else solid('Leg'+suffix,[...sole,[x-.012,.260,-.036],[x+.012,.260,-.036],[x,.260,-.055]],[[0,1,2],[3,5,4],[0,3,4,1],[1,4,5,2],[2,5,3,0]],bone,foot);
    if(lod==='lod0') solid('Eye'+suffix,[[side*.047,.800,.299],[side*.047,.810,.299],[side*.047,.805,.312],[side*.056,.805,.304]],tetra,B.Head,'#292b28');
  }
  return data;
}
