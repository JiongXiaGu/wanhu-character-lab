# 抓个锅盖头 MediaPipe 全片接入

人物工坊中的“抓个锅盖头 · MediaPipe（全片）”来自 `@rrrrrrrry_yang 嘿 抓个锅盖头… 4K.mp4`。原视频和未修改的 33 点提取结果保存在 `D:\AI-Tools\mediapipe-motion`，网页项目只保存派生的 20 骨动作及质量报告。全片 899 帧，59.94 FPS。

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

生成器会核对视频、完整姿态 NPZ 和 Heavy 模型的 SHA-256。双脚用脚踝到脚尖决定脚骨方向，偏航限制在躯干朝向左右 15°，俯仰限制在 −40° 至 −18°。原始 33 点保持不变。运行 `npm run check:mediapipe` 检查结构、双脚方向及男女重定向。
