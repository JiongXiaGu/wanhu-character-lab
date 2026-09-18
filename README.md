# Wanhu Character Lab

《万户天工》程序化人物生成实验仓库。

本仓库不是最终 Web 产品。它用于在 Unity 正式实现前验证：

- 运行时程序化人体 Mesh；
- 身材参数与拓扑规则；
- 服装 Recipe；
- 骨骼与蒙皮生成策略；
- LOD、Mesh 合并与缓存策略；
- Web 与 Unity 共用的数据协议。

当前阶段只建立最小可运行实验骨架，不引入 FBX / GLB 人物资产。

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

当前第一个里程碑：**不加载任何人物模型资产，在浏览器中根据少量参数实时生成一个单 Mesh 的简化人体占位体。**
