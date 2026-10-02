import type {Recipe,Vec3} from './types';
import {shapePoint} from './body';
import {cross,dot,mul,unit} from './cage';

/** 法线使用体型映射的局部逆转置；只在构造含作者法线的衣物时计算。 */
function shapeColumns(point:Vec3,recipe:Recipe):Vec3[]{
 const epsilon=1e-5;
 return [0,1,2].map(axis=>{
  const low=[...point] as Vec3,high=[...point] as Vec3;
  low[axis]-=epsilon;high[axis]+=epsilon;
  const a=shapePoint(low,recipe),b=shapePoint(high,recipe);
  return b.map((n,i)=>(n-a[i])/(2*epsilon)) as Vec3;
 });
}
export function canonicalAuthoredNormal(normal:Vec3,point:Vec3,recipe:Recipe):Vec3{
 const columns=shapeColumns(point,recipe);
 return unit(columns.map(column=>dot(column,normal)) as Vec3);
}
export function shapeAuthoredNormal(normal:Vec3,point:Vec3,recipe:Recipe):Vec3{
 const [a,b,c]=shapeColumns(point,recipe),cofactors=[cross(b,c),cross(c,a),cross(a,b)];
 const determinant=dot(a,cofactors[0]);
 if(Math.abs(determinant)<1e-8)throw new Error('体型映射无法变换作者法线');
 return unit(mul([0,1,2].map(axis=>cofactors.reduce((sum,column,i)=>sum+column[axis]*normal[i],0)) as Vec3,1/determinant));
}
