import './check-soldier-identities';
import './check-soldier-armor';
import assert from 'node:assert/strict';
import {
  B,
  BOTTOM_IDS,
  HEADWEAR_IDS,
  SHOES_IDS,
  TOP_IDS,
  createRecipe,
} from '../src/character/v3/types';
import {
  SOLDIER_ARMOR_CLASS_IDS,
  SOLDIER_FIRST_BUILD,
  SOLDIER_ROLE_IDS,
  SOLDIER_STYLE_CONTRACT,
  SOLDIER_STYLE_IDS,
  SOLDIER_WORKFLOW_VERSION,
} from '../src/soldier/contract';

assert.equal(SOLDIER_WORKFLOW_VERSION, 'wanhu-soldier-authoring-v3');
assert.deepEqual(SOLDIER_ARMOR_CLASS_IDS, ['light', 'medium', 'heavy']);
assert.deepEqual(SOLDIER_STYLE_IDS, ['palace', 'frontier', 'city']);
assert.deepEqual(SOLDIER_ROLE_IDS, ['spearman', 'swordsman', 'archer', 'shieldman']);
assert.equal(SOLDIER_FIRST_BUILD.style, 'palace');
assert.equal(SOLDIER_FIRST_BUILD.role, 'spearman');

const recipe = createRecipe();
assert.equal(recipe.version, 5, '军人工作流不得升级 Recipe V5');
assert.deepEqual(
  Object.keys(recipe.slots).sort(),
  ['back', 'bottom', 'headwear', 'leftHand', 'rightHand', 'shoes', 'top'].sort(),
  '军人工作流不得新增人物换装槽位',
);
assert.equal(Object.keys(B).length, 20, '军人甲胄必须继续使用当前20骨人物骨架');
assert.equal('style' in recipe || 'role' in recipe || 'rank' in recipe, false, '军人身份不得写入外观Recipe');

const hex = /^#[0-9a-f]{6}$/i;
const styleAssetIds = new Set<string>();
for (const id of SOLDIER_STYLE_IDS) {
  const style = SOLDIER_STYLE_CONTRACT[id];
  assert.ok(style.name.length > 0 && style.silhouette.length > 0);
  assert(SOLDIER_ARMOR_CLASS_IDS.includes(style.armorClass));
  for (const color of Object.values(style.palette)) assert.match(color, hex);
  for (const [slot, assetId] of Object.entries(style.assets)) {
    assert.ok(assetId.length > 0, id+'.'+slot+' 缺少计划资产ID');
    if (slot === 'headwear') {
      assert.equal(styleAssetIds.has(assetId), false, '驻地头盔ID重复：'+assetId);
      styleAssetIds.add(assetId);
    }
  }
}

const activeIds = new Set<string>([
  ...HEADWEAR_IDS,
  ...TOP_IDS,
  ...BOTTOM_IDS,
  ...SHOES_IDS,
]);
for (const retired of [
  'palace_guard_armor',
  'frontier_lamellar_armor',
  'palace_guard_skirt',
  'frontier_armor_skirt',
  'guard_light_armor',
  'archer_tunic',
  'guard_pants',
  'archer_pants',
  'loose_trousers',
  'boots',
]) {
  assert.equal(activeIds.has(retired), false, `不得恢复已退役军装：${retired}`);
}

assert.equal(SOLDIER_STYLE_CONTRACT.palace.assets.top,'medium_armor');
assert.equal(SOLDIER_STYLE_CONTRACT.frontier.assets.top,'medium_armor');
assert.equal(SOLDIER_STYLE_CONTRACT.palace.assets.bottom,'medium_armor_skirt');
assert.equal(SOLDIER_STYLE_CONTRACT.frontier.assets.bottom,'medium_armor_skirt');
assert.equal(SOLDIER_STYLE_CONTRACT.city.armorClass,'light');
assert(activeIds.has('heavy_armor')&&activeIds.has('heavy_armor_skirt'));

console.log(
  `Soldier workflow OK: ${SOLDIER_ARMOR_CLASS_IDS.length} armor classes, ${SOLDIER_STYLE_IDS.length} styles, ${SOLDIER_ROLE_IDS.length} planned roles, Recipe V5 / 7 slots / 20 bones preserved.`,
);
