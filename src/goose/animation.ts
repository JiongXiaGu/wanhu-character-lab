import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import type { MotionDefinition } from '../livestock/types';
import { GOOSE_BONES as B, GOOSE_JOINTS, GOOSE_SOLE } from './rig';

export const GOOSE_ANIMATION_VERSION = 'wanhu-goose-motion-v1';
export const GOOSE_MOTIONS: readonly MotionDefinition[] = [
  {id:'idle_land',label:'停驻',description:'挺颈观察，头部轻轻转动。',duration:3,surface:'land'},
  {id:'walk',label:'行走',description:'交替跨步，长颈相对稳定。',duration:1.2,surface:'land'},
  {id:'run',label:'奔跑',description:'前倾快步，颈部向前压低。',duration:.6,surface:'land'},
  {id:'graze',label:'低头吃草',description:'两段颈部依次下弯，喙贴地轻扫。',duration:3,surface:'land'},
  {id:'threat',label:'伸颈威吓',description:'压低长颈向前探，不展翅、不含追逐AI。',duration:2,surface:'land'},
  {id:'idle_water',label:'漂浮',description:'身体轻浮，蹼足收于水下。',duration:3,surface:'water'},
  {id:'swim',label:'游泳',description:'挺颈平稳前望，水下交替划蹼。',duration:1.5,surface:'water'},
  {id:'feed_water',label:'水面觅食',description:'长颈低探，喙浅入水面后抬起。',duration:3,surface:'water'},
];
/** 制作时烘焙七骨轨道；不调用鸡鸭的作者函数，没有运行时IK、浮力或状态AI。 */
export function authorGoosePose(motion: string, phase: number) {
  const definition=GOOSE_MOTIONS.find(m=>m.id===motion);
  if(!definition) throw new Error(`未知鹅动作：${motion}`);
  const p=Math.max(0,Math.min(1,Number.isFinite(phase)?phase:0)), a=p*Math.PI*2;
  const rotations=GOOSE_JOINTS.map(()=>[0,0,0]), offsets=GOOSE_JOINTS.map(()=>[0,0,0]);
  rotations[B.Head][1]=Math.sin(a)*(motion.startsWith('idle')?.16:.018);
  if(motion==='walk'||motion==='run') {
    const running=motion==='run', stride=running?.20:.11;
    rotations[B.Body][0]=running?.11:.025;
    rotations[B.Body][2]=Math.sin(a)*(running?.055:.035);
    offsets[B.Body][1]=.004*Math.sin(2*a);
    rotations[B.NeckBase][0]=(running?.32:.025)+.025*Math.sin(2*a);
    rotations[B.NeckTip][0]=(running?-.13:0)-.020*Math.sin(2*a);
    rotations[B.Head][0]=-rotations[B.Body][0]-rotations[B.NeckBase][0]-rotations[B.NeckTip][0];
    rotations[B.NeckBase][2]=-rotations[B.Body][2]*.70;
    rotations[B.Head][2]=-rotations[B.Body][2]*.30;
    for(const [bone,shift] of [[B.LegL,0],[B.LegR,.5]]) {
      const t=(p+shift)%1, swing=t>=.6, u=swing?(t-.6)/.4:t/.6;
      const z=stride*(swing?-.5*Math.cos(Math.PI*u):.5-u), angle=-Math.asin(z/.214);
      rotations[bone][0]=angle;
      const minY=Math.min(...GOOSE_SOLE.map(([,y,z])=>.220+(y-.220)*Math.cos(angle)-(z+.040)*Math.sin(angle)));
      offsets[bone][1]=.006+(swing?Math.sin(Math.PI*u)*(running?.052:.032):0)-minY;
    }
  } else if(motion==='graze'||motion==='feed_water') {
    const t=Math.max(0,Math.min(1,(p-.12)/.76)), dip=Math.sin(Math.PI*t)**2, land=motion==='graze';
    rotations[B.Body][0]=(land?.040:.025)*dip;
    offsets[B.Body][1]=(land?-.010:0)*dip;
    rotations[B.NeckBase][0]=(land?1.45:1.10)*dip;
    rotations[B.NeckTip][0]=(land?.65:.55)*dip;
    rotations[B.Head][0]=(land?-.85:-.72)*dip;
    rotations[B.Head][1]=Math.sin(a*2)*.07*dip;
  } else if(motion==='threat') {
    const dip=Math.sin(Math.PI*p)**2;
    rotations[B.Body][0]=.07*dip;
    rotations[B.NeckBase][0]=1.15*dip;
    rotations[B.NeckTip][0]=-.50*dip;
    rotations[B.Head][0]=-.50*dip;
    offsets[B.Body][2]=.016*dip;
  } else {
    rotations[B.NeckBase][0]=.012*Math.sin(a);
    rotations[B.NeckTip][0]=-.008*Math.sin(a);
    rotations[B.Head][0]=-.004*Math.sin(a);
  }
  if(definition.surface==='water') {
    offsets[B.Root][1]=.004*Math.sin(a);
    rotations[B.Body][2]=.012*Math.sin(a);
    for(const [bone,shift] of [[B.LegL,0],[B.LegR,Math.PI]]) {
      rotations[bone][0]=.85+(motion==='swim'?.35:.025)*Math.sin(a+shift);
      offsets[bone][1]=.020;
    }
  }
  return {rotations,offsets};
}
export function bakeGooseClips(): Map<string, AnimationClip> {
  return new Map(GOOSE_MOTIONS.map(motion=>{
    const frames=Math.round(motion.duration*30), times=Array.from({length:frames+1},(_,i)=>i*motion.duration/frames);
    const poses=times.map((_,i)=>authorGoosePose(motion.id,i/frames));
    const tracks=GOOSE_JOINTS.flatMap((joint,index)=>{
      const parent=joint.parent<0?[0,0,0]:GOOSE_JOINTS[joint.parent].position;
      const local=joint.position.map((v,i)=>v-parent[i]);
      return [
        new VectorKeyframeTrack(`${joint.name}.position`,times,poses.flatMap(p=>local.map((v,i)=>v+p.offsets[index][i]))),
        new QuaternionKeyframeTrack(`${joint.name}.quaternion`,times,poses.flatMap(p=>new Quaternion().setFromEuler(new Euler(...p.rotations[index] as [number,number,number])).toArray())),
      ];
    });
    return [motion.id,new AnimationClip(`Goose_${motion.id}`,motion.duration,tracks)];
  }));
}
