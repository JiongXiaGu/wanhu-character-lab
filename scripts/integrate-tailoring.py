"""一次性集成工具：只修改明确的源码接口；成功提交后连同触发工作流删除。"""
from pathlib import Path
import json
import subprocess

BASE = 'e6cd7702221ab4f42445e4dbe4991a78820d3d2d'

def read_base(path):
    expected = subprocess.check_output(['git', 'rev-parse', f'{BASE}:{path}'], text=True).strip()
    actual = subprocess.check_output(['git', 'hash-object', path], text=True).strip()
    assert actual == expected, f'{path} has concurrent edits; refuse replacement'
    return Path(path).read_text()

def one(text, old, new):
    assert text.count(old) == 1, f'expected one integration anchor: {old[:100]!r}; got {text.count(old)}'
    return text.replace(old, new, 1)

def save(path, text):
    Path(path).write_text(text)
    print('updated', path)

p = 'src/character/wardrobe/geometry.ts'
s = read_base(p)
head = s[:s.index('function resizeLoop(')]
head = head.replace(', type Weight', '')
head = one(head, 'import { add, mul, sub, ring, bridge, face, vertex, OCT, BOX, orient }', 'import { ring, bridge, face, OCT, BOX, orient }')
head = one(head, "export const BODY_HIDE_VERSION='wanhu-garment-hide-v3';\nexport const GARMENT_GEOMETRY_VERSION='wanhu-garment-geometry-v4';", "export { BODY_HIDE_VERSION, GARMENT_GEOMETRY_VERSION } from './tailoring';")
head = "import { styleTailoredSurface, addTailoredPanels, type WardrobeLod } from './tailoring';\n" + head
bridge = '''export function styleGarmentSurface(c:Cage,recipe:Recipe):void {
  styleTailoredSurface(c,recipe,garmentColors(recipe));
}
export function addGarmentSilhouettes(c:Cage,recipe:Recipe,lod:WardrobeLod=0):void {
  addTailoredPanels(c,recipe,garmentColors(recipe),lod);
}
function append(target:Cage,piece:Cage){
  orient(piece);
  const offset=target.vertices.length;target.vertices.push(...piece.vertices);
  target.faces.push(...piece.faces.map(f=>({...f,v:f.v.map(i=>i+offset)})));
}
'''
save(p, head + bridge + s[s.index('function solidBox('):])

p = 'src/character/v3/outfit.ts'
s = read_base(p)
s = one(s, 'export function makeCharacter(input: RecipeInput): CharacterData {', 'export function makeCharacter(input: RecipeInput, options: { lod?: 0 | 2 } = {}): CharacterData {')
s = one(s, 'addGarmentSilhouettes(c,recipe);', 'addGarmentSilhouettes(c,recipe,options.lod??0);')
save(p, s)

p = 'src/scene/CharacterViewport.tsx'
s = read_base(p)
s = one(s, 'recipe:Recipe; mixamo:MixamoSelection;', 'recipe:Recipe; lod?:0|2; mixamo:MixamoSelection;')
s = one(s, 'builtRecipe:Recipe; pairPerspective:', 'builtRecipe:Recipe; builtLod:0|2; pairPerspective:')
s = one(s, 'geometryId:()=>string };', 'geometryId:()=>string; getLod:()=>0|2 };')
s = one(s, 'makeActor(makeCharacter(latest.current.recipe))', 'makeActor(makeCharacter(latest.current.recipe,{lod:latest.current.lod??0}))')
s = one(s, 'builtRecipe:latest.current.recipe,controls,', 'builtRecipe:latest.current.recipe,builtLod:latest.current.lod??0,controls,')
s = one(s, "geometryId:()=>rt?.actor.mesh.geometry.uuid??'',focusHead()", "geometryId:()=>rt?.actor.mesh.geometry.uuid??'',getLod:()=>rt?.builtLod??0,focusHead()")
s = one(s, 'const recipeChanged=r.builtRecipe!==options.recipe, selectionChanged=', 'const recipeChanged=r.builtRecipe!==options.recipe||r.builtLod!==(options.lod??0), selectionChanged=')
s = one(s, 'r.actor=makeActor(makeCharacter(options.recipe));r.builtRecipe=options.recipe;', 'r.actor=makeActor(makeCharacter(options.recipe,{lod:options.lod??0}));r.builtRecipe=options.recipe;r.builtLod=options.lod??0;')
s = one(s, '},[options.recipe,options.mixamo,options.restart]);', '},[options.recipe,options.lod,options.mixamo,options.restart]);')
s = s.replace('改 Recipe 才重建几何', '改 Recipe 或 LOD 才重建几何')
save(p, s)

p = 'src/App.tsx'
s = read_base(p)
s = one(s, 'export default function App(){', "export default function App(){\n  const [lod,setLod]=useState<0|2>(()=>qs.get('lod')==='2'?2:0);")
s = one(s, 'options={{recipe,mixamo,', 'options={{recipe,lod,mixamo,')
s = one(s, '<span className="eyebrow">试衣 / 动作</span>', '<span className="eyebrow">试衣 / 动作</span><label className="lod-control">细节<select aria-label="模型细节" data-testid="lod-select" value={lod} onChange={e=>setLod(Number(e.target.value)===2?2:0)}><option value="0">LOD0 · 完整服饰</option><option value="2">LOD2 · 服饰草案</option></select></label>')
s = one(s, '<button disabled={!ready} onClick={replay}>重播外部动作</button>', '<button disabled={!ready} onClick={replay}>重播外部动作</button><button aria-pressed={mixamo===\'pilot-switches\'} onClick={()=>selectMixamo(\'pilot-switches\')}>坐姿试衣</button>')
s = one(s, "{stats?.triangles??'—'} tris", "LOD{lod} · {stats?.triangles??'—'} tris")
s = one(s, '写意衣冠 · 01', '写意衣冠 · 02')
save(p, s)

