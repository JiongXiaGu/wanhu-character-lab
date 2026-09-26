import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {BODY_TYPES} from '../src/character/v3/types';
import {MOTION_CLIPS,motionAssetDirectory} from '../src/character/motion/catalog';
import {SOLDIER_ARMOR_CLASS_IDS,SOLDIER_STYLE_IDS} from '../src/soldier/contract';
import {SOLDIER_IDENTITY_IDS} from '../src/soldier/identities';

type Case={variant:string;bodyType:string;clip:string;samples:number;sampleDigest:string};
type Report={passed:boolean;sourceSHA:string;motionArmor:string;motionCases:Case[];poses:number;motions:number;variantCount:number};
const sourceSHA=process.env.REVIEW_HEAD_SHA;
assert(sourceSHA&&/^[a-f0-9]{40}$/.test(sourceSHA),'Explicit REVIEW_HEAD_SHA is required; never accept a stale or implicit candidate.');
// Independently reconstruct the expected complete source-key/midpoint inventory.
const expected=new Map<string,Case>();
const sampleSets=MOTION_CLIPS.map(def=>{
  const source=JSON.parse(readFileSync(`public/${motionAssetDirectory(def.id)}/${def.id}.json`,'utf8'));
  const times=[...new Set<number>([0,source.duration,...source.times,...source.times.slice(1).map((t:number,i:number)=>(t+source.times[i])/2)])].sort((a,b)=>a-b);
  assert(times.length>0&&times.every(Number.isFinite));
  return{clip:def.id,samples:times.length,sampleDigest:createHash('sha256').update(JSON.stringify(times)).digest('hex')};
});
for(const armor of SOLDIER_ARMOR_CLASS_IDS)for(const style of SOLDIER_STYLE_IDS)for(const identity of SOLDIER_IDENTITY_IDS)for(const bodyType of BODY_TYPES)for(const sample of sampleSets){
  const entry={variant:`${style}-${armor}-${identity}`,bodyType,...sample};
  expected.set(`${entry.variant}/${bodyType}/${entry.clip}`,entry);
}
function verify(reports:Report[]){
  assert.equal(reports.length,SOLDIER_ARMOR_CLASS_IDS.length,'Missing or unexpected motion shard');
  const groups=new Set<string>(),cases=new Set<string>();let poses=0;
  for(const report of reports){
    assert.equal(report.passed,true);assert.equal(report.sourceSHA,sourceSHA,'Reports must belong to this exact candidate');
    assert(SOLDIER_ARMOR_CLASS_IDS.some(id=>id===report.motionArmor));assert(!groups.has(report.motionArmor),'Duplicate armor shard');groups.add(report.motionArmor);
    assert.equal(report.motions,MOTION_CLIPS.length);assert.equal(report.variantCount,18);
    assert.equal(report.motionCases.length,3*2*BODY_TYPES.length*MOTION_CLIPS.length);
    let shardPoses=0;
    for(const entry of report.motionCases){
      assert(entry.variant.split('-')[1]===report.motionArmor,'Case placed into wrong armor shard');
      const key=`${entry.variant}/${entry.bodyType}/${entry.clip}`;
      assert(!cases.has(key),`Duplicate motion case: ${key}`);
      assert.deepEqual(entry,expected.get(key),`Missing, modified or undersampled motion case: ${key}`);
      cases.add(key);shardPoses+=entry.samples;
    }
    assert.equal(report.poses,shardPoses,'Pose counter disagrees with actual case inventory');poses+=shardPoses;
  }
  assert.equal(cases.size,expected.size,'Complete 18 loadouts × 2 bodies × actual motion inventory is required');
  assert.equal(poses,[...expected.values()].reduce((sum,x)=>sum+x.samples,0));
  return{poses,cases:cases.size,shards:groups.size,motions:MOTION_CLIPS.length};
}
// Prove the aggregator rejects incomplete CI results, not merely green-looking reports.
const fixture:Report[]=SOLDIER_ARMOR_CLASS_IDS.map(armor=>{
 const motionCases=[...expected.values()].filter(c=>c.variant.split('-')[1]===armor);
 return{passed:true,sourceSHA,motionArmor:armor,motionCases,poses:motionCases.reduce((sum,c)=>sum+c.samples,0),motions:MOTION_CLIPS.length,variantCount:18};
});
verify(fixture);
const faults=[
 (r:Report[])=>{r.pop();},
 (r:Report[])=>{r[1]=structuredClone(r[0]);},
 (r:Report[])=>{r[0].sourceSHA='0'.repeat(40);},
 (r:Report[])=>{r[0].passed=false;},
 (r:Report[])=>{r[0].motionCases.pop();},
 (r:Report[])=>{r[0].motionCases[0]=structuredClone(r[0].motionCases[1]);},
 (r:Report[])=>{r[0].motionCases[0].samples--;},
 (r:Report[])=>{r[0].motionCases[0].sampleDigest='wrong-time-set';},
 (r:Report[])=>{r[0].poses--;},
];
for(const mutate of faults){const broken=structuredClone(fixture);mutate(broken);assert.throws(()=>verify(broken));}
function findReports(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?findReports(join(dir,e.name)):e.name==='motion.json'?[join(dir,e.name)]:[]);}
let failure:unknown,coverage:ReturnType<typeof verify>|undefined;
try{
 const root=process.argv[2];assert(root,'Motion artifact directory is required');
 coverage=verify(findReports(root).map(path=>JSON.parse(readFileSync(path,'utf8'))));
}catch(error){failure=error;}
const report={passed:failure===undefined,sourceSHA,coverage,aggregationFaults:faults.length,scope:'No source frames or midpoint cases removed; each armor shard must be complete and disjoint.',...(failure?{error:String(failure)}:{})};
mkdirSync('review',{recursive:true});writeFileSync('review/soldier-motion-coverage.json',JSON.stringify(report,null,2)+'\n');
console.log('SOLDIER_MOTION_COVERAGE',JSON.stringify(report));
if(failure)throw failure;
