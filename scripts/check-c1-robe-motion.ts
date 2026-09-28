import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as T from 'three';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeActor } from '../src/character/v3/rig';
import { createRecipe, BODY_TYPES } from '../src/character/v3/types';
import { retargetMotion } from '../src/character/motion/retarget';
import { findIntersections, skinPoints, triangles } from './lib/garment-focus-intersections';

/** C1 新 top 与下身的额外检查；原下装全目录、容差和接触规则完全保留。 */
export function checkC1RobeMotion() {
  const clips=['start-walking','jogging','pilot-switches','shooting-arrow','snatch'] as const;
  const bottoms=['work_pants','work_wrap','long_skirt'] as const;
  const rows: {bodyType:string;bottom:string;clip:string;samples:number;blockingFrames:number;maxPairs:number}[]=[];
  const failures:unknown[]=[],replays:unknown[]=[];
  let checkedFrames=0,testedPairs=0;
  for(const bodyType of BODY_TYPES)for(const bottom of bottoms) {
    const d=makeCharacter(createRecipe({bodyType,slots:{top:'narrow_long_robe',bottom,headwear:'none',back:'none',leftHand:'none',rightHand:'none',shoes:'cloth_shoes'}}));
    const c=d.surface,actor=makeActor(d),sample=triangles(c,true);
    assert(sample.focus.some(Boolean),'C1 下身作者面没有进入采样');
    // 小型失败重放数据仅保留实际受测衣面和骨矩阵，不改变检测过程或样本。
    const frames:unknown[]=[];
    try {
      actor.update(0);actor.mesh.skeleton.update();
      const bind=skinPoints(c,actor.mesh.skeleton.boneMatrices);
      assert(Math.max(...bind.map((p,i)=>Math.hypot(...p.map((n,a)=>n-c.vertices[i].p[a]))))<1e-5,'C1 bind 蒙皮必须还原');
      for(const clip of clips) {
        const source=JSON.parse(readFileSync(`public/mixamo/${clip}.json`,'utf8'));
        assert(source.times.length>1&&source.duration>0,'不能缺少源动作后静默跳过');
        const times=[...new Set<number>([0,source.duration,...source.times,...source.times.slice(1).map((t:number,i:number)=>(t+source.times[i])/2)])].sort((a,b)=>a-b);
        const bake=retargetMotion(d,source);actor.resetBindPose();
        const action=actor.mixer.clipAction(bake.clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;
        let blockingFrames=0,maxPairs=0,logged=0;
        const replayFrames:unknown[]=[];
        try {
          for(const time of times) {
            action.time=time;actor.update(0);actor.mesh.skeleton.update();
            const points=skinPoints(c,actor.mesh.skeleton.boneMatrices);
            assert(points.every(p=>p.every(Number.isFinite)),`${bodyType}/${bottom}/${clip}: 动作坐标非有限值`);
            const hit=findIntersections(c,points,sample.indices,sample.focus);
            checkedFrames++;testedPairs+=hit.testedPairs;
            if(hit.hits) {
              blockingFrames++;
              if(hit.hits>maxPairs) {
                maxPairs=hit.hits;
                replayFrames[1]={clip,time,phase:time/source.duration,hits:hit.hits,matrices:Array.from(actor.mesh.skeleton.boneMatrices)};
              }
              if(logged++<4) {
                const failure={bodyType,bottom,clip,time,phase:time/source.duration,hits:hit.hits,examples:hit.examples};
                failures.push(failure);
                if(logged===1) {
                  replayFrames[0]={clip,time,phase:time/source.duration,hits:hit.hits,matrices:Array.from(actor.mesh.skeleton.boneMatrices)};
                  console.error('C1_INTERSECTION_VERTICES',JSON.stringify(failure));
                }
              }
            }
          }
        } finally { action.stop();actor.mixer.uncacheClip(bake.clip); }
        frames.push(...replayFrames.filter(Boolean));
        const row={bodyType,bottom,clip,samples:times.length,blockingFrames,maxPairs};rows.push(row);
        console.log('C1_ROBE_MOTION',JSON.stringify(row));
      }
    } finally { actor.dispose(); }
    if(frames.length)replays.push({bodyType,bottom,vertices:c.vertices,indices:sample.indices,focus:sample.focus,frames});
  }
  assert.equal(rows.length,BODY_TYPES.length*bottoms.length*clips.length,'不得删除性别/下装/动作样本');
  const passed=rows.every(r=>r.samples>0&&r.blockingFrames===0);
  const report={passed,testedSha:process.env.REVIEW_HEAD_SHA??'local',checkedFrames,testedPairs,rows,failures,
    sampling:'全部源键、相邻中点、首尾；原非共面贯穿算法和容差；无 C1 接触豁免，Snatch 同样记录并阻塞',
    scope:'C1 top 与 pelvis/thigh/shin 范围内的衣面/可见皮肤及自身。下装自身由原全目录检查负责；全身有限值也检查。不宣称袖口/手/领口、共面接触或连续时间绝对零穿插，须结合实际动作截图。',visualApproval:false};
  const out='review/garment-focus/top-narrow_long_robe';
  for(const dir of ['review-tailoring-v2',out]) {
    mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/c1-robe-motion.json`,JSON.stringify(report,null,2));
  }
  if(replays.length)writeFileSync(`${out}/c1-failure-replay.json`,JSON.stringify({testedSha:report.testedSha,replays}));
  console.log('C1_ROBE_MOTION_SUMMARY',JSON.stringify({passed,checkedFrames,testedPairs,failedRows:rows.filter(r=>r.blockingFrames)}));
  assert(passed,'C1 长袍下身动作贯穿，必须修作者几何/权重，不能降低采样或增加豁免');
  return report;
}
if(process.argv[1]?.endsWith('check-c1-robe-motion.ts'))checkC1RobeMotion();
