import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import type { MotionDefinition } from '../livestock/types';
import { DOG_BONES as B, DOG_JOINTS, DOG_LEGS, dogSole } from './rig';

export const DOG_ANIMATION_VERSION='wanhu-rural-dog-motion-v2';
export const DOG_MOTIONS: readonly MotionDefinition[] = [
  {id:'idle',label:'停驻',description:'站立观察，轻微呼吸、侧顾和摆尾。',duration:4,surface:'land'},
  {id:'walk',label:'行走',description:'轻快四拍短步，支撑脚后扫、摆动脚前送。',duration:.8,surface:'land'},
  {id:'run',label:'奔跑',description:'微错相对角快跑，低起伏，不加入日常混合。',duration:.5,surface:'land'},
  {id:'sniff',label:'闻地',description:'降颈低头近地闻嗅，四脚留在原位。',duration:4,surface:'land'},
  {id:'bark',label:'警戒吠叫',description:'抬头、颈部与胸部短促发力，不做下巴骨或音效。',duration:2,surface:'land'},
  {id:'sleep',label:'睡觉',description:'低伏收腿、头部放低，原地缓慢呼吸；仅显式预览。',duration:3,surface:'land'},
];
const smooth=(a:number,b:number,p:number)=>{const t=Math.max(0,Math.min(1,(p-a)/(b-a)));return t*t*(3-2*t);};
/** 犬自己的作者曲线。单段腿的足底补偿只在轨道创建时烘焙，不是运行时腿IK。 */
export function authorDogPose(motion:string,phase:number) {
  if(!DOG_MOTIONS.some(m=>m.id===motion))throw new Error(`未知犬动作：${motion}`);
  const p=Math.max(0,Math.min(1,Number.isFinite(phase)?phase:0)),a=p*Math.PI*2;
  const rotations=DOG_JOINTS.map(()=>[0,0,0]),offsets=DOG_JOINTS.map(()=>[0,0,0]);
  rotations[B.Tail][1]=.10*Math.sin(a);rotations[B.Tail][2]=.035*Math.sin(a);
  if(motion==='sleep') {
    // 胸腹低伏，前腿前伸、后腿收向腹下；用原单段腿，不新增脚掌或脊柱骨。
    // 头部落在前足之间，弯尾后放收低；足端不随呼吸滑动。
    const drop=.284;
    offsets[B.Body][1]=-drop+.0012*(1-Math.cos(a));
    rotations[B.Neck][0]=.50;offsets[B.Neck][1]=-.125;
    rotations[B.Head][0]=-.22;rotations[B.Tail]=[-1.45,0,.16];
    // 绕实际嵌入尾根收尾，不让低档尾根跟随骨枢轴旋转后露出主壳。
    const tailRoot=new Vector3(0,.565,-.360).sub(new Vector3(...DOG_JOINTS[B.Tail].position));
    const tailRotation=new Quaternion().setFromEuler(new Euler(...rotations[B.Tail] as [number,number,number]));
    offsets[B.Tail]=tailRoot.clone().sub(tailRoot.clone().applyQuaternion(tailRotation)).toArray();
    for(const bone of DOG_LEGS) {
      const joint=new Vector3(...DOG_JOINTS[bone].position),front=bone<=B.FrontLegR,side=Math.sign(joint.x);
      const anchor=new Vector3(side*(front?.070:.055),front?.535:.520,front?.125:-.235);
      const angle=front?-1.04:-1.29,q=new Quaternion().setFromEuler(new Euler(angle,0,0));
      const target=joint.clone().sub(anchor).applyQuaternion(q).add(anchor);target.y-=drop;
      const sole=dogSole(bone).map(p=>new Vector3(...p).sub(joint).applyQuaternion(q).add(target));
      target.y+=.007-Math.min(...sole.map(p=>p.y));
      rotations[bone][0]=angle;offsets[bone]=target.sub(joint).toArray();
    }
  } else if(motion==='walk'||motion==='run') {
    const run=motion==='run',stride=run?.30:.18,stance=run?.54:.64;
    rotations[B.Body][0]=run?.024:.008;rotations[B.Body][2]=(run?.012:.007)*Math.sin(a);
    offsets[B.Body][1]=(run?.005:.002)*Math.sin(2*a);
    rotations[B.Neck][0]=run?.055:.015;rotations[B.Head][0]=-rotations[B.Neck][0]*.6;
    const shifts=run?[0,.5,.52,.02]:[0,.5,.75,.25];
    for(let i=0;i<DOG_LEGS.length;i++) {
      const bone=DOG_LEGS[i],joint=DOG_JOINTS[bone].position,t=(p+shifts[i])%1;
      const swing=t>=stance,u=swing?(t-stance)/(1-stance):t/stance;
      const z=stride*(swing?-.5*Math.cos(Math.PI*u):.5-u),angle=-Math.asin(z/(joint[1]-.007));
      rotations[bone][0]=angle;
      const floor=Math.min(...dogSole(bone).map(([,y,z])=>joint[1]+(y-joint[1])*Math.cos(angle)-(z-joint[2])*Math.sin(angle)));
      offsets[bone][1]=.007+(swing?Math.sin(Math.PI*u)*(run?.055:.035):0)-floor;
    }
  } else if(motion==='sniff') {
    const dip=smooth(.06,.32,p)*(1-smooth(.74,.96,p));
    rotations[B.Neck][0]=1.10*dip;offsets[B.Neck][1]=-.15*dip;
    rotations[B.Head][0]=.22*dip;rotations[B.Head][1]=.065*Math.sin(3*a)*dip;
    rotations[B.Tail][1]=.06*Math.sin(a);
  } else if(motion==='bark') {
    const alert=Math.sin(Math.PI*p)**2;
    const pulse=Math.max(0,Math.sin(3*a))**4*alert;
    rotations[B.Neck][0]=-.14*alert+.07*pulse;
    rotations[B.Head][0]=-.06*alert-.05*pulse;
    rotations[B.Body][0]=-.008*pulse;offsets[B.Body][1]=.003*pulse;
    rotations[B.Tail][1]=.05*Math.sin(a)*alert;
  } else {
    offsets[B.Body][1]=.0018*Math.sin(a);
    rotations[B.Neck][0]=.009*Math.sin(a);
    rotations[B.Head][1]=.07*Math.sin(a)*Math.sin(Math.PI*p)**2;
  }
  return {rotations,offsets};
}
export function bakeDogClips():Map<string,AnimationClip> {
  return new Map(DOG_MOTIONS.map(motion=>{
    const frames=Math.round(motion.duration*30),times=Array.from({length:frames+1},(_,i)=>i*motion.duration/frames);
    const poses=times.map((_,i)=>authorDogPose(motion.id,i/frames));
    const tracks=DOG_JOINTS.flatMap((joint,index)=>{
      const parent=joint.parent<0?[0,0,0]:DOG_JOINTS[joint.parent].position,local=joint.position.map((v,i)=>v-parent[i]);
      return [new VectorKeyframeTrack(`${joint.name}.position`,times,poses.flatMap(p=>local.map((v,i)=>v+p.offsets[index][i]))),
        new QuaternionKeyframeTrack(`${joint.name}.quaternion`,times,poses.flatMap(p=>new Quaternion().setFromEuler(new Euler(...p.rotations[index] as [number,number,number])).toArray()))];
    });
    return [motion.id,new AnimationClip(`Dog_${motion.id}`,motion.duration,tracks)];
  }));
}
