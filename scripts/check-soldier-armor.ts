import assert from 'node:assert/strict';
import { BODY_TYPES, HAIR_STYLE_IDS, createRecipe, type Recipe } from '../src/character/v3/types';
import { parseRecipeFile, randomizeCharacter, WARDROBE_LOOKS } from '../src/character/wardrobe/catalog';
import { SOLDIER_ARMOR_CLASS_IDS, SOLDIER_STYLE_IDS, SOLDIER_STYLE_CONTRACT } from '../src/soldier/contract';
import { SOLDIER_ARMOR_SLOTS, identifySoldierArmor, applySoldierArmor } from '../src/soldier/armor-classes';
import { SOLDIER_IDENTITY_IDS, SOLDIER_HELMETS, identifySoldierHelmet, applySoldierIdentity } from '../src/soldier/identities';
import { applySoldierLoadout, applySoldierStyle } from '../src/soldier/looks';

const unchangedExceptSlots = (a: Recipe, b: Recipe, keys: (keyof Recipe['slots'])[]) => {
  assert.deepEqual({ ...a, slots: undefined }, { ...b, slots: undefined });
  for (const key of Object.keys(a.slots) as (keyof Recipe['slots'])[]) if (!keys.includes(key)) assert.equal(a.slots[key], b.slots[key]);
};
let cases = 0;
for (const armorClass of SOLDIER_ARMOR_CLASS_IDS) for (const style of SOLDIER_STYLE_IDS) for (const identity of SOLDIER_IDENTITY_IDS) for (const bodyType of BODY_TYPES) for (const hairStyle of HAIR_STYLE_IDS) {
  const input = createRecipe({ bodyType, hairStyle }), snapshot = structuredClone(input);
  const r = applySoldierLoadout(input, style, armorClass, identity);
  assert.deepEqual(input, snapshot, '整套应用不得修改输入对象');
  assert.equal(identifySoldierArmor(r), armorClass);
  assert.deepEqual(identifySoldierHelmet(r.slots.headwear), { style, identity });
  assert.deepEqual(parseRecipeFile(JSON.stringify(r)), r);
  assert.deepEqual(Object.keys(r).sort(), ['version', 'bodyType', 'slots', 'dyes', 'hairStyle', 'hairColor'].sort());
  assert.equal(Object.keys(r.slots).length, 7);
  assert.equal(r.bodyType, bodyType); assert.equal(r.hairStyle, hairStyle);
  for (const target of SOLDIER_ARMOR_CLASS_IDS) {
    const changed = applySoldierArmor(r, target);
    unchangedExceptSlots(r, changed, ['top', 'bottom']);
    assert.equal(identifySoldierArmor(changed), target);
    assert.deepEqual({ top: changed.slots.top, bottom: changed.slots.bottom }, SOLDIER_ARMOR_SLOTS[target]);
  }
  for (const target of SOLDIER_IDENTITY_IDS) {
    const changed = applySoldierIdentity(r, target);
    unchangedExceptSlots(r, changed, ['headwear']);
    assert.equal(changed.slots.headwear, SOLDIER_HELMETS[style][target]);
  }
  for (const target of SOLDIER_STYLE_IDS) {
    const changed = applySoldierStyle(r, target);
    assert.deepEqual({ ...changed.slots, headwear: r.slots.headwear }, r.slots, '切驻地不能重置等级和装备');
    assert.equal(changed.slots.headwear, SOLDIER_HELMETS[target][identity]);
    assert.deepEqual(changed.dyes, SOLDIER_STYLE_CONTRACT[target].palette);
    assert.deepEqual({ ...changed, slots: r.slots, dyes: r.dyes }, r);
  }
  for (const field of ['armorClass', 'serviceStyle', 'soldierIdentity', 'role', 'rank']) assert.throws(() => parseRecipeFile(JSON.stringify({ ...r, [field]: 'heavy' })));
  cases++;
}
assert.equal(cases, 3 * 3 * 2 * 2 * 3);
const mixed = createRecipe({ slots: { headwear: 'palace_captain_helmet', top: 'heavy_armor', bottom: 'work_pants', back: 'bamboo_basket', rightHand: 'farmer_hoe' }, dyes: { primary: '#abcdef', secondary: '#123456', accent: '#987654' } });
assert.equal(identifySoldierArmor(mixed), null);
for (const style of SOLDIER_STYLE_IDS) {
  const changed = applySoldierStyle(mixed, style);
  assert.deepEqual({ ...changed.slots, headwear: mixed.slots.headwear }, mixed.slots, '已有军盔的自由混搭不得被驻地预设覆盖');
}
assert.equal(identifySoldierArmor(createRecipe({ slots: { top: 'medium_armor', bottom: 'heavy_armor_skirt' } })), null);
const militaryTops = Object.values(SOLDIER_ARMOR_SLOTS).map(s => s.top) as string[];
const militaryBottoms = Object.values(SOLDIER_ARMOR_SLOTS).map(s => s.bottom) as string[];
assert(WARDROBE_LOOKS.every(l => !militaryTops.includes(l.slots.top) && !militaryBottoms.includes(l.slots.bottom)));
for (let seed = 0; seed < 128; seed++) {
  const r = randomizeCharacter(createRecipe(), seed);
  assert(!militaryTops.includes(r.slots.top)); assert(!militaryBottoms.includes(r.slots.bottom));
  assert.equal(identifySoldierHelmet(r.slots.headwear), null);
}
console.log('SOLDIER_ARMOR_AXES', JSON.stringify({ cases, classes: SOLDIER_ARMOR_CLASS_IDS, styles: SOLDIER_STYLE_IDS, recipeVersion: 5, fields: 6, slots: 7 }));
