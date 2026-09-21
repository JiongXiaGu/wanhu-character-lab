# 万户 · 衣冠工坊 V5

## 当前：服饰第一批3＋2已合并

PR #16 已于2026-09-21合入main，运行代码合并点 `7f36f483cb22ca784d567ff060a0418037af5914`。正式受测代码 `eac5d81a96be48e45898641e9d0707b74dffe5ee` 的六项Actions全部通过；已实际查看36张服饰接触表、1张工作台和12张关键原始PNG。运行记录、图片来源和抽查范围见[工作交接](Documentation/工作交接.md)。后续收尾只补文档；接手仍须核对远端最新main。

劳作短衣、交领常服、半臂配内衬＋直筒布裤、束脚行动裤，男女可混搭。升级现有5个ID，不增Recipe版本或内衬槽位。人体保持524tris；新衣220/290/340tris、新裤272/304tris。完整制作/色区/性能/审图边界见[服饰第一批制作与验收](Documentation/服饰第一批制作与验收.md)。

本地服饰审图：`npm run review:local -- --wardrobe`；完整加`--full`。六项Actions保留，新衣服矩阵并入Modular。

《万户天工》3D玩家/居民换装与FBX试衣工作台。两个固定成年男女基模，一种标准低模精度；重点是服饰、混搭、染色与动画。职业、导航、生产、战斗和场景交互留在Unity，儿童与老人是未来制作范围。

## 运行

Node.js>=22.12；`npm ci` 后 `npm run dev`，或使用 `Start-Local.cmd`。打开终端输出地址。FBX放入 `动画参考/`（可有子目录），重启/构建自动扫描提取；当前23份不是数量上限。上传FBX和参考模型不修改。

左栏选择男女和推荐搭配，右栏换上衣、下装、头饰、鞋、发式、染色与随身部件。保留跨男女混搭、三色/发色、随机种子、部件锁定、撤销、浏览器保存与严格文件导入导出。动作面板支持搜索、分类、收藏、上下切换、暂停逐帧与源骨架对照；换装保持相位。

## 当前服装框架

上衣、裤装和鞋是独立网格，固定覆盖表决定裸露皮肤，换装时装配。`patterns.ts` 注册资源，`assets/` 制作网格和权重，`assembly.ts` 负责覆盖/组合，`adornments.ts` 负责冠髻。不存在旧人体衣面复制、裆点压缩补偿或兼容fallback。

现有7种上衣和7种下装迁入同一框架，不代表新创作了14套成熟成衣。农户/卫兵/弓手仍是可编辑资产；礼衣和分裳目前为简化衣裤轮廓，不是完整长袍/宫装。

PR #15 的形变收尾已合并：裸模采用有限宽度裆底与独立腿根，皮肤524tris；膝后静态双权重梯度保留。历史基础裤装220tris，本轮直筒布裤272tris、束脚行动裤304tris，其他裤款仍220tris。当前服装几何 `wanhu-modular-garments-v5`，皮肤 `wanhu-skin-cage-v3`，绑定 `wanhu-fixed-bodies-v1`。当前制作与审查见[服饰第一批](Documentation/服饰第一批制作与验收.md)及[交接](Documentation/工作交接.md)；[膝部与裆底修正](Documentation/膝部与裆底修正.md)是上一阶段历史记录。

Recipe V5精确六字段 `version/bodyType/slots/dyes/hairStyle/hairColor`；只读取 `wanhu.character.wardrobe.v5`。旧版、未知字段和缺字段明确拒绝，不迁移。没有连续身高/胖瘦、多档LOD、无限叠穿或实时布料；20骨骼语义、最多双权重、一套角色骨架保持。

## 本地快速审图

日常迭代不必每次等待Actions，先实际运行当前代码、截图、查看，再修改。一次安装浏览器后可直接：

```sh
npx playwright install chromium
npm run review:local
```

命令自动提取现有FBX、在本机随机端口启动Vite、生成32张男女/裸模/裤装/静态/坐姿多角度实机图，随后关闭进程。输出 `review-deformation/local/`，不推送、不部署、不更新黄金文件。完整156张模式：

```sh
npm run review:local -- --full
```

它是截图命令，不会自动替人审图，也不能代替全部数值和交互测试。若当前环境无法运行完整浏览器，只允许明确标注的静态源码几何重建用于静态外观判断，不能冒充WebGL或FBX验证。执行环境可用性和runner检查状态分别记录，详见[验收规范](Documentation/GitHubActions截图验收规范.md)。

## 自动检查与边界

执行 `check:retired`、`check:mesh`（含 `check:deformation` 与第一批契约检查）、`build`、`check:mixamo`、`check:wardrobe`、`check:tailoring`。保留原六条正式Actions，合并网格/蒙皮/换装改动与阶段收尾时统一核对。Modular Garment Review保留原服饰对照、本地命令烟雾测试和156组裸模/裤装前后对照，并增加第一批服饰矩阵。没有第七条永久工作流，不部署Vercel/Visual，不录制视频；原结束/循环和源键/中点检查保留。

本批不修改源人体或绑定，不刷新身体/绑定保护签名。皮肤已是有限宽度裆底与独立腿根的v3，不再采用旧单裆点方案；保护检查继续锁定声明范围之外的皮肤数据、完整绑定及故障注入反例。两款新裤装只明确更新面数断言，原检测算法、容差、压力动作与源帧/中点采样保留。数值通过和有限图片抽查不意味着全部姿态零穿插。当前尚无外部服装Mesh导入器、Unity插件或GPU群体运行实现。

文档：[V5契约](Documentation/固定基模与换装V5.md) · [衣柜使用](Documentation/换装工作台使用.md) · [服装架构](Documentation/服装生成架构.md) · [动画](Documentation/Mixamo动画接入.md) · [Unity迁移](Documentation/GPU骨骼动画迁移契约.md)。
