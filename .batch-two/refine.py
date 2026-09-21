from pathlib import Path

def replace(path,before,after):
    p=Path(path);t=p.read_text();assert t.count(before)==1,(path,before[:100],t.count(before));p.write_text(t.replace(before,after))

# 帽壳应开放戴入头部的底口；封死帽底会从内部横切头发，外扩不能修复这种相交。
replace('src/character/wardrobe/adornments.ts',"bridge(c,a,b,'equipment',color);face(c,[...a].reverse(),'equipment',color);face(c,b,'equipment',tone(color,1.07));","bridge(c,a,b,'equipment',color);face(c,b,'equipment',tone(color,1.07));")

old="  assert(d.surface.faces.filter(f=>f.part==='skin').every(f=>!['torso','upperArm','pelvis','thigh','shin','foot'].includes(f.region)),'覆盖表失效');"
new="""  if(look.id.startsWith('lightwork-')){
    const hidden=new Set(d.garments.flatMap(p=>p.covers));
    const visible=d.surface.faces.filter(f=>f.part==='skin');
    assert(visible.every(f=>!hidden.has(f.region)),'轻便服装固定覆盖表失效');
    assert(visible.some(f=>f.region==='upperArm')&&visible.some(f=>f.region==='shin'),'新短装必须真实保留手臂和小腿');
  }else{
    assert(d.surface.faces.filter(f=>f.part==='skin').every(f=>!['torso','upperArm','pelvis','thigh','shin','foot'].includes(f.region)),'覆盖表失效');
  }"""
replace('scripts/check-tailoring-v2.ts',old,new)
replace('scripts/check-tailoring-v2.ts',"for(const look of ['plain-female','town-female','ceremony-female'])","for(const look of ['plain-female','town-female','ceremony-female','lightwork-male','lightwork-female'])")
replace('scripts/check-wardrobe.ts','looks:8,bodyTypes:2','looks:WARDROBE_LOOKS.length,bodyTypes:BODY_TYPES.length')

replace('scripts/review-local.mjs',"const wardrobe = process.argv.includes('--wardrobe');","const wardrobe = process.argv.includes('--wardrobe');\nconst lightwear = process.argv.includes('--lightwear');\nif(wardrobe && lightwear)throw new Error('请选择 --wardrobe 或 --lightwear，不可同时使用');")
replace('scripts/review-local.mjs',"[wardrobe ? 'scripts/review-wardrobe-batch.mjs' : 'scripts/review-deformation.mjs',","[lightwear ? 'scripts/review-lightwear.mjs' : wardrobe ? 'scripts/review-wardrobe-batch.mjs' : 'scripts/review-deformation.mjs',")
replace('scripts/review-local.mjs',"${wardrobe ? 'review-wardrobe-batch' : 'review-deformation'}/local/","${lightwear ? 'review-wardrobe-batch/lightwear-local' : (wardrobe ? 'review-wardrobe-batch/local' : 'review-deformation/local')}/")

# 原文档中第一批历史记录不改；当前架构和使用入口追加新范围。
for path,extra in {
 'AGENTS.md':'''\n## 第二批轻便服饰\n\n2026-09-21 用户批准干活背心、短打短褂、及膝短裤、短下裳，以及全部包覆帽饰的固定安全外扩。不要继续堆相似长袖/长裤。先读《轻便服饰与头饰安全留量.md》。新增短装保持露肤，不能整块隐藏upperArm/shin；分片短下裳明确是裙裤式简化，不宣称连续软布裙。不增加Recipe字段或按发型适配器。`review:local -- --lightwear`是新批次入口，原两个入口保留。''',
 'Documentation/换装工作台使用.md':'''\n## 第二批轻便服饰\n\n新增干活背心、短打短褂、及膝短裤、短下裳·分片裙裤，原五件常服和职业搭配保持。轻便推荐为夏日劳作/轻装围裳，男女都可选，推荐总数为10。帽饰允许夸张外扩，取帽仍恢复同一发型。\n\n`npm run review:local -- --lightwear`生成第二批静态混搭与帽饰图片；加`--full`覆盖关键动作、染色、近景和相位保持。图片需要实际打开审查。短下裳采用能分开随两腿运动的A字裙裤，不是连续布料裙。''',
 'Documentation/服装生成架构.md':'''\n## 第二批轻便资产\n\n新增work-vest.ts、short-jacket.ts与short-bottoms.ts，注册9上衣/9下装。背心没有袖筒；短褂的短袖止于上臂，二者covers仅torso。短裤/分片短下裳covers为pelvis/thigh，裸露手臂和小腿使用原皮肤，不改变body.ts。短下裳自有扇形褶面/下摆坐标，保留完整裆底及中间行走开衩。\n\nheadwear-fit.ts对帽饰顶点作一次固定制作留量，不读取动画/发型；簪饰不被当作帽壳放大。包巾/方冠开放帽底，保留戴帽隐藏发髻的原规则。详细结构/染色/测试见《轻便服饰与头饰安全留量.md》。''',
 'Documentation/玩家角色自定义与服饰分期.md':'''\n## 第二批：轻便服饰与头饰\n\n当前制作转为无袖、上臂短袖、及膝短裤与A字短下裳，扩大露肤面积和远景剪影差异，不继续补近似常服。帽饰统一留足头发空间，允许夸张。短下裳采用分片裙裤，保留无实时布料的边界。完整长裙/长袍另行评估，不在本轮扩张。''',
 'Documentation/GitHubActions截图验收规范.md':'''\n## 第二批轻便矩阵\n\n`review:lightwear`接在既有Modular的第一批脚本之后；第一批48/168/296和所有旧矩阵不删减。第二批包含70张基线帽饰、270张候选视口及1张工作台，70对帽饰相机一致、8次UI换装相位保持；旧款与新增轻便款混搭、三种发型、裸露手臂/小腿、短下摆与压力动作均检查。\n\n`lightwear-*.jpg/json`进入既有keyframes产物，原PNG在完整Modular产物。`review:local -- --lightwear`静态快速模式134张，加--full为270张。数值通过、图片生成、人工打开抽查分别记录。''',
}.items():
    p=Path(path);p.write_text(p.read_text().rstrip()+'\n'+extra.strip()+'\n')
# 过时计数只更新当前说明，不抹去第一批验收数字。
p=Path('Documentation/换装工作台使用.md');p.write_text(p.read_text().replace('“全部8款”','“全部10款”'))
p=Path('README.md');t=p.read_text();p.write_text(t.replace('# 万户 · 衣冠工坊 V5','# 万户 · 衣冠工坊 V5\n\n## 第二批轻便服饰\n\n新增干活背心、短打短褂、及膝短裤、短下裳·分片裙裤，男女可混搭；轻盔等包覆帽饰加入固定安全外扩，簪饰保持原位。Recipe仍V5，源人体/骨骼/FBX不变。具体制作边界见[轻便服饰与头饰安全留量](Documentation/轻便服饰与头饰安全留量.md)。\n\n本批截图：`npm run review:local -- --lightwear`，完整模式加`--full`。'))
print('SECOND_BATCH_REFINED')
