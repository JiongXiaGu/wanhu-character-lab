import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {makeCharacter} from '../src/character/v3/outfit';
import {createRecipe,BODY_TYPES,BODY_PROFILE_VERSION,BODY_HEIGHT,presetSlots} from '../src/character/v3/types';
import {applyLook} from '../src/character/wardrobe/catalog';
import {triCount} from '../src/character/v3/cage';
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fixture=JSON.parse(readFileSync('scripts/fixtures/fixed-model-baseline.json','utf8'));
// 明确版本的重构回归，不再冻结历史上十二套连续身材；将来改基模需单独审查版本变更。
for(const row of fixture.rows){
 const d=makeCharacter(applyLook(createRecipe({bodyType:row.bodyType}),row.look));
 assert.equal(hash(d.body),row.bodyHash,`${row.bodyType}/${row.look}: fixed body changed`);
 assert.equal(hash(d.joints),row.jointsHash,`${row.bodyType}/${row.look}: fixed bind changed`);
 assert.equal(hash(d.surface),row.surfaceHash,`${row.bodyType}/${row.look}: standard garment changed`);
}
for(const bodyType of BODY_TYPES){
 const base=makeCharacter(createRecipe({bodyType,slots:presetSlots('body')}));
 const dressed=makeCharacter(applyLook(createRecipe({bodyType}),'ceremony-female'));
 assert.deepEqual(base.joints,dressed.joints);assert.deepEqual(base.body,dressed.body);
 assert.equal(triCount(base.body),510);assert.equal(base.joints.length,20);
 const ys=base.body.vertices.map(v=>v.p[1]); assert(Math.abs(Math.max(...ys)-1.755*BODY_HEIGHT[bodyType]/1.76)<1e-6);
}
const report={passed:true,testedSha:process.env.REVIEW_HEAD_SHA??'local',profileVersion:BODY_PROFILE_VERSION,fixedBodyTypes:2,referenceCommit:fixture.sourceCommit,appearanceComparisons:fixture.rows.length,note:'Exact default-body and original LOD2 geometry regression; NOT a claim of improved hip/crotch art.'};
mkdirSync('review',{recursive:true});writeFileSync('review/body-profiles.json',JSON.stringify(report,null,2));console.log('PASS fixed body/garment baseline',report);
