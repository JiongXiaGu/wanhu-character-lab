import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HORSE_CLIP_IDS, type HorseClipId } from '../src/horse/types';
import { HORSE_RIG_VERSION } from '../src/horse/rig';
import { HORSE_ANIMATION_VERSION } from '../src/horse/animation';

interface Clearance { minimumHoofY: number; minimumHeadY: number; samples: number }
/** 读取同一次真实Three.js蒙皮采样的结果，增加失败门槛，不在运行时修正蹄子。 */
function validate(id: HorseClipId, values: Clearance) {
  assert.equal(values.samples, 241, `${id}采样矩阵不可缩水`);
  assert(Number.isFinite(values.minimumHoofY) && Number.isFinite(values.minimumHeadY));
  assert(values.minimumHoofY >= -.012, `${id}蹄子入地超过1.2厘米：${values.minimumHoofY}`);
  assert(values.minimumHeadY >= 0, `${id}头部穿地：${values.minimumHeadY}`);
  if (id === 'Horse_Eat') {
    assert(values.minimumHeadY >= .01 && values.minimumHeadY <= .12,
      `吃草最低头部应在离地1–12厘米范围：${values.minimumHeadY}`);
  }
}
const report = JSON.parse(fs.readFileSync('review/horse/checks.json', 'utf8'));
assert.equal(report.passed, true);
assert.equal(report.rigVersion, HORSE_RIG_VERSION, '不能读取旧骨架报告');
assert.equal(report.motionVersion, HORSE_ANIMATION_VERSION, '不能读取旧动作报告');
const expectedSHA = process.env.REVIEW_HEAD_SHA ?? process.env.GITHUB_SHA ?? 'local';
assert.equal(report.sourceSHA, expectedSHA, '不能复用其他提交的报告');
for (const id of HORSE_CLIP_IDS) validate(id, report.clips[id]);
// 首稿4厘米入地、头部穿地、悬空吃草与非有限值必须能被新门槛拒绝。
const valid: Clearance = { samples: 241, minimumHoofY: .002, minimumHeadY: .05 };
assert.throws(() => validate('Horse_Walk', { ...valid, minimumHoofY: -.04 }));
assert.throws(() => validate('Horse_Eat', { ...valid, minimumHeadY: -.01 }));
assert.throws(() => validate('Horse_Eat', { ...valid, minimumHeadY: .20 }));
assert.throws(() => validate('Horse_Run', { ...valid, minimumHoofY: NaN }));
assert.throws(() => validate('Horse_Idle', { ...valid, samples: 24 }));
const result = { passed: true, sourceSHA: expectedSHA, rigVersion: HORSE_RIG_VERSION,
  motionVersion: HORSE_ANIMATION_VERSION, faultInjectionCases: 5,
  limitsMeters: { minimumHoofY: -.012, minimumHeadY: 0, grazingHeadY: [.01, .12] },
  clips: Object.fromEntries(HORSE_CLIP_IDS.map(id => [id, {
    minimumHoofY: report.clips[id].minimumHoofY, minimumHeadY: report.clips[id].minimumHeadY,
  }])),
  limitations: ['仅对平面实验场和241相位样本负责，不是实时贴地或连续零滑步证明。',
    '不能用高度检查代替腿间穿插、颈根折面或美术轮廓的人工审图。'] };
fs.writeFileSync('review/horse/ground-checks.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
