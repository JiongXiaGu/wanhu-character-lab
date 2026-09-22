# AGENTS · 衣冠工坊V5与马匹实验

## 接手

这是wanhu-character-lab的3D换装与FBX试衣项目，不是头像或UI原型。先核对最新main、任务分支、PR和Actions，再读README、工作交接、低模马与基础四足动画、短裤封边与连续裙装、固定基模与换装V5、服装生成架构、轻便服饰与头饰安全留量、运行时人物生成架构、Mixamo动画接入、男性FBX校正、GPU骨骼动画迁移契约、GitHubActions截图验收规范。不要用聊天历史SHA覆盖新提交。

## 当前M1边界

马是独立Horse Lab，入口?lab=horse，代码在src/horse。1524三角形／806逻辑点／25骨骼／最多双权重，渲染硬边拆点4572。网格m1-v1，骨架和动作m1-v2；该资源版本不是人物Recipe版本。四动作Horse_Idle／Horse_Walk／Horse_Run／Horse_Eat必须保留。

先让用户验收马本体，未经确认不得合并、不得自动进入M2。不做人骑马、Rider动画、上下马、人物绑定、马具、坐骑控制、其他动物、行为树、导航、Root Motion正式移动、实时IK、贴蹄或尾巴物理。RiderSeat／DismountLeft／Right只在设计文档预留。不得把horse塞进Recipe V5或人物七槽位，不借动物任务回去修人体／裙装／源FBX。

geometry负责制作外形和静态权重，rig负责绑定，skinning负责渲染装配，animation只在创建时烘焙局部轨道，player负责标准Mixer采样。不要做通用Quadruped平台。人物与马共用clip-clock时间游标和review:local启动器；原人物播放器只做等价游标抽取，不改FBX采样、重定向、导出和末帧语义。

npm run check:horse包括网格／绑定／964姿态采样及地面高度失败门槛，保留五个故障注入。蹄低于-0.012m、头穿地、Eat最低头部不在0.01–0.12m均失败；这是平面低模实验容差，不是零滑步／零相交证明。首稿4cm入地不得回退成仅诊断不失败。

`npm run check:horse`属于代码辅助检查；当`src/horse/**`等相关路径变化时由Targeted Numeric Checks自动执行。马匹截图不再随每个PR自动生成；只有用户明确要求视觉审查时，才运行`npm run review:local -- --horse`或手动触发Manual Visual Review。截图生成与视觉通过必须分开记录，最终外观判断由用户完成。

## 人物不变量

固定成年男女，一档原LOD2低模精度。Recipe V5精确六字段version/bodyType/slots/dyes/hairStyle/hairColor，七槽位完整。只读V5存储键，用户文件经parseRecipeFile严格验证，createRecipe仅内部构造；不恢复旧协议兼容。保留推荐、跨男女混搭、三色发色、发型帽饰、seed、锁定、撤销、保存与文件往返。

20骨骼语义、索引与父关系不变，每顶点最多两非零权重；单位米、+X右/+Y上/+Z前。男女绑定位置可不同，衣服共享该基模骨架，不新增Animator，不未经验证共用男女最终矩阵。颜色仍进入网格缓存。

正式路径Recipe→固定基模／资产注册→装配→CharacterData→rig→viewport；FBX→离线提取→retarget→目标局部轨道→player。patterns只注册，assets拥有几何与静态权重，assembly做固定覆盖，adornments负责冠髻，headwear-fit负责一次性帽壳留量。无通用外部Mesh导入器，不恢复tailoring或人体衣面fallback。

## 人物生产基线

当前正式衣柜为7上衣／5下装／1鞋款，另保留body作为内部裸模哨兵；10张“搭配灵感”继续存在，但“基础搭配”整组已删除。上衣保留work_vest、short_work_jacket、rough_tunic、cross_jacket、layered_vest、ceremony_robe、farmer_tunic；下装保留short_trousers、true_short_skirt、long_skirt、work_pants、work_wrap；鞋只保留cloth_shoes。已退役guard_light_armor、archer_tunic、loose_trousers、guard_pants、archer_pants、pleated_skirt、robe_skirt、short_skirt、boots，不得恢复为隐藏选项或兼容fallback。

