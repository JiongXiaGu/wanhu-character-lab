# 军人甲胄当前作者边界

先读根 `AGENTS.md`、`Documentation/军人与甲胄工作流.md`、`Documentation/皇宫禁卫与长枪.md`、`Documentation/边疆戍卒与长枪.md`。当前外观主轴已从“驻地各造一套近似甲”改为“甲装等级优先，驻地配色/头盔为辅”。

当前三种甲装等级：
- `medium`：`medium_armor` + `medium_armor_skirt`，皇宫与边疆共享完全相同的上甲/下甲几何。
- `light`：现有城市布面短甲 + 束腿军裤，仍使用原城市作者资产。
- `heavy`：`heavy_armor` + `heavy_armor_skirt`，S6-6 整套重甲步兵候选；上甲568三角形、长甲裳292三角形，不调用 Medium 工厂或增加双份驻地衣甲。

已退役且不得恢复到 Recipe / UI：
- `palace_guard_armor`
- `frontier_lamellar_armor`
- `palace_guard_skirt`
- `frontier_armor_skirt`

中甲上衣由原宫卫甲几何收敛而来；中甲长甲裙由原边军长甲裙几何收敛而来。两者改成中性资产所有权，不保留“皇宫版/边疆版”重复工厂。皇宫/边疆只允许头盔、队长顶饰和三色 palette 不同；不能再次靠厚胸、短裙/长裙、肩宽等复制第二套中甲。

中甲下装仍是腰起、前后跨中线的连续闭合裙甲与真实裤腿出口，使用现有 Hips/Thigh/Knee 静态最多双权重，不增加甲裙骨、布料、碰撞求解或动作豁免。现有全部源键/中点、下身贯穿、Cap、固定身体、inverse bind 门槛保持。

20骨、Recipe V5六字段/七槽位、固定男女和一档低模保持。城市轻甲、三套头盔、军靴和长枪的作者边界不因本次整理重构。Heavy 六款既有头盔同步重做，但映射仅在试衣/preset 层，普通/队长仍只换 headwear。长甲裳不围绕骑乘设计，不改变骑乘运行时。当前裙底与小腿在 jogging/start-walking 中仍有阻塞穿插；未修好并通过正式数值和真实 Canvas 看图前不得合并。原完整检测、所有动作/源键/中点、容差和豁免表不得修改。
