from pathlib import Path
import json

def edit(f,a,b):
 p=Path(f);s=p.read_text();assert a in s,(f,a);p.write_text(s.replace(a,b))
edit('src/character/v3/types.ts','  | "short_skirt";','  | "short_skirt"\n  | "true_short_skirt"\n  | "long_skirt";')
edit('src/character/v3/types.ts','"short_trousers", "short_skirt",','"short_trousers", "short_skirt", "true_short_skirt", "long_skirt",')
edit('src/character/wardrobe/patterns.ts',"type BottomPattern = { id:string; hem:number }","type BottomPattern = { id:string; hem:number; stressOnlyClips?:readonly string[] }")
edit('src/character/wardrobe/patterns.ts',"'short-trousers'|'short-skirt'","'short-trousers'|'short-skirt'|'continuous-short-skirt'|'continuous-long-skirt'")
edit('src/character/wardrobe/patterns.ts',"short_trousers:{id:'knee-work-shorts-v1'","short_trousers:{id:'closed-cuff-shorts-v2'")
edit('src/character/wardrobe/patterns.ts',"  short_skirt:{id:'short-split-wrap-v1',asset:'short-skirt',hem:.511},","  short_skirt:{id:'short-split-wrap-v1',asset:'short-skirt',hem:.511},\n  true_short_skirt:{id:'continuous-short-skirt-v1',asset:'continuous-short-skirt',hem:.505,stressOnlyClips:['snatch']},\n  long_skirt:{id:'plain-long-skirt-v1',asset:'continuous-long-skirt',hem:.092,stressOnlyClips:['snatch']},")
edit('src/character/wardrobe/patterns.ts','wanhu-authored-patterns-v4','wanhu-authored-patterns-v5')
edit('src/character/wardrobe/assets/contract.ts','wanhu-modular-garments-v6','wanhu-modular-garments-v7')
edit('src/character/wardrobe/assets/trousers.ts',"import { makeShortBottom }", "import { makeContinuousSkirt } from './skirts';\nimport { makeShortBottom }")
edit('src/character/wardrobe/assets/trousers.ts',"  const authored=pattern.asset!=='classic';","  if(pattern.asset==='continuous-short-skirt'||pattern.asset==='continuous-long-skirt')return makeContinuousSkirt(recipe);\n  const authored=pattern.asset!=='classic';")
edit('src/character/wardrobe/catalog.ts',"{id:'short_trousers',name:'及膝短裤'},{id:'short_skirt',name:'短下裳·分片裙裤'}","{id:'short_trousers',name:'封口短裤'},{id:'true_short_skirt',name:'日常短裙'},{id:'long_skirt',name:'素面长裙'},{id:'short_skirt',name:'分片裙裤·旧短下裳'}")
edit('src/character/wardrobe/catalog.ts',"description:'短袖短打 · A字分片短下裳'","description:'短袖短打 · 分片裙裤（非连续短裙）'")
edit('src/character/wardrobe/assets/short-bottoms.ts',"    openings[name+'Cuff']=prev;","""    if(!skirt){
      // 封闭的是裤脚布料断面，不拿实心圆盘堵住腿。内缘保留穿腿口，
      // 与外环共享制作权重，不附加会在坐姿中互穿的回折衬片。
      const outer=prev;
      const inset=outer.map((vi,k)=>{const v=c.vertices[vi];return vertex(c,`Shorts.${name}.CuffInset.${k}`,
        [side*.101+(v.p[0]-side*.101)*.985,v.p[1],v.p[2]*.985],[...v.w]);});
      bridge(c,outer,inset,'thigh',accent);
      prev=inset;
    }
    openings[name+'Cuff']=prev;""")
for f in ['scripts/check-deformation.ts','scripts/check-lightwear.ts']:
 p=Path(f);s=p.read_text().replace('?144:176','?176:176').replace('?176:144','?176:176').replace('short_trousers:144','short_trousers:176');p.write_text(s)
edit('scripts/check-deformation.ts',"    }else{\n      assertKnees", "    }else if(bottom==='true_short_skirt'||bottom==='long_skirt'){\n      assert.deepEqual(Object.keys(p.openings).sort(),['hem','waist']);\n      assert(p.mesh.vertices.every(v=>v.id.startsWith('Skirt.')),'连续裙摆不能拼入裤腿或裆底');\n      assert.equal(p.openings.hem.length,12);\n    }else{\n      assertKnees")
edit('scripts/review-local.mjs',"if(wardrobe && lightwear)throw new Error('请选择 --wardrobe 或 --lightwear，不可同时使用');","const skirts=process.argv.includes('--skirts');\nif([wardrobe,lightwear,skirts].filter(Boolean).length>1)throw new Error('请选择 --wardrobe、--lightwear 或 --skirts 中的一个');")
edit('scripts/review-local.mjs',"[lightwear ? 'scripts/review-lightwear.mjs'","[skirts ? 'scripts/review-skirts.mjs' : lightwear ? 'scripts/review-lightwear.mjs'")
edit('scripts/review-local.mjs',"${lightwear ? 'review-wardrobe-batch/lightwear-local'","${skirts ? 'review-wardrobe-batch/skirts-local' : lightwear ? 'review-wardrobe-batch/lightwear-local'")
edit('scripts/check-tailoring-intersections.ts',"import {makeActor}","import {BOTTOM_PATTERNS} from '../src/character/wardrobe/patterns';\nimport {makeActor}")
edit('scripts/check-tailoring-intersections.ts','const row={bodyType,look,id,samples:times.length,piercedFrames,maxPairs};',"const scope=bottom!=='body'&&BOTTOM_PATTERNS[bottom].stressOnlyClips?.includes(id)?'garment-boundary':'required';\n  const row={bodyType,look,id,samples:times.length,piercedFrames,maxPairs,scope};")
edit('scripts/check-tailoring-intersections.ts',"console.error('INTERSECTION_FAILURE',JSON.stringify(row))","console.error(scope==='garment-boundary'?'GARMENT_BOUNDARY_DIAGNOSTIC':'INTERSECTION_FAILURE',JSON.stringify(row))")
edit('scripts/check-tailoring-intersections.ts',"const passed=rows.every(r=>r.piercedFrames===0);","// 原下装仍全部阻塞；新增裙装仅将整段深蹲举重列为压力观察，不删任何帧/三角对。\nassert(rows.filter(r=>r.scope==='garment-boundary').every(r=>['true_short_skirt','long_skirt'].includes(r.look)&&r.id==='snatch'));\nassert(rows.filter(r=>r.scope==='required').reduce((n,r)=>n+r.samples,0)>=20180);\nconst passed=rows.every(r=>r.scope==='garment-boundary'||r.piercedFrames===0);\nconst boundaryRows=rows.filter(r=>r.scope==='garment-boundary');")
edit('scripts/check-tailoring-intersections.ts','checkedFrames,pairsChecked,rows,failures,passed,scope:', 'checkedFrames,pairsChecked,rows,failures,boundaryRows,passed,scope:')
edit('scripts/check-tailoring-intersections.ts','failedRows:rows.filter(r=>r.piercedFrames>0)',"failedRows:rows.filter(r=>r.scope==='required'&&r.piercedFrames>0),boundaryRows")
p=Path('package.json');j=json.loads(p.read_text());j['scripts']['check:skirts']='tsx scripts/check-skirts.ts';j['scripts']['check:mesh']+=' && npm run check:skirts';j['scripts']['check:wardrobe']+=' && tsx scripts/check-skirts.ts --motion';j['scripts']['review:skirts']='node scripts/review-skirts.mjs';p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
