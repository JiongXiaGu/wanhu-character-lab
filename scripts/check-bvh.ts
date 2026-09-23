import * as T from 'three';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {GENERATED_BVH_CLIPS} from '../src/character/bvh/catalog.generated';
import {validateMixamoData,type MixamoMotionData} from '../src/character/mixamo/data';
import {retargetMixamo} from '../src/character/mixamo/retarget';
import {makeCharacter} from '../src/character/v3/outfit';
import {BODY_TYPES,createRecipe} from '../src/character/v3/types';

if(!GENERATED_BVH_CLIPS.length)throw new Error('BVH 目录为空；本检查需要至少一个视觉验证动作。');
for(const def of GENERATED_BVH_CLIPS){
  const data=JSON.parse(readFileSync(resolve('public/bvh',def.id+'.json'),'utf8')) as MixamoMotionData;
  validateMixamoData(data,def.id);
  if(data.source.provider!=='BVH')throw new Error(`${def.filename}: provider 不是 BVH。`);
  if(def.filename==='简单跳舞_A.bvh'&&Math.abs(data.fps-30)>.1)throw new Error(`${def.filename}: 预期约 30 FPS，实际 ${data.fps}。`);
  for(const bodyType of BODY_TYPES){
    const bake=retargetMixamo(makeCharacter(createRecipe({bodyType})),data);
    if(bake.clip.tracks.length!==21)throw new Error(`${def.filename}/${bodyType}: 目标轨道数不是 21。`);
    if(!Number.isFinite(bake.scale)||bake.scale<=0||bake.rotations.some(values=>values.some(v=>!Number.isFinite(v)))||bake.hips.some(v=>!Number.isFinite(v)))throw new Error(`${def.filename}/${bodyType}: 重定向产生非有限数值。`);
    const size=bake.bounds.getSize(new T.Vector3());
    if(!Number.isFinite(size.x+size.y+size.z)||size.y<=0)throw new Error(`${def.filename}/${bodyType}: 动画包围盒无效。`);
  }
}
console.log(`BVH checks passed: ${GENERATED_BVH_CLIPS.length} clip(s), male + female retarget.`);
