import {BODY_HEIGHT} from '../v3/types';
import * as T from 'three';
import {createClipClock} from '../../animation/clip-clock';
import type {Actor} from '../v3/rig';
import {SAMPLE_BONE_COUNT,SAMPLE_PARENTS,validateMotionData,type HumanoidMotionData} from './data';
import {motionAssetDirectory,motionDefinition,motionSourceLabel,type MotionId} from './catalog';
import {retargetMotion,exportTargetMotion,type RetargetBake} from './retarget';

const cache=new Map<MotionId,Promise<HumanoidMotionData>>();
export function loadMotion(id:MotionId):Promise<HumanoidMotionData>{
  const found=cache.get(id);if(found)return found;
  const pending=fetch(`${import.meta.env.BASE_URL}${motionAssetDirectory(id)}/${id}.json`)
    .then(async response=>{
      if(!response.ok)throw new Error(`动画资源 ${response.status}；请运行 npm run prepare:motion 后重新启动。`);
      const data=await response.json() as HumanoidMotionData;
      validateMotionData(data,id);
      return data;
    }).catch(error=>{if(cache.get(id)===pending)cache.delete(id);throw error;});
  cache.set(id,pending);if(cache.size>3)cache.delete(cache.keys().next().value!);
  return pending;
}
export interface MotionStatus{id:MotionId;ready:boolean;duration:number;loop:boolean;seamDegrees:number;sourceHash:string;phase:number;stage:string;finished:boolean}
export interface MotionPlayer{id:MotionId;sourceScene:T.Scene;targetDebug:T.LineSegments;bake:RetargetBake;update:(delta:number)=>void;seek:(phase:number)=>void;replay:()=>void;setLoop:(value:boolean)=>void;setHeadAxes:(value:boolean)=>void;status:()=>MotionStatus;export:()=>ReturnType<typeof exportTargetMotion>;dispose:()=>void}

function makeHeadAxes(){
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(12),3));
  geometry.setAttribute('color',new T.Float32BufferAttribute([.5,.9,1,.5,.9,1,1,.8,.4,1,.8,.4],3));
  const lines=new T.LineSegments(geometry,new T.LineBasicMaterial({vertexColors:true,depthTest:false}));
  lines.visible=false;lines.frustumCulled=false;lines.renderOrder=10;
  return lines;
}

