from pathlib import Path
import re,json

def edit(name,fn):
 p=Path(name); old=p.read_text(); new=fn(old)
 if old==new: raise RuntimeError('Patch made no change: '+name)
 p.write_text(new)
def one(s,a,b):
 if s.count(a)!=1: raise RuntimeError('Expected one source match: '+a[:100])
 return s.replace(a,b,1)

def tailoring(s):
 s="import {rebuildSeat,restoreSeatVolume} from './seat';\n"+s
 s=one(s,"export type WardrobeLod=0|1|2;","/** @deprecated 旧调用兼容；三种数值都映射到同一标准模型。 */\nexport type WardrobeLod=0|1|2;\nexport const STANDARD_MODEL_PROFILE='wanhu-standard-low-v1';")
 s=s.replace('wanhu-tailoring-v2-continuous-2','wanhu-tailoring-v2.1-seat-1')
 a=s.index('function averageWeight(');b=s.index('/**\n * 服装版型',a);s=s[:a]+s[b:]
 s=one(s,'lod:WardrobeLod=0','lod:WardrobeLod=2')
 s=one(s,'  refine(c,lod);','  restoreSeatVolume(c);\n  rebuildSeat(c);')
 return s
edit('src/character/wardrobe/tailoring.ts',tailoring)
edit('src/character/wardrobe/geometry.ts',lambda s:one(s,'lod:WardrobeLod=0','lod:WardrobeLod=2'))
edit('src/character/v3/outfit.ts',lambda s:one(s,'options.lod??0','options.lod??2'))

def rig(s):
 s="import {surfaceCornerNormals} from './normals';\n"+s
 s=one(s,'  for (const f of c.faces) {','  const cornerNormals=surfaceCornerNormals(c);\n  let faceIndex=0;\n  for (const f of c.faces) {')
 s=one(s,'    const start = p.length / 3,\n      normal = polygonNormal(c, f);','    const start = p.length / 3;')
 s=one(s,'    for (const vi of f.v) {','    for (const [corner,vi] of f.v.entries()) {')
 s=one(s,'      n.push(...normal);','      n.push(...cornerNormals[faceIndex][corner]);')
 s=one(s,'      ix.push(start, start + i, start + i + 1);\n  }','      ix.push(start, start + i, start + i + 1);\n    faceIndex++;\n  }')
 s=s.replace('polygonNormal, edgeKey','edgeKey')
 return s
edit('src/character/v3/rig.ts',rig)

def app(s):
 s=one(s,"import type {WardrobeLod} from './character/wardrobe/tailoring';\n",'')
 s=re.sub(r'^ const \[lod,setLod\].*\n','',s,flags=re.M)
 s=one(s,'options={{recipe,lod,mixamo','options={{recipe,mixamo')
 start=s.index('<div className="lod-controls"');end=s.index('<div className="motion-head">',start)
 s=s[:start]+'<div className="lod-controls" data-testid="standard-model"><span>标准低模</span><span className="hint">单一精度 · FBX 试衣</span></div>'+s[end:]
 s=s.replace('动作试衣 · V2','标准低模 · V2.1')
 return s
edit('src/App.tsx',app)

def viewport(s):
 s=one(s,"import type {WardrobeLod} from '../character/wardrobe/tailoring';\n",'')
 for a,b in [('recipe:Recipe; lod?:WardrobeLod;','recipe:Recipe;'),('builtRecipe:Recipe; builtLod:WardrobeLod;','builtRecipe:Recipe;'),('makeCharacter(latest.current.recipe,{lod:latest.current.lod})','makeCharacter(latest.current.recipe)'),('builtLod:latest.current.lod??0,',''),('makeCharacter(options.recipe,{lod:options.lod})','makeCharacter(options.recipe)'),('r.builtLod=options.lod??0;',''),('options.recipe,options.lod,options.mixamo','options.recipe,options.mixamo')]:s=one(s,a,b)
 s=one(s,'const lodChanged=r.builtLod!==(options.lod??0), recipeChanged=r.builtRecipe!==options.recipe||lodChanged,','const recipeChanged=r.builtRecipe!==options.recipe,')
 s=one(s,'    const keepCamera=lodChanged&&r.builtRecipe===options.recipe;\n','')
 s=s.replace('if(!keepCamera)','')
 s=one(s,'focusHead:()=>void; geometryId','focusHead:()=>void; focusHips:()=>void; geometryId')
 s=one(s,"geometryId:()=>rt?.actor.mesh.geometry.uuid??'',focusHead()", "geometryId:()=>rt?.actor.mesh.geometry.uuid??'',focusHips(){if(!rt)return;const center=rt.actor.bones[1].getWorldPosition(new T.Vector3()).add(new T.Vector3(0,-.08*latest.current.recipe.height/1.76,0));const direction=rt.camera.position.clone().sub(rt.controls.target).normalize();rt.controls.target.copy(center);rt.camera.position.copy(center).addScaledVector(direction,2);if(rt.camera instanceof T.OrthographicCamera){rt.camera.zoom=2.25;rt.camera.updateProjectionMatrix();}rt.camera.lookAt(center);rt.controls.update();rt.render();},focusHead()")
 return s
