import { assertCityTrousers } from './check-soldier-city';
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { makeBody } from '../src/character/v3/body';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import { createRecipe,B,BODY_TYPES,BOTTOM_IDS,emptySlots,type Cage } from '../src/character/v3/types';
import { BODY_GEOMETRY_VERSION,BODY_TRIANGLES } from '../src/character/v3/leg-deformation';
import { assertMediumArmorSkirt } from './check-soldier-medium';
import { assertHeavyArmorSkirt } from './check-soldier-heavy';
import { cloneCage,triCount } from '../src/character/v3/cage';

/** 独立验证膝前/膝后与内裆权重，不从生产作者常量读取预期。 */
const kneeBlend=(y:number,z:number)=>Math.max(0,Math.min(1,.5+(y-.489)/(2*(1/22+4*Math.max(0,-z)))));
function assertHeavyDrapeKnees(c:Cage){
  for(const [label,y] of [['KneeUpper',.580],['Knee',.489],['KneeLower',.449]] as const){
    const loop=c.vertices.filter(v=>v.id.startsWith(`HeavyArmorSkirt.${label}.`));assert.equal(loop.length,10);
    assert(Math.min(...loop.map(v=>v.p[2]))<-.18,'长裳后片不能压薄');
    for(const v of loop){
      assert.equal(v.p[1],y);const right=v.p[0]>0;
      assert.deepEqual(v.w.slice(0,2),right?[B.RightThigh,B.RightShin]:[B.LeftThigh,B.LeftShin]);
      assert(Math.abs(v.w[2]-kneeBlend(y,v.p[2]))<1e-12,'整圈甲裳膝梯度错误');
    }
  }
  const ridge=c.vertices.filter(v=>v.id.startsWith('HeavyArmorGusset.'));assert.equal(ridge.length,5);
  for(const v of ridge){
    const k=Number(v.id.split('.').at(-1));assert(k>=0&&k<5);
    assert(Math.abs(v.p[1]-(.330+.030*k))<1e-12);assert.deepEqual(v.w,[B.LeftShin,B.RightShin,.5]);
  }
  for(const side of ['Right','Left']){
    const thigh=side==='Right'?B.RightThigh:B.LeftThigh,shin=side==='Right'?B.RightShin:B.LeftShin;
    for(const [label,y,depth] of [['Opening',.300,.066],['Calf',.270,.062]] as const){
      const loop=c.vertices.filter(v=>v.id.startsWith(`HeavyArmorLiner.${side}.${label}.`));assert.equal(loop.length,8);
      for(const v of loop){
        assert.equal(v.p[1],y);assert.deepEqual(v.w.slice(0,2),[thigh,shin]);
        const column=Number(v.id.split('.').at(-1));let expected=kneeBlend(y,v.p[2]);
        if(column>=5){const edge=depth*.9,front=kneeBlend(y,edge),back=kneeBlend(y,-edge);expected=(back+(front-back)*((v.p[2]/edge+1)*.5))*.6+expected*.4;}
        assert(Math.abs(v.w[2]-expected)<1e-12,'内腿平面/局部膝梯度静态混合错误');
      }
    }
  }
}
function assertKnees(c:Cage,pants:boolean,garmentPrefix='Pants'){
  if(pants&&garmentPrefix==='HeavyArmorSkirt'){assertHeavyDrapeKnees(c);return;}
  for(const side of ['Right','Left']){
    const thigh=side==='Right'?B.RightThigh:B.LeftThigh,shin=side==='Right'?B.RightShin:B.LeftShin;
    for(const [label,y] of [['KneeUpper',.529],['Knee',.489],['KneeLower',.449]] as const){
      const prefix=pants?`${garmentPrefix}.${side}.${label}.`:`${side}${label}.`;
      const loop=c.vertices.filter(v=>v.id.startsWith(prefix));assert.equal(loop.length,pants?8:6);
      assert(Math.min(...loop.map(v=>v.p[2]))<-.03,'旧膝后压薄恢复了');
      for(const v of loop){assert.equal(v.p[1],y);assert.equal(v.w[0],thigh);assert.equal(v.w[1],shin);assert(Math.abs(v.w[2]-kneeBlend(y,v.p[2]))<1e-12,'膝前/膝后梯度错误');}
    }
    assert(!c.vertices.some(v=>v.id.startsWith(`Pants.${side}.UpperLeg.`)),'冗余过渡环仍存在');
  }
}
function assertSaddle(c:Cage){
  assert.equal(triCount(c),524,'固定皮肤只允许本次14个局部三角形增量');
  assert(!c.vertices.some(v=>v.id==='Crotch'||v.id.startsWith('Hip.')),'旧单点/旧骨盆连接残留');
  assert.equal(c.vertices.filter(v=>v.id.startsWith('SkinPelvis.')).length,16);
  for(const side of ['Right','Left']){
    const thigh=side==='Right'?B.RightThigh:B.LeftThigh;
    for(const v of c.vertices.filter(v=>v.id.startsWith(`SkinPelvis.${side}.`))){assert.equal(v.w[0],B.Hips);assert.equal(v.w[1],thigh);assert(v.w[2]>=.35&&v.w[2]<=.55);}
    for(const v of c.vertices.filter(v=>v.id.startsWith(`${side}Thigh.`)))assert.deepEqual(v.w,[B.Hips,thigh,.12]);
  }
  const seam=c.faces.filter(f=>f.v.every(i=>c.vertices[i].id.startsWith('SkinPelvis.'))&&f.region==='pelvis');
  assert.equal(seam.length,4,'裆底必须由四片连续连接组成，不是外加壳或单中心点');
}
const skin=makeBody();assertSaddle(skin);assertKnees(skin,false);
const rows=[];
for(const bodyType of BODY_TYPES){
  const character=makeCharacter(createRecipe({bodyType,slots:emptySlots()}));assert.equal(triCount(character.body),BODY_TRIANGLES);
  for(const bottom of BOTTOM_IDS){
    if(bottom==='body')continue;
    const p=makeTrousers(createRecipe({bodyType,slots:{bottom}}))!;
    assert.deepEqual(Object.keys(p.openings),[],'正式下装必须封闭');
    if(bottom==='short_trousers'){
      assert.equal(triCount(p.mesh),164);assert.deepEqual(p.covers,['pelvis','thigh']);assert(p.mesh.vertices.every(v=>v.p[1]>=.5),'短装不能暗中恢复长裤管');
      assert.deepEqual(Object.keys(p.sealedInterfaces??{}).sort(),['LeftCuff','RightCuff','waist'].sort());
      for(const side of ['Right','Left'])assert.equal(p.sealedInterfaces![side+'Cuff'].length,8);
    }else if(bottom==='true_short_skirt'||bottom==='long_skirt'){
      assert.deepEqual(Object.keys(p.sealedInterfaces??{}),['waist']);
      assert.equal(triCount(p.mesh),bottom==='long_skirt'?262:190);
      assert(p.mesh.vertices.every(v=>v.id.startsWith('Skirt.')),'连续裙摆不能拼入裤腿或裆底');
      assert.equal(p.mesh.anchors.closedHem.length,12);
    }else{
      assertKnees(p.mesh,true,bottom==='heavy_armor_skirt'?'HeavyArmorSkirt':bottom==='medium_armor_skirt'?'MediumArmorLiner':bottom==='city_guard_trousers'?'CityPants':'Pants');
      if(bottom==='heavy_armor_skirt')assertHeavyArmorSkirt(p);else if(bottom==='medium_armor_skirt')assertMediumArmorSkirt(p);else if(bottom==='city_guard_trousers')assertCityTrousers(p);else assert.equal(triCount(p.mesh),240);
      assert.deepEqual(Object.keys(p.sealedInterfaces??{}).sort(),['LeftCuff','RightCuff','waist']);
    }
  }
  rows.push({bodyType,bodyTriangles:triCount(character.body),joints:character.joints.length});
}
const pants=makeTrousers(createRecipe({slots:{bottom:'work_pants'}}))!.mesh;
const flat=cloneCage(pants);for(const v of flat.vertices)if(/\.Knee\.\d+$/.test(v.id)&&v.p[2]<0)v.p[2]=-.012;assert.throws(()=>assertKnees(flat,true));
const rear=cloneCage(pants);for(const v of rear.vertices)if(v.id.includes('.KneeUpper.')&&v.p[2]<0)v.w[2]=.94;assert.throws(()=>assertKnees(rear,true));
const front=cloneCage(pants);for(const v of front.vertices)if(v.id.includes('.KneeUpper.')&&v.p[2]>0)v.w[2]=.6;assert.throws(()=>assertKnees(front,true));
const hole=cloneCage(skin);hole.faces.splice(hole.faces.findIndex(f=>f.v.every(i=>hole.vertices[i].id.startsWith('SkinPelvis.'))&&f.region==='pelvis'),1);assert.throws(()=>assertSaddle(hole));
const wrongSide=cloneCage(skin);wrongSide.vertices.find(v=>v.id==='SkinPelvis.Right.Root.0')!.w[1]=B.LeftThigh;assert.throws(()=>assertSaddle(wrongSide));
// 重甲内部拱口、静态插值和外部膝环仍必须被独立变形检查识别。
const heavy=makeTrousers(createRecipe({slots:{bottom:'heavy_armor_skirt'}}))!.mesh;
for(const mutate of [
  (c:Cage)=>{c.vertices.find(v=>v.id==='HeavyArmorSkirt.KneeUpper.0')!.p[1]=.940;},
  (c:Cage)=>{c.vertices.find(v=>v.id==='HeavyArmorLiner.Right.Opening.6')!.w[2]=1;},
  (c:Cage)=>{c.vertices.find(v=>v.id==='HeavyArmorSkirt.KneeLower.4')!.w[2]=.94;},
  (c:Cage)=>{c.vertices=c.vertices.filter(v=>!v.id.startsWith('HeavyArmorSkirt.Knee.'));},
]){const bad=cloneCage(heavy);mutate(bad);assert.throws(()=>assertKnees(bad,true,'HeavyArmorSkirt'));}
const report={passed:true,bodyGeometryVersion:BODY_GEOMETRY_VERSION,rows,independentTrousersTriangles:{medium_armor_skirt:308,heavy_armor_skirt:302,city_guard_trousers:260,work_pants:240,work_wrap:240,short_trousers:164,true_short_skirt:190,long_skirt:262},mutationChecks:9,scope:'Authoring structure and injected regressions only. Actual FBX source-key/midpoint intersections and real screenshots remain separate checks; no automatic visual approval.'};
mkdirSync('review-deformation',{recursive:true});writeFileSync('review-deformation/contracts.json',JSON.stringify(report,null,2));console.log('DEFORMATION CONTRACT',JSON.stringify(report));
