# AGENTS · 衣冠工坊V5、马匹与骑乘

## 接手

这是wanhu-character-lab的3D换装、FBX试衣与骑乘Web实验，不是头像或UI原型。先核对最新main、任务分支、PR和Actions，再读README、工作交接、骑乘与坐骑挂接、低模马与基础四足动画、服装Cap封闭实验、头饰闭合与安全留量、短裤封边与连续裙装、固定基模与换装V5、服装生成架构、轻便服饰与头饰安全留量、运行时人物生成架构、Mixamo动画接入、男性FBX校正、GPU骨骼动画迁移契约、GitHubActions截图验收规范。不要用聊天历史SHA覆盖新提交。

## 马与骑乘边界

M1已通过PR #20合入main。用户在2026-09-22明确批准M2制作并推到main；旧M1“不合并／不得开始骑乘”的限制不再作为当前任务门槛。M2不自动授权上下马或坐骑玩法。

马是独立Horse Lab，入口?lab=horse，代码在src/horse。1524三角形／806逻辑点／25骨骼／最多双权重，渲染硬边拆点4572。网格m1-v1，骨架和动作m1-v2；该资源版本不是人物Recipe版本。四动作Horse_Idle／Horse_Walk／Horse_Run／Horse_Eat必须保留。

骑乘是src/riding组合层，入口?lab=riding，在动物工坊内部由“马匹本体／骑乘试衣”切换。复用现有makeCharacter与makeActor，不做第二套骑手人体，不把马塞进Recipe V5或七槽位。人物20骨骼与马25骨骼各自独立；普通Group RiderSeat挂在马Spine，RiderRoot只处理骑手绑定原点到坐面的偏移。Actor先独立绑定，再挂接；挂接后禁止重新bind或Skeleton.pose。骨盆不能直接放在座面点而忽略人体坐面距离。

静态跨坐、Rider_Idle／Rider_Walk／Rider_Run是本轮范围；骑手局部轨道在创建时烘焙，马播放器拥有唯一时钟，先更新马再以相同相位采样骑手。骑手轨道不重复写马背升降位移。换动作复用人物和马网格；换装／男女切换只替换骑手并保持相位、循环与相机。骑乘编写的姿态资产只属于此组合层，不恢复人物旧程序动作目录，不作为源FBX失败回退，不改人物工坊FBX选择与重定向。

本轮不做上下马、马具、缰绳、骑射、坐骑控制、其他动物、行为树、导航、Root Motion正式移动、实时IK、贴蹄或尾巴物理。DismountLeft／Right仍只是设计预留。不要做通用Quadruped或Mount平台，不借骑乘回去重做人体／裙装／源FBX。

geometry负责制作马外形和静态权重，rig负责绑定，skinning负责渲染装配，animation只在创建时烘焙局部轨道，player负责标准Mixer采样。人物与马共用clip-clock游标；原人物播放器保持原FBX采样、重定向、导出和末帧语义。

npm run check:horse包括网格／绑定／964姿态采样及地面高度失败门槛，保留五个故障注入。蹄低于-0.012m、头穿地、Eat最低头部不在0.01–0.12m均失败；这是平面低模实验容差，不是零滑步／零相交证明。首稿4cm入地不得回退成仅诊断不失败。

npm run check:riding检查男女三动作共1446稠密姿态、70个现役衣裤组合、骨盆挂点与膝脚粗范围、实际蒙皮矩阵、暂停换装、实例变换、播放与资源释放、男女各四个故障注入。npm run check:riding-browser只做真实桌面浏览器交互，不截图。报告与人工视觉验收必须分开。连续封底裙保持可选但明确标注骑乘实验边界，不自动换裤、不拆裙或删除封底；全衣柜构造通过不等于骑乘零穿插。

## 人物不变量

固定成年男女，一档原LOD2低模精度。Recipe V5精确六字段version/bodyType/slots/dyes/hairStyle/hairColor，七槽位完整。只读V5存储键，用户文件经parseRecipeFile严格验证，createRecipe仅内部构造；不恢复旧协议兼容。保留人物工坊推荐、跨男女混搭、三色发色、发型帽饰、seed、锁定、撤销、保存与文件往返。骑乘只读取玩家明确保存的V5装扮，不静默覆盖人物工坊存档。

20骨骼语义、索引与父关系不变，每顶点最多两非零权重；单位米、+X右/+Y上/+Z前。男女绑定位置可不同，衣服共享该基模骨架，不新增服装Animator，不未经验证共用男女最终矩阵。颜色仍进入网格缓存。

正式路径Recipe→固定基模／资产注册→资产接口封闭→装配→CharacterData→rig→viewport；FBX→离线提取→retarget→目标局部轨道→player。patterns只注册，assets拥有几何与静态权重，seal-interfaces只在创建资产时封闭显式接口，assembly做固定覆盖，adornments负责冠髻与头饰作者网格，headwear-fit只负责一次性帽壳留量。无通用外部Mesh导入器，不恢复tailoring或人体衣面fallback。

## 人物生产基线

