import {B,type Cage,type Vec3,type Weight} from '../v3/types';
import {add,mul,vertex,bridge,face,orient} from '../v3/cage';

/**
 * 只重建克隆后的服装表层，不改 source body、绑定或 FBX。
 * 一圈低成本髋根过渡 + 有前后长度的四角裆底；没有独立遮挡壳。
 * 所有接缝共享逻辑索引。20 骨骼、每点至多两项影响不变。
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
      // 内腿不受第三根骨骼影响；左右对称，且和实际裆底连续。
      const w:Weight=i===5?[thigh,opposite,0.75]:[B.Hips,thigh,0.5];
      return vertex(c,side+'Seat.'+i,p,w);
    });
    bridge(c,root,seat,'thigh');bridge(c,seat,lower,'thigh');
    c.anchors[side+'Seat']=seat;
  }
  // 截去原来的单点极点，而不是在它外面叠一个补丁。
  const right=c.anchors.RightSeat[5],left=c.anchors.LeftSeat[5];
  const centerWeight:Weight=[B.RightThigh,B.LeftThigh,.5];
  const center=[...c.vertices[crotch].p] as Vec3;
  const along=(to:number)=>add(mul(center,0.8200000000000001),mul(c.vertices[to].p,0.18));
  const pf=along(hip[0]),pb=along(hip[4]),pr=along(right),pl=along(left);
  const front=crotch;
  c.vertices[front]={id:'SeatGusset.Front',p:pf,w:[...centerWeight]};
  const back=vertex(c,'SeatGusset.Back',pb,[...centerWeight]);
  const r=vertex(c,'SeatGusset.Right',pr,[B.RightThigh,B.LeftThigh,0.545]);
  const l=vertex(c,'SeatGusset.Left',pl,[B.LeftThigh,B.RightThigh,0.545]);
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

/** 绑定空间制作参数，只改善被旧褶窝压薄的上段；膝/小腿仍用既有稳定版型。 */
export function restoreSeatVolume(_c:Cage):void {}
