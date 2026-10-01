import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BODY_TYPES, BOTTOM_IDS, createRecipe, emptySlots, type Cage } from '../src/character/v3/types';
import { cloneCage, triCount } from '../src/character/v3/cage';
import { makeBody, shapePoint } from '../src/character/v3/body';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { parseRecipeFile, randomizeCharacter, SLOT_OPTIONS } from '../src/character/wardrobe/catalog';
import { WARDROBE_TAXONOMY } from '../src/character/wardrobe/taxonomy';
import { assertGarmentPiece } from './check-garment-assets';
import { findIntersections, triangles } from './lib/garment-focus-intersections';

const ID='attendant_fitted_long_robe' as const;
const row=(c:Cage,prefix:string)=>{const a=c.vertices.filter(v=>v.id.startsWith(prefix+'.'));assert(a.length,`缺少 ${prefix}`);return a;};
const span=(c:Cage,prefix:string,axis=0)=>{const a=row(c,prefix).map(v=>v.p[axis]);return Math.max(...a)-Math.min(...a);};
const cuff=(c:Cage,prefix:string)=>{const a=row(c,prefix).map(v=>v.p[0]*.866+v.p[1]*.5);return Math.max(...a)-Math.min(...a);};
function silhouette(c:Cage,reference:Cage,body:Cage){
  const shoulderRatio=span(c,'Attendant.Shoulder')/span(reference,'Robe.Shoulder');
  const shoulderCapRatio=Math.max(...row(c,'Attendant.Right.SleeveHead').map(v=>v.p[0]))/Math.max(...row(reference,'Robe.Right.Shoulder').map(v=>v.p[0]));
  assert(shoulderCapRatio<.97,'窄肩必须包含真实袖山，不能只测衣身肩圈');
  const cuffRatio=cuff(c,'Attendant.Right.Cuff')/cuff(reference,'Robe.Right.Cuff');
  const waistRatio=span(c,'Attendant.Waist')/span(reference,'Robe.Waist');
  const hemRatio=span(c,'Attendant.Hem')/span(reference,'Robe.Hem');
  const waistToChest=span(c,'Attendant.Waist')/span(c,'Attendant.Chest');
  const waistDepth=span(c,'Attendant.Waist',2)/span(c,'Attendant.Chest',2);
  assert(shoulderRatio<.975,'必须收敛肩部，不能只是窄袖直袍换色');
  assert(cuffRatio<.85,'肘下/袖口必须比 C1 明显收敛');
  assert(waistRatio<.99&&waistToChest>.73&&waistToChest<.87,'轻收腰必须真实、克制，不做水桶或极端细腰');
  assert(waistDepth>.70&&waistDepth<.89,'侧面必须保留适量胸背与腰线');
  assert(hemRatio<.8,'前后窄长片不能退化成 C1 整圈展摆');
  const front=row(c,'Attendant.Hem').filter(v=>v.p[2]>0),back=row(c,'Attendant.Hem').filter(v=>v.p[2]<0);
  const frontY=front[0].p[1],backY=back[0].p[1];
  assert(frontY-backY>.02&&frontY-backY<.06,'必须有真实、克制的前短后长');
  assert(frontY<row(reference,'Robe.Hem')[0].p[1]-.02,'不能回缩成短衣');
  assert(row(c,'Attendant.SlitRoot')[0].p[1]-frontY>.3,'两侧开衩必须有实际纵向开口');
  assert(!c.vertices.some(v=>/^Attendant\.(UpperPanel|KneeUpper|Knee|HemFacing|Hem)\.(6|11)$/.test(v.id)),'开衩下方不得恢复封筒侧列');
  const hipSlope=(span(c,'Attendant.Hip')-span(c,'Attendant.WaistLower'))/2/(row(c,'Attendant.WaistLower')[0].p[1]-row(c,'Attendant.Hip')[0].p[1]);
  const bodyHipWidth=body.vertices.find(v=>v.id==='SkinPelvis.Right.Root.2')!.p[0]-body.vertices.find(v=>v.id==='SkinPelvis.Left.Root.2')!.p[0];
  const hipClearance=span(c,'Attendant.Hip')/bodyHipWidth;
  assert(hipClearance>1.025&&hipClearance<1.09,'髋部必须跟随固定人体留量，不能挤进人体或膨胀成水桶');
  assert(hipSlope>=0&&hipSlope<.6,'男女腰髋连续过渡，不以收腰为由削穿人体');
  const hem=row(c,'Attendant.Hem'),ventGap=Math.abs(hem.find(v=>v.id.endsWith('.5'))!.p[2]-hem.find(v=>v.id.endsWith('.7'))!.p[2])/span(c,'Attendant.Hem',2);
  assert(ventGap>.06&&ventGap<.14,'侧开衩应是窄缝，不是大面积开口围片');
  return{shoulderRatio,shoulderCapRatio,cuffRatio,waistRatio,hemRatio,waistToChest,waistDepth,frontY,backY,hipSlope,hipClearance,ventGap};
}
export function checkC4Robe(){
  const recipe=createRecipe({slots:{top:ID}}),piece=makeTop(recipe)!;
  assertGarmentPiece(piece);
  assert(triCount(piece.mesh)<=900&&piece.mesh.vertices.length<=460,'C4 仍应保持一档低模预算');
  assert(piece.mesh.vertices.every(v=>v.id.startsWith('Attendant.')),'独立作者命名不可成为旧资产别名');
  const source=readFileSync('src/character/wardrobe/assets/attendant-fitted-long-robe.ts','utf8');
  assert(!/makeNarrowLongRobe|makeCourtMaidJacket|makeContinuousSkirt|makeBody|cloneCage|recipe\.bodyType|recipe\.slots\.bottom/.test(source),'不得读取体型/下装临时改形或调用旧服饰工厂');
  assert.deepEqual([...piece.covers].sort(),['torso','upperArm','forearm','pelvis'].sort(),'开衩必须保留可见大腿/小腿皮肤');
  const ref=makeTop(createRecipe({slots:{top:'narrow_long_robe'}}))!.mesh;
  const body=makeBody(),authored=silhouette(piece.mesh,ref,body);
  const t=triangles(piece.mesh),self=findIntersections(piece.mesh,piece.mesh.vertices.map(v=>v.p),t.indices);
  assert.equal(self.hits,0,JSON.stringify({reason:'C4 作者态自交',...self}));
  const dyed=makeTop(createRecipe({...recipe,dyes:{primary:'#777777',secondary:'#777777',accent:'#777777'}}))!;
  assert.deepEqual(dyed.mesh.vertices,piece.mesh.vertices,'染色不能改变几何或权重');
  assert.deepEqual(dyed.mesh.faces.map(f=>[f.v,f.region]),piece.mesh.faces.map(f=>[f.v,f.region]));
  assert.deepEqual(dyed.covers,piece.covers);assert.deepEqual(dyed.sealedInterfaces,piece.sealedInterfaces);
  assert.equal(SLOT_OPTIONS.top.filter(x=>x.id===ID&&x.name==='收袖内侍长衣').length,1);
  const entries=WARDROBE_TAXONOMY.filter(x=>x.id===ID);assert.equal(entries.length,1);assert.equal(entries[0].slot,'top');
  assert.deepEqual(parseRecipeFile(JSON.stringify(recipe)),recipe);assert.equal(Object.keys(recipe).length,6);assert.equal(Object.keys(recipe.slots).length,7);
  for(let seed=0;seed<200;seed++)assert.notEqual(randomizeCharacter(createRecipe(),seed).slots.top,ID,'不能进入默认平民随机池');
  const mutations=['wide-shoulder','wide-cuff','barrel-waist','wide-hem','same-length','hip-bulge','wide-cap','wide-slit'] as const;
  for(const name of mutations){
    const bad=cloneCage(piece.mesh);
    if(name==='wide-shoulder')row(bad,'Attendant.Shoulder').forEach(v=>v.p[0]*=1.2);
    if(name==='wide-cuff')row(bad,'Attendant.Right.Cuff').forEach(v=>{v.p[0]=.508+(v.p[0]-.508)*1.7;v.p[1]=.904+(v.p[1]-.904)*1.7;});
    if(name==='barrel-waist')row(bad,'Attendant.Waist').forEach(v=>v.p[0]*=1.35);
    if(name==='wide-hem')row(bad,'Attendant.Hem').forEach(v=>v.p[0]*=1.6);
    if(name==='same-length')row(bad,'Attendant.Hem').forEach(v=>v.p[1]=.35);
    if(name==='hip-bulge')row(bad,'Attendant.Hip').forEach(v=>v.p[0]*=1.4);
    if(name==='wide-cap')row(bad,'Attendant.Right.SleeveHead').forEach(v=>v.p[0]*=1.25);
    if(name==='wide-slit')row(bad,'Attendant.Hem').filter(v=>/\.(0|5|7|10)$/.test(v.id)).forEach(v=>v.p[2]*=7);
    assert.throws(()=>silhouette(bad,ref,body),`${name} 必须拦截`);
  }
  const hole={...piece,mesh:cloneCage(piece.mesh)};hole.mesh.faces.splice(hole.mesh.faces.findIndex(f=>f.v.some(i=>hole.mesh.vertices[i].id==='Attendant.SlitRoot.6')),1);assert.throws(()=>assertGarmentPiece(hole),'开衩根部丢面仍阻塞');
  const badWeight={...piece,mesh:cloneCage(piece.mesh)};badWeight.mesh.vertices[0].w[0]=20;assert.throws(()=>assertGarmentPiece(badWeight),'不得增加第21骨');
  const rows=[];
  for(const bodyType of BODY_TYPES){
    const r=createRecipe({bodyType,slots:{top:ID}}),mapped=cloneCage(piece.mesh),mappedRef=cloneCage(ref),mappedBody=cloneCage(body);
    for(const c of [mapped,mappedRef,mappedBody])for(const v of c.vertices)v.p=shapePoint(v.p,r);
    const measurements=silhouette(mapped,mappedRef,mappedBody);
    const raw=makeTop(r)!;assert.deepEqual(raw.mesh.vertices,piece.mesh.vertices,'作者层不能按男女再映射一次');
    for(const bottom of BOTTOM_IDS){
      const d=makeCharacter(createRecipe({...r,slots:{...emptySlots(),top:ID,bottom,shoes:'cloth_shoes'}}));
      assert.equal(d.joints.length,20);assert(d.surface.faces.some(f=>f.part==='top'));
      assert(!d.surface.vertices.some(v=>/^(CrossCollar|InnerCollar)/.test(v.id)),'C4 自有前襟不能叠旧领条');
      const actual=new Map(d.surface.vertices.filter(v=>v.id.startsWith('Attendant.')).map(v=>[v.id,v]));
      for(const v of mapped.vertices)assert.deepEqual(actual.get(v.id),v,'男女映射必须恰好一次，换 bottom 不可改变 top');
      if(bottom==='body')for(const region of ['thigh','shin'])assert(d.surface.faces.some(f=>f.part==='skin'&&f.region===region),'开衩露腿不得误删皮肤');
      rows.push({bodyType,bottom,measurements});
    }
  }
  const report={passed:true,testedSha:process.env.REVIEW_HEAD_SHA??'local',id:ID,vertices:piece.mesh.vertices.length,triangles:triCount(piece.mesh),authored,rows,mutationChecks:10,staticSelfIntersections:self.hits,visualApproval:false};
  for(const dir of ['review-wardrobe-batch','review/garment-focus/top-'+ID]){mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/c4-numeric.json`,JSON.stringify(report,null,2));}
  console.log('C4_NUMERIC',JSON.stringify(report));return report;
}
if(process.argv[1]?.endsWith('check-c4-robe.ts'))checkC4Robe();
