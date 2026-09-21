# 服装Cap封闭实验

## 目标

验证《万户天工》低模、中远景角色是否可以把服装接口直接用单面Cap封死，让身体或相邻服饰穿过不可见封面，以更少的内部结构消除袖窿、领口、腰口、裤脚和鞋口能看到背景／背面的裂缝。

本轮只改三件资产，不批量推广：work_vest、short_trousers、cloth_shoes。固定成年男女、Recipe V5、20骨骼、双权重、人体几何、FBX、覆盖表和染色协议不变。

## 当前制作

| 资产 | 封闭接口 | 当前三角形 | 当前逻辑点 |
|---|---|---:|---:|
| work_vest | waist、neck、LeftCuff、RightCuff | 128 | 66 |
| short_trousers | waist、LeftCuff、RightCuff | 164 | 84 |
| cloth_shoes | LeftAnkle、RightAnkle | 64 | 36 |

Cap直接复用现有接口环，不增加中心点，不做内衬、布料厚度、Boolean、UV缝合或运行时裁剪。short_trousers删除原16个CuffInset顶点和32个厚断面三角形，再加入双裤脚12个Cap三角形及腰口8个Cap三角形。

work_vest仍只covers torso，必须保留原上臂、前臂和手；short_trousers仍只covers pelvis/thigh，必须保留shin；cloth_shoes只covers foot。视觉封闭不能通过扩大covers把应该露出的身体直接删掉。

## 背心封口配色

work_vest的领口、双袖窿和腰口Cap统一使用recipe.dyes.primary，与衣身主布属于同一个色区。此前领口使用accent、袖窿和腰口使用secondary，浅色方案下会把封口表现为额外领边／内衬，甚至看起来像露肤；此处分离于几何裂缝处理。

封口不单独染成肤色，不追加任意内衬色，也不人为压暗。玩家修改主布色时四个Cap一起变化；原门襟、装饰缘边和真实裸露的脖子／手臂维持原色区。光照和面法线造成的自然明暗不通过换材质、改灯光或删皮肤掩盖。

这次颜色修正只改变work_vest的四个Cap面颜色，不改变其128个三角形、66个逻辑点、接口、权重或朝向。short_trousers、cloth_shoes及其他服饰不因背心配色修正改动；几何版本仍为v8，Recipe仍为V5。

check:lightwear对男女各执行四处封口的原配色、改色和最终装配检查，共24项颜色断言；另逐封口注入secondary、accent和肤色共12个反例，保证错误色区会被拒绝。保留原拓扑、固定露肤、染色不改几何及帽发检查。自动通过不能替代用户对本次封口颜色的视觉审查。

## 数据契约

GarmentPiece继续用openings表示真实boundary edge；新增sealedInterfaces表示已封面的接口锚点。sealedInterfaces的每条环边必须恰好被两个面使用，并且必须存在一个直接复用该环顶点的Cap面。assembly同时保留两类锚点，但不做运行时求交或自动修补。

当前三件试验资产应为零真实openings。其他服饰维持原契约，不因试验自动封口。几何版本升级为wanhu-modular-garments-v8，Recipe仍是V5。

## 相交与验收

Cap允许身体穿过不等于全局放宽穿模。离线相交检查只新增一条窄规则：short_trousers的Cuff Cap与可见skin.shin可记录为制作接口；腰口Cap、裤身、Calf、大腿和其他旧款没有豁免。裙装原HemCenter分类保持不变。

自动验收至少包括：未声明boundary edge为0、非流形为0、退化面为0、sealedInterfaces确实有Cap、固定露肤不变、染色不改拓扑、关键FBX有限值与既有源键／中点相交检查不降级。

视觉验收使用现有lightwear矩阵，重点查看干活背心＋封口短裤＋布鞋的正／侧／背／自由视角，以及Pilot Flips Switches、Jogging、Shooting Arrow、Start Walking和Snatch。优先判断正常游戏距离是否仍能看到背景、服装背面或明显平面盖板；若试验观感成立，再由用户决定是否推广到其他服装。
