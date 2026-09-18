# GPU 骨骼动画迁移契约

## 1. 目的

本文件定义 Wanhu Character Lab V3 与 Unity 正式人物运行时之间的动画数据契约。

目标不是复用 Three.js 的 AnimationMixer API，而是复用：

- 固定 Skeleton 语义；
- Bind Pose；
- 顶点 Bone Index / Weight；
- Motion Clip 的骨骼局部变换；
- Animation State；
- LOD 骨骼与动画语义。

当前 Web Demo 已经证明：

- 连续低模人体可以共用固定 20 骨骼；
- 每顶点最多两个非零权重；
- 角色 Mesh 不需要逐帧重建；
- 主体角色使用 SkinnedMesh GPU skinning；
- 待机 / 行走 / 慢跑 / 招手 / 屈膝 / Bind Pose 可以在同一骨架上播放；
- 行走方向语义固定为 +Z = 人物前方。

Unity 正式实现仍未完成，本文件定义的是迁移接口和目标架构。

---

## 2. 当前 Web 动画链

当前网页：

~~~text
CharacterData
→ Joint[]
→ Three.js Bone[]
→ Skeleton
→ skinIndex / skinWeight
→ AnimationClip
→ AnimationMixer
→ SkinnedMesh
→ GPU Skinning
~~~

主体 Mesh 的顶点位置不会由 CPU 每帧重建。

当前 CPU 逐帧计算蒙皮位置的代码只用于：

- 结构布线 Debug Overlay；
- 自动动作验证；
- 浏览器审查辅助。

这些 Debug 路径不属于 Unity 正式角色运行时。

---

## 3. 坐标与方向约定

必须长期保持：

~~~text
+X = 人物右侧
+Y = 向上
+Z = 人物正前方
~~~

Root 位于角色根节点。

Hips 是主体运动骨骼。

当前 walk / run 为原地动画：

- 动画负责骨骼相位；
- 游戏导航负责世界位移；
- 不在 Clip 内写角色前进距离。

如果以后增加 Root Motion，必须使用独立 Motion Policy，不能改变 +Z 前方语义。

---

## 4. 固定 SkeletonDefinition

当前 Bone ID 是协议的一部分，不允许职业、服装或体型改变顺序。

| Bone ID | Semantic |
| ---: | --- |
| 0 | Root |
| 1 | Hips |
| 2 | Spine |
| 3 | Chest |
| 4 | Neck |
| 5 | Head |
| 6 | RightClavicle |
| 7 | RightUpperArm |
| 8 | RightForearm |
| 9 | RightHand |
| 10 | LeftClavicle |
| 11 | LeftUpperArm |
| 12 | LeftForearm |
| 13 | LeftHand |
| 14 | RightThigh |
| 15 | RightShin |
| 16 | RightFoot |
| 17 | LeftThigh |
| 18 | LeftShin |
| 19 | LeftFoot |

Unity 建议建立：

~~~text
SkeletonDefinition
├─ Version
├─ BoneCount
├─ BoneSemantic[]
├─ ParentIndex[]
├─ BindLocalPosition[]
├─ BindLocalRotation[]
└─ InverseBindMatrix[]
~~~

SkeletonDefinition 应进入 BlobAsset / 共享只读配置。

---

## 5. SkinBinding

当前 Web 逻辑权重：

~~~text
Weight = [BoneA, BoneB, WeightA]

WeightB = 1 - WeightA
~~~

正式约束：

- 每顶点最多两个非零 Bone Influence；
- Bone0 / Bone1 必须在 SkeletonDefinition 范围内；
- Weight0 ∈ [0, 1]；
- Weight1 = 1 - Weight0；
- 刚性顶点允许 Bone0 == Bone1 且 Weight0 = 1。

Web 当前为了兼容 Three.js 标准接口写入：

~~~text
skinIndex  = ushort4
skinWeight = float4
~~~

但只有前两个通道有效。

Unity Crowd 路径建议紧凑保存：

~~~text
Bone0   : byte / ushort
Bone1   : byte / ushort
Weight0 : UNorm8 / half
~~~

是否最终使用 byte 取决于统一 Skeleton 是否保持 < 256 bones。

