"""只裁切/排版真实浏览器 PNG；完整原图和相机/相位记录保留。"""
from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFont

root=Path('review-wardrobe-batch')
before=json.loads((root/'before/report.json').read_text())
after=json.loads((root/'after/report.json').read_text())
assert before['passed'] and after['passed']
font_path=next((p for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'] if Path(p).exists()),None)
font=ImageFont.truetype(font_path,17) if font_path else ImageFont.load_default()
small=ImageFont.truetype(font_path,13) if font_path else ImageFont.load_default()
source_label='GitHub Actions screenshots' if after['captureEnvironment']=='github-actions' else 'Local real browser screenshots'
label={'rough_tunic':'Work shirt','cross_jacket':'Cross-collar','layered_vest':'Half-sleeve','loose_trousers':'Straight','guard_pants':'Bound'}
def key(r):return tuple(r[k] for k in ['kind','bodyType','top','bottom','clip','view','phase'])
old={key(r):r for r in before['records']}
comparisons=0
for r in after['records']:
    if r['kind'] not in ('static','motion'):continue
    b=old[key(r)]
    assert r['camera']==b['camera'],f'Camera mismatch: {r["file"]}'
    assert r['viewport']==b['viewport']
    comparisons+=1
assert comparisons==168

def select(kind,**fields):
    return [r for r in after['records'] if r['kind']==kind and all(r.get(k)==v for k,v in fields.items())]

def sheet(name,title,items,columns=4,width=370,height=490):
    rows=math.ceil(len(items)/columns)
    out=Image.new('RGB',(columns*width,55+rows*(height+45)),(243,245,239))
    d=ImageDraw.Draw(out);d.text((12,8),title,font=font,fill=(28,44,36))
    d.text((12,31),source_label+' | fixed viewport crops | originals + metadata preserved',font=small,fill=(68,80,73))
    for i,(stage,r) in enumerate(items):
        im=Image.open(root/stage/r['file']).convert('RGB')
        # 固定裁切，不能挑选人物轮廓来掩盖穿插。详细图不裁切。
        ratio=1 if r['kind']=='detail' else .7 if r['view']=='free' else .60
        cw=int(im.width*ratio);left=(im.width-cw)//2;im=im.crop((left,0,left+cw,im.height))
        im.thumbnail((width-10,height))
        x=(i%columns)*width;y=55+(i//columns)*(height+45)
        out.paste(im,(x+(width-im.width)//2,y))
        caption=f'{stage} / {r["bodyType"]} / {label[r["top"]]} / {label[r["bottom"]]}'
        d.text((x+7,y+height+2),caption,font=small,fill=(30,40,34))
        d.text((x+7,y+height+20),f'{r["clip"]} / {r["view"]} / phase {r["phase"]:g}',font=small,fill=(60,70,64))
    out.save(root/name,quality=91)

for body in ('male','female'):
    for view in ('front','side','back','free'):
        sheet(f'{body}-{view}-overview.jpg',f'First batch / {body} / {view}', [('after',r) for r in select('static',bodyType=body,view=view)],6,300,470)
    comparison=[]
    for stage in ('before','after'):
        for r in select('static',bodyType=body,bottom='loose_trousers',view='front'):
            comparison.append((stage,old[key(r)] if stage=='before' else r))
    sheet(f'{body}-tops-before-after.jpg',f'Three tops / identical camera and bind phase / {body}',comparison,3,460,520)
    for clip in ('pilot-switches','snatch','jogging','shooting-arrow','start-walking'):
        frames=select('motion',bodyType=body,clip=clip,view='side')
        sheet(f'{body}-{clip}.jpg',f'{clip} / {body} / all six combinations', [('after',r) for r in frames],6,300,440)
        seq=select('sequence',bodyType=body,clip=clip)
        if seq:sheet(f'{body}-{clip}-sequence.jpg',f'{clip} / {body} / phases 0, .25, .5, .75, 1',[('after',r) for r in seq],5,310,420)
    sheet(f'{body}-dyes.jpg',f'Three dye channels / {body} / front',[('after',r) for r in select('dye',bodyType=body,view='front')],6,300,470)
    sheet(f'{body}-snatch-back.jpg',f'Snatch / {body} / back stress view',[('after',r) for r in select('back-stress',bodyType=body)],6,300,440)

for top,name in [('layered_vest','half-sleeve-detail'),('cross_jacket','collar-detail'),('rough_tunic','work-shirt-detail')]:
    sheet(name+'.jpg',label[top]+' / front and three-quarter detail',[('after',r) for r in select('detail',top=top)],2,700,650)
items=[]
for stage in ('before','after'):
    for r in select('static',top='rough_tunic',view='front'):
        items.append((stage,old[key(r)] if stage=='before' else r))
sheet('pants-before-after.jpg','Two pants / before and after / same camera',items,4,380,490)
(root/'comparison.json').write_text(json.dumps({'passed':True,'source':'actual-browser','matchingCameraAndPhasePairs':comparisons,'beforeSha':before['sourceSha'],'afterSha':after['sourceSha'],'manualApproval':False},indent=2))
print('PASS exact camera/viewport/phase comparison:',comparisons)
