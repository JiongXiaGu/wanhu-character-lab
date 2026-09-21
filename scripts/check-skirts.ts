import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import * as T from 'three';
import {makeCharacter} from '../src/character/v3/outfit';
import {makeActor} from '../src/character/v3/rig';
import {makeTrousers} from '../src/character/wardrobe/assets/trousers';
import {type GarmentPiece} from '../src/character/wardrobe/assets/contract';
import {BOTTOM_PATTERNS} from '../src/character/wardrobe/patterns';
import {BODY_TYPES,createRecipe,presetSlots,type Recipe,type BottomId} from '../src/character/v3/types';
import {cloneCage,triCount} from '../src/character/v3/cage';
import {parseRecipeFile,SLOT_OPTIONS} from '../src/character/wardrobe/catalog';
import {MIXAMO_CLIPS} from '../src/character/mixamo/catalog';
import {retargetMixamo} from '../src/character/mixamo/retarget';
import {assertGarmentPiece} from './check-garment-assets';

const colors={primary:'#fa1945',secondary:'#12cee7',accent:'#ffda16'};
const skirts=['true_short_skirt','long_skirt'] as const;
const mixes:Recipe[]=[];const assets:any[]=[],rows:any[]=[];
const signature=(p:GarmentPiece)=>JSON.stringify({v:p.mesh.vertices,f:p.mesh.faces.map(f=>({v:f.v,region:f.region}))});
function assertContinuous(p:GarmentPiece){
  assertGarmentPiece(p);assert(skirts.some(id=>id===p.id),'裙裤不能冒充连续裙装');
  const long=p.id==='long_skirt',c=p.mesh;
  assert.equal(triCount(c),long?240:168);assert.equal(c.vertices.length,long?132:96);
  assert.deepEqual(Object.keys(p.openings).sort(),['hem','waist']);
  assert.equal(p.openings.hem.length,12);assert.equal(p.openings.waist.length,12);
  assert(c.vertices.every(v=>v.id.startsWith('Skirt.')),'裙装不能调用裤装或人体部件');
  assert(Math.abs(Math.min(...c.vertices.map(v=>v.p[1]))-(long?.092:.505))<1e-10);
  const width=(prefix:string)=>Math.max(...c.vertices.filter(v=>v.id.startsWith(prefix)).map(v=>Math.abs(v.p[0])));
  assert(width('Skirt.Hem.')>width('Skirt.Waist.')*1.7,'裙腰必须收住，下摆必须展开');
  // 连续表面必须在前后跨过中线；没有两个单独的穿腿口或隐藏裆底。
  for(const zsign of [1,-1])assert(c.faces.some(f=>f.v.some(i=>c.vertices[i].p[0]<0)&&f.v.some(i=>c.vertices[i].p[0]>0)&&f.v.every(i=>c.vertices[i].p[2]*zsign>0)));
  const visited=new Set<number>([0]);let changed=true;
  while(changed){changed=false;for(const f of c.faces)if(f.v.some(i=>visited.has(i)))for(const i of f.v)if(!visited.has(i)){visited.add(i);changed=true;}}
  assert.equal(visited.size,c.vertices.length,'裙壳必须只有一个连续连通分量');
  assert.deepEqual([...new Set(c.faces.map(f=>f.color))].sort(),Object.values(colors).sort());
  const key=(f:typeof c.faces[number],mirror:boolean)=>f.v.map(i=>{const p=c.vertices[i].p;return [mirror?-p[0]:p[0],p[1],p[2]].map(x=>Math.round(x*1e7)).join(',');}).sort().join('/');
  const faces=new Map(c.faces.map(f=>[key(f,false),f.color]));
  for(const f of c.faces)assert.equal(faces.get(key(f,true)),f.color,'左右色区或闭合裙边不一致');
  assert.deepEqual(p.covers,long?['pelvis','thigh','shin']:['pelvis','thigh']);
}
for(const bodyType of BODY_TYPES){
  for(const bottom of skirts){
    const recipe=createRecipe({bodyType,slots:{...presetSlots('body'),bottom},dyes:colors}),piece=makeTrousers(recipe)!;assertContinuous(piece);
    assert.equal(signature(piece),signature(makeTrousers({...recipe,dyes:{primary:'#102030',secondary:'#304050',accent:'#506070'}})!));
    const character=makeCharacter(recipe),bare=makeCharacter(createRecipe({bodyType,slots:presetSlots('body')}));
    assert.deepEqual(character.body,bare.body);assert.deepEqual(character.joints,bare.joints);
    if(bottom==='true_short_skirt')assert.equal(character.surface.faces.filter(f=>f.part==='skin'&&f.region==='shin').length,bare.body.faces.filter(f=>f.region==='shin').length);
    assert.deepEqual(parseRecipeFile(JSON.stringify(recipe)),recipe);
    assets.push({bodyType,id:bottom,triangles:triCount(piece.mesh),logicalVertices:piece.mesh.vertices.length,covers:piece.covers,openings:Object.keys(piece.openings)});
  }
  for(const bottom of ['short_trousers',...skirts] as const)for(const top of bottom==='short_trousers'?['work_vest','short_work_jacket'] as const:['work_vest','short_work_jacket','cross_jacket'] as const){
    const recipe=createRecipe({bodyType,slots:{...presetSlots('body'),top,bottom,shoes:'cloth_shoes'},dyes:colors}),d=makeCharacter(recipe);
    assert.equal(recipe.version,5);assert.equal(d.joints.length,20);assert.equal(triCount(d.body),524);assert(triCount(d.surface)<1400);
    mixes.push(recipe);rows.push({bodyType,top,bottom,triangles:triCount(d.surface),logicalVertices:d.surface.vertices.length});
  }
}
const legacy=makeTrousers(createRecipe({slots:{bottom:'short_skirt'},dyes:colors}))!;assert.equal(triCount(legacy.mesh),176);assert.throws(()=>assertContinuous(legacy));
assert(SLOT_OPTIONS.bottom.find(x=>x.id==='short_skirt')!.name.includes('裙裤'));
assert.equal(BOTTOM_PATTERNS.short_trousers.stressOnlyClips,undefined);
for(const [id,p]of Object.entries(BOTTOM_PATTERNS))if(p.stressOnlyClips){assert(skirts.includes(id as typeof skirts[number]));assert.deepEqual(p.stressOnlyClips,['snatch']);}
const original=makeTrousers(createRecipe({slots:{bottom:'true_short_skirt'},dyes:colors}))!;
const copy=()=>({...original,mesh:cloneCage(original.mesh),openings:structuredClone(original.openings)});
const hole=copy();hole.mesh.faces.splice(15,1);assert.throws(()=>assertContinuous(hole));
const noColor=copy();noColor.mesh.faces.forEach(f=>{if(f.color===colors.accent)f.color=colors.primary;});assert.throws(()=>assertContinuous(noColor));
const shortLength=copy();shortLength.mesh.vertices.find(v=>v.id==='Skirt.HemInset.0')!.p[1]=.1;assert.throws(()=>assertContinuous(shortLength));
const leftDye=copy();leftDye.mesh.faces[8].color=colors.accent;assert.throws(()=>assertContinuous(leftDye));
let sampledFrames=0,vertexSamples=0;
const motion=process.argv.includes('--motion');
if(motion)for(const def of MIXAMO_CLIPS){
  const source=JSON.parse(readFileSync(`public/mixamo/${def.id}.json`,'utf8'));
  for(const recipe of mixes){
    const data=makeCharacter(recipe),actor=makeActor(data),bake=retargetMixamo(data,source),geometry=actor.mesh.geometry;
    const action=actor.mixer.clipAction(bake.clip);action.setLoop(T.LoopOnce,1).play();action.paused=true;action.clampWhenFinished=true;
    for(const phase of [0,.125,.25,.375,.5,.625,.75,.875,1]){
      action.time=source.duration*phase;actor.update(0);sampledFrames++;assert.equal(actor.mesh.geometry,geometry);
      const p=new T.Vector3();for(let i=0;i<geometry.attributes.position.count;i++){actor.mesh.getVertexPosition(i,p);assert(p.toArray().every(Number.isFinite));assert(p.length()<8);vertexSamples++;}
    }
    actor.mixer.uncacheClip(bake.clip);actor.dispose();
  }
  console.log('SKIRT_FINITE_FBX',def.id);
}
const report={passed:true,sourceSha:process.env.REVIEW_HEAD_SHA??'local',assets,rows,mutationChecks:5,motion,clips:motion?MIXAMO_CLIPS.length:0,sampledFrames,vertexSamples,scope:'独立连续裙壳、固定覆盖、V5、三色对称、预算、有限值；完整源帧/中点贯穿和真实网页审图独立执行。有限值不等于零穿模。'};
mkdirSync('review-wardrobe-batch',{recursive:true});writeFileSync(`review-wardrobe-batch/skirts-${motion?'motion':'numeric'}.json`,JSON.stringify(report,null,2));console.log('SKIRT_CONTRACT',JSON.stringify(report));
