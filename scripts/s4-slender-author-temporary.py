from pathlib import Path
root = Path('.')
asset = root / 'src/character/wardrobe/captain-equipment.ts'
assert "'wanhu-captain-helmets-v1'" in asset.read_text(), 'Unexpected captain baseline'
asset.write_text('''import { B, rigid, type Cage, type Recipe, type Vec3 } from '../v3/types';
import { ring, bridge, face, vertex, orient } from '../v3/cage';
import { addPalaceHelmet } from './military-equipment';
import { addFrontierHelmet } from './frontier-equipment';
import { addCityHelmet } from './city-equipment';

export const CAPTAIN_EQUIPMENT_VERSION = 'wanhu-captain-helmets-v2';

// 四向棱面形成有厚度的细束，不使用横向箱体、透明翎片或毛球。
const SECTION = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;
type CrestRow = readonly [name: string, y: number, z: number, width: number, depth: number];

function append(target: Cage, piece: Cage): void {
  orient(piece);
  const offset = target.vertices.length;
  target.vertices.push(...piece.vertices);
  target.faces.push(...piece.faces.map(f => ({ ...f, v: f.v.map(i => i + offset) })));
}

/** 三件顶饰共用小型闭合截面操作；轮廓与分区仍由各自作者数据决定。 */
function addCrest(target: Cage, prefix: string, rows: readonly CrestRow[], tip: Vec3, colors: readonly string[]): void {
  if (rows.length < 2 || colors.length !== rows.length) throw new Error('队长顶饰截面与色段不完整');
  const c: Cage = { vertices: [], faces: [], anchors: {} }, w = rigid(B.Head);
  const loops = rows.map(([name, y, z, width, depth]) =>
    ring(c, `${prefix}${name}`, [0, y, z], [1, 0, 0], [0, 0, 1], SECTION, width, depth, w));
  face(c, loops[0], 'equipment', colors[0]);
  for (let i = 0; i < loops.length - 1; i++) bridge(c, loops[i], loops[i + 1], 'equipment', colors[i]);
  const point = vertex(c, `${prefix}Tip`, tip, w), end = loops.at(-1)!;
  for (let i = 0; i < end.length; i++) face(c, [end[i], end[(i + 1) % end.length], point], 'equipment', colors.at(-1)!);
  append(target, c);
}

/** 仅在队长的临时副本中移除原短缨闭合组件；不改普通盔作者文件或盔壳/护颈。 */
function removePalacePlume(c: Cage): void {
  const first = c.vertices.findIndex(v => v.id.startsWith('PalaceHelmet.Plume.'));
  if (first < 0 || c.vertices.slice(first).some(v => !v.id.startsWith('PalaceHelmet.Plume.'))) {
    throw new Error('宫卫原短缨不再是独立末端组件，需要重新核对作者接口');
  }
  c.faces = c.faces.filter(f => {
    if (f.v.some(i => i < first) && f.v.some(i => i >= first)) throw new Error('宫卫短缨与盔壳共享面，不能直接替换');
    return f.v.every(i => i < first);
  });
  c.vertices.splice(first);
}

/** 宫卫：小铜座、细长束缨、收尖上端；不再拓宽原短缨。 */
export function addPalaceCaptainHelmet(target: Cage, recipe: Recipe): void {
  const c: Cage = { vertices: [], faces: [], anchors: {} };
  addPalaceHelmet(c, recipe);
  removePalacePlume(c);
  append(target, c);
  addCrest(target, 'PalaceHelmet.Plume.', [
    ['Base', 1.893, -.006, .011, .012],
    ['Socket', 1.925, -.006, .012, .013],
    ['Body', 2.005, -.012, .026, .028],
    ['Upper', 2.090, -.021, .013, .017],
  ], [0, 2.145, -.028], [recipe.dyes.accent, recipe.dyes.primary, recipe.dyes.primary, recipe.dyes.primary]);
}

/** 边军：紧束暗赤短缨托起细高盔尖；后倾克制，不再有肥厚拖尾。 */
export function addFrontierCaptainHelmet(target: Cage, recipe: Recipe): void {
  addFrontierHelmet(target, recipe);
  addCrest(target, 'FrontierHelmet.CaptainPlume.', [
    ['Base', 1.843, -.009, .011, .013],
    ['Socket', 1.867, -.009, .012, .014],
    ['Body', 1.916, -.012, .023, .025],
    ['Upper', 1.962, -.017, .007, .010],
  ], [0, 2.065, -.024], [recipe.dyes.secondary, recipe.dyes.accent, recipe.dyes.accent, recipe.dyes.secondary]);
}

/** 城军：朴素的窄竖冠叶；纵向收尖，原低檐与短后片保持。 */
export function addCityCaptainHelmet(target: Cage, recipe: Recipe): void {
  addCityHelmet(target, recipe);
  addCrest(target, 'CityHelmet.CaptainCrest.', [
    ['Base', 1.820, -.006, .010, .014],
    ['Body', 1.905, -.009, .024, .018],
    ['Upper', 1.978, -.016, .012, .012],
  ], [0, 2.015, -.022], [recipe.dyes.accent, recipe.dyes.accent, recipe.dyes.accent]);
}
''')
p = root/'scripts/check-soldier-identities.ts'
s = p.read_text()
s=s.replace('type Cage, type Recipe', 'type Cage')
s=s.replace('return { min, max, width: max[0] - min[0], depth: max[2] - min[2] };', 'return { min, max, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };')
start=s.index('/** 测量装配后的真实顶点')
end=s.index("\nassert.deepEqual(SOLDIER_IDENTITY_IDS",start)
s=s[:start]+'''function ornamentPrefix(style: SoldierStyleId): string {
  return styles.find(s => s.id === style)!.prefix + (style === 'palace' ? 'Plume.' : style === 'frontier' ? 'CaptainPlume.' : 'CaptainCrest.');
}
/** 新授权为细高竖饰：旧“越宽越好”的外观条件已撤销，结构/绑定/穿插门槛不变。 */
function assertSilhouette(style: SoldierStyleId, ordinary: Cage, captain: Cage) {
  const prefix = styles.find(s => s.id === style)!.prefix, crest = ornamentPrefix(style);
  const base = bounds(ordinary, prefix), next = bounds(captain, prefix), ornament = bounds(captain, crest);
  const shell = bounds(captain, prefix + 'Shell.');
  const summit = bounds(captain, prefix + 'Shell.' + (style === 'palace' ? 'Finial.' : 'Ridge.'));
  const root = bounds(captain, crest + 'Base.'), body = bounds(captain, crest + 'Body.'), upper = bounds(captain, crest + 'Upper.');
  const tip = captain.vertices.find(v => v.id === crest + 'Tip')!.p;
  assert(ornament.height > .17 && ornament.height < .27, '顶饰必须细高但不做仪仗长翎');
  assert(ornament.width > .035 && ornament.width < .061, '不能恢复宽冠/毛团，也不能细成不可读的线');
  assert(ornament.depth > .026 && ornament.depth < .065, '保持真实体积，不能恢复肥厚后拖');
  assert(ornament.height / ornament.width > 3.7 && ornament.height / ornament.width < 6, '竖饰高宽比必须收束');
  assert(next.max[1] - base.max[1] > .11 && next.max[1] - base.max[1] < .24, '与普通盔须有明确竖向差异');
  assert(Math.abs(ornament.max[0] + ornament.min[0] - shell.max[0] - shell.min[0]) < 1e-8, '顶饰不能横向偏心');
  assert(Math.abs(tip[0] - (root.min[0] + root.max[0]) / 2) < 1e-8, '尖端必须位于盔顶中线');
  assert(Math.abs(tip[2] - (root.min[2] + root.max[2]) / 2) < .03, '只允许克制后倾，不能形成拖尾');
  assert(tip[1] > upper.max[1] && upper.min[1] > body.max[1], '顶饰必须向上收尖');
  assert(upper.width < body.width * .65 && upper.depth < body.depth * .7, '上端不能恢复平台或宽头');
  assert(shell.max[1] - root.min[1] > .004 && shell.max[1] - root.min[1] < .014, '底座需嵌入盔顶，不能悬空或沉入盔壳');
  assert(root.min[0] > summit.min[0] && root.max[0] < summit.max[0] && root.min[2] > summit.min[2] && root.max[2] < summit.max[2], '小底座须落在原盔顶截面内');
  // 原安全帽壳/护颈的坐标、权重、拓扑、面色全部相同，而不只比较头盔外的衣裤。
  const immutable = (c: Cage) => {
    const accept = (id: string) => id.startsWith(prefix + 'Shell.') || id.startsWith(prefix + 'Neck.');
    return {
      vertices: c.vertices.filter(v => accept(v.id)),
      faces: c.faces.filter(f => f.v.every(i => accept(c.vertices[i].id))).map(f => ({ ...f, v: f.v.map(i => c.vertices[i].id) })),
    };
  };
  assert.deepEqual(immutable(captain), immutable(ordinary));
  return { style, ordinaryHeight: base.max[1], captainHeight: next.max[1], ornamentHeight: ornament.height, ornamentWidth: ornament.width, ornamentDepth: ornament.depth, heightWidthRatio: ornament.height / ornament.width };
}
''' + s[end:]
start=s.index('  // 将新外廓压回原形')
end=s.index('\n}\nfor (let seed',start)
s=s[:start]+'''  // 每个坏样本都变形真实装配结果；拦截旧的宽矮轮廓、过细、拖尾、偏心、悬空与宽头。
  const crest = ornamentPrefix(style.id), rootY = bounds(b.surface, crest + 'Base.').min[1];
  const badShapes: readonly [string, (c: Cage) => void][] = [
    ['旧宽冠', c => { for (const v of c.vertices) if (v.id.startsWith(crest)) v.p[0] *= 4; }],
    ['矮短饰', c => { for (const v of c.vertices) if (v.id.startsWith(crest)) v.p[1] = rootY + (v.p[1] - rootY) * .35; }],
    ['不可读细线', c => { for (const v of c.vertices) if (v.id.startsWith(crest)) v.p[0] *= .1; }],
    ['肥厚拖尾', c => { for (const v of c.vertices) if (v.id.startsWith(crest)) v.p[2] -= (v.p[1] - rootY) * .7; }],
    ['尖端偏心', c => { c.vertices.find(v => v.id === crest + 'Tip')!.p[0] += .015; }],
    ['悬空底座', c => { for (const v of c.vertices) if (v.id.startsWith(crest)) v.p[1] += .03; }],
    ['宽头平台', c => { for (const v of c.vertices) if (v.id.startsWith(crest + 'Upper.')) v.p[0] *= 2.5; }],
    ['移植普通盔壳', c => { c.vertices.find(v => v.id.startsWith(style.prefix + 'Shell.Base.'))!.p[1] -= .001; }],
  ];
  for (const [name, mutate] of badShapes) {
    const bad = structuredClone(b.surface); mutate(bad);
    assert.throws(() => assertSilhouette(style.id, a.surface, bad), name + ' 必须被拒绝'); negativeCases++;
  }''' + s[end:]
