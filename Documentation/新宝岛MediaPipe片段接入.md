# 新宝岛 MediaPipe 片段接入

网页中的“新宝岛 · MediaPipe”来自 `虾不咕的抖音 - 抖音.mp4` 的 23.000–45.000 秒，30 FPS、661 帧；“新宝岛 · 炸鸡少爷（34–48 秒候选）”来自 `新宝岛 炸鸡少爷.mp4` 的 34.000–48.000 秒，30 FPS、421 帧。三段用户原视频统一归档在 `D:\AI-Tools\mediapipe-motion\input\`，该目录的 `source-videos.json` 记录原桌面路径及 SHA-256；原始 MP4 和提取结果不纳入网页仓库。网页资产记录视频、MediaPipe 模型和完整 `pose.npz` 的 SHA-256；来源对照显示 33 点骨架，人物仍使用固定的 20 骨架和原有蒙皮。

## 生成

先运行独立实验环境的 `scripts/extract_pose.py` 得到整段视频的 `pose.npz`、`metadata.json` 和质量报告。随后从本仓库根目录运行：

```powershell
& 'D:\AI-Tools\mediapipe-motion\.venv\Scripts\python.exe' scripts\prepare-mediapipe-pose.py `
  --pose 'D:\AI-Tools\mediapipe-motion\output\虾不咕的抖音\pose.npz' `
  --metadata 'D:\AI-Tools\mediapipe-motion\output\虾不咕的抖音\metadata.json' `
  --video 'D:\AI-Tools\mediapipe-motion\input\虾不咕的抖音 - 抖音.mp4' `
  --clip-id mediapipe-xinbaodao --clip-name '新宝岛 23–45 秒' `
  --start-seconds 23 --end-seconds 45 `
  --output public\mediapipe\mediapipe-xinbaodao.json `
  --report public\mediapipe\mediapipe-xinbaodao-report.json
```

炸鸡少爷候选使用经来源哈希核对的完整提取结果，转换时只选择原视频的 34–48 秒：

```powershell
& 'D:\AI-Tools\mediapipe-motion\.venv\Scripts\python.exe' scripts\prepare-mediapipe-pose.py `
  --pose 'D:\AI-Tools\mediapipe-motion\output\新宝岛 炸鸡少爷-verified-20260924\pose.npz' `
  --metadata 'D:\AI-Tools\mediapipe-motion\output\新宝岛 炸鸡少爷-verified-20260924\metadata.json' `
  --video 'D:\AI-Tools\mediapipe-motion\input\新宝岛 炸鸡少爷.mp4' `
  --clip-id mediapipe-xinbaodao-zhajishaoye --clip-name '新宝岛 炸鸡少爷 34–48 秒' `
  --start-seconds 34 --end-seconds 48 `
  --output public\mediapipe\mediapipe-xinbaodao-zhajishaoye.json `
  --report public\mediapipe\mediapipe-xinbaodao-zhajishaoye-report.json
```

生成物带有完整片段时间、来源哈希和清理记录。网页构建只读取已生成的资产并运行 `check:mediapipe`，不在 CI 下载视频或运行 MediaPipe。旧 `新宝岛_B.glb` 归档在 `动画参考_归档/`，不再由 GLB 扫描器识别；旧链接 ID 映射到新动作。

## 坐标与清理边界

MediaPipe 的 33 点原始 normalized/world 数据保留在 D 盘 NPZ 中。网页来源骨架使用原始 world 点做固定坐标变换和人物尺度显示，**不做异常修复**。MediaPipe world 坐标逐帧以髋部为原点，因此网页人物保持原地；目标动画不声明真实世界水平位移。

派生 20 骨动画使用肢体方向估计旋转。低于 0.5 visibility 仅记录为复核提示，轨迹连续时照常使用；明显的孤立 world 点回跳局部插值，并对派生坐标应用 5 帧短窗中值处理。缺失不超过 3 帧的关键姿态只在派生数据中插值，4–15 帧保持邻近有效姿态；连续缺失超过 15 帧或累计超过 5% 时拒绝发布候选。来源 33 点保留缺失标记，不绘制无效连接。

上臂在保持骨段方向的同时，以躯干前向缓慢校正衣袖轴向；前臂在沿上一帧连续旋转与继承上臂轴向之间选择同向姿态，避免手臂伸直时肘部出现近 180° 的轴向扭结，同时保留肘腕骨段方向。头与颈只跟随躯干的水平朝向。单目脚尖深度容易把鞋子扭成侧立，因此派生脚骨的偏航限制在躯干前向 ±45°、俯仰限制在 -35° 到 -8°，相邻帧每轴最多变化 8°；前臂单帧旋转上限为 89°，其余骨骼为 75°，触发限速时逐项报告。躯干前向突然反转时选择连续的一侧，也在报告中标明。这些约束是视觉清理，不代表精确恢复真实脚掌姿态；手部仍跟随前臂。清理只影响派生动作，不修改原始 NPZ。

本片段有 312 帧至少一处关键关节低于 0.5，但所有 661 帧均检出人体。用户已在视频中视觉确认 23–45 秒适合继续试做，因此不以该置信度比例自动否决片段；数值与画面仍需共同审查。转身、遮挡和深度估计可能导致手脚偏差，网页视觉验收仍由用户完成。

新候选的 34–48 秒选段共 421 帧，均检出人体；独立原始质量报告标记 1 次位置突跳、14 次骨长变化和 5 次疑似肘部弯曲方向翻转。这些数值提示不能代替用户在网页中的视觉审查；候选不替换已选定的另一条 23–45 秒版本。
