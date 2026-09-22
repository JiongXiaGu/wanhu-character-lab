from pathlib import Path
import subprocess

def edit(name, old, new):
    p = Path(name)
    s = p.read_text()
    assert old in s, f'missing M6 anchor {name}: {old[:100]}'
    p.write_text(s.replace(old, new))

# 只在模式切换时保存当前预览；种类和鞍具仍以链接为权威，不扩展Recipe。
edit('src/ui/AnimalModeSwitcher.tsx', "mountId = 'horse_chestnut' }", "mountId = 'horse_chestnut', onNavigate }")
edit('src/ui/AnimalModeSwitcher.tsx', 'mountId?: MountId })', 'mountId?: MountId; onNavigate?: () => void })')
edit('src/ui/AnimalModeSwitcher.tsx', 'const args = `mount=', 'const args = `preview=resume&mount=')
edit('src/ui/AnimalModeSwitcher.tsx', '<a href=', '<a onClick={onNavigate} href=')
edit('src/ui/AnimalModeSwitcher.tsx', '往返携带种类和鞍具，不把无鞍静默改成普通鞍。', '往返携带种类和鞍具，并显式保存当前预览；不把无鞍静默改成普通鞍。')
for name, mode, prefix in [('src/mounts/MountLab.tsx', 'horse', './'), ('src/riding/RidingLab.tsx', 'riding', '../mounts/')]:
    edit(name, "import { useCallback, useState } from 'react';", "import { useCallback, useState } from 'react';\nimport { readPreviewSession, savePreviewSession } from '" + prefix + "preview-session';")
    edit(name, 'const validPhase =', "const resumed = readPreviewSession('" + mode + "');\nconst validPhase =")
    edit(name, 'useState(validPhase(Number(query.get(\'phase\') ?? 0)))', 'useState(resumed?.phase ?? validPhase(Number(query.get(\'phase\') ?? 0)))')
    edit(name, "useState<HorseView>(views.some(([id]) => id === query.get('view')) ? query.get('view') as HorseView : 'three')", "useState<HorseView>(resumed?.view ?? (views.some(([id]) => id === query.get('view')) ? query.get('view') as HorseView : 'three'))")
    edit(name, 'useState(true), [display,', 'useState(resumed?.loop ?? true), [display,') if mode == 'horse' else None
    edit(name, '[orthographic, setOrthographic] = useState(true)', '[orthographic, setOrthographic] = useState(resumed?.orthographic ?? true)')
    edit(name, '[speed, setSpeed] = useState(1)', '[speed, setSpeed] = useState(resumed?.speed ?? 1)')
    if mode == 'riding': edit(name, '[loop, setLoop] = useState(true)', '[loop, setLoop] = useState(resumed?.loop ?? true)')
    edit(name, 'PHASE M5 · 多坐骑', 'PHASE M6 · 多坐骑')
    extra = ', recipe' if mode == 'riding' else ''
    edit(name, '<AnimalModeSwitcher active="' + mode + '"', '<AnimalModeSwitcher onNavigate={() => savePreviewSession(\'' + mode + '\', { clip, phase: playback.phase, playing, speed, loop, view, orthographic' + extra + ' })} active="' + mode + '"')