export function createMotionPlayer(actor:Actor,source:HumanoidMotionData):MotionPlayer{
  const bake=retargetMotion(actor.data,source),definition=motionDefinition(source.id),scene=new T.Scene();
  const mediaPipe=source.source.provider==='MediaPipe'?source.mediapipe33:undefined;
  const edges:readonly (readonly number[])[]=mediaPipe?mediaPipe.connections:SAMPLE_PARENTS.map((parent,index)=>[parent,index]).filter(([parent,index])=>parent>0&&index!==1);
  const sourcePointCount=mediaPipe?33:SAMPLE_BONE_COUNT;
  const positions=new Float32Array(edges.length*6),geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
  const material=new T.LineBasicMaterial({color:'#e4c495'}),lines=new T.LineSegments(geometry,material);
  lines.frustumCulled=false;scene.add(lines);
  const dotsGeometry=new T.SphereGeometry(.017*BODY_HEIGHT[actor.data.recipe.bodyType]/1.76,6,4);
  const dotsMaterial=new T.MeshBasicMaterial({color:'#9cd9dd'});
  const dots=Array.from({length:mediaPipe?33:24},()=>{const dot=new T.Mesh(dotsGeometry,dotsMaterial);scene.add(dot);return dot;});
  const grid=new T.GridHelper(3.2,16,'#697b7d','#40585e');scene.add(grid);
  const sourceDebug=makeHeadAxes(),targetDebug=makeHeadAxes();scene.add(sourceDebug);
  actor.resetBindPose();
  const action=actor.mixer.clipAction(bake.clip);action.reset().setLoop(T.LoopOnce,1).setEffectiveWeight(1).play();action.clampWhenFinished=true;action.paused=true;
  actor.mesh.boundingSphere=bake.bounds.getBoundingSphere(new T.Sphere());
  const clock=createClipClock(source.duration,bake.loop);
  let disposed=false;
  const interpolationPoint=new T.Vector3(),point=new T.Vector3(),end=new T.Vector3(),sourceRotation=new T.Quaternion(),targetRotation=new T.Quaternion();
  const dotIndex=(index:number)=>mediaPipe?index:index-1;

  function samplePoint(index:number,frame:number,next:number,alpha:number,target:T.Vector3){
    const sampled=mediaPipe?mediaPipe.positions:bake.sourcePositions;
    target.fromArray(sampled,(frame*sourcePointCount+index)*3);
    interpolationPoint.fromArray(sampled,(next*sourcePointCount+index)*3);
    target.lerp(interpolationPoint,alpha);
  }
  function drawAxes(target:T.LineSegments,origin:T.Vector3,rotation:T.Quaternion){
    const attribute=target.geometry.getAttribute('position') as T.BufferAttribute;
    const length=.24*BODY_HEIGHT[actor.data.recipe.bodyType]/1.76;
    for(let axis=0;axis<2;axis++){
      attribute.setXYZ(axis*2,origin.x,origin.y,origin.z);
      end.set(0,axis===1?length:0,axis===0?length:0).applyQuaternion(rotation).add(origin);
      attribute.setXYZ(axis*2+1,end.x,end.y,end.z);
    }
    attribute.needsUpdate=true;
  }
  function sync(){
    if(disposed)return;
    const time=clock.time;action.enabled=true;action.time=time;actor.update(0);
    let frame=Math.min(source.times.length-2,Math.floor(time*source.fps));
    while(frame>0&&source.times[frame]>time)frame--;
    const next=frame+1,alpha=T.MathUtils.clamp((time-source.times[frame])/(source.times[next]-source.times[frame]),0,1);
    for(let index=mediaPipe?0:1;index<sourcePointCount;index++){
      samplePoint(index,frame,next,alpha,point);
      dots[dotIndex(index)].position.copy(point);
      if(mediaPipe)dots[index].visible=mediaPipe.visibility[frame*33+index]>=.2&&(mediaPipe.validity?.[frame*33+index]??1)===1;
    }
    edges.forEach(([start,finish],index)=>{
      if(mediaPipe&&(!dots[start].visible||!dots[finish].visible)){
        positions.fill(0,index*6,index*6+6);
        return;
      }
      dots[dotIndex(start)].position.toArray(positions,index*6);
      dots[dotIndex(finish)].position.toArray(positions,index*6+3);
    });
    geometry.attributes.position.needsUpdate=true;
    if(targetDebug.visible){
      sourceRotation.fromArray(source.worldDeltas,(frame*20+5)*4);
      targetRotation.fromArray(source.worldDeltas,(next*20+5)*4);
      sourceRotation.slerp(targetRotation,alpha).normalize();
      drawAxes(sourceDebug,dots[mediaPipe?0:4].position,sourceRotation);
      actor.bones[5].getWorldPosition(point);actor.bones[5].getWorldQuaternion(targetRotation);
      drawAxes(targetDebug,point,targetRotation);
    }
  }
  const player:MotionPlayer={
    id:source.id,sourceScene:scene,targetDebug,bake,
    update(delta){clock.advance(delta);sync();},seek(phase){clock.seek(phase);sync();},replay(){clock.replay();sync();},
    setLoop(value){clock.setLoop(value);sync();},setHeadAxes(value){sourceDebug.visible=value;targetDebug.visible=value;sync();},
    status(){return{id:source.id,ready:true,duration:source.duration,loop:clock.loop,seamDegrees:bake.seamDegrees,sourceHash:source.source.sha256,phase:clock.phase,stage:`${motionSourceLabel(definition.source)} · ${definition.label}`,finished:clock.finished};},
    export(){return exportTargetMotion(actor.data,source,bake);},
    dispose(){
      disposed=true;action.stop();actor.mixer.uncacheClip(bake.clip);
      geometry.dispose();material.dispose();dotsGeometry.dispose();dotsMaterial.dispose();grid.geometry.dispose();
      for(const gridMaterial of Array.isArray(grid.material)?grid.material:[grid.material])gridMaterial.dispose();
      for(const debug of [sourceDebug,targetDebug]){debug.removeFromParent();debug.geometry.dispose();(debug.material as T.Material).dispose();}
      scene.clear();
    },
  };
  player.seek(0);
  return player;
}
