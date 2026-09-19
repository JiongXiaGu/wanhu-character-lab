# Wanhu Character Lab · V3.4

《万户天工》低多边形人物网页实验台。连续程序人体、固定骨架、运行时服装装备、Slot DIY；新增 **Mixamo FBX 动画驱动现有人物**。

## 本地运行

安装 Node.js 22.12+。拉取 main 后双击 `Start-Local.cmd`，或：

```sh
npm ci
npm run dev
```

启动和构建会自动离线提取 `动画参考/` 中的 11 个 FBX。不会联网下载动画，也不加载 Vanguard 人物网格/贴图。生成的 `public/mixamo/` 不提交。`npm run preview` 前先运行 `npm run build`。

## Mixamo 动画

左侧 **Mixamo 动画** 可选择慢跑、拉弓射箭、高抬腿行走、连续拳击、倒地起身、拨动开关、游泳、街舞、Capoeira、Flair、近身攻击。可以暂停、变速、逐帧、重播和查看完整末帧。

「源骨架同步对照」左为源动画骨架、右为现有人物。人物预设、帽子、衣服、装备、身高和体格仍可修改。固定 20 骨骼与每顶点最多 2 个非零权重不变。没有用参考人物替换现有人物。

「导出目标骨架动画 JSON」导出当前体型实际使用的局部轨道、骨架信息、源 SHA 和提取根轨迹；不是已经实现的 Unity AnimationClip/Avatar/GPU Runtime。

**外部射箭目前只驱动人体姿势，未重配弓弦、箭、释放事件和精确抓握。** 原程序射箭保留为独立对照，不把旧事件相位强行套到外部片段。

详见 [Mixamo 动画接入](Documentation/Mixamo动画接入.md)。

## 保留的功能

原 6 个 Motion：待机、行走、慢跑、招手、屈膝、A 姿态。

原 17 个程序 Action：拾放、抱箱、扛木、背柴、推拉、锄地、锤击，以及完整射箭、分段和瞄准变体。入口名不等于独立完整任务流程；见 [Phase4A 使用与验收](Documentation/Phase4A使用与验收.md)。

Recipe V4：`preset + slots.headwear/top/bottom/shoes/back/leftHand/rightHand + height/build/palette`。职业只是一键预设，弓手可以戴农户草帽；旧 outfit/hat/equipment 仍兼容。

连续封闭人体 510 tris / 257 逻辑顶点；20 固定 Bone/Parent；Three.js SkinnedMesh 主体 GPU 蒙皮。结构布线 Debug 会 CPU 蒙皮，不代表生产路径。固定坐标 +X 人物右、+Y 上、+Z 前；导航负责世界位移。

## 验证与 GitHub Actions

```sh
npm run check:mesh
npm run check:actions
npm run build
npm run check:mixamo
```

保留 Character Action Screenshot Review 基模/旧动作回归，新增 Mixamo Retarget Review 全外部动作回归。后者输出源/目标关键相位、四视图、慢跑/射箭真实连续视频、换装/导出/错误恢复测试，Artifact 为 `mixamo-retarget-review`。

只在 GitHub Actions runner 内启动 Vite Preview，Playwright 真正打开 WebGL。**不使用 Visual / Vercel / Preview Site 部署**；`vercel.json` 的 `git.deploymentEnabled=false` 保留。Agent 必须下载产物实际审图、修正后才合入 main，绿色 Build 不能代替视觉审查。

## Unity 边界

迁移 Recipe、SkeletonDefinition、SkinBinding、局部动画轨道、事件/道具语义，不迁移 Three.js 类。现有不同体型参与动画烘焙，不能未经验证跨体型共享最终矩阵。

尚未实现 Unity MeshData/Burst、Avatar/Clip 导入器、BlobAsset、Animation Texture/Bone Buffer、Entities Graphics、LOD、Cache 与万人 Profile；无五指、布料、通用宽袖长袍、导航任务/库存/生产结算或正式投射物。

阅读顺序：AGENTS → 工作交接 → Mixamo动画接入 → 项目概览 → 人体/服装架构 → GPU契约 → 动作系统架构 → GitHubActions截图验收规范。Phase4A/V3 记录仅代表相应历史版本。
