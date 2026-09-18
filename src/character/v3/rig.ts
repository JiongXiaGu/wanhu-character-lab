import * as T from 'three';
import { B, type CharacterData, type Joint, type Motion } from './types';
import {polygonNormal,edgeKey} from './cage';
export interface Actor { mesh:T.SkinnedMesh; skeleton:T.Skeleton; bones:T.Bone[]; mixer:T.AnimationMixer; clips:Record<Motion,T.AnimationClip>; action:T.AnimationAction; wire:T.LineSegments; skeletonHelper:T.SkeletonHelper; data:CharacterData; setMotion:(m:Motion)=>void; update:(dt:number)=>void; dispose:()=>void; seek:(time:number)=>void }
/** GPU 蒙皮采用 Three.js 官方 SkinnedMesh 路径。逻辑顶点和渲染法线拆点分别计数。 */
export function makeActor(data:CharacterData):Actor {
  const p:number[]=[],n:number[]=[],col:number[]=[],si:number[]=[],sw:number[]=[],ix:number[]=[];
  const c=data.surface, color=new T.Color();
  for(const f of c.faces) {
    const start=p.length/3,normal=polygonNormal(c,f);color.set(f.color??'#b79773');
    for(const vi of f.v) {const v=c.vertices[vi];p.push(...v.p);n.push(...normal);col.push(color.r,color.g,color.b);si.push(v.w[0],v.w[1],0,0);sw.push(v.w[2],1-v.w[2],0,0);}
    for(let i=1;i<f.v.length-1;i++)ix.push(start,start+i,start+i+1);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(n,3));geometry.setAttribute('color',new T.Float32BufferAttribute(col,3));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));geometry.setIndex(ix);
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0});
  const mesh=new T.SkinnedMesh(geometry,material);mesh.name='WanhuCharacter';mesh.castShadow=true;mesh.receiveShadow=false;
  const bones=data.joints.map(j=>{const b=new T.Bone();b.name=j.name;return b;});
  data.joints.forEach((j,i)=>{const parent=j.parent<0?[0,0,0]:data.joints[j.parent].p;bones[i].position.set(j.p[0]-parent[0],j.p[1]-parent[1],j.p[2]-parent[2]);if(j.parent>=0)bones[j.parent].add(bones[i]);else mesh.add(bones[i]);});
  mesh.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);mesh.bind(skeleton);mesh.normalizeSkinWeights();
  // 固定安全包围盒涵盖已实现的动作。不能只使用 Bind Pose 包围盒剔除动画。
  mesh.boundingSphere=new T.Sphere(new T.Vector3(0,data.recipe.height*.5,0),data.recipe.height*1.4);
  const mixer=new T.AnimationMixer(mesh),clips=makeClips(data.joints);let action=mixer.clipAction(clips.idle);action.play();
  const edges=new Map<string,[number,number]>();for(const f of c.faces)f.v.forEach((v,i)=>{const b=f.v[(i+1)%f.v.length];edges.set(edgeKey(v,b),[v,b]);});
  const edgeList=[...edges.values()];const wireGeo=new T.BufferGeometry();const wp=new Float32Array(edgeList.length*6);wireGeo.setAttribute('position',new T.BufferAttribute(wp,3).setUsage(T.DynamicDrawUsage));const wireMat=new T.LineBasicMaterial({color:'#1d2522',transparent:true,opacity:.75,depthTest:true});const wire=new T.LineSegments(wireGeo,wireMat);wire.visible=false;wire.renderOrder=2;wire.frustumCulled=false;
  const helper=new T.SkeletonHelper(mesh);helper.visible=false;helper.renderOrder=4;(helper.material as T.LineBasicMaterial).depthTest=false;
  const skinned=c.vertices.map(()=>new T.Vector3()),temp=new T.Vector3();const matrices=bones.map(()=>new T.Matrix4());
  const debug=()=>{mesh.updateMatrixWorld(true);skeleton.update();if(wire.visible){for(let i=0;i<bones.length;i++)matrices[i].multiplyMatrices(bones[i].matrixWorld,skeleton.boneInverses[i]);c.vertices.forEach((v,i)=>{skinned[i].fromArray(v.p).applyMatrix4(matrices[v.w[0]]).multiplyScalar(v.w[2]);temp.fromArray(v.p).applyMatrix4(matrices[v.w[1]]).multiplyScalar(1-v.w[2]);skinned[i].add(temp);});edgeList.forEach(([a,b],i)=>{skinned[a].toArray(wp,i*6);skinned[b].toArray(wp,i*6+3);});wireGeo.attributes.position.needsUpdate=true;} };
  const actor:Actor={mesh,skeleton,bones,mixer,clips,action,wire,skeletonHelper:helper,data,setMotion(m){const next=mixer.clipAction(clips[m]);if(next===action)return;action.fadeOut(.18);next.reset().fadeIn(.18).play();action=next;actor.action=action;},update(dt){mixer.update(dt);debug();},seek(t){mixer.stopAllAction();action.reset().play();action.time=t%action.getClip().duration;mixer.update(0);debug();},dispose(){mixer.stopAllAction();mixer.uncacheRoot(mesh);geometry.dispose();material.dispose();wireGeo.dispose();wireMat.dispose();helper.geometry.dispose();(helper.material as T.Material).dispose();skeleton.dispose();}};
  actor.update(0);return actor;
}
export const MOTION_LABELS:Record<Motion,string>={idle:'待机',walk:'行走',run:'慢跑',wave:'招手',squat:'屈膝',bind:'基准 A 姿态'};
/** 只在构建角色时采样 Clip；运行时不重建 Mesh，不逐帧改顶点。 */
function makeClips(j:Joint[]):Record<Motion,T.AnimationClip> {
  const result={} as Record<Motion,T.AnimationClip>,q=new T.Quaternion(),scale=j[B.Head].p[1]/1.52;
  for(const name of Object.keys(MOTION_LABELS) as Motion[]) {
    const duration=name==='walk'?1.1:name==='run'?.72:name==='bind'?1:3.2, count=Math.round(duration*30);
    const times:number[]=[],rot=j.map(()=>[] as number[]),hips:number[]=[];
    for(let f=0;f<=count;f++) {
      const phase=f/count, t=phase*Math.PI*2;times.push(phase*duration);const angles=j.map(()=>[0,0,0]);let dy=0;
      if(name!=='bind') {
        angles[B.RightUpperArm][2]=-.37;angles[B.LeftUpperArm][2]=.37;
        angles[B.RightForearm][0]=-.06;angles[B.LeftForearm][0]=-.06;
        if(name==='idle') {dy=.002*Math.sin(t);angles[B.Chest][0]=.014*Math.sin(t);angles[B.Head][1]=.04*Math.sin(t);}
        if(name==='walk'||name==='run'||name==='squat') {
          const squat=name==='squat'?(1-Math.cos(t))*.5:0;
          dy=name==='squat'?-.25*squat:name==='run'?-.055+.012*Math.cos(t*2):-.026+.006*Math.cos(t*2);
          for(const [thigh,shin,foot,s] of [[B.RightThigh,B.RightShin,B.RightFoot,1],[B.LeftThigh,B.LeftShin,B.LeftFoot,-1]]) {
            const local=t+(s===1?0:Math.PI),stride=name==='run'?.22:.14;
            const z=name==='squat'?0:Math.cos(local)*stride*scale;
            const lift=name==='squat'?0:Math.max(0,Math.sin(local))*(name==='run'?.105:.045)*scale;
            const l1=j[thigh].p[1]-j[shin].p[1],l2=j[shin].p[1]-j[foot].p[1];const down=l1+l2+dy*scale-lift;
            const d=Math.min(l1+l2-.00001,Math.hypot(down,z)),a=Math.acos(T.MathUtils.clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1)),k=Math.PI-Math.acos(T.MathUtils.clamp((l1*l1+l2*l2-d*d)/(2*l1*l2),-1,1));
            angles[thigh][0]=-Math.atan2(z,down)-a;angles[shin][0]=k;angles[foot][0]=-angles[thigh][0]-k;
          }
          if(name==='squat'){angles[B.Chest][0]=.18*squat;angles[B.RightUpperArm][0]=-.45*squat;angles[B.LeftUpperArm][0]=-.45*squat;}
          else {angles[B.RightUpperArm][0]=-.32*Math.cos(t);angles[B.LeftUpperArm][0]=.32*Math.cos(t);angles[B.RightForearm][0]=name==='run'?-.75:-.15;angles[B.LeftForearm][0]=name==='run'?-.75:-.15;angles[B.Chest][1]=.06*Math.cos(t);}
        }
        if(name==='wave') {const raise=.5-.5*Math.cos(t);angles[B.RightUpperArm][2]=-.37+1.65*raise;angles[B.RightForearm][0]=-.85*raise;angles[B.RightForearm][2]=.3*raise;angles[B.RightHand][2]=.35*Math.sin(t*3)*raise;angles[B.Head][2]=-.06*raise;}
      }
      for(let i=0;i<j.length;i++){q.setFromEuler(new T.Euler(...angles[i] as [number,number,number],'XYZ'));rot[i].push(q.x,q.y,q.z,q.w);}
      const hp=j[B.Hips].p;hips.push(hp[0],hp[1]+dy*scale,hp[2]);
    }
    const tracks:T.KeyframeTrack[]=j.map((bone,i)=>new T.QuaternionKeyframeTrack(`${bone.name}.quaternion`,times,rot[i]));tracks.push(new T.VectorKeyframeTrack('Hips.position',times,hips));result[name]=new T.AnimationClip(name,duration,tracks);
  }
  return result;
}
