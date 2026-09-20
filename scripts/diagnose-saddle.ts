// 临时诊断入口：旧脚本中只替换“6点等长桥”的调用，不改生产文件或测试阈值。
// import之后原脚本仍执行同一FBX源键/中点检查；此文件仅用于本轮未接线的8→6皮肤拓扑验证。
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
const source=readFileSync(new URL('./diagnose-knee-field.ts',import.meta.url),'utf8');
const test=source
 .replace("import { makeSkinPelvis }", "import { makeSkinPelvis, connectSkinThigh }")
 .replace("bridge(c,root,c.anchors[side+'Thigh'],'thigh');", "connectSkinThigh(c,root,c.anchors[side+'Thigh']);")
 .replaceAll('saddle6','saddle8');
if(test===source||test.includes("bridge(c,root,c.anchors[side+'Thigh'],'thigh');"))throw new Error('诊断入口替换失败');
const file=new URL('./.diagnose-saddle.generated.ts',import.meta.url);
try{writeFileSync(file,test);await import(file.href);}finally{unlinkSync(file);}
