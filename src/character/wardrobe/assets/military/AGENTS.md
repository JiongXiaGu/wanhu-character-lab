# 军人甲胄当前作者边界

先读根 `AGENTS.md`、`Documentation/军人与甲胄工作流.md` 与三驻地专篇。甲装等级为第一轴，驻地 palette/头盔为第二轴，普通/队长只通过实际 headwear 区分。

Light 使用原城市布面短甲/束腿裤；Medium 为皇宫/边疆共享的 `medium_armor + medium_armor_skirt`，不维护重复驻地工厂。Heavy 为 `heavy_armor + heavy_armor_skirt`，六款原 ID 重盔由 `heavy-equipment.ts` 提供。当前 S6-6 是重甲步兵候选：完整厚上甲、前后侧向过膝长甲裳、完整重盔，不围绕骑乘设计，不退回 Medium 加厚或两条宽甲裤。

当前只修 Heavy 裙底连接/内部回折/腿出口与静态蒙皮；上甲、六款重盔、背具采样、武器、Light/Medium、动物/坐骑不再重做。内部裆口的高度与权重可以随真实穿插修复改变，但外部完整长裳、独立真实出口、封口/连通/非流形、合法双权重、动作门槛必须保留。作者预算以真实代码与对应检查为准，不能用锁死旧实现的断言阻止正确修复。

## 验收范围

仅保留三条永久 workflow。Fast 使用 Targeted `soldier-heavy-authoring`，只验证作者，不提取动作/启动浏览器；Fast视觉使用 Manual `soldier-heavy-fast` 四张正/侧/背/Medium对比。

造型成立后 Candidate 保留 Soldier static、原完整下身交点、Heavy motion与focused fitting。Heavy-only Draft自动先Fast成功再Candidate，不跑Light/Medium motion、full browser或coverage；Draft的[soldier-visual]只产Fast图。

Candidate通过后转Ready，ready_for_review触发正式full Soldier Gate与完整视觉；main继续正式回归。共享rig/Recipe/assembly/motion/通用变形/Renderer/交点检测/CI/package变化按真实影响升级，不得滥用Heavy-only。

不高频轮询不等于CI运行中结束任务；独立工作完成后持续等待或低频检查，只有工作流timeout、约20分钟无进展且无其它工作、真实工具/权限硬阻塞或用户要求停止才交回。完整职责、失败处理、证据与合并规则只在共同工作流维护。

## 不变量

Recipe V5精确六字段/七槽位；固定男女、20骨、最多双权重、inverse bind、Renderer/Actor/动捕/保存/染色不变。不加甲裙骨、实时布料、运动相位特例或Heavy豁免，不改原交点算法、容差或源键/中点。

中甲保持腰起前后跨中线单一闭合裙甲与真实裤管，不复制另一驻地中甲。普通/队长仍只换头盔；队长细高、居中、收尖。已退役 `palace_guard_armor / frontier_lamellar_armor / palace_guard_skirt / frontier_armor_skirt` 不恢复到Recipe/UI。

Fast/Candidate不代表Release、用户美术认可或main交付。真实required穿插、严重视觉问题或最终截图未实际打开时不得合并。
