import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRecipe, BODY_TYPES, BOTTOM_IDS, type Cage, type TopId } from '../src/character/v3/types';
import { cloneCage, cross as cross3, dot, sub, triCount } from '../src/character/v3/cage';
import { shapePoint } from '../src/character/v3/body';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import { WARDROBE_GAPS, WARDROBE_TAXONOMY } from '../src/character/wardrobe/taxonomy';
import { assertGarmentPiece } from './check-garment-assets';
import { findIntersections, pierces, triangles } from './lib/garment-focus-intersections';

const row=(c:Cage,prefix:string)=>{const result=c.vertices.filter(v=>v.id.startsWith(prefix+'.'));assert(result.length,`缺少轮廓环 ${prefix}`);return result;};
const width=(c:Cage,prefix:string)=>{const p=row(c,prefix).map(v=>v.p[0]);return Math.max(...p)-Math.min(...p);};
const cuff=(c:Cage,prefix:string)=>{const p=row(c,prefix).map(v=>v.p[0]*.866+v.p[1]*.5);return Math.max(...p)-Math.min(...p);};
const ySpan=(c:Cage)=>Math.max(...c.vertices.map(v=>v.p[1]))-Math.min(...c.vertices.map(v=>v.p[1]));
const make=(top:TopId)=>makeTop(createRecipe({slots:{top}}))!;
const ceremony=make('ceremony_robe').mesh, cross=make('cross_jacket').mesh;
function assertSilhouette(c:Cage) {
  const hem=Math.max(...row(c,'Robe.Hem').map(v=>v.p[1]));
  assert(hem>=.35&&hem<=.46,'C1 下缘必须保持膝下/小腿上段，不能回缩成短衣');
  for(const reference of [ceremony,cross]) {
    assert(row(reference,'Top.Hem')[0].p[1]-hem>.45,'C1 与最近似短衣的衣长必须明显不同');
    assert(ySpan(c)>ySpan(reference)*1.6,'总纵向跨度不足');
    assert(cuff(c,'Robe.Right.Cuff')<cuff(reference,'Top.Right.Cuff')*.80,'窄袖口退化为宽袖');
  }
  const hemToChest=width(c,'Robe.Hem')/width(c,'Robe.Chest');
  const waistToChest=width(c,'Robe.Waist')/width(c,'Robe.Chest');
  assert(hemToChest>=1&&hemToChest<=1.32,'C1 必须是小展 H 型，不能变成大 A 字');
  assert(waistToChest>=.72&&waistToChest<=.86,'必须有真实收束腰线：不能是水桶，也不能缩成极端细腰');
  const depth=(prefix:string)=>{const points=row(c,prefix).map(v=>v.p[2]);return Math.max(...points)-Math.min(...points);};
  const waistToChestDepth=depth('Robe.Waist')/depth('Robe.Chest');
  assert(waistToChestDepth>=.70&&waistToChestDepth<=.88,'侧面也必须有腰，不得只收正面宽度');
  const beltLip=width(c,'Robe.BeltLower')-width(c,'Robe.BeltFold');
  assert(beltLip>.005&&beltLip<.025,'束带必须有真实折边，不能只改变面颜色');
  const beltHeight=row(c,'Robe.BeltUpper')[0].p[1]-row(c,'Robe.BeltLower')[0].p[1];
  assert(beltHeight>.04&&beltHeight<.075,'束带宽度必须能读出腰线，但不能变成胸甲');
  return {hem,ySpan:ySpan(c),cuffWidth:cuff(c,'Robe.Right.Cuff'),hemToChest,waistToChest,waistToChestDepth,beltLip,beltHeight};
}
/** 从实际映射后的衣面测量，而不是断言作者参数变小。
 * 斜率 .43 相当于腰下侧线偏离垂直不超过约 23.3 度。
 * 后片允许相对腰下—膝上弦线有胸厚 5% 的留量；不是要求纸片或绝对直线。
 * 旧候选男女侧线斜率约 .442/.560，后片弦外凸出约胸厚 .087/.130。
 */