两条真裙是连续12段裙壳和12片固定扇面封底，不是裤腿、复杂内衬或布料。服装wanhu-modular-garments-v8；皮肤wanhu-skin-cage-v3、绑定wanhu-fixed-bodies-v1保持。资源v7不是Recipe升级。新短裙与短裤只遮pelvis/thigh，长裙再遮shin；背心／短褂只遮torso，裸露手臂和小腿不能整块删除。

Cap试验当前只覆盖work_vest（128三角形）、short_trousers（164）和cloth_shoes（64）：领口／袖窿／腰口／裤脚／脚踝直接用现有接口环封面，身体允许穿过不可见Cap。其余服饰仍保持原开口，不得在用户完成视觉验收前批量推广。

普通站立、行走、起步、轻跑和坐姿是日常裙装用途；Snatch深蹲举重与极端大开腿、高踢、翻滚属于低运动服饰边界，不以“不支持一字马”阻塞资产。短裤没有动作豁免。

## 人物制作与检查边界

服装主导，不重做人体来迎合每件服饰。不要扩身材模板、儿童老人、多档LOD、人物程序动作、裙骨链、实时布料、逐帧碰撞、全身IK或GPU群体运行时。当前马任务不改源人体、绑定、上传FBX、参考模型、头发或帽饰。PR #12失败方案不合入／拣选。

允许按明确covers不绘制内部皮肤，不按动画临时删面、不改光照或源动作伪造通过。差异大的服饰允许专用拓扑，上衣含自身领袖腰带，不无限叠穿槽。

原相交算法、容差、全部源键／中点与压力动作保持；样本数量随当前保留下装目录计算，不再把已删除资产计入固定总数。连续裙固定封底与腿出口可能数学相交：garment-contact-scope只在离线计算后分类裙子的HemCenter与末端Hem/HemInset/HemFacing或皮肤shin。原始交点和接口／其他交点分列，不能宣称全部交点为0。Calf、裙身、腰臀、大腿、上衣及其他保留下装不得被接口豁免；普通动作非接口穿插继续阻塞，两条连续裙的Snatch仅作为压力观察。

自动扫描全部FBX不固定数量，失败明确报错。真实inverse bind，不用首帧代替；保留头部相对bind完整旋转差，不把HeadTop_End当脸前向或锁俯仰。换装／男女切换保持暂停相位，切动画复用网格。

## 审图与交付

默认流程是修改→代码检查→必要的数值回归→交付用户体验。视觉截图不是每轮必做项；只有用户明确要求视觉审查、需要建立视觉基线或处理纯视觉问题时，才执行本地/runner截图。`review:local`保留`--character`、`--wardrobe`、`--lightwear`、`--skirts`、`--mixamo`、`--horse`，`--full`仅用于明确要求的完整视觉矩阵。

正式Actions收敛为三条：`Build & Core Checks`负责每次PR/push的编译与核心契约；`Targeted Numeric Checks`按改动路径自动执行Wardrobe/Mixamo/Tailoring/Horse数值检查；`Manual Visual Review`只允许手动触发并生成指定范围截图。不得因为小改动自动运行全人物、全FBX、全裙装或马匹截图矩阵。

旧的大规模视觉矩阵与脚本保留作为按需工具，不再是默认CI门槛。数值侧的播放结束／循环、故障注入、绑定保护签名、源键／中点采样和贯穿阈值继续作为自动检查，不得为了加速而放宽。

记录实际受测SHA和自动检查结果。只有发生人工视觉审查时才记录实际看过的图片范围；不得把“生成了截图”写成“AI/用户已经看图通过”。AI默认负责代码、数值契约和自动化检查，不逐张代替用户做美术判断；用户明确要求视觉审查时再查看图片。正常合并前重读最新HEAD，避免覆盖并发提交。
