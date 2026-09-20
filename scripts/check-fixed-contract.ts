import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createRecipe,BODY_TYPES,BODY_HEIGHT} from '../src/character/v3/types';
import {parseRecipeFile,applyLook,WARDROBE_LOOKS} from '../src/character/wardrobe/catalog';
import {TOP_PATTERNS,BOTTOM_PATTERNS} from '../src/character/wardrobe/patterns';

// 文件边界不调用任何旧版本迁移；每个拒绝案例必须确实抛错。
const sample=createRecipe();
const fields=['version','bodyType','slots','dyes','hairStyle','hairColor'].sort();
let valid=0,rejected=0;
for(const bodyType of BODY_TYPES)for(const look of WARDROBE_LOOKS){
 const r=applyLook(createRecipe({bodyType}),look.id);
 assert.deepEqual(Object.keys(r).sort(),fields);
 assert.deepEqual(parseRecipeFile(JSON.stringify(r)),r);valid++;
}
const reject=(value:unknown)=>{assert.throws(()=>parseRecipeFile(typeof value==='string'?value:JSON.stringify(value)));rejected++;};
for(const version of [null,0,1,2,3,4,6,'5'])reject({...sample,version});
for(const [key,value] of Object.entries({height:1.8,build:.5,palette:0,preset:'farmer',outfit:'guard',hat:false,equipment:true,lod:2,proportion:{}}))reject({...sample,[key]:value});
for(const key of fields){const value={...sample} as Record<string,unknown>;delete value[key];reject(value);}
for(const bad of [null,[],{},'not-json',JSON.stringify({...sample,slots:{...sample.slots,unknown:'none'}}),JSON.stringify({...sample,dyes:{...sample.dyes,extra:'#ffffff'}}),JSON.stringify({...sample,hairStyle:'auto'}),' '.repeat(32769)])reject(bad);
reject('{"__proto__":{"polluted":true},'+JSON.stringify(sample).slice(1));
assert.equal(({} as Record<string,unknown>).polluted,undefined);
for(const [id,pattern] of Object.entries({...TOP_PATTERNS,...BOTTOM_PATTERNS})){assert(pattern.id.length>0,id);assert(Number.isFinite(pattern.hem),id);}
assert.deepEqual(Object.keys(BODY_HEIGHT).sort(),['female','male']);
function files(path:string):string[]{return readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(path,e.name)):[join(path,e.name)]);}
for(const path of files('src')){
 const code=readFileSync(path,'utf8');
 assert(!/\b(?:recipe|input|options)\.(?:height|build|lod|palette)\b|WardrobeLod|cleanRecipe|defaultHeight/.test(code),path+': retired runtime contract remains');
}
const app=readFileSync('src/App.tsx','utf8');
assert(app.includes('wanhu.character.wardrobe.v5'));
assert(!app.includes('wanhu.character.wardrobe.v1'));
assert(!app.includes('data-testid="lod-'));
for(const old of ['height','build','outfit','hat','equipment','lod'])assert(!app.includes(`params.get('${old}')`));
console.log(JSON.stringify({passed:true,validRecipes:valid,rejectedInputs:rejected,profiles:2,precision:'standard',patterns:Object.keys(TOP_PATTERNS).length+Object.keys(BOTTOM_PATTERNS).length}));
