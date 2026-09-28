import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeActor } from '../src/character/v3/rig';
import { BOTTOM_IDS, HEADWEAR_IDS, SHOES_IDS, TOP_IDS, createRecipe, emptySlots, type Cage, type Recipe } from '../src/character/v3/types';
import { triCount, cloneCage } from '../src/character/v3/cage';
import { assertGarmentPiece } from './check-garment-assets';
import { SLOT_OPTIONS } from '../src/character/wardrobe/catalog';
import { WARDROBE_GAPS, WARDROBE_TAXONOMY, type WearableSlot } from '../src/character/wardrobe/taxonomy';

function assertWardrobeTaxonomy(){
  const expected:Record<WearableSlot,readonly string[]>={
    headwear:HEADWEAR_IDS.filter(id=>id!=='none'),
    top:TOP_IDS.filter(id=>id!=='body'),
    bottom:BOTTOM_IDS.filter(id=>id!=='body'),
    shoes:SHOES_IDS.filter(id=>id!=='body'),
  };
  const seen=new Set<string>();
  for(const item of WARDROBE_TAXONOMY){
    assert(!seen.has(item.id),`服饰版型目录存在重复ID: ${item.id}`);seen.add(item.id);
    assert(item.name.trim()&&item.family.trim()&&item.silhouette.trim()&&item.length.trim(),'版型目录基础字段不能为空');
    assert(item.contexts.length>0&&item.visualTraits.length>0,`${item.id} 必须保留检索场景和视觉特征`);
  }
  const expectedCount=Object.values(expected).reduce((n,ids)=>n+ids.length,0);
  assert.equal(WARDROBE_TAXONOMY.length,expectedCount,'每个当前可穿戴ID必须且只能有一条版型档案');
  for(const [slot,ids] of Object.entries(expected) as [WearableSlot,readonly string[]][]){
    for(const id of ids){
      const item=WARDROBE_TAXONOMY.find(entry=>entry.id===id);
      assert(item,`缺少服饰版型档案: ${slot}/${id}`);assert.equal(item.slot,slot,`${id} 的槽位分类错误`);
      const option=SLOT_OPTIONS[slot].find(entry=>entry.id===id);
      assert(option,`衣柜下拉目录缺少 ${slot}/${id}`);assert.equal(item.name,option.name,`${id} 的版型名称必须与衣柜显示名一致`);
    }
  }
  const gapIds=new Set<string>();
  for(const gap of WARDROBE_GAPS){
    assert(!gapIds.has(gap.id),`服饰缺口存在重复ID: ${gap.id}`);gapIds.add(gap.id);
    assert(gap.targetContexts.length>0&&gap.distinguishingTraits.length>0&&gap.whyExistingAssetsDoNotCoverIt.trim(),`${gap.id} 缺口说明不完整`);
    assert(!seen.has(gap.id),'缺口ID不能伪装成已注册运行时服饰');
  }
  return {entries:WARDROBE_TAXONOMY.length,bySlot:Object.fromEntries(Object.entries(expected).map(([slot,ids])=>[slot,ids.length])),gaps:WARDROBE_GAPS.length};
}
const taxonomy=assertWardrobeTaxonomy();

