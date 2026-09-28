import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRecipe, BODY_TYPES, BOTTOM_IDS, type Cage, type TopId } from '../src/character/v3/types';
import { cloneCage, triCount } from '../src/character/v3/cage';
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
  assert(waistToChest>=.95&&waistToChest<=1.10,'直身不能缩成收腰礼裙');
  return {hem,ySpan:ySpan(c),cuffWidth:cuff(c,'Robe.Right.Cuff'),hemToChest,waistToChest};
}
export function checkC1Robe() {
  assert(pierces([.2,.2,-1],[.2,.2,1],[[0,0,0],[1,0,0],[0,1,0]]));
  assert(!pierces([2,2,-1],[2,2,1],[[0,0,0],[1,0,0],[0,1,0]]));
  const piece=make('narrow_long_robe');assertGarmentPiece(piece);
  assert(piece.mesh.vertices.every(v=>v.id.startsWith('Robe.')),'不能复制旧上衣/裙装顶点冒充 C1');
  const source=readFileSync('src/character/wardrobe/assets/narrow-long-robe.ts','utf8');
  assert(!/makeCrossShirt|makeHalfSleeve|makeContinuousSkirt|makeAuthoredTop|makeBody|cloneCage/.test(source),'C1 必须拥有自己的几何');
  const silhouette=assertSilhouette(piece.mesh);
  const t=triangles(piece.mesh),self=findIntersections(piece.mesh,piece.mesh.vertices.map(v=>v.p),t.indices);
  assert.equal(self.hits,0,JSON.stringify({reason:'C1 静态自交',...self}));
  assert.deepEqual([...piece.covers].sort(),['torso','upperArm','forearm','pelvis','thigh'].sort());
  assert(!WARDROBE_GAPS.map(g=>String(g.id)).includes('narrow-sleeve-long-robe'));
  const entry=WARDROBE_TAXONOMY.find(e=>e.id==='narrow_long_robe');assert(entry&&entry.slot==='top'&&entry.length==='calf');
  const redyed=makeTop(createRecipe({slots:{top:'narrow_long_robe'},dyes:{primary:'#777777',secondary:'#777777',accent:'#777777'}}))!;
  assert.deepEqual(piece.mesh.vertices,redyed.mesh.vertices,'染色不能改变坐标或权重');
  assert.deepEqual(piece.mesh.faces.map(f=>[f.v,f.region]),redyed.mesh.faces.map(f=>[f.v,f.region]),'染色不能改变拓扑或覆盖语义');
  assert.deepEqual(piece.covers,redyed.covers);assert.deepEqual(piece.sealedInterfaces,redyed.sealedInterfaces);
  for(const mutation of ['short','wide-cuff','wide-hem'] as const) {
    const bad=cloneCage(piece.mesh);
    if(mutation==='short')for(const v of row(bad,'Robe.Hem'))v.p[1]=1.02;
    if(mutation==='wide-hem')for(const v of row(bad,'Robe.Hem'))v.p[0]*=1.7;
    if(mutation==='wide-cuff')for(const v of row(bad,'Robe.Right.Cuff')){v.p[0]=.508+(v.p[0]-.508)*2;v.p[1]=.904+(v.p[1]-.904)*2;}
    assert.throws(()=>assertSilhouette(bad),`${mutation} 故障必须被轮廓门槛拦截`);
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
  const report={passed:true,testedSha:process.env.REVIEW_HEAD_SHA??'local',silhouette,triangles:triCount(piece.mesh),vertices:piece.mesh.vertices.length,covers:piece.covers,combinations,mutationChecks:3,visualApproval:false};
  mkdirSync('review-wardrobe-batch',{recursive:true});writeFileSync('review-wardrobe-batch/c1-robe-numeric.json',JSON.stringify(report,null,2));
  console.log('C1_ROBE_NUMERIC',JSON.stringify(report));
  return report;
}
if(process.argv[1]?.endsWith('check-c1-robe.ts'))checkC1Robe();
