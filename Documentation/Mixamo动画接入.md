# Mixamo 外部动画接入 · V3.4

## 当前方向

2026-09-19：用户确认 `动画参考/` 的 11 个 FBX 来自 Mixamo，用于当前实验。人体、服装、装备继续程序生成；主要动画允许外部软件制作，再重定向到现有 20 骨骼。原 Phase4A 程序动作保留为对照，不再默认扩充手写动作。

本轮是「外部 FBX 驱动现有人物」，不是把 Vanguard 参考人物换成正式人物，也不交付完整 Unity Animator / GPU Crowd。

## 使用

```sh
npm ci
npm run dev
```

`predev` / `prebuild` 自动执行 `npm run prepare:mixamo`。脚本离线读取仓库 FBX，不连接 Mixamo，不保留源人物网格或贴图。生成 `public/mixamo/`，这是忽略提交的构建产物。preview 前须先 build。

左侧 **Mixamo 动画** 选择动作。支持暂停、速度、逐帧、重播、完整末帧、人物预设、换装、身高和体格。「源骨架同步对照」左侧是源动画骨架，右侧是当前程序人物；三视图优先显示目标三视图。

任意基础或程序动作可退出 Mixamo。导出配方不变；「导出目标骨架动画 JSON」导出当前体型的 20 骨骼局部轨道。加载失败显示错误和重试，不卸载实验台。

调试 URL：`?mixamo=shooting-arrow&compare=1&paused=1&phase=.45&view=front`。mixamo 优先于旧 action。默认仍为原待机。

## 源文件

11 项：Jogging、Shooting Arrow、Catwalk Walk Forward HighKnees、Punching Bag、Zombie Stand Up、Pilot Flips Switches、Swimming、Hip Hop Dancing、Capoeira、Flair、Brutal Assassination。

实际 FBXLoader 解析：每文件 2 蒙皮网格、130 原始 Bone 节点、65 唯一语义骨骼、1 个 mixamo.com 片段、53 轨道。130 节点包含共享骨骼的同名副本；提取重建唯一骨架，避免 Track 绑定错误节点。

生成 inventory.json 记录文件名、SHA-256、时长、帧数、Three.js 版本。源 FBX 未改写。实验动画不等于每项都适合作为正式游戏动作；发行及原始资产分发权限仍应发行前单独核查。

## 模块

| 模块 | 职责 |
| --- | --- |
| mixamo/catalog.ts | 稳定 ID、文件映射、循环候选、地面策略 |
| scripts/lib/mixamo-fbx.ts | 离线解析、去重骨架、真实 bind、轴转换、源采样 |
| scripts/prepare-mixamo.ts | 校验目录/注册表，生成去网格/贴图的紧凑 JSON |
| mixamo/data.ts | 20 语义映射与 5 辅助端点、协议与输入校验 |
| mixamo/retarget.ts | 当前比例参考姿态校正、局部轨道烘焙、目标导出 |
| mixamo/player.ts | 有限源缓存、统一时间、目标播放、源骨架对照、释放 |
| CharacterViewport / App | 异步切换隔离、错误恢复、相机与 DIY |

## 重定向

绑定姿态来自 SkinCluster inverse bind，不是动作首帧。源 T 姿态映射到目标 A 姿态的网格绑定；目标 inverse bind、Bone ID、Parent Map、权重和几何不变。

源右侧 -X，目标右侧 +X，前方均 +Z。坐标基矩阵共轭转换旋转，不整体转 180°、不交换左右骨骼。厘米转换为米。

源相对绑定的世界旋转差，加目标/源骨段校准，再按目标父级转局部四元数。Spine1 无目标骨骼，对 Spine→Spine2 整段补偿。手/足/头用源端点校准，不增加五指/脚趾。

约 30Hz 源采样，保留末帧，四元数归一化/符号连续。载入或体型变化时烘焙，普通播放只更新轨道与 GPU 蒙皮；源骨架线框是审查路径。

原地播放提取起终点水平线性轨迹，保留骨盆侧摆、上下运动和身体转向。地面动作以人体最低点只向上防穿地，不把跳跃压回地面；游泳不修正地面。这不是脚锁定或任务导航。

循环候选需通过首尾旋转与骨盆误差检查，否则单次保持；不改写末帧假装无缝。实际滑步和接缝仍需看连续播放。

## 装备与限制

原 Recipe 不被外部动作改写。帽子、衣服、鞋、装备仍跟随目标骨架。源武器、椅子、场景不导入；可在 DIY 清空手持物。

**Shooting Arrow 只驱动人体。** 未套用旧程序射箭的弓弦、箭和释放相位。静态短弓仍只是原装备，外部片段的弓弦变形、精确握点、射箭事件未完成。拨开关没有驾驶舱、近身攻击没有第二人、游泳没有水体，不能宣称已完成。

极端动作可能暴露旧模型肩/肘/髋、双权重蒙皮与服装穿模。无五指、手掌 IK、自动道具接触、任意动作混合、导航状态机。与重定向数值正确性分开验收。

## Unity

目标导出 `wanhu-target-motion` v1：源 SHA、重定向版本、米制坐标、体型、20 Bone/Parent/BindLocal、完整时间键、局部 xyzw 四元数、骨盆位置、提取根轨迹。事件和道具数组为空。

Unity 导入器先建相同骨架/蒙皮，明确坐标映射，逐帧比较骨骼与顶点。JSON 不是 Unity AnimationClip/Avatar。局部旋转按 Parent Map 累乘，再与 inverse bind 组合，不能直接当世界矩阵。

缓存至少含源 SHA / 重定向版本 / 骨架版本 / height / build；帽子/颜色不决定动作。先单个 SkinnedMeshRenderer 对照，再做 Blob、GPU Buffer/Texture、实例状态、LOD/剔除。未完成 Unity 导入器、Humanoid Avatar、实体批量或万人性能。

## 验收

```sh
npm run check:mesh
npm run check:actions
npm run build
npm run check:mixamo
npm run review:mixamo
```

Mixamo Retarget Review 只在 GitHub Actions runner 启 preview。11 动作×3 比例完整源时间轴，检查归一四元数、骨段方向、真实蒙皮有限性、几何复用、损坏输入、配方和导出。

独立 11 ID 截图矩阵：正/侧/背/布线与 9 个源/目标关键相位；慢跑、射箭额外真实连续 WebM。测暂停/末帧、切换、换装/体型、JSON 下载、失败返回基础动作。

Artifact `mixamo-retarget-review` 含截图、视频、HTML/JSON、源 SHA 与日志。必须下载实际查看，不能以绿色 Build/骨段误差替代观感。实际 SHA/run/问题记录于 PR 和验收记录。旧 Phase4A/V3 记录是历史证据。
