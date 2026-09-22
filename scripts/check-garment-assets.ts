import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import { makeFootwear } from '../src/character/wardrobe/assets/footwear';
import { sealGarmentInterfaces } from '../src/character/wardrobe/assets/seal-interfaces';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from '../src/character/wardrobe/assets/contract';
import { createRecipe, TOP_IDS, BOTTOM_IDS, BODY_TYPES, emptySlots, type Cage, type Recipe } from '../src/character/v3/types';
import { cloneCage, triCount, cross, sub } from '../src/character/v3/cage';
import { makeCharacter } from '../src/character/v3/outfit';
import { assertComponentWinding } from './check-components';
const edge=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`;
const capFaces=(c:Cage,loop:number[])=>c.faces.filter(f=>f.v.length===loop.length&&f.v.every(i=>loop.includes(i)));
const copyPiece=(p:GarmentPiece):GarmentPiece=>({...p,mesh:cloneCage(p.mesh),openings:structuredClone(p.openings),sealedInterfaces:structuredClone(p.sealedInterfaces)});

/** 正式服装逐件闭合；不能把漏面重新声明成合法 opening 来绕过验收。 */
export function assertGarmentPiece(piece:GarmentPiece):void {
  const c=piece.mesh, used=new Set<number>(),counts=new Map<string,number>();
  assert.equal(piece.version,GARMENT_GEOMETRY_VERSION);
  assert(c.vertices.length&&c.faces.length);
  assert.deepEqual(Object.keys(piece.openings),[],`${piece.id}: 正式资产不能保留开放接口`);
  const ports=piece.slot==='top'?['LeftCuff','RightCuff','neck','waist']:piece.slot==='shoes'?['LeftAnkle','RightAnkle']:['true_short_skirt','long_skirt'].includes(piece.id)?['waist']:['LeftCuff','RightCuff','waist'];
  assert.deepEqual(Object.keys(piece.sealedInterfaces??{}).sort(),ports,`${piece.id}: 封口锚点不完整`);
  for(const v of c.vertices){
    assert(v.p.every(Number.isFinite));
    assert(v.w.slice(0,2).every(i=>Number.isInteger(i)&&i>=0&&i<20));
    assert(Number.isFinite(v.w[2])&&v.w[2]>=0&&v.w[2]<=1);
  }
  for(const f of c.faces){
    assert(f.v.length>=3&&new Set(f.v).size===f.v.length);
    assert(f.v.every(i=>Number.isInteger(i)&&i>=0&&i<c.vertices.length));
    for(let i=1;i<f.v.length-1;i++)assert(Math.hypot(...cross(sub(c.vertices[f.v[i]].p,c.vertices[f.v[0]].p),sub(c.vertices[f.v[i+1]].p,c.vertices[f.v[0]].p)))>1e-10,`${piece.id}: 退化扇片`);
    for(let i=0;i<f.v.length;i++){used.add(f.v[i]);const k=edge(f.v[i],f.v[(i+1)%f.v.length]);counts.set(k,(counts.get(k)??0)+1);}
  }
  assert.equal(used.size,c.vertices.length,'服装不能保留未使用顶点');
  const declared=new Set<string>();
  for(const [name,loop] of Object.entries(piece.sealedInterfaces!)){
    assert(loop.length>=3&&new Set(loop).size===loop.length);
    assert(loop.every(i=>Number.isInteger(i)&&used.has(i)));
    assert.equal(capFaces(c,loop).length,1,`${piece.id}/${name}: 必须恰好有一个直接 Cap 面`);
    for(let i=0;i<loop.length;i++){
      const k=edge(loop[i],loop[(i+1)%loop.length]);assert(!declared.has(k),'接口不能重复声明');declared.add(k);
      assert.equal(counts.get(k),2,'Cap 接口仍然暴露 boundary edge');
    }
  }
  assert([...counts.values()].every(n=>n===2),'非流形或开放边：正式服装每条边必须恰好有两个相邻面');
  // 边二流形还不足以排除夹点：逐顶点的相邻面链接必须形成单一闭环。
  for(const vi of used){
    const link=new Map<number,number[]>();
    for(const f of c.faces){
      const at=f.v.indexOf(vi);if(at<0)continue;
      const a=f.v[(at+f.v.length-1)%f.v.length],b=f.v[(at+1)%f.v.length];
      link.set(a,[...(link.get(a)??[]),b]);link.set(b,[...(link.get(b)??[]),a]);
    }
    assert([...link.values()].every(n=>n.length===2),'非流形顶点链接');
    const seen=new Set<number>(),todo=[link.keys().next().value!];
    while(todo.length){const v=todo.pop()!;if(seen.has(v))continue;seen.add(v);todo.push(...link.get(v)!);}
    assert.equal(seen.size,link.size,'顶点连接了多个独立面扇');
  }
  assertComponentWinding(c);
}

function assertCapColors(c:Cage,ports:Record<string,number[]>,expected:(name:string)=>string):number {
  for(const [name,loop] of Object.entries(ports)){
    assert(Array.isArray(loop));const caps=capFaces(c,loop);assert.equal(caps.length,1);
    assert.equal(caps[0].color,expected(name),`${name}: 封口必须使用对应衣料色区`);
  }
  return Object.keys(ports).length;
}

/** 当前完整目录、改色、装配与故障注入；不冒充动画视觉验收。 */
function assertCapRollout(){
  const palettes=[{primary:'#fa1945',secondary:'#12cee7',accent:'#ffda16'},{primary:'#234567',secondary:'#765432',accent:'#abcdef'}];
  const rows:unknown[]=[];let colorChecks=0,holeMutations=0,colorMutations=0;
  for(const bodyType of BODY_TYPES)for(const [palette,dyes] of palettes.entries()){
    const recipes:Recipe[]=[
      ...TOP_IDS.filter(id=>id!=='body').map(top=>createRecipe({bodyType,dyes,slots:{...emptySlots(),top}})),
      ...BOTTOM_IDS.filter(id=>id!=='body').map(bottom=>createRecipe({bodyType,dyes,slots:{...emptySlots(),bottom}})),
      createRecipe({bodyType,dyes,slots:{...emptySlots(),shoes:'cloth_shoes'}}),
    ];
    for(const recipe of recipes){
      const p=makeTop(recipe)??makeTrousers(recipe)??makeFootwear(recipe)!;
      assertGarmentPiece(p);const ports=p.sealedInterfaces!;
      // 上衣封面跟随主布；长裤与裙腰跟随原裤布/腰头色。已认可短裤、布鞋保持原方案。
      const expected=(name:string)=>p.slot==='top'?dyes.primary:p.slot==='shoes'?'#414441':p.id==='short_trousers'?(name==='waist'?dyes.primary:dyes.accent):dyes.secondary;
      colorChecks+=assertCapColors(p.mesh,ports,expected);
      const d=makeCharacter(recipe),assembled=Object.fromEntries(Object.keys(ports).map(name=>[name,d.surface.anchors[p.slot+'.'+name]]));
      colorChecks+=assertCapColors(d.surface,assembled,expected);
      const before=JSON.stringify(p);sealGarmentInterfaces(p,dyes.primary);assert.equal(JSON.stringify(p),before,'重复封口必须幂等');
      if(palette===0)rows.push({bodyType,id:p.id,triangles:triCount(p.mesh),logicalVertices:p.mesh.vertices.length,sealedInterfaces:Object.keys(ports),openBoundaryEdges:0});
      if(palette!==0||bodyType!=='male')continue;
      for(const [name,loop] of Object.entries(ports)){
        const hole=copyPiece(p);hole.mesh.faces.splice(hole.mesh.faces.indexOf(capFaces(hole.mesh,loop)[0]),1);
        assert.throws(()=>assertGarmentPiece(hole),`${p.id}/${name}: 漏封必须失败`);holeMutations++;
        for(const color of ['#c8956e',expected(name)===dyes.primary?dyes.secondary:dyes.primary]){
          const wrong=copyPiece(p);capFaces(wrong.mesh,loop)[0].color=color;
          assert.throws(()=>assertCapColors(wrong.mesh,ports,expected),`${p.id}/${name}: 错误封口色必须失败`);colorMutations++;
        }
      }
      // 把单个缺面重新登记成 opening 也必须被严格闭合门槛拒绝。
      const reopened=copyPiece(p),[name,loop]=Object.entries(ports)[0];
      reopened.mesh.faces.splice(reopened.mesh.faces.indexOf(capFaces(reopened.mesh,loop)[0]),1);
      reopened.openings[name]=loop;delete reopened.sealedInterfaces![name];
      assert.throws(()=>assertGarmentPiece(reopened),'不能通过重新声明 opening 隐藏漏封');
    }
  }
  // 原始两侧共线轮廓：重开一条已封腰口，再以反向环封闭，验证根选择和权重不变。
  for(const reversed of [false,true]){
    const p=makeTop(createRecipe({slots:{top:'cross_jacket'}}))!,loop=p.sealedInterfaces!.waist;
    p.mesh.faces.splice(p.mesh.faces.indexOf(capFaces(p.mesh,loop)[0]),1);
    p.openings.waist=reversed?[...loop].reverse():[...loop];delete p.sealedInterfaces!.waist;
    const vertices=structuredClone(p.mesh.vertices);sealGarmentInterfaces(p,'#123456');assert.deepEqual(p.mesh.vertices,vertices);assertGarmentPiece(p);
  }
  const report={passed:true,testedSha:process.env.REVIEW_HEAD_SHA??'local',rows,colorChecks,holeMutations,colorMutations,visualApproval:false};
  mkdirSync('review-wardrobe-batch',{recursive:true});writeFileSync('review-wardrobe-batch/caps-numeric.json',JSON.stringify(report,null,2));
  console.log('CLOSED_GARMENT_CAPS',JSON.stringify(report));
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
  const copy=()=>copyPiece(pants);
  const hole=copy();hole.mesh.faces.splice(hole.mesh.faces.findIndex(f=>f.region==='pelvis'),1);assert.throws(()=>assertGarmentPiece(hole),'检测器必须抓住裆底破洞');
  const duplicate=copy();duplicate.mesh.faces.push(structuredClone(duplicate.mesh.faces[0]));assert.throws(()=>assertGarmentPiece(duplicate));
  const badWeight=copy();badWeight.mesh.vertices[0].w[0]=20;assert.throws(()=>assertGarmentPiece(badWeight));
  const badPort=copy();badPort.sealedInterfaces!.waist=badPort.sealedInterfaces!.waist.slice(1);assert.throws(()=>assertGarmentPiece(badPort));
  const vest=makeTop(createRecipe({slots:{top:'work_vest'}}))!;
  assert.deepEqual(Object.keys(vest.openings),[]);assert.deepEqual(Object.keys(vest.sealedInterfaces??{}).sort(),['LeftCuff','RightCuff','neck','waist'].sort());assert.equal(triCount(vest.mesh),128);
  const missingCap=copyPiece(vest);
  const waist=missingCap.sealedInterfaces!.waist,capIndex=missingCap.mesh.faces.findIndex(f=>f.v.length===waist.length&&f.v.every(i=>waist.includes(i)));assert(capIndex>=0);missingCap.mesh.faces.splice(capIndex,1);assert.throws(()=>assertGarmentPiece(missingCap),'封闭接口缺失 Cap 必须失败');
  const cloth=makeFootwear(createRecipe({slots:{shoes:'cloth_shoes'}}))!;assert.equal(triCount(cloth.mesh),64);assert.deepEqual(Object.keys(cloth.openings),[]);assert.deepEqual(Object.keys(cloth.sealedInterfaces??{}).sort(),['LeftAnkle','RightAnkle']);
  assert(!existsSync('src/character/wardrobe/tailoring.ts'),'退役人体衣面生成器仍存在');
  for(const name of ['tops','trousers','footwear'])assert(!/makeBody|cloneCage|fitJointCreases|tailorSurface/.test(readFileSync(`src/character/wardrobe/assets/${name}.ts`,'utf8')),'资产不能复制旧人体衣面');
  assertCapRollout();
  return checked;
}
if(process.argv[1]?.endsWith('check-garment-assets.ts'))console.log('PASS independent garment assets', {pieces:assertModularAssets(),mutationChecks:5,coverageCombinations:BODY_TYPES.length*TOP_IDS.length*BOTTOM_IDS.length,geometryVersion:GARMENT_GEOMETRY_VERSION});
