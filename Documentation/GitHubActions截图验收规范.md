# GitHub Actions 截图验收规范

## 1. 唯一视觉验收方式

本仓库不部署 Visual / Vercel / Preview Site 用于人物视觉验收。

视觉审查统一使用：

```text
GitHub Actions
→ npm ci
→ Mesh / Animation Validation
→ npm run build
→ Runner 内启动 Vite Preview
→ Playwright 打开真实 WebGL 页面
→ 自动截图
→ Upload Artifact
→ Agent 下载 Artifact 并实际审图
```

Runner 内的 localhost 只服务截图，不是部署环境。

仓库只保留最小 `vercel.json`：`git.deploymentEnabled=false`，用于阻止已连接的 Vercel Git 集成自动部署。不得在该文件重新加入 framework / build / output 配置，也不新增视觉部署 workflow。

## 2. Agent 的连续执行责任

用户交付一个阶段后，不要求用户反复输入“继续”。

Agent 应连续完成：

1. 阅读 AGENTS 与当前架构文档；
2. 实现本阶段人物 / 动作；
3. 运行几何、蒙皮、动画自动检查；
4. Build；
5. GitHub Actions 自动截图；
6. 下载截图 Artifact；
7. 实际检查图片，而不是只看 CI 绿色；
8. 修复明显姿势、穿模、方向、Socket、蒙皮或构图问题；
9. 重复 3–8，直到达到可以让用户验收的状态；
10. 合并 main 后再通知用户验收。

只有以下情况允许提前停下：

- 需要用户选择明确的美术方向；
- GitHub / 权限 / 外部依赖阻塞；
- 两种设计取舍无法通过已有规范判断；
- 自动验证无法安全继续。

## 3. 每个动作必须有截图覆盖

当前每个已实现 Motion 至少输出：

```text
Front
Side
Back
Cage / Wire
```

循环动作还必须输出关键相位：

```text
0%
25%
50%
75%
```

一次性动作至少输出：

```text
Start
Contact / Main Event
Recovery
```

如果动作使用道具，截图必须包含真实道具和真实 Slot 组合，不能只拍空手骨架。

## 4. 动作截图矩阵

自动截图矩阵维护在：

`scripts/review-v3.mjs`

当前必须覆盖：

- idle
- walk
- run
- wave
- squat
- bind

新增 Motion 时，必须同步加入 `ACTION_SCREENSHOT_MATRIX`。

`scripts/check-review-coverage.mjs` 会读取 Motion 类型并检查截图矩阵。新增 Motion 但遗漏截图覆盖时 CI 直接失败。

Phase 4 的 ActionDefinition 一旦成为可播放动作，也必须加入截图矩阵；不能只新增数据定义而不提供视觉验收入口。

## 5. Phase 4 动作额外检查

### Carry / Push / Pull

检查：

- 两只手是否对准 Grip / Handle；
- 手肘是否过伸；
- 肩部是否塌陷；
- Walk 叠加后手是否脱离道具；
- 道具是否穿躯干 / 腿。

### Pick / Place

检查：

- 起始站姿；
- 下探阶段；
- pickup / place event 时刻；
- 恢复站姿；
- 手部是否到达 Interaction Anchor。

### Tool

检查：

- 双手 / 单手 Grip；
- Contact Event；
- 工具轨迹；
- 工具是否穿头、躯干或腿；
- 循环衔接。

### Bow / Combat

检查：

- Raise / Draw / Hold / Release / Recover；
- 左右手协同；
- Aim 高低角；
- 剑盾与身体穿模；
- 武器 Socket；
- 上半身动作与 Locomotion 是否冲突。

## 6. 文件命名

推荐：

```text
action-<id>-front.png
action-<id>-side.png
action-<id>-back.png
action-<id>-cage.png
action-<id>-side-p00.png
action-<id>-side-p25.png
action-<id>-side-p50.png
action-<id>-side-p75.png
```

特殊动作可以增加：

```text
action-hoe-contact.png
action-bow-draw.png
action-bow-hold.png
action-bow-release.png
```

## 7. Artifact

Workflow 只上传视觉验收需要的内容：

- review/*.png
- review/browser-review.json
- mesh-review.log
- preview.log

不部署网页，不把视觉验收替换为在线 Preview。

## 8. 合并门槛

允许合入 main 前必须满足：

- `npm run check:mesh` PASS；
- `npm run build` PASS；
- Screenshot Coverage PASS；
- Playwright WebGL / UI PASS；
- 截图 Artifact 已生成；
- Agent 已实际审图；
- 已知问题已记录；
- 没有明显半成品动作。

Build PASS 不等于 Visual PASS。

## 9. 用户验收时机

只有在当前阶段已经通过上述门槛后，才通知用户：

“现在可以验收。”

不要在只完成动作骨架、只通过编译、或还没看截图时要求用户验收。
