import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeActor } from '../src/character/v3/rig';
import { createRecipe, presetSlots, type Cage, type Recipe } from '../src/character/v3/types';
import { triCount, cloneCage } from '../src/character/v3/cage';
import { assertGarmentPiece } from './check-garment-assets';

const tops=['rough_tunic','cross_jacket','layered_vest'] as const;
const bottoms=['loose_trousers','guard_pants'] as const;
const dyes={primary:'#ff2455',secondary:'#16c7ef',accent:'#f5de24'};
const counts={rough_tunic:220,cross_jacket:290,layered_vest:340,loose_trousers:272,guard_pants:304};
const loop=(c:Cage,prefix:string)=>c.vertices.filter(v=>v.id.startsWith(prefix+'.'));
const span=(c:Cage,prefix:string,axis:number)=>{const a=loop(c,prefix).map(v=>v.p[axis]);assert(a.length);return Math.max(...a)-Math.min(...a);};
function assertLayer(c:Cage){
  for(const side of ['Right','Left']){
    const outer=loop(c,`Top.${side}.OuterEdge`),inner=loop(c,`Top.${side}.InnerInset`);
    assert.equal(outer.length,6);assert.equal(inner.length,6);
    assert(span(c,`Top.${side}.OuterEdge`,2)>span(c,`Top.${side}.InnerInset`,2)*1.45,'半臂不能退化为同筒换色');
    for(let i=0;i<6;i++)assert.deepEqual(outer[i].w,inner[i].w,'半臂台阶必须在同一上臂坐标系');
  }
}
const assets:any[]=[];
for(const id of [...tops,...bottoms]){
  const r=createRecipe({dyes,slots:{...presetSlots('body'),...(tops.includes(id as any)?{top:id as any}:{bottom:id as any})}});
  const piece=tops.includes(id as any)?makeTop(r)!:makeTrousers(r)!;
  assertGarmentPiece(piece);assert.equal(triCount(piece.mesh),counts[id]);
  assert.deepEqual([...new Set(piece.mesh.faces.map(f=>f.color))].sort(),Object.values(dyes).sort(),'三色必须各自存在');
  const reverse:Recipe={...r,dyes:{primary:dyes.accent,secondary:dyes.primary,accent:dyes.secondary}};
  const redyed=tops.includes(id as any)?makeTop(reverse)!:makeTrousers(reverse)!;
  assert.deepEqual(piece.mesh.vertices,redyed.mesh.vertices,'染色不能修改坐标/权重');
  assert.deepEqual(piece.mesh.faces.map(f=>f.v),redyed.mesh.faces.map(f=>f.v),'染色不能改变拓扑');
  assets.push({id,triangles:triCount(piece.mesh),logicalVertices:piece.mesh.vertices.length,renderVertices:piece.mesh.faces.reduce((n,f)=>n+f.v.length,0),covers:piece.covers,openings:Object.keys(piece.openings)});
}
const top=(id:typeof tops[number])=>makeTop(createRecipe({slots:{top:id}}))!.mesh;
const work=top('rough_tunic'),cross=top('cross_jacket'),half=top('layered_vest');
assert(loop(work,'Top.Hem')[0].p[1]-loop(cross,'Top.Hem')[0].p[1]>.055,'劳作短衣/常服衣长没有拉开');
assert(span(cross,'Top.Right.Cuff',2)>span(half,'Top.Right.Cuff',2)*1.45,'长袖常服/半臂内袖轮廓没有拉开');
assertLayer(half);
const bad=cloneCage(half);for(const side of ['Right','Left']){const out=loop(bad,`Top.${side}.OuterEdge`),inside=loop(bad,`Top.${side}.InnerInset`);out.forEach((v,i)=>v.p=[...inside[i].p]);}assert.throws(()=>assertLayer(bad));
const straight=makeTrousers(createRecipe({slots:{bottom:'loose_trousers'}}))!.mesh,bound=makeTrousers(createRecipe({slots:{bottom:'guard_pants'}}))!.mesh;
assert(span(straight,'Pants.Right.Cuff',0)>span(bound,'Pants.Right.Cuff',0)*1.4,'不能只用裤脚颜色凑款式');
assert(span(bound,'Pants.Right.Thigh',0)>span(straight,'Pants.Right.Thigh',0)+.015);
assert(loop(bound,'Pants.Right.BindingTop').length===8&&loop(straight,'Pants.Right.HemFacing').length===8);
const combinations:any[]=[];
for(const bodyType of ['male','female'] as const)for(const upper of tops)for(const bottom of bottoms){
  const recipe=createRecipe({bodyType,dyes,slots:{...presetSlots('body'),top:upper,bottom,shoes:'cloth_shoes'}}),d=makeCharacter(recipe),a=makeActor(d);
  assert.equal(d.joints.length,20);assert.equal(triCount(d.body),524);assert.equal(recipe.version,5);
  assert(!d.surface.vertices.some(v=>/^(CrossCollar|InnerCollar)/.test(v.id)),'新领口不得叠加旧投影条');
  combinations.push({bodyType,top:upper,bottom,bodyTriangles:triCount(d.body),bodyLogicalVertices:d.body.vertices.length,triangles:triCount(d.surface),logicalVertices:d.surface.vertices.length,renderVertices:a.mesh.geometry.attributes.position.count});a.dispose();
}
const report={passed:true,sourceSha:process.env.REVIEW_HEAD_SHA??'local',assets,combinations,mutationChecks:1,manualVisualApproval:false,note:'局部制作差异/固定色区/接口测试；不能替代真实动作图片或既有全源帧与中点贯穿检测。'};
mkdirSync('review-wardrobe-batch',{recursive:true});writeFileSync('review-wardrobe-batch/numeric.json',JSON.stringify(report,null,2));console.log('PASS first clothing batch',JSON.stringify(report));
