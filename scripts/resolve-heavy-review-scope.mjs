import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// 只列 Heavy 作者与随作者几何同步的静态契约；共享运行时、动作与 CI 永远不进入快速通道。
const authors = new Set([
  'src/character/wardrobe/assets/military/heavy-top.ts',
  'src/character/wardrobe/assets/military/heavy-skirt.ts',
  'src/character/wardrobe/heavy-equipment.ts',
  'scripts/check-soldier-heavy.ts',
  'scripts/check-soldier-heavy-authoring.ts',
  'scripts/check-soldier-heavy-helmets.ts',
]);
const contracts = new Set([
  'scripts/check-deformation.ts',
  'scripts/check-lightwear.ts',
  'scripts/check-soldier-assets.ts',
  'scripts/check-soldier-wardrobe.ts',
]);
const isDocumentation = path => path === 'AGENTS.md' || path === 'README.md' ||
  path === 'src/character/wardrobe/assets/military/AGENTS.md' || /^Documentation\/.*\.md$/.test(path);

export function isHeavyOnly(paths) {
  return paths.some(path => authors.has(path)) &&
    paths.every(path => authors.has(path) || contracts.has(path) || isDocumentation(path));
}

export function resolveHeavyLane({ eventName, draft = false, scope = 'auto', paths = [] }) {
  if (!['auto', 'full', 'soldier-heavy-authoring', 'soldier-heavy-candidate'].includes(scope)) {
    throw new Error(`Unknown numeric review scope: ${scope}`);
  }
  const heavyOnly = isHeavyOnly(paths);
  if (eventName === 'workflow_dispatch') {
    if (heavyOnly && scope === 'soldier-heavy-authoring') return 'authoring';
    if (heavyOnly && scope === 'soldier-heavy-candidate') return 'candidate';
    return 'release';
  }
  // Ready / main 必须回到完整发布矩阵；Draft 也不能掩盖共享代码改动。
  return eventName === 'pull_request' && draft && heavyOnly ? 'candidate' : 'release';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const eventName = process.env.EVENT_NAME;
  const scope = process.env.DISPATCH_SCOPE || 'auto';
  let paths = [];
  if (eventName === 'pull_request' || (eventName === 'workflow_dispatch' && scope.startsWith('soldier-heavy-'))) {
    const baseRef = eventName === 'pull_request' ? process.env.PR_BASE_SHA : 'origin/main';
    if (!baseRef) throw new Error('Missing PR base SHA; refusing a scoped review.');
    const base = git('merge-base', baseRef, 'HEAD');
    paths = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', base, 'HEAD'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  }
  const lane = resolveHeavyLane({ eventName, draft: process.env.PR_DRAFT === 'true', scope, paths });
  if (!process.env.GITHUB_OUTPUT) throw new Error('Missing GITHUB_OUTPUT.');
  appendFileSync(process.env.GITHUB_OUTPUT, `lane=${lane}\nheavy_only=${isHeavyOnly(paths)}\n`);
  console.log('HEAVY_REVIEW_SCOPE', JSON.stringify({ sourceSHA: git('rev-parse', 'HEAD'), lane, paths }));
}
