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

horse入口复用`review:local`。默认CI只在马匹相关代码变化时执行`npm run check:horse`数值/结构检查，不自动生成104张视觉矩阵；需要看马的外形或动画时，手动运行`npm run review:local -- --horse`或触发Manual Visual Review。截图生成不等于视觉验收。

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

用户认可“干活背心＋封口短裤＋布鞋”及背心主布色后，Cap已推广到当前全部衣裤：其余上衣的领口/双袖口/腰口、两种长裤的腰口/双裤脚、两条连续裙的腰口均补齐。所有正式服饰自身必须零开放边，接口仍保留为sealedInterfaces；不焊接人体、不改变原坐标或权重、不新增逻辑顶点。上衣封口跟随主布primary，长裤和裙腰跟随原裤布/腰头secondary，不用皮肤色或额外的内衬色。已认可的三件资产保持不变，完整预算和验收边界见[服装Cap封闭](Documentation/服装Cap封闭实验.md)。

头饰也采用闭合规则：轻盔、包巾、方冠补齐与帽身同色的底盖；额前束带保持前额局部造型但改成封闭薄实体；草帽和玉簪沿用原闭合结构。除none外正式头饰自身必须零开放边。帽底允许头部/头发作为固定制作接口穿过，但帽侧、帽顶仍保持原帽发安全检查。详见[头饰闭合与安全留量](Documentation/头饰闭合与安全留量.md)。

FBX放入动画参考目录（允许子目录），重启或构建会动态扫描提取。当前23份不是上限；搜索、分类、收藏、逐帧、变速、源骨架对照及暂停换装相位保持不变。

## 人物数据与职责

Recipe V5 → patterns注册 → 独立服饰网格 → 作者接口封闭 → 固定皮肤覆盖 → 一个蒙皮网格 → 当前基模的20骨骼。每顶点最多双权重。patterns只注册；assets拥有专用版型、权重和封口；assembly负责覆盖与装配；adornments负责冠髻。

服装几何为wanhu-modular-garments-v9，皮肤wanhu-skin-cage-v3，绑定wanhu-fixed-bodies-v1。资源v9不改变配方：Recipe仍精确六字段version/bodyType/slots/dyes/hairStyle/hairColor，只读取wanhu.character.wardrobe.v5。旧版本、未知和缺失字段拒绝，不建立兼容fallback。源人体各524三角形，保护签名不刷新。

## 自动检查与按需视觉 Review

日常开发默认不跑大规模截图矩阵。自动化分为三条正式工作流：

- **Build & Core Checks**：每次 PR / main push 执行编译、退役契约和核心网格/数据检查。
- **Targeted Numeric Checks**：根据实际改动路径，只执行相关的 Wardrobe、Mixamo、Tailoring 或 Horse 数值检查。
- **Manual Visual Review**：仅手动触发；按 `character / wardrobe / lightwear / skirts / mixamo / horse / all` 选择截图范围，可选完整矩阵。

本地需要视觉复核时使用：

```sh
npm run review:local -- --character
npm run review:local -- --wardrobe
npm run review:local -- --skirts
npm run review:local -- --mixamo
npm run review:local -- --horse
# 明确需要完整视觉矩阵时再追加 --full
```

视觉正确性的最终判断由人完成。AI/CI默认负责代码、拓扑、权重、协议、数值、动画采样和交互契约；不会因为每次代码修改自动生成并逐张判断数百张图片。用户明确要求视觉审查时，再生成截图并进行人工检查。历史大矩阵脚本仍保留，可用于阶段发布或专项回归。
低模膝肘折面、裙底暗面与极端动作穿插仍有边界；不承诺实时布料表现或所有连续时刻零穿模。尚无通用外部服装导入器、连续身材、多档LOD、儿童老人、Unity正式运行时或GPU Crowd。不部署Vercel／Visual。

文档：[V5契约](Documentation/固定基模与换装V5.md) · [服装架构](Documentation/服装生成架构.md) · [人物动画](Documentation/Mixamo动画接入.md) · [Unity迁移](Documentation/GPU骨骼动画迁移契约.md)。
