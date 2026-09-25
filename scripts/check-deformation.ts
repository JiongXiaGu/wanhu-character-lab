import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { makeBody } from '../src/character/v3/body';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import { createRecipe,B,BODY_TYPES,BOTTOM_IDS,emptySlots,type Cage } from '../src/character/v3/types';
import { BODY_GEOMETRY_VERSION,BODY_TRIANGLES } from '../src/character/v3/leg-deformation';
import { assertPalaceSkirt } from './check-soldier-skirt';
import { cloneCage,triCount } from '../src/character/v3/cage';

/** 独立验证制作空间的膝前/膝后权重；不能再用“整圈相等”把错误当契约固定。 */
function assertKnees(c:Cage,pants:boolean,garmentPrefix='Pants'){
  for(const side of ['Right','Left']){
    const thigh=side==='Right'?B.RightThigh:B.LeftThigh,shin=side==='Right'?B.RightShin:B.LeftShin;
    for(const [label,y]of [['KneeUpper',.529],['Knee',.489],['KneeLower',.449]] as const){
      const prefix=pants?`${garmentPrefix}.${side}.${label}.`:`${side}${label}.`;
      const loop=c.vertices.filter(v=>v.id.startsWith(prefix));assert.equal(loop.length,pants?8:6);
      assert(Math.min(...loop.map(v=>v.p[2]))<-.03,'旧膝后压薄恢复了');
      for(const v of loop){
        assert.equal(v.p[1],y);assert.equal(v.w[0],thigh);assert.equal(v.w[1],shin);
        const halfBand=1/22+4*Math.max(0,-v.p[2]);
        const expected=Math.max(0,Math.min(1,.5+(y-.489)/(2*halfBand)));
        assert(Math.abs(v.w[2]-expected)<1e-12,'膝后权重梯度或膝前制作权重错误');
      }
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
      assertKnees(p.mesh,true,bottom==='palace_guard_skirt'?'PalaceLiner':'Pants');
      if(bottom==='palace_guard_skirt')assertPalaceSkirt(p);else assert.equal(triCount(p.mesh),240);
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
const report={passed:true,bodyGeometryVersion:BODY_GEOMETRY_VERSION,rows,independentTrousersTriangles:{work_pants:240,work_wrap:240,short_trousers:164,true_short_skirt:190,long_skirt:262},mutationChecks:5,scope:'Authoring structure and injected regressions only. Actual FBX source-key/midpoint intersections and real screenshots remain separate checks; no automatic visual approval.'};
mkdirSync('review-deformation',{recursive:true});writeFileSync('review-deformation/contracts.json',JSON.stringify(report,null,2));console.log('DEFORMATION CONTRACT',JSON.stringify(report));
