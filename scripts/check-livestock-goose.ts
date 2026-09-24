import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { FrontSide, Vector3 } from 'three';
import { GOOSE_DEFINITION as definition } from '../src/goose/definition';
import { GOOSE_BONES as B, GOOSE_WATERLINE, GOOSE_JOINTS } from '../src/goose/rig';
import { authorGoosePose } from '../src/goose/animation';
import { createAnimalActor } from '../src/livestock/actor';
import { createPoseCache } from '../src/livestock/pose-cache';
import { createCrowd, makePlacements, PHASE_COHORTS } from '../src/livestock/crowd';
import { resolveHabitat, surfaceOffset } from '../src/livestock/habitat';
import { livestockDefinition } from '../src/livestock/catalog';
import { CROWD_COUNTS } from '../src/livestock/types';
import type { AnimalMeshData, LivestockLodDefinition } from '../src/livestock/types';

/** 以鹅自己的7骨语义检查，不把鸡鸭6/7号兼容翼骨规则套给鹅。 */
function validate(data: AnimalMeshData, lod: LivestockLodDefinition) {
  assert.equal(data.indices.length, lod.triangles*3); assert.equal(data.positions.length,lod.logicalVertices);
  assert.equal(data.positions.length,data.bones.length); assert.equal(data.positions.length,data.colors.length);
  assert(data.positions.every(p=>p.every(Number.isFinite)));
  assert(data.bones.every(b=>Number.isInteger(b)&&b>=0&&b<7));
  assert(data.bones.includes(B.NeckBase)&&data.bones.includes(B.NeckTip),`${lod.id}不能删去任一颈段`);
  assert(!data.parts.some(p=>/wing/i.test(p.name)));
  assert.deepEqual(data.parts.map(p=>p.name).sort(),(lod.id==='lod0'?['BodyNeckHeadBill','EyeL','EyeR','LegL','LegR']:['BodyNeckHeadBill','LegL','LegR']).sort());
  const edgeCounts=new Map<string,number>(), directed=new Map<string,number>(), neighbors=data.positions.map(()=>new Set<number>());
  for(let i=0;i<data.indices.length;i+=3) {
    const ids=data.indices.slice(i,i+3); assert(ids.every(v=>Number.isInteger(v)&&v>=0&&v<data.positions.length));
    const [a,b,c]=ids.map(i=>new Vector3(...data.positions[i]));
    assert(b.sub(a).cross(c.sub(a)).lengthSq()>1e-12,`${lod.id}退化面`);
    for(let j=0;j<3;j++) {
      const a=ids[j],b=ids[(j+1)%3],key=`${Math.min(a,b)}/${Math.max(a,b)}`;
      edgeCounts.set(key,(edgeCounts.get(key)??0)+1);directed.set(key,(directed.get(key)??0)+(a<b?1:-1));
      neighbors[a].add(b);neighbors[b].add(a);
    }
  }
  assert([...edgeCounts.values()].every(n=>n===2),'全体壳闭合，不豁免任何片面');
  assert([...directed.values()].every(n=>n===0),'绕序一致');
  const body=data.parts[0], visited=new Set([0]), pending=[0];
  while(pending.length) for(const n of neighbors[pending.pop()!]) if(!visited.has(n)){visited.add(n);pending.push(n);}
  assert.equal(visited.size,body.count,'尾身颈头喙必须共享一张连通壳');
  let faces=0, volume=0;const edges=new Set<string>();
  for(let i=0;i<data.indices.length;i+=3) {
    const ids=data.indices.slice(i,i+3);if(!ids.every(n=>n<body.count))continue;faces++;
    const [a,b,c]=ids.map(i=>new Vector3(...data.positions[i]));volume+=a.dot(b.cross(c))/6;
    for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3];edges.add(`${Math.min(a,b)}/${Math.max(a,b)}`);}
  }
  assert.equal(body.count-edges.size+faces,2);assert(volume>0,'主壳朝外');
  const head=data.positions.filter((_,i)=>data.bones[i]===B.Head);
  assert(Math.max(...head.map(p=>p[1]))>.80,'远档必须保留长颈高度');
  assert(data.positions.filter((p,i)=>data.bones[i]===B.Head&&p[2]>.40).length>=3,'窄长喙不能消失');
}
assert.equal(livestockDefinition(definition.id),definition);
assert.deepEqual(GOOSE_JOINTS.map(j=>j.name),['Root','Body','NeckBase','NeckTip','Head','LegL','LegR']);
assert.equal(definition.motions.length,8);assert.equal(GOOSE_JOINTS[B.NeckTip].parent,B.NeckBase);
assert(!GOOSE_JOINTS.some(j=>/wing/i.test(j.name)));
const reports: object[]=[];
for(const lod of definition.lods) {
  const actor=createAnimalActor(definition,lod.id), data=actor.data; validate(data,lod);
  assert.equal(actor.material.side,FrontSide);assert.equal(actor.bones.length,7);assert.equal(actor.geometry.groups.length,0);
  const source=actor.geometry.getAttribute('position'),weights=actor.geometry.getAttribute('skinWeight');
  assert.equal(source.count,lod.triangles*3);
  for(let i=0;i<weights.count;i++){assert.equal(weights.getX(i),1);assert.equal(weights.getY(i)+weights.getZ(i)+weights.getW(i),0);}
  const sample=(motion:string,phase:number)=>{
    actor.sample(motion,phase);
    return Array.from({length:source.count},(_,i)=>actor.mesh.applyBoneTransform(i,new Vector3().fromBufferAttribute(source,i)));
  };
  actor.bind();
  for(let i=0;i<source.count;i++) {const p=new Vector3().fromBufferAttribute(source,i);assert(actor.mesh.applyBoneTransform(i,p.clone()).distanceTo(p)<1e-6,'真实inverse bind');}
  const soles=data.indices.map((id,i)=>data.bones[id]>=B.LegL&&data.positions[id][1]<.01?i:-1).filter(i=>i>=0);
  const bill=data.indices.map((id,i)=>data.bones[id]===B.Head&&data.positions[id][2]>.40?i:-1).filter(i=>i>=0);
  const neckFaces: {i:number;area:number}[]=[];
  for(let i=0;i<data.indices.length;i+=3)if(data.indices.slice(i,i+3).some(id=>data.bones[id]===B.NeckBase||data.bones[id]===B.NeckTip)) {
    const [a,b,c]=[i,i+1,i+2].map(v=>new Vector3().fromBufferAttribute(source,v));neckFaces.push({i,area:b.sub(a).cross(c.sub(a)).length()});
  }
  let poses=0,minFoot=Infinity,minGraze=Infinity,minWaterFeed=Infinity,minNeckRatio=Infinity,maxWaterFoot=-Infinity;
  for(const motion of definition.motions) {
    const first=sample(motion.id,0),last=sample(motion.id,1);
    first.forEach((p,i)=>assert(p.distanceTo(last[i])<1e-5,`${motion.id}首尾不闭合`));
    for(let f=0;f<=240;f++) {
      const points=sample(motion.id,f/240);poses++;
      for(const p of points){assert(p.toArray().every(Number.isFinite));assert(p.length()<1.5,'异常拉伸');if(motion.surface==='land')assert(p.y>=-.002,`${lod.id}/${motion.id}/${f}穿地：${p.y}`);}
      if(motion.surface==='land') {const y=Math.min(...soles.map(i=>points[i].y));minFoot=Math.min(minFoot,y);assert(y>=-.001);}
      else {const y=Math.max(...soles.map(i=>points[i].y));maxWaterFoot=Math.max(maxWaterFoot,y);assert(y<GOOSE_WATERLINE-.015,'蹼足不能露出水面');}
      if(motion.id==='graze')minGraze=Math.min(minGraze,...bill.map(i=>points[i].y));
      if(motion.id==='feed_water')minWaterFeed=Math.min(minWaterFeed,...bill.map(i=>points[i].y));
      for(const {i,area} of neckFaces) {
        const ratio=points[i+1].clone().sub(points[i]).cross(points[i+2].clone().sub(points[i])).length()/area;
        minNeckRatio=Math.min(minNeckRatio,ratio);assert(ratio>.12,`${lod.id}/${motion.id}/${f}颈部面塌缩`);
      }
    }
  }
  assert(minGraze>=.001&&minGraze<=.035,`吃草必须接近地面：${minGraze}`);
  assert(minWaterFeed>GOOSE_WATERLINE-.09&&minWaterFeed<GOOSE_WATERLINE-.01,`必须浅入水面：${minWaterFeed}`);
  for(const motion of ['walk','run'])assert(authorGoosePose(motion,.55).rotations[B.LegL][0]>authorGoosePose(motion,.05).rotations[B.LegL][0],'支撑腿向后扫');
  assert.throws(()=>actor.sample('unknown',0));
  const cache=createPoseCache(definition,lod.id), size=cache.size;
  for(const motion of definition.motions) {
    const actual=cache.get(motion.id,0).getAttribute('position'),expected=sample(motion.id,0);
    expected.forEach((p,i)=>assert(p.distanceTo(new Vector3().fromBufferAttribute(actual,i))<1e-6));
    cache.get(motion.id,.47);assert.equal(cache.get(motion.id,-1),cache.get(motion.id,0));
  }
  assert.equal(cache.size,size);cache.dispose();cache.dispose();
  const crowd=createCrowd(definition,actor.material);
  for(const count of CROWD_COUNTS)for(const profile of definition.habitats) {
    crowd.setLayout(count,731);assert.deepEqual(crowd.placements,makePlacements(count,731));
    for(const motion of definition.motions.filter(m=>m.surface===profile.id)) for(const mixed of [false,true]) {
      crowd.update(.37,{motion:motion.id,surface:profile.id,mixed,loop:true},lod.id);
      assert.equal(crowd.group.children.reduce((sum,m)=>sum+(m as any).count,0),count);
      assert(crowd.batchCount>0&&crowd.batchCount<=(mixed?profile.mixed.length:1)*PHASE_COHORTS);
    }
  }
  const cached=crowd.cachedPoses;
  for(let i=0;i<30;i++)crowd.update(i/30,{motion:'swim',surface:'water',mixed:true,loop:true},lod.id);
  assert.equal(crowd.cachedPoses,cached);crowd.dispose();crowd.dispose();actor.dispose();actor.dispose();
  const broken=()=>structuredClone(data);
  let d=broken();d.bones=d.bones.map(b=>b===B.NeckTip?B.Body:b);assert.throws(()=>validate(d,lod));
  d=broken();d.parts.push({name:'WingL',start:0,count:1});assert.throws(()=>validate(d,lod));
  d=broken();[d.indices[0],d.indices[1]]=[d.indices[1],d.indices[0]];assert.throws(()=>validate(d,lod));
  d=broken();d.positions[d.indices[1]]=[...d.positions[d.indices[0]]];assert.throws(()=>validate(d,lod));
  reports.push({lod:lod.id,triangles:lod.triangles,logicalVertices:lod.logicalVertices,poses,minFoot,minGraze,minWaterFeed,minNeckRatio,maxWaterFoot,cachedPoses:cached,faultInjections:4});
}
for(const profile of definition.habitats)for(const item of profile.mixed) {
  const motion=definition.motions.find(m=>m.id===item.motion)!;assert.equal(motion.surface,profile.id);
  assert(Math.abs(profile.duration/motion.duration-Math.round(profile.duration/motion.duration))<1e-8,'混合观察周期首尾对齐');
  assert(!['run','threat'].includes(item.motion),'日常池不自行触发威吓或奔跑');
}
const water=definition.habitats.find(p=>p.id==='water')!;
for(const scale of [.94,1,1.06])assert(Math.abs(GOOSE_WATERLINE*scale+surfaceOffset(water,scale)-GOOSE_WATERLINE)<1e-9);
assert.equal(resolveHabitat(definition,'water','run').motion,'idle_water');
const dir=process.env.LIVESTOCK_CHECK_DIR??'/tmp/wanhu-livestock-checks';mkdirSync(dir,{recursive:true});
const report={result:'passed',sourceSHA:process.env.REVIEW_HEAD_SHA??'local',animal:definition.id,bones:7,weights:1,totalPoses:reports.length*8*241,reports};
writeFileSync(`${dir}/goose-numeric.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
