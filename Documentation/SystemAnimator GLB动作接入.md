# SystemAnimator GLB 动作接入

XR Animator / SystemAnimator 的 GLB 是当前第二条人物动作源，与 Mixamo FBX 并列。BVH 实验已退出工程，不再维护兼容路径。

源文件位于 `动画参考_glb/`。构建前 `prepare:system-animator` 只解析 GLB 的节点、真实 Bind Pose 与 Animation，不把源 Mesh、Skin、材质或表情数据带入运行时。当前固定识别 `system-animator-glb-v1`：单动画、XRAnimator 命名、Hips/Spine/Spine3/Neck/Head、双臂与双腿语义骨骼必须完整；结构不匹配时明确失败，不做万能 GLB 猜测。

GLB 保持米制和 Quaternion。离线提取先按源 Bind World Transform 计算每个语义骨骼的 World Delta，再用人体左右、上下与脚尖方向统一到 +X右/+Y上/+Z前。外层 180° Y 旋转因此作为源坐标系的一部分被规范化，不硬编码特例。Hips Translation 使用真实动画位置与 Bind Position 的差；平面起终点轨迹单独进入 RootTrajectory，Web 试衣保留局部摆动与高度。

SystemAnimator 的 Spine→Spine1→Spine2→Spine3 不用局部欧拉角相加。目标 Spine 采样源 Spine 世界姿态，目标 Chest 采样源 Spine3 世界姿态。Neck 与 Head 即使局部 Quaternion 数值相同也都保留，禁止按“重复轨道”清零。

G1 只做固定 Ground Baseline：以整片低位样本确定一次固定抬升，不逐帧把角色顶回地面，因此跳跃和下蹲高度不被压平。脚底/脚趾最低点记录为诊断；Foot Contact、Foot Lock、IK 与旋转平滑属于后续 Mocap Cleanup，不在本阶段伪装为已解决。

Web 动作库统一显示 Mixamo 与 XR Animator，播放、暂停、循环、逐帧、时间轴、源骨架对照、目标骨架叠加和目标 20 骨导出共用同一套 motion player。最终 Unity 不运行时解析 GLB；GLB 只作为离线源资产，后续烘焙到共享的 20 骨动画数据 / BlobAsset。
