from pathlib import Path
import subprocess,re,json
p=Path('src/character/wardrobe/assets/short-bottoms.ts'); original=p.read_text()
results=[]
for label,width,depth,weight in [('clearance-a','.075','.090','gradient'),('clearance-b','.080','.095','gradient'),('clearance-c','.085','.100','gradient'),('thigh-a','.075','.090','thigh'),('thigh-b','.080','.095','thigh'),('thigh-c','.085','.100','thigh')]:
    text=original.replace('[.075,.090]',f'[{width},{depth}]')
    if weight=='thigh':text=text.replace('c.vertices[vi].w=kneeWeights(c.vertices[vi].p,thigh,shin);','c.vertices[vi].w=[thigh,shin,1];')
    p.write_text(text)
    run=subprocess.run(['npm','run','check:intersections'],capture_output=True,text=True)
    summary=next((line[len('INTERSECTION_SUMMARY '):] for line in run.stdout.splitlines() if line.startswith('INTERSECTION_SUMMARY ')),None)
    data=json.loads(summary) if summary else {'error':run.stderr[-1500:]}
    result={'label':label,'width':width,'depth':depth,'weight':weight,'exitCode':run.returncode,'report':data};results.append(result)
    print('FIT_CANDIDATE',json.dumps(result,ensure_ascii=False),flush=True)
    if run.returncode==0:
        print('FIT_SUCCESS',label,flush=True)
        break
p.write_text(original)
Path('/tmp/fit-probe.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('PROBE_FINISHED: original candidate restored; no detector edits or result exemptions')
