# GPU 骨骼动画迁移契约 · V3.3 / Phase 4A

## 1. 目的与状态

迁移目标是固定 Skeleton、Bind Pose、SkinBinding、局部 Motion 轨道、Action 事件与道具锚点，不是 Three.js AnimationMixer 的类层级。

当前网页已有同一 20 骨骼的人体、基础动作，以及 17 个劳动/射箭 Action 入口。正常播放不重建人体 Mesh；主体使用 SkinnedMesh GPU skinning。结构线 Debug Overlay 与自动检查中的 CPU 蒙皮不是生产角色路径。

Unity 正式实现仍未完成。本文的 Blob、GPU Buffer、LOD、共享缓存与 ECS 字段是迁移契约和目标，不是仓库里已经能调用的 Unity 包。

## 2. 数据链与坐标

```text
CharacterData / Recipe
→ Joint[] / Bind Pose / SkinBinding
→ 构建期 FK + IK / 动作采样
→ 人体局部骨骼轨道 + 道具节点轨道 + ActionDefinition
→ Web AnimationMixer / SkinnedMesh / 独立道具

未来 Unity：相同数据语义 → Clip Sampler / GPU Bake → GPU Skinning + 道具实例
```

+X 是人物右侧，+Y 向上，+Z 是人物正前方。Root 是角色根节点，Hips 保存姿态内的位移；当前动作原地播放，导航负责世界位移。以后 Root Motion 必须是独立策略，不能反转 +Z 约定。

## 3. 固定 SkeletonDefinition

Bone ID 和 Parent Map 是协议，不能随职业、衣服或体型更改。动作道具节点不增加人体骨骼。

| ID | 语义 | ID | 语义 |
| ---: | --- | ---: | --- |
| 0 | Root | 10 | LeftClavicle |
| 1 | Hips | 11 | LeftUpperArm |
| 2 | Spine | 12 | LeftForearm |
| 3 | Chest | 13 | LeftHand |
| 4 | Neck | 14 | RightThigh |
| 5 | Head | 15 | RightShin |
| 6 | RightClavicle | 16 | RightFoot |
| 7 | RightUpperArm | 17 | LeftThigh |
| 8 | RightForearm | 18 | LeftShin |
| 9 | RightHand | 19 | LeftFoot |

```text
SkeletonDefinition
  Version / BoneCount / BoneSemantic[] / ParentIndex[]
  BindLocalPosition[] / BindLocalRotation[] / InverseBindMatrix[]
```

目标为 BlobAsset 或其他共享只读配置。骨骼语义相同不代表所有体型的 Bind Position 完全相同，缓存中必须区分实际骨架比例。

## 4. SkinBinding

逻辑权重为 `[BoneA, BoneB, WeightA]`，WeightB = 1 − WeightA。每顶点最多两个非零 Influence，索引合法、权重非负且和为 1；刚性顶点允许重复索引、WeightA=1。

Web 为标准接口写入 ushort4 skinIndex / float4 skinWeight，但只有前两通道有效。Unity 可评估 Bone0/Bone1 为 byte 或 ushort、Weight0 为 UNorm8/half 的紧凑布局。固定 20 骨骼的索引可容于 byte；若将来协议扩展必须重新检查范围。

硬法线、颜色拆点会增加渲染顶点，不改变逻辑 cage 的连通性和权重规则。

## 5. MotionClip 与 ActionDefinition

```text
MotionClip
  ClipId / Duration / SampleRate / Loop / RootMotionPolicy
  BoneTracks[]: BoneId / RotationKeys / 必要的 TranslationKeys

ActionDefinition
  ActionId / Duration / Loop / Hold
  Stages[] / Events[]: Phase, SemanticId
  RequiredProp / OccupiedSlots / ReviewPhases
```

基础 Motion 仍为 Bind/Idle/Walk/Run/Wave/Squat。Walk 1.1 秒、约 30FPS 采样；Run 0.72 秒。新的劳动/射箭通常按约 60FPS 构建；射箭额外纳入精确事件相位，因此轨道时间不应一概假定为等间隔。

