# Wanhu Character Lab · V3.3

《万户天工》低多边形人物网页实验台。使用同一连续人体、固定骨架和运行时生成规则，支持农户、卫兵、弓手、基础人体与 Slot DIY。

Phase 4A 现在包含 17 个可播放 Action：10 项劳动/搬运，7 项射箭流程、分段与姿势变体；原有 6 个基础 Motion 保留。阶段细节与限制见 [Phase4A 使用与验收](Documentation/Phase4A使用与验收.md)。

## 本地使用

安装 Node.js 22.12+。拉取 main 后双击根目录 `Start-Local.cmd`，或手动运行：

```sh
npm ci
npm run dev
```

左侧动作库选择“完整射箭”可查看搭箭、举弓、拉弓、保持、释放和收势。也可分别选择满弓保持、放箭与取消。拾放、抱箱、背柴、扛木、推拉、锄地和锤击都有实际道具，不是占位按钮。

动作不绑定职业，头饰和衣服可以继续 DIY。预览临时占用的手/背槽不会修改原始配方，返回基础待机后恢复。使用暂停、进度条、变速和握点检查进行审查。

```sh
npm run check:mesh
npm run check:actions
npm run build
```

## GitHub Actions 视觉验收

不使用 Visual / Vercel / Preview Site 部署。`vercel.json` 只设置 `git.deploymentEnabled=false`，关闭已连接的 Git 自动部署。

`Character Action Screenshot Review` 在 runner 内启动本地 Vite Preview，由 Playwright 打开真实 WebGL 页面并截图，上传 `character-action-screenshots` Artifact。Agent 必须下载并实际查看各动作、阶段、体型和换装截图，修复后才交付，不以绿色 Build 代替视觉审查。

产物包含 `review/`、`review-actions/`、JSON/HTML 报告和日志，默认保留 7 天。详见 [截图验收规范](Documentation/GitHubActions截图验收规范.md)。

## 当前功能与预算

连续、封闭、四边面主导的固定人体 cage；基础人体 510 triangles / 257 逻辑顶点；固定 20 骨骼和 Parent Map；每顶点最多两个非零权重。Three.js SkinnedMesh 主体走 GPU skinning，AnimationMixer 仅负责网页播放。

| 内容 | 现有能力 |
| --- | --- |
| 基础动作 | 待机、行走、慢跑、招手、屈膝、静态 A-Pose |
| 劳动 | 拾放木箱、抱箱待机/行走、扛木、背柴、推独轮车、拉车、双手锄地、单手锤击 |
| 射箭 | 完整射箭、搭箭拉弓、持续瞄准、高/低瞄准姿势、放箭收势、取消 |
| 装扮 | 头饰、上衣、下装、鞋、背部、左右手任意混搭；身高/体格/3 组布料配色 |
| 检查 | 正/侧/背三视图、素模、结构线、三角网格、骨骼、掌心/握点、PNG 截图、Recipe JSON |

默认静态角色预算：农户含斗笠无农具 675 tris，带农具 699 tris，卫兵剑盾 806 tris，弓手弓与箭袋 805 tris。工作预览先隐藏被占用的静态装备，再加对应动作道具，界面显示角色、道具和合计面数。渲染顶点因硬法线/颜色拆点会大于逻辑顶点。

## Recipe V4 · Slot DIY

```text
version: 4
preset
slots.headwear / top / bottom / shoes / back / leftHand / rightHand
height / build / palette
```

“弓手 + 农户草帽”只需保持弓手衣服和箭袋，把 `slots.headwear` 改为 `farmer_straw_hat`。旧 `outfit / hat / equipment` URL 和配方仍可迁移。预设只是默认组合，不是职业能力锁。

## 动画方向

```text
+X = 人物右侧
+Y = 向上
+Z = 人物正前方
```

原地步态由导航负责世界位移。Walk 方向回归：0% 右脚前触地/右臂后摆，25% 左脚抬起向前，50% 左脚前触地，75% 右脚抬起向前。不得出现月球步/倒着走。

## Unity 迁移与当前限制

可迁移的数据语义是 SkeletonDefinition、SkinBinding、MotionClip 局部轨道、ActionDefinition、事件相位、道具锚点和 ResidentAnimationState。Three.js AnimationMixer 不直接迁移。常用组合先烘焙全身片段，不默认让大量居民实时运行多层 Animator/IK。

当前是单角色动作与装扮验证，不是 Unity 生产运行时。未完成 MeshData/Burst、BlobAsset、Animation Texture/Bone Buffer、Entities Graphics、动画 LOD、Mesh Cache、万人性能、五指、布料、通用宽袖长袍和自动 Avatar Mapping。

劳动动作尚未连接世界导航/库存/资源生产和连续装卸任务状态机。车轮使用预览标定速度；射箭是标准方向演示，高低角仅验证姿势。箭飞行不包含世界投射物、命中、伤害或真实弹道。详见 [动作系统架构](Documentation/动作系统架构.md) 和 [GPU 迁移契约](Documentation/GPU骨骼动画迁移契约.md)。

## 接手阅读顺序

AGENTS.md → 工作交接 → 项目概览 → 运行时人物生成架构 → GPU骨骼动画迁移契约 → 服装生成架构 → 动作系统架构 → GitHubActions截图验收规范 → Phase4A使用与验收 → V3验收记录。
