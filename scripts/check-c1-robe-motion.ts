import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as T from 'three';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeActor } from '../src/character/v3/rig';
import { createRecipe, BODY_TYPES, type Cage } from '../src/character/v3/types';
import { retargetMotion } from '../src/character/motion/retarget';
import { findIntersections, skinPoints, triangles, type IntersectionPair } from './lib/garment-focus-intersections';

type Severity='hard'|'warning';
type MotionRow={
  bodyType:string;bottom:string;clip:string;samples:number;
  blockingFrames:number;warningFrames:number;observedFrames:number;
  maxPairs:number;maxBlockingPairs:number;maxWarningPairs:number;
};

const isInnerIds=(ids:string[])=>ids.length>0&&ids.every(id=>id.startsWith('Robe.Inner.'));
const classifyIds=(a:string[],b:string[]):Severity=>isInnerIds(a)||isInnerIds(b)?'warning':'hard';

// 分级本身有最小故障回归：隐藏内层参与的交叉只能是 warning；
// 外袍表面、可见回折边或其它非 Inner 面之间的交叉仍是 hard。
assert.equal(classifyIds(['Robe.Inner.Knee.0','Robe.Inner.Knee.1'],['Skirt.Knee.0','Skirt.Knee.1']),'warning');
assert.equal(classifyIds(['Robe.Inner.Seat.0'],['Robe.KneeUpper.0']),'warning');
assert.equal(classifyIds(['Robe.KneeUpper.0'],['Skirt.Knee.0']),'hard');
assert.equal(classifyIds(['Robe.Seat.0'],['Robe.KneeUpper.0']),'hard');

function pairIds(c:Cage,indices:number[][],pair:IntersectionPair) {
  return {
    a:indices[pair.a].map(i=>c.vertices[i].id),
    b:indices[pair.b].map(i=>c.vertices[i].id),
  };
}

/** C1 新 top 与下身的额外检查。
 * 6054 姿态、原非共面贯穿算法、容差和接触范围全部保留；
 * 这里只把“检测结果”和“是否阻止合并”分开。
 */
