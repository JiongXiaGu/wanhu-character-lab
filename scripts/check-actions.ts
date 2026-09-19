import assert from 'node:assert/strict';
import {Vector3 as V,Quaternion as Q,Mesh,BufferAttribute} from 'three';
import {makeCharacter} from '../src/character/v3/outfit';
import {makeActor} from '../src/character/v3/rig';
import {WORK_IDS,ACTIONS,crossedEvents} from '../src/character/actions/catalog';
import {sampleWork} from '../src/character/actions/bake';
import {createWorkPlayer,visibleRecipe} from '../src/character/actions/player';
import {B} from '../src/character/v3/types';

let cases=0,frames=0,maxError=0,minFoot=Infinity,maxReach=0;
for(const shape of [{height:1.76,build:.5},{height:1.58,build:0},{height:1.92,build:1}])for(const id of WORK_IDS) {
  const d=makeCharacter({outfit:'archer',...shape}),before=JSON.stringify(d.recipe),effective=visibleRecipe(d.recipe,id);
  for(const slot of ACTIONS[id].occupied)assert.equal(effective.slots[slot],'none');assert.equal(JSON.stringify(d.recipe),before,'预览修改了原配方');
  const actor=makeActor(makeCharacter(effective)),work=createWorkPlayer(actor,id,d.recipe),def=ACTIONS[id],startPosition=actor.mesh.geometry.attributes.position.array;
  let worst=0,lowest=Infinity;
  const pos=actor.mesh.geometry.attributes.position,idx=actor.mesh.geometry.index!,skin=actor.mesh.geometry.attributes.skinIndex;
  const footVertices:number[]=[];for(let i=0;i<pos.count;i++)if([B.RightFoot,B.LeftFoot].includes(skin.getX(i)))footVertices.push(i);
  for(let k=0;k<=60;k++) {
    const phase=k/60;work.seek(phase);actor.mesh.updateMatrixWorld(true);actor.skeleton.update();
    const sample=sampleWork(actor.data.joints,d.recipe,id,Math.min(phase,def.loop?.999999:1));
    for(const contact of sample.contacts){const actual=new V(...contact.offset).applyMatrix4(actor.bones[contact.bone].matrixWorld),error=actual.distanceTo(new V(...contact.point));worst=Math.max(worst,error);maxReach=Math.max(maxReach,contact.unreachable);assert(error<.012*shape.height/1.76,`${id} 手离握点 ${phase}: ${error}`);}
    const values:V[]=[];for(let i=0;i<pos.count;i++){const p=actor.mesh.getVertexPosition(i,new V());assert([p.x,p.y,p.z].every(Number.isFinite));assert(p.length()<shape.height*2);values.push(p);}
    for(let i=0;i<idx.count;i+=3){const a=values[idx.getX(i)],b=values[idx.getX(i+1)],c=values[idx.getX(i+2)];assert(new V().crossVectors(b.clone().sub(a),c.clone().sub(a)).lengthSq()>1e-18,`${id} 退化面 ${phase}/${i/3}`);}
    for(const i of footVertices)lowest=Math.min(lowest,values[i].y);
    assert(actor.mesh.geometry.attributes.position.array===startPosition,'逐帧重建了人物网格');frames++;
  }
  assert(lowest>-.018*shape.height/1.76,`${id} 脚穿地: ${lowest}`);
  assert(work.props.triangles<600,'道具面数超限');
  work.props.group.traverse(o=>{if(o instanceof Mesh){assert(o.geometry.attributes.position.count>0);for(const a of ['position','normal'])assert(Array.from(o.geometry.getAttribute(a).array).every(Number.isFinite));}});
  if(def.loop){const a=sampleWork(actor.data.joints,d.recipe,id,0),b=sampleWork(actor.data.joints,d.recipe,id,1);assert(a.propP.distanceTo(b.propP)<1e-6);for(let i=0;i<20;i++)assert(a.pose.local[i].angleTo(b.pose.local[i])<1e-6,`${id} 骨骼不闭环`);}
  work.replay();work.update(def.duration*.59);const count=work.status().eventCount;work.update(0);assert.equal(work.status().eventCount,count,'暂停仍发事件');
  work.seek(.53);assert.equal(work.status().eventCount,0,'定位触发事件');
  work.replay();work.update(def.duration*3.3);assert.equal(work.status().eventCount,def.events.length*(def.loop?3:1),'跳帧事件错误');
  if(!def.loop){assert(work.status().finished);assert(Math.abs(work.status().phase-1)<1e-6,'单次动作跳回开头');}
  if(id==='hoe'||id==='hammer'){const contact=sampleWork(actor.data.joints,d.recipe,id,.52).toolContact!;assert(Math.abs(contact.y-(id==='hoe'?.00372:.875)*shape.height/1.76)<.01);}
  work.dispose();actor.dispose();maxError=Math.max(maxError,worst);minFoot=Math.min(minFoot,lowest);cases++;
  console.log(`${id.padEnd(15)} ${shape.height}m | grip ${(worst*1000).toFixed(2)}mm | foot ${(lowest*1000).toFixed(2)}mm | prop ${work.props.triangles} tris | PASS`);
}
assert.deepEqual(crossedEvents(ACTIONS.pick,1,1),[]);assert.deepEqual(crossedEvents(ACTIONS.hoe,1,.5),[]);
console.log(JSON.stringify({pass:true,cases,frames,maxGripErrorMillimeters:maxError*1000,maxUnreachable:maxReach,minFootY:minFoot,checks:['prop sockets','recipe restoration','single-shot and loop','event seek/pause/skip','no per-frame mesh rebuild','skinned geometry','ground contact','rig preserved']},null,2));
