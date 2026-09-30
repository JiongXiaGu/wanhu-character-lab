import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
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
  // 套装与三组穿衣混搭；裸上身是静态裙型审查，不冒称已验收裸模动画。
  [TOP,BOTTOM],[TOP,'work_pants'],[TOP,'long_skirt'],['cross_jacket',BOTTOM],
];
const clips=['start-walking','jogging','pilot-switches','shooting-arrow','snatch'] as const;
type Kind={ids:string[];part:Face['part'];region:string;cap:boolean;focus:boolean};
type Frame={bodyType:string;top:TopId;bottom:BottomId;clip:string;time:number;phase:number;sourceKey:boolean;hard:number;warning:number;reasons:Record<string,number>;examples:unknown[]};

/** 检测完成之后才分级；不更改原非共面相交数学、共享点/AABB排除或采样。
 * 固定接口 Cap 穿过皮肤属于隐藏端面；外衣表面×皮肤绝不一起放行。
 */
function classify(a:Kind,b:Kind,bottom:BottomId,sourceKey:boolean,stress:(kind:Kind)=>boolean):string {
  if(stress(a)||stress(b))return 'stress-only';
  if(!sourceKey)return 'midpoint-only';
  if(a.part&&b.part&&a.part!==b.part&&a.part!=='skin'&&b.part!=='skin')return 'wearable-layer';
  if((a.cap&&b.part==='skin')||(b.cap&&a.part==='skin'))return 'hidden-interface-cap';
  if(isClosedHemContact(bottom,a,b))return 'closed-hem-interface';
  return 'hard';
}
// 分类故障反例：外层×身体、自交仍阻塞，不把整件裙子的 stress 借给上衣。
const exterior:Kind={ids:['MaidJacket.Chest.0'],part:'top',region:'torso',cap:false,focus:true};
const body:Kind={ids:['Rib.0'],part:'skin',region:'torso',cap:false,focus:false};
assert.equal(classify(exterior,body,BOTTOM,true,()=>false),'hard');
assert.equal(classify(exterior,exterior,BOTTOM,true,k=>k.part==='bottom'),'hard');
assert.equal(classify({...exterior,cap:true},body,BOTTOM,true,()=>false),'hidden-interface-cap');
assert.equal(classify(exterior,body,BOTTOM,false,()=>false),'midpoint-only');

export function checkC2Motion() {
  const rows:any[]=[],observedFrames:Frame[]=[],visualFrames:Frame[]=[];
  let checkedFrames=0,testedPairs=0;
  for(const bodyType of BODY_TYPES)for(const [top,bottom]of combinations){
    const recipe=createRecipe({bodyType,slots:{top,bottom,headwear:'none',back:'none',leftHand:'none',rightHand:'none',shoes:'cloth_shoes'}});
    const d=makeCharacter(recipe),c=d.surface,actor=makeActor(d);
    const ports=new Map<string,Set<string>[]>();
    for(const piece of [makeTop(recipe),makeTrousers(recipe)])if(piece)ports.set(piece.slot,Object.values(piece.sealedInterfaces??{}).map(ix=>new Set(ix.map(i=>piece.mesh.vertices[i].id))));
    const indices:number[][]=[],kinds:Kind[]=[];
    // 含高腰 torso 和双袖，不能只检查膝部。
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
          const hit=findIntersections(c,points,indices,focus,true);testedPairs+=hit.testedPairs;assert.equal(hit.pairs.length,hit.hits);
          if(!hit.hits)continue;
          const sourceKey=[...sourceTimes].some(t=>Math.abs(t-time)<1e-8);
          const stress=(k:Kind)=>k.part==='bottom'&&bottom!=='body'&&!!BOTTOM_PATTERNS[bottom].stressOnlyClips?.includes(clip)||k.part==='top'&&top!=='body'&&!!TOP_PATTERNS[top].stressOnlyClips?.includes(clip);
          let hard=0,warning=0;const reasons:Record<string,number>={},examples:unknown[]=[];
          for(const pair of hit.pairs){const a=kinds[pair.a],b=kinds[pair.b],reason=classify(a,b,bottom,sourceKey,stress);reasons[reason]=(reasons[reason]??0)+1;if(reason==='hard')hard++;else warning++;const example={reason,a:a.ids,b:b.ids,parts:[a.part,b.part]};if(reason==='hard'){examples.unshift(example);if(examples.length>12)examples.pop();}else if(examples.length<12)examples.push(example);}
          assert.equal(hard+warning,hit.hits);hits+=hit.hits;maxPairs=Math.max(maxPairs,hit.hits);if(hard)blockingFrames++;if(warning)warningFrames++;
          observedFrames.push({bodyType,top,bottom,clip,time,phase:time/source.duration,sourceKey,hard,warning,reasons,examples});
        }}finally{action.stop();actor.mixer.uncacheClip(bake.clip);}
        const row={bodyType,top,bottom,clip,samples:times.length,blockingFrames,warningFrames,hits,maxPairs};rows.push(row);console.log('C2_MOTION',JSON.stringify(row));
        const found=observedFrames.slice(start);
        // 每行选择实际最严重相位，不按安全帧取样。报告保留所有命中帧。
        const score=(f:Frame)=>f.hard*100000+Object.entries(f.reasons).reduce((n,[r,k])=>n+k*(r==='hidden-interface-cap'?1:100),0);
        if(found.length)visualFrames.push(found.reduce((a,b)=>score(b)>score(a)?b:a));
      }
    }finally{actor.dispose();}
  }
  assert.equal(rows.length,BODY_TYPES.length*combinations.length*clips.length);
  const passed=rows.every(r=>r.samples>0&&r.blockingFrames===0);
  const report={testedSha:process.env.REVIEW_HEAD_SHA??'local',passed,checkedFrames,testedPairs,rows,observedFrames,visualFrames,visualApproval:false,policy:'所有源键、相邻中点、端点；全身含高腰/袖子。日常源键外层自身/身体贯穿为 Hard。隐藏接口 Cap、衣层、原窄范围裙底接口、中点、显式资产 stress-only 保留 Warning；截图中任何可见破面升级为阻塞。没有新裙装运动容差。',scope:'非共面三角贯穿与全身有限值，不承诺共面接触或连续时间绝对无穿插。只统计至少一面属于本轮 C2 资产的三角对，其它资产原有检查不减少。'};
  mkdirSync('review/c2',{recursive:true});writeFileSync('review/c2/c2-motion.json',JSON.stringify(report,null,2));
  console.log('C2_MOTION_SUMMARY',JSON.stringify({passed,checkedFrames,testedPairs,hardRows:rows.filter(r=>r.blockingFrames).length,warningRows:rows.filter(r=>r.warningFrames).length,visualFrames:visualFrames.length}));
  assert(passed,'C2 仍有日常源键外层自交/穿体；见完整 c2-motion.json，不能跳过失败相位');return report;
}
if(process.argv[1]?.endsWith('check-c2-motion.ts'))checkC2Motion();
