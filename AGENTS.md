# AGENTS.md

本文件是 AI / Agent 接手 `wanhu-character-lab` 时的强制入口。

## 开始工作前

先阅读：

1. `Documentation/工作交接.md`
2. `Documentation/项目概览.md`
3. `Documentation/运行时人物生成架构.md`
4. 当前任务相关代码

不要只根据当前对话直接扩展系统。先确认当前阶段、稳定约束与 Unity 迁移边界。

## 项目定位

本仓库是《万户天工》的程序化人物生成实验室，不是最终 Web 产品。

网页负责快速验证：

- 参数化低模人体；
- 程序化 Mesh；
- 骨骼 / 蒙皮规则；
- Garment Recipe；
- LOD；
- Mesh Cache；
- Web / Unity 共用的数据协议。

最终正式运行时在 Unity 中重写实现，并优先使用 Burst / Jobs / MeshData。

## 当前主线

当前正式方向：

`Segmented Low-Poly Humanoid`

不要恢复已经废弃的：

- Continuous Ring Topology；
- JointPatch；
- Shoulder Opening；
- Shared Boundary Welding；
- 复杂 Smooth Skinning 作为默认人体方案。

当前基础人物：

- 16 个逻辑身体部件；
- box4 / hex6 / oct8 固定截面；
- 关节允许少量重叠；
- 约 252 tris / 204 verts；
- 1 BufferGeometry；
- bodyPart = UInt8；
- boneIndex = UInt8；
- Index = UInt16。

## 强制质量门槛

每次修改生成器后至少保证：

1. `npm run check:mesh`
2. `npm run build`
3. Visual Review 截图复核

Mesh Validation 必须检查：

- 非有限顶点；
- Degenerate Triangle；
- Inward Triangle；
- Mixed BodyPart Triangle；
- Triangle Budget。

不要用 `DoubleSide` 掩盖绕序错误。

## 代码职责

目标依赖方向：

```text
UI
→ Character Parameters
→ Blueprint / Recipe
→ Mesh Compiler
→ Mesh Validation
→ Renderer
```

UI 不直接修改顶点。

`src/character/`
负责人物参数、低模 Blueprint、Mesh Compiler、Validation。

`src/scene/`
负责 Three.js Renderer、相机和 Debug Review。

## 核心约束

- 人体、衣服、裤子等核心几何默认运行时生成。
- 不把 FBX / GLB 服装 Mesh 作为正式运行时方案。
- Web 与 Unity 共用参数、Recipe、部件语义和数据协议，不追求共用渲染代码。
- Three.js 结构不得反向绑死 Unity 架构。
- 不因为近景需求就无限增加裸体人体面数。
- 颜色等材质变化尽量不进入 Geometry Key。

## Git 与 Vercel

- 同一小阶段尽量整理成完整提交。
- Vercel 只是在线观察目标。
- 除非用户明确要求，不主动操作 Vercel Production。
- 本地优先使用 `Start-Local.cmd`。

## 文档

稳定架构、职责边界或数据协议变化时，同步更新 `Documentation/`。

不要创建额外 AI 专用文档层。
