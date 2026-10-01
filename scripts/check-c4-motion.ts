import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import * as T from 'three';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeActor } from '../src/character/v3/rig';
import { createRecipe, BODY_TYPES, type Face, type BottomId } from '../src/character/v3/types';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { TOP_PATTERNS } from '../src/character/wardrobe/patterns';
import { retargetMotion } from '../src/character/motion/retarget';
import { findIntersections, skinPoints } from './lib/garment-focus-intersections';

const ID='attendant_fitted_long_robe' as const;
const bottoms=['work_pants','work_wrap','long_skirt'] as const;
const clips=['start-walking','jogging','pilot-switches','shooting-arrow','snatch'] as const;
type Kind={ids:string[];part:Face['part'];region:string;cap:boolean;inner:boolean};
type Frame={bodyType:string;top:typeof ID;bottom:BottomId;clip:string;time:number;phase:number;sourceKey:boolean;hard:number;warning:number;reasons:Record<string,number>;examples:unknown[]};
/** 用户已接受公共动画中的手/前臂与腿/长衣下身接触；仅在检测后分类，不隐藏命中。
 * C4 上衣跨下身，因此用明确作者列 + 区域识别下片，不豁免整件 top。
 * Upper→Elbow 是原袖子 forearm 区域的肘上过渡边；upperArm 区域仍禁止借用。
 */
function acceptedHandLowerContact(a:Kind,b:Kind):boolean{
  const distal=(k:Kind)=>k.part==='skin'&&['hand','forearm'].includes(k.region)&&k.ids.every(id=>/^(Right|Left)(Elbow|ElbowLower|Wrist|Fingers)\.\d+$/.test(id))
    ||k.part==='top'&&k.region==='forearm'&&k.ids.every(id=>/^Attendant\.(Right|Left)\.(Upper|Elbow|ElbowLower|Forearm|CuffFacing|Cuff)\.\d+$/.test(id));
  const lower=(k:Kind)=>(k.part==='skin'||k.part==='bottom')&&['pelvis','thigh','shin'].includes(k.region)
    ||k.part==='top'&&['pelvis','thigh','shin'].includes(k.region)&&k.ids.every(id=>/^Attendant\.(Inner\.)?(WaistLower|Hip|SlitRoot|UpperPanel|KneeUpper|Knee|HemFacing|Hem)\.\d+$/.test(id));
  return distal(a)&&lower(b)||distal(b)&&lower(a);
}
function classify(a:Kind,b:Kind,sourceKey:boolean,stress:boolean):string{
  if(acceptedHandLowerContact(a,b))return 'accepted-animation-hand-lower-contact';
  if(stress)return 'stress-only';
  if(!sourceKey)return 'midpoint-only';
  if(a.inner||b.inner)return 'hidden-lining';
  if(a.part&&b.part&&a.part!==b.part&&a.part!=='skin'&&b.part!=='skin')return 'wearable-layer';
  if(a.cap&&b.part==='skin'||b.cap&&a.part==='skin')return 'hidden-interface-cap';
  return 'hard';
}
// 肩根/躯干/下摆自身仍 Hard；只有此前用户接受的原动画末端手臂与下身接触分类 Warning。
const outer:Kind={ids:['Attendant.Chest.0'],part:'top',region:'torso',cap:false,inner:false};
const skin:Kind={ids:['RightThigh.0'],part:'skin',region:'thigh',cap:false,inner:false};
assert.equal(classify(outer,outer,true,false),'hard');assert.equal(classify(outer,skin,true,false),'hard');
const hand:Kind={...skin,ids:['RightWrist.3','RightFingers.3','RightFingers.4'],region:'hand'};
const sleeve:Kind={...outer,ids:['Attendant.Right.Elbow.0','Attendant.Right.Upper.0','Attendant.Right.Upper.1'],region:'forearm'};
const hem:Kind={...outer,ids:['Attendant.Hem.0','Attendant.HemFacing.0','Attendant.HemFacing.1'],region:'shin'};
for(const arm of [hand,sleeve])for(const pair of [[arm,hem],[hem,arm],[arm,skin],[skin,arm]])assert.equal(classify(pair[0],pair[1],true,false),'accepted-animation-hand-lower-contact');
assert.equal(classify(sleeve,outer,true,false),'hard');assert.equal(classify(hand,outer,true,false),'hard');
assert.equal(classify({...sleeve,region:'upperArm'},hem,true,false),'hard');
assert.equal(classify({...sleeve,ids:['Attendant.Right.SleeveHead.0']},hem,true,false),'hard');
assert.equal(classify(hem,hem,true,false),'hard');assert.equal(classify(hem,skin,true,false),'hard');
assert.equal(classify({...outer,inner:true},outer,true,false),'hidden-lining');
assert.equal(classify({...outer,cap:true},skin,true,false),'hidden-interface-cap');
assert.equal(classify(outer,{...skin,part:'bottom'},true,false),'wearable-layer');
assert.equal(classify(outer,skin,false,false),'midpoint-only');assert.equal(classify(outer,skin,true,true),'stress-only');

