# AGENTS · 衣冠工坊V5与多坐骑

## M8水牛与当前任务范围

用户已明确批准buffalo_water独立水牛和最终合入main；旧M6不做第五物种的阶段限制不阻止本任务。接手main 6119c8d中没有yak_black；开发中已合并并行M7至6c8d3cf，保留牦牛完整资产与检查，目录现有六种真实坐骑。先阅读《水牛.md》，再按最新远端真实目录工作。

src/buffalo独立拥有2056三角形／1082逻辑点／28骨、低长头、横展后弯角、低沉宽体、横耳、八个分趾壳、四动作、两水牛鞍、BUFFALO_RIDER_FIT及BUFFALO_REIN_PROFILE。不调用其他牛类作者工厂、不新增BovineSystem、不改人物20骨／V5／FBX／衣柜／Cap。共用播放器和生命周期保持。

水牛检查追加至check:mounts及其真实桌面浏览器专项，旧物种矩阵不减。腿位从第一版纳入Body纵向比例约束；蹄底、进食、端点、跨坐、绑定和释放门槛不放宽。没有牛车、耕田、涉水、IK或物理。自动检查不代替用户美术验收，最终只保留原三条正式Actions。

## 接手

这是wanhu-character-lab的3D换装、FBX试衣与坐骑Web实验，不是头像或UI原型。先核对远端main、任务分支、PR与Actions，再读README、工作交接、牦牛、黄牛、双峰骆驼、多坐骑与灰驴、马鞍与缰绳、骑乘与坐骑挂接、低模马与基础四足动画、服装Cap封闭实验、头饰闭合与安全留量、短裤封边与连续裙装、固定基模与换装V5、服装生成架构、轻便服饰与头饰安全留量、运行时人物生成架构、Mixamo动画接入、男性FBX校正、GPU骨骼动画迁移契约及GitHubActions截图验收规范。不要用历史SHA覆盖并发新提交。

## 多坐骑与当前范围

M1马本体经PR #20、M2骑乘经PR #28、M3马具经PR #29合入。用户已接受M3效果并批准M4-A灰驴、多坐骑UI和推到main。灰驴Walk/Run方向与鼻孔修复7601902已获用户确认。用户已批准M5双峰骆驼及合入main；当前horse_chestnut栗色马、donkey_gray灰驴、camel_bactrian双峰骆驼、cattle_yellow黄牛、yak_black牦牛。用户已明确批准M6可骑乘黄牛及推送main；旧阶段不做第四物种的限制不阻止M6，M7已明确授权第五种yak_black可骑乘牦牛及推送main；旧阶段的第五物种限制不阻止M7，仍不授权第六物种、猪、上下坐骑或农耕／牧业玩法。

src/horse的马本体保持1524三角形／806逻辑点／25骨骼／最多双权重，硬边拆点4572。网格m1-v1、绑定和动作m1-v2、Horse_Idle／Walk／Run／Eat及原马鞍作者几何不重做。src/donkey有独立作者网格、27骨架（含两耳）、四动作、普通／旅行鞍具与骑乘适配，不由整马缩放换色生成。

src/camel独立拥有2280三角形／1198逻辑点／29骨架、四动作与两套驼鞍。torso.ts制作躯干与双峰的单一连续Body闭合壳，不恢复独立峰底和相交根圈；geometry.ts负责装配。三段长颈、三段尾、双耳；两峰只随躯干双权重，不增加峰骨。脚为宽肉垫和前双趾，不复用马蹄。座点位于两峰之间，鼻侧环不使用衔铁；不把马或驴整体拉长缩放。网格m5-v2，绑定／动作／鞍具版本保持，预算与建模边界见双峰骆驼文档。

src/cattle独立拥有1956三角形／1032逻辑点／28骨、四动作、低宽普通／旅行牛鞍和专属骑姿／缰绳。保持厚桶身、短粗颈、闭合垂皮、宽头鼻镜、弯角、横耳、尾束与八个分趾蹄。角刚性随Head，垂皮仅Chest／NeckBase双权重，趾壳刚性随对应Foot；不能拿单蹄马或水牛角替代。详见黄牛文档。