当前 20 bones 可以安全使用 byte。

---

## 6. MotionClip 契约

网页当前在角色构建时生成 Quaternion KeyframeTrack，并由 AnimationMixer 插值。

Unity 正式数据不应依赖 AnimationMixer。

推荐抽象：

~~~text
MotionClip
├─ ClipId
├─ Duration
├─ SampleRate
├─ Loop
├─ RootMotionPolicy
└─ BoneTracks[]
   ├─ BoneId
   ├─ RotationKeys
   └─ TranslationKeys   // 只有需要的骨骼保存
~~~

当前 Motion：

- Bind
- Idle
- Walk
- Run
- Wave
- Squat

当前 Walk：

- 1.1 秒；
- 约 30 FPS 采样；
- 循环；
- Hips 有 Translation Track；
- 20 Bone 有 Rotation Track。

Run：

- 0.72 秒；
- 循环。

以后 Unity 可以：

1. 保留压缩关键帧并 CPU 求骨骼；
2. 或预烘焙成 GPU Animation Texture / Buffer。

两种方案必须使用同一 MotionClip 语义。

---

## 7. 行走相位约束

当前已修复一次“视觉像倒着走”的错误，因此把步态方向作为协议锁定。

Walk 必须满足：

~~~text
Phase 0.00
右脚位于 +Z 前方并接触地面
右臂位于后方

Phase 0.25
左脚处于抬起并向 +Z 摆动阶段

Phase 0.50
左脚位于 +Z 前方并接触地面

Phase 0.75
右脚处于抬起并向 +Z 摆动阶段
~~~

同侧手臂与腿不得同向前摆。

CI 当前已经检查这一语义。

以后重做动画系统时必须保留对应测试，不能只检查 Clip 能循环。

---

## 8. AnimationState

大量居民不应各自保存完整骨骼状态。

建议 ECS：

~~~text
ResidentAnimationState
├─ ClipId       : ushort
├─ Phase        : float / ushort normalized
├─ Speed        : half / float
├─ Flags
└─ Transition   : optional
~~~

基础状态只描述：

- 播什么；
- 播到哪里；
- 播多快。

固定 Skeleton、Clip 数据和 SkinBinding 都应共享。

---

## 9. Unity LOD 动画路径

### LOD0：近景角色

适用：

- 玩家近距离观察；
- 第一人称靠近；
- 需要完整服装轮廓和动作。

第一阶段可直接使用：

~~~text
SkinnedMeshRenderer
+ 20 Bone Skeleton
+ Unity Animation / 自研 Clip Sampler
+ GPU Vertex Skinning
~~~

这里的目标是先验证 Unity 版本的人体、蒙皮与动作正确。

不要在第一步就把所有优化一起做完。

### LOD1：中距离

建议：

- 继续使用 GPU Skinning；
- 骨骼可以减少到 12–15；
- Hand / Clavicle 等细节可按动作需求简化；
- 降低 Mesh LOD；
- 减少动画更新频率。

### LOD2 / Crowd：大量居民

不推荐：

~~~text
N 个 Resident
→ N 个 Animator
→ N 套 Transform Bone Hierarchy
~~~

推荐目标：

~~~text
ResidentAnimationState
→ ClipId / Phase / Speed
→ GPU Animation Texture / StructuredBuffer
→ Bone Transform
→ GPU Skinning
→ Entities Graphics
~~~

CPU 不为每个远景居民维护完整 GameObject Bone Transform Hierarchy。

---

## 10. GPU Animation Bake

Crowd 路径可以把 MotionClip 预烘焙。

概念：

~~~text
Clip
× Frame
× Bone
→ Rotation + Translation
~~~

GPU 读取：

~~~text
Instance AnimationState
├─ ClipId
├─ Phase
└─ Speed

→ Frame0 / Frame1
→ 插值 Bone Transform
→ Skin Vertex
~~~

存储候选：

### Bone Matrix

简单直接：

~~~text
float3x4 / half3x4
~~~

优点：Shader 简单。

缺点：带宽较高。

### Rotation + Translation

推荐后续优先评估：

~~~text
Quaternion + Translation
~~~

