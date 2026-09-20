import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {makeCharacter} from '../src/character/v3/outfit';
import {makeTrousers} from '../src/character/wardrobe/assets/trousers';
import {createRecipe,B,BODY_TYPES,BOTTOM_IDS,presetSlots,type Cage} from '../src/character/v3/types';
import {KNEE,BODY_GEOMETRY_VERSION} from '../src/character/v3/leg-deformation';
import {cloneCage,triCount} from '../src/character/v3/cage';

// 制作契约针对本批固定裤装，不宣称任何未来服装都必须用同一拓扑。
function assertKnee(c:Cage){
  for(const side of ['Right','Left']){
    const thigh=side==='Right'?B.RightThigh:B.LeftThigh,shin=side==='Right'?B.RightShin:B.LeftShin;
    for(const [label,y,w]of [['KneeUpper',KNEE.upperY,KNEE.upperThighWeight],['Knee',KNEE.centerY,KNEE.centerThighWeight],['KneeLower',KNEE.lowerY,KNEE.lowerThighWeight]] as const){
      const loop=c.vertices.filter(v=>v.id.startsWith(`Pants.${side}.${label}.`));
      assert.equal(loop.length,8);
      for(const v of loop){assert.equal(v.p[1],y);assert.deepEqual(v.w,[thigh,shin,w]);}
      assert(Math.min(...loop.map(v=>v.p[2]))<-.03,'膝后截面被压成薄片');
    }
    assert(!c.vertices.some(v=>v.id.startsWith(`Pants.${side}.UpperLeg.`)),'旧长过渡辅助圈未清除');
  }
}
const rows=[];
for(const bodyType of BODY_TYPES){
  const skin=makeCharacter(createRecipe({bodyType,slots:presetSlots('body')}));
  const seam=skin.body.vertices.find(v=>v.id==='Crotch')!;
  assert.deepEqual(seam.w,[B.RightThigh,B.LeftThigh,.5],'裆底仍被钉在骨盆上');
  assert.equal(triCount(skin.body),510,'不得为本轮修复整体细分人体');
  for(const bottom of BOTTOM_IDS){
    if(bottom==='body')continue;
    const recipe=createRecipe({bodyType,slots:{bottom}}),piece=makeTrousers(recipe)!;
    assertKnee(piece.mesh);assert(triCount(piece.mesh)<=220,'裤装面数不能因修膝盖增加');
  }
  rows.push({bodyType,bodyTriangles:triCount(skin.body),bodyHash:createHash('sha256').update(JSON.stringify(skin.body)).digest('hex'),jointsHash:createHash('sha256').update(JSON.stringify(skin.joints)).digest('hex')});
}
const pants=makeTrousers(createRecipe({slots:{bottom:'loose_trousers'}}))!.mesh;
const collapsed=cloneCage(pants);for(const v of collapsed.vertices)if(/\.Knee\.\d+$/.test(v.id)&&v.p[2]<0)v.p[2]=-.012;
assert.throws(()=>assertKnee(collapsed),'反例：旧膝后压薄必须被发现');
const wide=cloneCage(pants);for(const v of wide.vertices)if(v.id.includes('.KneeUpper.'))v.p[1]=.6;
assert.throws(()=>assertKnee(wide),'反例：旧膝上位置必须被发现');
const wrong=cloneCage(pants);for(const v of wrong.vertices)if(v.id.includes('.KneeLower.'))v.w[2]=.24;
assert.throws(()=>assertKnee(wrong),'反例：旧膝下权重必须被发现');
const report={passed:true,bodyGeometryVersion:BODY_GEOMETRY_VERSION,rows,independentTrousersTriangles:triCount(pants),mutationChecks:3,scope:'固定关节制作数据与已知旧代码反例；全FBX姿态贯穿与实际图片另行验证，不等于连续动作全部视觉通过。'};
mkdirSync('review-deformation',{recursive:true});writeFileSync('review-deformation/contracts.json',JSON.stringify(report,null,2));console.log('DEFORMATION CONTRACT',JSON.stringify(report));
