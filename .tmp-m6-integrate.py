from pathlib import Path

root = Path('.')
def edit(name, old, new):
    p = root / name
    text = p.read_text()
    assert old in text, f'missing integration anchor: {name}: {old[:100]}'
    p.write_text(text.replace(old, new))

def write(name, text):
    p = root / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)

edit('src/mounts/types.ts', "['horse_chestnut', 'donkey_gray', 'camel_bactrian']", "['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow']")
edit('src/mounts/catalog.ts', "import { HORSE_REIN_PROFILE", "import { buildCattleMesh } from '../cattle/geometry';\nimport { CATTLE_JOINTS } from '../cattle/rig';\nimport { authorCattlePose, bakeCattleClips, CATTLE_MOTIONS } from '../cattle/animation';\nimport { CATTLE_REIN_PROFILE, CATTLE_RIDER_FIT, CATTLE_SADDLE_PROFILE } from '../cattle/saddles';\nimport { HORSE_REIN_PROFILE")
edit('src/mounts/catalog.ts', '\n];\nexport function isMountId', '''
  { id: 'cattle_yellow', name: '黄牛', description: '厚实桶身、短粗颈、宽鼻镜、弯牛角与分趾蹄；中国古代农耕背景的独立可骑乘黄牛。', createActor: () => makeMountActor(buildCattleMesh(), CATTLE_JOINTS, 'WanhuCattle'),
    bakeClips: bakeCattleClips, motions: CATTLE_MOTIONS, saddle: CATTLE_SADDLE_PROFILE, reins: CATTLE_REIN_PROFILE, riderFit: CATTLE_RIDER_FIT,
    backPitch(id, p) { const pose = authorCattlePose(id, p); return pose.rotations[1][0] + pose.rotations[2][0]; },
    frame: { bodyY: 1.02, ridingY: 1.24, bodyHalf: 1.42, ridingHalf: 1.58 },
  },
];
export function isMountId''')
edit('src/mounts/catalog.ts', '(Horse|Donkey|Camel)_', '(Horse|Donkey|Camel|Cattle)_')

# 新物种沿用原稠密矩阵结构，但作者识别测试、骨架、挂点、面部和蹄的范围属于黄牛。
s = (root / 'scripts/mount-camel-checks.ts').read_text()
s = s.replace('camel_bactrian', 'cattle_yellow').replace('Camel', 'Cattle').replace('CAMEL', 'CATTLE').replace('camel', 'cattle')
s = s.replace("import { CATTLE_SCULPT_STATS, checkCattleTorso } from './mount-cattle-torso-checks';", "import { CATTLE_AUTHOR_STATS, checkCattleAnatomy } from './mount-cattle-anatomy-checks';")
s = s.replace('CATTLE_SCULPT_STATS', 'CATTLE_AUTHOR_STATS')
a = s.index('  const torso = checkCattleTorso(actor);')
b = s.index('  const facial =', a)
s = s[:a] + '  const anatomy = checkCattleAnatomy(actor); faults += anatomy.faults;\n' + s[b:]
s = s.replace("face.part === 'Head'))", "face.part === (part.endsWith('Nostril') ? 'NoseMirror' : 'Head'))")
s = s.replace('assert.equal(player.mount.bones.length, 29)', 'assert.equal(player.mount.bones.length, 28)')
s = s.replace('assert.equal(validateMountMesh(actor), 29)', 'assert.equal(validateMountMesh(actor), 27)')
s = s.replace('assert.equal(CATTLE_JOINTS.length, 29)', 'assert.equal(CATTLE_JOINTS.length, 28)')
s = s.replace('assert.equal(clip.tracks.length, 29)', 'assert.equal(clip.tracks.length, 28)')
s = s.replace("face.part.endsWith('Pad') || face.part.endsWith('Toe')", "face.part.endsWith('Hoof')")
s = s.replace("const heads = new Set(actor.data.triangles.filter(face => face.part === 'Head')", "const heads = new Set(actor.data.triangles.filter(face => face.part === 'Head' || face.part === 'NoseMirror')")
s = s.replace('sign * knee.x > .33 && sign * knee.x < .55', 'sign * knee.x > .40 && sign * knee.x < .56')
s = s.replace('sign * foot.x > .37 && sign * foot.x < .62', 'sign * foot.x > .44 && sign * foot.x < .63')
s = s.replace("seat.y > 1.98 && seat.y < 2.10, 'seat must remain in the hump valley'", "seat.y > 1.46 && seat.y < 1.53, 'seat must remain on the broad low cattle pad'")
s = s.replace("['horse_chestnut', 'donkey_gray', 'cattle_yellow', 'horse_chestnut', 'donkey_gray', 'cattle_yellow']", "['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow', 'horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow']")
s = s.replace('assert.equal(swaps, 24)', 'assert.equal(swaps, 32)')
s = s.replace('shells: 29 }, torso, torsoFaults: 2,', 'shells: 27 }, anatomy,')
s = s.replace('Body连续表面已包含两峰，不豁免前峰与持缰曲线。', '包含宽头鼻镜、短颈、桶身、角和垂皮；不放宽原6毫米嘴环接触门槛。')
s = s.replace('sparse rein intersections include the continuous hump/body surface', 'sparse rein intersections include the broad body, nose mirror, horns and dewlap')
write('scripts/mount-cattle-checks.ts', s)
edit('scripts/check-mounts.ts', "import { checkCamel } from './mount-camel-checks';", "import { checkCamel } from './mount-camel-checks';\nimport { checkCattle } from './mount-cattle-checks';")
edit('scripts/check-mounts.ts', "['horse_chestnut', 'donkey_gray', 'camel_bactrian']", "['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow']")
edit('scripts/check-mounts.ts', '  report.camel = checkCamel();', '  report.camel = checkCamel();\n  report.cattle = checkCattle();')
edit('scripts/mount-check-helpers.ts', "['Head', 'Neck', 'Body', 'FrontHump', 'BackHump']", "['Head', 'Neck', 'Body', 'FrontHump', 'BackHump', 'NoseMirror', 'LeftHorn', 'RightHorn', 'Dewlap']")