edit('src/scene/CharacterViewport.tsx',viewport)

# 删除重复的几何等级矩阵，但不放宽动作、体型或三角贯穿判定。
def numeric(s):
 s=s.replace('[0,1,2] as WardrobeLod[]','[2] as WardrobeLod[]')
 s=one(s,"assert(counts[0]>counts[1]&&counts[1]>counts[2],'LOD 必须真实递减，不能只是 UI 切换');", "assert.equal(counts.length,1);for(const oldLod of [0,1,2] as WardrobeLod[])assert.deepEqual(makeCharacter(recipe,{lod:oldLod}),base,'旧LOD参数必须归一到标准模型');assert.deepEqual(makeCharacter(recipe),base);")
 s=s.replace('staticVariants:rows.length*3','staticVariants:rows.length').replace('wanhu-tailoring-v2\'','wanhu-tailoring-v2.1\'')
 return s
edit('scripts/check-tailoring-v2.ts',numeric)
edit('scripts/check-tailoring-intersections.ts',lambda s:one(s,'[0,1,2] as WardrobeLod[]','[2] as WardrobeLod[]'))

def review(s):
 s=one(s,"for(const lod of ['0','1','2'])","for(const lod of ['2'])")
 a=s.index(' const counts:number[]=[];');b=s.index(' await page.screenshot({path:dir',a)
 s=s[:a]+" assert.equal(await page.getByTestId('standard-model').count(),1);assert.equal(await page.locator('[data-testid^=lod-]').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify(window.__WANHU_RECIPE__!())),saved);\n"+s[b:]
 # 增加同一相位、同一相机的髋部近景。多视图/全视频原有门槛仍保留。
 marker=' // 交互检查：'
 extra=""" for(const bodyType of ['male','female'])for(const view of ['front','side','back'])for(const display of ['beauty','clay','cage']){
  await open({bodyType,look:'town-female',mixamo:'pilot-switches',view,display});
  await page.evaluate(()=>{window.__WANHU_REVIEW__!.seek(.5);window.__WANHU_REVIEW__!.focusHips();});
  await shot(`hips-${bodyType}-${view}-${display}`,.5,{bodyType,view,display,kind:'hips'});
 }
"""
 s=one(s,marker,extra+marker)
 return s
edit('scripts/review-tailoring-v2.ts',review)
edit('scripts/compose-tailoring-v2.py',lambda s:s.replace('range(3)','[2]').replace("'-lod0-pilot-side-0.5'","'-lod2-pilot-side-0.5'").replace("for name in ['pilot-switches'", "chosen=[f for f in files if f.startswith('hips-')]\nif chosen:sheet(chosen,'hips-closeups.jpg',3)\nfor name in ['pilot-switches'"))

notice='> **V2.1 单一标准模型更新（本轮实施，实际验收见《标准低模髋裆修正》）：** 当前LOD2升级为唯一标准精度，旧LOD0/LOD1细分路径与UI已删除。保留旧lod参数仅作归一兼容，不产生另一个网格。衣面新增共享索引髋根环和四角裆底，仅局部平滑法线；源人体/20骨骼/双权重/FBX/Recipe V4不变。下文旧LOD数量和旧裆点结构只属于历史版本，不作为当前实现。\n\n'
for name in ['README.md','AGENTS.md','Documentation/工作交接.md','Documentation/换装工作台使用.md','Documentation/服装动画适配V2.md','Documentation/服装生成架构.md','Documentation/GPU骨骼动画迁移契约.md','Documentation/玩家角色自定义与服饰分期.md','Documentation/运行时人物生成架构.md','Documentation/项目概览.md','Documentation/GitHubActions截图验收规范.md']:
 edit(name,lambda s:notice+s)
edit('README.md',lambda s:s.replace('中央切换视角、LOD、暂停','中央切换视角、暂停'))
# 临时实施脚本和工作空间导出不进入 main。
for name in ['.github/workflows/tmp-hip-workspace.yml','.github/workflows/tmp-hip-apply.yml','.github/scripts/apply-hip-standard.py']:
 Path(name).unlink(missing_ok=True)
print('Applied single-standard integration; no source FBX, baseline body, skeleton or lockfile modified.')
