import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {makeCharacter} from '../src/character/v3/outfit';
import {cleanRecipe,type Cage} from '../src/character/v3/types';
import {applyLook,WARDROBE_LOOKS} from '../src/character/wardrobe/catalog';
import {triCount,polygonNormal} from '../src/character/v3/cage';
import {surfaceCornerNormals} from '../src/character/v3/normals';
import {assertComponentWinding} from './check-components';
import {GARMENT_GEOMETRY_VERSION,STANDARD_MODEL_PROFILE} from '../src/character/wardrobe/tailoring';
const rows:unknown[]=[];
function checkClosed(c:Cage){
 const faces=c.faces.filter(f=>!['detail','equipment'].includes(f.region));
 const vertices=new Set<number>(),edges=new Map<string,number>();
 for(const f of faces){assert.equal(new Set(f.v).size,f.v.length,'面中不得重复索引');for(let i=0;i<f.v.length;i++){const a=f.v[i],b=f.v[(i+1)%f.v.length];vertices.add(a);const k=a<b?a+':'+b:b+':'+a;edges.set(k,(edges.get(k)??0)+1);}}
 assert([...edges.values()].every(n=>n===2),'共享接口必须闭合且双流形');
 assert.equal(vertices.size-edges.size+faces.length,2,'主体必须仍是一张闭合球拓扑表面');
}
for(const bodyType of ['male','female'] as const)for(const [height,build]of [[1.58,0],[1.76,.5],[1.92,1],[1.66,.25],[1.85,.75]])for(const look of WARDROBE_LOOKS){
 const recipe=applyLook(cleanRecipe({bodyType,height,build}),look.id),d=makeCharacter(recipe),c=d.surface;
 assertComponentWinding(c);checkClosed(c);assert.equal(d.joints.length,20);assert.equal(triCount(d.body),510);
 const patch=c.anchors.SeatGusset;assert.equal(patch.length,4);assert.equal(new Set(patch).size,4);
 assert(c.faces.some(f=>f.v.length===4&&patch.every(i=>f.v.includes(i))),'必须保留一张真实裆底，不是四片相交表面');
 assert(!c.faces.some(f=>f.v.some(i=>c.vertices[i].id==='Crotch')),'主衣面不能残留单点极点');
 assert.equal(c.anchors.RightSeat.length,6);assert.equal(c.anchors.LeftSeat.length,6);
 for(const v of c.vertices){assert(v.p.every(Number.isFinite));assert(v.w[2]>=0&&v.w[2]<=1);assert(v.w.slice(0,2).every(b=>Number.isInteger(b)&&b>=0&&b<20));}
 const normals=surfaceCornerNormals(c);let softened=0;
 c.faces.forEach((f,fi)=>{assert.equal(normals[fi].length,f.v.length);const flat=polygonNormal(c,f);for(const n of normals[fi]){assert(n.every(Number.isFinite));assert(Math.abs(Math.hypot(...n)-1)<1e-6);if(Math.hypot(...n.map((v,i)=>v-flat[i]))>.05)softened++;if(['head','detail','equipment'].includes(f.region))assert.deepEqual(n,flat,'头脸与服装硬边不得全局平滑');}});
 assert(softened>0,'髋臀必须实际使用局部平滑法线');
 for(const lod of [0,1,2] as const)assert.deepEqual(makeCharacter(recipe,{lod}),d,'旧LOD入口仅归一，不保留高模路径');
 rows.push({bodyType,height,build,look:look.id,triangles:triCount(c),softenedCorners:softened});
}
const bare=makeCharacter({outfit:'body'}),bareNormals=surfaceCornerNormals(bare.surface);
bare.surface.faces.forEach((f,i)=>bareNormals[i].forEach(n=>assert.deepEqual(n,polygonNormal(bare.surface,f),'原人体法线必须不变')));
mkdirSync('review-tailoring-v2',{recursive:true});writeFileSync('review-tailoring-v2/seat.json',JSON.stringify({testedSha:process.env.REVIEW_HEAD_SHA??'local',geometryVersion:GARMENT_GEOMETRY_VERSION,standardProfile:STANDARD_MODEL_PROFILE,rows,passed:true,manuallyReviewed:false,scope:'绑定空间闭合/权重/法线与旧质量参数归一；动作贯穿门槛独立执行，不代表最终美术验收。'},null,2));
console.log('PASS seat topology and standard profile',rows.length);
