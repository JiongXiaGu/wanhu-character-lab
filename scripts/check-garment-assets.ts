import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import { makeFootwear } from '../src/character/wardrobe/assets/footwear';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from '../src/character/wardrobe/assets/contract';
import { createRecipe, TOP_IDS, BOTTOM_IDS, BODY_TYPES, emptySlots } from '../src/character/v3/types';
import { cloneCage, triCount, cross, sub } from '../src/character/v3/cage';
import { makeCharacter } from '../src/character/v3/outfit';
import { assertComponentWinding } from './check-components';
const edge=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`;

/** 领口/腰口/袖口/裤脚是显式边界，其余任何开口（包括裆底）均为错误。 */
export function assertGarmentPiece(piece:GarmentPiece):void {
  const c=piece.mesh, used=new Set<number>(),counts=new Map<string,number>();
  assert.equal(piece.version,GARMENT_GEOMETRY_VERSION);
  assert(c.vertices.length&&c.faces.length);
  for(const v of c.vertices){
    assert(v.p.every(Number.isFinite));
    assert(v.w.slice(0,2).every(i=>Number.isInteger(i)&&i>=0&&i<20));
    assert(Number.isFinite(v.w[2])&&v.w[2]>=0&&v.w[2]<=1);
  }
  for(const f of c.faces){
    assert(f.v.length>=3&&new Set(f.v).size===f.v.length);
    assert(f.v.every(i=>Number.isInteger(i)&&i>=0&&i<c.vertices.length));
    for(let i=1;i<f.v.length-1;i++)assert(Math.hypot(...cross(sub(c.vertices[f.v[i]].p,c.vertices[f.v[0]].p),sub(c.vertices[f.v[i+1]].p,c.vertices[f.v[0]].p)))>1e-10);
    for(let i=0;i<f.v.length;i++){used.add(f.v[i]);const k=edge(f.v[i],f.v[(i+1)%f.v.length]);counts.set(k,(counts.get(k)??0)+1);}
  }
  assert.equal(used.size,c.vertices.length,'服装不能保留未使用顶点');
  const expected=new Set<string>(),declared=new Set<string>();
  const validateLoop=(loop:number[],sealed:boolean)=>{
    assert(loop.length>=3&&new Set(loop).size===loop.length);
    for(let i=0;i<loop.length;i++){
      const k=edge(loop[i],loop[(i+1)%loop.length]);assert(!declared.has(k),'接口不能重复声明');declared.add(k);
      if(!sealed)expected.add(k);
    }
    if(sealed){
      assert(c.faces.some(f=>f.v.length===loop.length&&f.v.every(i=>loop.includes(i))),'sealedInterfaces 缺少直接 Cap 面');
      for(let i=0;i<loop.length;i++)assert.equal(counts.get(edge(loop[i],loop[(i+1)%loop.length])),2,'Cap 接口仍然暴露 boundary edge');
    }
  };
  for(const loop of Object.values(piece.openings))validateLoop(loop,false);
  for(const loop of Object.values(piece.sealedInterfaces??{}))validateLoop(loop,true);
  assert([...counts.values()].every(n=>n===1||n===2),'非流形/重叠面');
  assert.deepEqual([...counts].filter(([,n])=>n===1).map(([k])=>k).sort(),[...expected].sort(),'未声明破洞或失效接口');
  assertComponentWinding(c);
}

export function assertModularAssets():number {
  let checked=0;
  for(const bodyType of BODY_TYPES){
    for(const top of TOP_IDS){const p=makeTop(createRecipe({bodyType,slots:{top}}));if(p){assertGarmentPiece(p);checked++;}}
    for(const bottom of BOTTOM_IDS){const p=makeTrousers(createRecipe({bodyType,slots:{bottom}}));if(p){assertGarmentPiece(p);checked++;}}
    assertGarmentPiece(makeFootwear(createRecipe({bodyType,slots:{shoes:'cloth_shoes'}}))!);checked++;
    for(const top of TOP_IDS)for(const bottom of BOTTOM_IDS){
      const r=createRecipe({bodyType,slots:{top,bottom}}),d=makeCharacter(r);
      const covers=new Set(d.garments.flatMap(p=>p.covers));
      const visible=d.surface.faces.filter(f=>f.part==='skin');
      assert(visible.every(f=>!covers.has(f.region)),'隐藏区皮肤仍参与绘制');
      const expected=d.body.faces.filter(f=>!covers.has(f.region));
      assert.equal(visible.length,expected.length,'覆盖不应误删裸露部位');
      assert.equal(d.replacedTriangles,triCount(d.body)-expected.reduce((n,f)=>n+f.v.length-2,0));
      assert(d.surface.faces.some(f=>f.part==='skin'&&f.region==='hand'));
      for(const g of d.garments)assert(d.surface.faces.some(f=>f.part===g.slot));
    }
    const bare=makeCharacter(createRecipe({bodyType,slots:emptySlots()}));
    assert.equal(bare.replacedTriangles,0);assert.equal(bare.garments.length,0);
    assert.equal(bare.surface.faces.filter(f=>f.part==='skin').length,bare.body.faces.length);
    const recipe=createRecipe({bodyType,slots:{top:'rough_tunic',bottom:'work_pants'}});
    const signature=(slot:'top'|'bottom',r:typeof recipe)=>{
      const c=makeCharacter(r).surface;
      return c.faces.filter(f=>f.part===slot).map(f=>({color:f.color,vertices:f.v.map(i=>c.vertices[i])}));
    };
    assert.deepEqual(signature('bottom',recipe),signature('bottom',{...recipe,slots:{...recipe.slots,top:'cross_jacket'}}),'换上衣重做了裤装');
    assert.deepEqual(signature('top',recipe),signature('top',{...recipe,slots:{...recipe.slots,bottom:'long_skirt'}}),'换下装改变了上衣');
  }
  const pants=makeTrousers(createRecipe({slots:{bottom:'work_pants'}}))!;
  const copy=():GarmentPiece=>({...pants,mesh:cloneCage(pants.mesh),openings:structuredClone(pants.openings)});
  const hole=copy();hole.mesh.faces.splice(hole.mesh.faces.findIndex(f=>f.region==='pelvis'),1);assert.throws(()=>assertGarmentPiece(hole),'检测器必须抓住裆底破洞');
  const duplicate=copy();duplicate.mesh.faces.push(structuredClone(duplicate.mesh.faces[0]));assert.throws(()=>assertGarmentPiece(duplicate));
  const badWeight=copy();badWeight.mesh.vertices[0].w[0]=20;assert.throws(()=>assertGarmentPiece(badWeight));
  const badPort=copy();badPort.openings.waist=badPort.openings.waist.slice(1);assert.throws(()=>assertGarmentPiece(badPort));
  const vest=makeTop(createRecipe({slots:{top:'work_vest'}}))!;
  assert.deepEqual(Object.keys(vest.openings),[]);assert.deepEqual(Object.keys(vest.sealedInterfaces??{}).sort(),['LeftCuff','RightCuff','neck','waist'].sort());assert.equal(triCount(vest.mesh),128);
  const missingCap:GarmentPiece={...vest,mesh:cloneCage(vest.mesh),openings:structuredClone(vest.openings),sealedInterfaces:structuredClone(vest.sealedInterfaces)};
  const waist=missingCap.sealedInterfaces!.waist,capIndex=missingCap.mesh.faces.findIndex(f=>f.v.length===waist.length&&f.v.every(i=>waist.includes(i)));assert(capIndex>=0);missingCap.mesh.faces.splice(capIndex,1);assert.throws(()=>assertGarmentPiece(missingCap),'封闭接口缺失 Cap 必须失败');
  const cloth=makeFootwear(createRecipe({slots:{shoes:'cloth_shoes'}}))!;assert.equal(triCount(cloth.mesh),64);assert.deepEqual(Object.keys(cloth.openings),[]);assert.deepEqual(Object.keys(cloth.sealedInterfaces??{}).sort(),['LeftAnkle','RightAnkle']);
  assert(!existsSync('src/character/wardrobe/tailoring.ts'),'退役人体衣面生成器仍存在');
  for(const name of ['tops','trousers','footwear'])assert(!/makeBody|cloneCage|fitJointCreases|tailorSurface/.test(readFileSync(`src/character/wardrobe/assets/${name}.ts`,'utf8')),'资产不能复制旧人体衣面');
  return checked;
}
if(process.argv[1]?.endsWith('check-garment-assets.ts'))console.log('PASS independent garment assets', {pieces:assertModularAssets(),mutationChecks:5,coverageCombinations:BODY_TYPES.length*TOP_IDS.length*BOTTOM_IDS.length,geometryVersion:GARMENT_GEOMETRY_VERSION});
