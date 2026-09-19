import {AnimationClip,QuaternionKeyframeTrack,VectorKeyframeTrack,Vector3 as V,Quaternion as Q,MathUtils} from 'three';
import {B,type Joint,type Recipe,type Vec3} from '../v3/types';
import {ACTIONS,type WorkId} from './catalog';
import {PoseSolver,aimHand} from './kinematics';
import {PROP_ANCHORS as ANCHOR} from './anchors';
export interface Contact {bone:number;point:Vec3;offset:Vec3;unreachable:number}
export interface WorkSample {pose:PoseSolver;propP:V;propQ:Q;contacts:Contact[];attached:boolean;toolContact:V|null}
export const smooth=(a:number,b:number,t:number)=>{const x=MathUtils.clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);};
function keyed(phase:number,keys:readonly [number,number][]) {for(let i=1;i<keys.length;i++)if(phase<=keys[i][0])return MathUtils.lerp(keys[i-1][1],keys[i][1],smooth(keys[i-1][0],keys[i][0],phase));return keys.at(-1)![1];}
const qx=(angle:number)=>new Q().setFromAxisAngle(new V(1,0,0),angle);
/** 一个共享求值器产生人体、道具与握点；同一时钟、同一坐标，不分别猜动作。 */
export function sampleWork(joints:Joint[],recipe:Recipe,id:WorkId,phase:number):WorkSample {
  const def=ACTIONS[id],p=MathUtils.clamp(phase,0,1),h=recipe.height/1.76,s=new PoseSolver(joints),t=p*Math.PI*2;
  const point=(x:number,y:number,z:number)=>new V(x*h,y*h,z*h);
  let crouch=0,lean=.06,hipDown=.025;
  if(id==='pick')crouch=smooth(.05,.33,p)*(1-smooth(.46,.9,p));
  if(id==='place')crouch=smooth(.10,.55,p)*(1-smooth(.70,.98,p));
  if(id==='pick'||id==='place'){hipDown=.49*crouch;lean=.98*crouch;}
  if(id==='carry_back')lean=.17;
  if(id==='carry_shoulder')lean=.09;
  if(id==='push')lean=.18;
  if(id==='pull')lean=.045;
  const strike=keyed(p,[[0,0],[.22,0],[.52,1],[.63,1],[1,0]]);
  if(id==='hoe'){lean=.04+.33*strike;hipDown=.025+.07*strike;}
  if(id==='hammer')lean=.13;
  if(def.locomotion==='walk')hipDown=.038-.005*Math.cos(t*2);
  s.hips.y-=hipDown*h;s.hips.z+=.10*crouch*h;
  s.euler(B.Spine,lean*.6);s.euler(B.Chest,lean*.4);s.euler(B.Head,-lean*.45);s.fk();
  for(const side of [1,-1]) {
    const u=side>0?B.RightThigh:B.LeftThigh,l=side>0?B.RightShin:B.LeftShin,f=side>0?B.RightFoot:B.LeftFoot;
    const local=t+(side>0?0:Math.PI),z=def.locomotion==='walk'?.135*Math.cos(local):0,lift=def.locomotion==='walk'?.045*Math.max(0,-Math.sin(local)):0;
    const ankle=new V(...joints[f].p).add(point(side*.085*crouch,lift,z));
    s.chain(u,l,f,ankle,point(side*(.101+.16*crouch),.36,.45));s.worldRotation(f,new Q());
  }
  s.euler(B.RightUpperArm,def.locomotion==='walk'?.19*Math.cos(t):0,0,-.37);
  s.euler(B.LeftUpperArm,def.locomotion==='walk'?-.19*Math.cos(t):0,0,.37);
  s.euler(B.RightForearm,-.11);s.euler(B.LeftForearm,-.11);s.fk();
  const propP=new V(),propQ=new Q(),contacts:Contact[]=[];let attached=true,toolContact:V|null=null;
  const chestPoint=(x:number,y:number,z:number)=>point(x,y,z).applyQuaternion(s.world[B.Chest]).add(s.positions[B.Chest]);
  const hand=(side:number,grip:V,direction:V)=>contacts.push(aimHand(s,side,grip,direction,recipe));
  const localGrip=(x:number,y:number,z:number)=>point(x,y,z).applyQuaternion(propQ).add(propP);
  if(def.prop==='crate') {
    const ground=point(...ANCHOR.crate.groundCenter),held=point(0,1.01,.34);
    let carry=1;
    if(id==='pick'){carry=smooth(.46,.9,p);attached=p>=.38;}
    if(id==='place'){carry=1-smooth(.14,.60,p);attached=p<.66;}
    if(id==='carry_front'){propQ.copy(s.world[B.Chest]);propP.copy(chestPoint(0,-.17,.36));}
    else propP.copy(ground).lerp(held,carry);
    const reach=id==='pick'?smooth(.04,.33,p):id==='place'?1-smooth(.68,.96,p):1;
    for(const side of [1,-1]) {
      const grip=localGrip(...(side>0?ANCHOR.crate.rightGrip:ANCHOR.crate.leftGrip)),end=side>0?B.RightHand:B.LeftHand;
      if(reach>0) {const neutral=s.positions[end].clone().add(point(0,-.045,0));const target=neutral.lerp(grip,reach);hand(side,target,new V(-side,0,0));if(reach<.999)contacts.pop();}
    }
  } else if(id==='carry_shoulder') {
    propQ.copy(s.world[B.Chest]);propP.copy(chestPoint(.248,.183,-.015));
    hand(1,localGrip(...ANCHOR.timber.rightGrip),new V(0,1,0));
  } else if(id==='carry_back') {
    propQ.copy(s.world[B.Chest]);propP.copy(chestPoint(0,-.065,-.237));
    for(const side of [1,-1])hand(side,localGrip(...(side>0?ANCHOR.firewood.rightGrip:ANCHOR.firewood.leftGrip)),new V(0,0,-1));
  } else if(def.prop==='wheelbarrow') {
    if(id==='pull')propQ.setFromAxisAngle(new V(0,1,0),Math.PI);
    for(const side of [1,-1])hand(side,localGrip(...((id==='pull'?-side:side)>0?ANCHOR.wheelbarrow.rightGrip:ANCHOR.wheelbarrow.leftGrip)),new V(0,-.3,id==='pull'?-1:1));
  } else if(id==='hoe') {
    propQ.copy(qx(MathUtils.lerp(-2.05,-.55,strike)));
    const impact=point(.04, .026 + 1.19*Math.cos(.55), .89-1.19*Math.sin(.55));
    const primary=point(.04,1.24,.29).lerp(impact,strike);
    propP.copy(primary).sub(point(...ANCHOR.hoe.rightGrip).applyQuaternion(propQ));
    hand(1,primary,new V(-1,0,0));hand(-1,localGrip(...ANCHOR.hoe.leftGrip),new V(1,0,0));
    toolContact=localGrip(...ANCHOR.hoe.toolContact);
  } else {
    propQ.copy(qx(MathUtils.lerp(.12,2.45,strike)));
    const hit=point(.235,.875,.53),impact=hit.clone().sub(point(0,.315,0).applyQuaternion(qx(2.45)));
    const grip=point(.235,1.20,.27).lerp(impact,strike);
    propP.copy(grip).sub(point(...ANCHOR.hammer.rightGrip).applyQuaternion(propQ));
    hand(1,grip,new V(-1,0,0));hand(-1,point(...ANCHOR.hammer.supportHand),new V(0,-1,0));toolContact=localGrip(...ANCHOR.hammer.toolContact);
  }
  s.fk();return {pose:s,propP,propQ,contacts,attached,toolContact};
}
export function bakeWork(joints:Joint[],recipe:Recipe,id:WorkId):AnimationClip {
  const def=ACTIONS[id],count=Math.ceil(def.duration*60),times:number[]=[],rot=joints.map(()=>[] as number[]),hips:number[]=[],propP:number[]=[],propQ:number[]=[];
  for(let f=0;f<=count;f++) {
    const sample=sampleWork(joints,recipe,id,f/count);times.push(f/count*def.duration);
    for(let i=0;i<joints.length;i++){const q=sample.pose.local[i];const values=rot[i];if(values.length&&values.at(-4)!*q.x+values.at(-3)!*q.y+values.at(-2)!*q.z+values.at(-1)!*q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);values.push(q.x,q.y,q.z,q.w);}
    hips.push(...sample.pose.hips.toArray());propP.push(...sample.propP.toArray());propQ.push(...sample.propQ.toArray());
  }
  const tracks=joints.map((j,i)=>new QuaternionKeyframeTrack(`${j.name}.quaternion`,times,rot[i]));
  return new AnimationClip(`work/${id}`,def.duration,[...tracks,new VectorKeyframeTrack('Hips.position',times,hips),new VectorKeyframeTrack('WorkObject.position',times,propP),new QuaternionKeyframeTrack('WorkObject.quaternion',times,propQ)]);
}
