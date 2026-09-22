# 万户 · 衣冠工坊V5、马匹与骑乘

《万户天工》3D玩家／居民换装、FBX试衣与骑乘Web Demo。两个固定成年男女、一档标准低模精度；马匹本体与人物骑乘分别预览，正式玩法留在Unity。

## 拉取与运行

Node.js >=22.12。M1已由PR #20合并，不再需要切换旧马匹分支；M2交付后也从main进入。Windows可双击Start-Local.cmd。

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
npm run dev
```

顶部保留“人物工坊／动物工坊”一级切换。动物工坊右侧增加“马匹本体／骑乘试衣”二级切换，相机位于各自预览区右上，循环播放位于底部且默认开启。

| 入口 | 用途 |
|---|---|
| 根地址 | 人物换装与原FBX试衣 |
| ?lab=horse | 马匹本体与四个实验动作 |
| ?lab=riding | 人物跨坐及停驻／步行／奔跑 |
| ?lab=riding&clip=pose&paused=1 | 静态骑姿 |
| ?lab=riding&bodyType=female&clip=Rider_Walk&paused=1 | 女性骑乘步行，初始暂停 |

## M2：人物骑乘组合

骑手直接复用当前V5人物，可切换男女、上衣、下装、鞋、帽饰、发型与配色；也可读取人物工坊保存的装扮或严格导入V5 JSON。切换男女、换装保留当前骑乘相位与马网格。骑乘页面不会静默覆盖人物工坊存档。

RiderSeat挂在马Spine，人物与马仍保持独立网格、骨架和Mixer。静态跨坐不是把站姿平移到马上；男女各自校准骨盆坐面距离与腿部方向。Rider_Idle／Rider_Walk／Rider_Run分别对应Horse_Idle／Horse_Walk／Horse_Run，由马的唯一时间游标驱动，骑手按同一相位采样。骑手轨道为本项目烘焙的姿态资产，不是新增Mixamo FBX，也不是原人物FBX的失败回退。

第一轮以裤装验收骑姿。两条连续封底裙保持可选，但跨坐可能与马背／马腹穿插，页面明确标注为骑乘试验装扮；不自动换裤、不拆裙、不删除封底。保留手持物不等于已支持骑射或工具使用。骑姿自然程度和近景衣物接触仍待用户实际验收，不能由数值绿色替代。

本轮没有上下马、马鞍、缰绳、实时IK、地形贴蹄、玩家移动、Root Motion、导航或骑乘吃草。详见[骑乘与坐骑挂接](Documentation/骑乘与坐骑挂接.md)。

## M1：独立低模马

马模型1524三角形、806逻辑顶点、25骨骼、最多双权重；硬边拆分后4572渲染顶点。栗色主体、实体鬃尾、双耳与蹄，不使用写实毛发或皮肤纹理。四个片段为Horse_Idle 3.6秒、Horse_Walk 1.2秒、Horse_Run 0.8秒、Horse_Eat 6秒；Run不是Walk倍速。

马本体页保留静态绑定、四动作、播放／暂停、重播、前后逐帧、时间／相位、变速、循环，以及六方向相机、正交／透视、素模、线框、骨架和参考网格。动作仍是原地实验，Run收腿与Eat颈根存在简化块面边界，不能视为正式移动或零滑步系统。详见[低模马与基础四足动画](Documentation/低模马与基础四足动画.md)。

## 人物生产基线

当前正式衣柜为7款上衣、5款下装、1款布鞋；body仅是内部裸模哨兵。保留10张“搭配灵感”，“基础搭配”整组已删除。男女可自由混搭，灵感卡不绑定职业。

| 类别 | 当前正式资源 |
|---|---|
| 上衣 | 干活背心、短打短褂、劳作短衣、交领常服、半臂配内衬、滚边礼衣、农户短衣 |
| 下装 | 封口短裤、日常短裙、素面长裙、劳动直裤、劳作束脚裤 |
| 鞋 | 布鞋 |

已退役guard_light_armor、archer_tunic、loose_trousers、guard_pants、archer_pants、pleated_skirt、robe_skirt、short_skirt、boots。旧配方引用这些ID会被严格导入器拒绝，不提供隐藏兼容入口。人物工坊保留种子、锁定、撤销、保存、文件往返、发式帽饰和配色。

服装Cap已推广至当前全部衣裤；所有正式服饰自身零开放边，保留sealedInterfaces，不焊接人体、不更改原坐标与权重、不新增逻辑顶点。上衣封口用主布primary，长裤和裙腰用原裤布／腰头secondary。两条真裙仍是连续裙壳与固定封底。帽饰除none外自身也必须闭合；轻盔、包巾、方冠用帽身色底盖，额前束带是封闭薄实体，草帽和玉簪保留原结构。详细边界见[服装Cap封闭](Documentation/服装Cap封闭实验.md)与[头饰闭合](Documentation/头饰闭合与安全留量.md)。

FBX放入动画参考目录，可含子目录；重启／构建动态扫描提取，不固定文件总数。原人物动画搜索、分类、收藏、逐帧、变速、源骨架对照和暂停换装相位保持不变。

## 数据与职责

Recipe V5 → 资产注册 → 独立服饰网格 → 作者接口封闭 → 固定皮肤覆盖 → 一个蒙皮网格 → 当前基模20骨骼。人物与马均最多双权重、米制、+Z向前。骑乘只在组合层挂接两者，不新增Recipe字段或槽位。

服装几何wanhu-modular-garments-v9、皮肤wanhu-skin-cage-v3、绑定wanhu-fixed-bodies-v1、头饰wanhu-headwear-closed-v3。资源版本不升级配方：Recipe仍精确六字段version/bodyType/slots/dyes/hairStyle/hairColor，只读取wanhu.character.wardrobe.v5，未知／缺失／旧字段拒绝。源人体各524三角形，保护签名不刷新。

## 自动检查与按需审图

三条正式工作流保持不变：Build & Core Checks负责编译与核心契约；Targeted Numeric Checks按改动范围执行服饰、Mixamo、相交、马及骑乘检查；Manual Visual Review只手动生成指定范围截图。Package或workflow变化仍触发完整数值回归，不降低原门槛。

```sh
npm run check:riding
# 真实桌面交互检查，不截图
npx playwright install chromium
npm run check:riding-browser
npm run check:horse
# 用户明确需要马本体视觉审查时
npm run review:local -- --horse
```

骑乘数值检查包含男女三动作各241相位、70套现役衣裤组合、挂点与实际蒙皮、时间、换装和释放。浏览器检查覆盖入口、配方、性别／换装保相位、相机、播放与循环，不自动截图。riding-m2-checks产物记录实际受测SHA。

旧review:local的--character、--wardrobe、--lightwear、--skirts、--mixamo、--horse及--full仍保留按需使用。截图生成、自动通过和人工视觉验收分开记录。低模膝肘折面、裙底暗面及极端动作有适用边界，不承诺所有连续时刻零穿插。

尚无连续身材、儿童老人、多档LOD、通用外部服装导入器、Unity正式骑乘运行时或GPU Crowd。此项目不部署Vercel。

文档：[V5契约](Documentation/固定基模与换装V5.md) · [服装架构](Documentation/服装生成架构.md) · [人物动画](Documentation/Mixamo动画接入.md) · [骑乘契约](Documentation/骑乘与坐骑挂接.md) · [Unity迁移](Documentation/GPU骨骼动画迁移契约.md)。
