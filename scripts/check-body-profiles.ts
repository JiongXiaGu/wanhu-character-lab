import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { makeCharacter } from '../src/character/v3/outfit';
import { createRecipe,BODY_TYPES,BODY_PROFILE_VERSION,BODY_HEIGHT,presetSlots } from '../src/character/v3/types';
import { BODY_GEOMETRY_VERSION,BODY_TRIANGLES } from '../src/character/v3/leg-deformation';
import { WARDROBE_LOOKS,applyLook } from '../src/character/wardrobe/catalog';
import { GARMENT_GEOMETRY_VERSION } from '../src/character/wardrobe/assembly';
import { cloneCage,triCount } from '../src/character/v3/cage';
import { protectedSkinSignatures } from './lib/skin-protected';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixture=JSON.parse(readFileSync('scripts/fixtures/fixed-bind-baseline.json','utf8'));
const protectedFixture=JSON.parse(readFileSync('scripts/fixtures/skin-protected-regions.json','utf8'));
let comparisons=0;
for(const row of fixture.rows)for(const look of WARDROBE_LOOKS){
  const data=makeCharacter(applyLook(createRecipe({bodyType:row.bodyType}),look.id));
  assert.equal(hash(data.joints),row.jointsHash,'固定绑定发生了未声明变化');
  const expected=protectedFixture.rows.find((x:any)=>x.bodyType===row.bodyType).signature;
  assert.deepEqual(protectedSkinSignatures(data.body),expected,'骨盆/声明权重之外的原身体区域被改变');
  assert(data.garments.every(g=>g.version===GARMENT_GEOMETRY_VERSION));comparisons++;
}
for(const bodyType of BODY_TYPES){
  const bare=makeCharacter(createRecipe({bodyType,slots:presetSlots('body')}));
  const dressed=makeCharacter(applyLook(createRecipe({bodyType}),'ceremony-female'));
  assert.deepEqual(bare.joints,dressed.joints);assert.deepEqual(bare.body,dressed.body);
  assert.equal(triCount(bare.body),BODY_TRIANGLES);assert.equal(bare.joints.length,20);
  assert(Math.abs(Math.max(...bare.body.vertices.map(v=>v.p[1]))-1.755*BODY_HEIGHT[bodyType]/1.76)<1e-6);
}
const sample=makeCharacter(createRecipe({bodyType:'male'})).body,expected=protectedFixture.rows.find((x:any)=>x.bodyType==='male').signature;
const assertProtected=(c:typeof sample)=>assert.deepEqual(protectedSkinSignatures(c),expected);
const changedHead=cloneCage(sample);changedHead.vertices.find(v=>v.id==='Crown.0')!.p[0]+=.001;assert.throws(()=>assertProtected(changedHead));
const changedKnee=cloneCage(sample);changedKnee.vertices.find(v=>v.id==='RightKnee.0')!.p[1]+=.001;assert.throws(()=>assertProtected(changedKnee));
const changedHand=cloneCage(sample);changedHand.vertices.find(v=>v.id==='RightFingers.0')!.w[2]=.8;assert.throws(()=>assertProtected(changedHand));
const report={passed:true,testedSha:process.env.REVIEW_HEAD_SHA??'local',profileVersion:BODY_PROFILE_VERSION,bodyGeometryVersion:BODY_GEOMETRY_VERSION,geometryVersion:GARMENT_GEOMETRY_VERSION,bodyTriangles:BODY_TRIANGLES,fixedBodyTypes:2,referenceCommit:fixture.sourceCommit,bodyBindComparisons:comparisons,protectedRegionComparisons:comparisons,mutationChecks:3,manualVisualApproval:false,note:'Original bind and protected-region hashes remain exact. Old whole-body hash deliberately retired for the new finite pelvis, not overwritten with a new visual baseline. Image approval remains separate.'};
mkdirSync('review',{recursive:true});writeFileSync('review/body-profiles.json',JSON.stringify(report,null,2));console.log('PASS fixed bind and protected skin regions',report);
