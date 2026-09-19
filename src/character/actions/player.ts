import * as T from 'three';
import type {Actor} from '../v3/rig';
import type {Recipe} from '../v3/types';
import {ACTIONS,actionStage,crossedEvents,type WorkId} from './catalog';
import {bakeWork,sampleWork} from './bake';
import {createWorkProps,type WorkProps} from './props';
import {WHEEL_RADIUS} from './anchors';
export interface WorkStatus {phase:number;stage:string;finished:boolean;eventCount:number;lastEvent:string;propTriangles:number;maxGripError:number}
export interface WorkPlayer {props:WorkProps;clip:T.AnimationClip;update:(dt:number)=>void;seek:(phase:number)=>void;replay:()=>void;status:()=>WorkStatus;setContacts:(on:boolean)=>void;dispose:()=>void}
export function visibleRecipe(recipe:Recipe,id:WorkId|'none'):Recipe {
  if(id==='none')return recipe;const slots={...recipe.slots};for(const slot of ACTIONS[id].occupied)slots[slot]='none';return {...recipe,slots};
}
/** 角色配方不被工作道具覆盖。占用手/背槽只影响预览，退出劳动动作立即恢复。 */
export function createWorkPlayer(actor:Actor,id:WorkId,recipe:Recipe):WorkPlayer {
  const def=ACTIONS[id],props=createWorkProps(id,recipe);actor.mesh.add(props.group);
  const clip=bakeWork(actor.data.joints,recipe,id);play();
  function play(){actor.mixer.stopAllAction();const action=actor.mixer.clipAction(clip);action.reset().stopFading().stopWarping().setEffectiveWeight(1).setEffectiveTimeScale(1);action.setLoop(def.loop?T.LoopRepeat:T.LoopOnce,def.loop?Infinity:1);action.clampWhenFinished=!def.loop;action.play();actor.action=action;actor.update(0);}
  let elapsed=0,eventCount=0,lastEvent='—',contacts=false,maxGripError=0;
  const markerGeometry=new T.SphereGeometry(.009,6,4),actualMaterial=new T.MeshBasicMaterial({color:'#edb15c',depthTest:false}),targetMaterial=new T.MeshBasicMaterial({color:'#6bddb4',depthTest:false});
  const actual=[0,1].map(()=>new T.Mesh(markerGeometry,actualMaterial)),targets=[0,1].map(()=>new T.Mesh(markerGeometry,targetMaterial));props.debug.add(...actual,...targets);props.debug.visible=false;
  const debugFrames=Array.from({length:121},(_,i)=>sampleWork(actor.data.joints,recipe,id,i/120).contacts);
  const sync=()=>{
    const phase=actor.action.time/def.duration;
    if(props.wheel)props.wheel.rotation.x=(id==='pull'?-1:1)*elapsed*(.54/1.3)/(WHEEL_RADIUS*(recipe.height/1.76));
    if(contacts){const frame=debugFrames[Math.min(120,Math.round(phase*120))];maxGripError=0;for(let i=0;i<2;i++){const c=frame[i];actual[i].visible=targets[i].visible=!!c;if(!c)continue;actor.mesh.updateMatrixWorld(true);actual[i].position.fromArray(c.offset).applyMatrix4(actor.bones[c.bone].matrixWorld);actor.mesh.worldToLocal(actual[i].position);targets[i].position.fromArray(c.point);maxGripError=Math.max(maxGripError,actual[i].position.distanceTo(targets[i].position));}}
  };
  const player:WorkPlayer={props,clip,update(dt){const delta=Number.isFinite(dt)?Math.max(0,dt):0;const next=def.loop?elapsed+delta:Math.min(def.duration,elapsed+delta);for(const e of crossedEvents(def,elapsed,next)){eventCount++;lastEvent=e.label;}elapsed=next;actor.update(delta);sync();},seek(phase){elapsed=T.MathUtils.clamp(Number.isFinite(phase)?phase:0,0,def.loop?.999999:1)*def.duration;play();actor.action.time=elapsed;actor.update(0);eventCount=0;lastEvent='定位不触发事件';sync();},replay(){elapsed=0;eventCount=0;lastEvent='—';play();sync();},status(){const phase=actor.action.time/def.duration;return {phase,stage:actionStage(id,phase),finished:!def.loop&&elapsed>=def.duration-1e-6,eventCount,lastEvent,propTriangles:props.triangles,maxGripError};},setContacts(value){contacts=value;props.debug.visible=value;sync();},dispose(){actor.mixer.stopAllAction();actor.mixer.uncacheClip(clip);props.debug.clear();markerGeometry.dispose();actualMaterial.dispose();targetMaterial.dispose();props.dispose();}};
  player.update(0);return player;
}
