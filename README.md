# Wanhu Character Lab

《万户天工》程序化人物生成实验仓库。

网页只是快速实验台，最终正式运行时仍在 Unity 中实现。核心目标是验证：

- 运行时程序化人物 Mesh；
- 低面数角色拓扑；
- 分段骨骼与刚性权重；
- 程序化服装 Recipe；
- LOD、Mesh Cache 与大规模居民复用；
- Web / Unity 共用的数据语义。

正式方向不把 FBX / GLB 人物或服装 Mesh 作为运行时核心内容源。

## 技术栈

- React
- TypeScript
- Vite
- Three.js
- Vercel（仅用于在线观察）

## 本地运行

Windows 推荐直接双击仓库根目录：

```text
Start-Local.cmd
```

也可以手动：

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

## 当前阶段

**Phase 2 · Low-Poly Segmented Humanoid**

前一版 Ring / JointPatch / Shoulder Opening 的“连续人体拓扑”路线已经停止继续扩展。

当前主线改为：

```text
BodyParameters
→ LowPolyHumanoidBlueprint
→ 16 Segmented Parts
→ Fixed Prism Profiles
→ 1 BufferGeometry
```

当前固定截面只有：

- `box4`
- `hex6`
- `oct8`

关节默认允许少量重叠，不再为肩、髋、膝、肘做复杂焊接。

当前目标：

- 默认裸体基础胚 ≤ 500 tris；
- 实际尽量控制在 200～300 tris；
- 逻辑上 16 个身体部件；
- 渲染上仍然编译为 1 Mesh；
- 每顶点写入 `bodyPart` 与 `boneIndex`；
- 后续优先验证刚性骨骼动画，而不是复杂 Smooth Skinning。

网页支持：

- Shaded / Wireframe / Overlay / Part Colors；
- Part Guides；
- Perspective / Orthographic；
- Front / Back / Left / Right / Top / 3/4；
- Grid / Axis；
- Parts / Sections / Vertices / Triangles / Budget 统计。
