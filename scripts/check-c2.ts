import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {makeTop} from '../src/character/wardrobe/assets/tops';
import {makeTrousers} from '../src/character/wardrobe/assets/trousers';
import {assertGarmentPiece} from './check-garment-assets';
import {shapePoint} from '../src/character/v3/body';
import {makeCharacter} from '../src/character/v3/outfit';
import {createRecipe,B,BODY_TYPES,TOP_IDS,BOTTOM_IDS,type Cage,type Recipe} from '../src/character/v3/types';
import {cloneCage,triCount} from '../src/character/v3/cage';
import {parseRecipeFile,SLOT_OPTIONS} from '../src/character/wardrobe/catalog';
import {WARDROBE_TAXONOMY,WARDROBE_GAPS} from '../src/character/wardrobe/taxonomy';
import {findIntersections,triangles} from './lib/garment-focus-intersections';
import {TOP_PATTERNS,BOTTOM_PATTERNS} from '../src/character/wardrobe/patterns';

export const C2_TOP='court_maid_short_jacket',C2_BOTTOM='court_maid_high_waist_skirt';
const loop=(c:Cage,prefix:string)=>c.vertices.filter(v=>v.id.startsWith(prefix+'.'));
const height=(c:Cage,prefix:string)=>{const l=loop(c,prefix);assert(l.length>0,`缺少真实截面 ${prefix}`);return l.reduce((a,v)=>a+v.p[1],0)/l.length;};
const width=(c:Cage,prefix:string)=>{const l=loop(c,prefix);assert(l.length>0);return Math.max(...l.map(v=>v.p[0]))-Math.min(...l.map(v=>v.p[0]));};
const geometry=(c:Cage)=>({vertices:c.vertices,faces:c.faces.map(f=>({v:f.v,part:f.part,region:f.region})),anchors:c.anchors});
/** 实际膝环的双权重独立公式，供原全目录变形检查调用；不把裙装误当裤腿。 */
export function assertC2Knees(c:Cage) {
  for(const [name,y]of [['KneeUpper',.580],['Knee',.489],['KneeLower',.400]] as const){
    const ring=loop(c,`MaidSkirt.${name}`);assert.equal(ring.length,16);
    for(const v of ring){assert.equal(v.p[1],y);assert.deepEqual(v.w.slice(0,2),v.p[0]>0?[B.RightThigh,B.RightShin]:[B.LeftThigh,B.LeftShin]);const w=Math.max(0,Math.min(1,.5+(y-.489)/(2*(1/22+4*Math.max(0,-v.p[2])))));assert(Math.abs(v.w[2]-w)<1e-12,'前后裙片静态膝梯度损坏');}
  }
}
export function assertC2Shape(j:Cage,s:Cage) {
  assert(height(j,'MaidJacket.Hem')>1.145&&height(j,'MaidJacket.Hem')<1.20,'短襦必须停在高腰');
  assert(height(s,'MaidSkirt.Waist')>1.18&&height(s,'MaidSkirt.Waist')<1.24,'裙头必须为真实高腰');
  assert(height(s,'MaidSkirt.Waist')-height(s,'MaidSkirt.BandFoot')>.065,'裙头需要体积，不是一条染色线');
  assert(height(s,'MaidSkirt.Hem')>=.085&&height(s,'MaidSkirt.Hem')<.12,'长裙保持踝部');
  assert(height(s,'MaidSkirt.Waist')-height(j,'MaidJacket.Hem')>.025,'两件高腰接口必须实际覆盖');
  assert(width(s,'MaidSkirt.Hem')>.62&&width(s,'MaidSkirt.Hem')<.72,'不做巨大皇后裙摆');
  assert(width(s,'MaidSkirt.Seat')<.48,'臀下不能外鼓成裙撑');
  for(const side of ['Right','Left']){
    const cuff=loop(j,`MaidJacket.${side}.Cuff`);assert.equal(cuff.length,6);
    assert(Math.max(...cuff.map(v=>v.p[2]))-Math.min(...cuff.map(v=>v.p[2]))<.08,'不能恢复宽礼服袖');
    assert(cuff.every(v=>v.p[1]<.95),'必须是长袖而非短劳动袖');
  }
  // 同高的浅折棱不是圆椭圆柱：实际截面半径交替变化。
  const hem=loop(s,'MaidSkirt.Hem');assert.equal(hem.length,16);
  const r=hem.map(v=>{const t=(Number(v.id.split('.').at(-1))+.5)*2*Math.PI/16;return Math.abs(v.p[0]/Math.sin(t));});
  assert(Math.max(...r)-Math.min(...r)>.008,'丢失了几何纵向折线');
  assertC2Knees(s);
}
export function checkC2() {
  const recipe=createRecipe({slots:{top:C2_TOP,bottom:C2_BOTTOM}}),j=makeTop(recipe)!,s=makeTrousers(recipe)!;
  assertGarmentPiece(j);assertGarmentPiece(s);assertC2Shape(j.mesh,s.mesh);
  assert(j.mesh.vertices.every(v=>v.id.startsWith('MaidJacket.')));assert(s.mesh.vertices.every(v=>v.id.startsWith('MaidSkirt.')));
  assert.deepEqual(j.covers,['upperArm','forearm'],'短襦不得删掉裸露的腰皮肤');assert.deepEqual(s.covers,['pelvis','thigh','shin']);
  for(const p of [j,s]){
    assert(triCount(p.mesh)<500,'轮廓小套装不堆大量几何');
    const keys=p.mesh.faces.map(f=>[...f.v].sort((a,b)=>a-b).join(','));assert.equal(new Set(keys).size,keys.length,'重复面');
    const raw=findIntersections(p.mesh,p.mesh.vertices.map(v=>v.p),triangles(p.mesh).indices);assert.equal(raw.hits,0,'作者态自身贯穿');
    const entries=WARDROBE_TAXONOMY.filter(t=>t.id===p.id);assert.equal(entries.length,1);assert.equal(entries[0].slot,p.slot);assert.equal(SLOT_OPTIONS[p.slot].find(o=>o.id===p.id)!.name,entries[0].name);
  }
  assert(!WARDROBE_GAPS.some(g=>g.id==='court-formal-skirt'));assert(WARDROBE_GAPS.some(g=>g.id==='court-high-rank-ceremonial-skirt'));
  assert.deepEqual(BOTTOM_PATTERNS[C2_BOTTOM].stressOnlyClips,['snatch']);assert(!TOP_PATTERNS[C2_TOP].stressOnlyClips);
  for(const f of ['court-maid-jacket','court-maid-skirt'])assert(!/makeContinuousSkirt|makeCrossShirt|makeShortJacket|makeNarrowLongRobe/.test(readFileSync(`src/character/wardrobe/assets/${f}.ts`,'utf8')),'不能借旧资产工厂换名');
  for(const id of ['short_work_jacket','cross_jacket'] as const){const other=makeTop(createRecipe({slots:{top:id}}))!;assert(height(j.mesh,'MaidJacket.Hem')-height(other.mesh,'Top.Hem')>.12,'衣身没有明显缩短');}
  const old=makeTrousers(createRecipe({slots:{bottom:'long_skirt'}}))!;
  assert(height(s.mesh,'MaidSkirt.Waist')-height(old.mesh,'Skirt.Waist')>.10);assert(width(s.mesh,'MaidSkirt.Hem')>width(old.mesh,'Skirt.Hem')+.025);
  const assemblies=[];
  for(const bodyType of BODY_TYPES){
    const r=createRecipe({...recipe,bodyType});assert.deepEqual(parseRecipeFile(JSON.stringify(r)),r);assert.equal(Object.keys(r).length,6);assert.equal(Object.keys(r.slots).length,7);
    const data=makeCharacter(r);assert.equal(data.joints.length,20);assert(!data.surface.vertices.some(v=>/^(CrossCollar|InnerCollar)/.test(v.id)),'独立前襟不能再叠旧领条');
    for(const p of [j,s])for(const v of p.mesh.vertices){const actual=data.surface.vertices.find(x=>x.id===v.id);assert(actual,'单件顶点在装配中丢失');assert.deepEqual(actual.p,shapePoint(v.p,r),'男女映射不止一次或未执行');assert.deepEqual(actual.w,v.w);}
    const dyed=createRecipe({...r,dyes:{primary:'#897766',secondary:'#453426',accent:'#b3c4d5'}});
    assert.deepEqual(geometry(makeTop(dyed)!.mesh),geometry(j.mesh));assert.deepEqual(geometry(makeTrousers(dyed)!.mesh),geometry(s.mesh));
    // 全部合法另一槽位均可装配；静态独立性，不宣称所有混搭动作都完美。
    for(const bottom of BOTTOM_IDS){const rr=createRecipe({...r,slots:{...r.slots,bottom}});assert.deepEqual(geometry(makeTop(rr)!.mesh),geometry(j.mesh));const d=makeCharacter(rr);assert(d.surface.vertices.every(v=>v.p.every(Number.isFinite)));assemblies.push({bodyType,top:C2_TOP,bottom});}
    for(const top of TOP_IDS){const rr=createRecipe({...r,slots:{...r.slots,top}});assert.deepEqual(geometry(makeTrousers(rr)!.mesh),geometry(s.mesh));const d=makeCharacter(rr);assert(d.surface.vertices.every(v=>v.p.every(Number.isFinite)));assemblies.push({bodyType,top,bottom:C2_BOTTOM});}
  }
  let mutationChecks=0;
  for(const mutate of [
    (a:Cage,b:Cage)=>{loop(a,'MaidJacket.Hem').forEach(v=>v.p[1]=1.03);},
    (a:Cage,b:Cage)=>{loop(b,'MaidSkirt.Waist').forEach(v=>v.p[1]=1.075);},
    (a:Cage,b:Cage)=>{loop(b,'MaidSkirt.BandFoot').forEach(v=>v.p[1]=1.19);},
    (a:Cage,b:Cage)=>{loop(b,'MaidSkirt.Hem').forEach(v=>v.p[0]*=1.6);},
    (a:Cage,b:Cage)=>{loop(b,'MaidSkirt.Seat').forEach(v=>v.p[0]*=1.6);},
    (a:Cage,b:Cage)=>{loop(a,'MaidJacket.Right.Cuff').forEach(v=>v.p[2]*=3);},
    (a:Cage,b:Cage)=>{loop(b,'MaidSkirt.KneeUpper').forEach(v=>v.w[2]=.5);},
  ]){const a=cloneCage(j.mesh),b=cloneCage(s.mesh);mutate(a,b);assert.throws(()=>assertC2Shape(a,b));mutationChecks++;}
  const report={passed:true,testedSha:process.env.REVIEW_HEAD_SHA??'local',jacket:{vertices:j.mesh.vertices.length,triangles:triCount(j.mesh)},skirt:{vertices:s.mesh.vertices.length,triangles:triCount(s.mesh)},assemblies:assemblies.length,mutationChecks,visualApproval:false};
  mkdirSync('review/c2',{recursive:true});writeFileSync('review/c2/c2-numeric.json',JSON.stringify(report,null,2));console.log('C2_NUMERIC',JSON.stringify(report));return report;
}
if(process.argv[1]?.endsWith('check-c2.ts'))checkC2();
