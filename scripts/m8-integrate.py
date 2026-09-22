"""Temporary, explicit merge of concurrent M7; removed before delivery."""
from pathlib import Path
import subprocess
import re

ROOT = Path(__file__).resolve().parents[1]
TARGET = '6c8d3cf77009ba224982e443fd888de076ef6386'
def git(*args, check=True):
    return subprocess.run(['git', *args], cwd=ROOT, check=check, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
def read(path): return (ROOT / path).read_text()
def write(path, text): (ROOT / path).write_text(text)
def remote(path): return git('show', f'{TARGET}:{path}').stdout
def change(text, before, after):
    assert before in text, before
    return text.replace(before, after, 1)

shared = ['src/mounts/types.ts', 'src/mounts/catalog.ts', 'scripts/check-mounts.ts', 'scripts/check-mounts-browser.mjs', 'scripts/check-saddles-browser.mjs', 'scripts/check-riding-browser.mjs', 'README.md', 'AGENTS.md', 'Documentation/多坐骑与灰驴.md', 'Documentation/骑乘与坐骑挂接.md', 'Documentation/马鞍与缰绳.md']
ours = {path: read(path) for path in shared}
assert not git('status', '--porcelain').stdout.strip(), 'Integration requires a clean checkout.'
assert git('merge-base', '--is-ancestor', TARGET, 'HEAD', check=False).returncode != 0, 'Integration was already applied.'
result = git('merge', '--no-commit', '--no-ff', TARGET, check=False)
print(result.stdout)
conflicts = git('diff', '--name-only', '--diff-filter=U').stdout.splitlines()
assert set(conflicts) <= set(shared), f'Unexpected merge conflict; do not overwrite: {conflicts}'
# Shared files are resolved against the complete incoming M7 version, then only the
# previously reviewed M8 registration/document additions are reapplied.
for path in shared: write(path, remote(path))

path = 'src/mounts/types.ts'
write(path, change(read(path), "'yak_black'] as const", "'yak_black', 'buffalo_water'] as const"))
path = 'src/mounts/catalog.ts'
imports = "\n".join(line for line in ours[path].splitlines() if "from '../buffalo/" in line) + '\n'
block = re.search(r"  \{ id: 'buffalo_water'.*?\n  \},\n", ours[path], re.S).group(0)
text = change(read(path), 'import { HORSE_REIN_PROFILE', imports + 'import { HORSE_REIN_PROFILE')
text = change(text, "];\nexport function isMountId", block + "];\nexport function isMountId")
text = change(text, '(Horse|Donkey|Camel|Cattle|Yak)_', '(Horse|Donkey|Camel|Cattle|Yak|Buffalo)_')
write(path, text)
path = 'scripts/check-mounts.ts'
text = change(read(path), "import { checkYak } from './mount-yak-checks';", "import { checkYak } from './mount-yak-checks';\nimport { checkBuffalo } from './mount-buffalo-checks';")
text = change(text, 'report.yak = checkYak();', 'report.yak = checkYak();\n  report.buffalo = checkBuffalo();')
text = change(text, "'yak_black']);", "'yak_black', 'buffalo_water']);")
write(path, text)
path = 'scripts/check-mounts-browser.mjs'
text = change(read(path), "import { checkYakBrowser } from './mount-yak-browser.mjs';", "import { checkYakBrowser } from './mount-yak-browser.mjs';\nimport { checkBuffaloBrowser } from './mount-buffalo-browser.mjs';")
text = change(text, 'await checkYakBrowser(page, base, checks);', 'await checkYakBrowser(page, base, checks);\n  await checkBuffaloBrowser(page, base, checks);')
write(path, text)
for path in ['scripts/check-mounts-browser.mjs', 'scripts/check-saddles-browser.mjs', 'scripts/check-riding-browser.mjs']:
    text = read(path).replace("['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow', 'yak_black']", "['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow', 'yak_black', 'buffalo_water']")
    text = text.replace('five real species', 'six real species')
    write(path, text)
path = 'scripts/mount-buffalo-browser.mjs'
text = change(read(path), "['buffalo_water', 28, 2.0]", "['yak_black', 29, 1.95], ['buffalo_water', 28, 2.0]")
text = change(text, "['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow', 'buffalo_water']", "['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow', 'yak_black', 'buffalo_water']")
text = text.replace('all five species', 'all six species')
write(path, text)
# Existing animal author sources are not touched. Only visible stage labels advance.
for path in ['src/mounts/MountLab.tsx', 'src/riding/RidingLab.tsx']:
    text = read(path).replace('PHASE M7', 'PHASE M8').replace('黄牛或牦牛', '黄牛、牦牛或水牛')
    write(path, text)

for path in ['Documentation/多坐骑与灰驴.md', 'Documentation/骑乘与坐骑挂接.md', 'Documentation/马鞍与缰绳.md']:
    appendix = ours[path][ours[path].index('## M8：水牛接入'):]
    text = read(path).rstrip() + '\n\n' + appendix
    text = text.replace('当前五种坐骑', '当前六种坐骑')
    text = text.replace('种类目录为栗色马、灰驴、双峰骆驼、黄牛、牦牛', '种类目录为栗色马、灰驴、双峰骆驼、黄牛、牦牛、水牛')
    text = text.replace('种类目录为栗色马、灰驴、双峰骆驼、黄牛和牦牛', '种类目录为栗色马、灰驴、双峰骆驼、黄牛、牦牛和水牛')
    write(path, text)
path = 'README.md'
section = ours[path][ours[path].index('## M8：可骑乘水牛'):ours[path].index('## M6：可骑乘黄牛')]
section = section.replace('接手时牦牛尚未合入，不展示假牦牛。', '已保留并行合入的牦牛，目录共六种真实坐骑。')
text = change(read(path), '## M7：', section + '## M7：')
text = text.replace('当前坐骑是栗色马、灰驴、双峰骆驼、黄牛和牦牛。', '当前坐骑是栗色马、灰驴、双峰骆驼、黄牛、牦牛和水牛。')
write(path, text)
path = 'AGENTS.md'
section = ours[path][ours[path].index('## M8水牛与当前任务范围'):ours[path].index('## 接手')]
section = section.replace('接手main 6119c8d中没有yak_black，本轮不制作或假装存在牦牛。', '接手main 6119c8d中没有yak_black；开发中已合并并行M7至6c8d3cf，保留牦牛完整资产与检查，目录现有六种真实坐骑。')
text = re.sub(r'^# [^\n]+', '# AGENTS · 衣冠工坊V5与多坐骑', read(path), count=1)
write(path, change(text, '## 接手', section + '## 接手'))
path = 'Documentation/水牛.md'
write(path, read(path).replace('本轮只增加真实完成的水牛；未给yak_black添加占位或顺手制作另一物种。', '本轮只制作水牛；开发中牦牛由并行M7合入6c8d3cf，本轮以真实合并保留其模型、29骨、动作与全部检查，最终目录为六物种。未给yak_black添加占位或重做牦牛。'))
path = 'Documentation/工作交接.md'
write(path, read(path).rstrip() + '''

## M8：可骑乘水牛

buffalo_water新增独立低头、横展后弯角、低沉宽体、横耳、分趾与28骨。四动作、普通／旅行水牛鞍、鼻侧缰绳和男女骑姿归src/buffalo所有，见《水牛.md》。人物V5／20骨、FBX、衣柜、Cap及此前五个物种作者资源保持。

并行M7已通过真实合并纳入，本轮不覆盖牦牛。check:mounts追加水牛964本体、2892骑乘、70衣裤与六物种48次切换；浏览器追加静态／四本体动作、男女两鞍静态及三骑姿和完整状态往返。既有检查不减少，不新增永久用户命令或工作流。自动检查不等于美术认可；最终造型、步态、贴背鞍、膝脚和缰绳仍由用户网页验收。
''')

# Ownership and discriminative fault tests add coverage, without changing any
# inherited ground, rein, bind, knee/foot or lifecycle tolerances.
path = 'scripts/mount-buffalo-anatomy-checks.ts'
text = read(path)
text = text.replace("import assert from 'node:assert/strict';", "import assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\nimport { BUFFALO_JOINTS } from '../src/buffalo/rig';\nimport { CATTLE_JOINTS } from '../src/cattle/rig';")
text = text.replace('export function checkBuffaloAnatomy(actor: MountActor) {', '''export function checkBuffaloAnatomy(actor: MountActor) {
  assert.notStrictEqual(BUFFALO_JOINTS, CATTLE_JOINTS);
  assert.notDeepEqual(BUFFALO_JOINTS.map(joint => joint.bindWorld), CATTLE_JOINTS.map(joint => joint.bindWorld), 'buffalo cannot reuse cattle binding');
  for (const file of ['geometry', 'rig', 'animation', 'saddles']) {
    const source = readFileSync(new URL(`../src/buffalo/${file}.ts`, import.meta.url), 'utf8');
    assert(!/from ['"]\\.\\.\\/(cattle|yak|donkey|camel)\\//.test(source), 'buffalo author module must not import another species author factory');
    assert(!/buildCattleMesh|CATTLE_JOINTS|CATTLE_SADDLE_PROFILE/.test(source), 'buffalo is not a recolored cattle factory');
  }''')
needle = '  return { body, head, neck, horns: hornReport'
assert needle in text
text = text.replace(needle, '''  // 左右一起拉直，仍保留镜像、角根和横展，确保曲率检查不是被对称检查偶然代替。
  const bothHorns = ['LeftHorn', 'RightHorn'].map(part => idsFor(actor, part));
  const savedHorns = bothHorns.map(ids => ids.map(i => [...actor.data.vertices[i].position] as [number, number, number]));
  try {
    for (const ids of bothHorns) {
      const centers = Array.from({ length: 6 }, (_, r) => ids.slice(r * 8, r * 8 + 8).reduce((sum, i) => sum.add(new Vector3(...actor.data.vertices[i].position)), new Vector3()).multiplyScalar(1 / 8));
      for (let r = 1; r < 5; r++) {
        const delta = centers[0].clone().lerp(centers[5], r / 5).sub(centers[r]);
        for (const i of ids.slice(r * 8, r * 8 + 8)) actor.data.vertices[i].position = new Vector3(...actor.data.vertices[i].position).add(delta).toArray() as [number, number, number];
      }
    }
    assert.throws(() => horns(actor), /straight cone/); faults++;
  } finally { bothHorns.forEach((ids, side) => ids.forEach((i, j) => { actor.data.vertices[i].position = savedHorns[side][j]; })); }
  // 保留两趾名称和Foot刚性绑定，仅把外趾移进内趾，真实分缝必须报错。
  const outerIds = idsFor(actor, 'FrontLeftOuterHoof'), outerX = outerIds.map(i => actor.data.vertices[i].position[0]);
  try { outerIds.forEach(i => { actor.data.vertices[i].position[0] += .014; }); assert.throws(() => hooves(actor), /no real split hoof/); faults++; }
  finally { outerIds.forEach((i, j) => { actor.data.vertices[i].position[0] = outerX[j]; }); }
  return { body, head, neck, horns: hornReport''')
write(path, text)
# Remove the obsolete bootstrap source now that assets are independently versioned.
(ROOT / 'scripts/m8-stage.py').unlink()
# Self-removal prevents the merge being applied again on later verification pushes.
(ROOT / 'scripts/m8-integrate.py').unlink()
# Preserve all incoming M7 files and all previous artist/runtime assets exactly.
protected = ['src/character', 'src/horse', 'src/donkey', 'src/camel', 'src/cattle', 'src/yak', 'public/mixamo', 'scripts/mount-yak-anatomy-checks.ts', 'scripts/mount-yak-checks.ts', 'scripts/mount-yak-browser.mjs', 'scripts/mount-check-helpers.ts']
assert not git('diff', TARGET, '--name-only', '--', *protected).stdout.strip(), 'Protected actor resources must remain identical to latest M7.'
assert not any(line.startswith(('<<<<<<< ', '=======', '>>>>>>> ')) for path in shared for line in read(path).splitlines()), 'Unresolved shared source conflict.'
git('add', '-A')
print(git('commit', '-m', 'merge: preserve concurrent M7 yak and complete six-species M8 integration').stdout)
print(git('push', 'origin', 'HEAD:refs/heads/work/m8-water-buffalo').stdout)
print('INTEGRATED_SOURCE_SHA', git('rev-parse', 'HEAD').stdout.strip())
