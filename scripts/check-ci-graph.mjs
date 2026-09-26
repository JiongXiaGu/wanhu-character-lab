import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { isHeavyOnly, resolveHeavyLane } from './resolve-heavy-review-scope.mjs';

const files = readdirSync('.github/workflows').filter(f => /\.ya?ml$/.test(f)).sort();
assert.deepEqual(files, ['build.yml', 'manual-visual-review.yml', 'targeted-checks.yml'], 'Exactly the three permanent workflows; remove one-shot authoring helpers.');
const targeted = readFileSync('.github/workflows/targeted-checks.yml', 'utf8');
function graph(text) {
  const once = command => assert.equal(text.split('run: ' + command + '\n').length - 1, 1, 'One owner required for ' + command);
  for (const command of [
    'npm run check:soldier', 'npx tsx scripts/check-tailoring-intersections.ts',
    'npx tsx scripts/check-tailoring-v2.ts', 'npx tsx scripts/check-soldier-assets.ts --motion',
    'npm run check:soldier-browser', 'node scripts/check-soldier-fitting-browser.mjs',
    'npm run check:mounts', 'npm run check:saddles', 'npm run check:riding',
    'npm run check:livestock', 'npm run check:wardrobe-numeric', 'npm run check:mixamo',
    'npm run check:system-animator', 'npm run check:horse', 'npx tsx scripts/check-soldier-heavy-authoring.ts',
  ]) once(command);
  for (const token of [
    'soldier-heavy-authoring', 'soldier-heavy-candidate', 'ready_for_review',
    'uses: ./.github/actions/heavy-review-scope',
    'needs: [review-scope, heavy-authoring]', "needs.heavy-authoring.result == 'success'",
    'motion_matrix=\'["heavy"]\'', 'browser_matrix=\'["fitting"]\'',
    'motion_matrix=\'["light","medium","heavy"]\'', 'browser_matrix=\'["fitting","full"]\'',
    'armor: ${{ fromJSON(needs.prepare-soldier.outputs.motion_matrix) }}',
    'mode: ${{ fromJSON(needs.prepare-soldier.outputs.browser_matrix) }}',
    "needs.prepare-soldier.outputs.coverage_required == 'true'",
    'src/character/wardrobe/assets/military/heavy-top.ts',
    'src/character/wardrobe/assets/military/heavy-skirt.ts',
    'src/character/wardrobe/heavy-equipment.ts',
    'name: prepared-soldier-motion-${{ env.REVIEW_HEAD_SHA }}',
    'check-soldier-motion-coverage.ts /tmp/soldier-motion-reports',
  ]) assert(text.includes(token), 'Fast/full soldier graph missing ' + token);
  assert(text.includes('fail-fast: false'));
  assert(text.includes('SOLDIER_MOTION_ARMOR: ${{ matrix.armor }}'));
  assert(text.includes('needs: [prepare-soldier, soldier-motion]'));
  const scope = text.slice(text.indexOf('  prepare-soldier:'), text.indexOf('\n  soldier:'));
  for (const token of ['src/character/*', 'scripts/check-tailoring*', 'scripts/garment-contact-scope.ts', '.github/workflows/*', '.github/actions/*', 'scripts/check-ci-*', 'scripts/review-local.mjs', 'scripts/resolve-heavy-review-scope.mjs']) {
    assert(scope.includes(token), 'Intersection scope missing ' + token);
  }
  assert(!/continue-on-error:\s*true/.test(text), 'A failing mandatory lane must fail the workflow');
}
graph(targeted);
for (const token of [
  'run: npx tsx scripts/check-soldier-heavy-authoring.ts\n',
  'motion_matrix=\'["heavy"]\'',
  'armor: ${{ fromJSON(needs.prepare-soldier.outputs.motion_matrix) }}',
  'check-soldier-motion-coverage.ts /tmp/soldier-motion-reports',
  'ready_for_review', "needs.heavy-authoring.result == 'success'",
]) assert.throws(() => graph(targeted.replace(token, '')));

