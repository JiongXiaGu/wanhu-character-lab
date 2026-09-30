import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import * as T from 'three';
import {makeCharacter} from '../src/character/v3/outfit';
import {makeActor} from '../src/character/v3/rig';
import {createRecipe,BODY_TYPES,type Face,type TopId,type BottomId} from '../src/character/v3/types';
import {makeTop} from '../src/character/wardrobe/assets/tops';
import {makeTrousers} from '../src/character/wardrobe/assets/trousers';
import {TOP_PATTERNS,BOTTOM_PATTERNS} from '../src/character/wardrobe/patterns';
import {retargetMotion} from '../src/character/motion/retarget';
import {findIntersections,skinPoints} from './lib/garment-focus-intersections';
import {isClosedHemContact} from './garment-contact-scope';

const TOP='court_maid_short_jacket',BOTTOM='court_maid_high_waist_skirt';
const combinations:readonly [TopId,BottomId][]=[
  [TOP,BOTTOM],[TOP,'work_pants'],[TOP,'long_skirt'],['cross_jacket',BOTTOM],
];
const clips=['start-walking','jogging','pilot-switches','shooting-arrow','snatch'] as const;
type Kind={ids:string[];part:Face['part'];region:string;cap:boolean;focus:boolean};
type Frame={bodyType:string;top:TopId;bottom:BottomId;clip:string;time:number;phase:number;sourceKey:boolean;hard:number;warning:number;reasons:Record<string,number>;examples:unknown[]};
type Pose={bodyType:string;clip:string;time:number;phase:number;sourceKey:boolean;boneMatrices:number[]};

/** 仅 C2：用户接受的现有动作手/前臂与腿/裙接触。不是整件上衣或整个人体豁免。
 * 不参与相交数学；保留全部采样、命中和相位，只改变检测后的严重等级。
 */
function acceptedHandLowerContact(a:Kind,b:Kind):boolean {
  const distal=(k:Kind)=>k.part==='skin'&&(k.region==='hand'||k.region==='forearm')&&k.ids.every(id=>/^(Right|Left)(Elbow|ElbowLower|Wrist|Fingers)\.\d+$/.test(id))
    ||k.part==='top'&&k.region==='forearm'&&k.ids.every(id=>/^MaidJacket\.(Right|Left)\.(Elbow|ElbowLower|WristFacing|Cuff)\.\d+$/.test(id));
  const lower=(k:Kind)=>(k.part==='skin'||k.part==='bottom')&&['pelvis','thigh','shin'].includes(k.region);
  return distal(a)&&lower(b)||distal(b)&&lower(a);
}
function classify(a:Kind,b:Kind,bottom:BottomId,sourceKey:boolean,stress:(kind:Kind)=>boolean):string {
  if(acceptedHandLowerContact(a,b))return 'accepted-animation-hand-lower-contact';
  if(stress(a)||stress(b))return 'stress-only';
  if(!sourceKey)return 'midpoint-only';
  if(a.part&&b.part&&a.part!==b.part&&a.part!=='skin'&&b.part!=='skin')return 'wearable-layer';
  if((a.cap&&b.part==='skin')||(b.cap&&a.part==='skin'))return 'hidden-interface-cap';
  if(isClosedHemContact(bottom,a,b))return 'closed-hem-interface';
  return 'hard';
}
// 正反方向与边界反例：不能把身体、自交、肩根或裙子坏形一起放行。
const exterior:Kind={ids:['MaidJacket.Chest.0'],part:'top',region:'torso',cap:false,focus:true};
const body:Kind={ids:['Rib.0'],part:'skin',region:'torso',cap:false,focus:false};
const hand:Kind={ids:['RightWrist.3','RightFingers.3','RightFingers.4'],part:'skin',region:'hand',cap:false,focus:false};
const sleeve:Kind={ids:['MaidJacket.Right.ElbowLower.0','MaidJacket.Right.Cuff.0','MaidJacket.Right.Cuff.1'],part:'top',region:'forearm',cap:false,focus:true};
const skirt:Kind={ids:['MaidSkirt.Knee.0','MaidSkirt.Knee.1','MaidSkirt.KneeLower.1'],part:'bottom',region:'thigh',cap:false,focus:true};
for(const arm of [hand,sleeve])for(const pair of [[arm,skirt],[skirt,arm]])assert.equal(classify(pair[0],pair[1],BOTTOM,true,()=>false),'accepted-animation-hand-lower-contact');
assert.equal(classify(hand,body,BOTTOM,true,()=>false),'hard');
assert.equal(classify(exterior,body,BOTTOM,true,()=>false),'hard');
assert.equal(classify(exterior,exterior,BOTTOM,true,k=>k.part==='bottom'),'hard');
assert.equal(classify(skirt,skirt,BOTTOM,true,()=>false),'hard');
assert.equal(classify(skirt,{...body,region:'thigh'},BOTTOM,true,()=>false),'hard');
assert.equal(classify({...sleeve,ids:['MaidJacket.Right.Shoulder.0'],region:'upperArm'},{...body,region:'thigh'},BOTTOM,true,()=>false),'hard');
assert.equal(classify({...exterior,cap:true},body,BOTTOM,true,()=>false),'hidden-interface-cap');
assert.equal(classify(exterior,body,BOTTOM,false,()=>false),'midpoint-only');