网页源轨道是局部四元数和必要位置，不是最终世界矩阵。Unity 可选择压缩关键帧 + CPU/Burst 求骨骼，或重新采样到等间隔 Animation Texture/Buffer；二者必须使用相同骨架与事件语义。

Action 的 `mask: upper/full` 当前只是元数据。常用组合已烘焙成全身片段；没有现成通用分层混合器。

## 6. Phase 4A 道具轨道不能丢失

仅导出人体 20 骨骼不能还原当前射箭、抓握与搬运。还需要：

```text
PropClip
  PropId / GeometryKey / RootLocalNodeTracks[]
  节点 Position / Rotation / Scale / Visibility
  GripAnchors[] / ContactAnchors[] / ReleaseAnchor
```

劳动道具以 WorkObject 位姿为主；弓有弓臂、两段弓弦、箭的独立节点。节点属于道具，不是人体 Bone ID。Unity 可将道具另作刚性实例/简单变形，不应把所有道具节点塞入每位居民的人体骨骼纹理。

人体与道具使用同一 ActionId 和相位。Root-local 道具轨道需乘角色世界变换；骨骼局部轨道则需按 Parent Map 求全局骨架变换，二者不能混淆。

箭可见性是离散状态，不要用可见/不可见两帧的线性插值让箭慢慢缩小。弓弦和箭的事件相位必须与人体采样保持同步。

当前网页箭仍是原地角色预览下的节点动画。正式游戏在 arrow_released 时应取世界释放位置/方向，交给独立投射物系统；不能让已射出的箭继续跟随移动角色。这一世界投射物系统尚未实现。

## 7. 循环、单次、保持与事件

循环持续按相位播放；单次到末帧结束；Hold 到末帧后仍保持、不标记完成。真实播放事件使用 `(previousTime,currentTime]`，支持跨帧与跨循环。一支箭只触发一次释放，取消瞄准无释放事件。

编辑器/网页 seek 只采样视觉状态，不执行业务事件。暂停零增量不能重复派发；单次结束不能取模回开头或反复释放。

目标 ECS 状态可包含：

```text
ResidentAnimationState
  ClipId / Phase / Speed / PlaybackFlags
  可选 Transition

ActionEventCursor
  ActionInstanceId / PreviousTime / CycleOrEventCursor
```

事件游标是逻辑时钟，不能由可见性或动画 LOD 决定是否更新。角色被剔除或降低动画帧率，不应漏掉生产完成/射箭事件。当前网页只验证语义事件，不包含库存、生产或伤害结算。

## 8. 行走方向与相位

Walk 必须保持：0% 右脚在 +Z 前触地、右臂后摆；25% 左脚抬起向 +Z；50% 左脚在前触地；75% 右脚抬起向前。同侧手臂与腿不能同向摆动，不能出现月球步。

劳动步态沿用“支撑脚向后、摆动脚抬起向前”的方向语义。手被工具占用时不要求普通摆臂，但不能因此反转脚的相位。

## 9. 缓存键：不能只用 SkeletonVersion + ClipId

Phase 4A 的采样明确依赖 `joints` 和 `recipe.height/build`。手臂可达范围、道具高度、掌心偏移与 Hips 位移会随比例变化。

因此，未经归一化与误差验证，不能给所有体型直接共享同一份已烘焙 ActionClip。建议初始缓存键：

```text
AnimationBakeKey
  SkeletonVersion / BodyProportionKey
  QuantizedHeight / QuantizedBuild
  ActionId / ActionContentVersion / ActionParameters

CharacterMeshKey
  BodyTopologyVersion / BodyProportionKey
  QuantizedHeight / QuantizedBuild / SlotRecipe / LOD
```

将来可以通过归一化骨长、体型分桶或验证过的重定向减少 Clip 数量，但必须重新检查抓握误差与脚底。当前没有实现该共享缓存。

