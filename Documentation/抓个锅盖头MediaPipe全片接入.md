# 抓个锅盖头 MediaPipe 全片接入

人物工坊中的“抓个锅盖头 · MediaPipe（全片）”来自 `@rrrrrrrry_yang 嘿 抓个锅盖头… 4K.mp4`。原视频归档在 `D:\AI-Tools\mediapipe-motion\input\`，原始 33 点、叠加预览与质量报告保存在 D 盘同名 `output` 目录；网页项目只保存派生的 20 骨动作及诊断报告，不包含 MP4 或原始 NPZ。全片 899 帧，59.94 FPS，来源时间范围为 0–14.998683 秒。

从网页项目根目录重新生成：

```powershell
& 'D:\AI-Tools\mediapipe-motion\.venv\Scripts\python.exe' scripts\prepare-mediapipe-pose.py `
  --pose 'D:\AI-Tools\mediapipe-motion\output\@rrrrrrrry_yang 嘿 抓个锅盖头… 4K\pose.npz' `
  --metadata 'D:\AI-Tools\mediapipe-motion\output\@rrrrrrrry_yang 嘿 抓个锅盖头… 4K\metadata.json' `
  --video 'D:\AI-Tools\mediapipe-motion\input\@rrrrrrrry_yang 嘿 抓个锅盖头… 4K.mp4' `
  --clip-id mediapipe-guogaitou-rrrrrrrry --clip-name '抓个锅盖头 · MediaPipe（全片）' `
  --start-seconds 0 `
  --output public\mediapipe\mediapipe-guogaitou-rrrrrrrry.json `
  --report public\mediapipe\mediapipe-guogaitou-rrrrrrrry-report.json
```

生成器会核对视频、完整姿态 NPZ 和 Heavy 模型的 SHA-256。当前来源哈希分别为：

- 视频：`533197ce2c67b84363b86e333366c5670474d81d55fbba809beff0bdfba8a8b3`
- 完整姿态 NPZ：`b73f6059006a2de46327f6d3f155cfeebe79496659cb634ad0f5d367c1c4463c`
- Heavy 模型：`64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b`

双脚用脚踝到脚尖决定脚骨方向，偏航限制在躯干朝向左右 15°，俯仰限制在 −40° 至 −18°；原始 33 点保持不变。运行 `npm run check:mediapipe` 检查来源、时间轴、双脚方向及男女重定向。派生报告记录 138 帧至少一个关键点低于 0.5 visibility，未记录关键姿态缺失或旋转限速；脚部俯仰有较多帧触及限制，仍需用户在网页中判断观感。

MediaPipe world 点逐帧以髋部为原点，网页人物保持原地，不推断真实场景平移。头部、脚掌和遮挡关节受单目估计限制；数值检查不代表视觉通过。