export function checkC2Motion() {
  const rows:any[]=[],observedFrames:Frame[]=[],visualFrames:Frame[]=[],poses:Pose[]=[];
  let checkedFrames=0,testedPairs=0;
  for(const bodyType of BODY_TYPES)for(const [top,bottom]of combinations){
    const recipe=createRecipe({bodyType,slots:{top,bottom,headwear:'none',back:'none',leftHand:'none',rightHand:'none',shoes:'cloth_shoes'}});
    const d=makeCharacter(recipe),c=d.surface,actor=makeActor(d);
    const ports=new Map<string,Set<string>[]>();
    for(const piece of [makeTop(recipe),makeTrousers(recipe)])if(piece)ports.set(piece.slot,Object.values(piece.sealedInterfaces??{}).map(ix=>new Set(ix.map(i=>piece.mesh.vertices[i].id))));
    const indices:number[][]=[],kinds:Kind[]=[];
    for(const f of c.faces)for(let k=1;k<f.v.length-1;k++){
      const ix=[f.v[0],f.v[k],f.v[k+1]],ids=ix.map(i=>c.vertices[i].id);
      indices.push(ix);kinds.push({ids,part:f.part,region:f.region,cap:(ports.get(f.part??'')??[]).some(set=>ids.every(id=>set.has(id))),focus:f.part==='top'&&top===TOP||f.part==='bottom'&&bottom===BOTTOM});
    }
    const focus=kinds.map(k=>k.focus);assert(focus.some(Boolean));
    try{
      actor.update(0);actor.mesh.skeleton.update();const bind=skinPoints(c,actor.mesh.skeleton.boneMatrices);
      assert(bind.every((p,i)=>Math.hypot(...p.map((n,a)=>n-c.vertices[i].p[a]))<1e-5),'bind 蒙皮错误');
      for(const clip of clips){
        const source=JSON.parse(readFileSync(`public/mixamo/${clip}.json`,'utf8')),bake=retargetMotion(d,source);
        const sourceTimes=new Set<number>([0,source.duration,...source.times]);
        const times=[...new Set<number>([...sourceTimes,...source.times.slice(1).map((t:number,i:number)=>(t+source.times[i])/2)])].sort((a,b)=>a-b);
        const action=actor.mixer.clipAction(bake.clip);actor.resetBindPose();action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;
        let blockingFrames=0,warningFrames=0,hits=0,maxPairs=0;
        const start=observedFrames.length;
        try{for(const time of times){
          action.time=time;actor.update(0);actor.mesh.skeleton.update();const points=skinPoints(c,actor.mesh.skeleton.boneMatrices);
          assert(points.every(p=>p.every(Number.isFinite)),'动作出现 NaN/Infinity');checkedFrames++;
          const sourceKey=[...sourceTimes].some(t=>Math.abs(t-time)<1e-8);
          if(top===TOP&&bottom===BOTTOM)poses.push({bodyType,clip,time,phase:time/source.duration,sourceKey,boneMatrices:Array.from(actor.mesh.skeleton.boneMatrices)});
          const hit=findIntersections(c,points,indices,focus,true);testedPairs+=hit.testedPairs;assert.equal(hit.pairs.length,hit.hits);
          if(!hit.hits)continue;
          const stress=(k:Kind)=>k.part==='bottom'&&bottom!=='body'&&!!BOTTOM_PATTERNS[bottom].stressOnlyClips?.includes(clip)||k.part==='top'&&top!=='body'&&!!TOP_PATTERNS[top].stressOnlyClips?.includes(clip);
          let hard=0,warning=0;const reasons:Record<string,number>={},examples:unknown[]=[];
          for(const pair of hit.pairs){const a=kinds[pair.a],b=kinds[pair.b],reason=classify(a,b,bottom,sourceKey,stress);reasons[reason]=(reasons[reason]??0)+1;if(reason==='hard')hard++;else warning++;const example={reason,a:a.ids,b:b.ids,parts:[a.part,b.part]};if(reason==='hard'){examples.unshift(example);if(examples.length>12)examples.pop();}else if(examples.length<12)examples.push(example);}
          assert.equal(hard+warning,hit.hits);hits+=hit.hits;maxPairs=Math.max(maxPairs,hit.hits);if(hard)blockingFrames++;if(warning)warningFrames++;
          observedFrames.push({bodyType,top,bottom,clip,time,phase:time/source.duration,sourceKey,hard,warning,reasons,examples});
        }}finally{action.stop();actor.mixer.uncacheClip(bake.clip);}
        const row={bodyType,top,bottom,clip,samples:times.length,blockingFrames,warningFrames,hits,maxPairs};rows.push(row);console.log('C2_MOTION',JSON.stringify(row));
        const found=observedFrames.slice(start);
        const score=(f:Frame)=>f.hard*100000+Object.entries(f.reasons).reduce((n,[r,k])=>n+k*(r==='hidden-interface-cap'?1:100),0);
        if(found.length)visualFrames.push(found.reduce((a,b)=>score(b)>score(a)?b:a));
      }
    }finally{actor.dispose();}
  }
  assert.equal(rows.length,BODY_TYPES.length*combinations.length*clips.length);
  const passed=rows.every(r=>r.samples>0&&r.blockingFrames===0);
  const report={testedSha:process.env.REVIEW_HEAD_SHA??'local',passed,checkedFrames,testedPairs,rows,observedFrames,visualFrames,visualApproval:false,policy:'全部源键/中点/端点，全身含高腰/袖子。仅 C2 的手/前臂与腿/裙动作接触是用户接受的 Warning；不改公共动作。其余日常源键外层自身/身体贯穿仍 Hard。原隐藏接口、衣层、裙底、中点及显式 stress-only 分级保持。模型爆面/翻面/坏形仍阻塞。',scope:'非共面三角贯穿与全身有限值，不承诺共面接触或连续时间绝对无穿插。只统计至少一面属于本轮 C2 资产的三角对，其它资产原有检查不减少。'};
  mkdirSync('review/c2',{recursive:true});writeFileSync('review/c2/c2-motion.json',JSON.stringify(report,null,2));
  if(!passed)writeFileSync('review/c2/c2-pose-replay.json.gz',gzipSync(JSON.stringify({testedSha:report.testedSha,boneCount:20,poses,scope:'失败诊断；固定男女完整姿态矩阵，不是动作或视觉验收结果。'})));
  console.log('C2_MOTION_SUMMARY',JSON.stringify({passed,checkedFrames,testedPairs,hardRows:rows.filter(r=>r.blockingFrames).length,warningRows:rows.filter(r=>r.warningFrames).length,visualFrames:visualFrames.length}));
  assert(passed,'C2 仍有未获接受的外层自交/穿体；见完整 c2-motion.json');return report;
}
if(process.argv[1]?.endsWith('check-c2-motion.ts'))checkC2Motion();