function assertHipDrape(c:Cage) {
  const outer=(name:string)=>row(c,'Robe.'+name);
  const y=(name:string)=>outer(name)[0].p[1];
  const halfWidth=(name:string)=>width(c,'Robe.'+name)/2;
  const rear=(name:string)=>-Math.min(...outer(name).map(v=>v.p[2]));
  const depth=(name:string)=>{const z=outer(name).map(v=>v.p[2]);return Math.max(...z)-Math.min(...z);};
  const chord=(name:string,lower:string,value:(name:string)=>number)=>value('BeltFold')+(value(lower)-value('BeltFold'))*(y('BeltFold')-y(name))/(y('BeltFold')-y(lower));
  assert(y('BeltFold')>y('Hip')&&y('Hip')>y('Seat')&&y('Seat')>y('KneeUpper'),'腰髋支撑顺序不能折返');
  const hipSlope=(halfWidth('Hip')-halfWidth('BeltFold'))/(y('BeltFold')-y('Hip'));
  const sideCorner=(halfWidth('Hip')-chord('Hip','Seat',halfWidth))/width(c,'Robe.Chest');
  const rearBulge=Math.max(...['Hip','Seat'].map(name=>rear(name)-chord(name,'KneeUpper',rear)))/depth('Chest');
  const rearReversal=(rear('Hip')-rear('Seat'))/depth('Chest');
  assert(hipSlope>=0&&hipSlope<=.43,'腰下到髋部突扩，不能用侧臀裙撑换取腰线');
  assert(sideCorner<=.065,'腰下侧线出现局部台阶，必须检查三分之四与背面');
  assert(rearBulge<=.05,'后片超出垂落弦线形成硬包，正面宽度通过不能代替后片通过');
  assert(rearReversal<=.012,'后臀先鼓出再向大腿内扣，不能呈包臀球体');
  const waistToChest=width(c,'Robe.Waist')/width(c,'Robe.Chest'),waistToChestDepth=depth('Waist')/depth('Chest');
  assert(waistToChest>=.72&&waistToChest<=.86&&waistToChestDepth>=.70&&waistToChestDepth<=.88,'收回臀部后仍须保留正侧面腰线');
  return {hipSlope,sideCorner,rearBulge,rearReversal,waistToChest,waistToChestDepth};
}
/** 核对真实膝区厚度和内收方向，不靠某个参数或标识存在判断通过。 */
function assertKneeLining(c:Cage) {
  const names=['Hem','Knee','KneeUpper','Seat'];
  let checked=0;
  for(let r=0;r<3;r++) {
    const outer=row(c,'Robe.'+names[r]),inner=row(c,'Robe.Inner.'+names[r]);
    const below=row(c,'Robe.'+names[Math.max(0,r-1)]),above=row(c,'Robe.'+names[r+1]);
    assert.equal(inner.length,outer.length);
    for(let k=0;k<outer.length;k++) {
      const tangent=sub(outer[(k+1)%outer.length].p,outer[(k+outer.length-1)%outer.length].p);
      const along=sub(above[k].p,below[k].p),normal=cross3(tangent,along);
      const delta=sub(outer[k].p,inner[k].p),length=Math.hypot(...normal);
      assert(length>1e-8,'退化衣面不能生成内收');
      assert(Math.abs(Math.hypot(...delta)-.006)<1e-8,'膝区必须保留真实 6mm 作者厚度');
      assert(dot(delta,normal)/(Math.hypot(...delta)*length)>1-1e-8,'内收必须位于作者衣面内侧并沿其法向');
      assert.deepEqual(inner[k].w,outer[k].w,'内外层仍使用相同制作权重');
      checked++;
    }
  }
  return {vertices:checked,thickness:.006,mutationChecks:2};
}
export function checkC1Robe() {
  assert(pierces([.2,.2,-1],[.2,.2,1],[[0,0,0],[1,0,0],[0,1,0]]));
  assert(!pierces([2,2,-1],[2,2,1],[[0,0,0],[1,0,0],[0,1,0]]));
  const piece=make('narrow_long_robe');assertGarmentPiece(piece);
  assert(piece.mesh.vertices.every(v=>v.id.startsWith('Robe.')),'不能复制旧上衣/裙装顶点冒充 C1');
  const source=readFileSync('src/character/wardrobe/assets/narrow-long-robe.ts','utf8');
  assert(!/makeCrossShirt|makeHalfSleeve|makeContinuousSkirt|makeAuthoredTop|makeBody|cloneCage/.test(source),'C1 必须拥有自己的几何');
  const silhouette=assertSilhouette(piece.mesh),kneeLining=assertKneeLining(piece.mesh);
  for(const mutation of ['radial-return','outside-return'] as const) {
    const bad=cloneCage(piece.mesh),outer=row(bad,'Robe.KneeUpper'),inner=row(bad,'Robe.Inner.KneeUpper');
    inner.forEach((v,k)=>{
      if(mutation==='radial-return')v.p[1]=outer[k].p[1];
      else v.p=outer[k].p.map((n,a)=>2*n-v.p[a]) as typeof v.p;
    });
    assert.throws(()=>assertKneeLining(bad),`${mutation} 必须被内收方向检查拦截`);
  }
  const t=triangles(piece.mesh),self=findIntersections(piece.mesh,piece.mesh.vertices.map(v=>v.p),t.indices);
  assert.equal(self.hits,0,JSON.stringify({reason:'C1 静态自交',...self}));
  assert.deepEqual([...piece.covers].sort(),['torso','upperArm','forearm','pelvis','thigh'].sort());
  assert(!WARDROBE_GAPS.map(g=>String(g.id)).includes('narrow-sleeve-long-robe'));
  const entry=WARDROBE_TAXONOMY.find(e=>e.id==='narrow_long_robe');assert(entry&&entry.slot==='top'&&entry.length==='calf');
  const redyed=makeTop(createRecipe({slots:{top:'narrow_long_robe'},dyes:{primary:'#777777',secondary:'#777777',accent:'#777777'}}))!;
  assert.deepEqual(piece.mesh.vertices,redyed.mesh.vertices,'染色不能改变坐标或权重');
  assert.deepEqual(piece.mesh.faces.map(f=>[f.v,f.region]),redyed.mesh.faces.map(f=>[f.v,f.region]),'染色不能改变拓扑或覆盖语义');
  assert.deepEqual(piece.covers,redyed.covers);assert.deepEqual(piece.sealedInterfaces,redyed.sealedInterfaces);
  for(const mutation of ['short','wide-cuff','wide-hem','bucket-waist','bucket-side','flat-belt'] as const) {
    const bad=cloneCage(piece.mesh);
    if(mutation==='short')for(const v of row(bad,'Robe.Hem'))v.p[1]=1.02;
    if(mutation==='wide-hem')for(const v of row(bad,'Robe.Hem'))v.p[0]*=1.7;
    if(mutation==='wide-cuff')for(const v of row(bad,'Robe.Right.Cuff')){v.p[0]=.508+(v.p[0]-.508)*2;v.p[1]=.904+(v.p[1]-.904)*2;}
    if(mutation==='bucket-waist')for(const v of row(bad,'Robe.Waist'))v.p[0]*=1.28;
    if(mutation==='bucket-side')for(const v of row(bad,'Robe.Waist'))v.p[2]*=1.28;
    if(mutation==='flat-belt')row(bad,'Robe.BeltLower').forEach((v,k)=>{const base=row(bad,'Robe.BeltFold')[k];v.p[0]=base.p[0];v.p[2]=base.p[2];});
    assert.throws(()=>assertSilhouette(bad),`${mutation} 故障必须被轮廓门槛拦截`);
  }
  // 两种固定映射均测量：女性比例场不能由男性作者截图代替。
  const hipDrape=[];
  for(const bodyType of BODY_TYPES) {
    const mapped=cloneCage(piece.mesh),recipe=createRecipe({bodyType});
    for(const v of mapped.vertices)v.p=shapePoint(v.p,recipe);
    hipDrape.push({bodyType,...assertHipDrape(mapped)});
    for(const mutation of ['hip-step','rear-bulge'] as const) {
      const bad=cloneCage(mapped);
      for(const v of row(bad,'Robe.Hip')) {
        if(mutation==='hip-step')v.p[0]*=1.25;
        if(mutation==='rear-bulge'&&v.p[2]<0)v.p[2]-=.025;
      }
      assert.throws(()=>assertHipDrape(bad),`${bodyType}/${mutation} 必须由真实衣面测量拦截`);
    }
  }
  const combinations:unknown[]=[];
  for(const bodyType of BODY_TYPES)for(const bottom of BOTTOM_IDS) {
    const recipe=createRecipe({bodyType,slots:{top:'narrow_long_robe',bottom,headwear:'none',back:'none',leftHand:'none',rightHand:'none',shoes:'cloth_shoes'}});
    const d=makeCharacter(recipe);assert.equal(d.joints.length,20);assert.equal(triCount(d.body),524);
    assert.equal(recipe.version,5);assert.equal(Object.keys(recipe).length,6);assert.equal(Object.keys(recipe.slots).length,7);
    assert(d.surface.vertices.every(v=>v.p.every(Number.isFinite)));
    const actual=new Map(d.surface.vertices.map(v=>[v.id,v]));
    for(const v of piece.mesh.vertices) {
      const mapped=actual.get(v.id);assert(mapped);assert.deepEqual(mapped.w,v.w);
      assert.deepEqual(mapped.p,shapePoint(v.p,recipe),'男女固定映射必须且只能执行一次');
    }
    assert.deepEqual(makeTop(recipe)!.mesh.vertices,piece.mesh.vertices,'下装选择不能改变长袍');
    const bottomBefore=makeTrousers(recipe),bottomAfter=makeTrousers(createRecipe({...recipe,slots:{...recipe.slots,top:'cross_jacket'}}));
    assert.deepEqual(bottomBefore,bottomAfter,'换长袍不能改写独立下装');
    if(['body','work_pants','work_wrap','long_skirt'].includes(bottom)) {
      const sample=triangles(d.surface,true),hits=findIntersections(d.surface,d.surface.vertices.map(v=>v.p),sample.indices,sample.focus);
      assert.equal(hits.hits,0,JSON.stringify({bodyType,bottom,reason:'C1 静态混搭贯穿',...hits}));
    }
    combinations.push({bodyType,bottom,triangles:triCount(d.surface),bones:d.joints.length});
  }
  const report={passed:true,testedSha:process.env.REVIEW_HEAD_SHA??'local',silhouette,hipDrape,kneeLining,triangles:triCount(piece.mesh),vertices:piece.mesh.vertices.length,covers:piece.covers,combinations,mutationChecks:6,hipMutationChecks:4,visualApproval:false};
  mkdirSync('review-wardrobe-batch',{recursive:true});writeFileSync('review-wardrobe-batch/c1-robe-numeric.json',JSON.stringify(report,null,2));
  console.log('C1_ROBE_NUMERIC',JSON.stringify(report));
  return report;
}
if(process.argv[1]?.endsWith('check-c1-robe.ts'))checkC1Robe();