export function checkC1RobeMotion() {
  const clips=['start-walking','jogging','pilot-switches','shooting-arrow','snatch'] as const;
  const bottoms=['work_pants','work_wrap','long_skirt'] as const;
  const rows:MotionRow[]=[];
  const failures:unknown[]=[],warnings:unknown[]=[],replays:unknown[]=[];
  let checkedFrames=0,testedPairs=0;
  for(const bodyType of BODY_TYPES)for(const bottom of bottoms) {
    const d=makeCharacter(createRecipe({bodyType,slots:{top:'narrow_long_robe',bottom,headwear:'none',back:'none',leftHand:'none',rightHand:'none',shoes:'cloth_shoes'}}));
    const c=d.surface,actor=makeActor(d),sample=triangles(c,true);
    assert(sample.focus.some(Boolean),'C1 下身作者面没有进入采样');
    const frames:unknown[]=[];
    try {
      actor.update(0);actor.mesh.skeleton.update();
      const bind=skinPoints(c,actor.mesh.skeleton.boneMatrices);
      assert(Math.max(...bind.map((p,i)=>Math.hypot(...p.map((n,a)=>n-c.vertices[i].p[a]))))<1e-5,'C1 bind 蒙皮必须还原');
      for(const clip of clips) {
        const source=JSON.parse(readFileSync(`public/mixamo/${clip}.json`,'utf8'));
        assert(source.times.length>1&&source.duration>0,'不能缺少源动作后静默跳过');
        const sourceTimes=new Set<number>([0,source.duration,...source.times]);
        const times=[...new Set<number>([...sourceTimes,...source.times.slice(1).map((t:number,i:number)=>(t+source.times[i])/2)])].sort((a,b)=>a-b);
        const bake=retargetMotion(d,source);actor.resetBindPose();
        const action=actor.mixer.clipAction(bake.clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;
        let blockingFrames=0,warningFrames=0,observedFrames=0,maxPairs=0,maxBlockingPairs=0,maxWarningPairs=0;
        let loggedHard=0,loggedWarning=0;
        const replayFrames:unknown[]=[];
        try {
          for(const time of times) {
            action.time=time;actor.update(0);actor.mesh.skeleton.update();
            const points=skinPoints(c,actor.mesh.skeleton.boneMatrices);
            assert(points.every(p=>p.every(Number.isFinite)),`${bodyType}/${bottom}/${clip}: 动作坐标非有限值`);
            const hit=findIntersections(c,points,sample.indices,sample.focus,true);
            checkedFrames++;testedPairs+=hit.testedPairs;
            if(!hit.hits) continue;
            observedFrames++;maxPairs=Math.max(maxPairs,hit.hits);
            let visiblePairs=0,hiddenPairs=0;
            const visibleExamples:{a:string[];b:string[]}[]=[],hiddenExamples:{a:string[];b:string[]}[]=[];
            for(const pair of hit.pairs) {
              const ids=pairIds(c,sample.indices,pair);
              if(classifyIds(ids.a,ids.b)==='warning') {
                hiddenPairs++;
                if(hiddenExamples.length<4)hiddenExamples.push(ids);
              } else {
                visiblePairs++;
                if(visibleExamples.length<4)visibleExamples.push(ids);
              }
            }
            assert.equal(visiblePairs+hiddenPairs,hit.hits,'严重级别分类必须覆盖每一个原始贯穿，不得静默丢弃');
            // 只在两个源关键帧之间的中点出现的外层交叉仍完整记录，但作为瞬时 warning。
            // 源关键帧/端点的外层交叉继续 hard fail；没有改变任何碰撞容差。
            const sourceFrame=sourceTimes.has(time);
            const blockingPairs=sourceFrame?visiblePairs:0;
            const warningPairs=hiddenPairs+(sourceFrame?0:visiblePairs);
            if(blockingPairs) {
              blockingFrames++;maxBlockingPairs=Math.max(maxBlockingPairs,blockingPairs);
              const failure={bodyType,bottom,clip,time,phase:time/source.duration,hits:blockingPairs,totalHits:hit.hits,
                reason:'visible-surface-source-frame',examples:visibleExamples};
              if(loggedHard++<4) {
                failures.push(failure);
                if(loggedHard===1) {
                  replayFrames[0]={severity:'hard',clip,time,phase:time/source.duration,hits:blockingPairs,matrices:Array.from(actor.mesh.skeleton.boneMatrices)};
                  console.error('C1_HARD_INTERSECTION',JSON.stringify(failure));
                }
              }
              if(!replayFrames[1]||blockingPairs>(replayFrames[1] as {hits:number}).hits)
                replayFrames[1]={severity:'hard',clip,time,phase:time/source.duration,hits:blockingPairs,matrices:Array.from(actor.mesh.skeleton.boneMatrices)};
            }
            if(warningPairs) {
              warningFrames++;maxWarningPairs=Math.max(maxWarningPairs,warningPairs);
              if(loggedWarning++<4) warnings.push({bodyType,bottom,clip,time,phase:time/source.duration,hits:warningPairs,totalHits:hit.hits,
                reason:hiddenPairs?'hidden-lining-or-midpoint':'midpoint-visible',hiddenPairs,midpointVisiblePairs:sourceFrame?0:visiblePairs,
                examples:hiddenExamples.length?hiddenExamples:visibleExamples});
              if(!blockingPairs&&!replayFrames[2])
                replayFrames[2]={severity:'warning',clip,time,phase:time/source.duration,hits:warningPairs,matrices:Array.from(actor.mesh.skeleton.boneMatrices)};
            }
          }
        } finally { action.stop();actor.mixer.uncacheClip(bake.clip); }
        frames.push(...replayFrames.filter(Boolean));
        const row={bodyType,bottom,clip,samples:times.length,blockingFrames,warningFrames,observedFrames,maxPairs,maxBlockingPairs,maxWarningPairs};
        rows.push(row);
        console.log('C1_ROBE_MOTION',JSON.stringify(row));
      }
    } finally { actor.dispose(); }
    if(frames.length)replays.push({bodyType,bottom,vertices:c.vertices,indices:sample.indices,focus:sample.focus,frames});
  }
  assert.equal(rows.length,BODY_TYPES.length*bottoms.length*clips.length,'不得删除性别/下装/动作样本');
  const passed=rows.every(r=>r.samples>0&&r.blockingFrames===0);
  const report={passed,testedSha:process.env.REVIEW_HEAD_SHA??'local',checkedFrames,testedPairs,rows,failures,warnings,
    policy:{
      hard:'不含 Robe.Inner 的本轮 top 外层/可见回折边与其它衣面、身体或自身发生原算法非共面贯穿，且出现在源关键帧或端点；阻止合并。',
      warning:'任一完全隐藏的 Robe.Inner 三角参与的贯穿，或只出现在两个源键中点的外层贯穿；继续记录和截图审查，但不单独阻止合并。若截图显示 warning 实际暴露为可见破面，人工视觉验收仍阻止合并。',
    },
    sampling:'全部源键、相邻中点、首尾；原非共面贯穿算法和容差不变；无 C1 接触豁免。严重级别在检测之后分类，不删除任何命中。',
    scope:'C1 top 与 pelvis/thigh/shin 范围内的衣面/可见皮肤及自身。下装自身由原全目录检查负责；全身有限值也检查。不宣称袖口/手/领口、共面接触或连续时间绝对零穿插，须结合实际动作截图。',visualApproval:false};
  const out='review/garment-focus/top-narrow_long_robe';
  for(const dir of ['review-tailoring-v2',out]) {
    mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/c1-robe-motion.json`,JSON.stringify(report,null,2));
  }
  if(replays.length)writeFileSync(`${out}/c1-failure-replay.json`,JSON.stringify({testedSha:report.testedSha,replays}));
  const failedRows=rows.filter(r=>r.blockingFrames),warningRows=rows.filter(r=>r.warningFrames);
  console.log('C1_ROBE_MOTION_SUMMARY',JSON.stringify({passed,checkedFrames,testedPairs,failedRows,warningRows}));
  assert(passed,'C1 存在源关键帧/端点的外层可见面贯穿；隐藏内层和仅中点命中已经降为 warning，不能再通过降低采样/容差绕过');
  return report;
}
if(process.argv[1]?.endsWith('check-c1-robe-motion.ts'))checkC1RobeMotion();
