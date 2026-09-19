import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import * as T from 'three';
import {makeCharacter} from '../src/character/v3/outfit';
import {makeActor} from '../src/character/v3/rig';
import {BODY_TYPES,cleanRecipe,patchSlots,HAIR_STYLE_IDS,type Recipe} from '../src/character/v3/types';
import {cross,sub,triCount} from '../src/character/v3/cage';
import {WARDROBE_LOOKS,WARDROBE_VERSION,applyLook,parseRecipeFile,randomizeLook,SLOT_OPTIONS} from '../src/character/wardrobe/catalog';
import {GARMENT_GEOMETRY_VERSION,BODY_HIDE_VERSION} from '../src/character/wardrobe/geometry';
import {assertComponentWinding} from './check-components';
import {MIXAMO_CLIPS} from '../src/character/mixamo/catalog';
import {retargetMixamo} from '../src/character/mixamo/retarget';
import type {MixamoMotionData} from '../src/character/mixamo/data';
const rows:{look:string;bodyType:string;height:number;build:number;triangles:number;vertices:number}[]=[];
let wrapEdgesChecked=0,coveredLegCases=0;
function inspect(recipe:Recipe){
  const d=makeCharacter(recipe),c=d.surface;
  assert.equal(d.joints.length,20);assert.equal(triCount(d.body),510);assert(triCount(c)<2600,'wardrobe triangle budget');
  assertComponentWinding(c);
  for(const v of c.vertices){assert(v.p.every(Number.isFinite));assert(v.w.slice(0,2).every(i=>Number.isInteger(i)&&i>=0&&i<20));assert(v.w[2]>=0&&v.w[2]<=1);}
  for(const f of c.faces){assert(f.v.every(i=>Number.isInteger(i)&&i>=0&&i<c.vertices.length));for(let i=1;i<f.v.length-1;i++)assert(Math.hypot(...cross(sub(c.vertices[f.v[i]].p,c.vertices[f.v[0]].p),sub(c.vertices[f.v[i+1]].p,c.vertices[f.v[0]].p)))>1e-10,`degenerate ${c.vertices[f.v[0]].id}`);}
  const base=makeCharacter({...recipe,slots:{headwear:'none',top:'body',bottom:'body',shoes:'body',back:'none',leftHand:'none',rightHand:'none'}});
  assert.deepEqual(d.body,base.body,'garment changed source body');assert.deepEqual(d.joints,base.joints,'garment changed skeleton');
  // 不同摆长共享高度处必须具有同一权重，防止静态不穿、走动分离。
  const topRows=c.vertices.filter(v=>/^GarmentTop\.1\.0\.[0-9]+\.0$/.test(v.id));
  const bottomRows=c.vertices.filter(v=>/^GarmentBottom\.1\.0\.[0-9]+\.0$/.test(v.id));
  for(const a of topRows)for(const b of bottomRows)if(Math.abs(a.p[1]-b.p[1])<1e-7)assert.deepEqual(a.w,b.w,'衣层在同一高度的权重不一致');
  // 对最终体型网格独立检查正面/背面搭接，而非复算生成函数自身的角度公式。
  if(recipe.slots.bottom==='pleated_skirt'||recipe.slots.bottom==='robe_skirt'){
    const edgeCount=recipe.slots.bottom==='pleated_skirt'?12:8;
    assert(bottomRows.length>1,'长裳缺少采样行');
    const vertices=new Map(c.vertices.map(v=>[v.id,v]));
    for(const row of bottomRows)for(const edge of[0,edgeCount]){
      const id=row.id.replace(/\.0$/,'.'+edge);
      const right=vertices.get(id),left=vertices.get(id.replace('GarmentBottom.1.0.','GarmentBottom.-1.0.'));
      const inner=vertices.get(id.replace('GarmentBottom.1.0.','GarmentBottom.1.1.'));
      assert(right&&left&&inner,'搭接边顶点缺失');
      assert(right.p[0]<-1e-4&&left.p[0]>1e-4,'长裳绑定姿态中线不能贯通露底');
      assert((inner.p[2]-left.p[2])*(edge===0?1:-1)>1e-4,'搭接内外壁必须留距，不能共面闪烁');
      wrapEdgesChecked++;
    }
    assert(d.body.faces.some(f=>f.region==='thigh'),'源人体大腿不得被服饰遮挡删除');
    assert(!c.faces.some(f=>f.region==='thigh'),'长裳覆盖的大腿裤面仍在绘制');
    const shins=c.faces.filter(f=>f.region==='shin');
    assert.equal(shins.length,12,'必须保留两侧各六面的 Calf→Ankle 外露裤脚');
    assert(shins.every(f=>f.v.every(i=>!c.vertices[i].id.includes('Knee'))),'裙下不可重复绘制膝部裤面');
    for(const side of['Right','Left'])assert(shins.some(f=>f.v.some(i=>c.vertices[i].id.startsWith(side+'Calf'))),'不可把外露小腿一并删除');
    coveredLegCases++;
  }
  assert.deepEqual(parseRecipeFile(JSON.stringify(recipe)),recipe);
  return d;
}
for(const look of WARDROBE_LOOKS)for(const bodyType of BODY_TYPES)for(const [height,build]of[[1.58,0],[1.76,.5],[1.92,1]]){
  const r=applyLook(cleanRecipe({bodyType,height,build}),look.id),d=inspect(r);
  assert.equal(r.bodyType,bodyType);assert.equal(r.height,height);assert.equal(r.build,build);
  rows.push({look:look.id,bodyType,height,build,triangles:triCount(d.surface),vertices:d.surface.vertices.length});
}
let combinations=0;
for(const bodyType of BODY_TYPES)for(const top of SLOT_OPTIONS.top)for(const bottom of SLOT_OPTIONS.bottom){inspect(patchSlots(cleanRecipe({bodyType}),{top:top.id,bottom:bottom.id}));combinations++;}
for(const bodyType of BODY_TYPES)for(const head of SLOT_OPTIONS.headwear)for(const hairStyle of HAIR_STYLE_IDS){inspect(cleanRecipe({...applyLook(cleanRecipe({bodyType}),'town-'+bodyType),slots:{...applyLook(cleanRecipe({bodyType}),'town-'+bodyType).slots,headwear:head.id},hairStyle,hairColor:'#ab9276'}));combinations++;}
// 换回裤装必须恢复整条腿的可见面；穿脱不能污染共享源网格。
for(const bodyType of BODY_TYPES){
 const skirt=applyLook(cleanRecipe({bodyType}),'town-female');makeCharacter(skirt);
 const trousers=makeCharacter(patchSlots(skirt,{bottom:'loose_trousers'}));
 for(const region of['thigh','shin'])assert.equal(trousers.surface.faces.filter(f=>f.region===region).length,trousers.body.faces.filter(f=>f.region===region).length,'脱裙后腿部未恢复');
}
const r=applyLook(cleanRecipe({bodyType:'female',height:1.91,build:.8}),'town-female');
assert.deepEqual(randomizeLook(r,123),randomizeLook(r,123));assert(new Set(Array.from({length:32},(_,i)=>randomizeLook(r,i).slots.top)).size>=4,'nearby seeds do not explore silhouettes');
const locked=randomizeLook(r,234,['top','bottom','dyes','hairStyle']);assert.equal(locked.slots.top,r.slots.top);assert.equal(locked.slots.bottom,r.slots.bottom);assert.deepEqual(locked.dyes,r.dyes);assert.equal(locked.hairStyle,r.hairStyle);assert.equal(locked.height,r.height);assert.equal(locked.bodyType,r.bodyType);
const bads=['null','{}','[]','not json',JSON.stringify({...r,version:9}),JSON.stringify({...r,slots:{...r.slots,top:'unknown'}}),JSON.stringify({...r,height:9}),JSON.stringify({...r,dyes:{primary:'#0'}}),JSON.stringify({...r,hairStyle:'unknown'}),' '.repeat(33000)];for(const bad of bads)assert.throws(()=>parseRecipeFile(bad));
// 对新增服饰逐个 FBX 采样全渲染顶点的关键时刻，不把有限值当作没有穿模。
let frames=0,vertexSamples=0;
for(const def of MIXAMO_CLIPS){const source=JSON.parse(readFileSync(`public/mixamo/${def.id}.json`,'utf8'))as MixamoMotionData;
 for(const look of WARDROBE_LOOKS)for(const bodyType of BODY_TYPES){
  const recipe=applyLook(cleanRecipe({bodyType}),look.id),d=makeCharacter(recipe),a=makeActor(d),b=retargetMixamo(d,source),saved=JSON.stringify(recipe),geometry=a.mesh.geometry;
  const action=a.mixer.clipAction(b.clip);action.setLoop(T.LoopOnce,1).play();action.paused=true;action.clampWhenFinished=true;
  for(const phase of[0,.125,.25,.375,.5,.625,.75,.875,1]){
   action.time=source.times.at(-1)!*phase;a.update(0);frames++;assert.equal(a.mesh.geometry,geometry);
   for(const bone of a.bones)assert(bone.matrixWorld.elements.every(Number.isFinite));
   const p=new T.Vector3();for(let i=0;i<geometry.attributes.position.count;i++){a.mesh.getVertexPosition(i,p);assert(p.toArray().every(Number.isFinite));assert(p.length()<8);vertexSamples++;}
  }
  assert.equal(JSON.stringify(recipe),saved);a.mixer.uncacheClip(b.clip);a.dispose();
 }
 console.log('PASS wardrobe FBX '+def.id);
}
assert(wrapEdgesChecked>0&&coveredLegCases>0,'未执行长裳搭接/遮挡检查');
const report={schema:WARDROBE_VERSION,geometryVersion:GARMENT_GEOMETRY_VERSION,bodyHideVersion:BODY_HIDE_VERSION,sourceSha:process.env.REVIEW_HEAD_SHA??'local',staticVariants:rows.length,pairwiseCombinations:combinations,looks:8,bodyTypes:2,clips:11,phasesPerClip:9,sampledFrames:frames,vertexSamples,wrapEdgesChecked,coveredLegCases,invalidFilesRejected:bads.length,rows,passed:true,note:'Finite values, winding, weights, static wrap edges and covered-body restoration are checked. This is not a collision/cloth/Unity performance test.'};
mkdirSync('review-wardrobe',{recursive:true});writeFileSync('review-wardrobe/numeric.json',JSON.stringify(report,null,2));console.log('PASS wardrobe',JSON.stringify({...report,rows:undefined}));
