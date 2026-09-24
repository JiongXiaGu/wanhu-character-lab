from pathlib import Path
import re

def replace(path, old, new, count=1):
    p=Path(path); text=p.read_text(); actual=text.count(old)
    assert actual==count, (path, old[:100], actual, count)
    p.write_text(text.replace(old,new))

def section(path, heading, body):
    p=Path(path); text=p.read_text(); assert heading not in text
    where=text.index('\n## ')
    p.write_text(text[:where]+'\n\n## '+heading+'\n\n'+body.strip()+'\n'+text[where:])

# 唯一公共实际蒙皮网格检查；保留原睡眠所有故障注入和数值阈值。
p='scripts/check-livestock-sleep.ts'
replace(p,"import { InstancedMesh, Matrix4, Quaternion, Ray, Vector3 } from 'three';", "import { InstancedMesh, Matrix4, Vector3 } from 'three';")
replace(p,"import type { AnimalActor } from '../src/livestock/types';", "import { readSkinnedPoints as readPoints, assertClosedSkinnedMesh as closedSleepMesh } from './check-livestock-mesh-shared';")
replace(p,"  { id: 'dog_rural_yellow', bones: 9, drop: .284, headDrop: .40, headReach: .60 },", "  { id: 'dog_rural_yellow', bones: 9, drop: .284, headDrop: .40, headReach: .60 },\n  { id: 'cat_rural_orange', bones: 9, drop: .130, headDrop: .14, headReach: .40 },")
pth=Path(p); text=pth.read_text(); a=text.index('const readPoints ='); b=text.index('const mean =',a); text=text[:a]+text[b:]
a=text.index('/** 直接检查当前渲染三角形'); b=text.index('const reports: object[]',a); text=text[:a]+text[b:]; pth.write_text(text)
replace(p,"assert.equal(totalPoses, 5 * 3 * 241, '五种家畜全部三档睡眠矩阵');", "assert.deepEqual(specs.map(s => s.id), LIVESTOCK.map(d => d.id), '正式目录不得遗漏睡眠专项');\nassert.equal(totalPoses, 6 * 3 * 241, '六种家畜全部三档睡眠矩阵');")

# 旧浏览器只扩展精确目录期望，不删除动作、相机、生命周期或数量断言。
changed=[]
for path in Path('scripts').glob('check-livestock*browser.mjs'):
    if path.name in ['check-livestock-cat-browser.mjs','check-livestock-sleep-browser.mjs']: continue
    lines=path.read_text().splitlines(keepends=True); edits=0
    for i,line in enumerate(lines):
        if "locator('option')" in line and 'chicken_brown' in line and 'cat_rural_orange' not in line:
            matches=list(re.finditer(r"\[[^\]\n]*chicken_brown[^\]\n]*\]",line)); assert len(matches)==1,(path,line)
            m=matches[0]; lines[i]=line[:m.end()-1]+", 'cat_rural_orange'"+line[m.end()-1:]; edits+=1
    if edits: path.write_text(''.join(lines)); changed.append(str(path))
assert {'scripts/check-livestock-duck-browser.mjs','scripts/check-livestock-goose-browser.mjs','scripts/check-livestock-pig-browser.mjs','scripts/check-livestock-dog-browser.mjs'}.issubset(changed),changed
p='scripts/check-livestock-cat-browser.mjs'
replace(p,"page.locator('.livestock-motions button').evaluateAll(nodes => nodes.map(n => n.textContent))", "page.locator('.livestock-motions button strong').evaluateAll(nodes => nodes.map(n => n.textContent))")
p='scripts/check-livestock-sleep-browser.mjs'
replace(p,"    ['dog_rural_yellow', '中国田园犬', 9, [274, 142, 78]],", "    ['dog_rural_yellow', '中国田园犬', 9, [274, 142, 78]],\n    ['cat_rural_orange', '橘色田园猫', 9, [262, 146, 86]],")
replace(p,"// 五种家畜保留共同sleep语义", "// 六种家畜保留共同sleep语义")
replace(p,"for (const animal of ['pig_domestic_black', 'dog_rural_yellow', 'pig_domestic_black'])", "for (const animal of ['pig_domestic_black', 'dog_rural_yellow', 'pig_domestic_black', 'cat_rural_orange', 'dog_rural_yellow', 'cat_rural_orange', 'pig_domestic_black'])")
replace(p,"animal === 'pig_domestic_black' ? 138 : 142", "({ pig_domestic_black: 138, dog_rural_yellow: 142, cat_rural_orange: 146 })[animal]")

