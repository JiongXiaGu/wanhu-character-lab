# AGENTS.md

本文件是 AI / Agent 接手 wanhu-character-lab 时的强制入口。

## 开始工作前

先阅读：

1. Documentation/工作交接.md
2. Documentation/项目概览.md
3. Documentation/运行时人物生成架构.md
4. Documentation/服装生成架构.md
5. 当前任务相关代码

## 当前主线

当前代码中的 Segmented Low-Poly Humanoid 是技术 prototype，不是最终角色拓扑。

正式目标：

V2 Continuous Low-Poly Base Body + Garment-Friendly Topology

不要：

- 继续把独立棱柱人体当正式方案；
- 恢复旧的高分段 JointPatch / Opening 方案；
- 在 V2 Base Body 未确认前直接做正式 Rig / Garment；
- 用 DoubleSide 掩盖绕序问题；
- 默认引入 Cloth Simulation。

## V2 硬约束

人体：

- 单一连续低模 Surface；
- 固定拓扑；
- 极少关节环线；
- 参数只改顶点位置；
- Body Face Group 稳定；
- Garment Anchor Loop 稳定。

蒙皮：

- 大多数顶点 1 Bone；
- 关节最多 2 Bone 为默认目标；
- 不把复杂 4 Bone Skinning 作为基础方案。

服装：

- Material Only；
- Body-Derived；
- Independent Silhouette；
- Rigid Attachment；
- 穿衣必须 Body Hide；
- 默认 Skeleton Driven；
- Secondary Motion 优先 Shader / Few Helper Bones。

## 强制质量门槛

每次修改 Mesh 生成器至少保证：

1. npm run check:mesh
2. npm run build
3. Visual Review

人物形体必须实际检查：

- Front Orthographic；
- Right Orthographic；
- Top Orthographic；
- Back；
- 3/4；
- Wireframe。

Build PASS 不等于建模 Review PASS。

## 代码职责

~~~text
UI
→ Parameters
→ Landmarks / Recipe
→ Blueprint
→ Mesh Compiler
→ Mesh Validation
→ Renderer
~~~

UI 不直接修改顶点。

src/character/ 负责人体、服装数据协议与生成核心。

src/scene/ 负责 Three.js Renderer、相机和 Debug Review。

## Git 与文档

稳定架构、职责边界、数据协议变化时，同步更新 Documentation/。

同一小阶段尽量整理成完整提交。
