import assert from 'node:assert/strict';
import { B, type Cage } from '../src/character/v3/types';
import { triCount } from '../src/character/v3/cage';
import type { GarmentPiece } from '../src/character/wardrobe/assets/contract';
import { assertGarmentPiece } from './check-garment-assets';

export function assertMediumArmorSkirt(piece:GarmentPiece):void {
  assertGarmentPiece(piece);
  const c=piece.mesh;
  assert.equal(piece.id,'medium_armor_skirt');
  assert.equal(triCount(c),308);assert.equal(c.vertices.length,156);
  assert.deepEqual(piece.covers,['pelvis','thigh','shin']);
  assert(c.vertices.every(v=>v.id.startsWith('MediumArmorSkirt.')||v.id.startsWith('MediumArmorLiner.')),'中甲下装不得拼接已退役驻地裙甲、居民裙或外挂板');
  assert.equal(c.vertices.filter(v=>v.id.startsWith('MediumArmorSkirt.')).length,60);
  assert.equal(c.vertices.filter(v=>v.id.startsWith('MediumArmorLiner.')).length,96);
  assert.equal(piece.sealedInterfaces!.waist.length,10);
  for(const side of ['Left','Right'])assert.equal(piece.sealedInterfaces![side+'Cuff'].length,8);
  const lookup=new Map(c.vertices.map((v,i)=>[v.id,{v,i}]));
  const get=(id:string)=>{const result=lookup.get(id);assert(result,'缺少中甲制作点 '+id);return result;};
  const ring=(row:number)=>Array.from({length:10},(_,k)=>get('MediumArmorSkirt.'+row+'.'+k));
  for(let row=0;row<6;row++){
    const loop=ring(row);
    for(const {v} of loop)assert.deepEqual(v.w,row===0?[B.Hips,B.Hips,1]:[B.Hips,v.p[0]>0?B.RightThigh:B.LeftThigh,[1,.60,.45,.35,.29,.28][row]]);
    for(const [a,b] of [[0,9],[4,5]])assert(c.faces.some(f=>f.v.includes(loop[a].i)&&f.v.includes(loop[b].i)),'中甲裙前后必须跨中线');
  }
  const waist=ring(0),hem=ring(5);
  assert(waist.every(x=>x.v.p[1]>1.06&&x.v.p[1]<1.09),'中甲裙必须从腰起');
  assert(hem.every(x=>x.v.p[1]>.67&&x.v.p[1]<.75),'中甲长甲裙应落在大腿中下段');
  assert(hem[2].v.p[0]>waist[2].v.p[0]+.08,'中甲裙身需要外展');
  assert(hem[0].v.p[2]>.17,'中甲前摆底部必须保留外展留量');
  for(const side of ['Right','Left'])for(const k of [0,4,5,6,7]){
    const {v}=get('MediumArmorLiner.'+side+'.Entry.'+k),end=k===0||k===4;
    assert.equal(v.p[1],end?.835:k===6?.850:.865);
    assert.deepEqual(v.w,[B.Hips,side==='Right'?B.RightThigh:B.LeftThigh,end?.40:k===6?.35:.50]);
  }
  const front=c.faces.find(f=>f.v.includes(get('MediumArmorLiner.Left.Entry.4').i)&&f.v.includes(get('MediumArmorSkirt.5.0').i))!;
  assert(front&&front.v.length===4);
  assert.deepEqual([c.vertices[front.v[0]].id,c.vertices[front.v[2]].id].sort(),['MediumArmorLiner.Right.Entry.0','MediumArmorSkirt.5.9'].sort());
  const neighbors=Array.from({length:c.vertices.length},()=>new Set<number>());
  for(const f of c.faces)for(let k=0;k<f.v.length;k++){const a=f.v[k],b=f.v[(k+1)%f.v.length];neighbors[a].add(b);neighbors[b].add(a);}
  const seen=new Set<number>(),todo=[0];while(todo.length){const n=todo.pop()!;if(seen.has(n))continue;seen.add(n);todo.push(...neighbors[n]);}
  assert.equal(seen.size,c.vertices.length,'中甲裙身、裆口和裤管必须为一个连通壳');
}

function neutralSignature(c:Cage){
  const accept=(id:string)=>id.startsWith('Top.')||id.startsWith('MediumArmorSkirt.')||id.startsWith('MediumArmorLiner.');
  const ids=c.vertices.map(v=>v.id);
  return {
    vertices:c.vertices.filter(v=>accept(v.id)).map(v=>({id:v.id,p:v.p,w:v.w})),
    faces:c.faces.filter(f=>f.v.every(i=>accept(ids[i]))).map(f=>({v:f.v.map(i=>ids[i]),region:f.region,part:f.part})),
  };
}

export function assertSharedMediumArmor(palace:Cage,frontier:Cage){
  const p=neutralSignature(palace),f=neutralSignature(frontier);
  assert.deepEqual(f,p,'皇宫/边疆不得再复制两套相似甲胄轮廓');
  return {
    garmentVertices:p.vertices.length,
    topVertices:palace.vertices.filter(v=>v.id.startsWith('Top.')).length,
    bottomVertices:palace.vertices.filter(v=>v.id.startsWith('MediumArmorSkirt.')||v.id.startsWith('MediumArmorLiner.')).length,
  };
}
