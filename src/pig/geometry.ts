import { Ray, Vector3 } from 'three';
import type { AnimalMeshData, LivestockLodId, Point } from '../livestock/types';
import { PIG_BONES as B, PIG_JOINTS, PIG_LEGS, PIG_SOLE } from './rig';

export const PIG_MESH_VERSION = 'wanhu-black-domestic-pig-mesh-v1';
const skin = '#504a46', belly = '#67574d', nose = '#776058', hoof = '#292b29';
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
    row(.208,.399,.234,.223,8), row(.330,.366,.180,.172,6,B.Neck), row(.453,.344,.150,.143,6,B.Head),
    row(.595,.285,.085,.078,6,B.Head), row(.666,.264,.120,.073,6,B.Head,nose), row(.706,.264,.120,.073,6,B.Head,nose),
  ] : lod === 'lod1' ? [
    row(-.295,.421,.303,.236,6), row(.150,.408,.298,.236,6), row(.330,.366,.180,.172,4,B.Neck),
    row(.453,.344,.150,.143,4,B.Head), row(.595,.285,.085,.078,4,B.Head),
    row(.666,.264,.112,.073,4,B.Head,nose), row(.706,.264,.112,.073,4,B.Head,nose),
  ] : [
    row(-.290,.421,.273,.236,4), row(.155,.408,.258,.236,4), row(.330,.366,.180,.172,4,B.Neck),
    row(.483,.327,.170,.136,3,B.Head), row(.706,.240,.142,.100,3,B.Head,nose),
  ];
  const rings = rows.map(r => Array.from({length:r.sides},(_,i) => {
    const angle = Math.PI/2+i*2*Math.PI/r.sides;
    return vertex([Math.cos(angle)*r.rx,r.y+Math.sin(angle)*r.ry,r.z],r.bone,r.color===skin&&Math.sin(angle)<-.3?belly:r.color);
  }));
  const connect = (a: number[], b: number[]) => {
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

  // 附件是少量闭合实体。凸附件按中心确定朝外；凹双趾脚使用显式一致绕序。
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
    // 上端向体内收55mm，留出奔跑摆腿的遮挡量；脚底仍位于原肩臀四角。
    const at=(p:Point):Point=>[x+p[0]-(p[1]>.39?Math.sign(x)*.055:0),p[1],z+p[2]];
    let start:number;
    if(lod==='lod0') {
      const points=[...PIG_SOLE,[-.050,.405,-.032],[.050,.405,-.032],[.050,.405,.032],[-.050,.405,.032]] as Point[];
      const faces=[[0,1,4],[1,2,3],[1,3,4],[0,4,5],[0,5,6], [7,10,9,8],
        [0,7,8,1],[1,8,9,2],[2,9,3],[3,9,4],[4,9,10],[4,10,5],[5,10,6],[6,10,7,0]];
      start=solid(PIG_JOINTS[bone].name,points.map(at),faces,bone,skin,false);
    } else {
      const sole:Point[]=[[-.042,.006,.064],[.042,.006,.064],[0,.006,-.044]];
      start=lod==='lod1'
        ?solid(PIG_JOINTS[bone].name,([...sole,[-.050,.405,.032],[.050,.405,.032],[0,.405,-.032]] as Point[]).map(at),prism,bone,skin)
        :solid(PIG_JOINTS[bone].name,([...sole,[0,.405,0]] as Point[]).map(at),tetra,bone,skin);
    }
    for(let i=start;i<data.positions.length;i++) if(data.positions[i][1]<.01) data.colors[i]=hoof;
  }
  for(const side of [-1,1]) {
    const suffix=side<0?'L':'R';
    if(lod==='lod0') {
      const ear:Point[]=[[side*.070,.417,.488],[side*.070,.445,.453],[side*.220,.358,.546]];
      const start=solid('Ear'+suffix,[...ear,...ear.map(([x,y,z])=>[x,y-.018,z] as Point)],prism,B.Head,skin);
      data.colors[start+2]='#756056';data.colors[start+5]='#68534a';
      // 在本档真实头面上定位眼睛；内极嵌入、外极只高出7mm，避免悬空眼球。
      const ray=new Ray(new Vector3(side*.5,.400,.484),new Vector3(-side,0,0));
      const contact=new Vector3(), normal=new Vector3();let found=false;
      for(let i=0;i<data.indices.length;i+=3) {
        const ids=data.indices.slice(i,i+3);if(!ids.every(id=>id<data.parts[0].count&&data.bones[id]===B.Head))continue;
        const [a,b,c]=ids.map(id=>new Vector3(...data.positions[id]));
        if(ray.intersectTriangle(a,b,c,true,contact)){normal.copy(b).sub(a).cross(c.sub(a)).normalize();found=true;break;}
      }
      if(!found)throw new Error('猪眼睛必须落在真实Head表面');
      const up=new Vector3(0,1,0).addScaledVector(normal,-normal.y).normalize(), forward=new Vector3().crossVectors(normal,up).normalize();
      const eye=[contact.clone().addScaledVector(normal,-.007),contact.clone().addScaledVector(normal,.007),
        contact.clone().addScaledVector(up,.014),contact.clone().addScaledVector(up,-.014),
        contact.clone().addScaledVector(forward,.018),contact.clone().addScaledVector(forward,-.018)].map(p=>p.toArray() as [number,number,number]);
      const e=solid('Eye'+suffix,eye,[[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,4,2],[1,3,4],[1,5,3],[1,2,5]],B.Head,'#8b7b68');
      data.colors[e+1]='#111916';
      const x=side*.042;
      solid('Nostril'+suffix,[[x-.011,.257,.700],[x+.011,.257,.700],[x,.281,.700],[x,.268,.708]],tetra,B.Head,'#282424');
    } else {
      solid('Ear'+suffix,[[side*.025,.390,.475],[side*.020,.420,.470],[side*.045,.382,.500],[side*.213,.358,.546]],tetra,B.Head,skin);
    }
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
  return data;
}
