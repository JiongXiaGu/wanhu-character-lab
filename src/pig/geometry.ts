import { Ray, Vector3 } from 'three';
import type { AnimalMeshData, LivestockLodId, Point } from '../livestock/types';
import { PIG_BONES as B, PIG_BODY_DROP, PIG_JOINTS, PIG_LEGS, PIG_SOLE } from './rig';

export const PIG_MESH_VERSION = 'wanhu-black-domestic-pig-mesh-v2';
const skin = '#373a38', belly = '#50483f', nose = '#61514b', hoof = '#292b29';
interface Ring { z: number; y: number; rx: number; ry: number; sides: number; bone: number; color: string }
/** 三档独立截面；厚身、粗颈、低头、鼻梁和宽鼻盘共享一张闭合主壳。 */
export function buildPigMesh(lod: LivestockLodId = 'lod0'): AnimalMeshData {
  if (!['lod0', 'lod1', 'lod2'].includes(lod)) throw new Error(`未知猪LOD：${lod}`);
  const data: AnimalMeshData = { positions: [], indices: [], bones: [], colors: [], parts: [], version: `${PIG_MESH_VERSION}/${lod}` };
  const vertex = (point: Point, bone: number, color: string) => {
    const id = data.positions.length; data.positions.push(point); data.bones.push(bone); data.colors.push(color); return id;
  };
  const row = (z: number, y: number, rx: number, ry: number, sides: number, bone: number = B.Body, color = skin): Ring => ({z,y,rx,ry,sides,bone,color});
  const rows = lod === 'lod0' ? [
    row(-.455,.414,.158,.200,6), row(-.295,.421,.263,.236,8), row(-.045,.415,.273,.239,8),
    row(.208,.399,.234,.223,8), row(.330,.390,.180,.188,6,B.Neck), row(.453,.360,.165,.165,6,B.Head),
    row(.545,.302,.088,.078,6,B.Head), row(.582,.278,.094,.058,6,B.Head,nose), row(.616,.278,.094,.058,6,B.Head,nose),
  ] : lod === 'lod1' ? [
    row(-.295,.421,.273,.236,6), row(.150,.408,.263,.236,6), row(.330,.390,.180,.188,4,B.Neck),
    row(.453,.360,.165,.165,4,B.Head),
    row(.575,.278,.082,.058,4,B.Head,nose), row(.616,.278,.082,.058,4,B.Head,nose),
  ] : [
    row(-.290,.421,.273,.236,4), row(.155,.408,.258,.236,4), row(.330,.390,.180,.188,4,B.Neck),
    row(.483,.345,.160,.150,4,B.Head), row(.616,.278,.082,.058,4,B.Head,nose),
  ];
  const rings = rows.map(r => Array.from({length:r.sides},(_,i) => {
    // 身体截面保留宽的腹底，不让四条短腿在尖腹两侧显得过高；三档最高点保持一致。
    const body = r.bone === B.Body, start = Math.PI/2 - (body ? Math.PI/r.sides : 0);
    const angle = start+i*2*Math.PI/r.sides;
    const angles = Array.from({length:r.sides},(_,j)=>start+j*2*Math.PI/r.sides);
    const sx = body ? Math.max(...angles.map(a=>Math.abs(Math.cos(a)))) : 1;
    const sy = body ? Math.max(...angles.map(a=>Math.abs(Math.sin(a)))) : 1;
    return vertex([Math.cos(angle)*r.rx/sx,r.y+Math.sin(angle)*r.ry/sy,r.z],r.bone,r.color===skin&&Math.sin(angle)<-.3?belly:r.color);
  }));
  const connect = (a: number[], b: number[]) => {
    // 同边数截面左右镜像选择对角线，避免非共面头面造成左右眼贴面位置不一致。
    if (a.length === b.length && a.length % 2 === 0) {
      for (let i=0;i<a.length;i++) {
        const j=(i+1)%a.length, x=data.positions[a[i]][0]+data.positions[a[j]][0];
        if(x>=0)data.indices.push(a[i],a[j],b[i],a[j],b[j],b[i]);
        else data.indices.push(a[i],a[j],b[j],a[i],b[j],b[i]);
      }
      return;
    }
    let i=0,j=0;
    while(i<a.length||j<b.length) {
      if(j===b.length||(i<a.length&&(i+1)*b.length<=(j+1)*a.length)) {data.indices.push(a[i%a.length],a[(i+1)%a.length],b[j%b.length]);i++;}
      else {data.indices.push(a[i%a.length],b[(j+1)%b.length],b[j%b.length]);j++;}
    }
  };
  for(let i=1;i<rings.length;i++) connect(rings[i-1],rings[i]);
  const rear=vertex([0,.430,-.505],B.Body,skin), first=rings[0], last=rings[rings.length-1];
  for(let i=0;i<first.length;i++) data.indices.push(rear,first[(i+1)%first.length],first[i]);
  for(let i=1;i<last.length-1;i++) data.indices.push(last[0],last[i],last[i+1]);
  data.parts.push({name:'BodyNeckHeadSnout',start:0,count:data.positions.length});

  // 少量闭合实体；按中心确定朝外，不用单面片或分趾长槽制造细节。
  function solid(name: string, points: Point[], faces: number[][], bone: number, color: string, convex = true) {
    const start=data.positions.length, center=new Vector3();points.forEach(p=>center.add(new Vector3(...p)));center.divideScalar(points.length);
    points.forEach(p=>vertex(p,bone,color));
    for(const face of faces) for(let i=1;i<face.length-1;i++) {
      const ids=[face[0],face[i],face[i+1]], [a,b,c]=ids.map(j=>new Vector3(...points[j]));
      if(convex&&b.sub(a).cross(c.sub(a)).dot(a.clone().sub(center))<0) [ids[1],ids[2]]=[ids[2],ids[1]];
      data.indices.push(...ids.map(j=>start+j));
    }
    data.parts.push({name,start,count:points.length});return start;
  }
  const tetra=[[0,1,2],[0,3,1],[1,3,2],[2,3,0]];
  const prism=[[0,1,2],[3,5,4],[0,3,4,1],[1,4,5,2],[2,5,3,0]];
  for(const bone of PIG_LEGS) {
    const [x,,z]=PIG_JOINTS[bone].position;
    // 上粗下窄的整块短腿，脚底不再用贯穿腿身的凹V口；整圈腿根埋入躯干，不能在体侧露出顶盖。
    const sole:Point[]=lod==='lod2'?[[-.043,.006,.052],[.043,.006,.052],[0,.006,-.040]]:[...PIG_SOLE];
    const points:Point[]=sole.map(([px,y,pz])=>[x+px,y,z+pz]);
    const top:Point[]=lod==='lod2'?[[-.072,.365,.046],[.072,.365,.046],[0,.365,-.092]]:
      [[-.072,.365,-.066],[.072,.365,-.066],[.072,.365,.066],[-.072,.365,.066]];
    points.push(...top.map(([px,y,pz])=>[x+px-Math.sign(x)*.125,y,z+pz+(z<0?.060:-.035)] as Point));
    const n=sole.length,faces:number[][]=[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>n+i)];
    for(let i=0;i<n;i++)faces.push([i,(i+1)%n,(i+1)%n+n,i+n]);
    const start=solid(PIG_JOINTS[bone].name,points,faces,bone,skin);
    for(let i=0;i<n;i++)data.colors[start+i]=hoof;
  }
  // 眼睛单独贴合真实头面：细灰褐眼缘承托一块深色眼面，不再是浅色菱形中的黑针尖。
  function makeEye(side:number,suffix:string) {
    const headFaces:number[][]=[];
    for(let i=0;i<data.indices.length;i+=3) {
      const ids=data.indices.slice(i,i+3);
      if(ids.every(id=>id<data.parts[0].count&&data.bones[id]===B.Head))headFaces.push(ids);
    }
    function hit(origin:Vector3,direction:Vector3) {
      const ray=new Ray(origin,direction),point=new Vector3();
      let nearest: {point:Vector3;normal:Vector3;distance:number}|undefined;
      for(const ids of headFaces) {
        const [a,b,c]=ids.map(id=>new Vector3(...data.positions[id]));
        if(!ray.intersectTriangle(a,b,c,true,point))continue;
        const distance=point.distanceToSquared(origin);
        if(!nearest||distance<nearest.distance)nearest={point:point.clone(),normal:b.sub(a).cross(c.sub(a)).normalize(),distance};
      }
      if(!nearest)throw new Error('猪眼睛必须落在真实Head表面');
      return nearest;
    }
    const {point:contact,normal}=hit(new Vector3(side*.5,.420,.492),new Vector3(-side,0,0));
    const up=new Vector3(0,1,0).addScaledVector(normal,-normal.y).normalize();
    const forward=new Vector3().crossVectors(normal,up).normalize();
    const onFace=(horizontal:number,vertical:number,height:number)=>{
      const desired=contact.clone().addScaledVector(forward,horizontal).addScaledVector(up,vertical);
      return hit(desired.clone().addScaledVector(normal,.15),normal.clone().negate()).point.addScaledVector(normal,height);
    };
    const points:Point[]=[contact.clone().addScaledVector(normal,-.008).toArray()];
    const faces:number[][]=[];
    if(lod==='lod0') {
      for(const [scale,height] of [[1,.002],[.72,.007]])for(let i=0;i<6;i++) {
        const a=i*2*Math.PI/6;
        points.push(onFace(Math.cos(a)*.032*scale,Math.sin(a)*.025*scale,height).toArray());
      }
      points.push(contact.clone().addScaledVector(normal,.008).toArray());
      for(let i=0;i<6;i++) {
        const a=1+i,b=1+(i+1)%6;
        faces.push([0,b,a],[a,b,b+6,a+6],[13,a+6,b+6]);
      }
    } else {
      for(const [u,v] of [[-.031,0],[0,-.023],[.031,0],[0,.023]])points.push(onFace(u,v,.002).toArray());
      points.push(contact.clone().addScaledVector(normal,.008).toArray());
      for(let i=0;i<4;i++){const a=1+i,b=1+(i+1)%4;faces.push([0,b,a],[5,a,b]);}
    }
    const start=solid('Eye'+suffix,points,faces,B.Head,'#898271');
    if(lod==='lod0')for(let i=7;i<14;i++)data.colors[start+i]='#101714';
    else data.colors[start+5]='#101714';
  }
  for(const side of [-1,1]) {
    const suffix=side<0?'L':'R';
    if(lod==='lod0') {
      const ear:Point[]=[[side*.045,.440,.395],[side*.045,.430,.470],[side*.205,.342,.485]];
      const start=solid('Ear'+suffix,[...ear,...ear.map(([x,y,z])=>[x,y-.024,z] as Point)],prism,B.Head,skin);
      data.colors[start+2]='#655449';data.colors[start+5]='#584940';
    } else {
      solid('Ear'+suffix,[[side*.025,.400,.420],[side*.020,.445,.415],[side*.045,.382,.450],[side*.205,.342,.485]],tetra,B.Head,skin);
    }
    if(lod!=='lod2')makeEye(side,suffix);
  }
  if(lod==='lod2') {
    solid('Tail',[[0,.451,-.477],[.018,.473,-.477],[-.018,.473,-.477],[0,.516,-.560]],tetra,B.Tail,skin);
  } else {
    const start=data.positions.length;
    const centers=lod==='lod0'?[[.462,-.474,.016],[.474,-.548,.013],[.520,-.548,.010]]:[[.465,-.485,.016],[.521,-.550,.012]];
    const tailRings=centers.map(([y,z,radius],k)=>Array.from({length:3},(_,i)=>{
      const a=Math.PI/2+i*2*Math.PI/3, tilt=k===0?0:k===1?.8:1.7;
      return vertex([Math.cos(a)*radius,y+Math.sin(a)*radius*Math.cos(tilt),z+Math.sin(a)*radius*Math.sin(tilt)],B.Tail,skin);
    }));
    // 此管朝-Z制作，因此用反向接口绕序；起点藏于臀部内，不留悬空间隙。
    const from=data.indices.length;
    for(let i=1;i<tailRings.length;i++)connect(tailRings[i-1],tailRings[i]);
    const root=vertex([0,.462,-.450],B.Tail,skin), tip=vertex([0,.523,-.507],B.Tail,skin);
    for(let i=0;i<3;i++) {data.indices.push(root,tailRings[0][(i+1)%3],tailRings[0][i]);const end=tailRings.at(-1)!;data.indices.push(tip,end[i],end[(i+1)%3]);}
    for(let i=from;i<data.indices.length;i+=3)[data.indices[i+1],data.indices[i+2]]=[data.indices[i+2],data.indices[i+1]];
    data.parts.push({name:'Tail',start,count:data.positions.length-start});
  }
  // 厚躯干整体下沉50mm；四脚与Root腿骨的地面契约不变，绑定空间同步使用相同落差。
  data.positions = data.positions.map(([x,y,z],i)=>[x,y-(data.bones[i] < B.FrontLegL ? PIG_BODY_DROP : 0),z]);
  return data;
}
