// 一次性、严格匹配的任务迁移脚本。只在任务分支运行，收尾时删除。
import {readFileSync,writeFileSync} from 'node:fs';
function replace(path,before,after){const s=readFileSync(path,'utf8');if(s.split(before).length!==2)throw new Error('Expected one source match: '+path+' / '+before);writeFileSync(path,s.replace(before,after));}
const body='src/character/v3/body.ts',pants='src/character/wardrobe/assets/trousers.ts';
writeFileSync('src/character/v3/leg-deformation.ts',`/** 固定成年基模的膝关节制作基准。裸模和首批裤装共享关节位置，不共享衣面。 */
export const KNEE = Object.freeze({
  upperY: 0.529,
  centerY: 0.489,
  lowerY: 0.449,
  upperThighWeight: 0.94,
  centerThighWeight: 0.5,
  lowerThighWeight: 0.06,
});
/** 只变更皮肤蒙皮；骨骼索引、绑定位置和裸模膝部原值不变。 */
export const BODY_GEOMETRY_VERSION = 'wanhu-skin-cage-v2';
`);
replace(body,'import { femalePoint }','import { KNEE } from "./leg-deformation";\nimport { femalePoint }');
replace(body,'const crotch = vertex(c, "Crotch", [0, 0.815, 0], rigid(B.Hips));','// 中缝随左右大腿的平均姿态移动，不能在抬腿时仍钉在骨盆下方。\n  const crotch = vertex(c, "Crotch", [0, 0.815, 0], [B.RightThigh, B.LeftThigh, 0.5]);');
replace(body,'// 两条腿都由同一骨盆边界分叉，裆点由 Hips 驱动，不重复。','// 两条腿从同一骨盆边界连接；中央点为左右大腿双权重，不再刚性悬挂。');
replace(body,'["KneeUpper", 0.529, 0.058, 0.057, 0, [thigh, shin, 0.94]]','["KneeUpper", KNEE.upperY, 0.058, 0.057, 0, [thigh, shin, KNEE.upperThighWeight]]');
replace(body,'["Knee", 0.489, 0.055, 0.055, 0, [thigh, shin, 0.5]]','["Knee", KNEE.centerY, 0.055, 0.055, 0, [thigh, shin, KNEE.centerThighWeight]]');
replace(body,'["KneeLower", 0.449, 0.056, 0.052, 0, [thigh, shin, 0.06]]','["KneeLower", KNEE.lowerY, 0.056, 0.052, 0, [thigh, shin, KNEE.lowerThighWeight]]');
replace(body,'put(`${name}Shin`, t, [s * 0.101, 0.489, 0]);','put(`${name}Shin`, t, [s * 0.101, KNEE.centerY, 0]);');
replace(pants,"import { B, type Cage","import { KNEE } from '../../v3/leg-deformation';\nimport { B, rigid, type Cage");
replace(pants,"      ['UpperLeg',.69,.078*pattern.thigh,.080,[thigh,shin,.94]],\n",'');
replace(pants,"['KneeUpper',.60,.064*pattern.knee,.061,[thigh,shin,.76]]","['KneeUpper',KNEE.upperY,.064*pattern.knee,.061,[thigh,shin,KNEE.upperThighWeight]]");
replace(pants,"['Knee',.489,.060*pattern.knee,.058,[thigh,shin,.5]]","['Knee',KNEE.centerY,.060*pattern.knee,.058,[thigh,shin,KNEE.centerThighWeight]]");
replace(pants,"['KneeLower',.375,.061*pattern.knee,.056,[thigh,shin,.24]]","['KneeLower',KNEE.lowerY,.061*pattern.knee,.056,[thigh,shin,KNEE.lowerThighWeight]]");
replace(pants,"['Calf',.29,.066*pattern.calf,.064,[thigh,shin,.08]]","['Calf',.29,.066*pattern.calf,.064,rigid(shin)]");
replace(pants,"      if(label==='Knee')for(const i of next)if(c.vertices[i].p[2]<0)c.vertices[i].p[2]=-.012;\n",'');
replace(pants,"row<3?'thigh':'shin'","row<2?'thigh':'shin'");
replace('src/character/wardrobe/assets/contract.ts','wanhu-modular-garments-v2','wanhu-modular-garments-v3');
// 调试线框显示真实渲染三角，不再漏掉四边面的对角线。
replace('src/character/v3/rig.ts','  const edgeList = [...edges.values()];',`  for (const f of c.faces) {
    for (let i = 2; i < f.v.length - 1; i++) {
      edges.set(edgeKey(f.v[0], f.v[i]), [f.v[0], f.v[i]]);
    }
  }
  const edgeList = [...edges.values()];`);
// 保留同一个贯穿检测器与容差，并额外纳入裸模。不得用新的测试取代旧测试。
replace('scripts/check-tailoring-intersections.ts',"BOTTOM_IDS.filter(id=>id!=='body')","BOTTOM_IDS");
console.log('Candidate applied: shared knee reference, no rear clamp, fewer trousers rings, thigh-driven skin midline. Golden body hash intentionally not updated before actual visual review.');