edit('src/mounts/MountLab.tsx', "useState<MountSelection>(query.get('pose') === 'bind' ? 'bind' : initialMountMotion(query.get('clip')))", "useState<MountSelection>(resumed ? resumed.clip as MountSelection : query.get('pose') === 'bind' ? 'bind' : initialMountMotion(query.get('clip')))")
edit('src/mounts/MountLab.tsx', "useState(!query.has('paused') && query.get('pose') !== 'bind' && clip !== 'bind')", "useState(resumed?.playing ?? (!query.has('paused') && query.get('pose') !== 'bind' && clip !== 'bind'))")
edit('src/riding/RidingLab.tsx', "const initial = query.get('clip')", "const initial = resumed?.clip ?? query.get('clip')")
edit('src/riding/RidingLab.tsx', 'function initialRecipe(): Recipe {', 'function initialRecipe(): Recipe {\n  if (resumed?.recipe) return resumed.recipe;')
edit('src/riding/RidingLab.tsx', "useState(!query.has('paused') && initial !== 'pose')", "useState(resumed?.playing ?? (!query.has('paused') && initial !== 'pose'))")
edit('src/riding/RidingLab.tsx', '同一人物可骑栗色马、灰驴或双峰骆驼。', '同一人物可骑栗色马、灰驴、双峰骆驼或黄牛。')
for name, mode, prefix, player in [('src/mounts/MountViewport.tsx', 'horse', './', 'rt.bundle.player'), ('src/riding/RidingViewport.tsx', 'riding', '../mounts/', 'rt.player')]:
    edit(name, "import { useEffect, useRef } from 'react';", "import { useEffect, useRef } from 'react';\nimport { readPreviewSession, registerPreviewCapture } from '" + prefix + "preview-session';")
    capture = "    const detachPreview = registerPreviewCapture('" + mode + "', () => ({ phase: " + player + ".status().phase, camera: { position: rt.camera.position.toArray(), target: rt.controls.target.toArray(), zoom: rt.camera.zoom } }));\n"
    edit(name, '    if (import.meta.env.DEV', capture + '    if (import.meta.env.DEV')
    edit(name, 'return () => { stopped = true;', 'return () => { detachPreview(); stopped = true;')
    restore = """  // 所有初始applyCamera完成后恢复真实Orbit位置与缩放；后续点击相机按钮仍使用原行为。
  useEffect(() => {
    const rt = runtime.current, saved = readPreviewSession('MODE')?.camera;
    if (!rt || !saved) return;
    rt.camera.position.fromArray(saved.position); rt.controls.target.fromArray(saved.target); rt.camera.zoom = saved.zoom;
    rt.camera.lookAt(rt.controls.target); rt.controls.update(); rt.resize(); rt.render();
  }, []);
""".replace('MODE', mode)
    edit(name, '  return <div className="horse-viewport', restore + '  return <div className="horse-viewport')

# 原浏览器矩阵不减少，追加暂停状态下的真实页面往返以及坏缓存反例。
p = Path('scripts/mount-cattle-browser.mjs')
s = p.read_text()
anchor = "  assert.equal(await page.locator('canvas').count(), 1); checks.push('cattle body/riding round trip preserves fourth species and whole saddle kit');"
assert anchor in s
s = s.replace(anchor, anchor + """
  const sameCamera = (a, b) => { for (const field of ['position', 'target', 'projection']) a[field].forEach((v, i) => near(v, b[field][i])); };
  const wardrobeBefore = await page.evaluate(() => localStorage.getItem('wanhu.character.wardrobe.v5'));
  await page.getByTestId('riding-body-female').click();
  await page.getByTestId('riding-slot-top').selectOption('work_vest'); await page.getByTestId('riding-slot-bottom').selectOption('work_pants');
  await page.getByTestId('Rider_Walk').click(); await pause('riding-play');
  await page.evaluate(() => window.__RIDING_REVIEW__.seek(.375)); await page.getByTestId('riding-view-left').click();
  const box = await page.locator('canvas').boundingBox(); assert(box); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -160); await page.waitForTimeout(250);
  const savedRider = await riding();
  await page.getByTestId('animal-mode-horse').click(); await page.waitForFunction(() => window.__MOUNT_REVIEW__?.mountId() === 'cattle_yellow');
  await page.getByTestId('Cattle_Eat').click(); await pause('horse-play'); await page.evaluate(() => window.__MOUNT_REVIEW__.seek(.625)); await page.getByTestId('horse-view-front').click();
  const savedBody = await page.evaluate(() => ({ status: window.__MOUNT_REVIEW__.getStatus(), camera: window.__MOUNT_REVIEW__.cameraState() }));
  await page.getByTestId('animal-mode-riding').click(); await page.waitForFunction(() => window.__RIDING_REVIEW__?.mountId() === 'cattle_yellow');
  const restoredRider = await riding(); valid(restoredRider); near(restoredRider.status.phase, .375); assert.equal(restoredRider.status.clip, savedRider.status.clip); assert.deepEqual(restoredRider.recipe, savedRider.recipe); sameCamera(restoredRider.camera, savedRider.camera);
  assert((await page.getByTestId('riding-play').innerText()).includes('播放'));
  await page.getByTestId('animal-mode-horse').click(); await page.waitForFunction(() => window.__MOUNT_REVIEW__?.mountId() === 'cattle_yellow');
  const restoredBody = await page.evaluate(() => ({ status: window.__MOUNT_REVIEW__.getStatus(), camera: window.__MOUNT_REVIEW__.cameraState() }));
  near(restoredBody.status.phase, .625); assert.equal(restoredBody.status.clip, 'eat'); sameCamera(restoredBody.camera, savedBody.camera);
  assert((await page.getByTestId('horse-play').innerText()).includes('播放'));
  assert.equal(await page.evaluate(() => localStorage.getItem('wanhu.character.wardrobe.v5')), wardrobeBefore);
  checks.push('cattle real page round trips restore each mode phase, clip, paused state, Orbit camera/zoom and unsaved V5 rider appearance without writing wardrobe storage');
  await page.evaluate(() => sessionStorage.setItem('wanhu.mount.preview.v1.riding', '{bad-cache'));
  await page.goto(`${base}/?lab=riding&mount=cattle_yellow&saddle=simple&clip=Rider_Walk&paused=1&phase=.2&preview=resume`); await page.waitForFunction(() => window.__RIDING_REVIEW__?.mountId() === 'cattle_yellow');
  valid(await riding()); near((await riding()).status.phase, .2); assert.equal(await page.locator('canvas').count(), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('wanhu.character.wardrobe.v5')), wardrobeBefore);
  checks.push('malformed temporary preview state falls back to explicit URL without corrupting wardrobe');
""")
p.write_text(s)

