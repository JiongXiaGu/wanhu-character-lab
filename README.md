# Wanhu Character Lab

《万户天工》程序化人物生成实验仓库。

本仓库不是最终 Web 产品。它用于在 Unity 正式实现前验证：

- 运行时程序化人体 Mesh；
- 身材参数与拓扑规则；
- 服装 Recipe；
- 骨骼与蒙皮生成策略；
- LOD、Mesh 合并与缓存策略；
- Web 与 Unity 共用的数据协议。

正式方向不把 FBX / GLB 人物服装 Mesh 作为运行时核心内容源。

## 技术栈

- React
- TypeScript
- Vite
- Three.js
- Vercel（仅用于在线观察）

## 开始阅读

1. `AGENTS.md`
2. `Documentation/工作交接.md`
3. `Documentation/项目概览.md`
4. `Documentation/运行时人物生成架构.md`

## 本地运行

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

## 当前阶段

**Phase 1 · Ring Topology**

当前已经从 Phase 0 的 Sphere / Cylinder 占位拼接切换为：

`BodyParameters -> HumanTopologyBlueprint -> BodySection -> Ring -> BufferGeometry`

人体的 Torso / Head / Arms / Legs / Feet 都由运行时 Section / Ring 规则直接生成顶点与索引，最终仍然编译为一个 Mesh。

当前下一目标是 JointPatch：先处理肩、髋、头颈等分支区域的共享边界与连接规则。
