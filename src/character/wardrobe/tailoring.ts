import {rebuildSeat,restoreSeatVolume} from './seat';
import {B,rigid,type Cage,type Recipe,type GarmentDyes,type Vec3,type Weight} from '../v3/types';
import {add,mul,vertex,orient} from '../v3/cage';
/** @deprecated 旧调用兼容；三种数值都映射到同一标准模型。 */
export type WardrobeLod=0|1|2;
export const STANDARD_MODEL_PROFILE='wanhu-standard-low-v1';
export const GARMENT_GEOMETRY_VERSION='wanhu-tailoring-v2.1-seat-1';
export const BODY_HIDE_VERSION='wanhu-tailoring-no-duplicate-lining-v2';
const TOPS=['rough_tunic','cross_jacket','layered_vest','ceremony_robe'];
const BOTTOMS=['loose_trousers','work_wrap','pleated_skirt','robe_skirt'];
export function isTailored(r:Recipe){return TOPS.includes(r.slots.top)||BOTTOMS.includes(r.slots.bottom);}
function resize(c:Cage,name:string,fx:number,fz=fx){const ids=c.anchors[name];if(!ids)throw new Error('缺少接口 '+name);const mid=mul(ids.reduce((p,i)=>add(p,c.vertices[i].p),[0,0,0] as Vec3),1/ids.length);for(const i of ids){const p=c.vertices[i].p;c.vertices[i].p=[mid[0]+(p[0]-mid[0])*fx,p[1],mid[2]+(p[2]-mid[2])*fz];}}
/**
 * 服装版型在标准 1.76m 制作空间中留出髋/膝折叠余量，之后统一应用体型场。
 * 只修改可见衣面，不修改源人体、骨架、FBX，也不进行逐帧碰撞求解。
 * 裆点跟随双腿；髋环提高、膝过渡拉长、前后褶窝收量，避免深屈曲时折入。
 */
function fitJointCreases(c:Cage,build:number){
 // 高壮体格需要更深的前褶窝；纤细体格保留厚度，避免低LOD内侧反折。
 const thighFront=.6-.2*Math.max(0,build-.5);
 const ring=(name:string)=>{const ids=c.anchors[name];if(!ids?.length)throw new Error('缺少衣面接口 '+name);return ids.map(i=>c.vertices[i]);};
 const crotch=c.vertices.find(v=>v.id==='Crotch');
 if(!crotch)throw new Error('缺少衣面裆点');
 crotch.p[1]=.90;crotch.w=[B.RightThigh,B.LeftThigh,.5];
 for(const v of ring('Hip'))v.p[1]=1.025;
 for(const side of ['Right','Left'] as const){
  const sign=side==='Right'?1:-1,thigh=side==='Right'?B.RightThigh:B.LeftThigh;
  for(const v of ring(side+'Thigh')){
   v.p[1]=.815;v.w=rigid(thigh);v.p[2]*=.80;
   if(sign*v.p[0]<.101)v.p[0]=sign*(.101+(sign*v.p[0]-.101)*.45);
  }
  for(const v of ring(side+'KneeUpper'))v.p[1]=.615;
  for(const v of ring(side+'KneeLower'))v.p[1]=.365;
  for(const v of ring(side+'Knee'))if(v.p[2]<0)v.p[2]=-.018;
 }
 for(const name of ['Hip','Waist'])for(const v of ring(name))if(v.p[2]>0)v.p[2]*=name==='Hip'?.5:.7;
 for(const side of ['Right','Left']){
  for(const name of ['Thigh','KneeUpper'])for(const v of ring(side+name))if(v.p[2]>0)v.p[2]*=name==='Thigh'?thighFront:.7;
  for(const name of ['Thigh','KneeUpper','KneeLower','Calf'])for(const v of ring(side+name))if(v.p[2]<0)v.p[2]*=.5;
  const sign=side==='Right'?1:-1;
  for(const v of ring(side+'Thigh'))v.p[0]=sign*Math.min(.17,sign*v.p[0]);
 }
}
/**
 * V2 主路线：完整裤式分裳，表层即衣服，不叠加另一层腿/裙壳。
 * 大色块表达上衣下摆、裙片、内衬；连续共享顶点避免双层交界的破口。
 * 这是允许美术简化后的分裳/阔裤，不冒充带布料模拟的连筒长裙。
 */
export function tailorSurface(c:Cage,r:Recipe,colors:GarmentDyes,lod:WardrobeLod=2){
 if(![0,1,2].includes(lod))throw new Error('非法服饰 LOD');if(!isTailored(r))return;
 const newTop=TOPS.includes(r.slots.top),newBottom=BOTTOMS.includes(r.slots.bottom);
 if(newTop){
  for(const side of ['Right','Left']){resize(c,side+'Deltoid',1.02);if(r.slots.top!=='rough_tunic'){resize(c,side+'ElbowUpper',1.02);resize(c,side+'Elbow',1.04);resize(c,side+'ElbowLower',r.slots.top==='ceremony_robe'?1.12:1.06);}}
  for(const f of c.faces){if(['torso','upperArm'].includes(f.region))f.color=colors.primary;if(r.slots.top!=='rough_tunic'&&f.region==='forearm')f.color=r.slots.top==='layered_vest'?colors.secondary:colors.primary;}
 }
 if(newBottom||newTop){
  const skirt=['pleated_skirt','robe_skirt'].includes(r.slots.bottom),wrap=r.slots.bottom==='work_wrap';
  for(const side of ['Right','Left']){
   for(const name of ['Thigh','KneeUpper','Knee','KneeLower','Calf']){
    const ids=c.anchors[side+name];const mid=mul(ids.reduce((p,i)=>add(p,c.vertices[i].p),[0,0,0] as Vec3),1/ids.length);
    const extension=skirt?(name==='Thigh'?.018:name==='Calf'?.046:.038):wrap?.012:.008;
    for(const i of ids){const p=c.vertices[i].p,dx=p[0]-mid[0],dz=p[2]-mid[2],s=side==='Right'?1:-1;
     // 内腿留出间距，只向外扩写意轮廓；前后适度放量，避免大钟罩。
     p[0]+=s*extension*Math.max(0,s*dx/.06);p[2]+=Math.sign(dz)*extension*.55;
    }
   }
  }
  fitJointCreases(c,r.build);
  restoreSeatVolume(c);
  rebuildSeat(c);
  const hem=skirt?(r.slots.bottom==='robe_skirt'?.30:.39):wrap?.68:.84;
  const topHem:Record<string,number>={rough_tunic:.88,cross_jacket:.81,layered_vest:.72,ceremony_robe:.60};
  for(const f of c.faces){if(!['pelvis','thigh','shin'].includes(f.region))continue;
   const y=f.v.reduce((n,i)=>n+c.vertices[i].p[1],0)/f.v.length;
   if(newBottom)f.color=colors.secondary;
   if(newTop&&y>(topHem[r.slots.top]??1))f.color=colors.primary;
   if(y>hem&&y<hem+.045&&newBottom)f.color=colors.accent;
  }
 }
 orient(c);
}
