import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {makeCharacter} from '../src/character/v3/outfit';
import {cleanRecipe,applyPreset,patchSlots,BODY_PROFILE_VERSION} from '../src/character/v3/types';
import {cross,sub,triCount} from '../src/character/v3/cage';
// 从用户已合并的 6627c2e 提取的 12 套男性几何/权重/骨架快照；不得自动更新。
const maleBaselines: Record<string,string> = {
  "body:1.76:0.5": "c9f078936a8b99b9c13638dbea0a09318b6ec9952cfbd7d93e1d896f00109a42",
  "body:1.58:0": "65179d3275d216922cc81b4af0baf51826fd19fc9b8f7ac87dec689796dea002",
  "body:1.92:1": "4cc048c17b495347794f55fcb3f1f89218141b97cd06fcbf513c3e0ec8e3a525",
  "farmer:1.76:0.5": "a859f5f36b8f6a5ae592e2f4072c4e6f4710532628c415b63db072f557947e0a",
  "farmer:1.58:0": "99a97e5ce54b2e3242ea0fde87bae824b2725da28894ea719da6e81beb653a14",
  "farmer:1.92:1": "f4665d86e8a3b72bdcb8ac4621ebca47d842b4cb0ea1af70d63e80dd53a7e84b",
  "guard:1.76:0.5": "3b3d374ed8c01ff65dee13a45fe17128c72cea214aaeffe9f4df121410c90525",
  "guard:1.58:0": "f5b7585a5ec3d791168a1d993eb1586694a781fb8ab7019cd57794b06ff1dfb1",
  "guard:1.92:1": "99d520b03c9ead38e18219330d06ce3ade7cb5d9a5b1e37de7af2200b17bd1b2",
  "archer:1.76:0.5": "3e80a835835ce38f20be823a8078804a480a9655f0a6332cb16ff5e16ca5b203",
  "archer:1.58:0": "5f534bff9f6de43c72c302f27ea1c356dc9c5478d00edefeb7dae7a34c792b75",
  "archer:1.92:1": "045f8b4cc5a0f9603abcddb7a0987fea4a6855fcb919b4c8ca502424888a193e"
};
for(const outfit of ['body','farmer','guard','archer'] as const)for(const [height,build]of[[1.76,.5],[1.58,0],[1.92,1]]){
  const {body,surface,joints}=makeCharacter({outfit,height,build,equipment:true});
  assert.equal(createHash('sha256').update(JSON.stringify({body,surface,joints})).digest('hex'),maleBaselines[`${outfit}:${height}:${build}`],'男性基线发生意外变化');
}
const male=makeCharacter({bodyType:'male',outfit:'body',height:1.76});
const female=makeCharacter({bodyType:'female',outfit:'body',height:1.76});
assert.deepEqual(female.body.faces,male.body.faces,'女性不能另造不兼容的拓扑');
assert.deepEqual(female.body.vertices.map(v=>v.w),male.body.vertices.map(v=>v.w));
assert.deepEqual(female.joints.map(j=>[j.name,j.parent]),male.joints.map(j=>[j.name,j.parent]));
const width=(data:typeof female,name:string)=>Math.max(...data.body.anchors[name].map(i=>Math.abs(data.body.vertices[i].p[0])))*2;
assert(width(female,'Shoulder')<width(male,'Shoulder')*.95,'肩宽没有真正变化');
assert(width(female,'Hip')>width(male,'Hip')*1.03,'髋宽没有真正变化');
assert(width(female,'Jaw')<width(male,'Jaw')*.9,'脸型没有真正变化');
assert(width(female,'Waist')<width(male,'Waist')*.94,'腰部比例没有变化');
const rows=[];
for(const bodyType of ['male','female']as const)for(const headwear of ['none','farmer_straw_hat','guard_helmet','archer_headband']as const){
  const data=makeCharacter({bodyType,outfit:'archer',slots:{headwear},equipment:true});
  const bun=data.surface.vertices.filter(v=>v.id.startsWith('FemaleBun'));
  assert.equal(bun.length>0,bodyType==='female'&&headwear!=='guard_helmet','发髻遮蔽规则错误');
  assert(bun.every(v=>v.w[0]===5&&v.w[1]===5&&v.w[2]===1));
  rows.push({bodyType,headwear,triangles:triCount(data.surface)});
}
// 工具直杆必须仍是直杆，不能在手部以下按髋/腰的形态场弯曲。
const hoe=makeCharacter({bodyType:'female',outfit:'farmer',equipment:true});
const verts=hoe.surface.vertices;
const blade=verts.filter(v=>v.id.startsWith('HoeBlade.'));
assert.equal(blade.length,8);
const at=(n:number)=>blade.find(v=>v.id===`HoeBlade.${n}`)!.p;
assert(Math.hypot(...cross(sub(at(1),at(0)),sub(at(3),at(2))))<1e-9);
const old=cleanRecipe({outfit:'archer'});assert.equal(old.bodyType,'male');
assert.equal(cleanRecipe({bodyType:'female'}).height,1.66);
assert.equal(cleanRecipe({bodyType:'female',height:1.92}).height,1.92);
const diy=patchSlots(applyPreset(cleanRecipe({bodyType:'female'}),'archer'),{headwear:'farmer_straw_hat'});
assert.equal(diy.bodyType,'female');assert.equal(diy.slots.leftHand,'archer_bow');assert.equal(diy.slots.back,'archer_quiver');
assert.deepEqual(cleanRecipe(JSON.parse(JSON.stringify(diy))),diy,'配方导出重入丢失体型');
const changed=cleanRecipe({...diy,bodyType:'male'});assert.deepEqual(changed.slots,diy.slots);assert.equal(changed.height,diy.height);
const report={profileVersion:BODY_PROFILE_VERSION,maleBaselineCommit:'6627c2e47f0c01bc248218f463d128e8dbfe0d74',maleBaselineHashes:12,sharedTopology:true,sharedWeights:true,sharedBoneMap:true,bodyTriangles:triCount(female.body),headwearCases:rows};
mkdirSync('review',{recursive:true});writeFileSync('review/body-profiles.json',JSON.stringify(report,null,2));console.log('PASS body profiles: '+JSON.stringify(report));