s=s.replace('actual assembled silhouette', 'actual slender assembled silhouette, centered embedded root')
p.write_text(s)

def patch(path,old,new):
    p=root/path
    t=p.read_text()
    assert t.count(old)==1,(path,old,t.count(old))
    p.write_text(t.replace(old,new))
patch('scripts/check-soldier-assets.ts','const captainBudgets={palace:126,frontier:126,city:164};','const captainBudgets={palace:142,frontier:142,city:166};')
patch('scripts/check-lightwear.ts','palace_captain_helmet:126,frontier_captain_helmet:126,city_captain_helmet:164','palace_captain_helmet:142,frontier_captain_helmet:142,city_captain_helmet:166')
for old,new in [('宫卫队长宽缨盔','宫卫队长高束缨盔'),('边军队长短缨盔','边军队长束缨尖盔'),('城军队长横冠盔','城军队长窄竖冠盔')]:
    patch('src/character/wardrobe/catalog.ts',old,new)
patch('README.md','宫卫宽短缨、边军后掠短缨、城市低横冠沿用原盔壳','队长盔已按用户返工要求改为细高竖饰：宫卫高束缨、边军束缨盔尖、城市窄竖冠；弃用宽短缨、肥厚后拖和低横冠，沿用原盔壳')
patch('AGENTS.md','## S4：军人两态身份边界\n','## S4：军人两态身份边界\n\n用户已否定首版三顶队长盔的宽短缨、肥厚拖尾与低横冠，要求细高、居中、收尖的竖向识别件。当前 v2 只重做队长顶饰；普通盔和衣甲不动，不以旧的“足够宽”断言恢复已否定造型。身份、独立混搭和原结构/动作/穿插门槛保持，当前作者规则集中在《普通士兵与队长》。\n')
patch('Documentation/工作交接.md','## S4：普通士兵／队长，只换头盔\n','## S4：普通士兵／队长，只换头盔\n\n首版功能已通过 PR #63 合入，但用户随后否定宽矮顶饰的美术。本轮 v2 保留三顶头盔 ID、试衣身份和混搭逻辑，仅把顶饰改为宫卫高束缨、边军束缨盔尖、城市窄竖冠；不要恢复旧宽冠和拖尾。队长盔面数更新为 142／142／166，原普通盔与非头盔资产保持。数字检查、实际看图和用户美术认可依然分开，具体见《普通士兵与队长》。\n')
patch('Documentation/军人与甲胄工作流.md','设计服务于模拟经营高空视角、大量单位的低成本识别和资产数量控制。既要有顶部投影差异，也要检查正侧背与常用动作；不能只改颜色或增加正面小徽章。普通头盔、衣甲和原动作保持，详细作者职责及入口见《普通士兵与队长》。','设计服务于模拟经营高空视角、大量单位的低成本识别和资产数量控制。用户已否定首版宽短缨、肥厚后拖与低横冠，当前队长只采用细高、居中、收尖的竖饰。识别通过实际经营俯视与正侧背检查，不再以横向面积越大越好代替美术判断；不能只改颜色或增加正面小徽章。普通头盔、衣甲和原动作保持，详细作者职责及入口见《普通士兵与队长》。')
patch('Documentation/普通士兵与队长.md','模拟经营经营俯视','模拟经营俯视')
patch('Documentation/普通士兵与队长.md','`captain-equipment.ts` 只拥有三顶队长盔。宫卫调用原盔工厂后拓宽短缨，不修改原宫卫资产；边军在原护颈盔上增加暗赤后掠短缨，城市在原低檐盔上增加低横冠。原三种盔壳、帽底、护颈、衣甲、军裤、甲裙、鞋与枪的作者文件不改。顶饰是闭合不透明几何，全部 Head 刚性权重，不增骨、透明片、布料、碰撞求解或第二 Renderer。','`captain-equipment.ts` 只拥有三顶队长盔，当前作者版本为 v2。用户已否定 v1 的宽短缨、肥厚后拖与低横冠；不把旧版数值通过当成美术认可，也不保留旧款候选开关。\n\n宫卫在普通盔的临时副本中移除原短缨闭合组件，换为小铜座与细长收尖束缨；边军为紧束暗赤短缨托起细高盔尖；城市为朴素窄竖冠叶。三者居中、上端收尖，只轻微后倾，不扩大横向轮廓。顶饰宽约 4–5 厘米、高约 19–25 厘米，服从当前固定男女的原映射，不给运行时增加可调体型参数。细长顶饰在极远缩放或正上方视角可能变弱，必须用原经营俯视实际看图，不承诺所有镜头都一眼识别。\n\n原三种盔壳、帽底、护颈、衣甲、军裤、甲裙、鞋与枪的作者文件不改。顶饰仍为带小底座的闭合不透明实体，全部 Head 刚性权重，不增骨、透明片、布料、碰撞求解或第二 Renderer。仅复用本文件内小型截面操作，不建立新饰品系统。')
patch('Documentation/普通士兵与队长.md','| 126／126 |','| 126／142 |')
patch('Documentation/普通士兵与队长.md','| 112／126 |','| 112／142 |')
patch('Documentation/普通士兵与队长.md','| 144／164 |','| 144／166 |')
patch('Documentation/普通士兵与队长.md','实际顶饰坐标及顶部投影差异','实际顶饰高宽比、上下收尖、中线对齐、底座嵌入及与普通盔的高度差')
patch('Documentation/普通士兵与队长.md','原资产矩阵扩展为六套外观','新增反例拒绝宽冠、矮短饰、不可读细线、拖尾、偏心、悬空和宽头；对普通盔壳/护颈同时比较顶点、权重、拓扑与面色。旧“宫卫必须拓宽 2.5 倍、城市必须横展”的造型条件由用户明确撤销，闭合、骨骼、帽壳发式与动作穿插检查不变。原资产矩阵扩展为六套外观')
print('Applied locally-tested slender helmets and scoped documentation updates')