src/yak独立拥有2328三角形／1224逻辑点／29骨、四动作、宽背低座普通／旅行牦牛鞍、专属骑姿与鼻带缰绳。Body本身把强肩、厚躯干与两侧长毛下摆连成单一闭合表面，不能回退为黄牛桶身外套毛壳。胸毛／额毛／侧脸毛／蓬尾为少量闭合不透明实体；只增一根Forelock，不引入毛发物理或透明卡片。外展后上弯角刚性Head，八趾刚性Foot，独立米制绑定；详见牦牛文档。

src/mounts只提供真实需求下的最小目录、Actor装配、语义播放器和共享本体工作台，不做通用Quadruped生成器。动物骨数、局部绑定、网格、动作和挂点各自归作者资源所有。idle／walk／run／eat映射当前物种真实片段和时长，不让驴播放Horse轨道。原马Actor及数字回归继续保持。

本体工作台为MountLab／MountViewport；?lab=mount为主入口，旧?lab=horse是同页别名，不保留重复旧工作台。?lab=riding由src/riding组合人物和坐骑。UI只有坐骑本体／骑乘试衣两种模式，种类、鞍具两个选择，二级链接同时携带mount与saddle；preview-session仅在点击模式链接时写页签临时缓存，恢复各自时钟／Orbit相机／未保存骑手装扮。禁止逐帧写存储或覆盖人物localStorage，普通深链不读取缓存，坏缓存安全回退。不增加卡片墙、第三个装备页、鞍垫／行囊／辔头子槽位、MountLoadout或可编辑mountable，也不展示空物种占位。

## 骑乘与动画

复用原makeCharacter／makeActor，不另造骑手人体。人物20骨，马25骨，灰驴27骨，骆驼29骨，黄牛28骨，牦牛29骨，各有独立Skeleton／SkinnedMesh／Mixer，不合成一套人物骨架，不把动物加入Recipe V5七槽位。

普通Group RiderSeat跟随物种指定背骨；SaddleRoot与稳定Seat为兄弟节点，鞍具配置提供坐面。RiderRoot减去人体绑定Hips后加男女坐面距离，不能把骨盆原点直接置于鞍面。人物先独立绑定再挂接，之后禁止rebind、重算inverse bind或Skeleton.pose。灰驴使用自己的RiderFit；骆驼增加可选upperArmDirection／forearmDirection作为作者持缰配置，未配置时严格保持马／驴原手臂数值。原人物FBX及绑定不改。

坐骑播放器是唯一时钟，每帧先采样动物，再按同相位采样人，最后更新掌心／嘴环和缰绳。不复制背部升降，不累加第二时钟。骑手只烘焙20条局部四元数轨道，不改原人物FBX重定向，不恢复旧程序动作，不作为FBX失败回退。灰驴蹄高在创建轨道时用作者前向变换标定，不在播放中求解腿或地形。

换动作不重建网格。同物种换鞍不重建人、动物或绳；换装／换男女只重建人物并重挂掌心，保留坐骑、绳、相位与相机。换物种先构造候选动物及适配资源，成功后保留人物网格与inverse bind、重新挂接并释放旧动物和旧绳。保留动作语义、归一化相位、鞍具风格与衣物；时长不同则秒数随之变化。相机方向／缩放保持，只调整构图高度。非法ID或失败候选不能清空现有画面。

## 鞍具与缰绳

SaddleId仍none／simple／travel；鞍垫、左右袋、后卷毯、辔头、脚蹬均为整体资产内部。src/horse/saddles/assets拥有马作者几何；src/donkey/saddles拥有灰驴适配，src/camel/saddles拥有驼鞍适配，src/cattle/saddles拥有低宽牛鞍、鼻带及鼻侧环；src/yak/saddles拥有宽背厚织垫、低座与牦牛鼻带侧环；SaddleProfile用命名背骨／头骨与各自局部嘴环装配。不能用马鞍高度或马嘴坐标硬套驴。所有马具保持闭合作者小壳，不以单面纸片、临时删面或物理回避制作问题。

