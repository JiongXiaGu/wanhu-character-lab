import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Color, FrontSide, Matrix4, Vector3 } from 'three';
import { PIG_DEFINITION as definition } from '../src/pig/definition';
import { PIG_BONES as B, PIG_JOINTS, PIG_LEGS } from '../src/pig/rig';
import { createAnimalActor } from '../src/livestock/actor';
import { createPoseCache, POSE_FPS } from '../src/livestock/pose-cache';
import { createCrowd, makePlacements, layoutHalf, PHASE_COHORTS } from '../src/livestock/crowd';
import { resolveHabitat } from '../src/livestock/habitat';
import { livestockDefinition } from '../src/livestock/catalog';
import { CROWD_COUNTS } from '../src/livestock/types';
import type { AnimalMeshData, LivestockLodDefinition, Point } from '../src/livestock/types';

/** 完整壳拓扑，不用预算断言代替删除面／翻面的实际故障检查。 */
function topology(data:AnimalMeshData) {
  const visited=new Set<number>();
  for(const part of data.parts) {
    const end=part.start+part.count, edges=new Map<string,number>(),directions=new Map<string,number>();
    const neighbors=new Map<number,Set<number>>();let faces=0,volume=0;
    for(let i=0;i<data.indices.length;i+=3) {
      const ids=data.indices.slice(i,i+3);if(ids[0]<part.start||ids[0]>=end)continue;
      assert(ids.every(id=>id>=part.start&&id<end),'体壳跨越了非共享部件');faces++;
      const [a,b,c]=ids.map(id=>new Vector3(...data.positions[id]));
      assert(a.toArray().concat(b.toArray(),c.toArray()).every(Number.isFinite),'非有限坐标');
      assert(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()>1e-12,`${part.name}退化面`);
      volume+=a.dot(b.clone().cross(c))/6;
      for(let j=0;j<3;j++) {
        const a=ids[j],b=ids[(j+1)%3],key=`${Math.min(a,b)}/${Math.max(a,b)}`;
        edges.set(key,(edges.get(key)??0)+1);directions.set(key,(directions.get(key)??0)+(a<b?1:-1));
        if(!neighbors.has(a))neighbors.set(a,new Set());if(!neighbors.has(b))neighbors.set(b,new Set());
        neighbors.get(a)!.add(b);neighbors.get(b)!.add(a);
      }
    }
    assert([...edges.values()].every(n=>n===2),`${part.name}开放／非流形边`);
    assert([...directions.values()].every(n=>n===0),`${part.name}绕序错误`);
    assert(volume>1e-9,`${part.name}整体朝内`);
    assert.equal(part.count-edges.size+faces,2,`${part.name}Euler闭壳`);
    const connected=new Set([part.start]),pending=[part.start];
    while(pending.length)for(const next of neighbors.get(pending.pop()!)??[])if(!connected.has(next)){connected.add(next);pending.push(next);}
    assert.equal(connected.size,part.count,`${part.name}不是单一连通壳`);
    for(const id of connected){assert(!visited.has(id),'部件逻辑点重复登记');visited.add(id);}
  }
  assert.equal(visited.size,data.positions.length,'孤立点／未登记隐藏附件');
}
function weights(data:AnimalMeshData) {
  assert(data.bones.every(b=>Number.isInteger(b)&&b>=0&&b<9));
  for(const part of data.parts.slice(1)) {
    const expected=part.name==='Tail'?B.Tail:PIG_JOINTS.findIndex(j=>j.name===part.name);
    const bone=expected>=0?expected:B.Head;
    for(let i=part.start;i<part.start+part.count;i++)assert.equal(data.bones[i],bone,`${part.name}真实逐点权重错误`);
  }
  assert(data.bones.slice(0,data.parts[0].count).includes(B.Neck),'粗颈不能改为Body刚性壳');
  assert(data.bones.slice(0,data.parts[0].count).includes(B.Head),'猪鼻不能失去Head权重');
  for(let i=0;i<data.parts[0].count;i++) {
    const z=data.positions[i][2];assert.equal(data.bones[i],z<.3?B.Body:z<.4?B.Neck:B.Head,'主体截面权重');
  }
}
function validate(data:AnimalMeshData,lod:LivestockLodDefinition) {
  assert.equal(data.positions.length,lod.logicalVertices);assert.equal(data.indices.length,lod.triangles*3);
  assert.equal(data.bones.length,data.positions.length);assert.equal(data.colors.length,data.positions.length);
  assert(data.indices.every(i=>Number.isInteger(i)&&i>=0&&i<data.positions.length));
  topology(data);weights(data);
  const main=data.positions.slice(0,data.parts[0].count),nose=main.filter(p=>p[2]>.61);
  assert.equal(data.parts[0].name,'BodyNeckHeadSnout');
  assert(Math.max(...main.map(p=>p[2]))<.75,'鼻盘脱离／异常拉长');
  assert(nose.length>=3&&Math.max(...nose.map(p=>p[0]))-Math.min(...nose.map(p=>p[0]))>.15,'鼻盘不能消失或变尖');
  assert(Math.max(...main.map(p=>p[0]))-Math.min(...main.map(p=>p[0]))>.50,'身体不够厚');
  assert(Math.max(...main.map(p=>p[1]))>=.60&&Math.min(...main.filter(p=>Math.abs(p[2])<.31).map(p=>p[1]))<.20,'背部／垂腹轮廓');
  for(const point of data.positions)assert(data.positions.some(p=>Math.hypot(p[0]+point[0],p[1]-point[1],p[2]-point[2])<.001),'左右结构异常');
  for(const bone of PIG_LEGS){const [x,,z]=PIG_JOINTS[bone].position;assert(Math.abs(x)>.15);assert(bone<=B.FrontLegR?z>.20:z<-.28,'肩臀腿位');}
}
/** 本轮用户指定方向的几何约束：紧凑素鼻、正锥短腿、可读深色眼面；不只查部件名字。 */
function visualLandmarks(data:AnimalMeshData) {
  const main=data.positions.slice(0,data.parts[0].count),end=Math.max(...main.map(p=>p[2]));
  assert(end>.60&&end<.63,'鼻端前伸过大');
  const cap=main.filter(p=>Math.abs(p[2]-end)<1e-6);
  const span=(points:readonly Point[],axis:number)=>Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis]));
  assert(span(cap,0)>.15&&span(cap,0)<.18,'鼻盘过大／过窄');
  assert(span(cap,1)>.105&&span(cap,1)<.125,'鼻盘高度过大／过小');
  const colors=main.flatMap((p,i)=>Math.abs(p[2]-end)<1e-6?[data.colors[i]]:[]);
  assert.equal(new Set(colors).size,1,'素鼻盘不得恢复鼻孔色块');
  assert(data.positions.slice(data.parts[0].count).every(p=>p[2]<.56),'鼻前不得添加独立孔洞或凸起附件');
  assert(!data.parts.some(p=>p.name.startsWith('Nostril')),'不得恢复鼻孔壳');
  for(const bone of PIG_LEGS) {
    const part=data.parts.find(p=>p.name===PIG_JOINTS[bone].name)!;
    const points=data.positions.slice(part.start,part.start+part.count),top=Math.max(...points.map(p=>p[1]));
    const sole=points.filter(p=>p[1]<.01),root=points.filter(p=>Math.abs(p[1]-top)<1e-6);
    assert(span(root,0)>span(sole,0)*1.5,'腿根必须粗于脚底，不能恢复倒锥／细根腿');
    assert(span(sole,0)>.075&&span(sole,2)<.105,'脚底过细或拉长');
    assert(sole.length===(part.count===6?3:4),'整蹄不使用凹分趾长槽');
  }
  const luminance=(color:string)=>{const c=new Color(color);return .2126*c.r+.7152*c.g+.0722*c.b;};
  for(const part of data.parts.filter(p=>p.name.startsWith('Eye'))) {
    const points=data.positions.slice(part.start,part.start+part.count);
    assert(span(points,1)>.030&&Math.hypot(span(points,0),span(points,2))>.058,'眼面尺寸退回不可读小点');
    if(part.count===14) {
      let darkArea=0;
      for(let i=0;i<data.indices.length;i+=3) {
        const ids=data.indices.slice(i,i+3);
        if(!ids.every(id=>id>=part.start&&id<part.start+part.count&&luminance(data.colors[id])<.015))continue;
        const [a,b,c]=ids.map(id=>new Vector3(...data.positions[id]));
        darkArea+=b.sub(a).cross(c.sub(a)).length()/2;
      }
      assert(darkArea>.00075,'深色眼面不能退化为一颗亮色菱形里的黑针尖');
    }
  }
}
/** 固定斜射线测试实际三角壳内部；不是包围盒或部件名称近似接触。 */
function inside(point:Vector3,positions:Vector3[],faces:number[][]) {
  let hits=0;const [dx,dy,dz]=[.923,.181,.339];
  for(const ids of faces) {
    const a=positions[ids[0]],b=positions[ids[1]],c=positions[ids[2]];
    const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
    const hx=dy*vz-dz*vy,hy=dz*vx-dx*vz,hz=dx*vy-dy*vx,det=ux*hx+uy*hy+uz*hz;
    if(Math.abs(det)<1e-12)continue;const inv=1/det,tx=point.x-a.x,ty=point.y-a.y,tz=point.z-a.z;
    const u=(tx*hx+ty*hy+tz*hz)*inv;if(u<0||u>1)continue;
    const qx=ty*uz-tz*uy,qy=tz*ux-tx*uz,qz=tx*uy-ty*ux,v=(dx*qx+dy*qy+dz*qz)*inv;
    if(v<0||u+v>1)continue;if((vx*qx+vy*qy+vz*qz)*inv>1e-8)hits++;
  }
  return hits%2===1;
}
function attachmentWitnesses(data:AnimalMeshData) {
  return data.parts.slice(1).map(part=>{
    const indices=Array.from({length:part.count},(_,i)=>part.start+i);
    const bone=data.bones[part.start];
    if(bone>=B.FrontLegL)return {name:part.name,indices:indices.filter(i=>data.positions[i][1]>.35),average:true};
    if(part.name==='Tail')return {name:part.name,indices:[part.count===4?part.start:part.start+part.count-2],average:false};
    if(part.name.startsWith('Eye'))return {name:part.name,indices:[part.start],average:false};
    // 耳根只选择近头的前三角根点，不把外垂耳尖作为附着证据。
    return {name:part.name,indices:part.count===6?[part.start+3,part.start+4]:indices.slice(0,3),average:true};
  });
}
function attachments(data:AnimalMeshData,points:Vector3[]) {
  const faces:number[][]=[];for(let i=0;i<data.indices.length;i+=3)if(data.indices[i]<data.parts[0].count)faces.push(data.indices.slice(i,i+3));
  for(const witness of attachmentWitnesses(data)) {
    assert(witness.indices.length>0,`${witness.name}没有根部`);
    const center=witness.indices.reduce((sum,id)=>sum.add(points[id]),new Vector3()).divideScalar(witness.indices.length);
    assert(inside(center,points,faces),`${witness.name}实际根部离体`);
    // 腿根中心在体内仍可能让外角顶盖穿出；逐姿态检查整圈根点，而不只查均值。
    if(PIG_JOINTS.some(j=>j.name===witness.name))for(const id of witness.indices)
      assert(inside(points[id],points,faces),`${witness.name}腿根顶盖露出躯干：${points[id].toArray()}`);
  }
}
function inverseBind(actor:ReturnType<typeof createAnimalActor>) {
  actor.skeleton.boneInverses.forEach((matrix,i)=>{const expected=new Matrix4().makeTranslation(...PIG_JOINTS[i].position).invert();matrix.elements.forEach((n,j)=>assert(Math.abs(n-expected.elements[j])<1e-6,'作者inverse bind不符'));});
  actor.bind();const identity=new Matrix4();
  actor.bones.forEach((bone,i)=>{
    const product=bone.matrixWorld.clone().multiply(actor.skeleton.boneInverses[i]);
    product.elements.forEach((n,j)=>assert(Math.abs(n-identity.elements[j])<1e-6,'错误inverse bind'));
  });
  const p=actor.geometry.getAttribute('position');for(let i=0;i<p.count;i++) {
    const bind=new Vector3().fromBufferAttribute(p,i);assert(actor.mesh.applyBoneTransform(i,bind.clone()).distanceTo(bind)<1e-6,'bind改变了网格');
  }
}
assert.equal(livestockDefinition(definition.id),definition);
assert.deepEqual(PIG_JOINTS.map(j=>j.name),['Root','Body','Neck','Head','Tail','FrontLegL','FrontLegR','RearLegL','RearLegR']);
assert.deepEqual(PIG_JOINTS.map(j=>j.parent),[-1,0,1,2,1,0,0,0,0]);
assert.deepEqual(definition.motions.map(m=>m.id),['idle','walk','run','root','sniff']);
assert.deepEqual(definition.habitats.map(h=>h.id),['land']);
assert.deepEqual(definition.habitats[0].mixed.map(m=>[m.motion,m.weight]),[['idle',.30],['walk',.30],['root',.25],['sniff',.15]]);
assert.equal(resolveHabitat(definition,'water','swim').motion,'idle');
const reports:{faultInjections:number;[key:string]:unknown}[]=[];
for(const lod of definition.lods) {
  const actor=createAnimalActor(definition,lod.id),data=actor.data;validate(data,lod);visualLandmarks(data);
  assert.equal(actor.bones.length,9);assert.equal(actor.material.side,FrontSide);assert.equal(actor.material.transparent,false);
  assert.equal(actor.geometry.groups.length,0);assert.equal(actor.geometry.getAttribute('position').count,lod.triangles*3);
  const skinWeights=actor.geometry.getAttribute('skinWeight'),skinIndices=actor.geometry.getAttribute('skinIndex');
  for(let i=0;i<skinWeights.count;i++){assert.equal(skinWeights.getX(i),1);assert.equal(skinWeights.getY(i)+skinWeights.getZ(i)+skinWeights.getW(i),0);assert.equal(skinIndices.getX(i),data.bones[data.indices[i]]);}
  inverseBind(actor);
  const source=actor.geometry.getAttribute('position'),bind=Array.from({length:source.count},(_,i)=>new Vector3().fromBufferAttribute(source,i));
  const logicalToRender=data.positions.map((_,id)=>data.indices.indexOf(id));
  const logical=(points:Vector3[])=>logicalToRender.map(i=>points[i]);
  const sample=(motion:string,phase:number)=>{actor.sample(motion,phase);return bind.map((point,i)=>actor.mesh.applyBoneTransform(i,point.clone()));};
  const soles=PIG_LEGS.map(b=>data.indices.map((id,i)=>data.bones[id]===b&&data.positions[id][1]<.01?i:-1).filter(i=>i>=0));
  const nose=data.indices.map((id,i)=>id<data.parts[0].count&&data.positions[id][2]>.61?i:-1).filter(i=>i>=0);
  const bodyFaces:{i:number;area:number}[]=[];
  for(let i=0;i<data.indices.length;i+=3)if(data.indices[i]<data.parts[0].count)bodyFaces.push({i,area:bind[i+1].clone().sub(bind[i]).cross(bind[i+2].clone().sub(bind[i])).length()});
  let poses=0,minGround=Infinity,minRootNose=Infinity,minBodyAreaRatio=Infinity,maxHorizontalRadius=0;
  try { attachments(data,data.positions.map(p=>new Vector3(...p))); } catch(error) { throw new Error(`${lod.id}/bind: ${error}`); }
  for(const motion of definition.motions) {
    const first=sample(motion.id,0),last=sample(motion.id,1);
    first.forEach((p,i)=>assert(p.distanceTo(last[i])<1e-5,`${lod.id}/${motion.id}循环首尾`));
    for(let f=0;f<=240;f++) {
      const points=sample(motion.id,f/240);poses++;
      for(const p of points){assert(p.toArray().every(Number.isFinite));minGround=Math.min(minGround,p.y);assert(p.y>=-.001,`${lod.id}/${motion.id}/${f}穿地${p.y}`);assert(p.length()<1.2,'异常拉伸');maxHorizontalRadius=Math.max(maxHorizontalRadius,Math.hypot(p.x,p.z));}
      for(const foot of soles){const min=Math.min(...foot.map(i=>points[i].y));assert(min>=-.001&&min<.07,'四足接地／短步抬脚范围');}
      if(motion.id==='root'||motion.id==='sniff')for(const foot of soles)foot.forEach(i=>assert(points[i].distanceTo(bind[i])<1e-6,'拱地／闻嗅四足必须稳定'));
      if(motion.id==='root')minRootNose=Math.min(minRootNose,...nose.map(i=>points[i].y));
      for(const {i,area} of bodyFaces){const ratio=points[i+1].clone().sub(points[i]).cross(points[i+2].clone().sub(points[i])).length()/area;minBodyAreaRatio=Math.min(minBodyAreaRatio,ratio);assert(ratio>.20,`${lod.id}/${motion.id}/${f}主体塌缩`);}
      try { attachments(data,logical(points)); } catch(error) { throw new Error(`${lod.id}/${motion.id}/${f}: ${error}`); }
    }
  }
  assert(minRootNose>=.001&&minRootNose<=.035,`${lod.id}鼻盘拱地高度：${minRootNose}`);
  for(const motion of ['walk','run']) {
    const running=motion==='run',stance=running?.54:.64,shifts=running?[0,.5,.52,.02]:[0,.5,.75,.25];
    for(let leg=0;leg<4;leg++) {
      const phase=(t:number)=>(t-shifts[leg]+1)%1;
      const a=sample(motion,phase(.08*stance)),b=sample(motion,phase(.85*stance));
      const center=(ps:Vector3[])=>soles[leg].reduce((sum,i)=>sum+ps[i].z,0)/soles[leg].length;
      assert(center(a)-center(b)>(running?.14:.075),`${motion}第${leg}腿真实支撑期必须向-Z后扫`);
      for(const points of [a,b])assert(Math.abs(Math.min(...soles[leg].map(i=>points[i].y))-.006)<.001,'支撑脚滑离地面');
      const lifted=sample(motion,phase(stance+(1-stance)/2));assert(Math.min(...soles[leg].map(i=>lifted[i].y))>.025,'摆动腿没有抬起');
    }
  }
  const cache=createPoseCache(definition,lod.id),cachedPoses=cache.size;
  for(const motion of definition.motions)for(const phase of [0,.5,1]) {
    const frameCount=Math.max(2,Math.ceil(motion.duration*POSE_FPS)),sampledPhase=Math.round(phase*frameCount)/frameCount;
    const actual=cache.get(motion.id,phase).getAttribute('position'),expected=sample(motion.id,sampledPhase);
    expected.forEach((p,i)=>assert(p.distanceTo(new Vector3().fromBufferAttribute(actual,i))<1e-6,'缓存与真实蒙皮不一致'));
  }
  assert.equal(cache.size,cachedPoses);cache.dispose();cache.dispose();
  const crowd=createCrowd(definition,actor.material);let minimumSpacing=Infinity;
  for(const count of CROWD_COUNTS) {
    crowd.setLayout(count,731);assert.deepEqual(crowd.placements,makePlacements(count,731,definition.previewSpacing));
    assert.equal(crowd.placements.length,count);
    for(let i=0;i<count;i++)for(let j=i+1;j<count;j++)minimumSpacing=Math.min(minimumSpacing,Math.hypot(crowd.placements[i].x-crowd.placements[j].x,crowd.placements[i].z-crowd.placements[j].z));
    for(const motion of definition.motions)for(const mixed of [false,true]) {
      crowd.update(.37,{motion:motion.id,surface:'land',mixed,loop:true},lod.id);
      assert.equal(crowd.group.children.reduce((sum,mesh)=>sum+(mesh as any).count,0),count);
      assert(crowd.batchCount>0&&crowd.batchCount<=(mixed?4:1)*PHASE_COHORTS);
      if(mixed)assert(crowd.group.children.filter(m=>m.visible).every(m=>!m.name.includes('/run/')));
    }
  }
  assert(minimumSpacing>2*(maxHorizontalRadius*1.06+.30),'种子格距不足以容纳任意朝向和混合移动');
  const cached=crowd.cachedPoses;for(let i=0;i<40;i++)crowd.update(i/7,{motion:'root',surface:'land',mixed:true,loop:true},lod.id);
  assert.equal(crowd.cachedPoses,cached);crowd.dispose();crowd.dispose();
  let faults=0;const fails=(fn:()=>void)=>{assert.throws(fn);faults++;};const clone=()=>structuredClone(data);
  let broken=clone();broken.bones[broken.parts[1].start]=B.Head;fails(()=>weights(broken));
  broken=clone();broken.bones=broken.bones.map(b=>b===B.FrontLegL?B.RearLegR:b);fails(()=>weights(broken));
  broken=clone();broken.positions=broken.positions.map(p=>p[2]>.59?[p[0],p[1],p[2]+.4] as Point:p);fails(()=>validate(broken,lod));
  broken=clone();[broken.indices[0],broken.indices[1]]=[broken.indices[1],broken.indices[0]];fails(()=>topology(broken));
  broken=clone();const cross=Array.from({length:broken.indices.length/3},(_,i)=>i*3).find(i=>new Set(broken.indices.slice(i,i+3).map(id=>broken.bones[id])).size>1)!;broken.indices.splice(cross,3);fails(()=>topology(broken));
  broken=clone();broken.positions[broken.indices[1]]=[...broken.positions[broken.indices[0]]];fails(()=>topology(broken));
  for(const wrong of [B.Body,B.Head]){broken=clone();broken.bones=broken.bones.map(b=>b===B.Tail?wrong:b);fails(()=>weights(broken));}
  for(const name of ['Tail','EarL']){broken=clone();const part=broken.parts.find(p=>p.name===name)!;for(let i=part.start;i<part.start+part.count;i++){const[x,y,z]=broken.positions[i];broken.positions[i]=[x+1,y,z];}fails(()=>attachments(broken,broken.positions.map(p=>new Vector3(...p))));}
  broken=clone();broken.positions=broken.positions.map(p=>p[2]>.61?[p[0]*2,p[1],p[2]] as Point:p);fails(()=>visualLandmarks(broken));
  broken=clone();broken.positions=broken.positions.map(p=>p[2]>.61?[p[0],p[1],p[2]+.05] as Point:p);fails(()=>visualLandmarks(broken));
  broken=clone();const leg=broken.parts.find(p=>p.name==='FrontLegL')!,cx=PIG_JOINTS[B.FrontLegL].position[0];
  for(let i=leg.start;i<leg.start+leg.count;i++)if(broken.positions[i][1]>.35){const[x,y,z]=broken.positions[i];broken.positions[i]=[cx+(x-cx)*.3,y,z];}
  fails(()=>visualLandmarks(broken));
  if(lod.id!=='lod2') {
    broken=clone();const eye=broken.parts.find(p=>p.name==='EyeL')!,center=new Vector3(...broken.positions[eye.start]);
    for(let i=eye.start;i<eye.start+eye.count;i++)broken.positions[i]=new Vector3(...broken.positions[i]).sub(center).multiplyScalar(.2).add(center).toArray();
    fails(()=>visualLandmarks(broken));
  }
  actor.skeleton.boneInverses[B.Head].elements[13]+=.1;fails(()=>inverseBind(actor));actor.skeleton.calculateInverses();
  skinIndices.setX(data.indices.findIndex(id=>data.bones[id]===B.Tail),B.Head);
  fails(()=>{for(let i=0;i<skinIndices.count;i++)assert.equal(skinIndices.getX(i),data.bones[data.indices[i]]);});
  actor.dispose();actor.dispose();
  reports.push({lod:lod.id,triangles:lod.triangles,logicalVertices:lod.logicalVertices,closedShells:data.parts.length,poses,minGround,minRootNose,minBodyAreaRatio,maxHorizontalRadius,minimumSpacing,cachedPoses,faultInjections:faults});
}
// 缺省格距必须与原物种逐点相同，不能把猪的配置反向套给家禽。
assert.deepEqual(makePlacements(100,731),makePlacements(100,731,1.45));assert.equal(layoutHalf(100),layoutHalf(100,1.45));
for(const id of ['chicken_brown','duck_domestic_brown','goose_domestic_white'])assert.equal(livestockDefinition(id).previewSpacing,undefined);
for(const item of definition.habitats[0].mixed){const duration=definition.motions.find(m=>m.id===item.motion)!.duration;assert(Number.isInteger(definition.habitats[0].duration/duration));}
assert.throws(()=>makePlacements(100,731,NaN));assert.throws(()=>makePlacements(100,731,0));
const dir=process.env.LIVESTOCK_CHECK_DIR??'/tmp/wanhu-livestock-checks';mkdirSync(dir,{recursive:true});
const report={result:'passed',sourceSHA:process.env.REVIEW_HEAD_SHA??'local',animal:definition.id,bones:9,weights:1,totalPoses:3*5*241,totalFaultInjections:reports.reduce((sum,r)=>sum+r.faultInjections,0),reports};
writeFileSync(`${dir}/pig-numeric.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
