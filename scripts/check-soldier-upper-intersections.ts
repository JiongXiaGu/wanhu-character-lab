import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as T from 'three';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeActor } from '../src/character/v3/rig';
import { createRecipe, type Vec3, type Cage } from '../src/character/v3/types';
import { applySoldierLook } from '../src/soldier/looks';
import { retargetMotion } from '../src/character/motion/retarget';

// 补充原下身完整矩阵：只检查实际装配后重甲上身的非相邻衣面自交，包含封口。
// 数学判定与原 tailoring 相同，不添加甲胄接触豁免、特殊容差或运行时碰撞。
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
type Triangle=[Vec3,Vec3,Vec3];
function pierces(a:Vec3,b:Vec3,p:Triangle){const e1=sub(p[1],p[0]),e2=sub(p[2],p[0]),d=sub(b,a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-11)return false;const s=sub(a,p[0]),inv=1/det,u=inv*dot(s,h);if(u<=1e-6||u>=1-1e-6)return false;const q=cross(s,e1),v=inv*dot(d,q),t=inv*dot(e2,q);return v>1e-6&&u+v<1-1e-6&&t>1e-6&&t<1-1e-6;}
assert(pierces([.2,.2,-1],[.2,.2,1],[[0,0,0],[1,0,0],[0,1,0]]));
function skin(c:Cage,m:Float32Array):Vec3[]{return c.vertices.map(v=>{const p:Vec3=[0,0,0];for(const[bone,w]of[[v.w[0],v.w[2]],[v.w[1],1-v.w[2]]]){const k=bone*16;for(let a=0;a<3;a++)p[a]+=w*(m[k+a]*v.p[0]+m[k+4+a]*v.p[1]+m[k+8+a]*v.p[2]+m[k+12+a]);}return p;});}
const ids=['bind','pilot-switches','shooting-arrow','jogging','snatch','start-walking'],rows:unknown[]=[],failures:unknown[]=[];
let checkedFrames=0,pairsChecked=0,blockingFrames=0;
for(const bodyType of ['male','female'] as const){
  const data=makeCharacter(applySoldierLook(createRecipe({bodyType}),'palace','soldier','heavy')),c=data.surface,actor=makeActor(data),indices:number[][]=[];
  for(const f of c.faces)if(f.part==='top')for(let i=1;i<f.v.length-1;i++)indices.push([f.v[0],f.v[i],f.v[i+1]]);
  assert.equal(indices.length,432,'必须检查当前完整上甲，不得丢失封口或护肩');
  const inverses=actor.skeleton.boneInverses.map(m=>m.toArray());
  for(const id of ids){
    actor.resetBindPose();
    const source=id==='bind'?null:JSON.parse(readFileSync(`public/mixamo/${id}.json`,'utf8'));
    const bake=source?retargetMotion(data,source):null;
    const action=bake?actor.mixer.clipAction(bake.clip):null;
    if(action){action.setLoop(T.LoopOnce,1).play();action.paused=true;action.clampWhenFinished=true;}
    const times=source?[...new Set<number>([0,source.duration,...source.times,...source.times.slice(1).map((t:number,i:number)=>(t+source.times[i])/2)])].sort((a,b)=>a-b):[0];
    let blocked=0,maxPairs=0;const start=failures.length;
    for(const time of times){
      if(action)action.time=time;actor.update(0);actor.skeleton.update();
      const points=skin(c,actor.skeleton.boneMatrices);assert(points.flat().every(Number.isFinite));
      const tris=indices.map(ix=>{const p=ix.map(i=>points[i])as Triangle;return{p,lo:[0,1,2].map(a=>Math.min(...p.map(v=>v[a]))),hi:[0,1,2].map(a=>Math.max(...p.map(v=>v[a])))};});
      const order=tris.map((_,i)=>i).sort((a,b)=>tris[a].lo[0]-tris[b].lo[0]);let n=0;
      for(let ai=0;ai<order.length;ai++){const a=order[ai],x=tris[a];for(let bi=ai+1;bi<order.length;bi++){
        const b=order[bi],y=tris[b];if(y.lo[0]>x.hi[0])break;
        if(x.hi[1]<y.lo[1]||y.hi[1]<x.lo[1]||x.hi[2]<y.lo[2]||y.hi[2]<x.lo[2]||indices[a].some(i=>indices[b].includes(i)))continue;
        pairsChecked++;if(![0,1,2].some(t=>pierces(x.p[t],x.p[(t+1)%3],y.p)||pierces(y.p[t],y.p[(t+1)%3],x.p)))continue;
        n++;if(failures.length<start+8)failures.push({bodyType,id,time,a:indices[a].map(i=>c.vertices[i].id),b:indices[b].map(i=>c.vertices[i].id)});
      }}
      checkedFrames++;if(n){blocked++;blockingFrames++;}maxPairs=Math.max(maxPairs,n);
    }
    const row={bodyType,id,samples:times.length,blockingFrames:blocked,maxPairs};rows.push(row);console.log('HEAVY_UPPER_ROW',JSON.stringify(row));
    if(blocked)console.error('HEAVY_UPPER_VERTICES',JSON.stringify(failures.slice(start)));
    action?.stop();if(bake)actor.mixer.uncacheClip(bake.clip);
  }
  assert.deepEqual(actor.skeleton.boneInverses.map(m=>m.toArray()),inverses);actor.dispose();
}
assert.equal(rows.length,12);
const report={sourceSHA:process.env.REVIEW_HEAD_SHA??'local',passed:blockingFrames===0,checkedFrames,pairsChecked,rows,failures,scope:'Heavy authored top self-intersections including interfaces; bind plus complete five-clips source keys and midpoints, both bodies. Original full lower-body matrix is separate and unchanged. No continuous-time, coplanar, hand-to-armor or weapon-contact claim.'};
mkdirSync('review/soldier-numeric',{recursive:true});writeFileSync('review/soldier-numeric/upper-intersections.json',JSON.stringify(report,null,2));
console.log('HEAVY_UPPER_SUMMARY',JSON.stringify({passed:report.passed,checkedFrames,blockingFrames}));
assert(report.passed,'重甲肩胸/腋下/护臂发生非相邻衣面自交，修正模型而不是放宽检查');