reins维护200三角形固定拓扑双绳，按物种ReinProfile的嘴环、颈侧导向和掌心派生曲线。先变换到整动物局部空间，同帧写回原Geometry／TypedArray。禁止逐帧new BufferGeometry／TubeGeometry、绳物理或手部IK。旧马导向与下垂保持；灰驴独立配置。手掌无手指弯曲，脚蹬只是简化装饰，不能写成精确抓握／贴蹬。

none在骑乘页释放静态鞍具、隐藏人物／骨架／绳并冻结时钟，保留原动作、归一化相位和配方。无鞍期间也能换种类，仍保持none，不自动装回simple。隐藏人物只是页面缓存，退出完整释放。本体页无鞍仍播放四动作；有鞍无骑手只显示辔头，不生成悬空持缰绳。

不做上下坐骑、骑射、导航、Root Motion正式移动、实时贴蹄、尾巴／包袋物理或GPU Crowd。职责与边界集中于多坐骑、骑乘和马具文档。

## 自动检查

check:horse保留964姿态、真实绑定、地面门槛与五个故障注入。蹄不低于-0.012米、头不穿地、Eat最低头0.01–0.12米；不得把旧4厘米入地降为仅诊断。原check:riding保留马的1446稠密姿态、70衣裤、实际蒙皮、相位／换装／实例变换／释放及男女各四故障。check:saddles保留1452有鞍骑乘、484本体相位、闭合壳／颜色／端点／中心线穿越／none和生命周期。嘴环6毫米制作接触不扩大成整绳或整动物豁免。

check:mounts新增灰驴964本体姿态、双基模×双鞍具×三动作×241相位共2892骑乘姿态、70衣裤关键相位、20次种类往返及错误／释放检查。灰驴进食首稿14.2厘米离地曾失败，只修作者姿态，不放宽门槛。M5在同一check:mounts中增加骆驼964本体／2892骑乘／70衣裤、24次三物种切换与14个故障反例。脚轨迹有向面积保护正向步态，鼻孔／眼小壳必须贴近头面；缰绳穿越范围包括两峰，连续版由Body覆盖，原嘴环6毫米例外不扩大。另保留连续Body连接性、闭合性、对称权重、双峰／鞍谷轮廓及两个拓扑反例。M6追加黄牛964本体／2892骑乘／70衣裤和32次四物种切换，角对称与Head刚性、八蹄真实分缝／Foot刚性、垂皮和鼻镜贴合有故障反例。黄牛浏览器追加双模式真实往返、相位／相机／未保存装扮保持及坏缓存反例。M7继续追加牦牛964本体／2892骑乘／70衣裤、40次五物种切换、连续毛披拓扑和毛根真实蒙皮附着／闭合、角／分趾／低头／腿位／毛权重等30个故障反例。浏览器追加牦牛双模式和五物种状态往返。新物种测试不能代替或缩减旧马、灰驴、骆驼、黄牛及原服饰回归。

check:riding-browser、check:saddles-browser、check:mounts-browser只做真实桌面交互，不截图。目录断言更新为真实五种动物，不减原交互检查。有限中心线／构造采样不等于全部三角面与所有连续时刻零穿插。连续封底裙保持可选并明确实验边界，不自动换裤／拆裙／删封底；手持物保留，持缰冲突提示不能冒称已支持骑射。

## 人物不变量

两个固定成年男女，一档原LOD2精度。Recipe V5精确六字段version/bodyType/slots/dyes/hairStyle/hairColor，七槽位完整。只读V5存储键；用户文件经parseRecipeFile严格验证，createRecipe仅内部构造；不恢复旧协议兼容。保留原人物推荐、混搭、发型帽饰、配色、seed、锁定、撤销、保存与文件往返。骑乘只读明确保存的装扮，不静默覆盖人物存档。

20骨骼语义、索引和父关系不变，最多双权重，米制、+X右/+Y上/+Z前。男女绑定位置可以不同，服装共享当前基模骨架，不新增服装Animator，不未经验证共用男女最终矩阵。颜色仍进入网格缓存。

