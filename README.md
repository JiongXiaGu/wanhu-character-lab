# 万户 · 衣冠工坊V5与多坐骑

《万户天工》3D玩家／居民换装、FBX试衣与坐骑Web Demo。固定成年男女、一档低模精度；当前坐骑是栗色马和灰驴。界面只选择种类与整体鞍具，正式玩法仍留在Unity。

## 拉取与运行

Node.js >=22.12。各阶段合入后均拉取main，不需要旧任务分支；Windows可双击Start-Local.cmd。

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
npm run dev
```

顶部人物工坊／动物工坊保持。动物内部是坐骑本体／骑乘试衣，两种模式共用种类、鞍具两个下拉框。相机位于预览右上，底部循环默认开启。

| 入口 | 用途 |
|---|---|
| 根地址 | 人物换装和原FBX试衣 |
| ?lab=mount | 坐骑本体；默认栗色马、无鞍具 |
| ?lab=mount&mount=donkey_gray&pose=bind&paused=1 | 灰驴静态本体 |
| ?lab=riding | 骑乘；直接进入默认栗色马和普通鞍具 |
| ?lab=riding&mount=donkey_gray&saddle=travel&clip=pose&paused=1 | 灰驴旅行鞍具、静态骑姿 |
| ?lab=riding&mount=donkey_gray&saddle=simple&bodyType=female&clip=Rider_Walk&paused=1 | 女性骑驴，步行初始暂停 |

旧?lab=horse进入同一坐骑本体页，不再维护重复HorseLab。二级模式往返携带mount与saddle；从无鞍本体进入骑乘不会自动装鞍，需要主动选择普通或旅行。

## M4-A：灰驴与多坐骑

种类可实际切换栗色马／灰驴。灰驴是独立作者截面模型，有长耳、短鬃、浅色口鼻腹部、较短腿和尾端毛束，不是把马缩小换色。原马25骨不变；灰驴27骨，其中两根用于长耳。人物仍是20骨，两套绑定各自独立。

本体页提供各物种自己的停驻、步行、奔跑、进食。灰驴片段为Donkey_Idle 4秒、Donkey_Walk 1.4秒、Donkey_Run 0.9秒、Donkey_Eat 6秒；骑乘只配静态、停驻、步行和奔跑，不给驴播放Horse轨道。灰驴骨盆离地留量在创建轨道时标定，运行时没有腿部IK或地形求解。

换种类保留人物Geometry与inverse bind、外观、鞍具风格、动作语义和归一化相位。时长变化时秒数随之变化；相机方向和缩放保持，只适配构图高度。旧动物和旧绳正确释放，页面始终一个Canvas。详情见[多坐骑与灰驴](Documentation/多坐骑与灰驴.md)。本轮没有骆驼或未制作的物种占位，灰驴外观与步态仍需用户验收。

## 整套鞍具与同帧缰绳

鞍具只有无、普通、旅行三个选项。普通含鞍垫、鞍座、简化蹬带／脚蹬和辔头；旅行再含左右袋与后卷毯。内部零件整套切换，不增加子槽位、装备库存或第三个马具工作台。

相同风格按当前物种使用专属几何和坐点：灰驴较窄鞍具和较小行囊不会直接套用原马模型。普通／旅行互换不重建当前动物、人物或绳网格，也不重置相位与相机。无鞍具隐藏骑手／骨架／绳，冻结骑乘但保留原装扮和进度；冻结期间可换物种，仍保留无鞍状态。

两根缰绳共200三角形，物种提供嘴环和颈侧导向，掌心挂当前人物。顺序为动物采样→同相位骑手采样→末端挂点→原绳缓冲更新，不逐帧创建Geometry，不做绳物理或手部IK。本体页有鞍无骑手时只显示辔头。详见[马鞍与缰绳](Documentation/马鞍与缰绳.md)。

## 人物骑乘与试衣

复用当前V5人物，可换男女、上衣、下装、鞋、帽饰、发型配色；可读取人物工坊明确保存的装扮或严格导入V5 JSON，不静默覆盖原存档。换装只替换人物，保留当前动物、绳与播放相位。

骑手的20条局部四元数轨道按当前物种RiderFit制作，时长跟随坐骑唯一时钟；不增加根位移、不重新绑定人物、不复制动物背部升降。原人物工坊FBX路径不变，骑姿不是新增Mixamo FBX或失败回退。

裤装作为骑乘验收基准。连续封底裙仍可试穿但可能与动物或鞍具穿插，不自动换裤、拆裙或删封底。手持物不自动清除，持缰冲突在UI中提示。手掌没有手指弯曲、脚蹬无精确贴脚，不能用数值通过代替近景接触验收。详见[骑乘与坐骑挂接](Documentation/骑乘与坐骑挂接.md)。

## 原马与人物资源保持

马本体1524三角形、806逻辑顶点、25骨骼、最多双权重，硬边拆点4572。Horse_Idle 3.6秒、Walk 1.2秒、Run 0.8秒、Eat 6秒，原M1网格／绑定／动作版本保持；马具和骑手面数另计。原马作者网格与鞍具已接受，不因增加灰驴重做。原地动画不是正式根速度移动或零滑步系统，见[低模马与基础四足动画](Documentation/低模马与基础四足动画.md)。

正式人物衣柜仍7上衣、5下装、1布鞋，body仅内部哨兵；10张搭配灵感保留，基础搭配已删。上衣为干活背心、短打短褂、劳作短衣、交领常服、半臂配内衬、滚边礼衣、农户短衣；下装为封口短裤、日常短裙、素面长裙、劳动直裤、劳作束脚裤。

退役guard_light_armor、archer_tunic、loose_trousers、guard_pants、archer_pants、pleated_skirt、robe_skirt、short_skirt、boots不恢复兼容。人物工坊保留种子、锁定、撤销、保存、文件往返、发式帽饰和配色。所有正式衣裤Cap封闭、帽饰闭合，原covers／sealedInterfaces／权重和人体保护签名不改变。详见[服装Cap封闭](Documentation/服装Cap封闭实验.md)与[头饰闭合](Documentation/头饰闭合与安全留量.md)。

FBX放入动画参考目录，可含子目录，启动／构建动态扫描提取；原动画搜索、分类、收藏、逐帧、变速、源骨架对照及暂停换装相位保持。人物Recipe仍精确六字段version/bodyType/slots/dyes/hairStyle/hairColor、七槽位、存储键wanhu.character.wardrobe.v5。

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
```

灰驴检查覆盖964本体姿态、2892稠密有鞍骑乘姿态、70衣裤关键相位、20次物种往返与错误／释放验证。原骑乘1446、原马具1452＋484及原Horse964姿态等回归保留。报告产物mounts-m4-checks记录实际sourceSHA，浏览器只做交互，不自动生成图片。

旧review:local各入口与--full保留按需使用；生成截图、自动通过和人工视觉认可分开记录。有限采样不是全时域零穿插。尚无骆驼、上下坐骑、导航、玩家移动、地形贴蹄、袋子物理、连续身材、儿童老人、多档LOD、Unity正式坐骑运行时或GPU Crowd。本项目不部署Vercel。

文档：[V5契约](Documentation/固定基模与换装V5.md) · [服装架构](Documentation/服装生成架构.md) · [人物动画](Documentation/Mixamo动画接入.md) · [多坐骑](Documentation/多坐骑与灰驴.md) · [Unity迁移](Documentation/GPU骨骼动画迁移契约.md)。
