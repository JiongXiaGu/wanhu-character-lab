"""Temporary task helper: publish only real screenshot evidence, never deploy a preview.
The separate review ref is not a runtime implementation or a merge source.
"""
import base64,json,os,urllib.request,urllib.error
from pathlib import Path
repo=os.environ['GITHUB_REPOSITORY'];token=os.environ['GH_TOKEN']
branch='review/deformation-evidence'
base='https://api.github.com/repos/'+repo

def api(path,data=None,method=None):
    req=urllib.request.Request(base+path,data=None if data is None else json.dumps(data).encode(),headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},method=method)
    with urllib.request.urlopen(req) as r:return json.load(r)
try:parent=api('/git/ref/heads/'+branch)['object']['sha']
except urllib.error.HTTPError as e:
    if e.code!=404:raise
    parent=None
root=Path('review-deformation');entries=[]
paths=list((root/'sheets').glob('*.jpg'))+[root/'camera-comparison.json',root/'contracts.json']
for path in paths:
    if not path.exists():continue
    blob=api('/git/blobs',{'content':base64.b64encode(path.read_bytes()).decode(),'encoding':'base64'})
    entries.append({'path':path.name,'mode':'100644','type':'blob','sha':blob['sha']})
metadata={'sourceSha':os.environ['SOURCE_SHA'],'baseline':'f432357f1cf2a5219acbae87e7e1b0e1cca9481d','runId':os.environ['GITHUB_RUN_ID'],'manualApproval':False,'purpose':'Actual Actions screenshots. No deployment. Runtime changes are on fix/lowpoly-deformation-cages.'}
entries.append({'path':'source.json','mode':'100644','type':'blob','content':json.dumps(metadata,indent=2)})
tree=api('/git/trees',{'tree':entries})
commit=api('/git/commits',{'message':'Actions deformation evidence for '+metadata['sourceSha'],'tree':tree['sha'],'parents':[] if parent is None else [parent]})
if parent is None:api('/git/refs',{'ref':'refs/heads/'+branch,'sha':commit['sha']})
else:api('/git/refs/heads/'+branch,{'sha':commit['sha'],'force':False},method='PATCH')
print('EVIDENCE_SHA',commit['sha'])
for entry in entries:
    if entry['path'].endswith('.jpg'):print('IMAGE https://raw.githubusercontent.com/'+repo+'/'+commit['sha']+'/'+entry['path'])
