"""Only crop/resize real Actions screenshots; do not modify character pixels."""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw
root=Path('review-deformation')
a=json.loads((root/'before/report.json').read_text())
b=json.loads((root/'after/report.json').read_text())
assert a['passed'] and b['passed']
old={r['file']:r for r in a['records']}
def compare(x,y):
    if isinstance(x,dict):
        assert x.keys()==y.keys()
        for k in x:compare(x[k],y[k])
    elif isinstance(x,list):
        assert len(x)==len(y)
        for p,q in zip(x,y):compare(p,q)
    elif isinstance(x,(float,int)):
        assert math.isfinite(x) and abs(x-y)<1e-9,(x,y)
    else:assert x==y
for r in b['records']:
    p=old[r['file']]
    compare(p['camera'],r['camera']);compare(p['viewport'],r['viewport']);assert p['phase']==r['phase']
(root/'camera-comparison.json').write_text(json.dumps({'passed':True,'pairs':len(old),'before':a['sourceSha'],'after':b['sourceSha'],'manualApproval':False},indent=2))
(root/'sheets').mkdir(exist_ok=True)

def sheet(name,cases):
    cells=[]
    for key in cases:
        for stage in ['before','after']:
            im=Image.open(root/stage/(key+'.png')).convert('RGB');w,h=im.size
            im=im.crop((round(w*.23),round(h*.08),round(w*.78),round(h*.90)))
            im.thumbnail((580,510))
            cell=Image.new('RGB',(600,540),'white');cell.paste(im,((600-im.width)//2,30))
            ImageDraw.Draw(cell).text((12,7),stage.upper()+'  '+key,fill='black')
            cells.append(cell)
    out=Image.new('RGB',(1200,540*len(cases)),'white')
    for i,cell in enumerate(cells):out.paste(cell,((i%2)*600,(i//2)*540))
    out.save(root/'sheets'/name,quality=92)
sheet('skin-seat.jpg',[f'{sex}-skin-pilot-switches-{view}-beauty-0.5' for sex in ['male','female'] for view in ['front','side']])
sheet('pants-knee.jpg',[f'{sex}-pants-pilot-switches-side-{mode}-0.5' for sex in ['male','female'] for mode in ['beauty','cage']])
sheet('squat.jpg',[f'{sex}-{fit}-snatch-back-beauty-0.05' for sex in ['male','female'] for fit in ['skin','pants']])
# Every sampled phase remains in the full artifact, rather than only selecting attractive frames.
for sex in ['male','female']:
    for fit in ['skin','pants']:
        sheet(f'{sex}-{fit}-sequence.jpg',[f'{sex}-{fit}-{clip}-side-unlit-{phase}' for clip in ['pilot-switches','snatch','jogging'] for phase in [0,0.25,0.5,0.75,1]])
print('PASS same-camera comparison:',len(old),'pairs; manual approval remains separate')
