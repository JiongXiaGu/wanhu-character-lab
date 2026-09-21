# AGENTS · 衣冠工坊V5与马匹实验

## 接手

这是wanhu-character-lab的3D换装与FBX试衣项目，不是头像或UI原型。先核对最新main、任务分支、PR和Actions，再读README、工作交接、低模马与基础四足动画、短裤封边与连续裙装、固定基模与换装V5、服装生成架构、轻便服饰与头饰安全留量、运行时人物生成架构、Mixamo动画接入、男性FBX校正、GPU骨骼动画迁移契约、GitHubActions截图验收规范。不要用聊天历史SHA覆盖新提交。

## 当前M1边界

马是独立Horse Lab，入口?lab=horse，代码在src/horse。1524三角形／806逻辑点／25骨骼／最多双权重，渲染硬边拆点4572。网格m1-v1，骨架和动作m1-v2；该资源版本不是人物Recipe版本。四动作Horse_Idle／Horse_Walk／Horse_Run／Horse_Eat必须保留。

先让用户验收马本体，未经确认不得合并、不得自动进入M2。不做人骑马、Rider动画、上下马、人物绑定、马具、坐骑控制、其他动物、行为树、导航、Root Motion正式移动、实时IK、贴蹄或尾巴物理。RiderSeat／DismountLeft／Right只在设计文档预留。不得把horse塞进Recipe V5或人物七槽位，不借动物任务回去修人体／裙装／源FBX。

geometry负责制作外形和静态权重，rig负责绑定，skinning负责渲染装配，animation只在创建时烘焙局部轨道，player负责标准Mixer采样。不要做通用Quadruped平台。人物与马共用clip-clock时间游标和review:local启动器；原人物播放器只做等价游标抽取，不改FBX采样、重定向、导出和末帧语义。

npm run check:horse包括网格／绑定／964姿态采样及地面高度失败门槛，保留五个故障注入。蹄低于-0.012m、头穿地、Eat最低头部不在0.01–0.12m均失败；这是平面低模实验容差，不是零滑步／零相交证明。首稿4cm入地不得回退成仅诊断不失败。

npm run review:local -- --horse运行完整104张视口图＋工作台／小屏图＋9张接触表。正式horse-review job加入Character Model Review，独立artifact horse-m1-review；原model-review、其他五条工作流、全部人物压力矩阵不缩减。删除临时M1制作workflow，不留第七条永久流程；正式job不推送证据分支。自动通过、图片生成、下载与实际看图分别记录。

## 人物不变量

固定成年男女，一档原LOD2低模精度。Recipe V5精确六字段version/bodyType/slots/dyes/hairStyle/hairColor，七槽位完整。只读V5存储键，用户文件经parseRecipeFile严格验证，createRecipe仅内部构造；不恢复旧协议兼容。保留推荐、跨男女混搭、三色发色、发型帽饰、seed、锁定、撤销、保存与文件往返。

20骨骼语义、索引与父关系不变，每顶点最多两非零权重；单位米、+X右/+Y上/+Z前。男女绑定位置可不同，衣服共享该基模骨架，不新增Animator，不未经验证共用男女最终矩阵。颜色仍进入网格缓存。

正式路径Recipe→固定基模／资产注册→装配→CharacterData→rig→viewport；FBX→离线提取→retarget→目标局部轨道→player。patterns只注册，assets拥有几何与静态权重，assembly做固定覆盖，adornments负责冠髻，headwear-fit负责一次性帽壳留量。无通用外部Mesh导入器，不恢复tailoring或人体衣面fallback。

## 人物生产基线

9上衣／11下装／10推荐。第一批三上衣与两长裤、第二批背心／短褂及帽发安全留量保留。short_trousers176三角形、true_short_skirt180、long_skirt252，旧short_skirt176不变。命名采用B：旧short_skirt明确是分片裙裤，新真短裙用true_short_skirt，不在旧ID下偷换造型。

两条真裙是连续12段裙壳和12片固定扇面封底，不是裤腿、复杂内衬或布料。服装wanhu-modular-garments-v7；皮肤wanhu-skin-cage-v3、绑定wanhu-fixed-bodies-v1保持。资源v7不是Recipe升级。新短裙与短裤只遮pelvis/thigh，长裙再遮shin；背心／短褂只遮torso，裸露手臂和小腿不能整块删除。

普通站立、行走、起步、轻跑和坐姿是日常裙装用途；Snatch深蹲举重与极端大开腿、高踢、翻滚属于低运动服饰边界，不以“不支持一字马”阻塞资产。短裤没有动作豁免。

## 人物制作与检查边界

服装主导，不重做人体来迎合每件服饰。不要扩身材模板、儿童老人、多档LOD、人物程序动作、裙骨链、实时布料、逐帧碰撞、全身IK或GPU群体运行时。当前马任务不改源人体、绑定、上传FBX、参考模型、头发或帽饰。PR #12失败方案不合入／拣选。

允许按明确covers不绘制内部皮肤，不按动画临时删面、不改光照或源动作伪造通过。差异大的服饰允许专用拓扑，上衣含自身领袖腰带，不无限叠穿槽。

原相交算法、容差、源键／中点、压力动作和20,180严格旧样本保留，现24,216。新增真裙固定封底与腿出口可能数学相交：garment-contact-scope只在离线计算后分类新增裙子的HemCenter与末端Hem/HemInset/HemFacing或皮肤shin。原始交点和接口／其他交点分列，不能宣称全部交点为0。Calf、裙身、腰臀、大腿、上衣、全部旧下装不得被接口豁免。原有普通动作非接口穿插仍阻塞，仅新增两裙Snatch作为压力观察。7个分类正反例保留，不把规则泛化为所有裙装豁免。

自动扫描全部FBX不固定数量，失败明确报错。真实inverse bind，不用首帧代替；保留头部相对bind完整旋转差，不把HeadTop_End当脸前向或锁俯仰。换装／男女切换保持暂停相位，切动画复用网格。

## 审图与交付

优先修改→本地真实浏览器→截图→实际看图→迭代。本地默认、--wardrobe、--lightwear、--skirts入口保留；各自--full完整矩阵。环境不能完成本机网页链路时如实记录，可在runner执行同一入口但不能称作本机截图成功。静态源码重建不能冒充网页／FBX。

最终保留原六条正式Actions：Build、Character Model Review、Mixamo Retarget Review、Wardrobe Review、Tailoring V2 Review、Modular Garment Review。裙装为Modular的并行job，原compare、人体、两批服饰与帽发矩阵不可减少。不部署Vercel／Visual，不留临时制作workflow为第七条永久流程。

裙装快速160、完整412视口＋工作台，另52基线与36对同相机短裤对照、16次相位保持。完整模式保留Snatch .05压力帧。原播放结束／循环、故障注入、绑定保护签名保持，不刷新哈希掩盖变动。

记录实际受测SHA、run、下载、实际看图文件／接触表范围、未看视频及最终main。成功检查、生成文件、人工看图是不同事实；有限抽查不是所有连续时刻零穿插。纯文档收尾可引用未变化受测代码；源码变动重新验证。正常合并前重读最新HEAD，避免覆盖并发提交。M1另需用户明确同意，不因CI全绿自动合并。
