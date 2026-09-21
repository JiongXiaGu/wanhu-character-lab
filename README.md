# 万户 · 衣冠工坊 V5

《万户天工》3D玩家／居民换装与FBX试衣Web Demo。两个固定成年男女基模、一档标准低模精度；重点是服饰轮廓、混搭、染色与动画，玩法留在Unity。

## 当前：第二批轻便服饰与头饰修正

新增干活背心 `work_vest`、短打短褂 `short_work_jacket`、及膝短裤 `short_trousers`、短下裳·分片裙裤 `short_skirt`。前两件真正保留裸露上臂，后两件保留原小腿皮肤；不把新款做成同一长袖／长裤换色。短下裳是随两腿分开运动的A字裙裤式简化，不是连续软布短裙。

轻盔、包巾、方冠、草帽和额前束带采用固定安全留量；允许帽型偏大，避免帽壳被头发贯穿。保留既有戴包覆帽隐藏额外发髻、取帽恢复同一发型的规则；没有按发型压发或新增隐藏适配表。簪饰不作为帽壳放大。

四件新资产分别为102／174／144／176三角形。男女基础皮肤仍各524三角形；背心＋短裤＋布鞋＋默认发髻、不带装备的完整角色为男791／女793三角形。数字指三角形，不是逻辑或渲染顶点。完整制作、覆盖和预算见[轻便服饰与头饰安全留量](Documentation/轻便服饰与头饰安全留量.md)，正式运行与实际看图范围见[工作交接](Documentation/工作交接.md)和[PR #17](https://github.com/JiongXiaGu/wanhu-character-lab/pull/17)。

原7上衣／7下装保留，现为9上衣／9下装；原8套推荐保留，加夏日劳作／轻装围裳共10套。第一批劳作短衣、交领常服、半臂配内衬、直筒布裤与束脚行动裤保持原制作与计数，详见[第一批记录](Documentation/服饰第一批制作与验收.md)。PR #15、#16均已完成；失败PR #12不是制作基础。

## 拉取与运行

Node.js >=22.12；也可双击 `Start-Local.cmd`。已有工作区执行：

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
npm run dev
```

打开终端输出的本机地址。左栏选成年男女和推荐搭配，右栏选择服饰、发式、头饰及三色；推荐不会强制改变性别。保留农户／卫兵／弓手、跨男女混搭、发色、种子、锁定、撤销、浏览器保存和严格Recipe文件导入导出。

FBX放入 `动画参考/`（允许子目录），重启或构建会自动扫描提取。当前23份不是上限，用户上传FBX与参考模型不修改。动作面板保留搜索／分类／收藏、上下一条、暂停逐帧、变速与源骨架对照；换装保持暂停相位。

## 当前架构与数据边界

Recipe V5 → 固定基模／资产注册 → 独立衣裤鞋 → 固定皮肤覆盖 → 一个装配后蒙皮网格 → 同一套骨架。`patterns.ts`负责注册，`assets/`负责款式网格与静态权重，`assembly.ts`负责覆盖和装配，`adornments.ts`负责冠髻，`headwear-fit.ts`负责一次性帽壳制作留量。

服装几何为 `wanhu-modular-garments-v6`，皮肤为 `wanhu-skin-cage-v3`，绑定为 `wanhu-fixed-bodies-v1`。资源v6不等于Recipe V6：配方仍精确六字段 `version/bodyType/slots/dyes/hairStyle/hairColor`，只读取 `wanhu.character.wardrobe.v5`。旧版本、缺字段和未知字段明确拒绝，不做兼容迁移。

20骨骼语义、每顶点最多双权重、固定男女映射保持。上衣包含自身领袖、门襟、腰带，不新增内衬槽位。没有源人体衣面复制、动作相关删面、实时布料、逐帧碰撞、全身IK或独立服装Animator。

## 本地快速审图

一次安装浏览器后，可按任务选择入口：

```sh
npx playwright install chromium
npm run review:local
npm run review:local -- --wardrobe
npm run review:local -- --lightwear
```

各入口加 `--full` 开启完整矩阵。默认入口保留32／156张人体与裤装形变检查；`--wardrobe`聚焦第一批，`--lightwear`聚焦露肤短装、帽发关系、新旧混搭与动作。输出图必须实际打开，不把脚本成功当作美术签署。执行环境失败如实报告；静态源码几何重建只能作为明确标注的辅助图，不能冒充网页／FBX。

本批容器及本地图像打开曾持续超时，最终通过只读PDF证据页实际查看Actions截图。PDF只是放置原截图，不是另一种模型渲染或生成图片。

## 自动检查与交付边界

保留 `check:retired`、`check:mesh`、`build`、`check:mixamo`、`check:wardrobe`、`check:tailoring`；`check:mesh`包含第一批与第二批资产契约。六条正式Actions保留：Build、Character Model Review、Mixamo Retarget Review、Wardrobe Review、Tailoring V2 Review、Modular Garment Review。第二批矩阵追加到Modular，不替换旧矩阵；衣柜10套推荐的证据为177张，原143张及旧搭配ID下限保留，另有固定V5交互检查。

短装使下装源帧／中点贯穿检查扩展至20,180个样本；检测算法、容差、压力动作与原采样不缩减。源人体、绑定保护签名、上传FBX和参考模型没有为新衣服修改。仅文档收尾不改变受测运行代码。

仍有膝肘硬折、裆底暗面、坐姿裤口尖折和裙裤分片感；有限图片抽查不是所有连续时刻零穿插保证。没有儿童老人、连续身材、多档LOD、完整长袍大裙摆、通用外部Mesh导入器、Unity正式运行时或GPU Crowd。不部署Vercel／Visual。

文档：[V5契约](Documentation/固定基模与换装V5.md) · [衣柜使用](Documentation/换装工作台使用.md) · [服装架构](Documentation/服装生成架构.md) · [动画](Documentation/Mixamo动画接入.md) · [Unity迁移](Documentation/GPU骨骼动画迁移契约.md)。