当前正式衣柜为7上衣／5下装／1鞋款，另保留body作为内部裸模哨兵；10张“搭配灵感”继续存在，但“基础搭配”整组已删除。上衣保留work_vest、short_work_jacket、rough_tunic、cross_jacket、layered_vest、ceremony_robe、farmer_tunic；下装保留short_trousers、true_short_skirt、long_skirt、work_pants、work_wrap；鞋只保留cloth_shoes。已退役guard_light_armor、archer_tunic、loose_trousers、guard_pants、archer_pants、pleated_skirt、robe_skirt、short_skirt、boots，不得恢复为隐藏选项或兼容fallback。

两条真裙仍是连续12段裙壳和12片固定扇面封底，腰口已补齐。服装wanhu-modular-garments-v9；皮肤wanhu-skin-cage-v3、绑定wanhu-fixed-bodies-v1保持。资源v9不是Recipe升级。短裙与短裤只遮pelvis/thigh，长裙再遮shin；背心／短褂只遮torso，裸露手臂和小腿不能整块删除。

用户已认可Cap及背心主布色修正，并批准推广到删减后的全部衣裤。所有正式makeTop/makeTrousers/makeFootwear输出必须零openings且带完整sealedInterfaces：上衣4口、裤装3口、连续裙腰口、布鞋2口。seal-interfaces复用原顶点及权重并处理共线切点；不得新增运行时补洞、布料或人体切割。上衣封口使用primary，长裤及裙腰使用原裤布/腰头secondary；已认可work_vest、short_trousers、cloth_shoes不重做。完整预算集中于《服装Cap封闭实验.md》。

头饰执行闭合拓扑契约：草帽与玉簪原本已闭合；guard_helmet、cloth_wrap、scholar_cap补齐同帽身色底盖；archer_headband保持前额开放造型但自身为封闭薄实体。除none外所有正式头饰必须零开放边、无非流形边且保持Head刚性权重。帽底Cap允许头部／主头发穿过，但仅该指定底盖属于制作接触；帽侧和帽顶仍不得以此豁免。头饰几何版本wanhu-headwear-closed-v3，详见《头饰闭合与安全留量.md》。

普通站立、行走、起步、轻跑和坐姿是日常裙装用途；Snatch深蹲举重与极端大开腿、高踢、翻滚属于低运动服饰边界，不以“不支持一字马”阻塞资产。短裤没有动作豁免。新的骑乘裙装限制独立记录，不能反向放宽原人物普通动作验收。

## 人物制作与检查边界

服装主导，不重做人体来迎合每件服饰。不要扩身材模板、儿童老人、多档LOD、原人物程序动作库、裙骨链、实时布料、逐帧碰撞、全身IK或GPU群体运行时。当前任务不改源人体、绑定、上传FBX、参考模型、头发或帽饰。PR #12失败方案不合入／拣选。

允许按明确covers不绘制内部皮肤，不按动画临时删面、不改光照或源动作伪造通过。差异大的服饰允许专用拓扑，上衣含自身领袖腰带，不无限叠穿槽。

原相交算法、容差、全部源键／中点与压力动作保持；样本数量随当前保留下装目录计算，不把已删除资产计入固定总数。短裤Cuff与可见shin、连续裙HemCenter与末端Hem/HemInset/HemFacing或皮肤shin的既有固定接口仅在离线计算后窄范围分类。原始交点和接口／其他交点分列，不能宣称全部交点为0，也不能泛化为所有Cap或衣服整体免检。普通动作非接口穿插继续阻塞，两条连续裙的Snatch仅作为压力观察。

自动扫描全部FBX不固定数量，失败明确报错。真实inverse bind，不用首帧代替；保留头部相对bind完整旋转差，不把HeadTop_End当脸前向或锁俯仰。换装／男女切换保持暂停相位，切动画复用网格。

## 审图与交付

默认流程是修改→代码检查→必要的数值／交互回归→交付用户体验。视觉截图不是每轮必做项；只有用户明确要求视觉审查、需要建立视觉基线或处理纯视觉问题时，才执行本地/runner截图。review:local保留--character、--wardrobe、--lightwear、--skirts、--mixamo、--horse，--full仅用于明确要求的完整视觉矩阵。

正式Actions仍为三条：Build & Core Checks负责编译与核心契约；Targeted Numeric Checks按改动路径执行Wardrobe/Mixamo/Tailoring/Horse/Riding数值及骑乘交互检查；Manual Visual Review只手动触发指定范围截图。骑乘并入现有流程，不新增永久workflow，不因小改动自动运行全人物、全FBX、全裙装或马匹截图矩阵。

旧视觉矩阵与脚本保留按需使用。播放结束／循环、故障注入、绑定保护签名、源键／中点采样和贯穿阈值不能为了加速放宽。数值失败与runner中断分开记录，不能把取消或在途任务称为通过。

记录实际受测SHA和自动检查结果。只有发生人工视觉审查时才记录实际看过的图片范围；不得把“生成了截图”写成“AI/用户已经看图通过”。AI默认负责代码与自动化检查，不逐张代替用户做美术判断。正常合并前重读最新HEAD，避免覆盖并发提交。
