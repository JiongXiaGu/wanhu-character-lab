# 军人甲胄当前作者边界

先读根 `AGENTS.md` 与 `Documentation/军人与甲胄工作流.md`。军人视觉第一轴是甲装等级，驻地 palette/头盔为第二轴，普通/队长只通过 headwear variant 区分。

当前现役等级：
- `light`：`city_guard_brigandine + city_guard_trousers`。
- `medium`：`medium_armor + medium_armor_skirt`，皇宫/边疆共享几何。
- `heavy`：`heavy_armor + heavy_armor_skirt`，六款驻地×身份重盔由 `src/character/wardrobe/heavy-equipment.ts` 提供。

S6-6 正在整体重做 Heavy。目标是重甲步兵：厚重完整上甲、长甲裳/长战裙、明显重盔；不以骑乘适配作为 Heavy 造型目标。不要继续把 Heavy 做成 Medium 加厚或两条宽甲裤，也不要用表面纹理代替大轮廓差异。

## 快速开发通道

每次 Heavy 作者几何迭代不要跑整套发布 Gate：
- 数值：手动运行 Targeted Numeric Checks，scope 选择 `soldier-heavy-authoring`。只检查 Heavy 拓扑、闭合/非流形、有限坐标、骨权重、预算、轮廓与故障反例，不提取动作、不启动浏览器。
- 看图：需要时手动运行 Manual Visual Review，scope 选择 `soldier-heavy-fast`。只生成 Heavy 正/侧/背和 Medium/Heavy 同机位对比四份真实 WebGL 证据。
- 造型方向稳定后再运行 `soldier-heavy-candidate`，此时才做 Heavy motion、完整下身穿插和 focused fitting。
- 正式 PR 才跑完整 light/medium/heavy motion、full browser 与 coverage Gate。

Heavy 专属 `heavy-top.ts`、`heavy-skirt.ts`、`heavy-equipment.ts` 的自动 Targeted 所有权属于 soldier lane，不应仅因目录位于 wardrobe 就触发 riding/mounts。若同一提交修改了 shared wardrobe assembly、rig、Recipe、motion、通用变形或 riding 本身，则仍按共享影响范围跑完整回归。

## 不变量

Recipe 仍为 V5 六字段、七槽位；固定男女、20 骨、最多双权重、inverse bind、Renderer 和 Actor 生命周期不变。不增加甲裙骨、实时布料、战斗/ECS 字段，不为 Heavy 新增动作豁免、放宽穿插阈值或减少源键/中点。

已退役且不得恢复到 Recipe/UI：
- `palace_guard_armor`
- `frontier_lamellar_armor`
- `palace_guard_skirt`
- `frontier_armor_skirt`

Fast/Candidate 只代表对应层通过，不能写成用户美术认可或 main 发布完成。
