# 万户 · 衣冠工坊 V5与马匹实验

《万户天工》3D玩家／居民换装与FBX试衣Web Demo。人物保持两个固定成年男女基模、一档标准低模精度；新增独立的Horse Lab验证马本体与四足动画，玩法仍留在Unity。

## Phase M1：独立低模马

任务分支为feat/phase-m1-horse-lab-20260921。马匹候选需要用户视觉验收后才能决定合并，不能直接拉取旧main后误认为Horse Lab已经发布。

当前马模型为1524三角形、806逻辑顶点、25骨骼、每点最多双权重；硬边拆点后为4572渲染顶点。栗色主体、实体鬃尾、清楚的耳和蹄，不使用写实毛发／皮肤纹理。四个可循环片段为Horse_Idle（3.6秒）、Horse_Walk（1.2秒）、Horse_Run（0.8秒）、Horse_Eat（6秒）。Run有独立的收伸腿和相位，不是Walk调快。

```sh
git fetch origin
git switch feat/phase-m1-horse-lab-20260921
git pull --ff-only origin feat/phase-m1-horse-lab-20260921
npm ci
npm run dev
```

打开终端地址，使用顶部中央“人物工坊 / 动物工坊”一级切换器进入动物工坊；当前动物工坊直接进入Horse Lab。也可以在地址后加?lab=horse。Horse Lab有播放／暂停、重播、前后逐帧、时间／相位、循环播放、变速，正／左／右／背／前后三分之四相机，以及正交／透视、素模、线框、骨架和参考网格。人物和马的相机工具条统一放在各自预览区右上角；人物与马的动画循环选项都在底部播放区，默认开启循环。

```sh
npm run check:horse
npx playwright install chromium
npm run review:local -- --horse
```

horse入口复用原review:local启动器。正式马匹检查为Character Model Review中的独立Horse M1 Review job，产物horse-m1-review与人物证据分开；原六条永久工作流和全部原人物／服饰矩阵保留。实际下载、人工查看与受测SHA见[工作交接](Documentation/工作交接.md)和对应PR验收评论；检查生成图片不等于人工审完。

没有骑乘、Rider动画、上／下马、马鞍／缰绳、Root Motion正式移动、实时IK、地形贴蹄、其他动物或AI行为。马不进入Recipe V5或七槽位。人物侧仅把原时间游标等价提取为共享clip-clock，FBX／重定向、人体、20骨骼绑定、裙装和换装契约不改。详见[低模马与基础四足动画](Documentation/低模马与基础四足动画.md)。

## 人物生产基线：精简衣柜

当前正式衣柜只保留轮廓或用途有明显差异的资源。UI中有7款上衣、5款下装、1款鞋；裸模用的body仍是内部协议值，但不作为正常鞋款展示。“基础搭配”入口已删除，只保留10张“搭配灵感”，灵感卡不会绑定职业，也不会限制玩家自由换装。

| 类别 | 当前正式资源 |
|---|---|
| 上衣 | 干活背心、短打短褂、劳作短衣、交领常服、半臂配内衬、滚边礼衣、农户短衣 |
| 下装 | 封口短裤、日常短裙、素面长裙、劳动直裤、劳作束脚裤 |
| 鞋 | 布鞋 |

本轮正式退役9个资产ID：guard_light_armor、archer_tunic、loose_trousers、guard_pants、archer_pants、pleated_skirt、robe_skirt、short_skirt、boots。它们已从类型、注册表、UI、几何分派、推荐组合和回归脚本移除，不保留隐藏兼容入口。旧Recipe V5若引用这些ID会被严格导入器拒绝，需要重新搭配后导出。

短裤仍采用腰口与双裤脚直接Cap；true_short_skirt和long_skirt仍是独立连续裙壳。布鞋是唯一正式鞋款，双脚踝继续直接Cap。历史制作与旧资产数据保留在Git历史和标记为历史的制作文档中，不再作为当前运行时事实。

## 人物拉取与运行

Node.js >=22.12；也可双击Start-Local.cmd。仅体验已合并人物版本时使用main；M1未合并前用上面的任务分支。

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
npm run dev
```

右栏“下装”可选封口短裤、日常短裙、素面长裙、劳动直裤、劳作束脚裤；鞋只显示布鞋。男女都能自由交叉搭配，搭配灵感不强制改变性别。保留发式、帽饰、发色、种子、锁定、撤销、浏览器保存和严格V5文件导入导出。

当前先在“干活背心＋封口短裤＋布鞋”验证全封闭 Cap：背心领口/双袖窿/腰口、短裤双裤脚/腰口、布鞋双脚踝都直接封面，让对应身体部位穿过 Cap。其余服饰暂不推广，待真实截图确认中远景观感后再决定统一规范。

FBX放入动画参考目录（允许子目录），重启或构建会动态扫描提取。当前23份不是上限；搜索、分类、收藏、逐帧、变速、源骨架对照及暂停换装相位保持不变。

## 人物数据与职责

Recipe V5 → patterns注册 → 独立服饰网格 → 固定皮肤覆盖 → 一个蒙皮网格 → 当前基模的20骨骼。每顶点最多双权重。patterns只注册；assets拥有专用版型与权重；assembly负责覆盖与装配；adornments负责冠髻。

服装几何为wanhu-modular-garments-v8，皮肤wanhu-skin-cage-v3，绑定wanhu-fixed-bodies-v1。资源v8不改变配方：Recipe仍精确六字段version/bodyType/slots/dyes/hairStyle/hairColor，只读取wanhu.character.wardrobe.v5。旧版本、未知和缺失字段拒绝，不建立兼容fallback。源人体各524三角形，保护签名不刷新。

## 人物快速审图与正式回归

```sh
npm run review:local
npm run review:local -- --wardrobe
npm run review:local -- --lightwear
npm run review:local -- --skirts
npm run review:local -- --skirts --full
```

所有原入口保留。裙装快速入口160张视口＋工作台，完整入口412张＋工作台；16次真实UI换装检查暂停相位。图片生成不等于实际查看。本轮马匹使用GitHub runner真实浏览器截图，不冒充执行者本机网页成功，也不以源码重建图替代动画证据。

保留check:retired、check:mesh、build、check:mixamo、check:wardrobe、check:tailoring和check:skirts。原六条正式Actions不减少；裙装并行job仍在Modular Garment Review。所有回归矩阵改为引用当前正式衣柜，不再人为保留已退役资产的截图或固定样本数。源帧／中点贯穿继续覆盖当前全部下装、男女基模与关键动作，算法和阈值不因目录瘦身而放宽。

低模膝肘折面、裙底暗面与极端动作穿插仍有边界；不承诺实时布料表现或所有连续时刻零穿模。尚无通用外部服装导入器、连续身材、多档LOD、儿童老人、Unity正式运行时或GPU Crowd。不部署Vercel／Visual。

文档：[V5契约](Documentation/固定基模与换装V5.md) · [服装架构](Documentation/服装生成架构.md) · [人物动画](Documentation/Mixamo动画接入.md) · [Unity迁移](Documentation/GPU骨骼动画迁移契约.md)。
