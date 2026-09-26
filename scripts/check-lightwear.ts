import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import { assertGarmentPiece } from './check-garment-assets';
import { triCount,cloneCage,cross,sub,dot } from '../src/character/v3/cage';
import { createRecipe,B,BODY_TYPES,HAIR_STYLE_IDS,HEADWEAR_IDS,emptySlots,type Cage,type Vec3,type Recipe,type HeadwearId } from '../src/character/v3/types';
import { parseRecipeFile } from '../src/character/wardrobe/catalog';
import { HEADWEAR_GEOMETRY_VERSION } from '../src/character/wardrobe/headwear-fit';
import { isClosedHemContact,type ContactTriangle } from './garment-contact-scope';

const newTops=['work_vest','short_work_jacket'] as const,newBottoms=['short_trousers'] as const;
const contrast={primary:'#fa1945',secondary:'#12cee7',accent:'#ffda16'};
const rows:any[]=[],mixes:any[]=[],hats:any[]=[];
const maxX=(c:Cage)=>Math.max(...c.vertices.map(v=>Math.abs(v.p[0])));
const signature=(c:Cage)=>JSON.stringify({v:c.vertices,f:c.faces.map(f=>({v:f.v,region:f.region}))});
/** 背心四个封口必须跟随主布色；独立资产和最终装配都执行同一断言。 */
function assertVestCapColors(c:Cage,interfaces:Record<string,number[]>,primary:string){
  assert.deepEqual(Object.keys(interfaces).sort(),['LeftCuff','RightCuff','neck','waist']);
  for(const [name,loop] of Object.entries(interfaces)){
    assert(Array.isArray(loop)&&loop.length>=3,`${name} 缺少封口锚点`);
    const caps=c.faces.filter(f=>f.v.length===loop.length&&f.v.every(i=>loop.includes(i)));
    assert.equal(caps.length,1,`${name} 必须恰好有一个直接 Cap 面`);
    assert.equal(caps[0].color,primary,`${name} Cap 必须使用衣身主布色，不能使用内衬、缘边或肤色`);
  }
}
function assertShort(c:Cage,skirt:boolean){
  assert.equal(triCount(c),skirt?176:164);
  assert(c.vertices.every(v=>v.p[1]>=.5),'短装有膝下裤管');
  assert.equal(c.faces.filter(f=>f.region==='pelvis').length,skirt?24:25,'短装腰臀/四片裆底或腰口 Cap 数量错误');
  if(!skirt)assert(!c.vertices.some(v=>v.id.includes('CuffInset')),'封口短裤不应继续保留内缩裤口环');
  for(const side of ['Right','Left']){
    const label=skirt?'Hem':'Cuff';
    const loop=c.vertices.filter(v=>v.id.startsWith(`Shorts.${side}.${label}.`));assert.equal(loop.length,8);
    for(const v of loop){
      assert.equal(v.p[1],skirt?.511:.507);
      const thigh=side==='Right'?B.RightThigh:B.LeftThigh,shin=side==='Right'?B.RightShin:B.LeftShin;
      assert.equal(v.w[0],thigh);assert.equal(v.w[1],shin);
      const originalZ=skirt?v.p[2]:v.p[2]/1.10;
      const gradient=Math.max(0,Math.min(1,.5+(v.p[1]-.489)/(2*(1/22+4*Math.max(0,-originalZ)))));
      const expected=skirt?gradient:gradient*.65+.60*.35;
      assert(Math.abs(v.w[2]-expected)<1e-12,'短下摆必须保留静态膝前/膝后梯度');
    }
  }
}
function pierces(a:Vec3,b:Vec3,p:Vec3[]){
  const e1=sub(p[1],p[0]),e2=sub(p[2],p[0]),d=sub(b,a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-11)return false;
  const s=sub(a,p[0]),inv=1/det,u=inv*dot(s,h);if(u<=1e-6||u>=1-1e-6)return false;
  const q=cross(s,e1),v=inv*dot(d,q),t=inv*dot(e2,q);return v>1e-6&&u+v<1-1e-6&&t>1e-6&&t<1-1e-6;
}
function triangles(c:Cage,accept:(id:string)=>boolean){
  return c.faces.filter(f=>f.v.every(i=>accept(c.vertices[i].id))).flatMap(f=>f.v.slice(1,-1).map((_,k)=>[f.v[0],f.v[k+1],f.v[k+2]]));
}
const hatVertex=(id:string)=>/^(HeavyPalaceHelmet|HeavyFrontierHelmet|HeavyCityHelmet|PalaceHelmet|FrontierHelmet|CityHelmet|Helmet|WardrobeCap|CapTablet|CapWings|WrapKnot|Straw|Headband|JadePin|JadeFinial)/.test(id);
const headwearTriangles:Record<Exclude<HeadwearId,'none'>,number>={
  palace_heavy_helmet:188,palace_heavy_captain_helmet:218,frontier_heavy_helmet:188,frontier_heavy_captain_helmet:218,city_heavy_helmet:188,city_heavy_captain_helmet:218,
  palace_guard_helmet:126,frontier_guard_helmet:112,city_guard_helmet:144,palace_captain_helmet:142,frontier_captain_helmet:142,city_captain_helmet:166,farmer_straw_hat:24,guard_helmet:28,archer_headband:36,cloth_wrap:40,scholar_cap:52,jade_pin:24,
};
// 所有实心帽壳共用原来的同色封底、头发贯穿和包覆规则；重盔不另设豁免。
const militaryShellPrefixes:Partial<Record<HeadwearId,string>>={
  palace_guard_helmet:'PalaceHelmet.Shell',palace_captain_helmet:'PalaceHelmet.Shell',
  frontier_guard_helmet:'FrontierHelmet.Shell',frontier_captain_helmet:'FrontierHelmet.Shell',
  city_guard_helmet:'CityHelmet.Shell',city_captain_helmet:'CityHelmet.Shell',
  palace_heavy_helmet:'HeavyPalaceHelmet.Shell',palace_heavy_captain_helmet:'HeavyPalaceHelmet.Shell',
  frontier_heavy_helmet:'HeavyFrontierHelmet.Shell',frontier_heavy_captain_helmet:'HeavyFrontierHelmet.Shell',
  city_heavy_helmet:'HeavyCityHelmet.Shell',city_heavy_captain_helmet:'HeavyCityHelmet.Shell',
};
const shellPrefix=(id:HeadwearId)=>militaryShellPrefixes[id]??(id==='guard_helmet'?'Helmet':id==='cloth_wrap'||id==='scholar_cap'?'WardrobeCap':undefined);
const baseCapPrefix=(id:HeadwearId)=>militaryShellPrefixes[id]?militaryShellPrefixes[id]+'.Base':id==='guard_helmet'?'HelmetBrim':id==='cloth_wrap'||id==='scholar_cap'?'WardrobeCapBase':undefined;
const isBaseCapTriangle=(c:Cage,id:HeadwearId,tri:number[])=>{
  const prefix=baseCapPrefix(id);return !!prefix&&tri.every(i=>c.vertices[i].id.startsWith(prefix+'.'));
};
function assertHeadwearClosed(c:Cage,id:Exclude<HeadwearId,'none'>){
  const head=new Set(c.vertices.map((v,i)=>hatVertex(v.id)?i:-1).filter(i=>i>=0)),faces=c.faces.filter(f=>f.v.every(i=>head.has(i)));
  assert(head.size>0&&faces.length>0,id+' 缺少头饰几何');
  const counts=new Map<string,number>(),used=new Set<number>();
  for(const f of faces){
    assert.equal(f.region,'equipment',id+' 头饰面必须属于 equipment');
    for(let k=1;k<f.v.length-1;k++)assert(Math.hypot(...cross(sub(c.vertices[f.v[k]].p,c.vertices[f.v[0]].p),sub(c.vertices[f.v[k+1]].p,c.vertices[f.v[0]].p)))>1e-10,id+' 存在退化帽面');
    for(let i=0;i<f.v.length;i++){
      const a=f.v[i],b=f.v[(i+1)%f.v.length],key=a<b?a+':'+b:b+':'+a;
      used.add(a);counts.set(key,(counts.get(key)??0)+1);
    }
  }
  assert.equal(used.size,head.size,id+' 存在未使用头饰顶点');
  assert([...counts.values()].every(n=>n===2),id+' 必须零开放边且无非流形边');
  for(const i of head)assert.deepEqual(c.vertices[i].w,[B.Head,B.Head,1],id+' 必须保持Head刚性权重');
  const tris=faces.reduce((n,f)=>n+f.v.length-2,0);assert.equal(tris,headwearTriangles[id],id+' 头饰面数契约变化');
  const prefix=baseCapPrefix(id);
  if(prefix){
    const base=faces.filter(f=>f.v.every(i=>c.vertices[i].id.startsWith(prefix+'.')));assert.equal(base.length,1,id+' 帽底必须恰好一个Cap');
    const side=faces.find(f=>f.v.some(i=>c.vertices[i].id.startsWith(prefix+'.'))&&!f.v.every(i=>c.vertices[i].id.startsWith(prefix+'.')));assert(side);
    assert.equal(base[0].color,side.color,id+' 帽底必须使用帽身颜色');
  }
  if(id==='archer_headband')assert.equal(new Set(faces.map(f=>f.color)).size,1,'额带封闭薄实体必须保持同一布色');
  return {triangles:tris,boundaryEdges:[...counts.values()].filter(n=>n===1).length};
}
const hairVertex=(id:string)=>/^(Hairline|HairCrown|HairVolume|CustomHair)/.test(id);
function assertHat(c:Cage,id:Exclude<HeadwearId,'none'|'jade_pin'>){
  const hs=triangles(c,hatVertex),hair=triangles(c,hairVertex);assert(hs.length>0&&hair.length>0);
  for(const v of c.vertices.filter(v=>hatVertex(v.id)||hairVertex(v.id)))assert.deepEqual(v.w,[B.Head,B.Head,1]);
  const failures:any[]=[];let capHairContacts=0;
  for(const a of hs)for(const b of hair){
    const x=a.map(i=>c.vertices[i].p),y=b.map(i=>c.vertices[i].p);
    if(![0,1,2].some(t=>pierces(x[t],x[(t+1)%3],y)||pierces(y[t],y[(t+1)%3],x)))continue;
    if(isBaseCapTriangle(c,id,a)){capHairContacts++;continue;}
    failures.push({hat:a.map(i=>c.vertices[i].id),hair:b.map(i=>c.vertices[i].id)});
  }
  assert.equal(failures.length,0,id+' 与头发有非帽底静态贯穿：'+JSON.stringify(failures.slice(0,4)));
  const prefix=shellPrefix(id);
  if(prefix){
    const shell=c.faces.filter(f=>f.v.every(i=>c.vertices[i].id.startsWith(prefix))&&!isBaseCapTriangle(c,id,f.v));
    const h=c.vertices.filter(v=>/^(HairVolume|HairCrown)/.test(v.id));
    const center:Vec3=[0,h.reduce((s,v)=>s+v.p[1],0)/h.length,0];
    for(const f of shell){
      const [a,b,d]=f.v.slice(0,3).map(i=>c.vertices[i].p),normal=cross(sub(b,a),sub(d,a)),len=Math.hypot(...normal);
      // 侧壳和帽顶继续要求包住主头发；只有指定帽底Cap允许头部/头发穿过。
      const sign=dot(normal,sub(center,a))>0?-1:1;
      for(const v of h)assert(sign*dot(normal,sub(v.p,a))/len<-.001,id+' 帽壳没有包住 '+v.id);
    }
  }
  return capHairContacts;
}

