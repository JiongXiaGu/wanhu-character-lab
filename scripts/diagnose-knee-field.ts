import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeBody, shapePoint } from '../src/character/v3/body';
import { makeSkinPelvis } from '../src/character/v3/skin-pelvis';
import { makeActor } from '../src/character/v3/rig';
import { createRecipe, B, type Cage, type Vec3 } from '../src/character/v3/types';
import { cloneCage, bridge, orient, triCount } from '../src/character/v3/cage';
import { retargetMixamo } from '../src/character/mixamo/retarget';

// 只读隔离诊断，不写源码或刷新黄金文件；正式验收仍使用原检测器。
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
type Tri=[Vec3,Vec3,Vec3];
function pierces(a:Vec3,b:Vec3,p:Tri){const e1=sub(p[1],p[0]),e2=sub(p[2],p[0]),d=sub(b,a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-11)return false;const s=sub(a,p[0]),inv=1/det,u=inv*dot(s,h);if(u<=1e-6||u>=1-1e-6)return false;const q=cross(s,e1),v=inv*dot(d,q),t=inv*dot(e2,q);return v>1e-6&&u+v<1-1e-6&&t>1e-6&&t<1-1e-6;}
function skin(c:Cage,m:Float32Array):Vec3[]{return c.vertices.map(v=>{const p:Vec3=[0,0,0];for(const [bone,w]of [[v.w[0],v.w[2]],[v.w[1],1-v.w[2]]]){const k=bone*16;for(let a=0;a<3;a++)p[a]+=w*(m[k+a]*v.p[0]+m[k+4+a]*v.p[1]+m[k+8+a]*v.p[2]+m[k+12+a]);}return p;});}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const lexical=(a:string,b:string)=>a<b?-1:a>b?1:0;
const retired=(id:string)=>id==='Crotch'||id.startsWith('Hip.')||id.startsWith('SkinPelvis.');
function protectedSignatures(c:Cage){
 const positions=c.vertices.filter(v=>!retired(v.id)).map(v=>({id:v.id,p:v.p})).sort((a,b)=>lexical(a.id,b.id));
 const weights=c.vertices.filter(v=>!retired(v.id)&&!/(?:Knee|Calf|Thigh)/.test(v.id)).map(v=>({id:v.id,w:v.w})).sort((a,b)=>lexical(a.id,b.id));
 const faces=c.faces.filter(f=>f.v.every(i=>!retired(c.vertices[i].id))).map(f=>{const ids=f.v.map(i=>c.vertices[i].id);let start=0;for(let i=1;i<ids.length;i++)if(lexical(ids[i],ids[start])<0)start=i;return{region:f.region,v:[...ids.slice(start),...ids.slice(0,start)]};}).sort((a,b)=>lexical(JSON.stringify(a),JSON.stringify(b)));
 const anchors=Object.entries(c.anchors).filter(([name])=>name!=='Hip'&&!name.endsWith('LegRoot')).map(([name,ids])=>({name,ids:ids.map(i=>c.vertices[i].id)})).sort((a,b)=>lexical(a.name,b.name));
 return{positions:hash(positions),weights:hash(weights),faces:hash(faces),anchors:hash(anchors),positionCount:positions.length,weightCount:weights.length,faceCount:faces.length,anchorCount:anchors.length};
}
const clips=['pilot-switches','shooting-arrow','jogging','snatch','start-walking'];
for(const bodyType of ['male','female'] as const){
 const recipe=createRecipe({bodyType,slots:{top:'rough_tunic',bottom:'body'}}),reference=makeCharacter(recipe);
 console.log('PROTECTED_SKIN_REFERENCE',JSON.stringify({bodyType,source:'1b19cf094b5c06b0f637e5c1f43491f96bae6f25; previous check-body-profiles proved all non-Crotch data equals original f432357',...protectedSignatures(reference.body),jointsHash:hash(reference.joints)}));
 const actor=makeActor(reference),poses:{clip:string,time:number,m:Float32Array}[]=[];
 for(const id of clips){
  const source=JSON.parse(readFileSync(`public/mixamo/${id}.json`,'utf8')),bake=retargetMixamo(reference,source);
  actor.resetBindPose();const action=actor.mixer.clipAction(bake.clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;
  const times=[...new Set<number>([0,source.duration,...source.times,...source.times.slice(1).map((t:number,i:number)=>(t+source.times[i])/2)])].sort((a,b)=>a-b);
  for(const time of times){action.time=time;actor.update(0);actor.mesh.skeleton.update();poses.push({clip:id,time,m:actor.mesh.skeleton.boneMatrices.slice()});}
  action.stop();actor.mixer.uncacheClip(bake.clip);
 }
 actor.dispose();
 for(const variant of ['point-field4','saddle6-field4','saddle6-gradual-field4']){
  const c=makeBody();
  if(variant.startsWith('saddle6')){
   c.faces=c.faces.filter(f=>f.v.every(i=>!retired(c.vertices[i].id)));
   const roots=makeSkinPelvis(c,c.anchors.Waist);
   for(const [side,root]of [['Right',roots[0]],['Left',roots[1]]] as const){
    bridge(c,root,c.anchors[side+'Thigh'],'thigh');c.anchors[side+'LegRoot']=root;
    if(variant.includes('gradual'))for(const i of c.anchors[side+'Thigh'])c.vertices[i].w=[B.Hips,side==='Right'?B.RightThigh:B.LeftThigh,.28];
   }
   delete c.anchors.Hip;
   orient(c);
  }
  for(const v of c.vertices)if(/^(?:Right|Left)(?:Knee|Calf)/.test(v.id)){
   const right=v.id.startsWith('Right'),thigh=right?B.RightThigh:B.LeftThigh,shin=right?B.RightShin:B.LeftShin;
   const halfBand=.04545454545454545+4*Math.max(0,-v.p[2]);
   v.w=[thigh,shin,Math.max(0,Math.min(1,.5+(v.p[1]-.489)/(2*halfBand)))];
  }
  for(const v of c.vertices)v.p=shapePoint(v.p,recipe);
  const sig=protectedSignatures(c);assert.deepEqual(sig,protectedSignatures(reference.body),'诊断必须保持已声明修改范围之外的数据');
  const indices:number[][]=[];for(const f of c.faces)if(['pelvis','thigh','shin'].includes(f.region))for(let i=1;i<f.v.length-1;i++)indices.push([f.v[0],f.v[i],f.v[i+1]]);
  const summary:Record<string,{frames:number,maxPairs:number,first?:unknown}>={};
  for(const {clip,time,m}of poses){
   const row=summary[clip]??(summary[clip]={frames:0,maxPairs:0}),points=skin(c,m);
   const tris=indices.map(ix=>{const p=ix.map(i=>points[i])as Tri;return{p,lo:[0,1,2].map(a=>Math.min(...p.map(v=>v[a]))),hi:[0,1,2].map(a=>Math.max(...p.map(v=>v[a])))};});
   const order=tris.map((_,i)=>i).sort((a,b)=>tris[a].lo[0]-tris[b].lo[0]);let pairs=0;
   for(let ai=0;ai<order.length;ai++){const a=order[ai],x=tris[a];for(let bi=ai+1;bi<order.length;bi++){const b=order[bi],q=tris[b];if(q.lo[0]>x.hi[0])break;
    if(x.hi[1]<q.lo[1]||q.hi[1]<x.lo[1]||x.hi[2]<q.lo[2]||q.hi[2]<x.lo[2]||indices[a].some(i=>indices[b].includes(i)))continue;
    if(![0,1,2].some(t=>pierces(x.p[t],x.p[(t+1)%3],q.p)||pierces(q.p[t],q.p[(t+1)%3],x.p)))continue;
    pairs++;row.first??={time,a:indices[a].map(i=>c.vertices[i].id),b:indices[b].map(i=>c.vertices[i].id)};
   }}
   row.frames+=Number(pairs>0);row.maxPairs=Math.max(row.maxPairs,pairs);
  }
  console.log('ISOLATED_SADDLE_RESULT',JSON.stringify({bodyType,variant,triangles:triCount(c),summary}));
 }
}
console.log('DIAGNOSIS_ONLY: no runtime constructor changed; candidate topology still requires full tests and images.');
