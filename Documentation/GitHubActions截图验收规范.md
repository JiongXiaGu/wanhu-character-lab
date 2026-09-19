# GitHub Actions 截图验收规范

## 唯一视觉验收方式

本仓库不部署 Visual / Vercel / Preview Site 用于人物审查。流程固定为：

```text
GitHub Actions → npm ci → Build / Mesh / Action Validation
→ runner 内 Vite Preview → Playwright 真实 WebGL 页面
→ 截图与 JSON 报告 → Artifact → Agent 下载并实际审图
```

localhost 只服务截图，不是部署环境。`vercel.json` 仅保留 `git.deploymentEnabled=false`，不重新加入 framework/build/output 配置，不新增视觉部署 workflow。

## Agent 连续执行责任

阅读最新代码与规范，更新文档并实现，运行自动检查，生成截图，下载产物，实际逐项检查，修正并重跑，达到可验收程度后合入 main，再通知用户。不能每个子动作要求用户回复“继续”，也不能只看 CI 绿色。

遇到真正的权限/依赖阻塞、需要明确美术方向选择或无法安全继续时才提前停下，并准确记录原因，不把失败版本标为通过。

## 两套矩阵都必须覆盖

基础 Motion：`scripts/review-v3.mjs` 的 `ACTION_SCREENSHOT_MATRIX`，由 `scripts/check-review-coverage.mjs` 检查；当前 idle/walk/run/wave/squat/bind。

可播放 Action：`scripts/review-actions.ts` 的 `ACTION_REVIEW_MATRIX`，与 `actions/catalog.ts` 的 WORK_IDS 双向核对。矩阵独立登记相位，检查实际截图文件存在、大小和报告条目；不是只把注册表遍历一遍就声称覆盖。

每个 Motion/Action 至少有 Front、Side、Back、Cage。循环动作有 0/25/50/75% 并检查闭环。单次动作有开始、接触/释放、恢复、结束；保持姿态验证暂停与长时间保持，不强求静态姿势的帧哈希发生变化。

必须包含真实道具和真实 Slot 组合，不能只拍空手骨架。新增动作没有截图矩阵或文件缺失，CI 必须失败。

## 交互检查

Carry/Push/Pull：左右掌心与 Grip/Handle，肩肘变形，负重步态中手是否脱离，道具与躯干/腿的位置，轮子是否跟随播放暂停。

Pick/Place：站姿、下探、接触事件、落地、松手、恢复。检查箱体落地与脚底，不能只看最漂亮一帧。

Tool：双手或单手握柄、接触前/时/后、工具轨迹、循环、穿头/躯干/腿。

Bow：搭箭、举弓、拉弓、保持、释放、收势与取消；弦中点和拉弦手，持弓手、箭方向，释放前/时/后，离弦箭不跟着收弓移动。必须实际播放确认一箭一次事件，暂停/定位不重复生成事件，取消不放箭。

补充默认和体型端点、跨职业草帽弓手、有限高低瞄准、界面状态文字、移动端水平溢出。没有实现的战斗/分层/导航功能不能写为已验证。

## 文件与产物

基础截图在 `review/`。动作截图实际命名：

```text
review-actions/<id>/front-beauty.png
review-actions/<id>/side-beauty.png
review-actions/<id>/back-beauty.png
review-actions/<id>/free-cage.png
review-actions/<id>/frame-<index>-p<phase1000>.png
review-actions/report.json
review-actions/index.html
```

额外截图含体型/DIY、握点、离弦画面和移动端。报告记录 `REVIEW_HEAD_SHA`（源提交）及 `GITHUB_SHA`（实际测试的 PR merge 或 main 提交），不得混用旧 Artifact 证明新提交通过。

Workflow `.github/workflows/screenshot-review.yml` 上传 `character-action-screenshots`，包括两个 review 目录、构建/检查/预览日志，保留 7 天。失败也应上传已生成的日志与失败截图。

不提交成百张截图到源代码，不把 Artifact 变成网页部署。需要长期保留时，保存验收摘要和选定图片，并明确生成它们的 SHA/run。

## 合并门槛

Build、check:mesh、check:actions、两套截图覆盖、Playwright UI 均通过；对应 Artifact 已下载并逐项实际审图；明显姿势、抓握、方向、蒙皮和构图问题已修正；残余范围限制已记录。

代码改动后重新运行。仅新增验收记录的文档提交可以引用其父代码提交的已审查截图，但必须说明代码未变化。合入前核对最新 main，保留并行变更，不覆盖未经比较的新提交。

只有完成这些门槛后才能通知用户验收。Build PASS 不等于 Visual PASS。