const tops=['rough_tunic','cross_jacket','layered_vest'] as const;
const bottoms=['work_pants','work_wrap'] as const;
const dyes={primary:'#ff2455',secondary:'#16c7ef',accent:'#f5de24'};
const counts={rough_tunic:246,cross_jacket:316,layered_vest:366,work_pants:240,work_wrap:240};
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
  const r=createRecipe({dyes,slots:{...emptySlots(),...(tops.includes(id as any)?{top:id as any}:{bottom:id as any})}});
  const piece=tops.includes(id as any)?makeTop(r)!:makeTrousers(r)!;
  assertGarmentPiece(piece);assert.equal(triCount(piece.mesh),counts[id]);
  const colors=[...new Set(piece.mesh.faces.map(f=>f.color))];
  assert(colors.every(color=>Object.values(dyes).includes(color as any)),'色区必须来自配方三色');
  assert(colors.includes(dyes.secondary),'保留下装/内衬必须使用 secondary');
  if(id==='work_wrap')assert(colors.includes(dyes.accent),'劳作束脚裤必须保留缘边色');
  const reverse:Recipe={...r,dyes:{primary:dyes.accent,secondary:dyes.primary,accent:dyes.secondary}};
  const redyed=tops.includes(id as any)?makeTop(reverse)!:makeTrousers(reverse)!;
  assert.deepEqual(piece.mesh.vertices,redyed.mesh.vertices,'染色不能修改坐标/权重');
  assert.deepEqual(piece.mesh.faces.map(f=>f.v),redyed.mesh.faces.map(f=>f.v),'染色不能改变拓扑');
  assets.push({id,triangles:triCount(piece.mesh),logicalVertices:piece.mesh.vertices.length,renderVertices:piece.mesh.faces.reduce((n,f)=>n+f.v.length,0),covers:piece.covers,openings:Object.keys(piece.openings),sealedInterfaces:Object.keys(piece.sealedInterfaces??{})});
}
const top=(id:typeof tops[number])=>makeTop(createRecipe({slots:{top:id}}))!.mesh;
const work=top('rough_tunic'),cross=top('cross_jacket'),half=top('layered_vest');
assert(loop(work,'Top.Hem')[0].p[1]-loop(cross,'Top.Hem')[0].p[1]>.055,'劳作短衣/常服衣长没有拉开');
assert(span(cross,'Top.Right.Cuff',2)>span(half,'Top.Right.Cuff',2)*1.45,'长袖常服/半臂内袖轮廓没有拉开');
assertLayer(half);
const bad=cloneCage(half);for(const side of ['Right','Left']){const out=loop(bad,`Top.${side}.OuterEdge`),inside=loop(bad,`Top.${side}.InnerInset`);out.forEach((v,i)=>v.p=[...inside[i].p]);}assert.throws(()=>assertLayer(bad));
const straight=makeTrousers(createRecipe({slots:{bottom:'work_pants'}}))!.mesh,wrap=makeTrousers(createRecipe({slots:{bottom:'work_wrap'}}))!.mesh;
assert(span(wrap,'Pants.Right.Knee',0)>span(straight,'Pants.Right.Knee',0)*1.04,'束脚劳作裤膝部留量应与劳动直裤拉开');
const combinations:any[]=[];
for(const bodyType of ['male','female'] as const)for(const upper of tops)for(const bottom of bottoms){
  const recipe=createRecipe({bodyType,dyes,slots:{...emptySlots(),top:upper,bottom,shoes:'cloth_shoes'}}),d=makeCharacter(recipe),a=makeActor(d);
  assert.equal(d.joints.length,20);assert.equal(triCount(d.body),524);assert.equal(recipe.version,5);
  assert(!d.surface.vertices.some(v=>/^(CrossCollar|InnerCollar)/.test(v.id)),'新领口不得叠加旧投影条');
  combinations.push({bodyType,top:upper,bottom,bodyTriangles:triCount(d.body),bodyLogicalVertices:d.body.vertices.length,triangles:triCount(d.surface),logicalVertices:d.surface.vertices.length,renderVertices:a.mesh.geometry.attributes.position.count});a.dispose();
}
const report={passed:true,sourceSha:process.env.REVIEW_HEAD_SHA??'local',taxonomy,assets,combinations,mutationChecks:1,manualVisualApproval:false,note:'服饰版型目录覆盖全部当前可穿戴ID并登记后续轮廓缺口；保留三上衣、两实用长裤的制作差异/色区/闭合接口检查，真实动作图片和贯穿检测独立执行。'};
mkdirSync('review-wardrobe-batch',{recursive:true});writeFileSync('review-wardrobe-batch/numeric.json',JSON.stringify(report,null,2));console.log('PASS retained clothing batch',JSON.stringify(report));