p='.github/workflows/targeted-checks.yml'
replace(p,'src/pig/*|src/dog/*|','src/pig/*|src/dog/*|src/cat/*|')
replace(p,'# 五种家畜完整浏览器矩阵加睡眠专项','# 六种家畜完整浏览器矩阵加睡眠专项')
replace(p,'Chicken, duck, goose, pig and dog topology, actual skinning and crowd checks','Chicken, duck, goose, pig, dog and cat topology, actual skinning and crowd checks')

cat_doc='''# 田园猫

## 目标与所有权

`cat_rural_orange` 是不可骑乘的橘色田园猫，作为家畜目录第六种动物进入现有动物工坊。`src/cat` 独立拥有米制网格、绑定、作者动作与三档LOD；不调用犬、猪或坐骑作者工厂，不通过缩放犬模型伪装猫。公共家畜模块只负责目录、Actor采样、时间控制、缓存、实例群体及释放。

圆颊短口鼻、双尖耳、完整轻巧四足与长弯尾构成经营俯视下的识别轮廓。眼睛沿实际头面嵌入，保持深色小型闭合眼体，不增加白眼圈、透明胡须或爪部细节。低模造型与动作最终仍需用户验收。

## 骨架与LOD

固定九骨：Root、Body、Neck、Head、Tail、左右前腿与左右后腿。四条单段腿挂Root以隔离呼吸；耳与眼刚性跟随Head，静态弯尾由一个Tail整体带动。不增加脚掌、耳、下巴、细分脊柱或睡眠骨；单权重、不透明FrontSide、单材质。

| 档位 | 三角形 | 逻辑顶点 | 保留轮廓 |
|---|---:|---:|---|
| LOD0 | 262 | 151 | 圆颊、短鼻、眼睛、完整猫足、弯尾 |
| LOD1 | 146 | 93 | 简化眼睛、完整四足、尖耳和弯尾 |
| LOD2 | 86 | 59 | 无独立眼体，保留短头、四足、尖耳和长尾 |

三档为独立作者拓扑，使用相同米制骨架与全部动作；不在运行时删面，不新增睡眠网格或专用LOD。参考高度0.553米，预览格距1.80米；继续使用70／26像素的Auto LOD阈值。

## 动作与日常池

六个陆地动作：停驻idle、行走walk、奔跑run、闻地sniff、理毛groom、睡觉sleep。时长依次4、0.8、0.5、4、4、3秒；创建时烘焙30fps位置与四元数轨道，不烘焙骨骼缩放。

行走和奔跑以足端接地与前进方向为准，支撑足向后扫、摆动足抬起。闻地由躯干、颈与头分担俯首，避免单个短颈截面折入胸腔。理毛使用单段抬前足与轻微低头配合，不声称有舌头接触、脚掌细骨或多关节IK。

睡眠保持低伏、折腿与放松尾部，只做毫米级呼吸；尾部围绕真实嵌入点旋转，足端不随呼吸滑动。共同契约与故障检查归《家畜睡觉动作.md》，本文件不重复播放器和睡眠生命周期规则。

默认日常池为停驻35%、行走25%、闻地20%、理毛20%。奔跑与睡觉仅显式选择，不加入日常混合；没有昼夜或行为AI。

## UI、群体与生命周期

入口：动物工坊→家畜→橘色田园猫。深链 `?lab=livestock&animal=cat_rural_orange`；追加 `&clip=sleep&paused=1&phase=.5` 查看睡姿，百只经营俯视追加 `&count=100&view=farm`。

复用暂停／恢复、前后单步、相位定位、循环和单次末帧。1／10／50／100／500只共用按LOD缓存与8个错峰相位，不为每只动物创建Mixer。显式动作不超过8个动物批次；四动作日常池不超过32个。切换物种保留共有语义和归一化相位，不把犬bark或猪root当成猫动作；独有动作回退idle。

LOD切换复用相同骨架姿态，种类切换和栏目离开沿用已有释放流程。人物衣柜、骑手装扮、坐骑资源和并行军人工作流不归猫模块所有。

## 检查与验收

`check:livestock`包含猫3 LOD × 6动作 × 241相位＝4338个实际蒙皮姿态。验证有限坐标、闭合绕序、非退化面、翻面、接地、眼耳与腿尾附着、bind／inverse bind、步态方向、理毛支撑脚、缓存一致性和1至500实例。

统一睡眠专项另检查猫723个睡姿和45个真实故障反例；保留其它五种动物全部既有检查。`check:livestock-browser`与显式`review:livestock`分别执行无截图和有截图路径，覆盖六动作、三档、时间控件、1至500、物种互换、缓存平台期及栏目恢复。

真实WebGL证据包含近景三分之四、正面、正侧面、理毛／闻地／奔跑／睡觉、三档同机位对照与100／500只经营视图。精确受测SHA和实际结果记录在PR #56及其Actions，定义检查矩阵不等于已经通过；自动断言、AI实际看图和用户最终美术认可分别记录。有限采样不证明连续时间永远零穿插。

## 当前边界

不实现捕鼠、攀爬、跳跃、追逐、跟随、宠物玩法、音效、胡须物理、尾部多关节、入睡／起床过渡、闭眼材质、猫窝、繁殖、颜色变体或Unity正式运行时。
'''
p=Path('Documentation/田园猫.md'); assert not p.exists(); p.write_text(cat_doc)
section('README.md','L7：橘色田园猫与六种家畜','''`cat_rural_orange` 已接入现有家畜目录：独立九骨，三档262／146／86三角形，停驻、行走、奔跑、闻地、理毛、睡觉六个陆地动作。与鸡、鸭、鹅、猪和犬共用工作台、时间控件、LOD缓存及1至500只群体，不新增页面或AI。

入口 `?lab=livestock&animal=cat_rural_orange`；睡觉加 `&clip=sleep&paused=1&phase=.5`。默认日常35／25／20／20仅含idle、walk、sniff、groom；run和sleep显式预览。作者边界及检查见[田园猫](Documentation/田园猫.md)，统一睡眠见[家畜睡觉动作](Documentation/家畜睡觉动作.md)。下方L6等章节是历史阶段，不作为当前目录数量。''')
section('AGENTS.md','L7：田园猫作者边界','''用户已明确授权新增猫。继续前读 `Documentation/田园猫.md` 和 `src/cat/AGENTS.md`；`cat_rural_orange`独立拥有九骨、三档作者网格及六个陆地动作，沿用家畜运行时与现有工作台。不可借机增加页面、通用四足框架、捕鼠或宠物AI。run／sleep不进入默认日常池。

保留所有并行人物、军人工作流、服饰、背具、MediaPipe、Mixamo／GLB和坐骑提交。猫加入原Targeted作用域、全部旧家畜回归和统一睡眠检查；仍仅保留三条正式Actions。自动通过、AI实际看图、用户美术认可分别记录，未通过不得写成完成。''')
section('Documentation/工作交接.md','L7：橘色田园猫接入与验收','''PR #56在最新main上继续增加`cat_rural_orange`，并已同步保留并行PR #57军人工作流。以后仍须重新读取远端main，不使用本段历史基线覆盖其它提交。

猫独立九骨、262／146／86三角形、151／93／59逻辑点，六个陆地动作idle/walk/run/sniff/groom/sleep。运行时仍归家畜公共模块，模型与动作边界集中在《田园猫.md》。原五物种、人物、坐骑和军人工作流保持；run与sleep不进日常池。

首轮检查发现短颈闻地翻面、理毛与睡觉颈部塌缩，已通过分担俯首及收敛头颈幅度修正作者轨道，没有放宽真实蒙皮、接地、闭合或附着断言。完整猫矩阵为4338姿态；另接入统一睡眠723姿态及45反例。旧物种浏览器目录扩到六种，猫专项覆盖三档六动作、1至500、控制和生命周期。

精确SHA、Actions结论及实际看图记录以PR #56为准；本节说明实现与待验收边界，不把矩阵定义或已写截图脚本当成通过。最终需实际查看近景、正侧、LOD对照及100／500只真实WebGL图，再正常合并；用户美术认可仍单独验收。''')
p='Documentation/家畜睡觉动作.md'; text=Path(p).read_text()
text=text.replace('鸡、鸭、鹅、黑色家猪与中国田园犬','鸡、鸭、鹅、黑色家猪、中国田园犬与橘色田园猫').replace('五种家畜','六种家畜').replace('猪／犬九骨','猪／犬／猫九骨')
text=text.replace('| 犬 | 6 | 4338 |','| 犬 | 6 | 4338 |\n| 猫 | 6 | 4338 |')
text=text.replace('五种共24582个矩阵姿态','六种共28920个矩阵姿态').replace('5×3×241＝3615','6×3×241＝4338').replace('睡眠专项共171个真实反例，其中猪犬各45个','睡眠专项共216个真实反例，其中猪、犬、猫各45个').replace('15个物种／LOD组合、25个数量组合','18个物种／LOD组合、30个数量组合').replace('所有五种','所有六种')
text=text.replace('犬350帧；','犬350帧，猫398帧；')
text=text.replace('家禽原睡姿不变；','猫沿用自身九骨与262／146／86面三档，不新增sleep mesh，短颈低伏、长尾收低；家禽原睡姿不变；')
Path(p).write_text(text)
print('CAT_INTEGRATION_PATCH_APPLIED',changed)
