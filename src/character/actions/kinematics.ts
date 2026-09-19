import {Vector3 as V,Quaternion as Q,Euler,MathUtils} from 'three';
import {B,type Joint,type Recipe,type Vec3} from '../v3/types';
export class PoseSolver {
  readonly local:Q[];readonly world:Q[];readonly positions:V[];readonly offsets:V[];readonly hips:V;
  constructor(readonly joints:Joint[]) {
    this.local=joints.map(()=>new Q());this.world=joints.map(()=>new Q());this.positions=joints.map(()=>new V());
    this.offsets=joints.map(j=>new V(...j.p).sub(j.parent<0?new V():new V(...joints[j.parent].p)));this.hips=this.offsets[B.Hips].clone();this.fk();
  }
  euler(bone:number,x=0,y=0,z=0){this.local[bone].setFromEuler(new Euler(x,y,z));}
  fk(){for(let i=0;i<this.joints.length;i++){const p=this.joints[i].parent,offset=i===B.Hips?this.hips:this.offsets[i];if(p<0){this.world[i].copy(this.local[i]);this.positions[i].copy(offset);}else{this.world[i].copy(this.world[p]).multiply(this.local[i]);this.positions[i].copy(offset).applyQuaternion(this.world[p]).add(this.positions[p]);}}}
  worldRotation(bone:number,q:Q){const p=this.joints[bone].parent;this.local[bone].copy(p<0?q:this.world[p].clone().invert().multiply(q));this.fk();}
  /** 二段解析 IK。只用于构建/采样动作，不逐帧寻找人体网格顶点。 */
  chain(upper:number,lower:number,end:number,target:V,pole:V):number {
    this.fk();const start=this.positions[upper].clone(),delta=target.clone().sub(start),raw=delta.length(),dir=delta.clone().normalize();
    const a=this.offsets[lower].length(),b=this.offsets[end].length(),d=MathUtils.clamp(raw,Math.abs(a-b)+1e-6,a+b-1e-6);
    const bend=pole.clone().sub(start).addScaledVector(dir,-pole.clone().sub(start).dot(dir));if(bend.lengthSq()<1e-9)bend.set(0,0,1).addScaledVector(dir,-dir.z);bend.normalize();
    const along=(a*a+d*d-b*b)/(2*d),side=Math.sqrt(Math.max(0,a*a-along*along));const elbow=start.clone().addScaledVector(dir,along).addScaledVector(bend,side);
    const q1=new Q().setFromUnitVectors(this.offsets[lower].clone().normalize(),elbow.clone().sub(start).normalize());this.worldRotation(upper,q1);
    const q2=new Q().setFromUnitVectors(this.offsets[end].clone().normalize(),target.clone().sub(elbow).normalize());this.worldRotation(lower,q2);
    return Math.max(0,raw-(a+b));
  }
}
export const palmOffset=(side:number,recipe:Recipe)=>new V(side*.026,-.048,.006).multiplyScalar(recipe.height/1.76);
export function aimHand(s:PoseSolver,side:number,grip:V,direction:V,recipe:Recipe) {
  const upper=side>0?B.RightUpperArm:B.LeftUpperArm,lower=side>0?B.RightForearm:B.LeftForearm,hand=side>0?B.RightHand:B.LeftHand;
  const offset=palmOffset(side,recipe),rotation=new Q().setFromUnitVectors(offset.clone().normalize(),direction.clone().normalize());
  const wrist=grip.clone().sub(offset.clone().applyQuaternion(rotation)),h=recipe.height/1.76;
  const pole=new V(side*.65*h,s.positions[upper].y-.32*h,-.08*h);
  const unreachable=s.chain(upper,lower,hand,wrist,pole);s.worldRotation(hand,rotation);
  return {bone:hand,point:grip.toArray() as Vec3,offset:offset.toArray() as Vec3,unreachable};
}
