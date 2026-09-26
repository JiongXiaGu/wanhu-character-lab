import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { B, BODY_TYPES, HAIR_STYLE_IDS, createRecipe, type Cage } from '../src/character/v3/types';
import { triCount, edgeKey, cross, sub } from '../src/character/v3/cage';
import { addHeavyHelmet, HEAVY_HEADWEAR_IDS } from '../src/character/wardrobe/heavy-equipment';
import { makeCharacter } from '../src/character/v3/outfit';
import { parseRecipeFile, randomizeCharacter } from '../src/character/wardrobe/catalog';
import { applySoldierLoadout } from '../src/soldier/looks';
import { applySoldierIdentity, identifySoldierHelmet, soldierHelmetFor } from '../src/soldier/identities';
import { assertComponentWinding } from './check-components';

function bounds(c: Cage, part: string) {
  const v = c.vertices.filter(v => v.id.includes(part)); assert(v.length, part);
  const min = [0, 1, 2].map(a => Math.min(...v.map(v => v.p[a]))), max = [0, 1, 2].map(a => Math.max(...v.map(v => v.p[a])));
  return { min, max, width: max[0] - min[0], depth: max[2] - min[2], height: max[1] - min[1] };
}
function assertHelmet(c: Cage, captain: boolean) {
  assert.equal(triCount(c), captain ? 218 : 188); assert.equal(c.vertices.length, captain ? 115 : 98);
  assert.equal(new Set(c.vertices.map(v => v.id)).size, c.vertices.length);
  const edges = new Map<string, number>();
  for (const v of c.vertices) { assert(v.p.every(Number.isFinite)); assert.deepEqual(v.w, [B.Head, B.Head, 1]); }
  for (const f of c.faces) {
    assert.equal(new Set(f.v).size, f.v.length); assert.match(f.color!, /^#[0-9a-f]{6}$/i);
    for (let i = 1; i < f.v.length - 1; i++) assert(Math.hypot(...cross(sub(c.vertices[f.v[i]].p, c.vertices[f.v[0]].p), sub(c.vertices[f.v[i + 1]].p, c.vertices[f.v[0]].p))) > 1e-10);
    f.v.forEach((v, i) => { const key = edgeKey(v, f.v[(i + 1) % f.v.length]); edges.set(key, (edges.get(key) ?? 0) + 1); });
  }
  assert([...edges.values()].every(n => n === 2), '所有重盔实体必须闭合且无非流形边'); assertComponentWinding(c);
  const dome = bounds(c, '.Shell.Dome.'), low = bounds(c, '.Shell.ForeheadLow.'), high = bounds(c, '.Shell.ForeheadHigh.');
  const guard = bounds(c, '.Guard.OuterLow.');
  assert(dome.width > .315 && dome.depth > .34, '重盔壳不能收回标准盔的窄薄体量');
  assert(high.min[1] - low.min[1] >= .050, '厚眉檐不能退化为细装饰线');
  assert(guard.min[1] <= 1.491 && guard.max[2] > .15 && guard.width >= .40, '长护颈与前颊侧包覆必须真实存在');
  if (captain) {
    const crest = bounds(c, '.Crest.'), root = bounds(c, '.Crest.Base.'), body = bounds(c, '.Crest.Body.'), upper = bounds(c, '.Crest.Upper.'), summit = bounds(c, '.Shell.Summit.');
    const tip = c.vertices.find(v => v.id.endsWith('.Crest.Tip'))!.p;
    assert(crest.height > .20 && crest.height < .25 && crest.width >= .04 && crest.width < .055);
    assert(crest.height / crest.width > 4 && crest.depth < .055, '不得恢复宽短冠或肥厚拖尾');
    assert(Math.abs(tip[0]) < 1e-9 && Math.abs(tip[2] + .010) < .03, '竖饰须居中且不后拖');
    assert(upper.width < body.width * .5 && tip[1] > upper.max[1]);
    assert(summit.min[1] - root.min[1] > .004 && summit.min[1] - root.min[1] < .014, '竖饰底座须嵌入盔顶');
  }
}
function helmetFaces(c: Cage) { return c.faces.filter(f => f.v.every(i => c.vertices[i].id.startsWith('Heavy') && c.vertices[i].id.includes('Helmet.'))).map(f => ({ ...f, v: f.v.map(i => c.vertices[i].id) })); }
let negativeCases = 0, assembledCases = 0;
const rows = [];
for (const id of HEAVY_HEADWEAR_IDS) {
  const captain = id.includes('_captain_'), r = createRecipe({ slots: { headwear: id } }), c: Cage = { vertices: [], faces: [], anchors: {} };
  addHeavyHelmet(c, r); assertHelmet(c, captain);
  const faults: ((c: Cage) => void)[] = [
    c => { c.faces.pop(); }, c => { c.faces[0].v.reverse(); }, c => { c.faces.push(structuredClone(c.faces[0])); },
    c => { c.vertices[0].p[0] = NaN; }, c => { c.vertices[0].w = [B.Neck, B.Neck, 1]; }, c => { c.vertices[0].w[2] = NaN; },
    c => { for (const v of c.vertices) if (v.id.includes('.Guard.OuterLow.')) v.p[1] += .18; },
    c => { for (const v of c.vertices) if (v.id.includes('.Shell.ForeheadHigh.')) v.p[1] -= .03; },
    c => { for (const v of c.vertices) if (v.id.includes('.Shell.Dome.')) v.p[0] *= .65; },
    c => { for (const v of c.vertices) if (v.id.includes('.Guard.')) v.p[2] = Math.min(-.01, v.p[2]); },
  ];
  if (captain) faults.push(
    c => { for (const v of c.vertices) if (v.id.includes('.Crest.')) v.p[0] *= 3; },
    c => { for (const v of c.vertices) if (v.id.includes('.Crest.')) v.p[2] -= .12; },
    c => { c.vertices.find(v => v.id.endsWith('.Crest.Tip'))!.p[0] += .02; },
    c => { for (const v of c.vertices) if (v.id.includes('.Crest.')) v.p[1] += .05; },
  );
  for (const fault of faults) { const bad = structuredClone(c); fault(bad); assert.throws(() => assertHelmet(bad, captain)); negativeCases++; }
  const identity = identifySoldierHelmet(id)!;
  // 同身体、同身份比较真实帽壳和护颈，不把队长顶饰算成 Heavy 的包覆体量。
  const medium = makeCharacter(applySoldierLoadout(createRecipe(), identity.style, 'medium', identity.identity));
  const prefix = identity.style[0].toUpperCase() + identity.style.slice(1) + 'Helmet.';
  const mediumShell = bounds(medium.surface, prefix + 'Shell.'), mediumGuard = bounds(medium.surface, prefix + 'Neck.');
  const heavyShell = bounds(c, '.Shell.'), heavyGuard = bounds(c, '.Guard.OuterLow.');
  const comparison = { shellWidthIncrease: heavyShell.width - mediumShell.width,
    shellHeightIncrease: heavyShell.height - mediumShell.height,
    browForwardIncrease: heavyShell.max[2] - mediumShell.max[2],
    napeExtension: mediumGuard.min[1] - heavyGuard.min[1] };
  assert(comparison.shellWidthIncrease > .025 && comparison.shellHeightIncrease > .020 && comparison.browForwardIncrease > .035 && comparison.napeExtension > .040,
    '三驻地的 Heavy 帽壳、眉檐和护颈均须实质区别于各自 Medium，不能只换色或加顶饰');
  for (const bodyType of BODY_TYPES) for (const hairStyle of HAIR_STYLE_IDS) {
    const recipe = applySoldierLoadout(createRecipe({ bodyType, hairStyle }), identity.style, 'heavy', identity.identity);
    assert.equal(recipe.slots.headwear, id); assert.deepEqual(parseRecipeFile(JSON.stringify(recipe)), recipe);
    const d = makeCharacter(recipe); assert.equal(d.joints.length, 20); assert(!d.surface.vertices.some(v => v.id.startsWith('CustomHair')));
    const recoloredHair = makeCharacter(createRecipe({ ...recipe, hairColor: '#fe0102' }));
    assert.deepEqual(helmetFaces(d.surface), helmetFaces(recoloredHair.surface), '发色不得误染重盔眉檐或甲片');
    const next = applySoldierIdentity(recipe, identity.identity === 'soldier' ? 'captain' : 'soldier');
    assert.equal(next.slots.headwear, soldierHelmetFor(identity.style, identity.identity === 'soldier' ? 'captain' : 'soldier', 'heavy'));
    assert.deepEqual({ ...next, slots: { ...next.slots, headwear: id } }, recipe);
    assert.equal(randomizeCharacter(recipe, 96, ['headwear']).slots.headwear, id);
    assembledCases++;
  }
  rows.push({ id, triangles: triCount(c), vertices: c.vertices.length, comparison, dome: bounds(c, '.Shell.Dome.'), guard: bounds(c, '.Guard.OuterLow.') });
}
assert.equal(assembledCases, 36); assert.equal(negativeCases, 72);
for (let seed = 0; seed < 384; seed++) assert.equal(identifySoldierHelmet(randomizeCharacter(createRecipe(), seed).slots.headwear), null);
const dir = process.env.SOLDIER_CHECK_DIR ?? 'review/soldier-numeric'; mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/heavy-helmets.json`, JSON.stringify({ passed: true, sourceSHA: process.env.REVIEW_HEAD_SHA ?? 'local', rows, assembledCases, negativeCases, visualReviewed: false }, null, 2));
console.log('HEAVY_HELMETS', JSON.stringify({ assembledCases, negativeCases, rows }));
