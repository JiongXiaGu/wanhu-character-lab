# Wanhu Character Lab · V3

《万户天工》低多边形人物网页实验台。

当前可以使用同一套连续人体、固定骨架和运行时生成规则切换农户、卫兵、弓手与基础人体，并播放基础骨骼动作。

## 视觉验收方式

本仓库不使用 Visual / Vercel 部署做人物视觉验收。`vercel.json` 仅用于设置 `git.deploymentEnabled=false`，阻止已连接的 Vercel Git 集成继续自动部署。

GitHub Actions 会在 runner 内启动本地 Vite Preview，由 Playwright 自动截图并上传 Artifact。每个已实现动作必须有截图覆盖。Agent 应先自行下载并审查截图，确认模型、蒙皮、道具和动作没有明显问题后再通知用户验收。

详见：

`Documentation/GitHubActions截图验收规范.md`

## 本地使用

安装 Node.js 22.12+。

拉取 main 后双击根目录：

`Start-Local.cmd`

手动运行：

~~~sh
npm ci
npm run dev
~~~

构建与检查：

~~~sh
npm run check:mesh
npm run build
~~~

## 当前功能

- 连续、封闭、四边面主导的固定三维人体 cage。
- 基础人体 510 triangles / 257 逻辑顶点。
- 固定 20 骨骼，职业和体型不改变 Bone ID / Parent Map。
- 每顶点最多两个非零权重。
- Three.js SkinnedMesh 主体走 GPU skinning；AnimationMixer 只负责 Web 动画播放。
- 待机、行走、慢跑、招手、屈膝、静态 A-Pose。
- 农户、卫兵、弓手预设；预设只是默认组合，头饰、上衣、下装、鞋、背部、左右手可以任意 DIY。
- 身高、体格和三组布料配色；Recipe JSON 导出。
- 同屏正 / 侧 / 背三视图、素模、结构布线、三角线框、骨骼叠加和 PNG 截图。

当前默认预算：

- 基础人体：510 tris
- 默认农户（含斗笠，无农具）：675 tris
- 农户带农具：699 tris
- 卫兵带剑盾：806 tris
- 弓手带弓和箭袋：805 tris

渲染顶点由于硬法线 / 颜色拆点会大于逻辑顶点，界面分别统计。

## Recipe V4 · Slot DIY

当前导出 Recipe 已升级到 Version 4：

```text
preset
slots.headwear
slots.top
slots.bottom
slots.shoes
slots.back
slots.leftHand
slots.rightHand
height
build
palette
```

例如“弓手 + 农户草帽”：

```json
{
  "version": 4,
  "preset": "custom",
  "slots": {
    "headwear": "farmer_straw_hat",
    "top": "archer_tunic",
    "bottom": "archer_pants",
    "shoes": "boots",
    "back": "archer_quiver",
    "leftHand": "archer_bow",
    "rightHand": "none"
  }
}
```

旧版 URL / Recipe 的 `outfit / hat / equipment` 仍能读取并迁移。

## 动画方向约定

统一坐标：

~~~text
+X = 人物右侧
+Y = 向上
+Z = 人物正前方
~~~

Walk / Run 是原地动作，导航系统负责角色世界位移。

Walk 当前回归检查：

~~~text
0%   右脚前触地，右臂后摆
25%  左脚抬起向前摆
50%  左脚前触地
75%  右脚抬起向前摆
~~~

这条规则用于防止“月球步 / 倒着走”回归。

## Unity 迁移方向

网页的 Three.js AnimationMixer 不会直接迁移到 Unity。

正式共用的数据语义是：

~~~text
SkeletonDefinition
SkinBinding
MotionClip
AnimationState
~~~

近景先验证常规 GPU Skinning。

中远景 Crowd 目标：

~~~text
ResidentAnimationState
→ ClipId / Phase / Speed
→ Animation Texture / Bone Buffer
→ Entities Graphics
→ GPU Skinning
~~~

详细见：

`Documentation/GPU骨骼动画迁移契约.md`

## 阅读顺序

1. AGENTS.md
2. Documentation/工作交接.md
3. Documentation/项目概览.md
4. Documentation/运行时人物生成架构.md
5. Documentation/GPU骨骼动画迁移契约.md
6. Documentation/服装生成架构.md
7. Documentation/动作系统架构.md
8. Documentation/GitHubActions截图验收规范.md
9. Documentation/V3验收记录.md

## 当前边界

这是人物重构 + 基础动作网页验证阶段，不是已经完成 Unity 生产运行时。

尚未完成：

- Unity MeshData / Burst 实现
- SkeletonDefinitionBlob / MotionClipBlob
- Entities GPU Skinning
- Animation Texture / Bone Buffer
- Animation LOD
- Mesh Cache
- 万人性能验证
- 战斗 / 拉弓射击动画
- 完整长袍与宽袖系统
- 五指抓握
- 自动 Humanoid Avatar 映射
