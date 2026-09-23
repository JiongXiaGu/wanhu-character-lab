# SystemAnimator GLB 动作接入

XR Animator / SystemAnimator 的 GLB 是当前第二条人物动作源，与 Mixamo FBX 并列。BVH 实验已退出工程，不再维护兼容路径。

源文件位于 `动画参考_glb/`。构建前 `prepare:system-animator` 只解析 GLB 的节点、真实 Bind Pose 与 Animation，不把源 Mesh、Skin、材质或表情数据带入运行时。当前固定识别 `system-animator-glb-v1`：单动画、XRAnimator 命名、Hips/Spine/Spine3/Neck/Head、双臂与双腿语义骨骼必须完整；结构不匹配时明确失败，不做万能 GLB 猜测。

GLB 保持米制和 Quaternion。离线提取先按源 Bind World Transform 计算每个语义骨骼的 World Delta，再用人体左右、上下与脚尖方向统一到 +X右/+Y上/+Z前。外层 180° Y 旋转因此作为源坐标系的一部分被规范化，不硬编码特例。Hips Translation 使用真实动画位置与 Bind Position 的差；平面起终点轨迹单独进入 RootTrajectory，Web 试衣保留局部摆动与高度。

## Bind-Delta Retarget

SystemAnimator 已经提供相对真实 Bind Pose 的世界旋转差，因此目标角色直接使用：

`TargetWorld(t) = SourceWorldDelta(t) × TargetBindWorld`

万户当前 20 骨的 Bind Rotation 为 Identity，所以运行时等价于直接把标准坐标系中的 Source World Delta 作为目标世界旋转，再由目标父子层级还原 Local Rotation。XR Animator 不再使用 Mixamo 的“目标骨段方向 → 源 Bind 骨段方向”静态校准；否则会把 Hips→Spine 的短斜骨和源 A/T Pose 手臂方向永久叠加到万户自己的 Bind Pose 上，大动作时会被明显放大。

SystemAnimator 的 Spine→Spine1→Spine2→Spine3 不用局部欧拉角相加。目标 Spine 采样源 Spine 世界姿态，目标 Chest 采样源 Spine3 世界姿态。Neck 与 Head 即使局部 Quaternion 数值相同也都保留，禁止按“重复轨道”清零。

G1/G2 当前只做固定 Ground Baseline 与 Bind-Delta Retarget：以整片低位样本确定一次固定抬升，不逐帧把角色顶回地面，因此跳跃和下蹲高度不被压平。检查脚本会报告主关节单帧 >30°、多关节同时异常和 Hips 最大单帧位移，用于区分源动捕问题与重定向问题；这些指标当前只诊断，不静默平滑或修改源动作。

Foot Contact、Foot Lock、IK、Root outlier repair 与旋转平滑仍属于后续 Mocap Cleanup。比如源 GLB 本身出现持续的 170° 前臂翻转时，不应由 Retarget 层伪装成正常动作。

Web 动作库统一显示 Mixamo 与 XR Animator，播放、暂停、循环、逐帧、时间轴、源骨架对照、目标骨架叠加和目标 20 骨导出共用同一套 motion player。最终 Unity 不运行时解析 GLB；GLB 只作为离线源资产，后续烘焙到共享的 20 骨动画数据 / BlobAsset。
