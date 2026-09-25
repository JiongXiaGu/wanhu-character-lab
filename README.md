# 万户 · 衣冠工坊V5与多坐骑


## 后续动物工作流

猫完成后，动物部分按 **山羊 → 猴子 → 绵羊 → 鹿 → 兔子 → 鸟类 → 鱼类** 继续推进。共同路线、系统分线、验收要求和 GitHub 边界集中在 [动物工作流](Documentation/动物工作流.md)。

其中山羊、绵羊和适合作为饲养动物的兔子优先沿用现有地面家畜公共能力；猴子、鹿、鸟类和鱼类在对应阶段只建立最小必要的环境动物能力，不为了“统一动物系统”污染当前家畜、坐骑和骑乘契约。尚未进入对应阶段的物种不提前注册空占位。

《万户天工》3D玩家／居民换装、FBX试衣与坐骑Web Demo。固定成年男女、一档低模精度；当前坐骑是栗色马、灰驴、双峰骆驼、黄牛、牦牛和水牛。界面只选择种类与整体鞍具，正式玩法仍留在Unity。


## L7：橘色田园猫与六种家畜

`cat_rural_orange` 已接入现有家畜目录：独立九骨，三档262／146／86三角形，停驻、行走、奔跑、闻地、理毛、睡觉六个陆地动作。与鸡、鸭、鹅、猪和犬共用工作台、时间控件、LOD缓存及1至500只群体，不新增页面或AI。

入口 `?lab=livestock&animal=cat_rural_orange`；睡觉加 `&clip=sleep&paused=1&phase=.5`。默认日常35／25／20／20仅含idle、walk、sniff、groom；run和sleep显式预览。作者边界及检查见[田园猫](Documentation/田园猫.md)，统一睡眠见[家畜睡觉动作](Documentation/家畜睡觉动作.md)。下方L6等章节是历史阶段，不作为当前目录数量。

## S1：皇宫禁卫 · 长枪

人物工坊右侧「军人试衣」可应用宫卫红缨盔、札甲、分片甲裙与裤装、短筒军靴和长枪，五件也能在原槽位独立混搭。整套应用保留当前男女、发式和发色，仍为Recipe V5、七槽位、20骨；不会把士兵加入默认平民随机池。

入口 `?soldier=palace&pose=bind&paused=1`；加 `&view=overview` 为经营俯视。五件新增几何共1050三角形，整套男女分别1243/1245三角形。长枪随右手变换，尚无专用持枪战斗动作；边疆与城市没有空模型占位。详见[皇宫禁卫与长枪](Documentation/皇宫禁卫与长枪.md)及[长期工作流](Documentation/军人与甲胄工作流.md)。

`check:soldier`与普通桌面交互已纳入Targeted，`review:soldier`或Manual soldier scope显式生成真实WebGL关键图。各项结果与精确受测SHA以对应PR为准，自动通过不代表用户已认可美术。

## 家畜睡觉动作

鸡、鸭、鹅、黑色家猪与中国田园犬均支持正式陆地 `sleep`（睡觉）：三秒原地低伏呼吸，沿用原网格、骨架与三档LOD，不进入日常混合池。在家畜动作区点击睡觉可检查单只及1至500只群体，复用暂停、单步、相位定位、循环和末帧控制。

猪入口 `?lab=livestock&animal=pig_domestic_black&clip=sleep&paused=1&phase=.5`，犬使用 `dog_rural_yellow`。两者均为九骨六动作；没有入睡／起床过渡、闭眼材质、音效、睡眠地点或AI。范围、生命周期与检查集中在[家畜睡觉动作](Documentation/家畜睡觉动作.md)。人物及坐骑不改。

## L6：中国田园犬与五种家畜

