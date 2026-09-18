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

网页只负责快速验证：

- 参数化人体；
- 程序化 Mesh；
- 服装 Recipe；
- 骨骼 / 蒙皮生成规则；
- LOD；
- Mesh 合并；
- 缓存与复用策略；
- 角色描述数据协议。

最终正式运行时在 Unity 中重写实现，并优先使用 Burst / Jobs / MeshData 等适合大规模城市居民的路径。

## 核心约束

- 人体、衣服、裤子等核心几何默认由运行时规则生成。
- 不把 FBX / GLB 服装 Mesh 作为正式运行时方案。
- Web 与 Unity 共用“参数、Recipe、拓扑语义和数据协议”，不追求共用渲染代码。
- Web 端 Three.js 结构不得反向绑死 Unity 架构。
- 第一阶段优先证明正确的数据流，不提前堆叠完整捏脸、布料模拟或复杂 UI。
- 当前简化人体允许使用程序化基础几何作为占位；它不是最终拓扑质量基线。

## 代码职责

目标依赖方向：

`UI -> Character Parameters -> Generator -> Geometry -> Renderer`

UI 不应直接到处修改 Three.js Mesh 顶点。生成规则集中在 `src/character/`。

场景、相机、灯光和 Orbit 控制集中在 `src/scene/`，不进入人物生成核心。

## Git 与 Vercel

- 尽量把同一小阶段整理成一次完整提交，不为微调频繁推送。
- Vercel 只是用户观察网页实验结果的发布目标。
- 除非用户明确要求部署或排查部署，不主动操作 Vercel Production。
- 代码进入仓库前应至少保证 TypeScript / Vite Build 逻辑完整；有条件时再做浏览器视觉复核。

## 文档

稳定架构、职责边界或数据协议变化时，同步更新 `Documentation/`。

不要创建额外的 AI 专用文档层。
