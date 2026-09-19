# AGENTS.md

接手前先阅读：

1. Documentation/工作交接.md
2. Documentation/项目概览.md
3. Documentation/运行时人物生成架构.md
4. Documentation/GPU骨骼动画迁移契约.md
5. Documentation/服装生成架构.md
6. Documentation/V3验收记录.md

再检查当前任务相关代码。不要从旧对话直接猜实现状态。

## 当前正式路径

`Preset → Recipe V4 Slots → v3/body.ts → v3/outfit.ts → CharacterData → v3/rig.ts → CharacterViewport`

src/character/v3 的 types / cage / body / outfit 是不依赖渲染器的生成层；rig.ts 是 Three.js 验证适配层。

历史 segmented / V2 二维挤出路径已经移除，不得误接回去。

## Recipe V4 / DIY 约束

职业只是预设，不是生成器分支条件。正式持久化数据为：

```text
Recipe
├─ version = 4
├─ preset = farmer / guard / archer / body / custom
└─ slots
   ├─ headwear
   ├─ top
   ├─ bottom
   ├─ shoes
   ├─ back
   ├─ leftHand
   └─ rightHand
```

点击农户 / 卫兵 / 弓手只会一次性写入默认 Slot；修改任意 Slot 后 preset 变为 custom。v3/outfit.ts 生成逻辑必须根据 Slot 判断，不能重新用 preset/outfit 把装备绑死。

旧 V3 输入 `outfit / hat / equipment` 只作为迁移兼容。特别地，旧 `farmer + equipment=true` 必须迁移成 `rightHand=farmer_hoe`。

## 不得破坏

- 连续、封闭、四边面主导的固定三维人体；不通过相交块冒充连续蒙皮。
- 身体、服装、装备均运行时生成；不改成预制 FBX / GLB 内容库。
- 固定 20 个骨骼语义，Bone ID / Parent Map 不因职业、服装或体型变化。
- 每顶点最多 2 个非零权重；普通区域尽量 1 Bone，关节才做 2 Bone Blend。
- 主体角色动画不逐帧重建 Mesh。
- +X = 人物右侧，+Y = 向上，+Z = 人物正前方。
- Walk / Run 是原地动画；游戏导航负责世界位移。
- Web 的 AnimationMixer 只是验证层；可迁移的是 SkeletonDefinition、SkinBinding、MotionClip、AnimationState。
- 结构布线 Debug Overlay 可以 CPU 更新，但正式角色 GPU skinning 不能依赖这条调试路径。
- 布料模拟不属于默认方案。
- 服装共享同一 SkeletonDefinition；Rigid Attachment 绑定单 Bone，BodyDerived 服装继承身体权重。
- 不用 DoubleSide 遮盖绕序 Bug。
- 低三角形不等于已经满足 Unity 万人性能。

## Unity GPU 动画方向

近景第一阶段允许使用：

`SkinnedMeshRenderer + 固定 20 Bone Skeleton + GPU Vertex Skinning`

中远景 / Crowd 目标：

`ResidentAnimationState → ClipId / Phase / Speed → Animation Texture 或 Bone Buffer → Entities Graphics GPU Skinning`

不要默认给大量居民各自创建完整 GameObject Animator + Transform Bone Hierarchy。

详细契约见 Documentation/GPU骨骼动画迁移契约.md。

## 开发与验收

用户要求连续推进到可验收阶段，不按单个文件或子步骤反复要求用户说“继续”。Agent 接到一个人物 / 动作阶段后，应连续完成：读文档 → 实现 → 自动检查 → GitHub Actions 截图 → 下载并实际审图 → 修正 → 重新截图，直到达到可以让用户验收的状态。只有遇到需要用户决策的方向分歧、权限阻塞或无法自动解决的问题才停下来询问。

不能在回复之后声称仍后台开发；只有当前执行的工具 / CI 工作才是实际进度。

## 禁止视觉部署

本仓库不部署 Visual / Vercel / Preview Site 来做视觉验收。

- 不创建 Vercel Deployment。
- 不新增视觉预览部署 workflow。
- 不要求用户打开线上临时站点。
- GitHub Actions 在 runner 内启动本地 Vite preview，Playwright 截图后上传 Artifact。
- Agent 必须下载 Artifact 并实际检查截图，不能只看 Action 绿色。
- 用户验收时只需拉取 main 本地运行，或查看 Action 截图。

详细规范见 Documentation/GitHubActions截图验收规范.md。

每次生成器 / 动画改动必须执行：

1. `npm run check:mesh`
2. `npm run build`
3. 浏览器真实 WebGL + 交互检查
4. 实际打开正、侧、背、3/4、结构布线及关键动作截图
5. Walk / Run 必须检查完整步态周期，而不是只看单帧
6. 每个已实现 Motion / Action 必须进入 GitHub Actions 截图矩阵；新增动作但缺截图覆盖时 CI 必须失败
7. 每个动作至少输出 Front / Side / Back / Cage 四类截图；循环和关键交互动作还要输出关键相位序列

当前 Walk 回归门槛：

- 0%：右脚 +Z 前触地，右臂在后
- 25%：左脚抬起向前摆
- 50%：左脚 +Z 前触地
- 75%：右脚抬起向前摆

自动测试不证明没有自交或所有动作都不穿模。记录已检查范围、已知局限和截图对应版本。

重构在工作分支完成验证后再合入 main。不得强推 / 覆盖并发提交。不得部署 Vercel / Visual Preview。依赖使用 package-lock.json 和 npm ci。文档和代码同步更新，不维护互相矛盾的“当前阶段”。
