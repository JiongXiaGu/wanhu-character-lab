import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import { assertGarmentPiece } from './check-garment-assets';
import { triCount,cloneCage,cross,sub,dot } from '../src/character/v3/cage';
import { createRecipe,B,BODY_TYPES,HAIR_STYLE_IDS,presetSlots,type Cage,type Vec3,type Recipe,type HeadwearId } from '../src/character/v3/types';
import { parseRecipeFile } from '../src/character/wardrobe/catalog';
import { HEADWEAR_CLEARANCE,HEADWEAR_GEOMETRY_VERSION } from '../src/character/wardrobe/headwear-fit';

const newTops=['work_vest','short_work_jacket'] as const,newBottoms=['short_trousers','short_skirt'] as const;
const contrast={primary:'#fa1945',secondary:'#12cee7',accent:'#ffda16'};
const rows:any[]=[],mixes:any[]=[],hats:any[]=[];
const maxX=(c:Cage)=>Math.max(...c.vertices.map(v=>Math.abs(v.p[0])));
const signature=(c:Cage)=>JSON.stringify({v:c.vertices,f:c.faces.map(f=>({v:f.v,region:f.region}))});
function assertShort(c:Cage,skirt:boolean){
  assert.equal(triCount(c),skirt?176:176);
  assert(c.vertices.every(v=>v.p[1]>=.5),'短装有膝下裤管');
  assert(c.faces.filter(f=>f.region==='pelvis').length===24,'短装腰臀/四片裆底不可省略');
  for(const side of ['Right','Left']){
    const label=skirt?'Hem':'Cuff';
    const loop=c.vertices.filter(v=>v.id.startsWith(`Shorts.${side}.${label}.`));assert.equal(loop.length,8);
    for(const v of loop){
      assert.equal(v.p[1],skirt?.511:.507);
      const thigh=side==='Right'?B.RightThigh:B.LeftThigh,shin=side==='Right'?B.RightShin:B.LeftShin;
      assert.equal(v.w[0],thigh);assert.equal(v.w[1],shin);
      const expected=Math.max(0,Math.min(1,.5+(v.p[1]-.489)/(2*(1/22+4*Math.max(0,-v.p[2])))));
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
const hatVertex=(id:string)=>/^(Helmet|WardrobeCap|CapTablet|CapWings|WrapKnot|Straw|Headband)/.test(id);
const hairVertex=(id:string)=>/^(Hairline|HairCrown|HairVolume|CustomHair)/.test(id);
function assertHat(c:Cage,id:HeadwearId){
  const hs=triangles(c,hatVertex),hair=triangles(c,hairVertex);assert(hs.length>0&&hair.length>0);
  for(const v of c.vertices.filter(v=>hatVertex(v.id)||hairVertex(v.id)))assert.deepEqual(v.w,[B.Head,B.Head,1]);
  const failures:any[]=[];
  for(const a of hs)for(const b of hair){
    const x=a.map(i=>c.vertices[i].p),y=b.map(i=>c.vertices[i].p);
    if([0,1,2].some(t=>pierces(x[t],x[(t+1)%3],y)||pierces(y[t],y[(t+1)%3],x)))failures.push({hat:a.map(i=>c.vertices[i].id),hair:b.map(i=>c.vertices[i].id)});
  }
  assert.equal(failures.length,0,`${id} 与头发有静态贯穿：${JSON.stringify(failures.slice(0,4))}`);
  if(['guard_helmet','cloth_wrap','scholar_cap'].includes(id)){
    const prefix=id==='guard_helmet'?'Helmet':'WardrobeCap';
    const shell=c.faces.filter(f=>f.v.every(i=>c.vertices[i].id.startsWith(prefix)));
    const h=c.vertices.filter(v=>/^(HairVolume|HairCrown)/.test(v.id));
    const center:Vec3=[0,h.reduce((s,v)=>s+v.p[1],0)/h.length,0];
    for(const f of shell){
      const [a,b,d]=f.v.slice(0,3).map(i=>c.vertices[i].p),normal=cross(sub(b,a),sub(d,a)),len=Math.hypot(...normal);
      // 外壳没有封死的帽底；用内部中心选择朝外法线，避免绕序假设。
      const sign=dot(normal,sub(center,a))>0?-1:1;
      for(const v of h)assert(sign*dot(normal,sub(v.p,a))/len<-.001,`${id} 帽壳没有包住 ${v.id}`);
    }
  }
}
for(const bodyType of BODY_TYPES){
  for(const top of newTops){
    const recipe=createRecipe({bodyType,slots:{...presetSlots('body'),top},dyes:contrast}),p=makeTop(recipe)!;assertGarmentPiece(p);
    assert.equal(triCount(p.mesh),top==='work_vest'?102:174);assert.deepEqual(p.covers,['torso']);
    assert.deepEqual([...new Set(p.mesh.faces.map(f=>f.color))].sort(),Object.values(contrast).sort());
    const changed=makeTop({...recipe,dyes:{primary:'#203040',secondary:'#405060',accent:'#607080'}})!;assert.equal(signature(p.mesh),signature(changed.mesh));
    const d=makeCharacter(recipe);
    for(const region of ['upperArm','forearm','hand'])assert.equal(d.surface.faces.filter(f=>f.part==='skin'&&f.region===region).length,d.body.faces.filter(f=>f.region===region).length,'短衣不能误删裸露手臂');
    rows.push({bodyType,id:top,triangles:triCount(p.mesh),logicalVertices:p.mesh.vertices.length,covers:p.covers});
  }
  for(const bottom of newBottoms){
    const recipe=createRecipe({bodyType,slots:{...presetSlots('body'),bottom},dyes:contrast}),p=makeTrousers(recipe)!;assertGarmentPiece(p);assertShort(p.mesh,bottom==='short_skirt');
    assert.deepEqual(p.covers,['pelvis','thigh']);
    assert.deepEqual([...new Set(p.mesh.faces.map(f=>f.color))].sort(),Object.values(contrast).sort());
    assert.equal(signature(p.mesh),signature(makeTrousers({...recipe,dyes:{primary:'#102030',secondary:'#304050',accent:'#506070'}})!.mesh));
    const d=makeCharacter(recipe);
    for(const region of ['shin','foot'])assert.equal(d.surface.faces.filter(f=>f.part==='skin'&&f.region===region).length,d.body.faces.filter(f=>f.region===region).length,'短下装不能误删小腿');
    rows.push({bodyType,id:bottom,triangles:triCount(p.mesh),logicalVertices:p.mesh.vertices.length,covers:p.covers});
  }
  for(const top of [...newTops,'rough_tunic','cross_jacket','layered_vest'] as const)for(const bottom of [...newBottoms,'loose_trousers','guard_pants'] as const){
    const recipe=createRecipe({bodyType,slots:{...presetSlots('body'),top,bottom,shoes:'cloth_shoes'}}),d=makeCharacter(recipe);
    assert.deepEqual(parseRecipeFile(JSON.stringify(recipe)),recipe);assert.equal(recipe.version,5);assert.equal(d.joints.length,20);assert.equal(triCount(d.body),524);
    assert(d.surface.vertices.every(v=>v.p.every(Number.isFinite)));mixes.push({bodyType,top,bottom,triangles:triCount(d.surface),logicalVertices:d.surface.vertices.length});
  }
  for(const hairStyle of HAIR_STYLE_IDS)for(const id of Object.keys(HEADWEAR_CLEARANCE) as HeadwearId[]){
    const recipe=createRecipe({bodyType,hairStyle,slots:{...presetSlots('body'),headwear:id}}),d=makeCharacter(recipe);
    assertHat(d.surface,id);
    const restored=makeCharacter({...recipe,slots:{...recipe.slots,headwear:'none'}});
    const same=makeCharacter(createRecipe({bodyType,hairStyle,slots:presetSlots('body')}));assert.deepEqual(restored.surface,same.surface);
    hats.push({bodyType,hairStyle,id,passed:true});
  }
}
const vest=makeTop(createRecipe({slots:{top:'work_vest'}}))!.mesh,jacket=makeTop(createRecipe({slots:{top:'short_work_jacket'}}))!.mesh;
assert(maxX(jacket)>maxX(vest)*1.5,'短袖与无袖剪影必须不同');
const shorts=makeTrousers(createRecipe({slots:{bottom:'short_trousers'}}))!.mesh,skirt=makeTrousers(createRecipe({slots:{bottom:'short_skirt'}}))!.mesh;
assert(maxX(skirt)>maxX(shorts)*1.3,'短下裳必须有独立A字展开，不是换色短裤');
const longMutation=cloneCage(shorts);longMutation.vertices[0].p[1]=.1;assert.throws(()=>assertShort(longMutation,false));
const wrongWeight=cloneCage(shorts);wrongWeight.vertices.find(v=>v.id==='Shorts.Right.Cuff.0')!.w=[B.Hips,B.Hips,1];assert.throws(()=>assertShort(wrongWeight,false));
const shrunk=makeCharacter(createRecipe({slots:{...presetSlots('body'),headwear:'guard_helmet'}})).surface;
for(const v of shrunk.vertices.filter(v=>hatVertex(v.id))){v.p[0]*=.6;v.p[2]*=.6;}assert.throws(()=>assertHat(shrunk,'guard_helmet'),'必须抓住过小帽壳回归');
const report={passed:true,headwearVersion:HEADWEAR_GEOMETRY_VERSION,rows,mixes,hats,mutationChecks:3,scope:'绑定空间资产、固定露肤、染色、帽发贯穿与V5契约；动画源帧/中点及真实网页图片另行检查。'};
mkdirSync('review-wardrobe-batch',{recursive:true});writeFileSync('review-wardrobe-batch/lightwear-numeric.json',JSON.stringify(report,null,2));
console.log('LIGHTWEAR_NUMERIC',JSON.stringify(report));
