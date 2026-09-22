# 万户 · 衣冠工坊V5、马匹与骑乘

《万户天工》3D玩家／居民换装、FBX试衣与骑乘Web Demo。两个固定成年男女、一档标准低模精度。马本体、可切换马鞍和骑乘可分别预览，正式玩法仍留在Unity。

## 拉取与运行

Node.js >=22.12。M1马匹与M2骑乘已合并，M3交付后同样从main进入，不切换旧任务分支。Windows也可双击Start-Local.cmd。

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
npm run dev
```

顶部“人物工坊／动物工坊”不变；动物内部仅“马匹本体／骑乘试衣”两种模式，不新增马具装配页。相机在预览右上，底部循环默认开启。

| 入口 | 用途 |
|---|---|
| 根地址 | 人物换装与原FBX试衣 |
| ?lab=horse | 马本体、可选马鞍和四个马动作；默认无鞍 |
| ?lab=riding | 人物骑乘；直接进入默认普通马鞍 |
| ?lab=riding&saddle=travel&clip=pose&paused=1 | 旅行马鞍静态骑姿 |
| ?lab=riding&saddle=simple&bodyType=female&clip=Rider_Walk&paused=1 | 普通马鞍、女性步行骑姿，初始暂停 |

## M3：选马、选马鞍

两个页面右侧共用“坐骑”区，只有马匹和马鞍两个选择。当前马匹只有栗色马；马鞍为无、普通、旅行三项。普通款包含曲面鞍垫、鞍座、简化蹬带／脚蹬、辔头；旅行款再加入双侧行囊与后卷毯，全部一起切换，不拆袋子等子槽位。

骑乘右侧顺序为坐骑 → 骑手与装扮 → 骑乘动作 → 结构检查。普通／旅行换鞍保留人物、马、缰绳网格、配方、相机和播放进度。不同鞍面使用自己的坐点，不把站姿平移到马背。

缰绳在马与人物采样后，同帧连接马嘴和掌心，并经颈侧导向避开马颈。两根低模绳固定200三角形缓冲，只更新原顶点，不做绳索物理、手部IK或逐帧创建几何。M3微调了手臂与块面手掌方向，没有新增手指骨骼。

选无马鞍时不显示马具、骑手或缰绳，骑乘控制禁用并保留原进度；再装鞍恢复。马本体页无鞍也能播放所有四动作；有鞍无骑手只显示辔头，不生成悬空持缰绳。二级模式切换携带当前选择，因此从自由马进入骑乘需主动选鞍。详见[马鞍与缰绳](Documentation/马鞍与缰绳.md)。

## 人物骑乘组合

骑手复用当前V5人物，可换男女、衣裤、鞋、帽饰、发型配色；可只读载入人物工坊保存装扮，或严格导入V5 JSON。换装和男女切换保持当前骑乘相位与马网格，握绳点重新挂到新人物手骨；不会静默覆盖人物工坊存档。

人20骨与马25骨保持各自网格、骨架和Mixer；RiderSeat跟随Spine。男女分别校准骨盆坐面距离与腿部方向。Rider_Idle／Walk／Run配Horse_Idle／Walk／Run，马拥有唯一时间游标，骑手按同一相位采样。骑手轨道是本项目烘焙资产，不是新增Mixamo FBX或原FBX失败回退。

裤装为骑乘验收基准。两条连续封底裙保持可选但可能与马背、马腹或马具穿插；不自动换裤、不拆裙、不删封底。手持物与持缰可能冲突，保持原装扮并显示提示。脚蹬是简化装饰，不保证脚掌精确接触；手掌没有手指弯曲，不能宣称精确握拳。新马鞍和缰绳外观仍需用户验收。

尚无上下马、绳索／布料物理、实时IK、地形贴蹄、玩家移动、Root Motion正式移动、导航、骑射或骑乘吃草。详见[骑乘与坐骑挂接](Documentation/骑乘与坐骑挂接.md)。

## 独立低模马

马本体1524三角形、806逻辑顶点、25骨骼、最多双权重，硬边拆点后4572渲染顶点。马鞍、辔头和缰绳的面数另计，不混入本体统计。栗色主体、实体鬃尾、双耳与蹄，无写实毛发或皮肤纹理。

四片段Horse_Idle 3.6秒、Horse_Walk 1.2秒、Horse_Run 0.8秒、Horse_Eat 6秒保持；Run不是Walk倍速。保留静态绑定、逐帧、变速、时间／相位、循环、六方向、正交／透视、素模、线框、骨架和参考网格。动作仍是原地实验，有低模关节／颈根边界，不是正式移动或零滑步系统。详见[低模马与基础四足动画](Documentation/低模马与基础四足动画.md)。

## 人物生产基线

正式衣柜7上衣、5下装、1布鞋；body仅内部裸模哨兵。10张搭配灵感保留，基础搭配整组已删除，男女自由混搭不绑职业。

| 类别 | 当前资源 |
|---|---|
| 上衣 | 干活背心、短打短褂、劳作短衣、交领常服、半臂配内衬、滚边礼衣、农户短衣 |
| 下装 | 封口短裤、日常短裙、素面长裙、劳动直裤、劳作束脚裤 |
| 鞋 | 布鞋 |

guard_light_armor、archer_tunic、loose_trousers、guard_pants、archer_pants、pleated_skirt、robe_skirt、short_skirt、boots已退役；旧配方引用它们会被拒绝，不设隐藏兼容。人物工坊保留种子、锁定、撤销、保存、文件往返、发式帽饰和配色。

全部正式衣裤Cap封闭，保留sealedInterfaces，不焊接人体或改变原权重。上衣封口用primary，长裤和裙腰用原裤布／腰头secondary；真裙保留连续壳和固定封底。除none外帽饰自身也闭合，仅指定帽底允许固定头发接触。详见[服装Cap封闭](Documentation/服装Cap封闭实验.md)及[头饰闭合](Documentation/头饰闭合与安全留量.md)。

FBX放入动画参考目录，可带子目录，启动／构建动态扫描提取；原搜索、分类、收藏、逐帧、变速、源骨架对照和暂停换装相位保持不变。

## 数据与职责

Recipe V5 → 资产注册 → 独立服饰网格 → 作者接口封闭 → 固定皮肤覆盖 → 一个蒙皮网格 → 当前基模20骨骼。米制、+Z前、最多双权重。骑乘只组合人物和马，马鞍不增加人物字段或槽位。

服装wanhu-modular-garments-v9、皮肤wanhu-skin-cage-v3、绑定wanhu-fixed-bodies-v1、头饰wanhu-headwear-closed-v3保持。马具wanhu-saddles-m3-v1和骑姿wanhu-rider-pose-m3-v1不升级配方：V5仍精确六字段version/bodyType/slots/dyes/hairStyle/hairColor，只读wanhu.character.wardrobe.v5，未知／缺失／旧字段拒绝。源人体各524三角形，保护签名不刷新。

## 自动检查与按需审图

三条正式工作流：Build & Core Checks；按路径执行的Targeted Numeric Checks；仅手动的Manual Visual Review。Package／workflow变化仍触发完整数值回归，不降低原门槛。

```sh
npm run check:saddles
npm run check:riding
npm run check:horse
# 真实桌面交互，不截图
npx playwright install chromium
npm run check:riding-browser
npm run check:saddles-browser
# 用户明确要求马本体视觉审查时再运行
npm run review:local -- --horse
```

马具检查覆盖1452个有鞍骑乘相位、484个独立马动作相位、闭合壳、端点、采样中心线穿越、none与资源生命周期；原骑乘仍保留1446稠密姿态和70衣裤组合。当前报告产物riding-m3-checks记录实际sourceSHA；浏览器检查不自动生成图片。

原review:local各入口与--full按需保留。截图生成、自动通过和人工验收必须分开，不承诺所有连续时刻零穿插或低模手指／脚蹬精确接触。尚无连续身材、儿童老人、多档LOD、外部服装导入器、Unity正式坐骑运行时或GPU Crowd；不部署Vercel。

文档：[V5契约](Documentation/固定基模与换装V5.md) · [服装架构](Documentation/服装生成架构.md) · [人物动画](Documentation/Mixamo动画接入.md) · [骑乘契约](Documentation/骑乘与坐骑挂接.md) · [马具契约](Documentation/马鞍与缰绳.md) · [Unity迁移](Documentation/GPU骨骼动画迁移契约.md)。
