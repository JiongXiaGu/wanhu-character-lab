import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const path=process.argv[2]+'/src/scene/CharacterViewport.tsx';
let code=readFileSync(path,'utf8');
// 仅给基线增加只读相机观察接口，绝不修改几何、绑定、动画、灯光或相机行为。
if(!code.includes('cameraState:()=>')){
  const marker="geometryId:()=>rt?.actor.mesh.geometry.uuid??'',";
  assert(code.includes(marker),'基线相机插桩位置改变，应人工检查');
  code=code.replace('geometryId:()=>string','cameraState:()=>unknown; geometryId:()=>string');
  code=code.replace(marker,"cameraState:()=>rt?{position:rt.camera.position.toArray(),target:rt.controls.target.toArray(),projection:rt.camera.projectionMatrix.toArray()}:null,"+marker);
  writeFileSync(path,code);
}
