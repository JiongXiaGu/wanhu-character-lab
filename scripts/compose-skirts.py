from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, os, math

root=Path('review-wardrobe-batch')
stage=os.environ.get('REVIEW_STAGE','after')
source=root/f'skirts-{stage}'
r=json.loads((source/'report.json').read_text())
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
outputs=[]

def sheet(name,records,cols=3):
    if not records:return
    w,h=430,350
    out=Image.new('RGB',(w*cols,48+h*math.ceil(len(records)/cols)),'#edf0ed')
    d=ImageDraw.Draw(out);d.text((12,8),f'{stage} / {name} / {r["sourceSha"][:12]}',fill='#243734',font=font)
    d.text((12,29),'Original browser PNGs; contact-sheet scaling only; no visual approval implied',fill='#455954',font=small)
    for i,row in enumerate(records):
        im=Image.open(Path(row.get('_source',source))/row['file']).convert('RGB');im.thumbnail((w-8,h-62))
        x=i%cols*w;y=48+i//cols*h;out.paste(im,(x+(w-im.width)//2,y))
        d.text((x+6,y+h-58),row.get('_label',row['bottom'])+' / '+row['view']+' / '+str(row['phase']),fill='#243734',font=small)
        d.text((x+6,y+h-39),row['top']+' / '+row['clip'],fill='#455954',font=small)
        d.text((x+6,y+h-20),row['scope'],fill='#455954',font=small)
    path=root/f'skirts-{stage}-{name}.jpg';out.save(path,quality=92)
    outputs.append({'file':path.name,'sourceFiles':[str(Path(x.get('_source',source))/x['file']) for x in records]})

def select(**kw):return [x for x in r['records'] if all(x.get(k)==v for k,v in kw.items())]
for body in ['male','female']:
    sheet(f'{body}-four-silhouettes',select(kind='silhouette',bodyType=body),4)
    for bottom in ['short_trousers','true_short_skirt','long_skirt','short_skirt','loose_trousers']:
        rows=select(kind='static',bodyType=body,bottom=bottom)
        if rows:sheet(f'{body}-{bottom}-all-mixes',rows,4)
    for clip in ['pilot-switches','jogging','start-walking','snatch','shooting-arrow']:
        rows=select(kind='motion',bodyType=body,clip=clip)
        # 原图全部留存；接触表选择同一代表相位，两侧各三种下装。
        phase=.25 if clip=='jogging' else (.05 if clip=='snatch' and r['quick'] else .5)
        sheet(f'{body}-{clip}',[x for x in rows if x['phase']==phase])
        stress=select(kind='stress',bodyType=body,clip=clip)
        sheet(f'{body}-{clip}-stress',stress)
    sheet(f'{body}-closed-hems',select(kind='detail',bodyType=body),4)
    sheet(f'{body}-dyes',select(kind='dye',bodyType=body))
camera_pairs=[]
before_path=root/'skirts-before'/'report.json'
if stage=='after' and before_path.exists():
    before=json.loads(before_path.read_text())
    assert before['passed'] and r['passed']
    def key(row):return tuple(row[k] for k in ['kind','bodyType','top','bottom','clip','view','phase'])
    # Snatch .05 is an added explicit stress frame in the full candidate, not a deleted sample.
    candidates={key(dict(x,kind='motion' if x['kind']=='stress' else x['kind'])):x for x in r['records']}
    pairs=[]
    for old in before['records']:
        if old['bottom']!='short_trousers':continue
        new=candidates[key(old)]
        assert old['camera']==new['camera'],('同相机对照发生偏移',old['file'])
        assert old['recipe']==new['recipe'],('前后配方不一致',old['file'])
        camera_pairs.append({'before':old['file'],'after':new['file']})
        pairs.append((old,new))
    assert len(pairs)==36
    for body in ['male','female']:
        selected=[]
        for old,new in pairs:
            if old['bodyType']==body and old['kind'] in ['static','detail']:
                selected.extend([dict(old,_source=str(root/'skirts-before'),_label='BEFORE / shorts'),dict(new,_label='AFTER / closed shorts')])
        sheet(f'{body}-shorts-before-after',selected,4)
(root/f'skirts-{stage}-contact-sheets.json').write_text(json.dumps({'sourceSha':r['sourceSha'],'outputs':outputs,'cameraPairs':camera_pairs,'manuallyReviewed':False},ensure_ascii=False,indent=2)+'\n')
print('SKIRT_CONTACT_SHEETS',len(outputs))
