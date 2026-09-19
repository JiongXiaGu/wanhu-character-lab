# AGENTS.md

接手先读取最新 main，依次阅读：

1. Documentation/工作交接.md
2. Documentation/Mixamo动画接入.md
3. Documentation/项目概览.md
4. Documentation/运行时人物生成架构.md
5. Documentation/GPU骨骼动画迁移契约.md
6. Documentation/服装生成架构.md
7. Documentation/动作系统架构.md
8. Documentation/GitHubActions截图验收规范.md

历史 V3/Phase4A 验收只证明对应提交。不要从旧对话猜当前状态。

## 当前正式路径

`Preset → Recipe V4 Slots → v3/body → v3/outfit → CharacterData → v3/rig → CharacterViewport`

`Mixamo FBX → scripts/lib/mixamo-fbx → 紧凑源轨道 → mixamo/retarget → 当前体型局部轨道 → mixamo/player`

types/cage/body/outfit 是生成层；rig 是 Three.js 验证适配。历史 segmented / V2 二维挤出路径不得恢复。当前主方向为外部制作动画，不默认继续扩展手写动作；旧 Motion/Phase4A 保留回归对照。

**2026-09-19 更新：禁止外部人物 Mesh，不禁止外部动画。** 人体、衣服、装备仍程序生成；用户上传 Mixamo 动画可离线提取/重定向。旧文档中的「不使用外部 FBX/GLB 人物或动作」「不依赖外部动画」仅代表旧阶段，动画部分已由本决策和 Mixamo 文档替代。

## Recipe V4 / DIY

持久化：version=4，preset=farmer/guard/archer/body/custom，slots=headwear/top/bottom/shoes/back/leftHand/rightHand，加 height/build/palette。

职业只是一次性预设，不是生成分支。修改 Slot 后 preset=custom，outfit.ts 必须按 Slot 判断。旧 outfit/hat/equipment 仅迁移兼容；farmer+equipment=true 仍迁移成 rightHand=farmer_hoe。导入动画不得悄悄改写配方或重置装备。

## 不得破坏

- 连续封闭、四边面主导的人体，不用相交块冒充蒙皮；不恢复外部人物库。
- 固定 20 Bone ID / Parent Map，不随职业、衣服、体型变化。
- 每顶点最多 2 个非零权重，普通区域尽量单骨，关节才双骨混合。
- 主体动画不逐帧重建 Mesh，不逐帧全身 IK；外部重定向在载入/体型变化时烘焙。
- +X 人物右、+Y 上、+Z 前；原地动作由导航接管世界位移。
- 服装共用骨架；Rigid Attachment 单骨，BodyDerived 继承权重。不用 DoubleSide 掩盖绕序。
- 结构布线/源骨架为调试路径，CPU 开销不代表生产路径。
- 布料和五指不属于默认范围，低面数不等于 Unity 万人性能通过。

## 外部动画

目录 FBX、catalog.ts 和独立 review-mixamo.ts 矩阵必须一致；新增文件不能静默忽略。

读取真实 inverse bind，不以首帧代替参考姿态。映射需处理单位、左右轴、T/A pose 和 Spine1 折叠。生成 public/mixamo 不提交；predev/prebuild 离线提取，不联网下载、部署或携带源网格/贴图。

外部射箭的人体动作与弓弦/箭/业务事件分开。不能借用旧程序事件相位宣称完整射箭完成。源文件没包含的道具、第二人物、场景不得伪称已导入。

## Unity

迁移 SkeletonDefinition、SkinBinding、目标局部轨道、AnimationState 与语义数据，不迁移 Three.js Mixer。

先单人 SkinnedMeshRenderer 对照，再做 Crowd ClipId/Phase/Speed → Animation Texture/Bone Buffer → 批量渲染。不得默认每居民独立完整 Animator/骨骼层级。

动画缓存至少含源 SHA、重定向版本、骨架版本、体型；不同身材不能未经验证共享最终骨骼矩阵。JSON 导出不是 Unity Clip/Avatar/Blob 实现。

## 开发与验收

连续完成：读文档 → 实现 → 自动检查 → GitHub Actions → 下载实际审图/连续视频 → 修正重跑 → 合入 main。不要每子步骤要求用户说继续，回复后不得声称仍后台开发。

每次相关改动运行 check:mesh、check:actions、build、check:mixamo、真实浏览器交互。每个动作须有正/侧/背/布线和关键相位；慢跑/射箭看完整时间过程，不能只看最好看的定格或绿色任务。

原程序 Walk 相位门槛继续保留：0% 右脚前触地右臂后，25% 左脚前摆，50% 左脚前触地，75% 右脚前摆。外部动作起点不同，按实际源接触语义审查，不强迫匹配旧相位。

自动测试不证明无自交/穿模；明确范围、残余问题、提交 SHA 与 run ID。暂存分支验证后合入 main，不强推、不覆盖并发提交。依赖固定 package-lock 和 npm ci；文档同步更新。

## 禁止视觉部署

只允许 GitHub Actions runner 内 Vite Preview + Playwright + Artifact。必须下载实际查看，不要求用户打开线上临时站点。

不部署 Visual/Vercel/Preview Site，不新增部署 workflow。vercel.json 仅保留 git.deploymentEnabled=false。用户拉 main 本地运行或看 Actions 产物。
