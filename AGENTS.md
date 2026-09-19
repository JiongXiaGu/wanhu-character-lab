# AGENTS.md

接手读取最新 main，依次阅读 README、Documentation/工作交接.md、男性FBX校正.md、Mixamo动画接入.md、项目概览.md、运行时人物生成架构.md、GPU骨骼动画迁移契约.md、服装生成架构.md、GitHubActions截图验收规范.md。

## 当前决定 · V3.5

用户确认只靠外部 FBX 动画，淘汰全部手写程序动作对照。**不得恢复旧 Motion、Phase4A Action 或作为失败回退。** 当前先验收男性居民；女性角色是下一轮，不能顺手扩展。

路径：`Recipe V4 Slots → v3/body/outfit → CharacterData → rig → CharacterViewport`；`Mixamo FBX → 离线源采样 → mixamo/retarget → 目标局部轨道 → mixamo/player`。

原 segmented / V2 二维挤出路径禁止恢复。外部人物 Mesh/贴图不得替换程序人物，但外部动画是唯一正式动画来源。静态 bind 仅用于检视，不是动画片段。

## 不得破坏

- 连续封闭、四边面主导人体；固定 20 Bone ID / Parent Map，不能随衣服/体型变化。
- 每顶点最多 2 非零权重，关节双骨，普通区尽量单骨。不得用 DoubleSide 隐藏绕序错误。
- 服装共用骨架：Rigid 单骨、BodyDerived 继承权重。不要引入衣服独立 Animator。
- 主体播放不重建 Mesh，不逐帧全身 IK；源载入/体型变化时离线烘焙。Debug CPU 蒙皮不代表生产路径。
- +X 人物右、+Y 上、+Z 前。导航负责世界位移，保留骨盆姿态内的侧摆和上下运动。
- 职业仅一次性预设。Recipe version=4，slots=headwear/top/bottom/shoes/back/leftHand/rightHand，height/build/palette。改 Slot 后 preset=custom，生成器只看 slots。
- 旧 outfit/hat/equipment 仅入口兼容；farmer+equipment=true 仍迁移到 rightHand=farmer_hoe。动画不修改/重置 DIY。
- 布料、五指、万人性能不是本轮默认范围。

## 校准与动画

目录 FBX、catalog.ts、review-mixamo.ts 独立矩阵必须一致。新文件不能静默忽略。读取真实 inverse bind，不拿首帧当参考姿态；处理坐标/单位、T/A pose、Spine1 折叠。

**HeadTop_End 不是面前方向。** 已知源辅助骨段前倾 5.456°。头部直接使用相对真实 bind 的世界旋转差；不可按片段加固定抬头偏移、清零俯仰或扭曲脸部网格掩盖问题。源点头/转头必须保留。头部全四元数误差测试独立于骨段方向测试。

public/mixamo 不提交；predev/prebuild 离线提取，无外部下载/部署/源网格。外部射箭人体与弓弦/箭/业务事件分开，不借用已删除的程序事件相位宣称完成。源缺少的道具、场景、第二人物不得伪称已导入。

## Unity

迁移 SkeletonDefinition/SkinBinding/目标局部轨道/语义数据，不迁移 Three.js Mixer。缓存至少包含源 SHA、重定向版本、骨架版本、体型；不同身材不能无验证共享最终矩阵。

先单人物 SkinnedMeshRenderer 对照，再 Crowd ClipId/Phase/Speed → Animation Texture/Bone Buffer → 批量渲染。JSON 导出不是 Clip/Avatar/Blob 实现，不默认每居民独立完整 Animator/Transform 层级。

## 开发与验收

连续完成：读文档 → 实现 → check:retired/check:mesh/build/check:mixamo → GitHub Actions → 下载实际审图和连续视频 → 修正重跑 → 合入 main。不要每子步骤要求继续，不承诺回复后后台开发。

FBX 每动作正/侧/背/布线与完整关键相位；慢跑/射箭连续视频；男性4外观×3体型；去帽子头部近景、DIY、快速切换、暂停/末帧、重试和导出。静态绑定不得有隐式呼吸等程序运动。

新动作按源实际接触语义审查，不沿用旧 Walk 固定相位门槛。数值通过不证明无自交，记录限制、SHA和run ID；仅文档提交可引用未变化父代码的已审截图。

临时分支验证后合 main；不强推、不覆盖并发修改。锁依赖 npm ci，文档同步。仅 Actions runner 内 Preview+Playwright+Artifact；下载并实际查看。不部署 Visual/Vercel，保留 vercel.json git.deploymentEnabled=false。
