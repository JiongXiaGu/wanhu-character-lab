# AGENTS · 衣冠工坊 V5

接手先读取最新main及README、固定基模与换装V5、玩家角色自定义与服饰分期、换装工作台使用、服装生成架构、运行时人物生成架构、Mixamo动画接入、男性FBX校正、GPU骨骼动画迁移契约、GitHubActions截图验收规范、工作交接，再改代码。

## 用户最新决定（覆盖历史约束）

固定男性／女性基模，原LOD2单一标准精度，重点服饰混搭与丰富度。连续身高、胖瘦、体格模板、三档LOD和旧配方兼容均删除。Git保留历史，不留旧实现或fallback。不要重新实现通用身材编辑器，也不要只隐藏UI而保留旧参数。

人体网格可在明确的美术任务中修改；固定的是骨架语义与导出契约，不是旧顶点或旧哈希。V5重构使用16套旧LOD2黄金样本仅证明本次无造型回归，不是未来禁止修模。PR #12失败补面不合入。

## 正式路径

Recipe V5 → 固定基模／服饰版型／部件装配 → CharacterData → rig → viewport。
FBX → prepare:mixamo离线提取 → retarget →目标局部轨道→player。只用外部FBX，不恢复手写Motion、Action或静态姿势隐式动画。

Recipe精确字段version=5、bodyType、slots、dyes、hairStyle、hairColor；不存职业、preset、height、build、palette、LOD。内部createRecipe不是文件验证器；用户文件必须parseRecipeFile严格验证，不迁移不补字段。七槽位保留，上衣包含领袖腰带。推荐只是一次性赋值，不按性别锁衣服。新存储键只读V5。

固定20 Bone ID/Parent Map，+X右/+Y上/+Z前，每顶点最多2个非零权重。不用DoubleSide、删掉失败测试、改FBX或照亮黑洞掩盖网格问题。男女绑定可不同；固定基模衣服共享该基模骨架，不为服装创建独立Animator。相同骨名不能自动证明最终矩阵可共享。

## 美术与工程边界

服饰偏写意、无拖尾／大悬垂层默认需求。尺寸是patterns.ts中的美术数据，不向玩家暴露连续调节。相似版型可复用，大差异服装允许独立拓扑和权重；不要要求所有新衣服必须由同一个人体形变公式生成。当前仍复用身体衣面，只完成数据分离，尚未提供外部服装网格导入器。

不加入实时布料、逐帧避碰、全身IK、动态身体缩放工具、儿童老人或游戏业务。已有武器只作附件展示，精确握点/弓弦/投射物并未实现。

## 动画与审查

自动扫描全部FBX，不静默忽略错误；真实inverse bind，非首帧。HeadTop_End不代表脸前向，保留头部相对真实bind的完整旋转差，不能每动作硬抬头或锁俯仰。

换衣／男女切换保留暂停相位，切换动画不重建网格。常用动作：Pilot Flips Switches、Shooting Arrow、Jogging、Snatch、Start Walking。深蹲不能因难修删除。拓扑、有限值、贯穿检查与视觉审查分开报告。

执行：读文档→实现→check:retired/check:mesh/build/check:mixamo/check:wardrobe/check:tailoring→五条Actions→下载实际截图与完整时间采样→修正重跑→合main。测试矩阵为两个固定基模；删除已退役参数的重复组合，但保留同一动作、采样密度、检测算法和误差阈值。工作台导入旧配方必须报错且保留当前角色。

不预写Actions通过，不用生成图片代替真实截图。记录受测SHA/run/局限，代码变化须重审。只在runner预览；不部署Visual/Vercel。锁依赖npm ci，不强推、不覆盖并发修改。历史文档已清理，需追溯用git，不再建立平行旧规范。
