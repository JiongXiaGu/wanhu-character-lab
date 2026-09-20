# Unity／GPU迁移契约 · V5

## 当前交付不是Unity插件

Web输出固定男女模型数据、Recipe V5、目标动画wanhu-target-motion v2。没有AnimationClip/Avatar导入器、Blob构建、GPU动画纹理、Entities Graphics接入或万人性能结论。迁移数据，不迁移Three.js Mixer。

## 必须保存

SkeletonDefinition：基模ID/bodyProfileVersion、骨骼名/索引/父索引、局部绑定位置/旋转与inverse bind。固定20骨骼，每顶点最多2非零权重。男女绑定位置可不同；衣服使用该基模骨架，不增加独立Animator。单位米，+X右/+Y上/+Z前，Unity端需显式核对坐标与xyzw顺序。

SkinBinding：逻辑顶点、索引、权重、法线/颜色区域、装配部件；修拓扑时升级资源版本。当前固定几何版本wanhu-fixed-garments-v1。

TargetMotion v2：sourceSHA、clipId、retargetVersion、duration、loop、真实time keys、bodyProfile{id,version}、bones、局部旋转轨道、Hips位置与提取的水平根轨迹。无height/build/proportion参数；不兼容旧导出。局部旋转按父关系累乘，最终蒙皮矩阵=世界姿态矩阵×inverse bind。头部校准不重复应用。

## 位移与时间

实例Root世界位移交导航；保留骨盆姿态中的上下/侧摆及转向，不一律清零。源键包含完整末帧；循环与单次保持遵守真实片段元数据。暂停seek只改变视觉，不执行未来业务事件。事件不能因剔除或动画降频丢失。

## 缓存与渲染

目标动画缓存至少包含sourceSHA、clipId、retargetVersion和固定bodyProfile版本。服装变化不改变基模绑定，但仍需验证资产权重与姿态；男女不默认共用最终矩阵。

网格缓存包含固定基模、服装几何/版型版本、slots、hairStyle和颜色。当前顶点色烘焙入网格，不能删除颜色键后宣称已共享。未来参数染色需要另行实现。只一个标准精度，无LOD编号缓存。

未来高矮可在可视实例根部试验等比scale；非等比胖瘦、场景接触不在当前产品契约内。当前未提供scale编辑器。

先单个SkinnedMeshRenderer与Web同相位对照，再做CPU/Burst/GPU一致性、批量渲染、剔除和性能测试。GPU蒙皮不自动等于批量实例化。包围盒须覆盖动作与附件，不只bind；业务逻辑与可见性独立。

## 未完成内容

已有弓盾工具只是骨骼附件；精确握点、弓弦、箭离弦、椅子开关接触、库存/生产/伤害仍属于后续Unity玩法或专项。无实时布料、服装额外骨骼、修正形态系统。髋裆美术问题没有在本次数据重构中修复。
