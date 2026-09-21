/** 只对新裙装固定封底声明制作接口；此文件不参与运行时或三角相交算法。 */
export interface ContactTriangle { ids:readonly string[]; part?:string; region:string }
export function isClosedHemContact(bottom:string,a:ContactTriangle,b:ContactTriangle):boolean {
  if(bottom!=='true_short_skirt'&&bottom!=='long_skirt')return false;
  const cap=(t:ContactTriangle)=>t.part==='bottom'&&t.ids.includes('Skirt.HemCenter')&&t.ids.every(id=>id==='Skirt.HemCenter'||/^Skirt\.HemInset\.\d+$/.test(id));
  const terminal=(t:ContactTriangle)=>t.part==='bottom'&&t.ids.every(id=>/^Skirt\.(Hem|HemInset|HemFacing)\.\d+$/.test(id));
  const leg=(t:ContactTriangle)=>t.part==='skin'&&t.region==='shin';
  // 封底的邻接裙边/腿出口可能数学相交；仍逐对计算和记录。
  // 不豁免任何旧款、非端面、腰臀、大腿、裙身、Calf 或上衣。
  return cap(a)&&(terminal(b)||leg(b))||cap(b)&&(terminal(a)||leg(a));
}
