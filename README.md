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

Windows 推荐直接双击仓库根目录：

```text
Start-Local.cmd
```

脚本会检查 Node/npm、自动拉取 Git 更新、首次安装依赖并启动本地 Vite 页面。

手动运行：

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

## 当前阶段

**Phase 1.5 · Shoulder JointPatch + Debug Review**

当前生成链：

`BodyParameters -> HumanTopologyBlueprint v2 -> BodySection / JointPatch -> Ring -> BufferGeometry`

当前已加入：

- Torso / Head / Arms / Legs / Feet 的 Ring Topology；
- Left / Right ShoulderPatch；
- 手臂根部不再封口；
- Shaded / Wireframe / Wire Overlay / Body Region 四种显示模式；
- Ring Guides；
- Perspective / Orthographic；
- Front / Back / Left / Right / Top / 3/4 固定视角；
- Grid / Axis；
- Section / JointPatch / Ring / Vertex / Triangle 实时统计。

当前 ShoulderPatch 仍与 Torso 侧面相交。下一主线目标是把肩部推进到真正共享边界顶点的无重叠连接，然后再复用到 HipPatch。