正式路径Recipe→固定基模／资产注册→作者接口封闭→装配→CharacterData→rig→viewport；FBX→离线提取→retarget→局部轨道→player。patterns只注册，assets拥有几何与静态权重，seal-interfaces只在创建时封闭显式接口，assembly负责固定覆盖，adornments拥有头发／头饰，headwear-fit只做一次性帽壳留量。无外部Mesh通用导入器，不恢复tailoring或人体衣面fallback。

正式衣柜7上衣／5下装／1鞋，body只为内部裸模哨兵；10张搭配灵感保留、基础搭配已删。上衣work_vest、short_work_jacket、rough_tunic、cross_jacket、layered_vest、ceremony_robe、farmer_tunic；下装short_trousers、true_short_skirt、long_skirt、work_pants、work_wrap；鞋cloth_shoes。guard_light_armor、archer_tunic、loose_trousers、guard_pants、archer_pants、pleated_skirt、robe_skirt、short_skirt、boots退役，不恢复隐藏选项或fallback。

真裙仍为连续12段裙壳和12片固定扇面封底，腰口已补。服装wanhu-modular-garments-v9、皮肤wanhu-skin-cage-v3、绑定wanhu-fixed-bodies-v1，不升级Recipe。短裙／短裤仅遮pelvis/thigh，长裙再遮shin；背心／短褂仅遮torso，不能整块删裸露手臂小腿。

所有正式makeTop/makeTrousers/makeFootwear输出零openings并带完整sealedInterfaces：上衣4口、裤装3口、连续裙腰口、布鞋2口。seal-interfaces复用原顶点／权重，处理共线切点，不增加运行时补洞、布料或人体切割。上衣Cap用primary，长裤／裙腰用原裤布／腰头secondary；已认可work_vest、short_trousers、cloth_shoes不重做，预算见Cap文档。

除none外头饰零开放边、无非流形边、Head刚性权重。草帽／玉簪保留；轻盔／包巾／方冠同帽色底盖；额前束带为闭合薄实体。只有指定帽底可固定穿过头发，帽侧／帽顶不豁免。头饰wanhu-headwear-closed-v3。

普通站立、行走、起步、轻跑、坐姿属于日常裙装范围。Snatch深蹲举重及极端开腿／高踢／翻滚为低运动服饰边界；短裤无动作豁免。骑乘裙装限制独立记录，不反向放宽原服饰普通动作门槛。服装主导，不为每件服装重做人，不扩身材模板、儿童老人、多LOD、旧人物程序库、裙骨链、布料、逐帧碰撞、全身IK或GPU Crowd。PR #12失败方案不合入／拣选。

只按covers不绘制内部皮肤，不随动作删面，不改灯光／源动作伪造通过。不同服饰允许专用拓扑，上衣含自身领袖腰带，不无限加槽。原相交算法、容差、全部源键／中点与压力动作保持；样本随现役目录计算。Cuff与可见shin、裙HemCenter与Hem/HemInset/HemFacing或皮肤shin的既有固定接口仅离线窄范围分类，原始／接口／其他交点分列，不宣称全为0或整件免检。普通非接口穿插阻塞，真裙Snatch仅压力观察。

动态扫描全部FBX不固定总数，失败明确报错；真实inverse bind，不用首帧替代。保留头部相对bind完整旋转差，不用HeadTop_End当脸前向或锁俯仰。原人物换装／男女切换保持暂停相位，切动画复用网格。

## 审图与交付

默认修改→代码／数值／交互检查→交付用户体验。仅用户要求视觉审查、建立视觉基线或处理纯视觉问题时才执行本地／runner截图；不得每轮自动生成大矩阵并逐张代替用户判断，旧review:local各入口与--full按需保留。骆驼建模可显式调用scripts/review-camel-torso.mjs，不能并入默认交互测试。

仍只有Build & Core Checks、Targeted Numeric Checks、手动Manual Visual Review三条正式Actions。多坐骑并入Targeted，不新增永久流程。Package／workflow变更仍全数值回归，不放宽源键／中点、绑定保护、故障注入或穿插阈值来加速。

记录实际受测SHA、结果与是否看图，区分runner中断／取消／成功。不得把生成截图写成人工验收，不把runner浏览器写成本机测试。用户认可旧马不代表灰驴美术已认可。合并前重读最新HEAD，正常合并保留并发提交，不强推。