例如：

~~~text
half4 rotation
half3 translation
~~~

GPU 重建矩阵。

20 bones 的角色非常适合评估这种布局。

---

## 11. Mesh / Animation Cache

几何和动画必须分开缓存。

### Geometry Key

例如：

~~~text
CharacterMeshKey
├─ BodyTopologyVersion
├─ QuantizedHeight
├─ QuantizedBuild
├─ SlotRecipe
├─ Hat
├─ Equipment
└─ LOD
~~~

颜色尽量不进入 Geometry Key。

### Animation Clip

按 SkeletonVersion + ClipId 共享。

### Instance

单个居民只持有：

~~~text
Transform
CharacterMeshKey
Appearance / Material Parameters
AnimationState
~~~

这样几千居民可以共享少量 Mesh 与 Motion 数据。

---

## 12. 服装与 GPU 动画

服装不能拥有独立的人体骨架语义。

Recipe V4 的 preset 只用于一键填充；GPU / Cache 层应读取实际 slots。换帽子、上衣或手持物不能创建另一套 SkeletonDefinition。

当前以及后续都要求：

- Body；
- Shirt；
- Pants；
- Armor；
- Hat；
- Weapon Attachment；

共享同一 SkeletonDefinition。

BodyDerived 服装继承对应人体权重。

Rigid Attachment 绑定单 Bone。

Independent Silhouette Garment 默认也只使用现有 Body Bones；只有明确需要时才增加少量 Garment Helper Bones。

大量居民默认不做 Cloth Simulation。

---

## 13. Web 与 Unity 的职责边界

### Web 保留

- 人体 / 服装 Recipe；
- Skeleton 语义；
- SkinBinding；
- Motion 语义；
- 三视图；
- 动作视觉审查；
- 自动测试；
- GPU 动画协议实验。

### Unity 重写

- MeshData；
- BlobAsset；
- Burst / Jobs；
- ECS Animation State；
- GPU Bone Buffer / Animation Texture；
- Entities Graphics；
- LOD；
- Culling；
- Mesh Cache；
- 实际性能 Profile。

不要把 Three.js AnimationMixer API 直接翻译成 Unity 类层级。

---

## 14. Unity 推荐数据结构

方向性草案：

~~~text
SkeletonDefinitionBlob
{
    ParentIndex[]
    BindPosition[]
    BindRotation[]
    InverseBind[]
}

MotionClipBlob
{
    Duration
    SampleRate
    BoneTrackOffsets[]
    RotationSamples[]
    TranslationSamples[]
}

CharacterSkinBlob
{
    Bone0[]
    Bone1[]
    Weight0[]
}

ResidentAnimationState : IComponentData
{
    ClipId
    Phase
    Speed
}
~~~

最终字段类型必须在 Unity Profile 后确定。

---

## 15. 验证要求

迁移到 Unity 后，至少复用以下验证语义：

### Skeleton

- Bone Count 固定；
- Parent Map 固定；
- Bone ID 不因职业 / 体型变化；
- Bind Pose 重建后顶点一致。

### Skin

- 最多两个非零 Influence；
- Weight 和为 1；
- Bone Index 合法；
- 不出现 NaN / Inf。

### Motion

- Loop 首尾一致；
- Walk +Z 方向正确；
- 左右腿交替；
- 手腿反相；
- 动画中 Triangle 不退化；
- Motion 切换不产生骨骼爆炸。

### Crowd

- 同 Clip / 不同 Phase 实例可批量绘制；
- GPU 与 CPU Reference Pose 在允许误差内一致；
- LOD 切换不改变 Skeleton 语义；
- Culling 不因动画包围盒错误导致人物消失。

---

## 16. 当前尚未完成

当前仓库尚未实现：

- Unity SkeletonDefinitionBlob；
- Unity MotionClipBlob；
- Entities GPU Skinning；
- Animation Texture Bake；
- GPU Crowd Shader；
- Animation LOD；
- GPU / CPU 结果一致性测试；
- 万人场景 Profile。

当前 Web Demo 只是把数据语义和人物/动画正确性验证到可以开始 Unity 对照实现的程度。