for(const bodyType of BODY_TYPES){
  for(const top of newTops){
    const recipe=createRecipe({bodyType,slots:{...emptySlots(),top},dyes:contrast}),p=makeTop(recipe)!;assertGarmentPiece(p);
    assert.equal(triCount(p.mesh),top==='work_vest'?128:200);assert.deepEqual(p.covers,['torso']);
    if(top==='work_vest'){assert.deepEqual(Object.keys(p.openings),[]);assert.deepEqual(Object.keys(p.sealedInterfaces??{}).sort(),['LeftCuff','RightCuff','neck','waist'].sort());assertVestCapColors(p.mesh,p.sealedInterfaces!,recipe.dyes.primary);}
    assert.deepEqual([...new Set(p.mesh.faces.map(f=>f.color))].sort(),Object.values(contrast).sort());
    const changed=makeTop({...recipe,dyes:{primary:'#203040',secondary:'#405060',accent:'#607080'}})!;assert.equal(signature(p.mesh),signature(changed.mesh));
    if(top==='work_vest')assertVestCapColors(changed.mesh,changed.sealedInterfaces!,'#203040');
    const d=makeCharacter(recipe);
    if(top==='work_vest'){
      const assembled=Object.fromEntries(Object.keys(p.sealedInterfaces!).map(name=>[name,d.surface.anchors['top.'+name]]));
      assertVestCapColors(d.surface,assembled,recipe.dyes.primary);
    }
    for(const region of ['upperArm','forearm','hand'])assert.equal(d.surface.faces.filter(f=>f.part==='skin'&&f.region===region).length,d.body.faces.filter(f=>f.region===region).length,'短衣不能误删裸露手臂');
    rows.push({bodyType,id:top,triangles:triCount(p.mesh),logicalVertices:p.mesh.vertices.length,covers:p.covers});
  }
  for(const bottom of newBottoms){
    const recipe=createRecipe({bodyType,slots:{...emptySlots(),bottom},dyes:contrast}),p=makeTrousers(recipe)!;assertGarmentPiece(p);assertShort(p.mesh,false);
    assert.deepEqual(p.covers,['pelvis','thigh']);
    if(bottom==='short_trousers'){assert.deepEqual(Object.keys(p.openings),[]);assert.deepEqual(Object.keys(p.sealedInterfaces??{}).sort(),['LeftCuff','RightCuff','waist'].sort());}
    assert.deepEqual([...new Set(p.mesh.faces.map(f=>f.color))].sort(),Object.values(contrast).sort());
    assert.equal(signature(p.mesh),signature(makeTrousers({...recipe,dyes:{primary:'#102030',secondary:'#304050',accent:'#506070'}})!.mesh));
    const d=makeCharacter(recipe);
    for(const region of ['shin','foot'])assert.equal(d.surface.faces.filter(f=>f.part==='skin'&&f.region===region).length,d.body.faces.filter(f=>f.region===region).length,'短下装不能误删小腿');
    rows.push({bodyType,id:bottom,triangles:triCount(p.mesh),logicalVertices:p.mesh.vertices.length,covers:p.covers});
  }
  for(const top of [...newTops,'rough_tunic','cross_jacket','layered_vest'] as const)for(const bottom of [...newBottoms,'work_pants','work_wrap','true_short_skirt'] as const){
    const recipe=createRecipe({bodyType,slots:{...emptySlots(),top,bottom,shoes:'cloth_shoes'}}),d=makeCharacter(recipe);
    assert.deepEqual(parseRecipeFile(JSON.stringify(recipe)),recipe);assert.equal(recipe.version,5);assert.equal(d.joints.length,20);assert.equal(triCount(d.body),524);
    assert(d.surface.vertices.every(v=>v.p.every(Number.isFinite)));mixes.push({bodyType,top,bottom,triangles:triCount(d.surface),logicalVertices:d.surface.vertices.length});
  }
  for(const hairStyle of HAIR_STYLE_IDS)for(const id of HEADWEAR_IDS.filter((x):x is Exclude<HeadwearId,'none'>=>x!=='none')){
    const recipe=createRecipe({bodyType,hairStyle,slots:{...emptySlots(),headwear:id}}),d=makeCharacter(recipe);
    const topology=assertHeadwearClosed(d.surface,id);
    const capHairContacts=id==='jade_pin'?0:assertHat(d.surface,id);
    const restored=makeCharacter({...recipe,slots:{...recipe.slots,headwear:'none'}});
    const same=makeCharacter(createRecipe({bodyType,hairStyle,slots:emptySlots()}));assert.deepEqual(restored.surface,same.surface);
    hats.push({bodyType,hairStyle,id,passed:true,...topology,capHairContacts});
  }
}
const vest=makeTop(createRecipe({slots:{top:'work_vest'}}))!.mesh,jacket=makeTop(createRecipe({slots:{top:'short_work_jacket'}}))!.mesh;
assert(maxX(jacket)>maxX(vest)*1.5,'短袖与无袖剪影必须不同');
const shorts=makeTrousers(createRecipe({slots:{bottom:'short_trousers'}}))!.mesh;
const longMutation=cloneCage(shorts);longMutation.vertices[0].p[1]=.1;assert.throws(()=>assertShort(longMutation,false));
const wrongWeight=cloneCage(shorts);wrongWeight.vertices.find(v=>v.id==='Shorts.Right.Cuff.0')!.w=[B.Hips,B.Hips,1];assert.throws(()=>assertShort(wrongWeight,false));
// 四处封口逐一注入内衬色、缘边色和肤色，确保检测器会拒绝颜色回归。
const colorSource=makeTop(createRecipe({slots:{top:'work_vest'},dyes:contrast}))!;
let capColorMutationChecks=0;
for(const loop of Object.values(colorSource.sealedInterfaces!))for(const color of [contrast.secondary,contrast.accent,'#c8956e']){
  const wrongColor=cloneCage(colorSource.mesh);
  const capFace=wrongColor.faces.find(f=>f.v.length===loop.length&&f.v.every(i=>loop.includes(i)));assert(capFace);
  capFace.color=color;
  assert.throws(()=>assertVestCapColors(wrongColor,colorSource.sealedInterfaces!,contrast.primary),'封口使用错误色区必须失败');
  capColorMutationChecks++;
}
assert.equal(capColorMutationChecks,12);
const cap:ContactTriangle={ids:['Shorts.Right.Cuff.0','Shorts.Right.Cuff.1','Shorts.Right.Cuff.2'],part:'bottom',region:'thigh'};
const shin:ContactTriangle={ids:['RightKneeUpper.0','RightKneeUpper.1','RightKnee.1'],part:'skin',region:'shin'};
assert(isClosedHemContact('short_trousers',cap,shin));assert(!isClosedHemContact('short_trousers',cap,{...shin,region:'thigh'}));
const shrunk=makeCharacter(createRecipe({slots:{...emptySlots(),headwear:'guard_helmet'}})).surface;
for(const v of shrunk.vertices.filter(v=>hatVertex(v.id))){v.p[0]*=.6;v.p[2]*=.6;}assert.throws(()=>assertHat(shrunk,'guard_helmet'),'必须抓住过小帽壳回归');
let headwearHoleMutations=0,headwearCapColorMutations=0;
for(const id of HEADWEAR_IDS.filter((x):x is Exclude<HeadwearId,'none'>=>x!=='none')){
  const source=makeCharacter(createRecipe({slots:{...emptySlots(),headwear:id}})).surface,broken=cloneCage(source);
  const fi=broken.faces.findIndex(f=>f.v.every(i=>hatVertex(broken.vertices[i].id)));assert(fi>=0);broken.faces.splice(fi,1);
  assert.throws(()=>assertHeadwearClosed(broken,id),id+' 删除任意头饰面后必须失败');headwearHoleMutations++;
}
for(const id of HEADWEAR_IDS.filter((id):id is Exclude<HeadwearId,'none'>=>id!=='none'&&!!baseCapPrefix(id))){
  const source=makeCharacter(createRecipe({slots:{...emptySlots(),headwear:id}})).surface,wrong=cloneCage(source),prefix=baseCapPrefix(id)!;
  const base=wrong.faces.find(f=>f.v.every(i=>wrong.vertices[i].id.startsWith(prefix+'.')));assert(base);base.color='#c8956e';
  assert.throws(()=>assertHeadwearClosed(wrong,id),id+' 帽底使用肤色必须失败');headwearCapColorMutations++;
}
const report={passed:true,headwearVersion:HEADWEAR_GEOMETRY_VERSION,rows,mixes,hats,mutationChecks:3,capContactScopeCases:2,capColorChecks:24,capColorMutationChecks,headwearTopologyChecks:hats.length,headwearHoleMutations,headwearCapColorMutations,scope:'绑定空间资产、固定露肤、染色、服装Cap主布色、头饰零开放边/同色帽底、窄范围帽底×头发制作接触与V5契约；动画源帧/中点及真实网页图片另行检查。'};
mkdirSync('review-wardrobe-batch',{recursive:true});writeFileSync('review-wardrobe-batch/lightwear-numeric.json',JSON.stringify(report,null,2));
console.log('LIGHTWEAR_NUMERIC',JSON.stringify(report));
