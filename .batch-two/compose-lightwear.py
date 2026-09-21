from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, os, math

root=Path('review-wardrobe-batch')
stage=os.environ.get('REVIEW_STAGE','after')
source=root/f'lightwear-{stage}'
report=json.loads((source/'report.json').read_text())
rows=report['records']
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
outputs=[]
newtops=['work_vest','short_work_jacket']; newbottoms=['short_trousers','short_skirt']
def choose(**kwargs):return [r for r in rows if all(r.get(k)==v for k,v in kwargs.items())]
def sheet(name,title,records,columns=4,width=390,height=430):
    if not records:return
    out=Image.new('RGB',(columns*width,52+math.ceil(len(records)/columns)*height),'#eff0e9')
    d=ImageDraw.Draw(out);d.text((14,9),title,fill='#243734',font=font)
    d.text((14,31),'GitHub Actions / real browser PNGs / '+report['sourceSha'][:12],fill='#455954',font=small)
    for k,item in enumerate(records):
        src=Path(item.get('_source',source))/item['file']; im=Image.open(src).convert('RGB')
        im.thumbnail((width-8,height-62))
        x=(k%columns)*width;y=52+(k//columns)*height
        out.paste(im,(x+(width-im.width)//2,y))
        label=item.get('_label') or f"{item.get('headwear') or item['top']} / {item.get('hairStyle') or item['bottom']}"
        d.text((x+6,y+height-54),label,fill='#243734',font=small)
        d.text((x+6,y+height-35),f"{item['bodyType']} / {item['view']} / {item['clip']} / {item['phase']}",fill='#455954',font=small)
    dest=root/f'lightwear-{name}.jpg';out.save(dest,quality=90);outputs.append({'file':dest.name,'sourceFiles':[str(Path(r.get('_source',source))/r['file']) for r in records]})

for body in ['male','female']:
    for view in ['front','side','back','free']:
        sheet(f'{body}-{view}',f'LIGHTWEAR | {body} | {view}',[r for r in choose(kind='static',bodyType=body,view=view) if r['top'] in newtops and r['bottom'] in newbottoms])
    sheet(f'{body}-mixed','NEW + FIRST BATCH | '+body,[r for r in choose(kind='static',bodyType=body,view='free') if not(r['top'] in newtops and r['bottom'] in newbottoms)])
    for view in ['front','side','back']:
        sheet(f'hats-{body}-{view}',f'HEADWEAR | {body} | {view}',choose(kind='hat',bodyType=body,view=view),3,440,365)
    for clip in ['pilot-switches','snatch','jogging','shooting-arrow','start-walking']:
        sheet(f'{body}-{clip}',f'LIGHTWEAR / {body} / {clip}',choose(kind='motion',bodyType=body,clip=clip))
    for clip in ['pilot-switches','snatch']:
        sheet(f'{body}-{clip}-sequence',f'PHASE SEQUENCE / {body} / {clip}',choose(kind='sequence',bodyType=body,clip=clip))
    sheet(f'{body}-dyes',f'THREE DYE REGIONS | {body}',choose(kind='dye',bodyType=body))
sheet('upper-details','SLEEVELESS ARMHOLE + SHORT SLEEVE',choose(kind='detail'),4,410,460)
compare=[r for r in rows if r['kind']=='static' and r['top']=='work_vest' and r['bottom'] in newbottoms and r['view'] in ['front','side']]
sheet('shorts-and-skirt','KNEE SHORTS vs A-LINE SPLIT WRAP',compare)

before=root/'lightwear-before'/'report.json'
paired=0
if before.exists():
    old=json.loads(before.read_text())
    key=lambda r:(r['bodyType'],r.get('headwear'),r.get('hairStyle'),r['view'])
    oldmap={key(r):r for r in old['records'] if r['kind']=='hat'}
    pairs=[]
    for r in choose(kind='hat'):
        prev=oldmap[key(r)]
        assert prev['camera']==r['camera'],f'Changed camera in headwear comparison: {key(r)}'
        paired+=1
        if r['headwear']=='guard_helmet' and r['hairStyle']=='topknot':
            pairs.extend([{**prev,'_source':str(before.parent),'_label':'BEFORE / light helmet'},{**r,'_label':'AFTER / light helmet'}])
    sheet('helmet-before-after','SAME CAMERA / HELMET CLEARANCE',pairs,4,410,390)
(root/'lightwear-contact-sheets.json').write_text(json.dumps({'sourceSha':report['sourceSha'],'captureEnvironment':report['captureEnvironment'],'outputs':outputs,'hatCameraPairs':paired,'manuallyReviewed':False},ensure_ascii=False,indent=2)+'\n')
print('LIGHTWEAR_CONTACT_SHEETS',len(outputs),'HAT_CAMERA_PAIRS',paired)
