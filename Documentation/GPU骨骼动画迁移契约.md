> **V2.1 单一标准模型更新（本轮实施，实际验收见《标准低模髋裆修正》）：** 当前LOD2升级为唯一标准精度，旧LOD0/LOD1细分路径与UI已删除。保留旧lod参数仅作归一兼容，不产生另一个网格。衣面新增共享索引髋根环和四角裆底，仅局部平滑法线；源人体/20骨骼/双权重/FBX/Recipe V4不变。下文旧LOD数量和旧裆点结构只属于历史版本，不作为当前实现。

# GPU 骨骼动画迁移契约 · 衣冠工坊 V2

## 当前服饰版本

当前为连续裤式分裳；旧V1双层裙壳和整段隐藏大腿的策略已退役，不能再作为迁移端遮挡规则。几何版本 `wanhu-tailoring-v2-continuous-2`，衣面语义 `wanhu-tailoring-no-duplicate-lining-v2`。

源人体闭合510tris保持；可见主衣面克隆源拓扑，使用静态腰髋/膝褶窝与双权重改善深屈曲，不同时绘制内腿与外裙两层。裆点由双大腿各半权重驱动；衣面校正发生在标准制作空间，再统一应用体型场。源人体、骨架及FBX不随衣物改写。

LOD0/1/2只控制服饰几何细分，使用相同20骨骼、部件ID和动画相位，不写入Recipe。不能宣称完成全人物低模、人群性能、自动屏幕占比切换或动画LOD。细分不能改变连续衣面语义；每级实际动画都需检查。

衣服、三色染色、发髻、配方V4继续共用生成器。当前颜色仍烘焙到顶点色，颜色必须参与现有网格缓存键。Unity参数染色与跨颜色共享网格尚需实现。服装不创建独立Animator。

全部FBX从 `动画参考/` 自动扫描；当前23份，inventory.json包含totalFiles/prepared/clips/failures。提取缺失必须显式失败，不忽略新增资源。

## 状态

当前网页是程序人物+外部FBX局部轨道；旧程序动作已删除。迁移的是SkeletonDefinition、Bind Pose、SkinBinding、局部轨道与未来事件/道具语义，不是Three.js AnimationMixer。Unity正式实现未完成。

## 固定数据

20 Bone ID与Parent Map固定，详见运行时人物生成架构。每顶点最多2非零影响，逻辑 `[BoneA,BoneB,WeightA]`；硬法线/颜色拆点不改变绑定。单位米、+X人物右/+Y上/+Z前。Unity适配器必须显式验证坐标与四元数xyzw，不原样猜坐标。

SkeletonDefinition：Version、BoneSemantic、ParentIndex、BindLocalPosition/Rotation、InverseBindMatrix。身材相同语义不代表绑定位置相同。

TargetMotion：源SHA、retargetVersion、skeletonVersion、calibrationProfile、ClipId、Duration、Loop、实际TimeKeys、每骨局部旋转、Hips局部位置、提取根轨迹。局部旋转须按父关系累乘，最终蒙皮=姿态世界骨矩阵×inverse bind，不能把局部四元数直接当世界矩阵。

导出仍为wanhu-target-motion v1，重定向版本wanhu-mixamo-2。头部直接遵循源相对真实绑定的旋转差；HeadTop_End不决定脸向。不要额外套一次校准。events/props目前为空，JSON不是UnityClip/Avatar/Blob。

## 位移、时间与事件

Root表示实例世界变换，导航负责世界运动。当前提取起终点水平线性轨迹，保留骨盆侧摆、上下、真实转身。不能清零所有Hips位置；这是原地化策略，不是脚锁。

源时间键包含完整末帧，不假设所有采样等间隔。四元数归一/符号连续并正确slerp。循环仅在首尾误差门槛通过时允许，否则单次末帧保持。

未来业务事件应按(previousTime,currentTime]执行，seek只改变视觉不结算业务，跨帧/循环不漏不重。事件逻辑时钟不得因剔除/LOD降低更新而停止。当前不包含库存/生产/伤害/独立投射物。

## 道具

当前DIY为已有骨骼附件，衣物共享骨架，无独立Animator。外部射箭未制作弓弦/箭/释放与精确握点，不能称人体导出已包含完整射箭。

未来PropClip保存GeometryKey、独立节点局部轨道/离散可见性、Grip/Contact/Release锚点。道具不是人体骨骼，不应塞进每居民20骨纹理。离弦箭交独立世界投射物，不再跟随人物。原Phase4A道具时间不可用于新FBX。

## 缓存

AnimationBakeKey至少：源SHA、ClipId、retargetVersion、SkeletonVersion、BodyProportionKey/height/build。校准升级须使缓存失效；不得无验证跨体型共享最终矩阵。可后续按有限体型分桶，但先验证手足接触。

CharacterMeshKey：TopologyVersion、BodyProportionKey、量化height/build、SlotRecipe、GarmentGeometryVersion、BodyHideVersion、LOD。Web颜色仍写顶点，未经分离不能从几何键排除palette/dyes/hairColor。

单居民目标保存Transform、MeshKey、外观、ClipId/Phase/Speed/Flags，共享只读Clip与Mesh；不默认N个Animator+N套GameObject骨架。

## Unity分阶段

先单人SkinnedMeshRenderer，用相同骨架/蒙皮/源时刻检查骨骼和顶点；再做CPU/Burst参考采样与GPU一致性；最后加入批量实例/剔除/LOD并Profile。

GPU可评估Clip×Frame×Bone的float3x4/half3x4矩阵，或Quaternion+Translation。前者带宽高但直接，后者需重建和父级求解；必须测精度和目标设备开销。批量绘制与GPU蒙皮不是同一回事。

包围盒应覆盖整段动画与工具，不只静态bind；远景可降采样、简化工具、减少骨骼，但要有重映射且事件不漏。默认不加布料或五指。

尚未实现MeshData/Burst、Avatar/Clip导入、Skeleton/Motion/Prop Blob、GPU Buffer/Texture Bake、Crowd Shader、Entities Graphics接入、动画LOD、共享缓存、万人性能。网页测试不能替代这些Unity验收。

## V3.6 身体配置补充

Recipe V4新增bodyType（缺省male）；女性profileVersion=wanhu-body-profiles-v1，与男性共用拓扑和骨骼语义，绑定位置可不同。网格键和目标动画键都必须包含bodyType/profileVersion/height/build。男性12套几何哈希保持6627c2e基线；女性通过独立比例、头脸、低髻实现，不是只换衣服。详细范围及验收矩阵见女性角色接入.md。
