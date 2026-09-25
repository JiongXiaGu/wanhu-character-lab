import assert from 'node:assert/strict';
import { B, type Cage } from '../src/character/v3/types';
import { triCount } from '../src/character/v3/cage';
import type { GarmentPiece } from '../src/character/wardrobe/assets/contract';
import { assertGarmentPiece } from './check-garment-assets';

/** 独立边军版型约束。宫卫断言保持原样，不用共享参数把两套轮廓锁成相同。 */
export function assertFrontierSkirt(piece:GarmentPiece):void {
  assertGarmentPiece(piece);
  const c=piece.mesh;
  assert.equal(piece.id,'frontier_armor_skirt');
  assert.equal(triCount(c),308);assert.equal(c.vertices.length,156);
  assert.deepEqual(piece.covers,['pelvis','thigh','shin']);
  assert(c.vertices.every(v=>v.id.startsWith('FrontierSkirt.')||v.id.startsWith('FrontierLiner.')),'不能拼接旧短裤、居民裙或独立挂板');
  assert.equal(c.vertices.filter(v=>v.id.startsWith('FrontierSkirt.')).length,60);
  assert.equal(c.vertices.filter(v=>v.id.startsWith('FrontierLiner.')).length,96);
  assert.equal(piece.sealedInterfaces!.waist.length,10);
  for(const side of ['Left','Right'])assert.equal(piece.sealedInterfaces![side+'Cuff'].length,8);
  const lookup=new Map(c.vertices.map((v,i)=>[v.id,{v,i}]));
  const get=(id:string)=>{const result=lookup.get(id);assert(result,`缺少边军制作点 ${id}`);return result;};
  const ring=(row:number)=>Array.from({length:10},(_,k)=>get(`FrontierSkirt.${row}.${k}`));
  for(let row=0;row<6;row++){
    const loop=ring(row);
    for(const {v} of loop)assert.deepEqual(v.w,row===0?[B.Hips,B.Hips,1]:[B.Hips,v.p[0]>0?B.RightThigh:B.LeftThigh,[1,.60,.45,.35,.29,.28][row]]);
    for(const [a,b] of [[0,9],[4,5]])assert(c.faces.some(f=>f.v.includes(loop[a].i)&&f.v.includes(loop[b].i)),'前后甲裙必须跨中线');
  }
  const waist=ring(0),hem=ring(5);
  assert(waist.every(x=>x.v.p[1]>1.06&&x.v.p[1]<1.09),'甲裙必须从腰起');
  assert(hem.every(x=>x.v.p[1]>.67&&x.v.p[1]<.75),'长甲裙应在大腿中下段，不能缩回宫卫长度');
  assert(hem[2].v.p[0]>waist[2].v.p[0]+.08,'长裙身需要外展');
  assert(hem[0].v.p[2]>.17,'前摆底部必须保留外展留量');
  for(const side of ['Right','Left'])for(const k of [0,4,5,6,7]){
    const {v}=get(`FrontierLiner.${side}.Entry.${k}`),end=k===0||k===4;
    assert.equal(v.p[1],end?.835:k===6?.850:.865);
    assert.deepEqual(v.w,[B.Hips,side==='Right'?B.RightThigh:B.LeftThigh,end?.40:k===6?.35:.50]);
  }
  // 正面回收面的实际三角对角线是版型的一部分，不能让扭曲四边形自动换线。
  const front=c.faces.find(f=>f.v.includes(get('FrontierLiner.Left.Entry.4').i)&&f.v.includes(get('FrontierSkirt.5.0').i))!;
  assert(front&&front.v.length===4);
  assert.deepEqual([c.vertices[front.v[0]].id,c.vertices[front.v[2]].id].sort(),['FrontierLiner.Right.Entry.0','FrontierSkirt.5.9'].sort());
  const neighbors=Array.from({length:c.vertices.length},()=>new Set<number>());
  for(const f of c.faces)for(let k=0;k<f.v.length;k++){const a=f.v[k],b=f.v[(k+1)%f.v.length];neighbors[a].add(b);neighbors[b].add(a);}
  const seen=new Set<number>(),todo=[0];while(todo.length){const n=todo.pop()!;if(seen.has(n))continue;seen.add(n);todo.push(...neighbors[n]);}
  assert.equal(seen.size,c.vertices.length,'裙身、裆口和裤管必须为一个连通壳');
}

function range(c:Cage,prefix:string,axis:0|1|2){
  const values=c.vertices.filter(v=>v.id.startsWith(prefix)).map(v=>v.p[axis]);assert(values.length>0,`缺少轮廓 ${prefix}`);
  return{min:Math.min(...values),max:Math.max(...values),span:Math.max(...values)-Math.min(...values)};
}
/** 从实际已装配坐标测量，不看颜色、作者常量或展示标签。男女分别比较。 */
export function assertFrontierSilhouette(palace:Cage,frontier:Cage){
  const palaceHelmet=range(palace,'PalaceHelmet.',1),frontierHelmet=range(frontier,'FrontierHelmet.',1);
  const palaceChest=range(palace,'Top.Chest.',2),frontierChest=range(frontier,'Top.Chest.',2);
  const palaceCollar=range(palace,'Top.Neck.',1),frontierCollar=range(frontier,'Top.Neck.',1);
  const palaceHem=range(palace,'PalaceSkirt.4.',1),frontierHem=range(frontier,'FrontierSkirt.5.',1);
  const palaceShoulder=range(palace,'Top.Shoulder.',0),frontierShoulder=range(frontier,'Top.Shoulder.',0);
  assert(frontierHelmet.max<palaceHelmet.max-.10,'边军盔不能恢复宫廷高缨');
  assert(frontierHelmet.min<palaceHelmet.min-.04,'边军护颈必须更长');
  assert(frontierChest.span>palaceChest.span+.025,'边军必须有更厚的胸甲而不是换色');
  assert(frontierCollar.max>palaceCollar.max+.025,'边军立领必须有结构差异');
  assert(frontierHem.min<palaceHem.min-.07&&frontierHem.max<palaceHem.max-.05,'边军前后甲裙都必须明显长于宫卫');
  assert(frontierShoulder.span<palaceShoulder.span-.02,'边军肩部须收敛，不能复制宫卫宽肩');
  return{palaceHelmet,frontierHelmet,palaceChest,frontierChest,palaceCollar,frontierCollar,palaceHem,frontierHem,palaceShoulder,frontierShoulder};
}
