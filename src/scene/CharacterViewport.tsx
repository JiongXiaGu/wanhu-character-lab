import { useEffect, useRef } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { makeCharacter } from "../character/v3/outfit";
import { makeActor, type Actor } from "../character/v3/rig";
import { triCount } from "../character/v3/cage";
import type { Recipe, Motion } from "../character/v3/types";
import {createWorkPlayer,visibleRecipe,type WorkPlayer,type WorkStatus} from '../character/actions/player';
import {type WorkSelection} from '../character/actions/catalog';
import {workThreeViewHalfHeight} from '../character/actions/framing';
export interface PlaybackStatus extends WorkStatus { work: WorkSelection }
export type View = "free" | "front" | "side" | "back" | "top" | "three";
export type Display = "beauty" | "cage" | "triangles" | "clay";
export interface Stats {triangles:number;bodyTriangles:number;vertices:number;gpuVertices:number;bones:number;replaced:number}
export interface ViewOptions {recipe:Recipe;workAction:WorkSelection;restart:number;contacts:boolean;motion:Motion;playing:boolean;speed:number;phase:number;view:View;viewRevision:number;orthographic:boolean;display:Display;skeleton:boolean;grid:boolean}
interface Props {options:ViewOptions;onStats:(v:Stats)=>void;onPlayback:(v:PlaybackStatus)=>void;onError:(message:string)=>void}
interface Runtime {renderer:T.WebGLRenderer;scene:T.Scene;actor:Actor;work?:WorkPlayer;builtRecipe:Recipe;workSelection:WorkSelection;controls:OrbitControls;camera:T.Camera;perspective:T.PerspectiveCamera;ortho:T.OrthographicCamera;views:T.OrthographicCamera[];resize:()=>void;render:()=>void;grid:T.GridHelper;floor:T.Mesh;disposeActor:()=>void}
declare global {interface Window {__WANHU_REVIEW__?:{seek:(phase:number)=>void;stats:Stats;motion:Motion;work:WorkSelection;getStatus:()=>PlaybackStatus};__WANHU_CAPTURE__?:()=>void}}
export function CharacterViewport({options,onStats,onError,onPlayback}:Props) {
  const host=useRef<HTMLDivElement>(null),runtime=useRef<Runtime|null>(null),latest=useRef(options),errorRef=useRef(onError),statsRef=useRef(onStats),playbackRef=useRef(onPlayback),lastRestart=useRef(options.restart);
  playbackRef.current=onPlayback;latest.current=options;errorRef.current=onError;statsRef.current=onStats;
  useEffect(()=>{
    const el=host.current;if(!el)return;
    let disposed=false,frame=0,rt:Runtime|undefined;
    const scene=new T.Scene();let renderer:T.WebGLRenderer;
    try {renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch(error){errorRef.current(`无法创建 WebGL 预览：${String(error)}`);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;el.appendChild(renderer.domElement);
    scene.add(new T.HemisphereLight('#ede9df','#52646d',2.1));
    const key=new T.DirectionalLight('#fff0d8',2.8);key.position.set(-2.5,4,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-1.5;key.shadow.camera.right=1.5;key.shadow.camera.top=2.2;key.shadow.camera.bottom=-1;key.shadow.bias=-.0005;scene.add(key);
    const fill=new T.DirectionalLight('#b5d7ed',1.05);fill.position.set(3,2,-2);scene.add(fill);
    const floor=new T.Mesh(new T.CircleGeometry(1.95,64),new T.MeshStandardMaterial({color:'#2e4147',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
    const grid=new T.GridHelper(3.2,16,'#697b7d','#40585e');grid.position.y=.002;scene.add(grid);
    const p=new T.PerspectiveCamera(33,1,.01,50),o=new T.OrthographicCamera(-1,1,1,-1,.01,50),views=[0,1,2].map(()=>new T.OrthographicCamera(-1,1,1,-1,.01,50));
    const camera=latest.current.orthographic?o:p,controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=1.4;controls.maxDistance=8;controls.minZoom=.55;controls.maxZoom=5;controls.target.set(0,.94,0);
    let actor:Actor;
    try {actor=makeActor(makeCharacter(visibleRecipe(latest.current.recipe,latest.current.workAction)));}catch(e){renderer.dispose();renderer.domElement.remove();errorRef.current(String(e));return;}
    const work=latest.current.workAction==='none'?undefined:createWorkPlayer(actor,latest.current.workAction,latest.current.recipe);
    if(!work)actor.setMotion(latest.current.motion);
    if(!latest.current.playing){if(work)work.seek(latest.current.phase);else actor.seek(latest.current.phase*actor.action.getClip().duration);}
    scene.add(actor.mesh,actor.wire,actor.skeletonHelper);
    const resize=()=>{
      if(!rt)return;const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight),aspect=w/h;renderer.setSize(w,h,false);p.aspect=aspect;p.updateProjectionMatrix();
      const isWork=latest.current.workAction!=='none',half=latest.current.recipe.height*(isWork?.76:.64);
      o.left=-half*aspect;o.right=half*aspect;o.top=half;o.bottom=-half;o.updateProjectionMatrix();
      views.forEach(c=>{const threeHalf=workThreeViewHalfHeight(half,aspect,isWork);c.left=-threeHalf*aspect/3;c.right=threeHalf*aspect/3;c.top=threeHalf;c.bottom=-threeHalf;c.updateProjectionMatrix();});
    };
    const render=()=>{
      if(!rt)return;const w=el.clientWidth,h=el.clientHeight;
      if(latest.current.view==='three'){renderer.setScissorTest(true);views.forEach((cam,i)=>{const x=Math.floor(w*i/3),ww=Math.floor(w*(i+1)/3)-x;renderer.setViewport(x,0,ww,h);renderer.setScissor(x,0,ww,h);renderer.render(scene,cam);});renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);}else renderer.render(scene,rt.camera);
    };
    rt={renderer,scene,actor,work,builtRecipe:latest.current.recipe,workSelection:latest.current.workAction,controls,camera,perspective:p,ortho:o,views,resize,render,grid,floor,disposeActor(){if(!rt)return;scene.remove(rt.actor.mesh,rt.actor.wire,rt.actor.skeletonHelper);rt.work?.dispose();rt.actor.dispose();}};
    runtime.current=rt;applyCamera(rt,latest.current);applyDisplay(rt,latest.current);report(rt);
    const observer=new ResizeObserver(resize);observer.observe(el);resize();let last=performance.now(),lastReport=0;
    const animate=(now:number)=>{if(disposed||!rt)return;const dt=Math.min(.05,(now-last)/1000);last=now;rt.controls.update();const delta=latest.current.playing?dt*latest.current.speed:0;if(rt.work)rt.work.update(delta);else rt.actor.update(delta);if(now-lastReport>80){playbackRef.current(playback(rt));lastReport=now;}render();frame=requestAnimationFrame(animate);};frame=requestAnimationFrame(animate);
    const lost=(e:Event)=>{e.preventDefault();errorRef.current('WebGL 上下文丢失，请刷新页面。');};renderer.domElement.addEventListener('webglcontextlost',lost);
    window.__WANHU_CAPTURE__=()=>{render();renderer.domElement.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`wanhu-${latest.current.recipe.preset}-${latest.current.workAction==='none'?latest.current.motion:latest.current.workAction}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});};
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();rt?.controls.dispose();rt?.disposeActor();floor.geometry.dispose();(floor.material as T.Material).dispose();grid.geometry.dispose();const gm=grid.material;for(const m of Array.isArray(gm)?gm:[gm])m.dispose();renderer.dispose();renderer.domElement.remove();runtime.current=null;delete window.__WANHU_REVIEW__;delete window.__WANHU_CAPTURE__;};
    function report(r:Runtime){const d=r.actor.data,stats:Stats={triangles:triCount(d.surface),bodyTriangles:d.bodyTriangles,vertices:d.body.vertices.length,gpuVertices:r.actor.mesh.geometry.attributes.position.count,bones:d.joints.length,replaced:d.replacedTriangles};statsRef.current(stats);if(new URLSearchParams(location.search).has('review')||import.meta.env.DEV)window.__WANHU_REVIEW__={seek(phase){seek(r,phase);},stats,motion:latest.current.motion,work:latest.current.workAction,getStatus:()=>playback(r)};}
  },[]);
  useEffect(()=>{
    const r=runtime.current;if(!r||(r.builtRecipe===options.recipe&&r.workSelection===options.workAction))return;
    try {
      const preservedPhase=r.workSelection===options.workAction?playback(r).phase:options.phase;
      r.disposeActor();r.actor=makeActor(makeCharacter(visibleRecipe(options.recipe,options.workAction)));r.work=options.workAction==='none'?undefined:createWorkPlayer(r.actor,options.workAction,options.recipe);r.builtRecipe=options.recipe;r.workSelection=options.workAction;r.scene.add(r.actor.mesh,r.actor.wire,r.actor.skeletonHelper);
      if(!r.work)r.actor.setMotion(options.motion);seek(r,preservedPhase);applyDisplay(r,options);r.resize();
      const d=r.actor.data,stats:Stats={triangles:triCount(d.surface),bodyTriangles:d.bodyTriangles,vertices:d.body.vertices.length,gpuVertices:r.actor.mesh.geometry.attributes.position.count,bones:d.joints.length,replaced:d.replacedTriangles};statsRef.current(stats);
      if(window.__WANHU_REVIEW__){window.__WANHU_REVIEW__.stats=stats;window.__WANHU_REVIEW__.seek=phase=>seek(r,phase);window.__WANHU_REVIEW__.work=options.workAction;}
    }catch(e){errorRef.current(String(e));}
  },[options.recipe,options.workAction]);
  useEffect(()=>{const r=runtime.current;if(!r||r.work)return;r.actor.setMotion(options.motion);if(!options.playing)r.actor.seek(options.phase*r.actor.action.getClip().duration);if(window.__WANHU_REVIEW__)window.__WANHU_REVIEW__.motion=options.motion;},[options.motion]);
  useEffect(()=>{const r=runtime.current;if(r&&!options.playing)seek(r,options.phase);},[options.phase]);
  useEffect(()=>{if(lastRestart.current===options.restart)return;lastRestart.current=options.restart;const r=runtime.current;if(!r)return;if(r.work)r.work.replay();else r.actor.seek(0);},[options.restart]);
  useEffect(()=>{const r=runtime.current;if(r){applyCamera(r,options);r.resize();}},[options.view,options.viewRevision,options.orthographic,options.workAction]);
  useEffect(()=>{const r=runtime.current;if(r)applyDisplay(r,options);},[options.display,options.skeleton,options.grid,options.contacts]);
  return <div ref={host} className="character-viewport" data-testid="viewport"/>;
}
function applyDisplay(r:Runtime,o:ViewOptions){const mat=r.actor.mesh.material as T.MeshStandardMaterial;mat.wireframe=o.display==='triangles';mat.vertexColors=o.display!=='clay';mat.color.set(o.display==='clay'?'#c2b49c':'#ffffff');mat.polygonOffset=o.display==='cage';mat.polygonOffsetFactor=1;mat.polygonOffsetUnits=1;mat.needsUpdate=true;r.actor.wire.visible=o.display==='cage';r.actor.skeletonHelper.visible=o.skeleton;r.grid.visible=o.grid;if(r.work){r.work.setContacts(o.contacts);r.work.props.group.traverse(child=>{if(child instanceof T.Mesh&&child.material instanceof T.MeshStandardMaterial){child.material.wireframe=o.display==='triangles'||o.display==='cage';child.material.vertexColors=o.display!=='clay';child.material.color.set(o.display==='clay'?'#c2b49c':'#ffffff');child.material.needsUpdate=true;}});r.work.update(0);}else r.actor.update(0);}
function applyCamera(r:Runtime,o:ViewOptions){
  const next=o.orthographic?r.ortho:r.perspective;if(r.camera!==next){r.controls.dispose();r.camera=next;r.controls=new OrbitControls(next,r.renderer.domElement);r.controls.enableDamping=true;r.controls.minDistance=1.4;r.controls.maxDistance=8;r.controls.minZoom=.55;r.controls.maxZoom=5;}
  const y=o.recipe.height*.53,z=o.workAction==='push'?.42:o.workAction==='pull'?-.42:o.workAction==='hoe'?.36:o.workAction==='hammer'?.25:0,target=new T.Vector3(0,y,z);next.up.set(0,1,0);if(next instanceof T.OrthographicCamera)next.zoom=o.view==='top'?1.7:1;
  const p=o.view==='front'?[0,y,4]:o.view==='back'?[0,y,-4]:o.view==='side'?[4,y,0]:o.view==='top'?[0,5,.001]:[2.8,y+1.05,4.5];next.position.set(...p as [number,number,number]);next.position.z+=z;if(o.view==='top')next.up.set(0,0,-1);next.lookAt(target);r.controls.target.copy(target);r.controls.enabled=o.view!=='three';r.controls.update();r.views.forEach((c,i)=>{c.position.set(...(i===0?[0,y,4]:i===1?[4,y,0]:[0,y,-4]) as [number,number,number]);c.position.z+=z;c.lookAt(target);});
}
function playback(r:Runtime):PlaybackStatus{if(r.work)return {work:r.workSelection,...r.work.status()};return {work:'none',phase:r.actor.action.time/r.actor.action.getClip().duration,stage:'基础动作',finished:false,eventCount:0,lastEvent:'—',propTriangles:0,maxGripError:0};}
function seek(r:Runtime,phase:number){if(r.work)r.work.seek(phase);else r.actor.seek(phase*r.actor.action.getClip().duration);r.render();}