export function checkC4Motion(){
  const stressOnly=new Set(TOP_PATTERNS[ID].stressOnlyClips??[]);assert.deepEqual([...stressOnly],['snatch']);
  const rows:any[]=[],observedFrames:Frame[]=[],visualFrames:Frame[]=[],poses:unknown[]=[];
  let checkedFrames=0,testedPairs=0;
  for(const bodyType of BODY_TYPES)for(const bottom of bottoms){
    const recipe=createRecipe({bodyType,slots:{top:ID,bottom,headwear:'none',back:'none',leftHand:'none',rightHand:'none',shoes:'cloth_shoes'}});
    const d=makeCharacter(recipe),c=d.surface,actor=makeActor(d),top=makeTop(recipe)!;
    const ports=Object.values(top.sealedInterfaces!).map(ix=>new Set(ix.map(i=>top.mesh.vertices[i].id)));
    const indices:number[][]=[],kinds:Kind[]=[];
    for(const f of c.faces)for(let k=1;k<f.v.length-1;k++){
      const ix=[f.v[0],f.v[k],f.v[k+1]],ids=ix.map(i=>c.vertices[i].id);indices.push(ix);
      kinds.push({ids,part:f.part,region:f.region,cap:f.part==='top'&&ports.some(set=>ids.every(id=>set.has(id))),inner:f.part==='top'&&ids.every(id=>id.startsWith('Attendant.Inner.'))});
    }
    const focus=kinds.map(k=>k.part==='top');assert(focus.some(Boolean),'新服饰必须进入采样');
    try{
      actor.update(0);actor.mesh.skeleton.update();const bind=skinPoints(c,actor.mesh.skeleton.boneMatrices);
      assert(bind.every((p,i)=>Math.hypot(...p.map((n,a)=>n-c.vertices[i].p[a]))<1e-5),'绑定必须还原作者坐标');
      for(const clip of clips){
        const source=JSON.parse(readFileSync(`public/mixamo/${clip}.json`,'utf8'));
        assert(source.times.length>1&&source.duration>0,'不得缺动作后静默跳过');
        const sourceTimes=new Set<number>([0,source.duration,...source.times]);
        const times=[...new Set<number>([...sourceTimes,...source.times.slice(1).map((t:number,i:number)=>(t+source.times[i])/2)])].sort((a,b)=>a-b);
        const bake=retargetMotion(d,source);actor.resetBindPose();const action=actor.mixer.clipAction(bake.clip);
        action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;
        let blockingFrames=0,warningFrames=0,hits=0,maxPairs=0;const start=observedFrames.length;
        try{for(const time of times){
          action.time=time;actor.update(0);actor.mesh.skeleton.update();const points=skinPoints(c,actor.mesh.skeleton.boneMatrices);
          assert(points.every(p=>p.every(Number.isFinite)),'C4 动作坐标非有限值');checkedFrames++;
          const sourceKey=[...sourceTimes].some(t=>Math.abs(t-time)<1e-8);
          if(bottom==='work_pants')poses.push({bodyType,clip,time,phase:time/source.duration,sourceKey,boneMatrices:Array.from(actor.mesh.skeleton.boneMatrices)});
          const hit=findIntersections(c,points,indices,focus,true);testedPairs+=hit.testedPairs;assert.equal(hit.pairs.length,hit.hits);
          if(!hit.hits)continue;
          let hard=0,warning=0;const reasons:Record<string,number>={},examples:unknown[]=[];
          for(const pair of hit.pairs){
            const a=kinds[pair.a],b=kinds[pair.b],reason=classify(a,b,sourceKey,stressOnly.has(clip));
            reasons[reason]=(reasons[reason]??0)+1;if(reason==='hard')hard++;else warning++;
            const example={reason,a:a.ids,b:b.ids,parts:[a.part,b.part],regions:[a.region,b.region]};
            if(reason==='hard'){examples.unshift(example);if(examples.length>12)examples.pop();}else if(examples.length<12)examples.push(example);
          }
          assert.equal(hard+warning,hit.hits,'不能丢弃原始命中');hits+=hit.hits;maxPairs=Math.max(maxPairs,hit.hits);
          if(hard)blockingFrames++;if(warning)warningFrames++;
          observedFrames.push({bodyType,top:ID,bottom,clip,time,phase:time/source.duration,sourceKey,hard,warning,reasons,examples});
        }}finally{action.stop();actor.mixer.uncacheClip(bake.clip);}
        const found=observedFrames.slice(start),row={bodyType,top:ID,bottom,clip,samples:times.length,blockingFrames,warningFrames,hits,maxPairs};rows.push(row);
        const score=(f:Frame)=>f.hard*100000+Object.entries(f.reasons).reduce((n,[r,k])=>n+k*(r==='hidden-interface-cap'||r==='hidden-lining'?1:100),0);
        if(found.length){const worst=found.reduce((a,b)=>score(b)>score(a)?b:a);visualFrames.push(worst);if(worst.hard)console.error('C4_HARD_FRAME',JSON.stringify(worst));}
        console.log('C4_MOTION',JSON.stringify(row));
      }
    }finally{actor.dispose();}
  }
  assert.equal(rows.length,BODY_TYPES.length*bottoms.length*clips.length,'不得缩减男女/下装/动作矩阵');
  const passed=rows.every(r=>r.samples>0&&r.blockingFrames===0);
  const report={testedSha:process.env.REVIEW_HEAD_SHA??'local',passed,id:ID,checkedFrames,testedPairs,rows,observedFrames,visualFrames,visualApproval:false,
    policy:'全部源键/中点/端点，全身衣面含袖根、收袖、腰髋、前后片及开衩厚边。日常源键外层自身/身体贯穿 Hard；原隐藏内收层、实际接口 Cap×皮肤、独立衣层、仅中点、显式 Snatch stress-only 命中完整保留为 Warning。公共动画原有手/前臂与腿/长衣下片接触按用户既有授权单列 accepted-animation-hand-lower-contact，保留全部命中并审图，不改公共动作；上臂/肩根/躯干/下摆自身坏形仍阻塞。',
    scope:'沿用原非共面贯穿算法/容差，只统计至少一面属于 C4 top 的三角对；原全目录下装/C1/C2检查继续执行。不宣称共面接触、连续时间或全部混搭绝对无穿插。'};
  for(const dir of ['review-tailoring-v2','review/garment-focus/top-'+ID]){mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/c4-motion.json`,JSON.stringify(report,null,2));}
  if(!passed)writeFileSync('review/garment-focus/top-'+ID+'/c4-pose-replay.json.gz',gzipSync(JSON.stringify({testedSha:report.testedSha,boneCount:20,poses})));
  if(process.env.SOLDIER_CHECK_DIR){const dir=process.env.SOLDIER_CHECK_DIR+'/intersections';mkdirSync(dir,{recursive:true});writeFileSync(dir+'/c4-motion.json',JSON.stringify(report,null,2));}
  console.log('C4_MOTION_SUMMARY',JSON.stringify({passed,checkedFrames,testedPairs,hardRows:rows.filter(r=>r.blockingFrames).length,warningRows:rows.filter(r=>r.warningFrames).length}));
  assert(passed,'C4 日常动作仍有外层自交或穿体；检查完整 c4-motion.json，不得减采样/调容差绕过');return report;
}
if(process.argv[1]?.endsWith('check-c4-motion.ts'))checkC4Motion();
