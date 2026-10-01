import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { B, BODY_TYPES, HAIR_STYLE_IDS, createRecipe, emptySlots, type Cage } from '../src/character/v3/types';
import { cloneCage, cross, sub, triCount } from '../src/character/v3/cage';
import { makeCharacter } from '../src/character/v3/outfit';
import { parseRecipeFile, SLOT_OPTIONS } from '../src/character/wardrobe/catalog';
import { WARDROBE_TAXONOMY_BY_ID } from '../src/character/wardrobe/taxonomy';
import { makeOfficialCap, OFFICIAL_CAP_ID, OFFICIAL_CAP_VERSION, OFFICIAL_CAP_TRIANGLES } from '../src/character/wardrobe/official-headwear';

const span = (c:Cage, prefix:string, axis:number):number => {
  const values=c.vertices.filter(v=>v.id.startsWith(prefix)).map(v=>v.p[axis]);
  assert(values.length>0,`缺少 ${prefix}`);
  return Math.max(...values)-Math.min(...values);
};
const signature = (c:Cage):string => JSON.stringify({vertices:c.vertices,faces:c.faces.map(({color,...f})=>f),anchors:c.anchors});
function select(c:Cage,prefix:string):Cage {
  const ids=c.vertices.map((v,i)=>v.id.startsWith(prefix)?i:-1).filter(i=>i>=0),map=new Map(ids.map((id,i)=>[id,i]));
  return {vertices:ids.map(i=>c.vertices[i]),faces:c.faces.filter(f=>f.v.every(i=>map.has(i))).map(f=>({...f,v:f.v.map(i=>map.get(i)!)})),anchors:{}};
}

/** 尺寸按帽底宽归一化，男女共享形态约束；颜色不参与“结构区别”判定。 */
function assertOfficialForm(c:Cage):void {
  assert.equal(c.vertices.length,48,'帽身与两翼必须是完整的三个作者实体');
  assert.equal(triCount(c),OFFICIAL_CAP_TRIANGLES);
  const edges=new Map<string,number>(),used=new Set<number>();
  for(const f of c.faces){
    assert.equal(f.region,'equipment');
    for(let i=0;i<f.v.length;i++){
      const a=f.v[i],b=f.v[(i+1)%f.v.length],key=a<b?`${a}:${b}`:`${b}:${a}`;
      used.add(a);edges.set(key,(edges.get(key)||0)+1);
    }
    for(let i=1;i<f.v.length-1;i++)assert(Math.hypot(...cross(sub(c.vertices[f.v[i]].p,c.vertices[f.v[0]].p),sub(c.vertices[f.v[i+1]].p,c.vertices[f.v[0]].p)))>1e-10,'退化帽面');
  }
  assert.equal(used.size,c.vertices.length);
  assert([...edges.values()].every(n=>n===2),'官帽自身必须闭合且无非流形边');
  for(const v of c.vertices){assert(v.p.every(Number.isFinite));assert.deepEqual(v.w,[B.Head,B.Head,1]);}
  const baseWidth=span(c,'OfficialCap.Shell.Base.',0);
  const fullWidth=span(c,'OfficialCap.',0);
  assert(fullWidth/baseWidth>2.2&&fullWidth/baseWidth<2.65,'长薄翅应形成克制但明确的横向轮廓');
  assert(span(c,'OfficialCap.Shell.Roof.',0)/baseWidth>.86,'不能回退为方冠式强收尖帽身');
  const roof=c.vertices.filter(v=>v.id.startsWith('OfficialCap.Shell.Roof.'));
  const front=roof.filter(v=>v.p[2]>0),back=roof.filter(v=>v.p[2]<0);
  const meanY=(vs:typeof roof)=>vs.reduce((n,v)=>n+v.p[1],0)/vs.length;
  assert(meanY(back)-meanY(front)>baseWidth*.12,'前低后高的屋面不能退回平顶');
  const floor=Math.min(...c.vertices.filter(v=>v.id.startsWith('OfficialCap.Shell.Base.')).map(v=>v.p[1]));
  assert(c.vertices.every(v=>v.p[1]>=floor-1e-9),'文官帽不能附加护颊或护颈');
  for(const side of ['Left','Right']){
    const prefix=`OfficialCap.${side}Wing.`;
    assert.equal(c.vertices.filter(v=>v.id.startsWith(prefix)).length,12);
    assert(span(c,prefix+'Tip.',1)<span(c,prefix+'Root.',1)*.7,'薄翅向末端收薄');
    assert(span(c,prefix,1)/baseWidth<.18,'不能变为肥厚横冠');
  }
  for(const v of c.vertices.filter(v=>v.id.startsWith('OfficialCap.LeftWing.'))){
    const opposite=c.vertices.find(x=>x.id===v.id.replace('LeftWing','RightWing'));assert(opposite);
    assert(Math.abs(v.p[0]+opposite.p[0])<1e-8&&Math.abs(v.p[1]-opposite.p[1])<1e-8&&Math.abs(v.p[2]-opposite.p[2])<1e-8,'左右薄翅必须镜像');
  }
}