# 更新当前说明，保留旧阶段历史事实和旧检查矩阵。
edit('README.md', '当前坐骑是栗色马、灰驴和双峰骆驼。', '当前坐骑是栗色马、灰驴、双峰骆驼和黄牛。')
edit('README.md', '## M5：双峰骆驼', '''## M6：可骑乘黄牛

cattle_yellow黄牛是独立作者资产：1956三角形、1032逻辑点、5868硬边顶点、28骨与27个闭合小壳。厚实桶身、短粗颈和闭合垂皮、宽额鼻镜、两侧弯角、横耳、细尾毛束及八个真实分趾壳构成识别轮廓，不读取或整体缩放马／驴／骆驼网格。

Cattle_Idle 5.2秒、Walk 1.8秒、Run 1.05秒、Eat 6.8秒。黄牛普通／旅行牛鞍为独立低宽背垫作者模块，旅行款包含双袋和小卷包；鼻带及鼻侧环配独立ReinProfile。男女使用更宽跨坐、稍前膝位和低宽持缰方向，人物V5／20骨及FBX不改。

本体入口：?lab=mount&mount=cattle_yellow&pose=bind&paused=1；骑乘入口：?lab=riding&mount=cattle_yellow&saddle=travel&clip=Rider_Walk。只增第四个种类，没有牛专属页面、装备子槽或玩法。详见[黄牛](Documentation/黄牛.md)。数值／交互通过不代表造型和近景服装接触已获用户认可。

## M5：双峰骆驼''')
edit('README.md', '二级模式往返携带mount与saddle；', '二级模式往返携带mount与saddle，并用页签内临时缓存恢复各自进度、相机和未保存骑手装扮；普通URL深链不自动读取该缓存，人物工坊存档不被覆盖；')
edit('README.md', '灰驴较窄鞍具、骆驼两峰间坐垫均不直接套用原马模型。', '灰驴较窄鞍具、骆驼两峰间坐垫、黄牛低宽背垫均不直接套用原马模型。')
edit('README.md', '报告产物mounts-m4-checks记录实际sourceSHA', '黄牛另有964本体、2892骑乘、70衣裤、32次四物种切换；包含弯角对称／刚性、垂皮权重、八趾分缝、鼻镜／鼻孔贴合及反例。报告产物mounts-m4-checks记录实际sourceSHA')
edit('AGENTS.md', '# AGENTS · 衣冠工坊V5与三种坐骑', '# AGENTS · 衣冠工坊V5与四种坐骑')
edit('AGENTS.md', '再读README、工作交接、双峰骆驼、', '再读README、工作交接、黄牛、双峰骆驼、')
edit('AGENTS.md', '当前horse_chestnut栗色马、donkey_gray灰驴、camel_bactrian双峰骆驼。旧阶段“不做骆驼”不阻止本轮，但不授权第四种动物、上下坐骑或玩法。', '当前horse_chestnut栗色马、donkey_gray灰驴、camel_bactrian双峰骆驼、cattle_yellow黄牛。用户已明确批准M6可骑乘黄牛及推送main；旧阶段不做第四物种的限制不阻止M6，但没有授权第五物种、猪、上下坐骑或农耕玩法。')
edit('AGENTS.md', 'src/mounts只提供真实需求', 'src/cattle独立拥有1956三角形／1032逻辑点／28骨、四动作、低宽普通／旅行牛鞍和专属骑姿／缰绳。保持厚桶身、短粗颈、闭合垂皮、宽头鼻镜、弯角、横耳、尾束与八个分趾蹄。角刚性随Head，垂皮仅Chest／NeckBase双权重，趾壳刚性随对应Foot；不能拿单蹄马或水牛角替代。详见黄牛文档。\n\nsrc/mounts只提供真实需求')
edit('AGENTS.md', '人物20骨，马25骨，灰驴27骨，骆驼29骨，', '人物20骨，马25骨，灰驴27骨，骆驼29骨，黄牛28骨，')
edit('AGENTS.md', 'src/camel/saddles拥有驼鞍适配；', 'src/camel/saddles拥有驼鞍适配，src/cattle/saddles拥有低宽牛鞍、鼻带及鼻侧环；')
edit('AGENTS.md', '二级链接同时携带mount与saddle。', '二级链接同时携带mount与saddle；preview-session仅在点击模式链接时写页签临时缓存，恢复各自时钟／Orbit相机／未保存骑手装扮。禁止逐帧写存储或覆盖人物localStorage，普通深链不读取缓存，坏缓存安全回退。')
edit('AGENTS.md', '目录断言更新为真实三种动物，', '目录断言更新为真实四种动物，')
edit('AGENTS.md', '新物种测试不能代替或缩减旧马、灰驴及原服饰回归。', 'M6追加黄牛964本体／2892骑乘／70衣裤和32次四物种切换，角对称与Head刚性、八蹄真实分缝／Foot刚性、垂皮和鼻镜贴合有故障反例。黄牛浏览器追加双模式真实往返、相位／相机／未保存装扮保持及坏缓存反例。新物种测试不能代替或缩减旧马、灰驴、骆驼及原服饰回归。')
for name, text in {
'Documentation/多坐骑与灰驴.md': '\n## M6：第四种真实坐骑\n\ncattle_yellow黄牛与原三种并列，独立作者资源位于src/cattle，不扩展MountDefinition或鞍具三语义。共享目录、播放器、资源释放与inverse bind约束保持。黄牛作者边界集中在《黄牛.md》，旧灰驴和骆驼矩阵不替换。两工作台页面往返另以页签临时缓存保留各自的相位、Orbit相机和骑手装扮；只在明确点击模式链接时保存，人物工坊存档不变。\n',
'Documentation/骑乘与坐骑挂接.md': '\n## M6：黄牛适配\n\nCATTLE_RIDER_FIT属于src/cattle/saddles.ts，作者配置提供男女稍高hipsLift、更宽大腿外展、略前膝位与低宽持缰方向。既有20骨四元数骑姿烘焙器读取这些配置，无新人物绑定、Recipe字段或FBX重定向。挂接、唯一时钟、稳定Seat及换鞍不重建人物规则保持；连续封底裙与手持物仍属试验范围，不保证全相位零穿插。\n\n跨本体／骑乘页面采用preview-session页签临时状态，不持有旧人物或隐藏Canvas；回到骑乘时按原V5装扮重建新页面。页面内换物种仍保留原人物Geometry及inverse bind。两者不能混淆为页面刷新也保留GPU实例。\n',
'Documentation/马鞍与缰绳.md': '\n## M6：牛鞍与鼻侧环\n\nsrc/cattle/saddles.ts独立拥有黄牛simple／travel低宽厚垫、低鞍桥、蹬带与鼻带。旅行袋、卷包和绳索仍属于一个模块，不新增装备槽。CATTLE_REIN_PROFILE提供牛颈外侧导向；bitLeft／bitRight沿用接口名，但代表鼻侧环，不是马衔铁。固定双绳与6毫米嘴环接触门槛保持；黄牛检查额外覆盖鼻镜、角和垂皮，不增加整头豁免。\n',
}.items():
    p = Path(name); p.write_text(p.read_text() + text)
subprocess.run(['git', 'add', '--', 'README.md', 'AGENTS.md', 'Documentation'], check=True)
print('M6 preview state, browser coverage and ownership documentation integrated.')
