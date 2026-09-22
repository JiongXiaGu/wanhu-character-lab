# AGENTS · 衣冠工坊V5、马匹与骑乘

## 接手

这是wanhu-character-lab的3D换装、FBX试衣、马匹与骑乘Web实验，不是头像或UI原型。先核对最新main、任务分支、PR与Actions，再读README、工作交接、马鞍与缰绳、骑乘与坐骑挂接、低模马与基础四足动画、服装Cap封闭实验、头饰闭合与安全留量、短裤封边与连续裙装、固定基模与换装V5、服装生成架构、轻便服饰与头饰安全留量、运行时人物生成架构、Mixamo动画接入、男性FBX校正、GPU骨骼动画迁移契约与GitHubActions截图验收规范。不要用聊天历史SHA覆盖远端新提交。

## 马与骑乘边界

M1经PR #20合入main，M2经PR #28合入，用户认可基本骑乘并明确批准M3马鞍／缰绳及推送main。旧“不做人骑马／不做马具”的阶段限制不再是当前门槛；这仍不授权上下马或坐骑玩法。

马本体在src/horse，入口?lab=horse，1524三角形／806逻辑点／25骨骼／最多双权重，硬边拆点4572。网格m1-v1、绑定和动作m1-v2不改。Horse_Idle／Walk／Run／Eat四动作必须保留。

骑乘是src/riding组合层，入口?lab=riding。动物工坊只有马匹本体／骑乘试衣两个模式；复用makeCharacter与makeActor，不新造骑手人体，不把马塞进Recipe V5或人物七槽位。人20骨与马25骨各自独立；普通Group RiderSeat跟随Spine，RiderRoot处理人体绑定原点到坐面的偏移。Actor先独立绑定，再挂接；挂接后禁止重新bind、重算inverse bind或调用Skeleton.pose。骨盆不能直接落在鞍面而忽略男女坐面距离。

静态跨坐、Rider_Idle／Walk／Run是现有骑乘范围。骑手局部轨道在创建时烘焙；马播放器是唯一时钟。每帧先采样马，再同相位采样人，最后更新缰绳，不复制马背升降、不再累加第二时钟。换动作复用网格；换装／换男女仅替换骑手并重挂掌心，保留马、绳、相位、循环与相机。骑乘姿态不恢复原人物程序动作目录，不作为FBX失败回退，不改原人物FBX重定向。

## 马鞍与缰绳

用户已否定多槽位马具方案。UI和选择状态只有horseId与saddleId；当前chestnut一匹马，none／simple／travel三个马鞍选项。鞍垫、侧袋、后卷毯、辔头、脚蹬都是整套资产内部零件，不增加槽位、第三个页面、MountLoadout协议、库存或可编辑mountable。能否骑由有效马鞍推导；不展示未制作的黑马灰马等占位资产。

src/horse/saddles拥有作者网格、目录、坐面和装配；SaddleRoot刚性随Spine，BridleRoot随Head，稳定RiderSeat为Spine下兄弟挂点，按所选马鞍设置偏移。替换马鞍只替换马具，不重建马或人物、不重置相机与进度、不改变人物配方。马具为闭合作者小壳，不以单面纸片、临时删面或实时物理回避问题。

src/riding/reins只维护固定拓扑双绳缓冲；嘴环／颈侧／掌心三个语义点派生曲线，先变换到整马局部空间，同帧更新原数组。禁止逐帧new BufferGeometry／TubeGeometry、绳索物理或手部IK。男女掌心挂点在创建／换装时设置；手掌只有原低模块面，不宣称手指弯曲已实现。简化脚蹬不做脚部IK。

none在骑乘页移除马具、隐藏人物／人物骨架／绳并冻结骑乘；保留原配方、动作与相位以便装回后恢复。none期间保留隐藏骑手仅为页面缓存，卸载必须全释放。马本体页无鞍仍能播放四动作；有鞍无骑手时只显示辔头，不生成悬空持缰绳。二级页面携带当前马鞍，不静默把none改成simple。

新资产版本wanhu-saddles-m3-v1和骑姿wanhu-rider-pose-m3-v1不升级人物Recipe。职责、坐标、生命周期和有限相交边界集中于《马鞍与缰绳.md》。不做上下马、骑射、坐骑控制、导航、Root Motion正式移动、实时贴蹄、尾巴／包袋物理或通用Quadruped平台。

## 自动检查边界

check:horse保留网格／绑定／964姿态与地面失败门槛及五个故障注入。蹄低于-0.012米、头穿地、Eat最低头部不在0.01–0.12米均失败；不得把首稿4厘米入地降为仅诊断。

check:riding保留男女三动作1446稠密姿态、70衣裤组合、骨盆与膝脚范围、真实蒙皮、实例变换、换装保相位、网格复用和释放；四类故障男女各一次。check:saddles新增双基模×两马鞍×三动作×121相位、四个马本体动作各121相位，检查闭合壳、颜色、端点、头颈躯干中心线穿越、none冻结和释放。嘴环6毫米制作接触不扩大为整马或整个绳免检。

check:riding-browser和check:saddles-browser只做真实桌面交互，不截图。有限中心线与构造检查不是所有三角面／所有连续时刻零穿插证明。连续封底裙保持可选但标明骑乘边界，不自动换裤、不拆裙、不删封底；手持物不静默删除，冲突提示不能冒称已经支持持械骑射。

