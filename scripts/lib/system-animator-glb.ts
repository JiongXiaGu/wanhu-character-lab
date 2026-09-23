import * as T from 'three';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {basename,resolve} from 'node:path';
import {MOTION_SCHEMA,SAMPLE_BONES,SAMPLE_BONE_COUNT,SAMPLE_PARENTS,type HumanoidMotionData,validateMotionData} from '../../src/character/motion/data';

type Json=Record<string,any>;
const rounded=(v:number)=>+v.toFixed(7);
const components:Record<string,number>={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};

function parseGlb(bytes:Buffer){
  if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2)throw new Error('需要 glTF 2.0 GLB。');
  let offset=12,json:Json|undefined,bin:Buffer|undefined;
  while(offset<bytes.length){const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);offset+=8;const chunk=bytes.subarray(offset,offset+length);offset+=length;if(type===0x4e4f534a)json=JSON.parse(chunk.toString('utf8').replace(/\0+$/,''));else if(type===0x004e4942)bin=chunk;}
  if(!json||!bin)throw new Error('GLB 缺少 JSON 或 BIN chunk。');return{json,bin};
}
function accessor(json:Json,bin:Buffer,index:number):number[][]{
  const a=json.accessors[index],view=json.bufferViews[a.bufferView];if(a.componentType!==5126)throw new Error('SystemAnimator 动画只接受 FLOAT accessor。');
  const n=components[a.type];if(!n)throw new Error('未知 accessor 类型 '+a.type);
  const stride=view.byteStride??n*4,start=(view.byteOffset??0)+(a.byteOffset??0),rows:number[][]=[];
  for(let i=0;i<a.count;i++){const row=[];for(let c=0;c<n;c++)row.push(bin.readFloatLE(start+i*stride+c*4));rows.push(row);}return rows;
}
function localMatrix(node:Json,t?:number[],r?:number[],s?:number[]){
  if(node.matrix&&!t&&!r&&!s)return new T.Matrix4().fromArray(node.matrix);
  const p=new T.Vector3().fromArray(t??node.translation??[0,0,0]),q=new T.Quaternion().fromArray(r??node.rotation??[0,0,0,1]),scale=new T.Vector3().fromArray(s??node.scale??[1,1,1]);return new T.Matrix4().compose(p,q,scale);
}
function sample(times:number[][],values:number[][],time:number,path:string,interpolation:string){
  if(interpolation!=='LINEAR'&&interpolation!=='STEP')throw new Error('不支持的 GLB 动画插值 '+interpolation);
  if(time<=times[0][0])return values[0];if(time>=times.at(-1)![0])return values.at(-1)!;
  let lo=0,hi=times.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(times[mid][0]<=time)lo=mid;else hi=mid;}
  if(interpolation==='STEP')return values[lo];const a=(time-times[lo][0])/(times[hi][0]-times[lo][0]);
  if(path==='rotation'){const qa=new T.Quaternion().fromArray(values[lo]),qb=new T.Quaternion().fromArray(values[hi]);return qa.slerp(qb,a).normalize().toArray();}
  return values[lo].map((v,i)=>v+(values[hi][i]-v)*a);
}
export function extractSystemAnimatorGlb(id:string,filename:string,rootDirectory='动画参考_glb'):HumanoidMotionData{
  const bytes=readFileSync(resolve(rootDirectory,filename)),{json,bin}=parseGlb(bytes),nodes:Json[]=json.nodes??[],animations:Json[]=json.animations??[];
  if(animations.length!==1)throw new Error(`${filename}: 需要明确的一条动画，实际 ${animations.length}。`);
  const animation=animations[0],parents=new Map<number,number>();nodes.forEach((n,i)=>(n.children??[]).forEach((c:number)=>parents.set(c,i)));
  const byName=new Map<string,number>();nodes.forEach((n,i)=>{if(n.name)byName.set(n.name,i);});
  const pick=(...names:string[])=>{for(const name of names){const i=byName.get(name);if(i!==undefined)return i;}throw new Error(`${filename}: 缺少必要骨骼 ${names.join(' / ')}`);};
  const actual:(number|null)[]=[null,pick('Hips'),pick('Spine'),pick('Spine3'),pick('Neck1','Neck'),pick('Head'),pick('RightShoulder'),pick('RightArm'),pick('RightForeArm'),pick('RightHand'),pick('LeftShoulder'),pick('LeftArm'),pick('LeftForeArm'),pick('LeftHand'),pick('RightUpLeg'),pick('RightLeg'),pick('RightFoot'),pick('LeftUpLeg'),pick('LeftLeg'),pick('LeftFoot'),null,pick('RightHandMiddle1','RightHandIndex1'),pick('LeftHandMiddle1','LeftHandIndex1'),pick('RightToeBase'),pick('LeftToeBase')];
  const bindLocal=nodes.map(n=>localMatrix(n)),bindWorld:(T.Matrix4|undefined)[]=new Array(nodes.length);
  const worldBind=(i:number):T.Matrix4=>bindWorld[i]??=(parents.has(i)?worldBind(parents.get(i)!).clone().multiply(bindLocal[i]):bindLocal[i].clone());
  const position=(matrix:T.Matrix4)=>new T.Vector3().setFromMatrixPosition(matrix),rotation=(matrix:T.Matrix4)=>new T.Quaternion().setFromRotationMatrix(new T.Matrix4().extractRotation(matrix));
  const hips=actual[1]!,head=actual[5]!,leftArm=actual[11]!,rightArm=actual[7]!,leftFoot=actual[19]!,rightFoot=actual[16]!,leftToe=actual[24]!,rightToe=actual[23]!;
  const up=position(worldBind(head)).sub(position(worldBind(hips))).normalize(),right=position(worldBind(rightArm)).sub(position(worldBind(leftArm)));right.addScaledVector(up,-right.dot(up)).normalize();
  const forward=position(worldBind(leftToe)).sub(position(worldBind(leftFoot)).add(position(worldBind(rightToe)).sub(position(worldBind(rightFoot)));forward.addScaledVector(up,-forward.dot(up)).addScaledVector(right,-forward.dot(right)).normalize();
  if(right.lengthSq()<.99||forward.lengthSq()<.99)throw new Error(`${filename}: 无法确定人体坐标轴。`);
  const conversion=new T.Matrix4().makeBasis(right,up,forward).invert(),inverseConversion=conversion.clone().invert();
  const tracks=new Map<string,{times:number[][];values:number[][];path:string;interpolation:string}>();
  let duration=0;
  for(const channel of animation.channels??[]){const path=channel.target.path;if(path!=='translation'&&path!=='rotation')continue;const sampler=animation.samplers[channel.sampler],times=accessor(json,bin,sampler.input),values=accessor(json,bin,sampler.output);duration=Math.max(duration,times.at(-1)![0]);tracks.set(`${channel.target.node}:${path}`,{times,values,path,interpolation:sampler.interpolation??'LINEAR'});}
  if(duration<=0||duration>120)throw new Error(`${filename}: 动画时长无效。`);
  const fps=30,frameCount=Math.ceil(duration*fps),times:number[]=[];for(let f=0;f<=frameCount;f++){const time=f===frameCount?duration:Math.min(f/fps,duration);if(!times.length||time>times.at(-1)!)times.push(time);}
  function animatedLocal(i:number,time:number){const node=nodes[i],tt=tracks.get(`${i}:translation`),rt=tracks.get(`${i}:rotation`),t=tt?sample(tt.times,tt.values,time,'translation',tt.interpolation):undefined,r=rt?sample(rt.times,rt.values,time,'rotation',rt.interpolation):undefined;return localMatrix(node,t,r);}
  const restQ=actual.slice(0,20).map(i=>i===null?new T.Quaternion():rotation(worldBind(i)));
  const bindPositions:number[]=[];
  function canonicalPoint(matrix:T.Matrix4){return position(matrix).applyMatrix4(conversion);}
  for(let s=0;s<SAMPLE_BONE_COUNT;s++){let p:T.Vector3;if(s===0)p=new T.Vector3();else if(s===20){const hp=canonicalPoint(worldBind(head)),np=canonicalPoint(worldBind(pick('Neck1','Neck')));p=hp.clone().add(hp.clone().sub(np));}else p=canonicalPoint(worldBind(actual[s]!));bindPositions.push(...p.toArray().map(rounded));}
  const worldDeltas:number[]=[],positions:number[]=[],footMin:Record<string,number>={LeftFoot:Infinity,RightFoot:Infinity,LeftToeBase:Infinity,RightToeBase:Infinity};
  const currentQ=new T.Quaternion(),deltaQ=new T.Quaternion(),matrix=new T.Matrix4(),previous=Array.from({length:20},()=>new T.Quaternion());
  for(let f=0;f<times.length;f++){const time=times[f],memo:(T.Matrix4|undefined)[]=new Array(nodes.length);
    const world=(i:number):T.Matrix4=>memo[i]??=(parents.has(i)?world(parents.get(i)!).clone().multiply(animatedLocal(i,time)):animatedLocal(i,time));
    for(let s=0;s<SAMPLE_BONE_COUNT;s++){let p:T.Vector3;if(s===0)p=new T.Vector3();else if(s===20){const hp=canonicalPoint(world(head)),np=canonicalPoint(world(pick('Neck1','Neck')));p=hp.clone().add(hp.clone().sub(np));}else p=canonicalPoint(world(actual[s]!));positions.push(...p.toArray().map(rounded));}
    for(let i=0;i<20;i++){if(!i)deltaQ.identity();else{currentQ.copy(rotation(world(actual[i]!)));deltaQ.copy(currentQ).multiply(restQ[i].clone().invert());matrix.makeRotationFromQuaternion(deltaQ).premultiply(conversion).multiply(inverseConversion);deltaQ.setFromRotationMatrix(matrix).normalize();}if(f&&previous[i].dot(deltaQ)<0)deltaQ.set(-deltaQ.x,-deltaQ.y,-deltaQ.z,-deltaQ.w);previous[i].copy(deltaQ);worldDeltas.push(...deltaQ.toArray().map(rounded));}
    for(const [name,index] of [['LeftFoot',leftFoot],['RightFoot',rightFoot],['LeftToeBase',leftToe],['RightToeBase',rightToe]] as const)footMin[name]=Math.min(footMin[name],canonicalPoint(world(index)).y);
  }
  const data:HumanoidMotionData={schema:MOTION_SCHEMA,id,source:{provider:'XR Animator',format:'glb',profile:'system-animator-glb-v1',file:filename,sha256:createHash('sha256').update(bytes).digest('hex'),clipName:animation.name??basename(filename),uniqueBones:byName.size,rawBoneNodes:nodes.length,tracks:animation.channels?.length??0,threeVersion:T.REVISION,axisConversion:'scene/world bind → anatomical +X right / +Y up / +Z forward; meters; quaternion world-bind delta',extractorVersion:'system-animator-glb-v1'},duration,fps,times,names:[...SAMPLE_BONES],parents:[...SAMPLE_PARENTS],bindPositions,worldDeltas,positions,diagnostics:{bindHipsHeight:bindPositions[4],sourceFootMinY:Object.fromEntries(Object.entries(footMin).map(([k,v])=>[k,rounded(v)])),note:'Raw GLB only; no smoothing or foot lock in G1.'}};
  validateMotionData(data,id);return data;
}
