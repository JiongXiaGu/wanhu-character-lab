# 衣冠工坊 V1 · 实际 Actions 审查图集

源代码提交：`5472912384c637df695a9fa92b2c6f8777014371`。候选代码在 PR #9 / `feat/character-wardrobe-v1`；本证据分支不应合入 main。

## 当前状态

Build、Character Model Review、Mixamo Retarget Review、Wardrobe Review 四项均通过。本图集由 Actions 从该提交的真实 `wardrobe-review` artifact 提取。原始产物为 159 张截图、4 段连续视频。视频另按 4 fps 提取全时段帧序列，共 221 帧。

**仍待视觉验收。** 本轮会话的本地解包/图像读取环境持续超时，备用远程图像读取也失败；没有实际看见图片，因此不能把本图集生成成功写成“已经审图通过”。尚未批准合并 PR #9。

原始检查报告：[source-report.json](source-report.json)；文件与帧序列清单：[manifest.json](manifest.json)。拼图仅裁切、缩放、排列，不重绘或修饰人物；原始 PNG / WebM 仍以源 Actions artifact 为准。

## 普通入口

![普通入口](studio-default.png)

![女性换装界面](studio-female.png)

## 八套搭配正面总览

![八套搭配](eight-looks-front.jpg)

## 全部静态与体型端点

![布衣男](plain-male-static.jpg)
![布衣女](plain-female-static.jpg)
![市井男](town-male-static.jpg)
![市井女](town-female-static.jpg)
![雅居男](elegant-male-static.jpg)
![雅居女](elegant-female-static.jpg)
![礼仪男](ceremony-male-static.jpg)
![礼仪女](ceremony-female-static.jpg)

## FBX 慢跑与射箭关键相位

![布衣男动作](plain-male-motion.jpg)
![布衣女动作](plain-female-motion.jpg)
![市井男动作](town-male-motion.jpg)
![市井女动作](town-female-motion.jpg)
![雅居男动作](elegant-male-motion.jpg)
![雅居女动作](elegant-female-motion.jpg)
![礼仪男动作](ceremony-male-motion.jpg)
![礼仪女动作](ceremony-female-motion.jpg)

## 连续视频全时段帧序列

![男礼衣慢跑1](ceremony-male-jogging-continuous-frames-01.jpg)
![男礼衣慢跑2](ceremony-male-jogging-continuous-frames-02.jpg)
![男礼衣慢跑3](ceremony-male-jogging-continuous-frames-03.jpg)
![男礼衣射箭1](ceremony-male-shooting-arrow-continuous-frames-01.jpg)
![男礼衣射箭2](ceremony-male-shooting-arrow-continuous-frames-02.jpg)
![男礼衣射箭3](ceremony-male-shooting-arrow-continuous-frames-03.jpg)
![女礼衣慢跑1](ceremony-female-jogging-continuous-frames-01.jpg)
![女礼衣慢跑2](ceremony-female-jogging-continuous-frames-02.jpg)
![女礼衣慢跑3](ceremony-female-jogging-continuous-frames-03.jpg)
![女礼衣射箭1](ceremony-female-shooting-arrow-continuous-frames-01.jpg)
![女礼衣射箭2](ceremony-female-shooting-arrow-continuous-frames-02.jpg)
![女礼衣射箭3](ceremony-female-shooting-arrow-continuous-frames-03.jpg)

## 交互与手机

![跨身体混搭](cross-body-diy.png)
![全部搭配不锁身体](all-looks-unlocked.png)
![锁定随机](random-locked.png)
![手机男性](mobile-male.png)
![手机女性](mobile-female.png)

## 继续验收时

先读源分支 AGENTS / README / 玩家角色自定义与服饰分期。实际查看本图集及原视频，重点检查长裙/袍摆的膝部遮蔽、小腿连续性、腰口、肩袖、极端身材；检查默认 UI 和手机人物预览是否可用。发现问题必须改候选分支并重跑相关完整矩阵；不要修改源身体哈希来掩盖变化。合并前重新核对 PR head 与 main，不合并本证据分支。
