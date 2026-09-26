import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
// Guard the optimization's contracts without adding a workflow or a YAML parser dependency.
const files=readdirSync('.github/workflows').filter(f=>/\.ya?ml$/.test(f)).sort();
assert.deepEqual(files,['build.yml','manual-visual-review.yml','targeted-checks.yml'],'Exactly the three permanent workflows; remove one-shot authoring helpers.');
const targeted=readFileSync('.github/workflows/targeted-checks.yml','utf8');
function graph(text){
 const once=command=>assert.equal(text.split(`run: ${command}\n`).length-1,1,`One owner required for ${command}`);
 for(const command of ['npm run check:soldier','npx tsx scripts/check-tailoring-intersections.ts','npx tsx scripts/check-tailoring-v2.ts','npx tsx scripts/check-soldier-assets.ts --motion','npm run check:soldier-browser','node scripts/check-soldier-fitting-browser.mjs','npm run check:mounts','npm run check:saddles','npm run check:riding','npm run check:livestock','npm run check:wardrobe-numeric','npm run check:mixamo','npm run check:system-animator','npm run check:horse'])once(command);
 assert(text.includes('armor: [light, medium, heavy]'));
 assert(text.includes('fail-fast: false'));
 assert(text.includes('SOLDIER_MOTION_ARMOR: ${{ matrix.armor }}'));
 assert(text.includes('needs: [prepare-soldier, soldier-motion]'));
 assert(text.includes('check-soldier-motion-coverage.ts /tmp/soldier-motion-reports'));
 assert(text.includes('name: prepared-soldier-motion-${{ env.REVIEW_HEAD_SHA }}'));
 // Every input that previously required generic tailoring must also trigger the sole full-intersection owner.
 const scope=text.slice(text.indexOf('  prepare-soldier:'),text.indexOf('\n  soldier:'));
 for(const token of ['src/character/*','scripts/check-tailoring*','scripts/garment-contact-scope.ts','.github/workflows/*','.github/actions/*','scripts/check-ci-*','scripts/review-local.mjs'])assert(scope.includes(token),`Intersection scope missing ${token}`);
 assert(!/continue-on-error:\s*true/.test(text),'A failing mandatory lane must fail the workflow');
}
graph(targeted);
for(const token of ['run: npx tsx scripts/check-tailoring-intersections.ts\n','armor: [light, medium, heavy]','check-soldier-motion-coverage.ts /tmp/soldier-motion-reports'])assert.throws(()=>graph(targeted.replace(token,'')));
const cache=readFileSync('.github/actions/prepare-motion/action.yml','utf8');
for(const token of ['动画参考/**','动画参考_glb/**','scripts/lib/**','src/character/motion/data.ts','package-lock.json','npm run prepare:motion','git diff --exit-code'])assert(cache.includes(token));
assert(!cache.includes('restore-keys:'),'Extraction inputs must use an exact cache key, never a loose fallback');
const restore=readFileSync('.github/actions/restore-motion/action.yml','utf8');
assert(restore.includes('SOURCE_SHA')&&restore.includes('git rev-parse HEAD')&&restore.includes('git diff --exit-code'));
console.log('CI_GRAPH',JSON.stringify({passed:true,permanentWorkflows:files.length,motionShards:3,coverageGate:true,graphFaults:3,resultsCached:false}));
