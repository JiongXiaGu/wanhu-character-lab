import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import * as T from 'three';
import {makeCharacter} from '../src/character/v3/outfit';
import {makeActor} from '../src/character/v3/rig';
import {cleanRecipe,type Vec3,type Cage} from '../src/character/v3/types';
import {applyLook} from '../src/character/wardrobe/catalog';
import {retargetMixamo} from '../src/character/mixamo/retarget';
import {MIXAMO_CLIPS} from '../src/character/mixamo/catalog';
import type {WardrobeLod} from '../src/character/wardrobe/tailoring';
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
type Triangle=[Vec3,Vec3,Vec3];
function pierces(a:Vec3,b:Vec3,p:Triangle){const e1=sub(p[1],p[0]),e2=sub(p[2],p[0]),d=sub(b,a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-11)return false;const s=sub(a,p[0]),inv=1/det,u=inv*dot(s,h);if(u<=1e-6||u>=1-1e-6)return false;const q=cross(s,e1),v=inv*dot(d,q),t=inv*dot(e2,q);return v>1e-6&&u+v<1-1e-6&&t>1e-6&&t<1-1e-6;}
assert(pierces([.2,.2,-1],[.2,.2,1],[[0,0,0],[1,0,0],[0,1,0]]));assert(!pierces([2,2,-1],[2,2,1],[[0,0,0],[1,0,0],[0,1,0]]));
function skin(c:Cage,m:Float32Array):Vec3[]{return c.vertices.map(v=>{const p:Vec3=[0,0,0];for(const[bone,w]of[[v.w[0],v.w[2]],[v.w[1],1-v.w[2]]]){const k=bone*16;for(let a=0;a<3;a++)p[a]+=w*(m[k+a]*v.p[0]+m[k+4+a]*v.p[1]+m[k+8+a]*v.p[2]+m[k+12+a]);}return p;});}
const ids=['pilot-switches','shooting-arrow','jogging',...MIXAMO_CLIPS.filter(c=>['snatch','start-walking'].includes(c.id)).map(c=>c.id)],rows:any[]=[],failures:any[]=[];
let checkedFrames=0,pairsChecked=0;
for(const profile of [{height:1.76,build:.5},{height:1.58,build:0},{height:1.92,build:1}])for(const bodyType of ['male','female'] as const)for(const look of ['plain-female','town-female','ceremony-female'])for(const lod of [0,1,2] as WardrobeLod[]){
 const d=makeCharacter(applyLook(cleanRecipe({bodyType,...profile}),look),{lod}),c=d.surface,actor=makeActor(d),indices:number[][]=[];
 for(const f of c.faces)if(['pelvis','thigh','shin'].includes(f.region))for(let i=1;i<f.v.length-1;i++)indices.push([f.v[0],f.v[i],f.v[i+1]]);
 const pairs:number[][]=[];for(let a=0;a<indices.length;a++)for(let b=a+1;b<indices.length;b++)if(!indices[a].some(i=>indices[b].includes(i)))pairs.push([a,b]);
 actor.update(0);actor.mesh.skeleton.update();const bind=skin(c,actor.mesh.skeleton.boneMatrices);assert(Math.max(...bind.map((p,i)=>Math.hypot(...sub(p,c.vertices[i].p))))<1e-5,'独立蒙皮必须还原bind');
 for(const id of ids){const source=JSON.parse(readFileSync(`public/mixamo/${id}.json`,'utf8')),bake=retargetMixamo(d,source);actor.resetBindPose();const action=actor.mixer.clipAction(bake.clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;let piercedFrames=0,maxPairs=0;
  // 全部源采样键 + 相邻键中点，检查播放插值而非只挑选少量定格。
  const times=[...new Set([0,source.duration,...source.times,...source.times.slice(1).map((t:number,i:number)=>(t+source.times[i])/2)])].sort((a:any,b:any)=>a-b) as number[];
  for(const time of times){action.time=time;actor.update(0);actor.mesh.skeleton.update();const points=skin(c,actor.mesh.skeleton.boneMatrices),tris=indices.map(ix=>{const p=ix.map(i=>points[i])as Triangle;return{p,lo:[0,1,2].map(a=>Math.min(...p.map(v=>v[a]))),hi:[0,1,2].map(a=>Math.max(...p.map(v=>v[a])))};});checkedFrames++;let n=0;
   for(const[a,b]of pairs){const x=tris[a],y=tris[b];if([0,1,2].some(t=>x.hi[t]<y.lo[t]||y.hi[t]<x.lo[t]))continue;pairsChecked++;if(![0,1,2].some(t=>pierces(x.p[t],x.p[(t+1)%3],y.p)||pierces(y.p[t],y.p[(t+1)%3],x.p)))continue;n++;if(failures.length<60)failures.push({bodyType,look,lod,id,...profile,time,phase:time/source.duration,a:indices[a].map(i=>c.vertices[i].id),b:indices[b].map(i=>c.vertices[i].id)});}
   if(n)piercedFrames++;maxPairs=Math.max(maxPairs,n);
  }
  rows.push({bodyType,...profile,look,lod,id,samples:times.length,piercedFrames,maxPairs});action.stop();actor.mixer.uncacheClip(bake.clip);
 }
 actor.dispose();console.log('INTERSECTION',bodyType,profile.height,profile.build,look,lod);
}
const passed=rows.every(r=>r.piercedFrames===0);mkdirSync('review-tailoring-v2',{recursive:true});writeFileSync('review-tailoring-v2/intersections.json',JSON.stringify({testedSha:process.env.REVIEW_HEAD_SHA??'local',sampling:'all source keys plus interval midpoints; 3 body proportion profiles',checkedFrames,pairsChecked,rows,failures,passed,scope:'离线腰髋/腿部衣面非共面贯穿；排除共享顶点的邻接三角。不涵盖全部共面接触、手臂/道具、任意体型或连续时间碰撞；仍需实际审图。'},null,2));assert(passed,'V2常用动作主衣面自交；查看intersections.json定位，不得以拓扑闭合代替此检查');
