import {shapeAuthoredNormal} from '../src/character/v3/authored-normals';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import snapshot from '../src/character/wardrobe/assets/published/fairy.generated.json';
import {FAIRY_DEFAULT_DYES} from '../src/character/wardrobe/assets/fairy-assets';
import {makeTop} from '../src/character/wardrobe/assets/tops';
import {makeTrousers} from '../src/character/wardrobe/assets/trousers';
import {makeCharacter} from '../src/character/v3/outfit';
import {makeActor} from '../src/character/v3/rig';
import {shapePoint} from '../src/character/v3/body';
import {createRecipe,type Vec3,type Cage} from '../src/character/v3/types';
import {applyLook,parseRecipeFile} from '../src/character/wardrobe/catalog';
import {assertGarmentPiece} from './check-garment-assets';
import {cloneCage,triCount,orient,mul} from '../src/character/v3/cage';
import {retargetMotion} from '../src/character/motion/retarget';
import {skinPoints} from './lib/garment-focus-intersections';

const recipe=applyLook(createRecipe({bodyType:'female'}),'fairy-pink');
assert.equal(recipe.slots.top,'fairy_jacket');assert.equal(recipe.slots.bottom,'fairy_long_skirt');
assert.deepEqual(parseRecipeFile(JSON.stringify(recipe)),recipe);
assert.equal(snapshot.shapeSourceSha256,createHash('sha256').update(readFileSync('src/character/v3/proportions.ts')).digest('hex'),'体型场变更后必须重新发布快照');
const pieces=[makeTop(recipe)!,makeTrousers(recipe)!];
function assertSource(c:Cage,index:number){
 const source=snapshot.pieces[index];
 assert.equal(c.vertices.length,source.sourceFemalePositions.length);
 c.vertices.forEach((v,i)=>{
  const actual=shapePoint(v.p,recipe),expected=source.sourceFemalePositions[i];
  assert(Math.hypot(...actual.map((n,a)=>n-expected[a]))<1e-9,'作者位置与女体型装配不一致');
  assert.deepEqual(v.w,source.vertices[i].w,'作者双权重改变');
 });
}
for(const [i,piece] of pieces.entries()){
 assertGarmentPiece(piece);assertSource(piece.mesh,i);
 assert.equal(triCount(piece.mesh),i===0?340:346);
 const source=snapshot.pieces[i];
 piece.mesh.faces.forEach((face,k)=>{
  assert.deepEqual(face.v,source.faces[k].v);
  const published=source.faces[k];
  if('sourceFemaleNormals' in published){
   assert(face.authoredNormals,'作者法线未进入衣柜资产');
   assert.equal(face.authoredNormals.length,face.v.length);
   face.authoredNormals.forEach((normal,corner)=>{
    const actual=shapeAuthoredNormal(normal,piece.mesh.vertices[face.v[corner]].p,recipe);
    const expected=(published.sourceFemaleNormals as number[][])[corner];
    assert(Math.hypot(...actual.map((n,a)=>n-expected[a]))<1e-5,'作者法线在女体型映射中改变');
   });
  }
  const cell=source.faces[k].cell;
  const linear=source.palette[String(cell) as keyof typeof source.palette];
  const expected=new T.Color().setRGB(linear[0],linear[1],linear[2]).getHexString();
  assert.equal(face.color,'#'+expected,'默认配色未保留作者Palette');
 });
 const black=createRecipe({...recipe,dyes:{primary:'#000000',secondary:'#000000',accent:'#000000'}});
 const recolored=i===0?makeTop(black)!:makeTrousers(black)!;
 assert(recolored.mesh.faces.every(f=>f.color==='#000000'));
 assert.deepEqual(recolored.mesh.vertices,piece.mesh.vertices,'染色不应改变造型或权重');
}
const character=makeCharacter(recipe);
assert.equal(character.joints.length,20);
assert(!character.surface.faces.some(f=>f.part==='skin'&&['torso','upperArm','forearm','pelvis','thigh','shin'].includes(f.region)),'仙裙覆盖区皮肤仍在绘制');
assert(character.surface.faces.some(f=>f.part==='skin'&&f.region==='hand'));
assert(character.surface.faces.some(f=>f.part==='skin'&&f.region==='head'));
assert(!character.surface.vertices.some(v=>/^(CrossCollar|InnerCollar)/.test(v.id)),'仙衣不应叠旧前襟');
const detached=cloneCage(pieces[0].mesh),first=detached.faces.find(face=>face.authoredNormals)!;
const saved=[...pieces[0].mesh.faces.find(face=>face.authoredNormals)!.authoredNormals![0]];
first.authoredNormals![0]=mul(first.authoredNormals![0],-1);
assert.deepEqual(pieces[0].mesh.faces.find(face=>face.authoredNormals)!.authoredNormals![0],saved,'克隆仍共享作者法线数组');
const reversed=cloneCage(pieces[0].mesh);
for(const face of reversed.faces){face.v.reverse();if(face.authoredNormals)face.authoredNormals=face.authoredNormals.reverse().map(normal=>mul(normal,-1));}
orient(reversed);
assert.deepEqual(reversed,pieces[0].mesh,'绕序修正没有同步法线角点与方向');
const authoredActor=makeActor(character);
try{
 let corner=0;
 const buffer=authoredActor.mesh.geometry.getAttribute('normal').array;
 for(const face of character.surface.faces){
  for(const [i,normal] of (face.authoredNormals??[]).entries()){
   assert(Math.hypot(...normal.map((n,axis)=>n-buffer[(corner+i)*3+axis]))<1e-6,'作者法线未进入GPU属性');
  }
  corner+=face.v.length;
 }
 const bad=structuredClone(character);
 const target=bad.surface.faces.find(face=>face.authoredNormals)!;
 target.authoredNormals![0]=[0,0,0];
 assert.throws(()=>makeActor(bad),/作者法线必须/);
}finally{authoredActor.dispose();}
for(const mutate of [
 (c:Cage)=>{c.vertices[0].p[1]*=1.66/1.76;},
 (c:Cage)=>{c.vertices[10].w=[0,0,1];},
 (c:Cage)=>{c.vertices[3].p[0]+=.015;},
]){const wrong=cloneCage(pieces[0].mesh);mutate(wrong);assert.throws(()=>assertSource(wrong,0));}
let poses=0;
for(const bodyType of ['female','male'] as const){
 const data=makeCharacter(createRecipe({...recipe,bodyType})),actor=makeActor(data);
 try{
  for(const id of ['start-walking','jogging','shooting-arrow','snatch']){
   const source=JSON.parse(readFileSync('public/mixamo/'+id+'.json','utf8')),bake=retargetMotion(data,source);
   const times=[...new Set<number>([0,source.duration,...source.times,...source.times.slice(1).map((t:number,i:number)=>(t+source.times[i])/2)])];
   actor.resetBindPose();
   const action=actor.mixer.clipAction(bake.clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;
   try{for(const time of times){action.time=time;actor.update(0);actor.mesh.skeleton.update();const points=skinPoints(data.surface,actor.mesh.skeleton.boneMatrices);assert(points.every(p=>p.every(Number.isFinite)),'真实动作蒙皮存在非有限坐标');poses++;}}
   finally{action.stop();actor.mixer.uncacheClip(bake.clip);}
  }
 }finally{actor.dispose();}
}
console.log('FAIRY_PUBLISHED_CONTRACT',JSON.stringify({passed:true,triangles:[340,346],logicalVertices:[172,175],defaultDyes:FAIRY_DEFAULT_DYES,sourceRoundtripError:snapshot.maxFemaleRoundtripError,poses,faultChecks:4,sourceGeometryAndWeights:true,authoredNormalsAndGpu:true,scope:'坐标、权重、覆盖、独立染色与真实动作有限值；不是完整三角面贯穿或用户视觉验收。'}));
