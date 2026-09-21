# 万户 · 衣冠工坊 V5

《万户天工》3D玩家／居民换装与FBX试衣Web Demo。两个固定成年男女基模、一档标准低模精度，重点是服饰轮廓、混搭、三色染色与动画；玩法留在Unity。

## 当前：短裤封边、真短裙与素面长裙

下装形成长裤／短裤／短裙／长裙四种基础轮廓。没有重做人腿、骨盆、绑定或头发，没有新增装备槽、服装骨骼、实时布料或专用Animator。

| 资产 | UI名称与结构 | 三角形／逻辑顶点 |
|---|---|---:|
| short_trousers | 封口短裤；两圈裤口一起加宽、厚端面收边，保留穿腿口 | 176／100 |
| true_short_skirt | 日常短裙；收腰、连续A字裙摆、固定封底，膝上长度 | 180／97 |
| long_skirt | 素面长裙；连续裙摆到踝部附近，不拖地、不伪装成宽裤腿 | 252／133 |
| short_skirt | 分片裙裤·旧短下裳；保留原ID、原几何与原配方意义 | 176／100 |

命名采用方案B：旧short_skirt不改义，新真短裙使用true_short_skirt。现为9上衣／11下装，原10套推荐保留；不是新增一批相似裤子。三色仍为primary／secondary／accent。数量是三角形和逻辑顶点，不是硬边拆点后的渲染顶点。

短裙／长裙是低运动日常服饰，普通站立、行走、起步、轻跑、坐姿属于验收范围；Snatch深蹲举重、极端高抬腿、大开腿和翻滚属于压力观察，不承诺零穿模。固定裙底与腿出口会产生制作接口的数学接触，检查单独保留原始交点，不能把通过写成所有网格零相交。详见[短裤封边与连续裙装](Documentation/短裤封边与连续裙装.md)。

前两批上衣、长裤、帽饰及原农户／卫兵／弓手继续保留；头饰没有本轮改动。历史制作记录见[第一批](Documentation/服饰第一批制作与验收.md)、[第二批](Documentation/轻便服饰与头饰安全留量.md)，本轮版本和验收证据见[工作交接](Documentation/工作交接.md)。

## 拉取与运行

Node.js >=22.12；也可双击Start-Local.cmd。已有工作区：

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
npm run dev
```

打开终端输出地址，右栏“下装”选择封口短裤、日常短裙或素面长裙。男女都能搭配背心、短打短褂、交领常服；推荐不强制改变性别。保留发式、帽饰、发色、种子、锁定、撤销、浏览器保存和严格V5文件导入导出。

FBX放入动画参考目录（允许子目录），重启或构建会动态扫描提取。当前23份不是上限；搜索、分类、收藏、逐帧、变速、源骨架对照及暂停换装相位保持不变。

## 数据与职责

Recipe V5 → patterns注册 → 独立服饰网格 → 固定皮肤覆盖 → 一个蒙皮网格 → 当前基模的20骨骼。每顶点最多双权重。patterns只注册；assets拥有专用版型与权重；assembly负责覆盖与装配；adornments负责冠髻。

服装几何为wanhu-modular-garments-v7，皮肤wanhu-skin-cage-v3，绑定wanhu-fixed-bodies-v1。资源v7不改变配方：Recipe仍精确六字段version/bodyType/slots/dyes/hairStyle/hairColor，只读取wanhu.character.wardrobe.v5。旧版本、未知和缺失字段拒绝，不建立兼容fallback。源人体各524三角形，保护签名不刷新。

## 快速审图与正式回归

```sh
npx playwright install chromium
npm run review:local
npm run review:local -- --wardrobe
npm run review:local -- --lightwear
npm run review:local -- --skirts
npm run review:local -- --skirts --full
```

原三个入口不删减。裙装快速入口160张视口＋工作台，完整入口412张＋工作台；16次真实UI换装检查暂停相位。图片生成不等于实际查看。当前执行环境的本机浏览器曾被策略拦截，本轮使用runner执行同一review:local入口并实际下载审图，不冒充本地网页成功。

保留check:retired、check:mesh、build、check:mixamo、check:wardrobe、check:tailoring；新增check:skirts。原六条正式Actions不减少，裙装并行job加入Modular Garment Review，原两批和人体矩阵完整保留。新增52张基线、412张候选及36对同相机短裤对照。源帧／中点贯穿为24,216样本，原20,180样本和阈值不删改，新增固定封底接口与裙装极端动作单列诊断。

低模膝肘折面、裙底暗面与极端动作穿插仍有边界；不承诺实时布料表现或所有连续时刻零穿模。尚无通用外部服装导入器、连续身材、多档LOD、儿童老人、Unity正式运行时或GPU Crowd。不部署Vercel／Visual。

文档：[V5契约](Documentation/固定基模与换装V5.md) · [服装架构](Documentation/服装生成架构.md) · [动画](Documentation/Mixamo动画接入.md) · [Unity迁移](Documentation/GPU骨骼动画迁移契约.md)。