# 黄牛桌面交互另外追加，原骆驼/灰驴所有检查仍保留。
s = (root / 'scripts/mount-camel-browser.mjs').read_text()
s = s.replace('camel_bactrian', 'cattle_yellow').replace('Camel', 'Cattle').replace('camel', 'cattle').replace('双峰骆驼', '黄牛')
s = s.replace('2280', '1956').replace('29 bones', '28 bones').replace('triangles/29', 'triangles/28')
s = s.replace('stats.bones, 29', 'stats.bones, 28').replace('horse.bones, 29', 'horse.bones, 28')
s = s.replace('1.6', '1.8').replace('4.8', '5.2')
s = s.replace("['Cattle_Run', 1]", "['Cattle_Run', 1.05]").replace("['Rider_Run', 1]", "['Rider_Run', 1.05]")
s = s.replace("['cattle_yellow', 29, 1.8]", "['camel_bactrian', 29, 1.6], ['cattle_yellow', 28, 1.8]")
s = s.replace("['horse_chestnut', 'donkey_gray', 'cattle_yellow']", "['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow']")
s = s.replace('all three species', 'all four species').replace('third species', 'fourth species')
write('scripts/mount-cattle-browser.mjs', s)
edit('scripts/check-mounts-browser.mjs', "import { checkCamelBrowser } from './mount-camel-browser.mjs';", "import { checkCamelBrowser } from './mount-camel-browser.mjs';\nimport { checkCattleBrowser } from './mount-cattle-browser.mjs';")
edit('scripts/check-mounts-browser.mjs', '  await checkCamelBrowser(page, base, checks);', '  await checkCamelBrowser(page, base, checks);\n  await checkCattleBrowser(page, base, checks);')
for name in ['scripts/check-mounts-browser.mjs', 'scripts/check-riding-browser.mjs', 'scripts/check-saddles-browser.mjs']:
    p = root / name
    text = p.read_text().replace("['horse_chestnut', 'donkey_gray', 'camel_bactrian']", "['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow']")
    p.write_text(text.replace('three real species', 'four real species'))
edit('.github/workflows/targeted-checks.yml', 'src/camel/*|src/camel/**/*|', 'src/camel/*|src/camel/**/*|src/cattle/*|src/cattle/**/*|')
edit('.github/workflows/targeted-checks.yml', 'scripts/mount-camel-*)', 'scripts/mount-camel-*|scripts/mount-cattle-*)')
print('M6 integration completed without changing original horse/donkey/camel author assets or character code.')
