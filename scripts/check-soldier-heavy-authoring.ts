import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BODY_TYPES, createRecipe } from '../src/character/v3/types';
import { triCount } from '../src/character/v3/cage';
import type { GarmentPiece } from '../src/character/wardrobe/assets/contract';
import { makeTop } from '../src/character/wardrobe/assets/tops';
import { makeTrousers } from '../src/character/wardrobe/assets/trousers';
import { SOLDIER_STYLE_CONTRACT, SOLDIER_STYLE_IDS } from '../src/soldier/contract';
import { assertHeavyArmorSkirt, assertHeavyArmorTop, checkHeavyArmor, HEAVY_ARMOR_BUDGET } from './check-soldier-heavy';

/** 只比较形体、拓扑和绑定；染色面色不属于几何指纹。 */
function geometryFingerprint(piece: GarmentPiece): string {
  return JSON.stringify({
    id: piece.id,
    slot: piece.slot,
    version: piece.version,
    vertices: piece.mesh.vertices.map(v => ({ id: v.id, p: v.p, w: v.w })),
    faces: piece.mesh.faces.map(f => ({ v: f.v, region: f.region })),
    anchors: piece.mesh.anchors,
    openings: piece.openings,
    sealedInterfaces: piece.sealedInterfaces,
    covers: piece.covers,
  });
}

// S6-1 快速入口：不加载动作源、不创建 Actor/浏览器，不把静态通过冒充动作或美术验收。
// 正式 check:soldier 导入本文件，独立命令与 Actions 使用完全相同的断言。
const faults = checkHeavyArmor();
assert.equal(faults.negativeCases, 21, '原重甲几何故障注入不得静默减少');
const rows: {
  bodyType: string;
  palette: string;
  topTriangles: number;
  bottomTriangles: number;
  topVertices: number;
  bottomVertices: number;
}[] = [];

for (const bodyType of BODY_TYPES) {
  let reference: { top: string; bottom: string } | undefined;
  for (const style of SOLDIER_STYLE_IDS) {
    const recipe = createRecipe({
      bodyType,
      slots: { top: 'heavy_armor', bottom: 'heavy_armor_skirt' },
      dyes: { ...SOLDIER_STYLE_CONTRACT[style].palette },
    });
    const before = structuredClone(recipe);
    const top = makeTop(recipe), bottom = makeTrousers(recipe);
    assert(top && bottom, '重甲作者检查必须生成两件真实资产');
    assertHeavyArmorTop(top);
    assertHeavyArmorSkirt(bottom);
    assert.deepEqual(recipe, before, '作者工厂不得修改输入 Recipe');
    assert.deepEqual(Object.keys(recipe).sort(), ['version', 'bodyType', 'slots', 'dyes', 'hairStyle', 'hairColor'].sort());
    assert.deepEqual(Object.keys(recipe.slots).sort(), ['headwear', 'top', 'bottom', 'shoes', 'back', 'leftHand', 'rightHand'].sort());
    const current = { top: geometryFingerprint(top), bottom: geometryFingerprint(bottom) };
    if (reference) assert.deepEqual(current, reference, `${bodyType}/${style}：驻地 palette 不得改变重甲几何、拓扑或骨权重`);
    else reference = current;
    rows.push({
      bodyType,
      palette: style,
      topTriangles: triCount(top.mesh),
      bottomTriangles: triCount(bottom.mesh),
      topVertices: top.mesh.vertices.length,
      bottomVertices: bottom.mesh.vertices.length,
    });
  }
}
assert.equal(rows.length, 6, 'S6-1 必须包含男女 × 三驻地 palette');

const report = {
  passed: true,
  stage: 'S6-1',
  // 使用 workflow 实际 checkout 的候选 SHA；本地未指定时不冒用 PR merge SHA。
  sourceSHA: process.env.REVIEW_HEAD_SHA ?? null,
  budgets: HEAVY_ARMOR_BUDGET,
  rows,
  negativeCases: faults.negativeCases,
  silhouette: faults.silhouette,
  paletteGeometryInvariant: true,
  recipeMutated: false,
  motionReviewed: false,
  visualReviewed: false,
  scope: 'Authored static geometry only. Full source-key/midpoint motion, intersections, browser behavior and actual WebGL review remain required before merging S6.',
};
// 跟随既有 Soldier artifact 目录；否则正式任务只上传 /tmp，快速报告会遗失。
const outputDirectory = process.env.SOLDIER_CHECK_DIR || 'review';
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(join(outputDirectory, 'soldier-heavy-authoring.json'), JSON.stringify(report, null, 2) + '\n');
console.log('S6-1 HEAVY AUTHORING', JSON.stringify(report));
