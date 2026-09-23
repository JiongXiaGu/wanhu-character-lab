# FBX动画接入 · 固定基模

动画参考目录自动递归扫描。当前23份Mixamo FBX由prepare:mixamo提取到public/mixamo（生成文件不提交）；新增文件重启服务后出现。错误明确给出文件，不静默略过，不外部下载源模型，不恢复程序动作。

FBXLoader只提取动画与骨架；用户人物始终是程序低模，不替换为Vanguard网格。catalog.generated.ts与inventory.json一致，手工中文标签不替代实际资源检查。已知片段名有明确目录元数据，新未知片段默认单次保持，不猜测循环。

Mixamo FBX 提取继续使用真实 inverse bind，处理源重复名、单位、轴向、T/A 差异和 Spine 折叠；提取结果进入公共 HumanoidMotionData，目标仍固定 20 骨骼。公共播放、导出与重定向实现位于 src/character/motion/，mixamo/ 只保留 Mixamo 目录与资源注册。retargetVersion仍wanhu-mixamo-2；本次不改变姿态计算。女性固定校准和男性头部旋转校准继续保留。

导出wanhu-target-motion v2，bodyProfile只有固定基模ID和版本；无连续体型数据，不读取v1旧导出。换衣/男女切换保留暂停相位；切动画不重建Mesh。完整末帧、暂停重播、失败重试均参与检查。

23动作×2固定基模全源帧数值检查、源/目标关键相位和正侧背/线框，男女慢跑/射箭真实结束与循环检查（不录视频）。服饰另重点检查Pilot Flips Switches、Snatch和Start Walking。不是所有袖子/道具/极端动作零穿插保证。

源Mixamo授权由用户管理，本项目不添加额外源文件分发权限声明；当前用于实验。动画所缺的椅子、开关、弓弦和道具事件不伪称已导入。
