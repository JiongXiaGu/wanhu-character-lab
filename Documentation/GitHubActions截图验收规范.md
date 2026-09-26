# Review 与 GitHub Actions 验收规范

## 核心原则

视觉正确性最终由人判断。AI 与 CI 的默认职责是写代码、维护自动检查、验证协议/拓扑/权重/数值/动画采样和交互契约；不再把“自动生成大量截图并逐张看完”当作每次修改的默认流程。

只有用户明确要求视觉审查、需要建立视觉基线、处理纯视觉问题或进行阶段发布验收时，才生成并查看截图。截图生成成功不等于视觉通过，AI 未实际查看时不得声称已审图；用户未确认时不得把美术观感写成自动验收结论。

## 三层流水线

正式工作流固定为三条：

1. **Build & Core Checks**
   - 每次 pull request 和 main push 自动执行。
   - 运行 `check:retired`、`check:core` 与 production build。
   - 负责基础协议、固定基模、独立服饰网格、退役路径和 TypeScript/打包正确性。

2. **Targeted Numeric Checks**
   - 每次 pull request 和 main push 自动执行，但先根据 diff 判断改动范围。
   - Wardrobe 相关路径只跑衣柜数值检查。
   - Mixamo 相关路径只跑重定向/播放数值检查。
   - 服装几何、rig、body、intersection 相关路径才跑 Tailoring/贯穿检查。
   - Horse 相关路径才跑 `check:horse`。
   - 文档或与上述子系统无关的改动不会触发这些重检查。

3. **Manual Visual Review**
   - 仅 `workflow_dispatch` 手动触发，不随 PR/main 自动运行。
   - scope 可选 `character / wardrobe / lightwear / skirts / mixamo / horse / all`。
   - 可选 `full=true` 生成完整视觉矩阵；默认使用快速范围。
   - 只负责生成真实浏览器视觉证据，最终由人查看。

## 日常开发流程

默认流程：

1. 读取最新 main。
2. 修改代码。
3. 执行能覆盖该改动的代码/数值检查。
4. 推送后确认 Build & Core Checks 与相关 Targeted Numeric Checks。
5. 没有明确视觉需求时直接交付或合并，不等待大规模截图。
6. 用户要求视觉审查时，再运行 Manual Visual Review 或本地 `review:local`。

这意味着删除衣服、改目录、改协议、改非视觉逻辑时，不再自动跑人物全截图、全 FBX、412 张裙装或马匹 104 张矩阵。

## 本地视觉入口

只有需要视觉判断时使用：

```sh
npm run review:local -- --character
npm run review:local -- --wardrobe
npm run review:local -- --lightwear
npm run review:local -- --skirts
npm run review:local -- --mixamo
npm run review:local -- --horse
```

明确需要完整矩阵时追加 `--full`。运行结果只表示已生成视觉证据，命令本身不会宣布“视觉通过”。

## AI 的职责边界

AI 默认应做：

- 写和维护自动测试。
- 检查类型、协议、数据所有权和死代码。
- 检查网格闭合、退化面、权重、骨骼语义、有限值、相交规则、配方往返。
- 检查动画源键/中点、循环/结束、重定向与状态保持。
- 根据失败日志定位问题并修代码。
- 在用户要求视觉审查时生成截图、查看指定图片并报告实际看到的问题。

AI 默认不应做：

- 每次修改都生成数百张图片。
- 为了“等 CI”暂停明显可以继续的代码工作。
- 把图片生成成功当作美术已通过。
- 没有实际打开图片却声称已视觉审查。
- 用 AI 的主观视觉判断替代用户最终美术决策。

## 何时需要完整视觉回归

以下情况建议手动执行 Manual Visual Review，必要时 `scope=all` 且 `full=true`：

- 用户明确要求视觉验收。
- 大幅修改人物比例、服装轮廓、头发/帽子、材质或 UI。
- 修改相机、渲染、Three.js/WebGL 显示逻辑。
- 修改裙装制作结构并需要观察动作表现。
- 修改马匹模型或动画美术。
- 阶段发布、建立新视觉基线或准备重要演示。

纯数值/协议/目录清理无需完整视觉回归，除非改动直接影响画面。

## Actions 查询与对话执行纪律

GitHub Actions 是异步验收器，不应通过连续查询 workflow / jobs / steps 来同步盯住 runner；同时，**不能因为 run 仍是 queued / in_progress 就把本应完成的任务提前结束。**

默认规则：

1. 提交或触发 workflow 后，先确认 run 已创建、目标 SHA 正确，没有 YAML / checkout / 权限等立即失败。
2. CI 运行期间继续所有不依赖 CI 的工作，包括代码修复、文档同步、视觉证据整理、PR 描述、冲突检查和合并准备。不要把“等 CI”当成停止点。
3. 禁止高频执行 workflow → jobs → steps → workflow 的轮询链。查询次数不是停止任务的触发器。
4. 到达真正的 Candidate / Release / merge Gate 后，如果当前 run 是唯一剩余依赖：
   - 有持续等待 / watch 能力时，优先使用一次持续等待；
   - 没有 watch 时才低频检查，不重复展开 jobs / steps，除非状态已经失败。
5. queued / in_progress 本身不是交回任务的理由。只有 workflow 达到自身 timeout、连续约 **20 分钟**没有状态进展且已经没有其它可推进工作、工具/权限硬阻塞，或用户明确要求停止时，才允许结束未完成任务。
6. failure / cancelled / action_required 时读取真实失败 job / step / log，得到可操作原因后直接修复；不能用其它 workflow 成功来掩盖失败。
7. 修复后按实际影响范围重跑，不因为一次失败恢复到无关的全仓库矩阵。
8. 不给 runner 完成时间作承诺，只陈述已经发生的状态。

因此，“不轮询”意味着减少无意义 API 查询；**不意味着把一次可完成的交付拆成多个等待用户再次说“继续”的轮次。** 最终回复应优先给出真正完成的交付；若因上述长时间/硬阻塞条件被迫停止，必须精确说明阻塞、已完成部分和恢复入口。

## 证据记录

必须区分：

- 自动数值检查通过；
- 浏览器截图成功生成；
- AI 实际查看了哪些图片；
- 用户是否确认视觉结果。

四者不能互相替代。最终回复只陈述实际发生的事实。

## 历史矩阵

旧流程中的 156 对 before/after、270 张轻便服饰、412 张裙装、104 张马匹等矩阵脚本仍保留在仓库，可作为专项或阶段性人工触发工具。它们不再是每个 PR 的默认门槛，也不要求 AI 每次逐张检查。

## 合并策略

Draft PR 是开发载体，不等于 Release Gate。Heavy-only Draft 迭代应使用 Fast / Candidate 范围，不自动重复完整 Soldier Release Targeted；转为 Ready for Review 时必须触发完整 Targeted，不能用 Draft 阶段结果替代正式发布证据。

运行时代码合并前要求：Build & Core Checks 成功；受改动影响的 Release Targeted Numeric Checks 成功。Manual Visual Review 不是默认合并门槛，除非用户明确要求视觉验收或此次任务本身就是视觉修改。

纯文档修改无需为了视觉证据重新运行完整代码/截图矩阵。工作流或测试脚本本身修改时，应验证新的 Build 与 Targeted Numeric Checks 能按预期触发；视觉工作流只需确认可被手动调用，不要求自动跑完整截图。