动物工坊→家畜现有鸡、鸭、鹅、黑色家猪和黄褐色中国田园犬。犬独立拥有九骨、三档作者LOD与idle/walk/run/sniff/bark/sleep六个陆地动作；使用现有工作台和1/10/50/100/500群体预览，不可骑乘，不新增宠物页面或看门AI。三档为274/142/78三角形、157/91/55逻辑点，数据所有权与边界见[中国田园犬](Documentation/中国田园犬.md)。

犬入口 `?lab=livestock&animal=dog_rural_yellow`；闻地加 `&clip=sniff&phase=.5&paused=1&view=left`，吠叫改为 `clip=bark`；百只经营俯视加 `&count=100&mixed=1&view=farm`。日常池为idle35%、walk30%、sniff20%、bark15%，run和sleep只显式预览。

黑色家猪的眼体收敛版：去掉亮色外圈，使用接近牛马的小型嵌入闭合眼睛。保留已修正的完整短腿、小无孔鼻盘、九骨和日常池，动作追加sleep后为六个；当前三档216/138/82三角形、128/89/57逻辑点。猪入口 `?lab=livestock&animal=pig_domestic_black`，边界见[家猪](Documentation/家猪.md)。

`check:livestock`与桌面入口保留鸡鸭鹅猪完整回归并追加犬；显式 `review:livestock`生成真实WebGL关键图。自动检查、AI看图与用户美术认可分别记录，不把有限采样写成连续时间零穿插。

## 拉取与运行