/** 由现有 check:lightwear 调用，不新增 package 命令或 Actions。 */
export function checkC3Headwear():void {
  const rows:unknown[]=[],mixes:unknown[]=[];
  assert.equal(SLOT_OPTIONS.headwear.filter(x=>x.id===OFFICIAL_CAP_ID).length,1);
  assert.equal(WARDROBE_TAXONOMY_BY_ID.get(OFFICIAL_CAP_ID)?.name,'正式官帽');
  const combinations=[
    ['cross_jacket','work_pants'],['narrow_long_robe','work_pants'],
    ['court_maid_short_jacket','court_maid_high_waist_skirt'],
    ['medium_armor','medium_armor_skirt'],['heavy_armor','heavy_armor_skirt'],
    ['work_vest','short_trousers'],
  ] as const;
  for(const bodyType of BODY_TYPES)for(const hairStyle of HAIR_STYLE_IDS){
    const recipe=createRecipe({bodyType,hairStyle,slots:{...emptySlots(),headwear:OFFICIAL_CAP_ID}});
    const source=makeOfficialCap(recipe),data=makeCharacter(recipe),hat=select(data.surface,'OfficialCap.');
    assertOfficialForm(source);assertOfficialForm(hat);
    assert.equal(data.joints.length,20);assert.equal(recipe.version,5);
    assert.equal(Object.keys(recipe).length,6);assert.equal(Object.keys(recipe.slots).length,7);
    assert.deepEqual(parseRecipeFile(JSON.stringify(recipe)),recipe);
    assert(!data.surface.vertices.some(v=>v.id.startsWith('CustomHair')),'戴帽时不应露出独立发髻');
    const removed=createRecipe({...recipe,slots:{...recipe.slots,headwear:'none'}});
    const bare=makeCharacter(removed);
    assert.deepEqual(data.body,bare.body);assert.deepEqual(data.joints,bare.joints);
    assert(bare.surface.vertices.some(v=>v.id.startsWith('CustomHair')),'摘帽必须恢复原发髻');
    assert.deepEqual(bare.surface,makeCharacter(createRecipe({bodyType,hairStyle,slots:emptySlots()})).surface);
    const changed=makeOfficialCap(createRecipe({...recipe,dyes:{primary:'#f01870',secondary:'#65b850',accent:'#ffe100'}}));
    assert.equal(signature(source),signature(changed),'染色不能改变几何或权重');
    assert.notDeepEqual(source.faces.map(f=>f.color),changed.faces.map(f=>f.color));
    const scholar=makeCharacter(createRecipe({...recipe,slots:{...recipe.slots,headwear:'scholar_cap'}})).surface;
    const scholarWidth=span(scholar,'CapWings',0),officialWidth=span(hat,'OfficialCap.',0);
    assert(officialWidth>scholarWidth*1.7,'官帽长翅与方冠短横条必须有明确差别');
    const scholarTaper=span(scholar,'WardrobeCapTop.',0)/span(scholar,'WardrobeCapBase.',0);
    const officialTaper=span(hat,'OfficialCap.Shell.Roof.',0)/span(hat,'OfficialCap.Shell.Base.',0);
    assert(officialTaper>scholarTaper+.20,'帽身近直立侧壁是第二项真实结构差异');
    rows.push({bodyType,hairStyle,triangles:triCount(hat),logicalVertices:hat.vertices.length,officialWidth,scholarWidth,officialTaper,scholarTaper});
    for(const [top,bottom] of combinations){
      const mixed=createRecipe({...recipe,slots:{...recipe.slots,top,bottom,shoes:'cloth_shoes'}}),assembled=makeCharacter(mixed);
      assert.deepEqual(parseRecipeFile(JSON.stringify(mixed)),mixed);
      assert.deepEqual(select(assembled.surface,'OfficialCap.'),hat,'换衣服不能重塑或偏移帽子');
      assert.equal(assembled.joints.length,20);
      const without=makeCharacter(createRecipe({...mixed,slots:{...mixed.slots,headwear:'none'}}));
      assert.deepEqual(assembled.garments,without.garments,'官帽不得更改衣裤覆盖或资产');
      mixes.push({bodyType,hairStyle,top,bottom});
    }
  }
  const base=makeOfficialCap(createRecipe()),mutations:Record<string,(c:Cage)=>void>={
    'missing-face':c=>{c.faces.pop();},
    'short-wings':c=>{for(const v of c.vertices)if(v.id.includes('Wing.'))v.p[0]*=.55;},
    'flat-roof':c=>{for(const v of c.vertices)if(v.id.includes('.Roof.'))v.p[1]=1.85;},
    'pointed-crown':c=>{for(const v of c.vertices)if(v.id.includes('.Roof.'))v.p[0]*=.65;},
    'wrong-bone':c=>{c.vertices[0].w=[B.Hips,B.Hips,1];},
    'asymmetric-wing':c=>{c.vertices.find(v=>v.id==='OfficialCap.LeftWing.Tip.0')!.p[2]+=.01;},
  };
  for(const [name,mutate] of Object.entries(mutations)){const broken=cloneCage(base);mutate(broken);assert.throws(()=>assertOfficialForm(broken),name+' 故障反例必须失败');}
  const valid=createRecipe({slots:{headwear:OFFICIAL_CAP_ID}});
  assert.throws(()=>parseRecipeFile(JSON.stringify({...valid,slots:{...valid.slots,headwear:'official_winged_cap_missing'}})));
  const report={passed:true,asset:OFFICIAL_CAP_ID,version:OFFICIAL_CAP_VERSION,rows,mixes,mutationChecks:Object.keys(mutations),scope:'作者及真实男女装配结构、闭合、刚性权重、染色、混搭、V5往返；帽发贯穿沿用完整 lightwear，真实动作图片由 garment-focus 另行验收。'};
  mkdirSync('review-wardrobe-batch',{recursive:true});
  writeFileSync('review-wardrobe-batch/c3-headwear-numeric.json',JSON.stringify(report,null,2));
  console.log('C3_HEADWEAR_NUMERIC',JSON.stringify({passed:true,rows:rows.length,mixes:mixes.length,triangles:OFFICIAL_CAP_TRIANGLES,mutationChecks:Object.keys(mutations)}));
}