p = 'src/character/mixamo/catalog.ts'
s = read_base(p)
save(p, one(s, "label:'拨动开关'", "label:'坐姿拨动开关'"))

p = 'scripts/check-wardrobe.ts'
s = read_base(p)
start = s.index('  // 不同摆长共享高度处必须具有同一权重')
end = s.index('  assert.deepEqual(parseRecipeFile', start)
s = s[:start] + '''  // 开衩款式保留完整连续内衬；不能靠删除整段腿部掩盖穿插。
  for(const region of ['pelvis','thigh','shin'])assert.equal(c.faces.filter(f=>f.region===region).length,d.body.faces.filter(f=>f.region===region).length,'可见内衬不完整：'+region);
  const panels=c.vertices.filter(v=>v.id.startsWith('TailoredPanel.'));
  for(const v of panels){assert(v.id.includes('.Right.')?v.p[0]>0:v.p[0]<0,'分裳不得横跨焊接双腿');openEdgeVerticesChecked++;}
  if(recipe.slots.bottom==='pleated_skirt'||recipe.slots.bottom==='robe_skirt'){
    assert(panels.length>0,'裙裳缺少真实衣片');
    for(const side of['Right','Left'])for(const anchor of['Thigh','KneeUpper','Knee','KneeLower','Calf','Ankle'])assert(c.faces.some(f=>f.v.some(i=>c.vertices[i].id.startsWith(side+anchor))),'连续内衬缺少'+side+anchor);
    continuousLinerCases++;
  }
''' + s[end:]
s = s.replace('wrapEdgesChecked', 'openEdgeVerticesChecked').replace('coveredLegCases', 'continuousLinerCases')
s = s.replace('未执行长裳搭接/遮挡检查', '未执行开衩/连续内衬检查')
s = s.replace('static wrap edges and covered-body restoration', 'open seams and continuous-liner restoration')
save(p, s)

p = 'scripts/check-tailoring.ts'
s = Path(p).read_text()
s = one(s, 'let checkedFrames = 0, checkedVertices = 0;', 'let checkedFrames = 0, checkedVertices = 0, completed = false;')
s = one(s, "  assert.equal(failures.length, 0, '常用试衣动作检测到分裳/内衬穿插；查看 numeric.json 的具体时间和顶点');\n} finally {", "  assert.equal(failures.length, 0, '常用试衣动作检测到分裳/内衬穿插；查看 numeric.json 的具体时间和顶点');\n  completed = true;\n} finally {")
s = one(s, 'passed: staticRows.length === 36', 'passed: completed && staticRows.length === 36')
save(p, s)
p = 'src/character/wardrobe/tailoring.ts'
save(p, one(Path(p).read_text(), 'import { B, rigid,', 'import { rigid,'))

p = 'src/styles.css'
s = read_base(p)
save(p, s + '\n/* LOD 是试衣选项，不占用外观槽位。 */\n.motion-head,.motion-actions{flex-wrap:wrap}\n.lod-control{display:flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap}\n.lod-control select{max-width:155px}\n')
p = 'package.json'
value = json.loads(read_base(p))
value['scripts']['check:tailoring'] = 'tsx scripts/check-tailoring.ts'
value['scripts']['review:tailoring'] = 'tsx scripts/review-tailoring.ts'
save(p, json.dumps(value, ensure_ascii=False, indent=2) + '\n')
p = '.gitignore'
s = read_base(p)
save(p, s.rstrip() + '\nreview-tailoring/\n')

for p in ['README.md', 'AGENTS.md', 'Documentation/工作交接.md']:
    s = read_base(p)
    s += '''\n## 动作稳定服饰与 LOD 第一批\n\n本批改造见 [服饰动作稳定性与 LOD](Documentation/服饰动作稳定性与LOD.md)。\n新分裳改为跟随腰髋、大腿、膝和小腿，保留完整可见内衬；上衣下摆与下装使用同一连续衣面表达颜色层次。坐姿拨动开关（pilot-switches）与慢跑、射箭并列重点验收。原人体/20 骨骼/男性基线/FBX 不改。\n\n提供手动 LOD0 / LOD2 服饰草案；LOD 不写入 Recipe，切换保留装扮和暂停相位。草案仍保留原 510 tris 人体，不是最终全人物 Crowd LOD。新增 Tailoring Review，必须核对真实报告、图片和完整坐姿视频后合并；本说明不提前代表验收通过。\n'''
    if p.startswith('Documentation/'):
        s = s.replace('(Documentation/服饰动作稳定性与LOD.md)', '(服饰动作稳定性与LOD.md)')
    save(p, s)

subprocess.run(['git', 'diff', '--check'], check=True)
print('Integration edits complete; tests and review still required.')