## 人物不变量

两个固定成年男女，一档原LOD2低模精度。Recipe V5精确六字段version/bodyType/slots/dyes/hairStyle/hairColor，七槽位完整。只读V5存储键；用户文件经parseRecipeFile严格验证，createRecipe仅内部构造；不恢复旧协议兼容。保留人物工坊推荐、跨男女混搭、发型帽饰、配色、seed、锁定、撤销、保存与文件往返。骑乘只读明确保存的装扮，不静默覆盖人物存档。

20骨骼语义、索引与父关系不变，每顶点最多两非零权重；米制，+X右/+Y上/+Z前。男女绑定位置可不同，服装共享基模骨架，不新增服装Animator，不未经验证共用男女最终矩阵。颜色仍进入网格缓存。

正式路径Recipe→固定基模／资产注册→作者接口封闭→装配→CharacterData→rig→viewport；FBX→离线提取→retarget→局部轨道→player。patterns只注册，assets拥有几何与静态权重，seal-interfaces只在创建时封闭显式接口，assembly做固定覆盖，adornments拥有冠髻／头饰作者网格，headwear-fit只做一次性帽壳留量。无通用外部Mesh导入器，不恢复tailoring或人体衣面fallback。

## 人物生产基线

正式衣柜为7上衣／5下装／1鞋，body仅内部裸模哨兵；10张搭配灵感保留，基础搭配整组已删除。上衣work_vest、short_work_jacket、rough_tunic、cross_jacket、layered_vest、ceremony_robe、farmer_tunic；下装short_trousers、true_short_skirt、long_skirt、work_pants、work_wrap；鞋cloth_shoes。guard_light_armor、archer_tunic、loose_trousers、guard_pants、archer_pants、pleated_skirt、robe_skirt、short_skirt、boots已退役，不恢复隐藏选项或fallback。

两条真裙仍为连续12段裙壳和12片固定扇面封底，腰口已补齐。服装wanhu-modular-garments-v9，皮肤wanhu-skin-cage-v3，绑定wanhu-fixed-bodies-v1；不改Recipe。短裙／短裤只遮pelvis/thigh，长裙再遮shin；背心／短褂只遮torso，裸露手臂和小腿不能整块删除。

所有正式makeTop/makeTrousers/makeFootwear输出必须零openings并带完整sealedInterfaces：上衣4口、裤装3口、连续裙腰口、布鞋2口。seal-interfaces复用顶点和权重并处理共线切点，不增加运行时补洞、布料或人体切割。上衣封口primary；长裤及裙腰用原裤布／腰头secondary；已认可work_vest、short_trousers、cloth_shoes不重做。完整预算集中于服装Cap文档。

除none外头饰必须零开放边、无非流形边、保持Head刚性权重。草帽和玉簪沿用闭合结构；轻盔、包巾、方冠为帽身色底盖；额前束带为闭合薄实体。只有指定帽底允许头部／头发固定制作接触，帽侧和帽顶不豁免。头饰wanhu-headwear-closed-v3，详见头饰文档。

普通站立、行走、起步、轻跑和坐姿是日常裙装用途；Snatch深蹲举重与极端大开腿、高踢、翻滚属于低运动服饰边界，不以一字马阻塞资产。短裤没有动作豁免。骑乘裙装限制独立记录，不反向放宽原人物普通动作验收。

## 人物制作与检查

服装主导，不为每件衣服重做人体。不扩身材模板、儿童老人、多档LOD、旧人物程序动作库、裙骨链、实时布料、逐帧碰撞、全身IK或GPU Crowd。当前马具任务不改源人体、绑定、上传FBX、参考模型、头发或帽饰。PR #12失败方案不合入／拣选。

仅按明确covers不绘制内部皮肤；不按动画临时删面，不改光照或源动作伪造通过。差异大的服饰可有专用拓扑，上衣含自身领袖腰带，不无限叠穿槽。

原相交算法、容差、全部源键／中点和压力动作保持；样本数量随现役目录计算。短裤Cuff与可见shin、连续裙HemCenter与末端Hem/HemInset/HemFacing或皮肤shin的既有接口仅离线窄范围分类。原始／接口／其他交点分列，不能宣称全为0或泛化整件免检。普通动作非接口穿插阻塞，两条连续裙Snatch只作压力观察。

动态扫描全部FBX，不固定数量，失败明确报错。真实inverse bind，不以首帧替代；保留头部相对bind完整旋转差，不将HeadTop_End当脸前向或锁俯仰。换装／男女切换保持暂停相位，切动画复用网格。

## 审图与交付

默认修改→代码／数值／交互检查→交付用户体验。仅用户要求视觉审查、建立视觉基线或纯视觉问题时才运行本地／runner截图；不能每轮自动生成大矩阵并逐张代替用户判断。review:local各原入口与--full按需保留。

三条正式Actions不增加：Build & Core Checks；Targeted Numeric Checks（Wardrobe/Mixamo/Tailoring/Horse/Riding/Saddles及交互）；手动Manual Visual Review。Package／workflow变更仍全数值回归。sourceSHA、runner中断、取消、成功分清；不能放宽故障注入、源键／中点、绑定保护或穿插阈值来加速。

记录实际受测SHA、结果与是否实际看图。不把生成截图写成人工验收，不把runner浏览器写成本机测试。合并前重读最新HEAD，保留并发提交。
