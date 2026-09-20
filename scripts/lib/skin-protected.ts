import { createHash } from 'node:crypto';
import type { Cage } from '../../src/character/v3/types';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const lexical=(a:string,b:string)=>a<b?-1:a>b?1:0;
// 只排除本轮明确重建的骨盆拓扑。不能扩大到整条腿或上半身。
const pelvis=(id:string)=>id==='Crotch'||id.startsWith('Hip.')||id.startsWith('SkinPelvis.');
export function protectedSkinSignatures(c:Cage){
  const positions=c.vertices.filter(v=>!pelvis(v.id)).map(v=>({id:v.id,p:v.p})).sort((a,b)=>lexical(a.id,b.id));
  const weights=c.vertices.filter(v=>!pelvis(v.id)&&!/(?:Knee|Calf|Thigh)/.test(v.id)).map(v=>({id:v.id,w:v.w})).sort((a,b)=>lexical(a.id,b.id));
  const faces=c.faces.filter(f=>f.v.every(i=>!pelvis(c.vertices[i].id))).map(f=>{
    const ids=f.v.map(i=>c.vertices[i].id);let start=0;
    for(let i=1;i<ids.length;i++)if(lexical(ids[i],ids[start])<0)start=i;
    return{region:f.region,v:[...ids.slice(start),...ids.slice(0,start)]};
  }).sort((a,b)=>lexical(JSON.stringify(a),JSON.stringify(b)));
  const anchors=Object.entries(c.anchors).filter(([name])=>name!=='Hip'&&!name.endsWith('LegRoot')).map(([name,ids])=>({name,ids:ids.map(i=>c.vertices[i].id)})).sort((a,b)=>lexical(a.name,b.name));
  return{positions:hash(positions),weights:hash(weights),faces:hash(faces),anchors:hash(anchors),positionCount:positions.length,weightCount:weights.length,faceCount:faces.length,anchorCount:anchors.length};
}