Node.js >=22.12。各阶段合入后均拉取main，不需要旧任务分支；Windows可双击Start-Local.cmd。

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
npm run dev
```

顶部人物工坊／动物工坊保持。动物内部是坐骑本体／骑乘试衣／家畜三个栏目；前两项共用坐骑种类、鞍具两个下拉框，家畜使用独立种类与动作。相机位于预览右上，底部循环默认开启。

| 入口 | 用途 |
|---|---|
| 根地址 | 人物换装和原FBX试衣 |
| ?lab=mount | 坐骑本体；默认栗色马、无鞍具 |
| ?lab=mount&mount=donkey_gray&pose=bind&paused=1 | 灰驴静态本体 |
| ?lab=mount&mount=camel_bactrian&pose=bind&paused=1 | 双峰骆驼静态本体 |
| ?lab=riding&mount=camel_bactrian&saddle=travel&clip=Rider_Walk | 骆驼旅行鞍具与步行骑乘 |
| ?lab=mount&mount=yak_black&pose=bind&paused=1 | 牦牛静态本体 |
| ?lab=riding&mount=yak_black&saddle=travel&clip=Rider_Walk | 牦牛旅行鞍与步行骑乘 |
| ?lab=riding | 骑乘；直接进入默认栗色马和普通鞍具 |
| ?lab=riding&mount=donkey_gray&saddle=travel&clip=pose&paused=1 | 灰驴旅行鞍具、静态骑姿 |
| ?lab=riding&mount=donkey_gray&saddle=simple&bodyType=female&clip=Rider_Walk&paused=1 | 女性骑驴，步行初始暂停 |

旧?lab=horse进入同一坐骑本体页，不再维护重复HorseLab。二级模式往返携带mount与saddle，并用页签内临时缓存恢复各自进度、相机和未保存骑手装扮；普通URL深链不自动读取该缓存，人物工坊存档不被覆盖；从无鞍本体进入骑乘不会自动装鞍，需要主动选择普通或旅行。

## M8：可骑乘水牛

buffalo_water使用独立低长头、横展后弯角、低沉宽体、横耳与八个分趾壳；2056三角形、1082逻辑点、28骨。不是黄牛换色缩放。Buffalo_Idle／Walk／Run／Eat分别5.8／2.0／1.15／7.2秒；普通／旅行水牛鞍、鼻侧缰具和男女骑姿均有独立作者配置，人物V5、20骨、衣柜及FBX不改。

本体：?lab=mount&mount=buffalo_water&pose=bind&paused=1；旅行骑乘：?lab=riding&mount=buffalo_water&saddle=travel&clip=Rider_Walk。仍使用原动物工坊两个模式和种类／整体鞍具两个选择。已保留并行合入的牦牛，目录共六种真实坐骑。检查和视觉验收边界见[水牛](Documentation/水牛.md)。

## M7：可骑乘牦牛

yak_black是独立高原牦牛：2328三角形、1224逻辑点、6984硬边顶点、29骨、30个闭合作者壳。低宽前躯、强肩低头、短粗颈、连续长毛下摆、宽厚胸毛、外展上扬角、小耳、蓬尾与八个分趾壳形成轮廓。躯干和左右裙毛是一张连续闭合表面，不是黄牛外套毛壳；不使用透明毛片或毛发物理。

Yak_Idle 5.8秒、Walk 1.95秒、Run 1.10秒、Eat 7.2秒。独立宽背厚垫与低坐面，旅行款含布包、卷包和绑绳；鼻带侧环配专属角下缰绳导向。男女独立YAK_RIDER_FIT，原四物种、人物V5／20骨／服饰／FBX保持。仍只有种类与整体鞍具两个选择，没有牦牛专属页面。

本体：?lab=mount&mount=yak_black&pose=bind&paused=1；骑乘：?lab=riding&mount=yak_black&saddle=travel&clip=Rider_Walk。check:mounts追加964本体／2892骑乘／70衣裤／40次五物种切换及30个故障反例，默认浏览器仍只做交互。详见[牦牛](Documentation/牦牛.md)。自动检查不等于用户已认可造型、步态或近景接触。

## M6：可骑乘黄牛

cattle_yellow黄牛是独立作者资产：1956三角形、1032逻辑点、5868硬边顶点、28骨与27个闭合小壳。厚实桶身、短粗颈和闭合垂皮、宽额鼻镜、两侧弯角、横耳、细尾毛束及八个真实分趾壳构成识别轮廓，不读取或整体缩放马／驴／骆驼网格。

Cattle_Idle 5.2秒、Walk 1.8秒、Run 1.05秒、Eat 6.8秒。黄牛普通／旅行牛鞍为独立低宽背垫作者模块，旅行款包含双袋和小卷包；鼻带及鼻侧环配独立ReinProfile。男女使用更宽跨坐、稍前膝位和低宽持缰方向，人物V5／20骨及FBX不改。

本体入口：?lab=mount&mount=cattle_yellow&pose=bind&paused=1；骑乘入口：?lab=riding&mount=cattle_yellow&saddle=travel&clip=Rider_Walk。只增第四个种类，没有牛专属页面、装备子槽或玩法。详见[黄牛](Documentation/黄牛.md)。数值／交互通过不代表造型和近景服装接触已获用户认可。

## M5：双峰骆驼

camel_bactrian双峰骆驼使用独立作者网格，当前2280三角形、1198逻辑点、29骨骼（硬边拆点6840），突出双峰、弯曲长颈、长腿、宽脚垫和前双趾；不是马／驴的缩放变形。三段颈部、三段尾与双耳有真实轨道，驼峰只随躯干蒙皮。

连续双峰建模版将躯干和两个驼峰合为一张闭合Body表面，移除首稿独立峰底造成的根部台阶；峰顶改为较低圆钝轮廓，并重新衔接肩臀、侧腹和下颈。保留低模硬边，不通过改变灯光或平滑法线隐藏接缝。原头／眼鼻、腿脚、29骨、四动作、鞍具与骑手坐点保持。

Camel_Idle 4.8秒、Camel_Walk 1.6秒、Camel_Run 1.0秒、Camel_Eat 6.8秒。步行／奔跑采用略错相的同侧腿节奏，正向脚轨迹独立受测；进食只在本体页。依然是in-place作者动作，不包含Root Motion、地形IK或跪下／起身。

普通／旅行驼鞍坐在两峰之间，各有鼻带式缰具。旅行款含左右行囊、水袋与后方卷毯，全部属于一个travel模块。男女使用独立跨坐和较高持缰方向，人物20骨与Recipe V5保持；旧马／灰驴的模型与动作未改。详见[双峰骆驼](Documentation/双峰骆驼.md)。骆驼外形、步态和近景接触待用户网页验收。

## M4-A：灰驴与多坐骑

种类可实际切换栗色马／灰驴。灰驴是独立作者截面模型，有长耳、短鬃、浅色口鼻腹部、较短腿和尾端毛束，不是把马缩小换色。原马25骨不变；灰驴27骨，其中两根用于长耳。人物仍是20骨，两套绑定各自独立。

本体页提供各物种自己的停驻、步行、奔跑、进食。灰驴片段为Donkey_Idle 4秒、Donkey_Walk 1.4秒、Donkey_Run 0.9秒、Donkey_Eat 6秒；骑乘只配静态、停驻、步行和奔跑，不给驴播放Horse轨道。灰驴骨盆离地留量在创建轨道时标定，运行时没有腿部IK或地形求解。

换种类保留人物Geometry与inverse bind、外观、鞍具风格、动作语义和归一化相位。时长变化时秒数随之变化；相机方向和缩放保持，只适配构图高度。旧动物和旧绳正确释放，页面始终一个Canvas。详情见[多坐骑与灰驴](Documentation/多坐骑与灰驴.md)。灰驴Walk／Run方向及鼻孔修复已获用户确认；M5继续保留该版本。

## 整套鞍具与同帧缰绳

鞍具只有无、普通、旅行三个选项。普通含鞍垫、鞍座、简化蹬带／脚蹬和辔头；旅行再含左右袋与后卷毯。内部零件整套切换，不增加子槽位、装备库存或第三个马具工作台。

相同风格按当前物种使用专属几何和坐点：灰驴较窄鞍具、骆驼两峰间坐垫、黄牛低宽背垫均不直接套用原马模型。普通／旅行互换不重建当前动物、人物或绳网格，也不重置相位与相机。无鞍具隐藏骑手／骨架／绳，冻结骑乘但保留原装扮和进度；冻结期间可换物种，仍保留无鞍状态。

两根缰绳共200三角形，物种提供嘴环和颈侧导向，掌心挂当前人物。顺序为动物采样→同相位骑手采样→末端挂点→原绳缓冲更新，不逐帧创建Geometry，不做绳物理或手部IK。本体页有鞍无骑手时只显示辔头。详见[马鞍与缰绳](Documentation/马鞍与缰绳.md)。

## 人物骑乘与试衣

复用当前V5人物，可换男女、上衣、下装、鞋、帽饰、发型配色；可读取人物工坊明确保存的装扮或严格导入V5 JSON，不静默覆盖原存档。换装只替换人物，保留当前动物、绳与播放相位。

骑手的20条局部四元数轨道按当前物种RiderFit制作，时长跟随坐骑唯一时钟；不增加根位移、不重新绑定人物、不复制动物背部升降。原人物工坊FBX路径不变，骑姿不是新增Mixamo FBX或失败回退。

裤装作为骑乘验收基准。连续封底裙仍可试穿但可能与动物或鞍具穿插，不自动换裤、拆裙或删封底。手持物不自动清除，持缰冲突在UI中提示。手掌没有手指弯曲、脚蹬无精确贴脚，不能用数值通过代替近景接触验收。详见[骑乘与坐骑挂接](Documentation/骑乘与坐骑挂接.md)。

## 原马与人物资源保持

马本体1524三角形、806逻辑顶点、25骨骼、最多双权重，硬边拆点4572。Horse_Idle 3.6秒、Walk 1.2秒、Run 0.8秒、Eat 6秒，原M1网格／绑定／动作版本保持；马具和骑手面数另计。原马作者网格与鞍具已接受，不因增加灰驴重做。原地动画不是正式根速度移动或零滑步系统，见[低模马与基础四足动画](Documentation/低模马与基础四足动画.md)。

正式人物衣柜为8上衣、6下装、2鞋，新增宫卫札甲、甲裙与军靴，body仅内部哨兵；10张搭配灵感保留，基础搭配已删。上衣为干活背心、短打短褂、劳作短衣、交领常服、半臂配内衬、滚边礼衣、农户短衣；下装为封口短裤、日常短裙、素面长裙、劳动直裤、劳作束脚裤。

退役guard_light_armor、archer_tunic、loose_trousers、guard_pants、archer_pants、pleated_skirt、robe_skirt、short_skirt、boots不恢复兼容。人物工坊保留种子、锁定、撤销、保存、文件往返、发式帽饰和配色。所有正式衣裤Cap封闭、帽饰闭合，原covers／sealedInterfaces／权重和人体保护签名不改变。详见[服装Cap封闭](Documentation/服装Cap封闭实验.md)与[头饰闭合](Documentation/头饰闭合与安全留量.md)。

FBX放入动画参考目录，可含子目录，启动／构建动态扫描提取；XR Animator GLB 从 `动画参考_glb/` 提取。MediaPipe 动作包含两条“新宝岛”和“抓个锅盖头 · MediaPipe（全片）”，由 D 盘视频派生为 20 骨动画，源骨架对照显示原始 33 点；原视频保留在 D 盘，不进入仓库。动画搜索、分类、收藏、逐帧、变速、源骨架对照及暂停换装相位保持。人物Recipe仍精确六字段version/bodyType/slots/dyes/hairStyle/hairColor、七槽位、存储键wanhu.character.wardrobe.v5。

## 自动检查与人工验收

仍三条正式Actions：Build & Core Checks、按路径运行的Targeted Numeric Checks、仅手动Manual Visual Review。Package／workflow变化仍跑全数值回归，不削减原马、服饰或FBX门槛。

```sh
npm run check:mounts
npm run check:horse
npm run check:riding
npm run check:saddles
# 真实桌面交互，不截图
npx playwright install chromium
npm run check:mounts-browser
npm run check:riding-browser
npm run check:saddles-browser
# 仅明确需要骆驼建模截图时运行
node scripts/review-camel-torso.mjs
```

灰驴检查覆盖964本体姿态、2892稠密有鞍骑乘姿态、70衣裤关键相位、20次物种往返与错误／释放验证。骆驼964本体、2892骑乘、70衣裤、24次三物种切换及14个原故障反例保持；另外增加连续躯干拓扑与两个故障反例。检查脚轨迹方向、面部小壳贴合、两峰间坐点与缰绳避峰。原骑乘1446、原马具1452＋484及原Horse964姿态等回归保留。黄牛另有964本体、2892骑乘、70衣裤、32次四物种切换；包含弯角对称／刚性、垂皮权重、八趾分缝、鼻镜／鼻孔贴合及反例。报告产物mounts-m4-checks记录实际sourceSHA，默认浏览器只做交互，不自动生成图片。

旧review:local各入口与--full保留按需使用；生成截图、自动通过和人工视觉认可分开记录。有限采样不是全时域零穿插。尚无跪下／起身、上下坐骑、导航、玩家移动、地形贴蹄、袋子物理、连续身材、儿童老人、人物或坐骑多档LOD、Unity正式坐骑运行时或GPU Crowd。本项目不部署Vercel。

文档：[V5契约](Documentation/固定基模与换装V5.md) · [服装架构](Documentation/服装生成架构.md) · [人物动画](Documentation/Mixamo动画接入.md) · [新宝岛MediaPipe片段](Documentation/新宝岛MediaPipe片段接入.md) · [抓个锅盖头MediaPipe全片](Documentation/抓个锅盖头MediaPipe全片接入.md) · [多坐骑](Documentation/多坐骑与灰驴.md) · [双峰骆驼](Documentation/双峰骆驼.md) · [黄牛](Documentation/黄牛.md) · [牦牛](Documentation/牦牛.md) · [Unity迁移](Documentation/GPU骨骼动画迁移契约.md)。
