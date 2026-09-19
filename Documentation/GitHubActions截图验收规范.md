# GitHub Actions 截图验收规范 · V3.6

## 流程

`Actions → npm ci → 静态/FBX数值检查 → Build → runner内Preview → Playwright WebGL → Artifact → Agent下载实际审图/视频 → 修正重跑 → main`

禁止Visual/Vercel/Preview Site部署。localhost只服务runner截图，保留vercel.json deploymentEnabled=false。不以绿色Build代替观感；不让用户代替Agent逐次审查。依赖权限确实阻塞时如实记录，不标PASS。

## 三条工作流

Build执行retired守卫、check:mesh和build。

Character Model Review（screenshot-review.yml）执行基模/DIY回归并上传 `character-model-review`：男女×4外观×3身材×静态正侧背布线；4外观×慢跑/射箭×三视图美术/布线；草帽混搭、清装备、移动端。静态绑定不是程序动画，播放控件应禁用。

Mixamo Retarget Review上传 `mixamo-retarget-review`：11源动作×男女×3身材全源时间轴/全渲染顶点；head-calibration.json独立记录头部四元数误差、旧偏差及真实点头范围。

## 动画视觉矩阵

review-mixamo.ts独立登记11个ID并与catalog双向检查，不能静默漏新增FBX。每项9个源/目标相位（含完整末帧）及正侧背布线。慢跑/射箭额外完整连续WebM；不是把几张截图拼接后当真实播放视频。

慢跑、射箭、高抬腿行走、起身各有2个去帽头部侧面近景。方向轴青色=面前、金色=上；源轴来自真实旋转差，不用源头顶骨段冒充脸向。还要看颈部连接和衣物，不只验证两条轴平行。

检查暂停、seek、末帧、重播；快速切换不被旧异步结果覆盖、不重建模型几何；404后重试可恢复；配方不被动画重置；目标JSON可下载。移动端不得水平溢出。

## 产物与证据

每个截图条目必须实际存在且非空，报告保存 sourceSha=REVIEW_HEAD_SHA 与 testedSha=GITHUB_SHA。PR merge SHA与源head区别记录。不拿旧artifact证明新代码；只改文档时可引用父代码产物，明确代码未变。

上传review/report.json/index.html与PNG、review-mixamo/report.json/head-calibration.json/PNG/WebM、源inventory和相关日志，失败也上传已产生的证据，保留7天。不把大量截图提交源码库。

Agent下载检查所有动作组和关键阶段，慢跑/射箭连续时间过程必看。检查体型端点、草帽/头饰、蒙皮与侧面头向。数值只能证明相应不变量，不证明无自交、正确抓握或Unity性能。

合入前检查最新main，保留并发修改，不强推。README/AGENTS/交接/架构与实际脚本一致。原check:actions、旧程序动作矩阵及固定Walk相位已移除；Phase4A/V3验收记录只描述历史。

## V3.6 身体配置补充

Recipe V4新增bodyType（缺省male）；女性profileVersion=wanhu-body-profiles-v1，与男性共用拓扑和骨骼语义，绑定位置可不同。网格键和目标动画键都必须包含bodyType/profileVersion/height/build。男性12套几何哈希保持6627c2e基线；女性通过独立比例、头脸、低髻实现，不是只换衣服。详细范围及验收矩阵见女性角色接入.md。
