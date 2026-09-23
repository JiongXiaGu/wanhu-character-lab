import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Matrix4, Vector3 } from 'three';
import { DUCK_DEFINITION as definition } from '../src/duck/definition';
import { DUCK_BONES as B, DUCK_WATERLINE } from '../src/duck/rig';
import { authorDuckPose } from '../src/duck/animation';
import { LIVESTOCK } from '../src/livestock/catalog';
import { createAnimalActor } from '../src/livestock/actor';
import { createPoseCache, POSE_FPS } from '../src/livestock/pose-cache';
import { createCrowd, previewDuration } from '../src/livestock/crowd';
import { habitatDefinition, resolveHabitat, surfaceOffset } from '../src/livestock/habitat';
import type { AnimalMeshData, LivestockLodId } from '../src/livestock/types';

const area = (a: Vector3, b: Vector3, c: Vector3) => b.clone().sub(a).cross(c.clone().sub(a)).length();
function topology(data: AnimalMeshData, lod: LivestockLodId) {
  const main = data.parts.find(p => p.name === 'BodyNeckHeadBill'); assert(main);
  const edges = new Map<string, [number,number]>(), links = new Map<number, Set<number>>();
  let mainFaces = 0, volume = 0;
  for (let i=0;i<data.indices.length;i+=3) {
    const ids = data.indices.slice(i,i+3), [a,b,c] = ids.map(j => new Vector3(...data.positions[j]));
    assert(area(a,b,c)>1e-10, `${lod}退化面`); volume += a.dot(b.clone().cross(c))/6;
    if (ids.every(j => j < main.count)) mainFaces++;
    for(let k=0;k<3;k++) {
      const x=ids[k], y=ids[(k+1)%3], key=`${Math.min(x,y)}/${Math.max(x,y)}`, count=edges.get(key)??[0,0];
      count[0]++; count[1]+=x<y?1:-1; edges.set(key,count);
      if(x<main.count && y<main.count) { if(!links.has(x)) links.set(x,new Set()); links.get(x)!.add(y); }
    }
  }
  assert([...edges.values()].every(([n,s])=>n===2 && s===0), `${lod}开放边/绕序错误`); assert(volume>0);
  const visited=new Set<number>(), stack=[0];
  while(stack.length) { const i=stack.pop()!; if(visited.has(i)) continue; visited.add(i); stack.push(...(links.get(i)??[])); }
  assert.equal(visited.size,main.count, '鸭头颈不能是独立悬空壳');
  assert.equal(mainFaces, 2*main.count-4);
  for(let i=0;i<main.count;i++) {
    const p=data.positions[i]; assert(data.positions.slice(0,main.count).some((q,j)=>data.bones[j]===data.bones[i]&&Math.abs(p[0]+q[0])+Math.abs(p[1]-q[1])+Math.abs(p[2]-q[2])<1e-8),'主壳必须左右对称');
  }
  const bill=data.positions.filter(p=>p[2]>.36), width=Math.max(...bill.map(p=>p[0]))-Math.min(...bill.map(p=>p[0])), height=Math.max(...bill.map(p=>p[1]))-Math.min(...bill.map(p=>p[1]));
  assert(width>height*3 && width>.08, '所有LOD必须保留宽扁喙');
  if(lod!=='lod0') assert(!data.parts.some(p=>/Eye|Wing|Wattle|Comb/.test(p.name)), '低档不保留无效附件');
  return main;
}
const reports=[];
for(const lod of definition.lods) {
  const actor=createAnimalActor(definition,lod.id), data=actor.data, main=topology(data,lod.id);
  assert.equal(data.indices.length/3,lod.triangles); assert.equal(data.positions.length,lod.logicalVertices);
  assert.equal(actor.bones.length,8); assert.equal(actor.geometry.groups.length,0);
  const weights=actor.geometry.getAttribute('skinWeight');
  for(let i=0;i<weights.count;i++) { assert.equal(weights.getX(i),1); assert.equal(weights.getY(i)+weights.getZ(i)+weights.getW(i),0); }
  actor.bind(); const source=actor.geometry.getAttribute('position');
  for(let i=0;i<source.count;i++) { const p=new Vector3().fromBufferAttribute(source,i); assert(actor.mesh.applyBoneTransform(i,p.clone()).distanceTo(p)<1e-6); }
  const sample=(motion:string, phase:number)=> { actor.sample(motion,phase); return Array.from({length:source.count},(_,i)=>actor.mesh.applyBoneTransform(i,new Vector3().fromBufferAttribute(source,i))); };
  const feet=data.indices.map((j,i)=>data.positions[j][1]<.007?i:-1).filter(i=>i>=0);
  const beaks=data.indices.map((j,i)=>data.positions[j][2]>.36?i:-1).filter(i=>i>=0);
  const mainTriangles=data.indices.map((_,i)=>i%3===0 && data.indices.slice(i,i+3).every(j=>j<main.count)?i:-1).filter(i=>i>=0);
  const bindAreas=mainTriangles.map(i=>area(...data.indices.slice(i,i+3).map(j=>new Vector3(...data.positions[j])) as [Vector3,Vector3,Vector3]));
  let poses=0, minFoot=Infinity, landBill=Infinity, waterBill=Infinity, minRatio=Infinity;
  for(const motion of definition.motions) {
    const first=sample(motion.id,0), last=sample(motion.id,1); first.forEach((p,i)=>assert(p.distanceTo(last[i])<1e-5, `${motion.id}循环接缝`));
    for(let f=0;f<=240;f++) {
      const vertices=sample(motion.id,f/240); poses++;
      vertices.forEach(p=>assert(p.toArray().every(n=>Number.isFinite(n)&&Math.abs(n)<.8)));
      if(motion.surface==='land') {
        vertices.forEach(p=>assert(p.y>=-.002,`${motion.id}穿地`));
        feet.forEach(i=>{minFoot=Math.min(minFoot,vertices[i].y); assert(vertices[i].y>=-.001);});
      } else {
        // 水面没有地板门槛：蹼足必须在吃水线下，而非被折进躯干或画到水面上。
        feet.forEach(i=>assert(vertices[i].y < DUCK_WATERLINE-.02));
        assert(Math.max(...vertices.map(p=>p.y))>DUCK_WATERLINE+.08,'不能沉没整鸭');
      }
      if(motion.id==='feed_land') landBill=Math.min(landBill,...beaks.map(i=>vertices[i].y));
      if(motion.id==='dabble') waterBill=Math.min(waterBill,...beaks.map(i=>vertices[i].y));
      mainTriangles.forEach((i,j)=>{ const ratio=area(vertices[i],vertices[i+1],vertices[i+2])/bindAreas[j]; minRatio=Math.min(minRatio,ratio); assert(ratio>.04,`${lod.id}/${motion.id}连续头颈面塌缩`); });
    }
  }
  assert(landBill>=.001 && landBill<=.035); assert(waterBill<DUCK_WATERLINE-.025 && waterBill>DUCK_WATERLINE-.14);
  const cache=createPoseCache(definition,lod.id);
  for(const motion of definition.motions) {
    const n=Math.ceil(motion.duration*POSE_FPS);
    for(const f of [0,Math.round(n*.5),n]) {
      const actual=sample(motion.id,f/n), cached=cache.get(motion.id,f/n).getAttribute('position');
      actual.forEach((p,i)=>assert(p.distanceTo(new Vector3().fromBufferAttribute(cached,i))<1e-6));
    }
  }
  // 真正的断颈/窄尖喙反例必须失败，而不是只看部件名字。
  assert.throws(()=>topology({...data,indices:data.indices.filter((_,i)=>new Set(data.indices.slice(Math.floor(i/3)*3,Math.floor(i/3)*3+3).map(j=>data.bones[j])).size===1)},lod.id));
  assert.throws(()=>topology({...data,positions:data.positions.map(p=>p[2]>.36?[p[0]*.1,p[1],p[2]] as const:p)},lod.id));
  reports.push({lod:lod.id,triangles:lod.triangles,logicalVertices:lod.logicalVertices,poses,minFoot,landBill,waterBill,minRatio,faultInjections:2});
  cache.dispose(); cache.dispose(); actor.dispose(); actor.dispose();
}
for(const motion of ['walk','run']) assert(authorDuckPose(motion,.55).rotations[B.LegL][0]>authorDuckPose(motion,.05).rotations[B.LegL][0]);
assert(definition.motions.find(m=>m.id==='run')!.duration<definition.motions.find(m=>m.id==='walk')!.duration);
assert.throws(()=>authorDuckPose('chicken-peck',0));
assert.deepEqual(resolveHabitat(LIVESTOCK[0],'water','swim'),{surface:'land',motion:'idle'});
assert.deepEqual(resolveHabitat(definition,'water','run'),{surface:'water',motion:'idle_water'});
assert.deepEqual(resolveHabitat(definition,undefined,'swim'),{surface:'water',motion:'swim'});
const actor=createAnimalActor(definition), crowd=createCrowd(definition,actor.material), matrix=new Matrix4();
for(const profile of definition.habitats) {
  assert.equal(previewDuration(definition,{count:100,mixed:true,motion:profile.defaultMotion,surface:profile.id}),profile.duration);
  for(const item of profile.mixed) assert.equal((definition.motions.find(m=>m.id===item.motion)?.surface),profile.id);
  for(const scale of [.94,1,1.06]) assert(Math.abs(DUCK_WATERLINE*scale+surfaceOffset(habitatDefinition(definition,'water'),scale)-DUCK_WATERLINE)<1e-8);
  for(const lod of definition.lods) for(const count of [1,10,50,100,500]) {
    crowd.setLayout(count,731);
    for(const mixed of [false,true]) for(const motion of definition.motions.filter(m=>m.surface===profile.id)) {
      crowd.update(.37,{motion:motion.id,mixed,loop:true,surface:profile.id},lod.id);
      assert.equal(crowd.group.children.reduce((sum,m:any)=>sum+m.count,0),count); assert(crowd.batchCount<=32);
    }
    const transforms=(time:number)=>{crowd.update(time,{motion:profile.defaultMotion,mixed:true,loop:true,surface:profile.id},lod.id);return crowd.group.children.flatMap((mesh:any)=>Array.from({length:mesh.count},(_,i)=>{mesh.getMatrixAt(i,matrix);return [...matrix.elements]})).flat();};
    const first=transforms(0),last=transforms(profile.duration); first.forEach((v,i)=>assert(Math.abs(v-last[i])<1e-6,'混合移动周期不连续'));
  }
}
const warmed=crowd.cachedPoses;
for(let i=0;i<30;i++) crowd.update(i/30,{motion:'swim',mixed:true,loop:true,surface:'water'},'lod2');
assert.equal(crowd.cachedPoses,warmed); crowd.dispose(); crowd.dispose(); actor.dispose();
const result={result:'passed',sourceSHA:process.env.REVIEW_HEAD_SHA??'local',species:definition.id,bones:8,reports,totalPoses:reports.reduce((sum,r)=>sum+r.poses,0),cachedPoses:warmed};
const dir=process.env.LIVESTOCK_CHECK_DIR??'/tmp/wanhu-livestock-checks';mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/duck-numeric.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
