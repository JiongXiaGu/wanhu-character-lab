from pathlib import Path
import json, math
from PIL import Image, ImageOps, ImageDraw
root=Path('review-modular')
before=json.loads((root/'before/report.json').read_text())
after=json.loads((root/'after/report.json').read_text())
assert before['passed'] and after['passed']
left={r['file']:r for r in before['records']}
pairs=[]
for r in after['records']:
    if r['kind']!='comparison':continue
    b=left[r['file']]
    assert r['phase']==b['phase'] and r['viewport']==b['viewport'], r['file']
    for k in ['position','target','projection']:
        assert max(abs(a-c) for a,c in zip(r['camera'][k],b['camera'][k]))<1e-9,(r['file'],k)
    pairs.append(r)
def panel(files,path,cols=2):
    w,h=600,650
    out=Image.new('RGB',(cols*w,math.ceil(len(files)/cols)*h),(35,49,55));d=ImageDraw.Draw(out)
    for i,(p,label) in enumerate(files):
        im=Image.open(p).convert('RGBA');bg=Image.new('RGBA',im.size,(35,49,55,255));bg.alpha_composite(im)
        im=ImageOps.contain(bg.convert('RGB'),(w-12,h-38))
        x=i%cols*w+(w-im.width)//2;y=i//cols*h+32
        out.paste(im,(x,y));d.text((i%cols*w+8,i//cols*h+8),label,fill='white')
    out.save(path,quality=92)
for clip in ['bind','pilot-switches','snatch']:
    selected=[r for r in pairs if r['clip']==clip and r['fit']=='short' and r['view']=='side']
    files=[]
    for r in selected:
        for stage,sha in [('before',before['sourceSha']),('after',after['sourceSha'])]:files.append((root/stage/r['file'],f'{stage} {sha[:8]} | {r["bodyType"]} {clip} side {r["phase"]}'))
    panel(files,root/f'comparison-{clip}.jpg')
for body in ['male','female']:
    files=[(root/'after'/r['file'],r['file']) for r in after['records'] if r['kind']=='hip' and r['bodyType']==body]
    panel(files,root/f'hip-{body}.jpg',3)
(root/'camera-comparison.json').write_text(json.dumps({'passed':True,'pairs':len(pairs),'before':before['sourceSha'],'after':after['sourceSha'],'cameraTolerance':1e-9,'manualVisualApproval':False},indent=2))
