# 万户 · 衣冠工坊 V2

《万户天工》玩家／居民角色换装与 FBX 试衣工作台。玩家和城市居民共用外观配方；职业、生产、导航等游戏玩法在 Unity 实现。服装偏写意，优先稳定轮廓、可组合性与后续 LOD，不依赖实时布料。

## 本地体验

Node.js 22.12+。拉取 main 后双击 `Start-Local.cmd`，或：

```sh
npm ci
npm run dev
```

普通入口默认静态试衣。左侧选择男女、身材和推荐搭配；右侧换衣、染色、发式及动作测试库；中央切换视角、LOD、暂停、进度、逐帧检查。

## 新增 FBX

将 FBX 放进 `动画参考/`（支持子目录），重启开发服务或运行 `npm run prepare:mixamo` 后重启。构建同样自动扫描。源文件不能静默略过；缺骨骼、缺真实绑定数据或提取失败会输出文件名并使构建失败。不要用首帧猜 bind，不恢复程序动作。

动作库支持中英文／文件名搜索、分类、收藏、上一个／下一个；坐姿拨动开关、射箭、慢跑提供快捷入口。当前补充后的 23 份文件均参与扫描；原 11 个动作 ID 保留。抓举用于搬举压力测试，不是已经完成锄地、推车或生产交互。新增未知动作默认单次保持，不擅自假设循环。

## V2 服饰与 LOD

在允许美术简化的前提下，裙袍改为**连续裤式分裳**：用整体衣面、外侧放量、腰线和大色块表达层次，不再叠加独立裙壳和完整内裤造成衣层互穿。保留腰裆、大腿、小腿的连续表面，不通过整段删腿或 DoubleSide 盖住错误。

这是写意分裳／阔裤路线，不是原来宽大连筒裙的等价升级。八套推荐、七槽位、自由跨体型混搭、三色染色、发髻、收藏式保存和 Recipe V4 导入导出保持。动作不更改装扮。

LOD0／LOD1／LOD2 是真实衣物几何等级；保持同一配方、20骨骼、双权重和暂停相位。源男女人体仍为510tris，头发和装备未全面降面；不是最终全人物 Crowd LOD，也没有自动距离切换或万人性能结论。

## 检查与交付

```sh
npm run check:retired
npm run check:mesh
npm run build
npm run check:mixamo
npm run check:wardrobe
npm run check:tailoring
```

五条 Actions：Build、Character Model Review、Mixamo Retarget Review、Wardrobe Review、Tailoring V2 Review。按真实目录逐动作检查，重点包含 Pilot Flips Switches、射箭、慢跑、抓举。必须核对报告、下载实际截图和完整视频时间序列后再判断视觉结果，不能把有限值／闭合拓扑通过当作无自交证明。

只在 Actions runner 启动 Preview，不部署 Visual／Vercel。当前候选的实际审核状态以 PR 和 [V2实施与验收](Documentation/服装动画适配V2.md) 为准，不把历史 V1 的绿色报告当作 V2 已完成。

## 文档

- [V2实施与验收](Documentation/服装动画适配V2.md)
- [换装工作台使用](Documentation/换装工作台使用.md)
- [服装生成架构](Documentation/服装生成架构.md)
- [Unity / GPU迁移契约](Documentation/GPU骨骼动画迁移契约.md)
- [工作交接](Documentation/工作交接.md)

导出 Recipe 不是模型文件；导出目标骨架 JSON 不是 Unity AnimationClip／Avatar／Blob 插件。没有新增实时布料、修正形态系统、裙骨、游戏业务事件。任意极端动作、道具接触、脸型DIY、儿童老人、完整宫廷服饰、Unity导入器与GPU群体运行仍在后续范围。
