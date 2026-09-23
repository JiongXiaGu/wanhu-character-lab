# SystemAnimator GLB 动作接入

XR Animator / SystemAnimator 的录制动作以 GLB 作为正式第二种人物动作源；BVH 路线已移除，不保留兼容代码。源文件放在 `动画参考_glb/`，构建前由 `prepare:system-animator` 递归扫描，生成 `public/system-animator/*.json` 与自动目录；生成数据不提交。

第一阶段只接受已验证的 XR Animator glTF 2.0 结构，协议名为 `system-animator-glb-v1`。提取器读取 GLB 场景层级、真实 Bind Transform 与 Quaternion/Translation 动画，包含外层场景旋转后再按人体左右／上下／前向转换到万户 `+X right / +Y up / +Z forward`。Hips 位移使用真实动画节点位置与 Bind Pose 的差，不使用 BVH OFFSET 规则。

源脊柱 `Spine → Spine1 → Spine2 → Spine3` 不做欧拉角相加；目标 Spine 取源 Spine 的世界 Bind Delta，目标 Chest 取源 Spine3 的世界 Bind Delta。Neck 使用 Neck1（若不存在则 Neck），Head 使用 Head 的世界 Bind Delta，因此不根据 Neck/Head 关键帧数值相同而删除 Head 轨道。

GLB 中的 Mesh、材质、Skin、手指和表情不进入当前 Web 运行时；只离线抽取人体动作。手指与面部数据暂时忽略，但原 GLB 保留为源资产。Web 默认使用 in-place 预览：平面线性轨迹拆为 `rootTrajectory`，局部 Hips 摆动和高度继续进入姿态。

G1 使用固定 Ground Baseline，而不是逐帧把角色向上顶。自动检查记录源 Foot/Toe 最低点，但不做平滑、Foot Contact、Foot IK 或 Foot Lock；这些属于后续 Mocap Cleanup，不能用滤波掩盖重定向错误。

Mixamo FBX 与 XR Animator GLB 最终都输出同一个 `HumanoidMotionData`，由 `src/character/motion/data.ts`、`retarget.ts`、`player.ts` 统一消费。最终 Unity 不在运行时解析 GLB，而应继续将目标 20 骨轨道离线烘焙为共享动画数据。
