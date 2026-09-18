# Wanhu Character Lab · V3

《万户天工》低多边形人物网页实验台。当前可使用同一连续人体和骨架切换农户、卫兵、弓手，以及基础人体检查模式。

## 本地使用

安装 Node.js 22.12+。拉取 main 后双击根目录 `Start-Local.cmd`。

启动器在干净的 main 工作区尝试 fast-forward 更新；有本地修改或不在 main 时不自动更新。根据 package.json / package-lock.json 的哈希安装准确依赖，随后选择空闲的本地端口并由 Vite 打开浏览器。关闭窗口或 Ctrl+C 停止服务。不需要 Vercel、数据库或 Unity。

手动命令：

```sh
npm ci
npm run dev
```

## 当前功能

- 连续、封闭、四边面主导的固定三维人体 cage，基础人体 510 triangles / 257 逻辑顶点；不加载 FBX / GLB。
- 20 骨骼，顶点最多两个非零权重；Three.js SkinnedMesh + AnimationMixer。
- 待机、行走、慢跑、招手、屈膝，以及静态 A-Pose。支持暂停、速度和进度拖动。
- 农户短衣、卫兵轻甲外观、弓手皮甲外观；帽子、剑盾、弓和箭袋、农具。
- 身高、体格和三组布料配色；Recipe JSON 导出。
- 同屏正 / 侧 / 背三视图、素模、结构面边线、全部三角线框、骨骼叠加和 PNG 截图。

默认农户（含头饰、不含农具）675 triangles；带农具 699；带剑盾的卫兵 806；带弓和箭袋的弓手 805。渲染顶点由于法线 / 颜色拆点大于逻辑顶点，界面分别统计。

## 验证

```sh
npm run check:mesh
npm run build
# 另一个终端启动 npm run preview -- --host 127.0.0.1 --port 4173
npm run check:visual
```

`check:visual` 需要 Playwright Chromium：`npx playwright install chromium`。

本轮自动检查 12 个职业/体型组合、1152 个动作采样帧，浏览器生成 20 张截图并测试真实交互。截图生成成功不等于美术验收通过，必须实际打开图像检查。

## 阅读顺序

1. `AGENTS.md`
2. `Documentation/工作交接.md`
3. `Documentation/项目概览.md`
4. `Documentation/运行时人物生成架构.md`
5. `Documentation/服装生成架构.md`
6. `Documentation/V3验收记录.md`

## 当前边界

这是可验收的「人物重构 + 基础动作」网页阶段，不是已经完成 Unity 生产运行时。尚未实现战斗 / 拉弓射击动画、完整五指抓握、通用长袍生成器、LOD / Mesh Cache、Unity 性能验证或自动 Avatar 映射。

本轮服装以 BodyDerived.Replace 改变覆盖区域的可见形体和材质，不重复保留同位置裸体。这不等于已经完成通用衣物遮罩系统。历史 V2 规范仅作参考，不再指导现有生成器。