// 用行为反例保护分流，不只搜索 YAML 字符串。检查的是整个 PR diff，而不是最后一次提交。
const heavy = 'src/character/wardrobe/assets/military/heavy-skirt.ts';
const paths = [heavy, 'scripts/check-soldier-heavy.ts', 'scripts/check-deformation.ts', 'Documentation/工作交接.md'];
const request = { eventName: 'pull_request', draft: true, paths };
assert(isHeavyOnly(paths));
assert.equal(resolveHeavyLane(request), 'candidate');
assert.equal(resolveHeavyLane({ ...request, draft: false }), 'release');
assert.equal(resolveHeavyLane({ ...request, eventName: 'push' }), 'release');
assert.equal(resolveHeavyLane({ ...request, paths: ['Documentation/工作交接.md'] }), 'release');
for (const path of [
  'src/character/v3/rig.ts', 'src/character/v3/types.ts', 'src/character/v3/leg-deformation.ts',
  'src/character/wardrobe/assembly.ts', 'src/character/motion/retarget.ts',
  'src/scene/CharacterViewport.tsx', 'src/cat/model.ts',
  'scripts/check-tailoring-intersections.ts', 'scripts/garment-contact-scope.ts',
  'scripts/check-ci-graph.mjs', 'scripts/resolve-heavy-review-scope.mjs',
  '.github/workflows/targeted-checks.yml', '.github/actions/restore-motion/action.yml',
  'package.json', 'package-lock.json',
]) {
  const mixed = [...paths, path];
  assert(!isHeavyOnly(mixed), path);
  assert.equal(resolveHeavyLane({ ...request, paths: mixed }), 'release', path);
  for (const scope of ['soldier-heavy-authoring', 'soldier-heavy-candidate']) {
    assert.equal(resolveHeavyLane({ eventName: 'workflow_dispatch', scope, paths: mixed }), 'release', path);
  }
}
assert.equal(resolveHeavyLane({ eventName: 'workflow_dispatch', scope: 'soldier-heavy-authoring', paths }), 'authoring');
assert.equal(resolveHeavyLane({ eventName: 'workflow_dispatch', scope: 'soldier-heavy-candidate', paths }), 'candidate');
assert.equal(resolveHeavyLane({ eventName: 'workflow_dispatch', scope: 'full', paths }), 'release');
assert.throws(() => resolveHeavyLane({ eventName: 'workflow_dispatch', scope: 'typo', paths }));

const manual = readFileSync('.github/workflows/manual-visual-review.yml', 'utf8');
for (const token of ['soldier-heavy-fast', "if: steps.visual.outputs.scope != 'soldier-heavy-fast'", 'npm run review:soldier-heavy-fast', 'ready_for_review', 'uses: ./.github/actions/heavy-review-scope']) {
  assert(manual.includes(token), 'Manual Heavy fast/Ready visual lane missing ' + token);
}
const resolver = readFileSync('scripts/resolve-heavy-review-scope.mjs', 'utf8');
assert(resolver.includes("git('merge-base', baseRef, 'HEAD')"), 'Review the entire PR diff, not only the latest commit.');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(pkg.scripts['review:soldier-heavy-fast'], 'node scripts/review-soldier-heavy-fast.mjs');
const cache = readFileSync('.github/actions/prepare-motion/action.yml', 'utf8');
for (const token of ['动画参考/**', '动画参考_glb/**', 'scripts/lib/**', 'src/character/motion/data.ts', 'package-lock.json', 'npm run prepare:motion', 'git diff --exit-code']) assert(cache.includes(token));
assert(!cache.includes('restore-keys:'), 'Extraction inputs must use an exact cache key, never a loose fallback');
const restore = readFileSync('.github/actions/restore-motion/action.yml', 'utf8');
assert(restore.includes('SOURCE_SHA') && restore.includes('git rev-parse HEAD') && restore.includes('git diff --exit-code'));
console.log('CI_GRAPH', JSON.stringify({ passed: true, permanentWorkflows: files.length, authoringFastLane: true, draftCandidate: true, readyRelease: true, sharedChangeEscalation: true, candidateHeavyShard: true, releaseFullCoverage: true, resultsCached: false }));
