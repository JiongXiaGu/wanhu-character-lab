import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeActor } from '../src/character/v3/rig';
import { createRecipe, B, type Cage, type Vec3 } from '../src/character/v3/types';
import { cloneCage } from '../src/character/v3/cage';
import { retargetMixamo } from '../src/character/mixamo/retarget';

// 隔离诊断，不改源码/配方/原FBX，不作为验收通过。沿用正式检测的几何谓词和容差。
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
type Tri=[Vec3,Vec3,Vec3];
function pierces(a:Vec3,b:Vec3,p:Tri){const e1=sub(p[1],p[0]),e2=sub(p[2],p[0]),d=sub(b,a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-11)return false;const s=sub(a,p[0]),inv=1/det,u=inv*dot(s,h);if(u<=1e-6||u>=1-1e-6)return false;const q=cross(s,e1),v=inv*dot(d,q),t=inv*dot(e2,q);return v>1e-6&&u+v<1-1e-6&&t>1e-6&&t<1-1e-6;}
function skin(c:Cage,m:Float32Array):Vec3[]{return c.vertices.map(v=>{const p:Vec3=[0,0,0];for(const [bone,w]of [[v.w[0],v.w[2]],[v.w[1],1-v.w[2]]]){const k=bone*16;for(let a=0;a<3;a++)p[a]+=w*(m[k+a]*v.p[0]+m[k+4+a]*v.p[1]+m[k+8+a]*v.p[2]+m[k+12+a]);}return p;});}
const clips=['pilot-switches','shooting-arrow','jogging','snatch','start-walking'];
for(const bodyType of ['male','female'] as const){
 const reference=makeCharacter(createRecipe({bodyType,slots:{top:'rough_tunic',bottom:'body'}}));
 const actor=makeActor(reference);
 const poses:{clip:string,time:number,m:Float32Array}[]=[];
 for(const id of clips){
  const source=JSON.parse(readFileSync(`public/mixamo/${id}.json`,'utf8')),bake=retargetMixamo(reference,source);
  actor.resetBindPose();const action=actor.mixer.clipAction(bake.clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;
  const times=[...new Set<number>([0,source.duration,...source.times,...source.times.slice(1).map((t:number,i:number)=>(t+source.times[i])/2)])].sort((a,b)=>a-b);
  let angle=0;
  for(const time of times){action.time=time;actor.update(0);actor.mesh.skeleton.update();poses.push({clip:id,time,m:actor.mesh.skeleton.boneMatrices.slice()});angle=Math.max(angle,...[B.RightShin,B.LeftShin].map(b=>2*Math.acos(Math.min(1,Math.abs(actor.bones[b].quaternion.w)))*180/Math.PI));}
  console.log('ACTUAL_KNEE_ROTATION',JSON.stringify({bodyType,clip:id,maximumDegrees:angle,samples:times.length}));
  action.stop();actor.mixer.uncacheClip(bake.clip);
 }
 actor.dispose();
 for(const bottom of ['body','loose_trousers'] as const){
  const data=makeCharacter(createRecipe({bodyType,slots:{top:'rough_tunic',bottom}}));assert.deepEqual(data.joints,reference.joints);
  for(const variant of ['current','old-bare-crotch','rear-only-058','field-4','field-6']){
   if(variant==='old-bare-crotch'&&bottom!=='body')continue;
   const c=cloneCage(data.surface);
   if(variant==='old-bare-crotch')c.vertices.find(v=>v.id==='Crotch')!.w=[B.Hips,B.Hips,1];
   if(variant==='rear-only-058'||variant.startsWith('field-'))for(const side of ['Right','Left']){
    const thigh=side==='Right'?B.RightThigh:B.LeftThigh,shin=side==='Right'?B.RightShin:B.LeftShin,pivot=data.joints[shin].p;
    for(const v of c.vertices){
     if(!v.id.startsWith(bottom==='body'?side:`Pants.${side}.`))continue;
     const upper=v.id.includes('KneeUpper.'),lower=v.id.includes('KneeLower.'),middle=v.id.includes('Knee.'),calf=v.id.includes('Calf.');
     if(!(upper||lower||middle||calf))continue;
     const y=v.p[1]-pivot[1],z=v.p[2]-pivot[2];
     if(variant==='rear-only-058'){
      if(z<0&&(upper||lower))v.w=[thigh,shin,upper?.58:.42];
     }else{
      const scale=bodyType==='male'?1:1.66/1.76;
      const halfBand=.04545454545454545*scale+Number(variant.slice(6))*Math.max(0,-z);
      const w=Math.max(0,Math.min(1,.5+y/(2*halfBand)));
      v.w=[thigh,shin,w];
     }
    }
   }
   const indices:number[][]=[];
   for(const f of c.faces)if(['pelvis','thigh','shin'].includes(f.region))for(let i=1;i<f.v.length-1;i++)indices.push([f.v[0],f.v[i],f.v[i+1]]);
   const summary:Record<string,{frames:number,kneeFrames:number,hipFrames:number,maxPairs:number,first?:unknown}>={};
   for(const {clip,time,m}of poses){
    const row=summary[clip]??(summary[clip]={frames:0,kneeFrames:0,hipFrames:0,maxPairs:0});
    const points=skin(c,m),tri=indices.map(ix=>{const p=ix.map(i=>points[i])as Tri;return {p,lo:[0,1,2].map(a=>Math.min(...p.map(v=>v[a]))),hi:[0,1,2].map(a=>Math.max(...p.map(v=>v[a])))};});
    const order=tri.map((_,i)=>i).sort((a,b)=>tri[a].lo[0]-tri[b].lo[0]);let pairs=0,knee=false,hip=false;
    for(let ai=0;ai<order.length;ai++){const a=order[ai],x=tri[a];for(let bi=ai+1;bi<order.length;bi++){const b=order[bi],q=tri[b];if(q.lo[0]>x.hi[0])break;
      if(x.hi[1]<q.lo[1]||q.hi[1]<x.lo[1]||x.hi[2]<q.lo[2]||q.hi[2]<x.lo[2]||indices[a].some(i=>indices[b].includes(i)))continue;
      if(![0,1,2].some(t=>pierces(x.p[t],x.p[(t+1)%3],q.p)||pierces(q.p[t],q.p[(t+1)%3],x.p)))continue;
      pairs++;const ids=[...indices[a],...indices[b]].map(i=>c.vertices[i].id);
      if(ids.some(id=>id.includes('Knee')||id.includes('Calf')))knee=true;else hip=true;
      row.first??={time,vertices:ids};
    }}
    row.frames+=Number(pairs>0);row.kneeFrames+=Number(knee);row.hipFrames+=Number(hip);row.maxPairs=Math.max(row.maxPairs,pairs);
   }
   console.log('ISOLATED_FIELD_RESULT',JSON.stringify({bodyType,bottom,variant,summary}));
  }
 }
}
console.log('DIAGNOSIS_ONLY: source geometry unchanged; numerical alternatives are not visual acceptance.');
