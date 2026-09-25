import assert from 'node:assert/strict';
import { B, type Cage } from '../src/character/v3/types';
import { triCount } from '../src/character/v3/cage';
import { type GarmentPiece } from '../src/character/wardrobe/assets/contract';
import { assertGarmentPiece } from './check-garment-assets';

/** 验证城市军裤是同一闭合裤壳，不是居民裤换色、裙壳或两块腿板。 */
export function assertCityTrousers(piece:GarmentPiece):void {
  assert.equal(piece.id,'city_guard_trousers');assertGarmentPiece(piece);
  const c=piece.mesh;assert.equal(triCount(c),260);assert.equal(c.vertices.length,132);
  assert(c.vertices.every(v=>v.id.startsWith('CityPants.')));
  assert.deepEqual(piece.covers,['pelvis','thigh','shin']);
  assert.deepEqual(Object.keys(piece.sealedInterfaces??{}).sort(),['LeftCuff','RightCuff','waist']);
  const adjacent=c.vertices.map(()=>new Set<number>());
  for(const f of c.faces)for(let k=0;k<f.v.length;k++){const a=f.v[k],b=f.v[(k+1)%f.v.length];adjacent[a].add(b);adjacent[b].add(a);}
  const seen=new Set<number>(),stack=[0];while(stack.length){const i=stack.pop()!;if(seen.has(i))continue;seen.add(i);stack.push(...adjacent[i]);}
  assert.equal(seen.size,c.vertices.length,'军裤必须是一个连通闭合壳');
  for(const label of ['Waist','BeltLow']){
    const loop=c.vertices.filter(v=>v.id.startsWith(`CityPants.${label}.`));assert.equal(loop.length,10);
    for(const v of loop){assert.equal(v.p[1],label==='Waist'?1.075:1.028);assert.deepEqual(v.w,[B.Hips,B.Spine,.35]);}
  }
  for(const side of ['Right','Left']){
    const thigh=side==='Right'?B.RightThigh:B.LeftThigh;
    const root=c.vertices.filter(v=>v.id.startsWith(`CityPants.${side}.Root.`));assert.equal(root.length,8);
    for(const v of root){const i=Number(v.id.split('.').at(-1));assert.equal(v.p[1],i===6?.855:[5,7].includes(i)?.882:.94);assert.deepEqual(v.w,[B.Hips,thigh,i===6?.35:[5,7].includes(i)?.5:.55]);}
    const calf=c.vertices.filter(v=>v.id.startsWith(`CityPants.${side}.Calf.`));assert.equal(calf.length,8);
    assert(Math.max(...calf.map(v=>v.p[0]))-Math.min(...calf.map(v=>v.p[0]))<.125,'城市军裤小腿应收窄，不恢复宽裙片');
  }
}

function bounds(c:Cage,prefix:string){
  const v=c.vertices.filter(v=>v.id.startsWith(prefix));assert(v.length>0,'缺少轮廓采样 '+prefix);
  const low=[0,1,2].map(a=>Math.min(...v.map(x=>x.p[a]))),high=[0,1,2].map(a=>Math.max(...v.map(x=>x.p[a])));
  return {low,high,width:high[0]-low[0],depth:high[2]-low[2]};
}
/** 只读实际装配坐标，不读取配色、作者参数、文案或资产名称当作视觉差异证据。 */
export function assertCitySilhouette(palace:Cage,frontier:Cage,city:Cage){
  const pShoulder=bounds(palace,'Top.Shoulder.'),fShoulder=bounds(frontier,'Top.Shoulder.'),cShoulder=bounds(city,'Top.Shoulder.');
  const fChest=bounds(frontier,'Top.Chest.'),cChest=bounds(city,'Top.Chest.');
  const pHelmet=bounds(palace,'PalaceHelmet.'),fHelmet=bounds(frontier,'FrontierHelmet.'),cHelmet=bounds(city,'CityHelmet.');
  const cBrim=bounds(city,'CityHelmet.Shell.BrimHigh.'),cDome=bounds(city,'CityHelmet.Shell.Dome.');
  const pHem=bounds(palace,'Top.Hem.'),fHem=bounds(frontier,'Top.Hem.'),cHem=bounds(city,'Top.Hem.');
  const belt=bounds(city,'Top.Belt.'),beltTop=bounds(city,'Top.BeltTop.');
  assert(cShoulder.width<Math.min(pShoulder.width,fShoulder.width)*.97,'城市必须比宫卫、边军都窄肩');
  assert(cChest.depth<fChest.depth*.9,'城市浅胸不能复制边军厚胸');
  assert(cHelmet.high[1]<Math.min(pHelmet.high[1],fHelmet.high[1])-.012,'城市盔顶必须保持低矮，无高缨');
  assert(cHelmet.low[1]>fHelmet.low[1]+.07,'城市不能恢复边军长护颈');
  assert(cBrim.width>cDome.width*1.35,'城市短檐必须有真实横向轮廓');
  assert(cHem.low[1]>Math.max(pHem.low[1],fHem.low[1])+.015,'城市上甲必须在腰部更短');
  assert(beltTop.low[1]-belt.high[1]>.025,'城市宽腰带不能退化成一条细线');
  assert(belt.width>cHem.width*1.04,'城市腰带需要真实外扩截面');
  assert(city.vertices.some(v=>v.id.startsWith('CityPants.Right.Root.'))&&city.vertices.some(v=>v.id.startsWith('CityPants.Left.Root.')));
  assert(!city.vertices.some(v=>/^(MediumArmorSkirt|Skirt)\./.test(v.id)),'城市整套不能暗中退回甲裙');
  return {shoulderWidths:[pShoulder.width,fShoulder.width,cShoulder.width],chestDepths:[fChest.depth,cChest.depth],helmetTops:[pHelmet.high[1],fHelmet.high[1],cHelmet.high[1]],cityBrimWidth:cBrim.width,cityBeltHeight:beltTop.low[1]-belt.high[1],cityTopHem:cHem.low[1]};
}
