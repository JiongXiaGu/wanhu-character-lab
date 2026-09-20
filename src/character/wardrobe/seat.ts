import {B,type Cage,type Vec3,type Weight} from '../v3/types';
import {add,mul,vertex,bridge,face,orient} from '../v3/cage';

/**
 * 只重建克隆后的服装表层，不改 source body、绑定或 FBX。
 * 一圈低成本髋根过渡 + 沿实际邻接边截出的四角裆底；没有独立遮挡壳。
 * 所有接缝共享逻辑索引。20 骨骼、每点至多两项影响不变。
 * 注意：Snatch 深屈曲仍未通过独立贯穿检查，本模块仍属候选版。
 */
export function rebuildSeat(c:Cage):void {
  if(c.anchors.SeatGusset)throw new Error('裆底不可重复生成');
  const crotch=c.vertices.findIndex(v=>v.id==='Crotch');
  if(crotch<0)throw new Error('缺少源衣面裆点');
  const hip=c.anchors.Hip;
  if(hip?.length!==8)throw new Error('髋口协议改变');
  for(const side of ['Right','Left'] as const){
    const root=c.anchors[side+'LegRoot'],lower=c.anchors[side+'Thigh'];
    if(root?.length!==6||lower?.length!==6)throw new Error('腿根接口协议改变');
    const thigh=side==='Right'?B.RightThigh:B.LeftThigh;
    const opposite=side==='Right'?B.LeftThigh:B.RightThigh;
    const remove=new Set<Cage['faces'][number]>();
    for(let i=0;i<6;i++){
      const quad=[root[i],root[(i+1)%6],lower[(i+1)%6],lower[i]];
      const f=c.faces.find(f=>f.v.length===4&&quad.every(v=>f.v.includes(v)));
      if(!f)throw new Error('腿根面缺失或重复：'+side+'/'+i);
      remove.add(f);
    }
    c.faces=c.faces.filter(f=>!remove.has(f));
    const seat=root.map((a,i)=>{
      const p=mul(add(c.vertices[a].p,c.vertices[lower[i]].p),.5);
      // 内腿使用对称双大腿过渡，避免为了稳定中线引入第三根骨骼。
      const w:Weight=i===5?[thigh,opposite,.75]:[B.Hips,thigh,.25];
      return vertex(c,side+'Seat.'+i,p,w);
    });
    bridge(c,root,seat,'thigh');bridge(c,seat,lower,'thigh');
    c.anchors[side+'Seat']=seat;
  }
  const right=c.anchors.RightSeat[5],left=c.anchors.LeftSeat[5];
  const centerWeight:Weight=[B.RightThigh,B.LeftThigh,.5];
  // 四角必须先从原极点和真实邻接边同时求出，再覆盖原极点。
  // 固定世界坐标会越过邻接边；顺序覆盖后再求坐标则会让前后切点不对称。
  const pivot:Vec3=[...c.vertices[crotch].p];
  const cutAmount=.30;
  const cut=(i:number):Vec3=>add(mul(pivot,1-cutAmount),mul(c.vertices[i].p,cutAmount));
  const frontPoint=cut(hip[0]),backPoint=cut(hip[4]);
  const rightPoint=cut(right),leftPoint=cut(left);
  const front=crotch;
  c.vertices[front]={id:'SeatGusset.Front',p:frontPoint,w:[...centerWeight]};
  const back=vertex(c,'SeatGusset.Back',backPoint,[...centerWeight]);
  // 四角保持同一变换混合，中线补面不会因左右不同权重先自行剪切。
  const r=vertex(c,'SeatGusset.Right',rightPoint,[...centerWeight]);
  const l=vertex(c,'SeatGusset.Left',leftPoint,[...centerWeight]);
  const cuts=new Map<number,number>([[hip[0],front],[hip[4],back],[right,r],[left,l]]);
  let affected=0;
  for(const f of c.faces){
    const k=f.v.indexOf(crotch);if(k<0)continue;
    const a=cuts.get(f.v[(k+f.v.length-1)%f.v.length]);
    const b=cuts.get(f.v[(k+1)%f.v.length]);
    if(a===undefined||b===undefined)throw new Error('裆点邻接面不符合四角协议');
    f.v.splice(k,1,a,b);affected++;
  }
  if(affected!==4)throw new Error('裆点必须有四个连续邻面');
  face(c,[front,r,back,l],'thigh');
  c.anchors.SeatGusset=[front,r,back,l];
  c.anchors.RightLegRoot=[...hip.slice(0,5),back,r,front];
  c.anchors.LeftLegRoot=[hip[4],hip[5],hip[6],hip[7],hip[0],front,l,back];
  orient(c);
}

/** 绑定空间制作参数，只改善被旧褶窝压薄的上段；膝/小腿仍用既有版型。 */
export function restoreSeatVolume(c:Cage):void {
  for(const i of c.anchors.Hip){const p=c.vertices[i].p;p[1]=1.005;if(p[2]>0)p[2]*=1.16;}
  for(const side of ['Right','Left'])for(const i of c.anchors[side+'Thigh']){
    const p=c.vertices[i].p;p[2]*=p[2]<0?1.25:1.12;
  }
}
