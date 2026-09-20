from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
import json,math
root=Path('review-tailoring-v2')
meta=json.loads((root/'visual.json').read_text())
def sheet(files,name,cols=3):
    width,height=480,500
    out=Image.new('RGB',(cols*width,math.ceil(len(files)/cols)*height),(31,44,49));d=ImageDraw.Draw(out)
    for i,f in enumerate(files):
        im=Image.open(root/f).convert('RGBA');bg=Image.new('RGBA',im.size,(42,57,63,255));bg.alpha_composite(im);im=ImageOps.contain(bg.convert('RGB'),(width-12,height-45))
        x=(i%cols)*width+(width-im.width)//2;y=(i//cols)*height+30;out.paste(im,(x,y));d.text(((i%cols)*width+8,(i//cols)*height+8),f[:65],fill='white')
    out.save(root/name)
files=[s['file'] for s in meta['shots']]
for lod in range(3):
    chosen=[f for f in files if f'-lod{lod}-pilot-front-0.5' in f]
    if chosen:sheet(chosen,f'seated-lod{lod}.jpg')
chosen=[f for f in files if '-lod0-pilot-side-0.5' in f]
if chosen:sheet(chosen,'seated-side.jpg')
for name in ['pilot-switches','shooting-arrow','jogging','snatch']:
    chosen=[f for f in files if name in f and ('sequence-' in f or 'library-' in f)]
    if chosen:sheet(chosen,'motion-'+name+'.jpg',4)
(root/'SUMMARY.md').write_text('# V2 actual review artifact\n\nTested SHA: '+str(meta.get('testedSha'))+'\n\n'+str(len(files))+' screenshots; '+str(len(meta['videos']))+' continuous videos.\n\nGenerated, not automatically visually approved.\n')

import subprocess
for video in meta["videos"]:
    stem=Path(video).stem
    frames=root/(stem+"-frames");frames.mkdir(exist_ok=True)
    subprocess.run(["ffmpeg","-nostdin","-y","-v","error","-threads","1","-filter_threads","1","-i",str(root/video),"-vf","fps=4,scale=960:-2","-threads","1",str(frames/"%04d.jpg")],check=True)
    paths=sorted(frames.glob("*.jpg"))
    for offset in range(0,len(paths),24):
        sheet([str(p.relative_to(root)) for p in paths[offset:offset+24]],stem+"-timeline-"+str(offset//24)+".jpg",4)
