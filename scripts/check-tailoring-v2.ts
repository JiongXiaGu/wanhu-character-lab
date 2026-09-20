import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import * as T from 'three';
import {makeCharacter} from '../src/character/v3/outfit';
import {makeActor} from '../src/character/v3/rig';
import {createRecipe,BODY_TYPES} from '../src/character/v3/types';
import {triCount} from '../src/character/v3/cage';
import {WARDROBE_LOOKS,applyLook} from '../src/character/wardrobe/catalog';
import {GARMENT_GEOMETRY_VERSION} from '../src/character/wardrobe/assembly';
import {MIXAMO_CLIPS} from '../src/character/mixamo/catalog';
import {retargetMixamo} from '../src/character/mixamo/retarget';
import type {MixamoMotionData} from '../src/character/mixamo/data';
import {scanMotionFiles} from './lib/register-mixamo';
import {assertModularAssets} from './check-garment-assets';
import {assertComponentWinding} from './check-components';
const inventory=JSON.parse(readFileSync('public/mixamo/inventory.json','utf8'));
assert.equal(inventory.failures.length,0);assert.equal(inventory.prepared,scanMotionFiles().length);assert.deepEqual([...inventory.clips.map((c:any)=>c.filename)].sort(),scanMotionFiles());
const assetChecks=assertModularAssets();
const rows:any[]=[];const failures:string[]=[];let frames=0,vertices=0;
for(const look of WARDROBE_LOOKS)for(const bodyType of BODY_TYPES){
 const recipe=applyLook(createRecipe({bodyType}),look.id),base=makeCharacter(recipe),counts:number[]=[];
 {const d=makeCharacter(recipe);assert.deepEqual(d.body,base.body);assert.deepEqual(d.joints,base.joints);assert.deepEqual(d.recipe,base.recipe);assertComponentWinding(d.surface);counts.push(triCount(d.surface));assert.equal(triCount(d.body),510);
  assert(d.garments.length===3);
  assert(d.surface.faces.filter(f=>f.part==='skin').every(f=>!['torso','upperArm','pelvis','thigh','shin','foot'].includes(f.region)),'覆盖表失效');
 }
 assert(counts.length===1 && counts[0]<1000,'标准衣面精度预算');rows.push({look:look.id,bodyType,triangles:counts[0]});
}
const priority=[...new Set(['pilot-switches','shooting-arrow','jogging',...MIXAMO_CLIPS.filter(c=>c.category==='劳动').slice(0,3).map(c=>c.id)])];
for(const id of priority){const source=JSON.parse(readFileSync(`public/mixamo/${id}.json`,'utf8'))as MixamoMotionData;
 for(const bodyType of BODY_TYPES)for(const look of ['plain-female','town-female','ceremony-female']){
  const recipe=applyLook(createRecipe({bodyType}),look),d=makeCharacter(recipe),actor=makeActor(d),bake=retargetMixamo(d,source),g=actor.mesh.geometry;
  const action=actor.mixer.clipAction(bake.clip);action.setLoop(T.LoopOnce,1).play();action.paused=true;action.clampWhenFinished=true;
  for(let frame=0;frame<source.times.length;frame++){action.time=source.times[frame];actor.update(0);frames++;const v=new T.Vector3();for(let i=0;i<g.attributes.position.count;i++){actor.mesh.getVertexPosition(i,v);if(!v.toArray().every(Number.isFinite)||v.length()>8)failures.push(`${id}/${bodyType}/${look}/${frame}: invalid vertex`);vertices++;}}
  actor.mixer.uncacheClip(bake.clip);actor.dispose();
 }
 console.log('TAILORING sampled complete clip '+id);
}
const report={schema:'wanhu-modular-tailoring-v2',assetChecks,geometryVersion:GARMENT_GEOMETRY_VERSION,testedSha:process.env.REVIEW_HEAD_SHA??'local',inventoryFiles:inventory.totalFiles,staticVariants:rows.length,rows,priority,frames,vertices,failures,passed:failures.length===0,visualApproval:false,note:'Topology, weights, complete time sampling and fixed-profile geometry are checked. These tests do not prove absence of self-intersection. Review actual multi-phase images separately; videos are optional.'};
mkdirSync('review-tailoring-v2',{recursive:true});writeFileSync('review-tailoring-v2/numeric.json',JSON.stringify(report,null,2));assert.equal(failures.length,0);console.log('PASS tailoring V2',JSON.stringify({...report,rows:undefined}));
