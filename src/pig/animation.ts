import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import type { MotionDefinition } from '../livestock/types';
import { PIG_BONES as B, PIG_JOINTS, PIG_LEGS, PIG_SOLE } from './rig';

export const PIG_ANIMATION_VERSION = 'wanhu-domestic-pig-motion-v1';
export const PIG_MOTIONS: readonly MotionDefinition[] = [
  {id:'idle',label:'停驻',description:'厚身体轻微呼吸，头尾小范围活动。',duration:4,surface:'land'},
  {id:'walk',label:'行走',description:'四条短腿交错迈步，身体少量起伏。',duration:1.2,surface:'land'},
  {id:'run',label:'奔跑',description:'短步快跑，略向前倾；不加入日常混合。',duration:.6,surface:'land'},
  {id:'root',label:'拱地觅食',description:'低头让鼻盘接近地面，左右轻拱再抬头。',duration:6,surface:'land'},
  {id:'sniff',label:'闻嗅',description:'鼻部轻探，头部小幅闻嗅，四脚不动。',duration:3,surface:'land'},
];
const smooth=(a:number,b:number,p:number)=>{const x=Math.max(0,Math.min(1,(p-a)/(b-a)));return x*x*(3-2*x);};
/** 猪专用作者姿态；校正只在30fps轨道创建时执行，不增加运行时IK或根位移。 */
export function authorPigPose(motion:string,phase:number) {
  if(!PIG_MOTIONS.some(m=>m.id===motion)) throw new Error(`未知猪动作：${motion}`);
  const p=Math.max(0,Math.min(1,Number.isFinite(phase)?phase:0)),a=2*Math.PI*p;
  const rotations=PIG_JOINTS.map(()=>[0,0,0]),offsets=PIG_JOINTS.map(()=>[0,0,0]);
  rotations[B.Tail][1]=.04*Math.sin(a);rotations[B.Tail][2]=.018*Math.sin(a);
  if(motion==='walk'||motion==='run') {
    const running=motion==='run',stride=running?.23:.12,stance=running?.54:.64;
    rotations[B.Body][0]=running?.045:.008;rotations[B.Body][2]=(running?.015:.008)*Math.sin(a);
    offsets[B.Body][1]=(running?.005:.002)*Math.sin(2*a);
    rotations[B.Neck][0]=running?.06:.015;rotations[B.Head][0]=-.02;
    // 左后→左前→右后→右前的四拍步行；快跑为微错相的对角短步，不使用马轨道。
    const shifts=running?[0,.5,.52,.02]:[0,.5,.75,.25];
    for(let i=0;i<PIG_LEGS.length;i++) {
      const bone=PIG_LEGS[i],t=(p+shifts[i])%1,swing=t>=stance,u=swing?(t-stance)/(1-stance):t/stance;
      const z=stride*(swing?-.5*Math.cos(Math.PI*u):.5-u),angle=-Math.asin(z/.304);
      rotations[bone][0]=angle;
      const minY=Math.min(...PIG_SOLE.map(([,y,z])=>.310+(y-.310)*Math.cos(angle)-z*Math.sin(angle)));
      offsets[bone][1]=.006+(swing?Math.sin(Math.PI*u)*(running?.045:.028):0)-minY;
    }
  } else if(motion==='root') {
    const dip=smooth(.08,.34,p)*(1-smooth(.72,.94,p));
    rotations[B.Neck][0]=.47*dip;rotations[B.Head][0]=.10*dip;
    rotations[B.Head][1]=.075*Math.sin(4*a)*dip;rotations[B.Neck][1]=.025*Math.sin(2*a)*dip;
    offsets[B.Head][2]=.005*Math.sin(4*a)*dip;
  } else if(motion==='sniff') {
    const reach=Math.sin(Math.PI*p)**2;
    rotations[B.Neck][0]=-.025*reach;rotations[B.Head][0]=.035*Math.sin(3*a)*reach;
    rotations[B.Head][1]=.065*Math.sin(2*a)*reach;offsets[B.Head][2]=.009*reach;
  } else {
    offsets[B.Body][1]=.0015*Math.sin(a);rotations[B.Neck][0]=.006*Math.sin(a);
    rotations[B.Head][1]=.035*Math.sin(a)*Math.sin(Math.PI*p)**2;
  }
  return {rotations,offsets};
}
export function bakePigClips():Map<string,AnimationClip> {
  return new Map(PIG_MOTIONS.map(motion=>{
    const frames=Math.round(motion.duration*30),times=Array.from({length:frames+1},(_,i)=>i*motion.duration/frames);
    const poses=times.map((_,i)=>authorPigPose(motion.id,i/frames));
    const tracks=PIG_JOINTS.flatMap((joint,index)=>{
      const parent=joint.parent<0?[0,0,0]:PIG_JOINTS[joint.parent].position,local=joint.position.map((v,i)=>v-parent[i]);
      return [new VectorKeyframeTrack(`${joint.name}.position`,times,poses.flatMap(p=>local.map((v,i)=>v+p.offsets[index][i]))),
        new QuaternionKeyframeTrack(`${joint.name}.quaternion`,times,poses.flatMap(p=>new Quaternion().setFromEuler(new Euler(...p.rotations[index] as [number,number,number])).toArray()))];
    });
    return [motion.id,new AnimationClip(`Pig_${motion.id}`,motion.duration,tracks)];
  }));
}
