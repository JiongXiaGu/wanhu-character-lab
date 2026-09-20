import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { makeCharacter } from '../src/character/v3/outfit';
import { B, rigid, createRecipe, BODY_TYPES, BODY_PROFILE_VERSION, BODY_HEIGHT, presetSlots, type Cage, type BodyType } from '../src/character/v3/types';
import { BODY_GEOMETRY_VERSION } from '../src/character/v3/leg-deformation';
import { applyLook } from '../src/character/wardrobe/catalog';
import { GARMENT_GEOMETRY_VERSION } from '../src/character/wardrobe/assembly';
import { cloneCage, triCount } from '../src/character/v3/cage';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixture = JSON.parse(readFileSync('scripts/fixtures/fixed-body-bind-baseline.json', 'utf8'));

/**
 * 原始黄金文件保持原样。本轮唯一允许的人体差异是 Crotch 的蒙皮权重。
 * 先验证新权重，再只在比较副本上撤销这项差异；坐标、面、其他权重、锚点必须逐字节符合旧哈希。
 * 这是明确变更范围的工程回归，不是新美术基线，也不代表图片已验收。
 */
function assertDeclaredSkinDelta(body: Cage, referenceHash: string, label: string): void {
  const seams = body.vertices.filter(vertex => vertex.id === 'Crotch');
  assert.equal(seams.length, 1, `${label}: expected one shared crotch vertex`);
  assert.deepEqual(seams[0].w, [B.RightThigh, B.LeftThigh, 0.5], `${label}: undeclared crotch weights`);
  const reference = cloneCage(body);
  reference.vertices.find(vertex => vertex.id === 'Crotch')!.w = rigid(B.Hips);
  assert.equal(hash(reference), referenceHash, `${label}: body changed beyond the declared crotch-weight delta`);
}

const comparisons = [];
for (const row of fixture.rows) {
  const data = makeCharacter(applyLook(createRecipe({ bodyType: row.bodyType }), row.look));
  assertDeclaredSkinDelta(data.body, row.bodyHash, `${row.bodyType}/${row.look}`);
  assert.equal(hash(data.joints), row.jointsHash, `${row.bodyType}/${row.look}: fixed bind changed`);
  assert(data.garments.every(garment => garment.version === GARMENT_GEOMETRY_VERSION));
  comparisons.push({ bodyType: row.bodyType, look: row.look, originalBodyHash: row.bodyHash, actualBodyHash: hash(data.body), jointsHash: hash(data.joints) });
}

for (const bodyType of BODY_TYPES) {
  const bare = makeCharacter(createRecipe({ bodyType, slots: presetSlots('body') }));
  const dressed = makeCharacter(applyLook(createRecipe({ bodyType }), 'ceremony-female'));
  assert.deepEqual(bare.joints, dressed.joints);
  assert.deepEqual(bare.body, dressed.body);
  assert.equal(triCount(bare.body), 510);
  assert.equal(bare.joints.length, 20);
  const ys = bare.body.vertices.map(vertex => vertex.p[1]);
  assert(Math.abs(Math.max(...ys) - 1.755 * BODY_HEIGHT[bodyType] / 1.76) < 1e-6);
}

// 反例保证“允许一个已声明差异”不会变成无条件忽略人体哈希。
const first = fixture.rows[0] as { bodyType: BodyType; look: Parameters<typeof applyLook>[1]; bodyHash: string };
const sample = makeCharacter(applyLook(createRecipe({ bodyType: first.bodyType }), first.look)).body;
const wrongWeight = cloneCage(sample);
wrongWeight.vertices.find(vertex => vertex.id === 'Crotch')!.w = rigid(B.Hips);
assert.throws(() => assertDeclaredSkinDelta(wrongWeight, first.bodyHash, 'injected old weight'));
const wrongPosition = cloneCage(sample);
wrongPosition.vertices.find(vertex => vertex.id === 'Crotch')!.p[1] += 0.001;
assert.throws(() => assertDeclaredSkinDelta(wrongPosition, first.bodyHash, 'injected position change'));
const wrongKnee = cloneCage(sample);
wrongKnee.vertices.find(vertex => vertex.id.startsWith('RightKnee.'))!.w[2] = 0.45;
assert.throws(() => assertDeclaredSkinDelta(wrongKnee, first.bodyHash, 'injected bare-knee regression'));

const report = {
  passed: true,
  testedSha: process.env.REVIEW_HEAD_SHA ?? 'local',
  profileVersion: BODY_PROFILE_VERSION,
  bodyGeometryVersion: BODY_GEOMETRY_VERSION,
  geometryVersion: GARMENT_GEOMETRY_VERSION,
  fixedBodyTypes: 2,
  referenceCommit: fixture.sourceCommit,
  bodyBindComparisons: comparisons.length,
  mutationChecks: 3,
  declaredDelta: { vertexId: 'Crotch', before: rigid(B.Hips), after: [B.RightThigh, B.LeftThigh, 0.5] },
  comparisons,
  originalGoldenFileUnchanged: true,
  manualVisualApproval: false,
  note: 'Only the explicitly declared crotch weights may differ. All other body data and all bind hashes retain the original baseline. This is not visual approval or an automatically refreshed art baseline.',
};
mkdirSync('review', { recursive: true });
writeFileSync('review/body-profiles.json', JSON.stringify(report, null, 2));
console.log('PASS fixed bodies with declared skin-weight delta', report);
