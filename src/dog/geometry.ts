import { Ray, Vector3 } from 'three';
import type { AnimalMeshData, LivestockLodId, Point } from '../livestock/types';
import { DOG_BONES as B, DOG_JOINTS, DOG_LEGS } from './rig';

export const DOG_MESH_VERSION='wanhu-rural-yellow-dog-mesh-v1';
const COAT='#b28a50',PALE='#c5aa7d',SHADE='#987440',NOSE='#30332b';
interface Row {z:number;y:number;rx:number;ry:number;n:number;bone:number;color:string}
/** 犬独立截面和少量闭合小壳；不调用猪、家禽或坐骑作者工厂。 */
export function buildDogMesh(lod:LivestockLodId='lod0'):AnimalMeshData {
  if(!['lod0','lod1','lod2'].includes(lod))throw new Error(`未知犬LOD：${lod}`);
  const data:AnimalMeshData={positions:[],indices:[],bones:[],colors:[],parts:[],version:`${DOG_MESH_VERSION}/${lod}`};
  const vertex=(point:Point,bone:number,color:string)=>{const i=data.positions.length;data.positions.push(point);data.bones.push(bone);data.colors.push(color);return i;};
  const row=(z:number,y:number,rx:number,ry:number,n:number,bone:number=B.Body,color=COAT):Row=>({z,y,rx,ry,n,bone,color});
  const rows=lod==='lod0'?[
    row(-.405,.465,.115,.137,6),row(-.27,.482,.155,.171,8),row(-.06,.481,.161,.182,8),row(.15,.490,.157,.200,8),
    row(.25,.56,.123,.153,6,B.Neck),row(.32,.64,.115,.125,6,B.Head),row(.42,.648,.123,.115,6,B.Head),
    row(.492,.600,.088,.070,6,B.Head,PALE),row(.568,.583,.059,.053,4,B.Head,PALE),row(.589,.583,.059,.050,4,B.Head,NOSE),
  ]:lod==='lod1'?[
    row(-.28,.482,.155,.171,6),row(.15,.490,.157,.200,6),row(.26,.56,.123,.153,4,B.Neck),
    row(.335,.643,.115,.125,4,B.Head),row(.427,.646,.123,.115,4,B.Head),row(.501,.592,.083,.067,4,B.Head,PALE),row(.589,.583,.059,.050,4,B.Head,NOSE),
  ]:[
    row(-.28,.482,.155,.171,4),row(.15,.490,.157,.200,4),row(.26,.56,.123,.153,3,B.Neck),
    row(.427,.646,.123,.115,4,B.Head),row(.589,.583,.059,.050,3,B.Head,NOSE),
  ];
  // 截面三角连接只负责本犬作者拓扑；同边数时左右镜像选对角线。
  function connect(a:number[],b:number[]) {
    if(a.length===b.length&&a.length%2===0) {
      for(let i=0;i<a.length;i++) {
        const j=(i+1)%a.length,x=data.positions[a[i]][0]+data.positions[a[j]][0];
        if(x>=0)data.indices.push(a[i],a[j],b[i],a[j],b[j],b[i]);else data.indices.push(a[i],a[j],b[j],a[i],b[j],b[i]);
      }
      return;
    }
    let i=0,j=0;
    while(i<a.length||j<b.length) {
      if(j===b.length||(i<a.length&&(i+1)*b.length<=(j+1)*a.length)){data.indices.push(a[i%a.length],a[(i+1)%a.length],b[j%b.length]);i++;}
      else {data.indices.push(a[i%a.length],b[(j+1)%b.length],b[j%b.length]);j++;}
    }
  }
  const rings=rows.map(r=>{
    const start=Math.PI/2-(r.bone===B.Body?Math.PI/r.n:0),angles=Array.from({length:r.n},(_,i)=>start+i*2*Math.PI/r.n);
    const sx=Math.max(...angles.map(a=>Math.abs(Math.cos(a)))),sy=Math.max(...angles.map(a=>Math.abs(Math.sin(a))));
    return angles.map(a=>vertex([Math.cos(a)*r.rx/sx,r.y+Math.sin(a)*r.ry/sy,r.z],r.bone,r.color===COAT&&Math.sin(a)<-.35?PALE:r.color));
  });
  for(let i=1;i<rings.length;i++)connect(rings[i-1],rings[i]);
  const rear=vertex([0,.48,-.452],B.Body,COAT),first=rings[0],last=rings.at(-1)!;
  for(let i=0;i<first.length;i++)data.indices.push(rear,first[(i+1)%first.length],first[i]);
  for(let i=1;i<last.length-1;i++)data.indices.push(last[0],last[i],last[i+1]);
  data.parts.push({name:'BodyNeckHeadMuzzle',start:0,count:data.positions.length});
  function solid(name:string,points:Point[],faces:number[][],bone:number,color:string) {
    const start=data.positions.length,center=points.reduce((c,p)=>c.add(new Vector3(...p)),new Vector3()).divideScalar(points.length);
    points.forEach(p=>vertex(p,bone,color));
    for(const face of faces)for(let i=1;i<face.length-1;i++) {
      const ids=[face[0],face[i],face[i+1]],[a,b,c]=ids.map(j=>new Vector3(...points[j]));
      if(b.sub(a).cross(c.sub(a)).dot(a.clone().sub(center))<0)[ids[1],ids[2]]=[ids[2],ids[1]];
      data.indices.push(...ids.map(i=>start+i));
    }
    data.parts.push({name,start,count:points.length});return start;
  }
  const tetra=[[0,1,2],[0,3,1],[1,3,2],[2,3,0]],prism=[[0,1,2],[3,5,4],[0,3,4,1],[1,4,5,2],[2,5,3,0]];
  for(const bone of DOG_LEGS) {
    const side=Math.sign(DOG_JOINTS[bone].position[0]),front=bone<=B.FrontLegR;
    // 前腿直、后腿静态有膝/飞节轮廓，但每条整腿仍只绑定一根骨。
    const spec=front?(lod==='lod0'?[[.070,.535,.125,.035,.025],[.113,.215,.189,.024,.030],[.113,.007,.204,.037,.05]]:
      [[.070,.535,.125,.035,.025],[.113,.007,.204,.037,.05]]):
      (lod==='lod0'?[[.055,.520,-.235,.030,.035],[.116,.330,-.225,.039,.051],[.12,.175,-.318,.024,.031],[.12,.007,-.292,.036,.05]]:
      lod==='lod1'?[[.055,.520,-.235,.030,.035],[.12,.205,-.315,.030,.036],[.12,.007,-.292,.036,.05]]:
      [[.055,.520,-.235,.030,.035],[.12,.007,-.292,.036,.05]]);
    const n=lod==='lod0'||(lod==='lod1'&&front)?4:3,start=data.positions.length;
    const legRings=spec.map(([x,y,z,rx,rz])=>Array.from({length:n},(_,i)=>{
      const shape=n===3?[[0,1],[-1,-1],[1,-1]]:[[1,1],[-1,1],[-1,-1],[1,-1]];
      const [px,pz]=shape[i];
      return vertex([side*x+px*rx,y,z+pz*rz],bone,y<.02?PALE:COAT);
    }));
    // XZ环沿-Y延伸；非凸后腿不按整体中心逐面猜朝向。
    for(let r=1;r<legRings.length;r++) {
      const a=legRings[r-1],b=legRings[r];
      for(let i=0;i<n;i++){const j=(i+1)%n;data.indices.push(a[i],a[j],b[i],a[j],b[j],b[i]);}
    }
    const top=legRings[0],bottom=legRings.at(-1)!;
    for(let i=1;i<n-1;i++){data.indices.push(top[0],top[i+1],top[i]);data.indices.push(bottom[0],bottom[i],bottom[i+1]);}
    data.parts.push({name:DOG_JOINTS[bone].name,start,count:data.positions.length-start});
  }
  const headFaces:number[][]=[];
  for(let i=0;i<data.indices.length;i+=3){const ids=data.indices.slice(i,i+3);if(ids.every(id=>id<data.parts[0].count&&data.bones[id]===B.Head))headFaces.push(ids);}
  function eye(side:number,suffix:string) {
    const ray=new Ray(new Vector3(side*.4,.672,.450),new Vector3(-side,0,0));let nearest=Infinity,contact=new Vector3(),normal=new Vector3();
    for(const ids of headFaces){const [a,b,c]=ids.map(id=>new Vector3(...data.positions[id])),p=new Vector3();if(ray.intersectTriangle(a,b,c,true,p)&&p.distanceToSquared(ray.origin)<nearest){nearest=p.distanceToSquared(ray.origin);contact=p.clone();normal=b.sub(a).cross(c.sub(a)).normalize();}}
    if(!Number.isFinite(nearest))throw new Error('犬眼缺少实际头面');
    const up=new Vector3(0,1,0).addScaledVector(normal,-normal.y).normalize(),forward=new Vector3().crossVectors(normal,up).normalize();
    const point=(u:number,v:number,h:number)=>contact.clone().addScaledVector(forward,u).addScaledVector(up,v).addScaledVector(normal,h).toArray() as Point;
    if(lod==='lod0') {
      const points=[point(0,0,-.006),point(-.020,0,0),point(0,-.012,0),point(.020,0,0),point(0,.012,0),point(0,0,.004)],faces:number[][]=[];
      for(let i=0;i<4;i++){const a=1+i,b=1+(i+1)%4;faces.push([0,b,a],[5,a,b]);}
      solid('Eye'+suffix,points,faces,B.Head,'#22271e');
    } else solid('Eye'+suffix,[point(0,0,-.006),point(-.020,-.007,.001),point(.020,-.007,.001),point(0,.013,.003)],tetra,B.Head,'#22271e');
  }
  for(const side of [-1,1]) {
    const suffix=side<0?'L':'R';
    if(lod==='lod0') {
      const base:Point[]=[[side*.051,.703,.350],[side*.103,.690,.414],[side*.120,.807,.370]];
      const start=solid('Ear'+suffix,[...base,...base.map(([x,y,z])=>[x,y,z-.024] as Point)],prism,B.Head,COAT);
      data.colors[start+2]=SHADE;data.colors[start+5]=SHADE;
    } else solid('Ear'+suffix,[[side*.040,.682,.370],[side*.075,.657,.400],[side*.060,.676,.342],[side*.120,.807,.370]],tetra,B.Head,SHADE);
    if(lod!=='lod2')eye(side,suffix);
  }
  if(lod==='lod2') {
    solid('Tail',[[0,.565,-.36],[-.022,.61,-.406],[.022,.61,-.406],[0,.773,-.45]],tetra,B.Tail,COAT);
  } else {
    const start=data.positions.length,tailRows=lod==='lod0'?[[.603,-.392,.028],[.64,-.482,.030],[.743,-.488,.024],[.783,-.421,.014]]:
      [[.603,-.392,.028],[.766,-.471,.021]];
    const root:Point=[0,.565,-.360],tip:Point=[0,.742,-.358];
    const tailRings=tailRows.map(([y,z,r],k)=>{
      const before=k?new Vector3(0,...tailRows[k-1].slice(0,2) as [number,number]):new Vector3(...root);
      const after=k<tailRows.length-1?new Vector3(0,...tailRows[k+1].slice(0,2) as [number,number]):new Vector3(...tip);
      const tangent=after.sub(before).normalize(),u=new Vector3(1,0,0),v=tangent.clone().cross(u).normalize();
      return Array.from({length:3},(_,i)=>vertex(new Vector3(0,y,z).addScaledVector(u,Math.cos(Math.PI/2+i*2*Math.PI/3)*r).addScaledVector(v,Math.sin(Math.PI/2+i*2*Math.PI/3)*r).toArray(),B.Tail,COAT));
    });
    for(let k=1;k<tailRings.length;k++)connect(tailRings[k-1],tailRings[k]);
    const rootId=vertex(root,B.Tail,COAT),tipId=vertex(tip,B.Tail,COAT);
    for(let i=0;i<3;i++){data.indices.push(rootId,tailRings[0][(i+1)%3],tailRings[0][i]);const end=tailRings.at(-1)!;data.indices.push(tipId,end[i],end[(i+1)%3]);}
    data.parts.push({name:'Tail',start,count:data.positions.length-start});
  }
  return data;
}
