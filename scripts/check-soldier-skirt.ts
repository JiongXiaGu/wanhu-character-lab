import assert from 'node:assert/strict';
import { B } from '../src/character/v3/types';
import { triCount } from '../src/character/v3/cage';
import type { GarmentPiece } from '../src/character/wardrobe/assets/contract';
import { assertGarmentPiece } from './check-garment-assets';

/** 制作空间检查：整体裙甲、真实裤腿出口、权重和覆盖，不能退回六片大腿外挂板。 */
export function assertPalaceSkirt(piece:GarmentPiece):void {
  assertGarmentPiece(piece);
  const c=piece.mesh;
  assert.equal(piece.id,'palace_guard_skirt');
  assert.equal(triCount(c),288);
  assert.equal(c.vertices.length,146);
  assert.equal(new Set(c.vertices.map(v=>v.id)).size,c.vertices.length);
  assert.deepEqual(piece.covers,['pelvis','thigh','shin']);
  assert(!c.vertices.some(v=>v.id.startsWith('PalaceTasset.')||v.id.startsWith('Pants.')),'旧短裤/腿侧板不得回流');
  assert.equal(c.vertices.filter(v=>v.id.startsWith('PalaceSkirt.')).length,50);
  assert.equal(c.vertices.filter(v=>v.id.startsWith('PalaceLiner.')).length,96);
  assert.equal(piece.sealedInterfaces!.waist.length,10);
  for(const side of ['Left','Right'])assert.equal(piece.sealedInterfaces![side+'Cuff'].length,8);

  const byId=new Map(c.vertices.map((v,i)=>[v.id,{v,i}]));
  const get=(id:string)=>{const item=byId.get(id);assert(item,`缺少裙甲制作点：${id}`);return item;};
  const ring=(row:number)=>Array.from({length:10},(_,k)=>get(`PalaceSkirt.${row}.${k}`));
  for(let row=0;row<5;row++){
    const loop=ring(row),hipWeight=[1,.60,.45,.35,.33][row];
    for(const {v} of loop){
      const thigh=v.p[0]>0?B.RightThigh:B.LeftThigh;
      assert.deepEqual(v.w,row===0?[B.Hips,B.Hips,1]:[B.Hips,thigh,hipWeight]);
    }
    // 正背面都跨中轴，前摆不再是左右两个小挂片。
    for(const [a,b] of [[0,9],[4,5]])assert(c.faces.some(f=>f.v.includes(loop[a].i)&&f.v.includes(loop[b].i)),'裙摆中线断开');
    assert(loop[2].v.p[0]>0&&loop[7].v.p[0]<0);
  }
  const waist=ring(0),hem=ring(4);
  assert(waist.every(x=>x.v.p[1]>1.06&&x.v.p[1]<1.09),'裙甲必须从腰部开始');
  assert(hem.every(x=>x.v.p[1]>.74&&x.v.p[1]<.82),'短甲裙不能缩成腰饰或延伸到膝下');
  assert(hem[2].v.p[0]>waist[2].v.p[0]+.06,'甲裙应略微外展');
  assert(Math.abs(hem[0].v.p[2])>.14,'正面前摆缺失');
  // 前后内侧出口抬入裙内，保留裆部空间，不用横跨双腿的低位平面封底。
  for(const side of ['Right','Left']){
    const thigh=side==='Right'?B.RightThigh:B.LeftThigh;
    for(const k of [0,4,5,6,7]){
      const {v}=get(`PalaceLiner.${side}.Entry.${k}`),end=k===0||k===4;
      assert.equal(v.p[1],end?.835:k===6?.850:.865);
      assert.deepEqual(v.w,[B.Hips,thigh,end?.40:k===6?.35:.50]);
    }
  }
  // 所有裙面、裆部与裤腿属于同一连通壳，拒绝单独粘贴但各自闭合的替代物。
  const neighbors=Array.from({length:c.vertices.length},()=>new Set<number>());
  for(const f of c.faces)for(let k=0;k<f.v.length;k++){const a=f.v[k],b=f.v[(k+1)%f.v.length];neighbors[a].add(b);neighbors[b].add(a);}
  const seen=new Set<number>(),todo=[0];
  while(todo.length){const n=todo.pop()!;if(seen.has(n))continue;seen.add(n);todo.push(...neighbors[n]);}
  assert.equal(seen.size,c.vertices.length,'下装不能包含独立外挂板');
}
