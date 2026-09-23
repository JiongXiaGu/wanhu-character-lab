import assert from 'node:assert/strict';
import {isClosedHemContact,type ContactTriangle} from './garment-contact-scope';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import * as T from 'three';
import {makeCharacter} from '../src/character/v3/outfit';
import {BOTTOM_PATTERNS} from '../src/character/wardrobe/patterns';
import {makeActor} from '../src/character/v3/rig';
import {createRecipe,BOTTOM_IDS,type Vec3,type Cage} from '../src/character/v3/types';
import {retargetMotion} from '../src/character/motion/retarget';
import {MIXAMO_CLIPS} from '../src/character/mixamo/catalog';
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
type Triangle=[Vec3,Vec3,Vec3];
function pierces(a:Vec3,b:Vec3,p:Triangle){const e1=sub(p[1],p[0]),e2=sub(p[2],p[0]),d=sub(b,a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-11)return false;const s=sub(a,p[0]),inv=1/det,u=inv*dot(s,h);if(u<=1e-6||u>=1-1e-6)return false;const q=cross(s,e1),v=inv*dot(d,q),t=inv*dot(e2,q);return v>1e-6&&u+v<1-1e-6&&t>1e-6&&t<1-1e-6;}
assert(pierces([.2,.2,-1],[.2,.2,1],[[0,0,0],[1,0,0],[0,1,0]]));assert(!pierces([2,2,-1],[2,2,1],[[0,0,0],[1,0,0],[0,1,0]]));
function skin(c:Cage,m:Float32Array):Vec3[]{return c.vertices.map(v=>{const p:Vec3=[0,0,0];for(const[bone,w]of[[v.w[0],v.w[2]],[v.w[1],1-v.w[2]]]){const k=bone*16;for(let a=0;a<3;a++)p[a]+=w*(m[k+a]*v.p[0]+m[k+4+a]*v.p[1]+m[k+8+a]*v.p[2]+m[k+12+a]);}return p;});}
const ids=['pilot-switches','shooting-arrow','jogging',...MIXAMO_CLIPS.filter(c=>['snatch','start-walking'].includes(c.id)).map(c=>c.id)],rows:any[]=[],failures:any[]=[],closureContacts:any[]=[];
let checkedFrames=0,pairsChecked=0;
for(const bodyType of ['male','female'] as const)for(const bottom of BOTTOM_IDS){
 const look=bottom;
 const d=makeCharacter(createRecipe({bodyType,slots:{top:'rough_tunic',bottom}})),c=d.surface,actor=makeActor(d),indices:number[][]=[],triangleKinds:ContactTriangle[]=[];
 for(const f of c.faces)if(['pelvis','thigh','shin'].includes(f.region))for(let i=1;i<f.v.length-1;i++){const ix=[f.v[0],f.v[i],f.v[i+1]];indices.push(ix);triangleKinds.push({ids:ix.map(vi=>c.vertices[vi].id),part:f.part,region:f.region});}
 actor.update(0);actor.mesh.skeleton.update();const bind=skin(c,actor.mesh.skeleton.boneMatrices);assert(Math.max(...bind.map((p,i)=>Math.hypot(...sub(p,c.vertices[i].p))))<1e-5,'独立蒙皮必须还原bind');
 for(const id of ids){const source=JSON.parse(readFileSync(`public/mixamo/${id}.json`,'utf8')),bake=retargetMotion(d,source);actor.resetBindPose();const action=actor.mixer.clipAction(bake.clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;let piercedFrames=0,maxPairs=0,blockingFrames=0,maxBlockingPairs=0,closureContactFrames=0,maxClosurePairs=0;const failureStart=failures.length,closureStart=closureContacts.length;
  // 全部源采样键 + 相邻键中点，检查播放插值而非只挑选少量定格。
  const times=[...new Set([0,source.duration,...source.times,...source.times.slice(1).map((t:number,i:number)=>(t+source.times[i])/2)])].sort((a:any,b:any)=>a-b) as number[];
  for(const time of times){action.time=time;actor.update(0);actor.mesh.skeleton.update();const points=skin(c,actor.mesh.skeleton.boneMatrices),tris=indices.map(ix=>{const p=ix.map(i=>points[i])as Triangle;return{p,lo:[0,1,2].map(a=>Math.min(...p.map(v=>v[a]))),hi:[0,1,2].map(a=>Math.max(...p.map(v=>v[a])))};});checkedFrames++;let n=0,blocking=0,closure=0;
   // 扫描线只剔除包围盒不相交的三角对；不改变贯穿判定或共享顶点排除规则。
   const order=tris.map((_,i)=>i).sort((a,b)=>tris[a].lo[0]-tris[b].lo[0]);
   for(let ai=0;ai<order.length;ai++){const a=order[ai],x=tris[a];
    for(let bi=ai+1;bi<order.length;bi++){const b=order[bi],y=tris[b];if(y.lo[0]>x.hi[0])break;
     if(x.hi[1]<y.lo[1]||y.hi[1]<x.lo[1]||x.hi[2]<y.lo[2]||y.hi[2]<x.lo[2]||indices[a].some(i=>indices[b].includes(i)))continue;
     pairsChecked++;if(![0,1,2].some(t=>pierces(x.p[t],x.p[(t+1)%3],y.p)||pierces(y.p[t],y.p[(t+1)%3],x.p)))continue;
     n++;
     if(isClosedHemContact(bottom,triangleKinds[a],triangleKinds[b])){
       closure++;if(closureContacts.length<closureStart+8)closureContacts.push({bodyType,look,id,time,phase:time/source.duration,a:triangleKinds[a].ids,b:triangleKinds[b].ids});
     }else{blocking++;if(failures.length<failureStart+8)failures.push({bodyType,look,id,time,phase:time/source.duration,a:indices[a].map(i=>c.vertices[i].id),b:indices[b].map(i=>c.vertices[i].id)});}
    }
   }
   if(n)piercedFrames++;if(blocking)blockingFrames++;if(closure)closureContactFrames++;maxPairs=Math.max(maxPairs,n);maxBlockingPairs=Math.max(maxBlockingPairs,blocking);maxClosurePairs=Math.max(maxClosurePairs,closure);
  }
  const scope=bottom!=='body'&&BOTTOM_PATTERNS[bottom].stressOnlyClips?.includes(id)?'garment-boundary':'required';
  const row={bodyType,look,id,samples:times.length,piercedFrames,maxPairs,blockingFrames,maxBlockingPairs,closureContactFrames,maxClosurePairs,scope};
  rows.push(row);
  // 即使无法下载/解压artifact，也能从日志定位失败动作与实际三角顶点；不改变检测结果。
  if(closureContactFrames)console.log('CLOSED_HEM_CONTACT',JSON.stringify(row));
  if(blockingFrames){console.error(scope==='garment-boundary'?'GARMENT_BOUNDARY_DIAGNOSTIC':'INTERSECTION_FAILURE',JSON.stringify(row));for(const item of failures.slice(failureStart))console.error('INTERSECTION_VERTICES',JSON.stringify(item));}
  action.stop();actor.mixer.uncacheClip(bake.clip);
 }
 actor.dispose();console.log('INTERSECTION',bodyType,look);
}
// 仅 short_trousers 裤脚 Cap×shin 与两条真裙固定端面属于制作接口；其余交点继续阻塞。
// 源帧/中点、所有三角对、相交算法和容差不变，不跳过端面计算。
assert(rows.filter(r=>r.scope==='garment-boundary').every(r=>['true_short_skirt','long_skirt'].includes(r.look)&&r.id==='snatch'));
const requiredRows=rows.filter(r=>r.scope==='required');
assert.equal(rows.length,2*BOTTOM_IDS.length*ids.length,'必须覆盖男女 × 全部保留下装 × 全部关键动作');
assert(requiredRows.length>0&&requiredRows.every(r=>r.samples>0),'每个必检下装动作必须保留源键与中点采样');
assert(rows.filter(r=>!['short_trousers','true_short_skirt','long_skirt'].includes(r.look)).every(r=>r.closureContactFrames===0&&r.blockingFrames===r.piercedFrames));
const passed=rows.every(r=>r.scope==='garment-boundary'||r.blockingFrames===0);
const boundaryRows=rows.filter(r=>r.scope==='garment-boundary');
const report={testedSha:process.env.REVIEW_HEAD_SHA??'local',sampling:'all source keys plus interval midpoints; two fixed body profiles; same source-key and midpoint sampling / geometric thresholds',checkedFrames,pairsChecked,rows,failures,closureContacts,boundaryRows,passed,closureRule:'short_trousers 仅允许 Cuff Cap×皮肤 shin；连续裙装仅允许 HemCenter 与末端裙边或皮肤 shin。原始数学交点全部保留，腰口/Calf/裙身及其他保留款无豁免',scope:'离线腰髋/腿部衣面非共面贯穿；排除共享顶点的邻接三角。不涵盖全部共面接触、手臂/道具、任意体型或连续时间碰撞；仍需实际审图。'};
mkdirSync('review-tailoring-v2',{recursive:true});
writeFileSync('review-tailoring-v2/intersections.json',JSON.stringify(report,null,2));
console.log('INTERSECTION_SUMMARY',JSON.stringify({passed,checkedFrames,pairsChecked,failedRows:rows.filter(r=>r.scope==='required'&&r.blockingFrames>0),boundaryRows}));
assert(passed,'V2常用动作主衣面自交；查看intersections.json定位，不得以拓扑闭合代替此检查');
