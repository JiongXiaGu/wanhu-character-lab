from pathlib import Path
import subprocess,re,json
# 临时作者搜索只缩小资产范围，不改变数学判定/时间采样。选定后必须运行原完整脚本。
source=Path('scripts/check-tailoring-intersections.ts').read_text()
focused=Path('scripts/.s6-focused-intersections.ts')
focused.write_text(source.replace('for(const bottom of BOTTOM_IDS)',"for(const bottom of ['heavy_armor_skirt'] as const)").replace('2*BOTTOM_IDS.length*ids.length','2*1*ids.length'))
p=Path('src/character/wardrobe/assets/military/heavy-skirt.ts');original=p.read_text()
variants=[]
# 更平滑的腰髋过渡：优先调整驱动权重，而不削去远景体量。
for end in [.28,.36,.44,.52,.60,.68,.76]:
  for start in [.88,.78,.68,.58]:
    weights=[1,start,round(start*.70+end*.30,3),round(start*.45+end*.55,3),round(start*.23+end*.77,3),round(end+.01,3),end]
    variants.append(weights)
result=[];found=None
try:
  for weights in variants:
    text=re.sub(r'const HIP_WEIGHTS = \[.*?\] as const;',f'const HIP_WEIGHTS = {json.dumps(weights)} as const;',original)
    p.write_text(text)
    run=subprocess.run(['node_modules/.bin/tsx',str(focused)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    report=json.loads(Path('review-tailoring-v2/intersections.json').read_text())
    failed=[r for r in report['rows'] if r['blockingFrames']]
    score=sum(r['blockingFrames'] for r in failed)
    result.append({'weights':weights,'score':score,'rows':failed})
    print('S6_WEIGHT_TRIAL',json.dumps(result[-1]),flush=True)
    if run.returncode==0:
      found=weights
      test=Path('scripts/check-soldier-heavy.ts');t=test.read_text();assert '[1, .88, .64, .48, .36, .29, .28][n]' in t
      test.write_text(t.replace('[1, .88, .64, .48, .36, .29, .28][n]',json.dumps(weights)+'[n]'))
      break
finally:
  focused.unlink(missing_ok=True)
  if found is None:p.write_text(original)
  Path('s6-tuning.json').write_text(json.dumps({'selected':found,'trials':result},indent=2))
print('S6_WEIGHT_SELECTED',found,flush=True)
if found is None:raise RuntimeError('No safe skirt found; original retained, no geometry committed')
