# Wanhu Character Lab

《万户天工》程序化人物生成实验仓库。

网页只是快速实验台，最终正式运行时仍在 Unity 中实现。

## 当前设计方向

当前 Segmented Low-Poly 人体只作为技术 prototype。

正式下一路线：

~~~text
BodyParameters
→ HumanLandmarks
→ V2 Continuous Low-Poly Base Body
→ Body Surface Semantics
→ Rig / Skinning
→ GarmentRecipe
→ Body Hide
→ Final Runtime Mesh
~~~

V2 人体要求：

- 连续低模 Surface；
- 固定拓扑；
- 极少关节环线；
- 稳定 Body Face Group；
- 稳定 Garment Anchor Loop；
- 面数严格受控。

服装默认不使用 Cloth Simulation。

详细设计：

- Documentation/运行时人物生成架构.md
- Documentation/服装生成架构.md
- Documentation/工作交接.md

## 本地运行

Windows 推荐直接双击：

Start-Local.cmd

也可以：

~~~bash
npm install
npm run dev
~~~

构建：

~~~bash
npm run build
~~~

Mesh 检查：

~~~bash
npm run check:mesh
~~~

## 当前技术基线

现有 Web prototype 已经具备：

- Runtime Mesh；
- UInt16 Index；
- UInt8 Body / Bone Semantic；
- Mesh Validation；
- Wireframe / Overlay；
- 正交 Front / Side / Top Review；
- GitHub Actions 自动 Build / Visual Review。

这些基础设施会继续用于 V2。
