# Wanhu Character Lab · V3.5 / FBX ONLY

《万户天工》男性居民建模与动画实验台。人体、衣服、装备由程序生成；**动画只使用外部 FBX**。先校正男性居民，女性角色尚未接入。

## 本地运行

Node.js 22.12+，拉取 main 后双击 `Start-Local.cmd`，或：

```sh
npm ci
npm run dev
```

predev/prebuild 离线提取 `动画参考/` 的 11 个 Mixamo FBX，不下载资源，不加载 Vanguard 人物网格/贴图。`public/mixamo/` 是忽略提交的产物。preview 前先 build。

## 动画与审查

默认播放 FBX 慢跑。左侧可选择射箭、行走、拳击、起身等 11 个源动作；支持暂停、变速、进度、重播和完整末帧。切换 FBX 复用现有模型，修改体型或外观才重新生成人物。

「源骨架同步对照」左侧源骨架、右侧目标人物。「头部朝向检查」显示青色面前方与金色向上轴，便于观察动作本身的俯仰，而非用头顶辅助点判断脸向。

「绑定姿态（静态）」只重置模型的 A 绑定姿态，不是另一个程序动画。原 6 Motion、17 程序 Action、对应 UI、采样器、道具播放器与测试已删除，不再作为隐藏对照或失败回退；历史可查 Git。

## 本轮男性校正

旧头部校准把源 Head→HeadTop_End 骨段的约 5.456° 前倾额外施加到目标头部。现在保留源头部相对真实绑定姿态的世界旋转差，不把辅助点当脸向，也不强行抬平动作中真实的点头。重定向版本 `wanhu-mixamo-2`，导出附带校准配置。

保留原人体、网格绑定、20 Bone ID/Parent Map、每顶点最多两个非零权重；没有为了抵消错误旋转而反向扭曲脸部网格。详见 [男性校正](Documentation/男性FBX校正.md)。

## DIY 与导出

Recipe V4 保留 `preset + slots + height/build/palette`。职业只是一键预设，头饰、衣服、鞋、背部和双手可独立混搭，动画不改写配方。

「导出目标骨架动画 JSON」输出当前体型的骨架、局部轨道、源 SHA、根轨迹与校准版本，不是 Unity AnimationClip/Avatar/运行时插件。

## 检查与 GitHub Actions

```sh
npm run check:retired
npm run check:mesh
npm run build
npm run check:mixamo
```

Build、Male Character Model Review、Mixamo Retarget Review 三条检查。基模矩阵检查 4 外观×3体型；FBX 检查全11动作×3体型的完整时间轴及独立头部旋转断言。Playwright 生成多视图、头部侧面近景和慢跑/射箭连续视频。

只在 Actions runner 内启动 Vite Preview，不部署 Visual/Vercel/Preview Site。Agent 必须下载并实际审查对应提交的产物，修正后合入 main。绿色任务不等于全部美术问题消失。

## 边界

FBX 射箭仍是人体动画：弓弦、箭、释放事件与精确握点尚未重新制作；静态 DIY 武器不等于正确抓握。无女性角色、五指、布料、脚锁、通用混合、任务导航、库存/生产结算。大幅动作仍可能有低模关节/服装自交。

Unity 导入器、Avatar、Blob、GPU 群体、LOD/剔除和万人 Profile 尚未实现。先做相同骨架的单人物对照，再进行群体路径，不能把网页 GPU 蒙皮当成 Unity 性能验收。
