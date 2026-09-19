# AGENTS.md

接手读取最新 main，依次阅读 README、Documentation/玩家角色自定义与服饰分期.md、Documentation/换装工作台使用.md、Documentation/工作交接.md、男性FBX校正.md、Mixamo动画接入.md、项目概览.md、运行时人物生成架构.md、GPU骨骼动画迁移契约.md、服装生成架构.md、GitHubActions截图验收规范.md。

## 当前决定 · 衣冠工坊 V1

用户确认只靠外部 FBX 动画，淘汰全部手写程序动作对照。**不得恢复旧 Motion、Phase4A Action 或作为失败回退。** 男性已在 6627c2e 合入，女性在 V3.6 接入。现在玩家自定义优先：服饰偏写意，Web 仅为换装/外观制作与试衣，玩法在 Unity。预设是推荐而非身份，不按职业、财富、宫廷或性别锁衣服；先做好可编辑部件，再由同一 Recipe 供城市居民取样。

路径：`Recipe V4 Slots → v3/body/outfit → CharacterData → rig → CharacterViewport`；`Mixamo FBX → 离线源采样 → mixamo/retarget → 目标局部轨道 → mixamo/player`。

原 segmented / V2 二维挤出路径禁止恢复。外部人物 Mesh/贴图不得替换程序人物，但外部动画是唯一正式动画来源。静态 bind 仅用于检视，不是动画片段。

## 不得破坏

- 连续封闭、四边面主导人体；固定 20 Bone ID / Parent Map，不能随衣服/体型变化。
- 每顶点最多 2 非零权重，关节双骨，普通区尽量单骨。不得用 DoubleSide 隐藏绕序错误。
- 服装共用骨架：Rigid 单骨、BodyDerived 继承权重。不要引入衣服独立 Animator。
- 主体播放不重建 Mesh，不逐帧全身 IK；源载入/体型变化时离线烘焙。Debug CPU 蒙皮不代表生产路径。
- +X 人物右、+Y 上、+Z 前。导航负责世界位移，保留骨盆姿态内的侧摆和上下运动。
- 职业仅一次性预设。Recipe version=4（新增 bodyType=male/female，缺省 male），slots=headwear/top/bottom/shoes/back/leftHand/rightHand，height/build/palette；可选 dyes 三色、hairStyle、hairColor，缺省不改变旧配方输出。改 Slot 后 preset=custom，生成器只看 slots。
- 旧 outfit/hat/equipment 仅入口兼容；farmer+equipment=true 仍迁移到 rightHand=farmer_hoe。动画不修改/重置 DIY。
- 布料、五指、万人性能不是本轮默认范围。

## 男女模型约束

女性通过 proportions.ts 同拓扑形态场同时调整身体/衣物/关节；不能只换发型冒充女性。男性 6627c2e 的12套几何/骨架哈希由 check-body-profiles 固定，不能自动刷新基准。不要为适配女性改写男性数据。

刚性帽子/工具以源/目标骨骼锚点变换，不能把非线性体型场逐点套在工具上导致直杆弯曲。旧 auto 发式保留历史遮蔽规则；显式新发髻在帽冠下隐藏，取下恢复。新长裳为双权重分片蒙皮，没有实时布料、额外服装骨骼或程序摆动。BodyType 切换必须保留 DIY、身高、配色与当前动画相位；旧 V4 输入默认 male，女性直达默认1.66m。

目标动画导出必须含 bodyType、profileVersion；女性 calibrationProfile=female-anatomical-v1，男性仍male-anatomical-v2。两性骨骼ID和父关系相同，但不能共享未经验证的最终骨矩阵。

## 校准与动画

目录 FBX、catalog.ts、review-mixamo.ts 独立矩阵必须一致。新文件不能静默忽略。读取真实 inverse bind，不拿首帧当参考姿态；处理坐标/单位、T/A pose、Spine1 折叠。

**HeadTop_End 不是面前方向。** 已知源辅助骨段前倾 5.456°。头部直接使用相对真实 bind 的世界旋转差；不可按片段加固定抬头偏移、清零俯仰或扭曲脸部网格掩盖问题。源点头/转头必须保留。头部全四元数误差测试独立于骨段方向测试。

public/mixamo 不提交；predev/prebuild 离线提取，无外部下载/部署/源网格。外部射箭人体与弓弦/箭/业务事件分开，不借用已删除的程序事件相位宣称完成。源缺少的道具、场景、第二人物不得伪称已导入。

## Unity

迁移 SkeletonDefinition/SkinBinding/目标局部轨道/语义数据，不迁移 Three.js Mixer。缓存至少包含源 SHA、重定向版本、骨架版本、体型；不同身材不能无验证共享最终矩阵。

先单人物 SkinnedMeshRenderer 对照，再 Crowd ClipId/Phase/Speed → Animation Texture/Bone Buffer → 批量渲染。JSON 导出不是 Clip/Avatar/Blob 实现，不默认每居民独立完整 Animator/Transform 层级。

## 开发与验收

连续完成：读文档 → 实现 → check:retired/check:mesh/build/check:mixamo/check:wardrobe → GitHub Actions → 下载实际审图和连续视频 → 修正重跑 → 合入 main。不要每子步骤要求继续，不承诺回复后后台开发。

FBX 每动作正/侧/背/布线与完整关键相位；男女慢跑/射箭连续视频；男女×4外观×3身材；去帽子头部近景、DIY、快速切换、暂停/末帧、重试和导出。静态绑定不得有隐式呼吸等程序运动。

新动作按源实际接触语义审查，不沿用旧 Walk 固定相位门槛。数值通过不证明无自交，记录限制、SHA和run ID；仅文档提交可引用未变化父代码的已审截图。

临时分支验证后合 main；不强推、不覆盖并发修改。锁依赖 npm ci，文档同步。仅 Actions runner 内 Preview+Playwright+Artifact；下载并实际查看。不部署 Visual/Vercel，保留 vercel.json git.deploymentEnabled=false。

## 衣冠工坊约束

普通入口默认静态试衣；review=1 保留旧 FBX 慢跑默认。不把目录 SVG 示意当作真实模型缩略图。新增衣服实现放 wardrobe/geometry.ts，推荐/随机/导入逻辑放 wardrobe/catalog.ts；不要继续扩展按职业分支的生成器。

固定七槽位，完整上衣含领/袖/腰带。手动选择不受随机锁限制；应用预设不改体型与身材。随机复现依赖输入 Recipe、种子、锁定集与生成器版本。导入非法文件保持原角色。localStorage 单槽不是账号/云存档。

新增服饰需 Wardrobe Review 多视图、素模、体型端点、慢跑/射箭连续视频、跨体型混搭和配方导出重入。正式合并前核对实际截图对应提交，不自动更新男体基线。长摆高抬腿、翻转、贴地限制明确记录，不用 DoubleSide 或改 FBX 掩盖。
