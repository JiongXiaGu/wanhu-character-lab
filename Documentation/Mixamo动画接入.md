# Mixamo 外部动画接入 · V3.6

## 正式路径

用户上传的11份Mixamo FBX用于实验。程序生成人体/衣服/装备，外部FBX是唯一动画来源；旧程序动作已删除。男女使用独立身体比例，共用固定骨架与全部FBX。

`npm ci && npm run dev`；predev/prebuild自动离线prepare:mixamo，输出public/mixamo，忽略提交。不联网下载、不携带源网格/贴图，不改原FBX。

默认慢跑。支持暂停/变速/进度/逐帧/重播/完整末帧、DIY与体型、源骨架同步、头部朝向检查、目标动画JSON。静态bind仅重置绑定，不启动动画；加载失败显示错误/重试。切换FBX保留几何，改Recipe才重建。

调试URL：`?mixamo=shooting-arrow&compare=1&paused=1&phase=.45&view=side&headwear=none&headAxes=1`。静态：`?pose=bind`。旧action/motion参数不再启用程序动作。

## 源文件

Jogging、Shooting Arrow、Catwalk Walk Forward HighKnees、Punching Bag、Zombie Stand Up、Pilot Flips Switches、Swimming、Hip Hop Dancing、Capoeira、Flair、Brutal Assassination。

当前每文件2蒙皮网格、130原始Bone节点、65唯一语义骨骼、1片段/53轨道。共享同名骨骼副本在提取阶段去重，避免绑定错误节点。inventory记录文件名/SHA256/时长/帧数/Three版本。所有源文件与catalog和独立review矩阵须一致。

## 提取与校准

绑定来自SkinCluster inverse bind，不能取首帧。源右侧-X到目标+X通过基矩阵共轭，保留+Z前，厘米转米；不整体转180°或交换左右。源T姿态适配目标A绑定，不更换目标inverse bind。

源世界旋转差加目标/源骨段校准，再按目标父关系还原局部四元数；源Spine1折叠到Spine→Chest整段。手脚端点用于校准，**头顶端点不用于脸向**。Head直接保留源相对bind的旋转差，修复额外5.456°低头，见男性FBX校正.md。

约30Hz提取，保留末帧/归一/符号连续。烘焙在载入或体型改变时进行，不逐帧全身IK。原地化剥离线性水平趋势，保留骨盆侧摆、高度、转体；地面策略只向上防穿地，不压低跳跃，游泳不做地面修正。这不是脚锁。

循环候选须通过首尾旋转与骨盆误差检查，否则单次保持，不篡改末帧伪造无缝。源骨架/头轴为CPU审查路径。

## 模块

catalog.ts：稳定ID/文件/循环/地面策略。scripts/lib/mixamo-fbx.ts：解析/去重/真实bind/坐标采样。prepare-mixamo.ts：目录校验与产物。data.ts：20语义骨骼+5调试端点协议。retarget.ts：当前体型校准/烘焙/导出。player.ts：有限源缓存/唯一时钟/源对照/释放。

## 边界与Unity

配方不被动画重写；静态装备继续跟骨骼。源武器/场景/第二人物未导入。Shooting Arrow只驱动人体，弓弦/箭/释放事件/精确握点未重制；不能挪用旧程序相位。无五指、手掌IK、脚锁、自动接触、任意混合、任务导航；极端姿态可能有蒙皮/服装自交。

目标JSON wanhu-target-motion v1包含源SHA、retargetVersion=wanhu-mixamo-2、skeletonVersion、calibrationProfile、当前体型、20骨绑定/局部轨道、完整时间键/根轨迹；事件/道具为空。不是UnityClip/Avatar/Blob。先单人逐帧对照再做群体/LOD/性能；缓存包含源SHA/版本/体型。

来源记录保留Mixamo与用户原文件名，当前仅实验；发行和原始文件分发授权需发布前另行核查，不以接入成功宣称授权审查完成。

## 验收

check:retired、check:mesh、build、check:mixamo。Actions只运行本地preview，不部署。11×2×3全源帧+全顶点检查；头部全四元数和辅助点扰动独立测试。11动作四视图/9相位，头部近景、4连续视频、DIY/快速切换/几何复用/错误重试/导出。下载实际审查后才能合main，数值通过不等于美术全部通过。

## V3.6 身体配置补充

Recipe V4新增bodyType（缺省male）；女性profileVersion=wanhu-body-profiles-v1，与男性共用拓扑和骨骼语义，绑定位置可不同。网格键和目标动画键都必须包含bodyType/profileVersion/height/build。男性12套几何哈希保持6627c2e基线；女性通过独立比例、头脸、低髻实现，不是只换衣服。详细范围及验收矩阵见女性角色接入.md。