Web 的颜色目前写入顶点颜色；未来把颜色改为独立实例/材质参数后，才可可靠地从几何缓存键排除配色。单个居民最终应只持有 Transform、MeshKey、外观参数与少量动画状态，而不是独占一整份骨骼/网格/轨道。

## 10. GPU Bake 目标

可评估两类存储：

```text
Clip × Frame × Bone → float3x4 / half3x4 Matrix
或
Clip × Frame × Bone → Quaternion + Translation
```

矩阵读取直接，带宽较高；旋转/平移需要重建与正确插值。局部四元数需要处理符号半球、归一化和 Parent Map；最终蒙皮使用姿态全局骨矩阵与 inverse bind，不可把局部旋转当世界骨矩阵直接乘顶点。

GPU 使用 ClipId/Frame0/Frame1/插值权重取样。具体压缩、纹理或 StructuredBuffer 布局必须在 Unity 中对照 CPU Reference Pose 和目标硬件测量后决定，不在网页阶段宣称性能结论。

## 11. LOD 路径

LOD0 先用 SkinnedMeshRenderer + 20 Bone + Unity Animation/自研采样验证正确性，再做批量路径。

LOD1 可评估较少骨骼、低面数与降更新频率，但需要重映射表；抓握和持弓动作不能因删掉关键手骨而失效。

Crowd 目标为共享 Clip 数据、轻量实例状态、GPU Skinning、Entities Graphics 与剔除，而不是默认 N 个 Animator + N 套 GameObject 骨骼层级。

动画包围盒需覆盖道具与动作轨迹，不能只用静态人体 Bind Pose 包围盒。远景道具可减少细节或隐藏，但逻辑事件仍运行。以上 LOD/批量绘制路径均未完成。

## 12. 服装与附件

Recipe V4 的 preset 只是一键组合，缓存与渲染应读取实际 slots。BodyDerived 服装继承对应人体权重；原有刚性附件绑定已有骨骼。动作道具使用本文件第 6 节独立轨道。

换帽子、衣服或手持物不能创建另一套人体骨骼语义。默认不加入布料模拟或五指骨架。独立轮廓服装优先使用已有 Body Bones，只有明确需要时才讨论辅助骨骼和新的版本协议。

## 13. Unity 结构草案

```text
SkeletonDefinitionBlob: ParentIndex[], BindPosition[], BindRotation[], InverseBind[]
MotionClipBlob: Duration, TimeKeys/SampleRate, TrackOffsets[], Rotation/TranslationSamples[]
ActionDefinitionBlob: Playback, Stage/EventOffsets, PropBinding
PropClipBlob: NodeTracks, VisibilityKeys, Anchors
CharacterSkinBlob: Bone0[], Bone1[], Weight0[]
ResidentAnimationState: ClipId, Phase, Speed, Flags
```

这些名称是方向性草案。最终字段与精度通过 Unity Profile 决定，网页导出的 Recipe JSON 不是上述 Blob 或完整动画资源导出器。

## 14. 迁移验收

检查固定 Bone ID/Parent Map、Bind Pose 一致性、两个 Influence/归一权重/合法索引；循环首尾、+Z 步态、有限坐标与不退化三角形；单次/保持/seek/事件边界；人体-道具抓握误差；满弓与拾放接缝；GPU 与 CPU 姿态在容差内一致；不同相位实例批量显示；动画 LOD/剔除不丢语义事件。

当前 Web 自动检查和 Actions 截图是参考用例，不自动证明 Unity 实现通过。人体 20 骨骼被保留，不等于“万人 GPU 动画已经完成”。

## 15. 当前未完成

Unity MeshData/Burst、SkeletonDefinitionBlob、MotionClipBlob、PropClipBlob、GPU/CPU 一致性测试、Animation Texture Bake、Crowd Shader、Entities Graphics 接入、动画 LOD、共享缓存和万人 Profile 均未实现。

世界导航、跨动作物品生命周期、任意姿势平滑中断、通用分层混合、正式目标瞄准与独立投射物也不属于本轮已交付能力。当前动作实现与审查范围见 `动作系统架构.md`、`Phase4A使用与验收.md`。
