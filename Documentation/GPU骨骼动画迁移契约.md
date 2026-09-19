# GPU 骨骼动画迁移契约 · V3.5 / FBX

## 状态

当前网页是程序人物+外部FBX局部轨道；旧程序动作已删除。迁移的是SkeletonDefinition、Bind Pose、SkinBinding、局部轨道与未来事件/道具语义，不是Three.js AnimationMixer。Unity正式实现未完成。

## 固定数据

20 Bone ID与Parent Map固定，详见运行时人物生成架构。每顶点最多2非零影响，逻辑 `[BoneA,BoneB,WeightA]`；硬法线/颜色拆点不改变绑定。单位米、+X人物右/+Y上/+Z前。Unity适配器必须显式验证坐标与四元数xyzw，不原样猜坐标。

SkeletonDefinition：Version、BoneSemantic、ParentIndex、BindLocalPosition/Rotation、InverseBindMatrix。身材相同语义不代表绑定位置相同。

TargetMotion：源SHA、retargetVersion、skeletonVersion、calibrationProfile、ClipId、Duration、Loop、实际TimeKeys、每骨局部旋转、Hips局部位置、提取根轨迹。局部旋转须按父关系累乘，最终蒙皮=姿态世界骨矩阵×inverse bind，不能把局部四元数直接当世界矩阵。

导出仍为wanhu-target-motion v1，重定向升级wanhu-mixamo-2。头部直接遵循源相对真实绑定的旋转差；HeadTop_End不决定脸向。不要额外套一次校准。events/props目前为空，JSON不是UnityClip/Avatar/Blob。

## 位移、时间与事件

Root表示实例世界变换，导航负责世界运动。当前提取起终点水平线性轨迹，保留骨盆侧摆、上下、真实转身。不能清零所有Hips位置；这是原地化策略，不是脚锁。

源时间键包含完整末帧，不假设所有采样等间隔。四元数归一/符号连续并正确slerp。循环仅在首尾误差门槛通过时允许，否则单次末帧保持。

未来业务事件应按(previousTime,currentTime]执行，seek只改变视觉不结算业务，跨帧/循环不漏不重。事件逻辑时钟不得因剔除/LOD降低更新而停止。当前不包含库存/生产/伤害/独立投射物。

## 道具

当前DIY为已有骨骼附件，衣物共享骨架，无独立Animator。外部射箭未制作弓弦/箭/释放与精确握点，不能称人体导出已包含完整射箭。

未来PropClip保存GeometryKey、独立节点局部轨道/离散可见性、Grip/Contact/Release锚点。道具不是人体骨骼，不应塞进每居民20骨纹理。离弦箭交独立世界投射物，不再跟随人物。原Phase4A道具时间不可用于新FBX。

## 缓存

AnimationBakeKey至少：源SHA、ClipId、retargetVersion、SkeletonVersion、BodyProportionKey/height/build。校准升级须使缓存失效；不得无验证跨体型共享最终矩阵。可后续按有限体型分桶，但先验证手足接触。

CharacterMeshKey：TopologyVersion、BodyProportionKey、量化height/build、SlotRecipe、LOD。Web颜色仍写顶点，未经分离不能从几何键排除palette。

单居民目标保存Transform、MeshKey、外观、ClipId/Phase/Speed/Flags，共享只读Clip与Mesh；不默认N个Animator+N套GameObject骨架。

## Unity分阶段

先单人SkinnedMeshRenderer，用相同骨架/蒙皮/源时刻检查骨骼和顶点；再做CPU/Burst参考采样与GPU一致性；最后加入批量实例/剔除/LOD并Profile。

GPU可评估Clip×Frame×Bone的float3x4/half3x4矩阵，或Quaternion+Translation。前者带宽高但直接，后者需重建和父级求解；必须测精度和目标设备开销。批量绘制与GPU蒙皮不是同一回事。

包围盒应覆盖整段动画与工具，不只静态bind；远景可降采样、简化工具、减少骨骼，但要有重映射且事件不漏。默认不加布料或五指。

尚未实现MeshData/Burst、Avatar/Clip导入、Skeleton/Motion/Prop Blob、GPU Buffer/Texture Bake、Crowd Shader、Entities Graphics接入、动画LOD、共享缓存、万人性能。网页测试不能替代这些Unity验收。
