import { useEffect, useRef } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeCharacter } from '../character/v3/outfit';
import { makeActor, type Actor } from '../character/v3/rig';
import { triCount } from '../character/v3/cage';
import { BODY_HEIGHT, type Recipe } from '../character/v3/types';
import {createMotionPlayer,loadMotion,type MotionPlayer,type MotionStatus} from '../character/motion/player';
import type { MotionSelection } from '../character/motion/catalog';

export interface PlaybackStatus { phase:number; stage:string; finished:boolean; motion?:MotionStatus; loading?:boolean; loadError?:string }
export type View = 'free' | 'front' | 'side' | 'back' | 'top' | 'three';
export type Display = 'beauty' | 'cage' | 'triangles' | 'clay' | 'unlit';
export interface Stats { triangles:number; bodyTriangles:number; vertices:number; gpuVertices:number; bones:number; replaced:number }
export interface ViewOptions {
  recipe:Recipe; motion:MotionSelection; compareSource:boolean; headAxes:boolean; restart:number;
  playing:boolean; speed:number; phase:number; loop:boolean; view:View; viewRevision:number;
  orthographic:boolean; display:Display; skeleton:boolean; grid:boolean;
}
interface Props { options:ViewOptions; onStats:(v:Stats)=>void; onPlayback:(v:PlaybackStatus)=>void; onError:(message:string)=>void }
interface Runtime {
  renderer:T.WebGLRenderer; scene:T.Scene; actor:Actor; motion?:MotionPlayer;
  selection:MotionSelection; generation:number; loading:boolean; loadError:string; desiredPhase:number; restart:number;
  builtRecipe:Recipe; pairPerspective:T.PerspectiveCamera; pairOrtho:T.OrthographicCamera;
  controls:OrbitControls; camera:T.Camera; perspective:T.PerspectiveCamera; ortho:T.OrthographicCamera; views:T.OrthographicCamera[];
  resize:()=>void; render:()=>void; grid:T.GridHelper; disposePlayer:()=>void; disposeActor:()=>void;
}
declare global { interface Window {
  __WANHU_REVIEW__?: { seek:(phase:number)=>void; stats:Stats; getStatus:()=>PlaybackStatus; focusHead:()=>void; focusHip:()=>void; focusTorso:()=>void; cameraState:()=>unknown; geometryId:()=>string };
  __WANHU_CAPTURE__?:()=>void; __WANHU_EXPORT_MOTION__?:()=>unknown;
} }
function actorStats(actor:Actor):Stats {
  const d=actor.data;
  return {triangles:triCount(d.surface),bodyTriangles:d.bodyTriangles,vertices:d.body.vertices.length,
    gpuVertices:actor.mesh.geometry.attributes.position.count,bones:d.joints.length,replaced:d.replacedTriangles};
}
export function CharacterViewport({options,onStats,onError,onPlayback}:Props) {
  const host=useRef<HTMLDivElement>(null), runtime=useRef<Runtime|null>(null), latest=useRef(options);
  const errorRef=useRef(onError), statsRef=useRef(onStats), playbackRef=useRef(onPlayback);
  latest.current=options; errorRef.current=onError; statsRef.current=onStats; playbackRef.current=onPlayback;
  useEffect(()=>{
    const el=host.current; if(!el)return;
    let disposed=false, frame=0, rt:Runtime|undefined, renderer:T.WebGLRenderer;
    const scene=new T.Scene();
    try { renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'}); }
    catch(error){errorRef.current(`无法创建 WebGL 预览：${String(error)}`);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap; el.appendChild(renderer.domElement);
    scene.add(new T.HemisphereLight('#ede9df','#52646d',2.1));
    const key=new T.DirectionalLight('#fff0d8',2.8); key.position.set(-2.5,4,5); key.castShadow=true;
    key.shadow.mapSize.set(1024,1024); key.shadow.camera.left=-1.5; key.shadow.camera.right=1.5;
    key.shadow.camera.top=2.2; key.shadow.camera.bottom=-1; key.shadow.bias=-.0005; scene.add(key);
    const fill=new T.DirectionalLight('#b5d7ed',1.05); fill.position.set(3,2,-2); scene.add(fill);
    const floor=new T.Mesh(new T.CircleGeometry(1.95,64),new T.MeshStandardMaterial({color:'#2e4147',roughness:1}));
    floor.rotation.x=-Math.PI/2; floor.position.y=-.003; floor.receiveShadow=true; scene.add(floor);
    const grid=new T.GridHelper(3.2,16,'#697b7d','#40585e'); grid.position.y=.002; scene.add(grid);
    const p=new T.PerspectiveCamera(33,1,.01,50), o=new T.OrthographicCamera(-1,1,1,-1,.01,50);
    const views=[0,1,2].map(()=>new T.OrthographicCamera(-1,1,1,-1,.01,50));
    const camera=latest.current.orthographic?o:p, controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true; controls.minDistance=1.4; controls.maxDistance=8; controls.minZoom=.55; controls.maxZoom=5;
    let actor:Actor;
    try { actor=makeActor(makeCharacter(latest.current.recipe)); }
    catch(error){renderer.dispose();renderer.domElement.remove();errorRef.current(String(error));return;}
    scene.add(actor.mesh,actor.wire,actor.skeletonHelper);
    const resize=()=>{
      if(!rt)return;
      const w=Math.max(1,el.clientWidth), h=Math.max(1,el.clientHeight), aspect=w/h;
      renderer.setSize(w,h,false); p.aspect=aspect; p.updateProjectionMatrix();
      const extent=rt.motion?.bake.bounds.getSize(new T.Vector3());
      const effectiveAspect=latest.current.compareSource&&rt.motion&&latest.current.view!=='three'?aspect/2:aspect;
      const width=extent?Math.max(extent.x,extent.z)*.56:BODY_HEIGHT[latest.current.recipe.bodyType]*.43;
      const half=Math.max(BODY_HEIGHT[latest.current.recipe.bodyType]*.67,extent?extent.y*.56:0,width/effectiveAspect);
      o.left=-half*aspect; o.right=half*aspect; o.top=half; o.bottom=-half; o.updateProjectionMatrix();
      for(const c of views){
        const threeHalf=Math.max(half,width/(aspect/3));
        c.left=-threeHalf*aspect/3; c.right=threeHalf*aspect/3; c.top=threeHalf; c.bottom=-threeHalf; c.updateProjectionMatrix();
      }
    };
    const render=()=>{
      if(!rt)return;
      const w=el.clientWidth,h=el.clientHeight;
      if(latest.current.compareSource&&rt.motion&&latest.current.view!=='three'){
        const pair=rt.camera instanceof T.OrthographicCamera?rt.pairOrtho.copy(rt.camera):rt.pairPerspective.copy(rt.camera as T.PerspectiveCamera);
        if(pair instanceof T.OrthographicCamera){pair.left/=2;pair.right/=2;}else pair.aspect/=2;
        pair.updateProjectionMatrix(); renderer.setScissorTest(true);
        for(let i=0;i<2;i++){
          const x=Math.floor(w*i/2),width=Math.floor(w*(i+1)/2)-x;
          renderer.setViewport(x,0,width,h);renderer.setScissor(x,0,width,h);renderer.render(i===0?rt.motion.sourceScene:scene,pair);
        }
      } else if(latest.current.view==='three'){
        renderer.setScissorTest(true);
        views.forEach((cam,i)=>{const x=Math.floor(w*i/3),width=Math.floor(w*(i+1)/3)-x;
          renderer.setViewport(x,0,width,h);renderer.setScissor(x,0,width,h);renderer.render(scene,cam);});
      } else renderer.render(scene,rt.camera);
      renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);
    };
    rt={renderer,scene,actor,selection:'none',generation:0,loading:false,loadError:'',desiredPhase:options.phase,restart:options.restart,
      pairPerspective:p.clone(),pairOrtho:o.clone(),builtRecipe:latest.current.recipe,controls,camera,perspective:p,ortho:o,views,resize,render,grid,
      disposePlayer(){if(!rt)return;rt.generation++;rt.motion?.dispose();rt.motion=undefined;},
      disposeActor(){if(!rt)return;rt.disposePlayer();scene.remove(rt.actor.mesh,rt.actor.wire,rt.actor.skeletonHelper);rt.actor.dispose();}};
    runtime.current=rt; applyCamera(rt,latest.current); applyDisplay(rt,latest.current);
    const stats=actorStats(actor);statsRef.current(stats);
    if(new URLSearchParams(location.search).has('review')||import.meta.env.DEV){
      window.__WANHU_REVIEW__={stats,seek(phase){if(rt)seek(rt,phase);},getStatus:()=>rt?playback(rt):{phase:0,stage:'',finished:false},
        cameraState:()=>rt?{position:rt.camera.position.toArray(),target:rt.controls.target.toArray(),projection:rt.camera.projectionMatrix.toArray()}:null,
        geometryId:()=>rt?.actor.mesh.geometry.uuid??'',focusHip(){if(!rt)return;
          const center=rt.actor.bones[1].getWorldPosition(new T.Vector3()).add(new T.Vector3(0,-.13,0));
          const direction=rt.camera.position.clone().sub(rt.controls.target).normalize();
          rt.controls.target.copy(center);rt.camera.position.copy(center).addScaledVector(direction,2);
          if(rt.camera instanceof T.OrthographicCamera){rt.camera.zoom=2.4;rt.camera.updateProjectionMatrix();}
          rt.camera.lookAt(center);rt.controls.update();rt.render();
        },focusTorso(){if(!rt)return;
          const center=rt.actor.bones[3].getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.01,0));
          const direction=rt.camera.position.clone().sub(rt.controls.target).normalize();
          rt.controls.target.copy(center);rt.camera.position.copy(center).addScaledVector(direction,2);
          if(rt.camera instanceof T.OrthographicCamera){rt.camera.zoom=2.2;rt.camera.updateProjectionMatrix();}
          rt.camera.lookAt(center);rt.controls.update();rt.render();
        },focusHead(){if(!rt)return;
          const center=rt.actor.bones[5].getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.1*BODY_HEIGHT[latest.current.recipe.bodyType]/1.76,0));
          const direction=rt.camera.position.clone().sub(rt.controls.target).normalize();
          rt.controls.target.copy(center);rt.camera.position.copy(center).addScaledVector(direction,2);
          if(rt.camera instanceof T.OrthographicCamera){rt.camera.zoom=3;rt.camera.updateProjectionMatrix();}
          rt.camera.lookAt(center);rt.controls.update();rt.render();}};
    }
    const observer=new ResizeObserver(resize);observer.observe(el);resize();let last=performance.now(),lastReport=0;
    const animate=(now:number)=>{
      if(disposed||!rt)return;
      const dt=Math.min(.05,(now-last)/1000);last=now;rt.controls.update();
      if(rt.motion)rt.motion.update(latest.current.playing?dt*latest.current.speed:0);else rt.actor.update(0);
      if(now-lastReport>80){playbackRef.current(playback(rt));lastReport=now;}
      render();frame=requestAnimationFrame(animate);
    };frame=requestAnimationFrame(animate);
    const lost=(event:Event)=>{event.preventDefault();errorRef.current('WebGL 上下文丢失，请刷新页面。');};
    renderer.domElement.addEventListener('webglcontextlost',lost);
    window.__WANHU_EXPORT_MOTION__=()=>rt?.motion?.export();
    window.__WANHU_CAPTURE__=()=>{render();renderer.domElement.toBlob(blob=>{
      if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;
      link.download=`wanhu-${latest.current.recipe.bodyType}-${latest.current.motion==='none'?'bind':latest.current.motion}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });};
    return()=>{
      disposed=true;cancelAnimationFrame(frame);observer.disconnect();rt?.controls.dispose();rt?.disposeActor();
      floor.geometry.dispose();(floor.material as T.Material).dispose();grid.geometry.dispose();
      for(const material of Array.isArray(grid.material)?grid.material:[grid.material])material.dispose();
      key.shadow.map?.dispose();renderer.dispose();renderer.domElement.remove();runtime.current=null;
      delete window.__WANHU_REVIEW__;delete window.__WANHU_CAPTURE__;delete window.__WANHU_EXPORT_MOTION__;
    };
  },[]);
  useEffect(()=>{
    const r=runtime.current;if(!r)return;
    const recipeChanged=r.builtRecipe!==options.recipe, selectionChanged=r.selection!==options.motion, restarted=r.restart!==options.restart;
    const keepCamera=recipeChanged && r.builtRecipe.bodyType===options.recipe.bodyType;
    r.restart=options.restart;
    if(!recipeChanged&&!selectionChanged&&!(restarted&&r.loadError)){
      if(restarted){r.desiredPhase=0;r.motion?.replay();playbackRef.current(playback(r));}
      return;
    }
    // 换 FBX 不重建模型；改 Recipe 才重建几何。异步代次阻止过期资源覆盖当前选择。
    const phase=!selectionChanged&&!restarted?playback(r).phase:options.phase;
    try{
      if(recipeChanged){r.disposeActor();r.actor=makeActor(makeCharacter(options.recipe));r.builtRecipe=options.recipe;r.scene.add(r.actor.mesh,r.actor.wire,r.actor.skeletonHelper);}
      else {r.disposePlayer();r.actor.resetBindPose();}
      r.selection=options.motion;r.desiredPhase=phase;r.loading=options.motion!=='none';r.loadError='';
      applyDisplay(r,options);if(!keepCamera)applyCamera(r,options);r.resize();
      const stats=actorStats(r.actor);statsRef.current(stats);if(window.__WANHU_REVIEW__)window.__WANHU_REVIEW__.stats=stats;
      playbackRef.current(playback(r));
      if(options.motion!=='none'){
        const generation=r.generation,actor=r.actor;
        loadMotion(options.motion).then(source=>{
          if(runtime.current!==r||r.generation!==generation)return;
          r.motion=createMotionPlayer(actor,source);r.motion.setLoop(latest.current.loop);r.scene.add(r.motion.targetDebug);r.loading=false;
          r.motion.seek(r.desiredPhase);applyDisplay(r,latest.current);if(!keepCamera)applyCamera(r,latest.current);r.resize();playbackRef.current(playback(r));
        }).catch(error=>{if(runtime.current!==r||r.generation!==generation)return;r.loading=false;r.loadError=String(error);playbackRef.current(playback(r));});
      }
    }catch(error){errorRef.current(String(error));}
  },[options.recipe,options.motion,options.restart]);
  useEffect(()=>{const r=runtime.current;if(r&&!options.playing)seek(r,options.phase);},[options.phase]);
  useEffect(()=>{const r=runtime.current;if(r?.motion){r.motion.setLoop(options.loop);playbackRef.current(playback(r));}},[options.loop]);
  useEffect(()=>{const r=runtime.current;if(r){applyCamera(r,options);r.resize();}},[options.view,options.viewRevision,options.orthographic,options.motion,options.compareSource]);
  useEffect(()=>{const r=runtime.current;if(r)applyDisplay(r,options);},[options.display,options.skeleton,options.grid,options.headAxes]);
  return <div ref={host} className="character-viewport" data-testid="viewport"/>;
}
function applyDisplay(r:Runtime,o:ViewOptions){
  const material=r.actor.beautyMaterial;
  r.actor.mesh.material=o.display==='unlit'?r.actor.unlitMaterial:material;
  material.wireframe=o.display==='triangles';material.vertexColors=o.display!=='clay';material.color.set(o.display==='clay'?'#c2b49c':'#ffffff');
  material.polygonOffset=o.display==='cage';material.polygonOffsetFactor=1;material.polygonOffsetUnits=1;material.needsUpdate=true;
  r.actor.wire.visible=o.display==='cage';r.actor.skeletonHelper.visible=o.skeleton;r.grid.visible=o.grid;
  r.motion?.setHeadAxes(o.headAxes);if(r.motion)r.motion.update(0);else r.actor.update(0);
}
function applyCamera(r:Runtime,o:ViewOptions){
  const next=o.orthographic?r.ortho:r.perspective;
  if(r.camera!==next){r.controls.dispose();r.camera=next;r.controls=new OrbitControls(next,r.renderer.domElement);
    r.controls.enableDamping=true;r.controls.minDistance=1.4;r.controls.maxDistance=8;r.controls.minZoom=.55;r.controls.maxZoom=5;}
  const y=BODY_HEIGHT[o.recipe.bodyType]*.53,target=r.motion?r.motion.bake.bounds.getCenter(new T.Vector3()):new T.Vector3(0,y,0);
  next.up.set(0,1,0);if(next instanceof T.OrthographicCamera)next.zoom=o.view==='top'?1.7:1;
  const position=o.view==='front'?[0,y,4]:o.view==='back'?[0,y,-4]:o.view==='side'?[4,y,0]:o.view==='top'?[0,5,.001]:[2.8,y+1.05,4.5];
  next.position.fromArray(position).add(new T.Vector3(target.x,target.y-y,target.z));
  if(o.view==='top')next.up.set(0,0,-1);next.lookAt(target);r.controls.target.copy(target);r.controls.enabled=o.view!=='three';r.controls.update();
  r.views.forEach((c,i)=>{c.position.set(...(i===0?[0,0,4]:i===1?[4,0,0]:[0,0,-4]) as [number,number,number]);c.position.add(target);c.lookAt(target);});
}
function playback(r:Runtime):PlaybackStatus{
  if(r.motion){const status=r.motion.status();return {...status,motion:status};}
  return {phase:r.loading?r.desiredPhase:0,stage:r.loading?'正在载入外部动作':r.loadError?'动画载入失败':'静态绑定姿态',loading:r.loading,loadError:r.loadError,finished:false};
}
function seek(r:Runtime,phase:number){r.desiredPhase=T.MathUtils.clamp(Number.isFinite(phase)?phase:0,0,1);r.motion?.seek(r.desiredPhase);r.render();}
