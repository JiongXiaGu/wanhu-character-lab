# SystemAnimator GLB 动作接入

XR Animator / SystemAnimator 的 GLB 是当前第二条人物动作源，与 Mixamo FBX 并列。BVH 实验已退出工程，不再维护兼容路径。

源文件位于 `动画参考_glb/`。构建前 `prepare:system-animator` 只解析 GLB 的节点、真实 Bind Pose 与 Animation，不把源 Mesh、Skin、材质或表情数据带入运行时。当前固定识别 `system-animator-glb-v1`：单动画、XRAnimator 命名、Hips/Spine/Spine3/Neck/Head、双臂与双腿语义骨骼必须完整；结构不匹配时明确失败，不做万能 GLB 猜测。

GLB 保持米制和 Quaternion。离线提取按源 Bind World Transform 计算每个语义骨骼的 World Delta，再用人体左右、上下与脚尖方向统一到 +X右/+Y上/+Z前。Hips Translation 使用真实动画位置与 Bind Position 的差；平面起终点轨迹单独进入 RootTrajectory。

## Retarget Pose 与 World Delta

XR Animator 的人体 Rest Pose 与万户固定基模不同：源手臂接近横展，万户是下垂 A-Pose。如果只把 Source World Delta 原样施加给目标，UpperArm / Forearm 会出现约 50–60° 的系统性方向误差，最终表现为手的位置严重偏离源动作。

因此对应骨段使用稳定的 Retarget-Pose Alignment：

`TargetWorld(t) = SourceWorldDelta(t) × Align(TargetBindSegment → SourceBindSegment)`

UpperArm、Forearm、Clavicle、Spine、Chest、Neck、腿和脚都按稳定语义骨段建立一次静态对齐。这样目标骨段在每个时刻都与源动作对应骨段方向一致，同时仍保留万户自己的骨长和网格。

Hips 是明确例外。XR Animator 的 `Hips→Spine` 是极短的斜段，当前样本会产生约 46° 的虚假静态倾角，因此 Hips 只使用 Source World Delta，不做骨段方向对齐。Head 继续直接传递 World Delta，不用头顶端点猜面朝向。

SystemAnimator 的 Spine→Spine1→Spine2→Spine3 不做局部欧拉角相加。目标 Spine 采样源 Spine 世界姿态，目标 Chest 采样源 Spine3 世界姿态。Neck 与 Head 即使局部 Quaternion 数值相同也都保留。

检查脚本除数据合法性外，会直接比较源/目标 UpperArm 与 Forearm 的实际世界骨段方向；这是手腕位置正确性的结构性回归，不能再用“Quaternion 有限”代替。另继续报告主关节单帧 >30°、多关节同时异常和 Hips 最大单帧位移，用于区分源动捕问题与 Retarget 问题。

当前不静默修复源动作的 tracking failure。Foot Contact、Foot Lock、IK、Root outlier repair 与旋转平滑属于后续 Mocap Cleanup。
