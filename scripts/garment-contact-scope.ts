/** 只对明确批准的固定 Cap 声明制作接口；此文件不参与运行时或三角相交算法。 */
export interface ContactTriangle { ids:readonly string[]; part?:string; region:string }
export function isClosedHemContact(bottom:string,a:ContactTriangle,b:ContactTriangle):boolean {
  const leg=(t:ContactTriangle)=>t.part==='skin'&&t.region==='shin';
  if(bottom==='short_trousers'){
    const cap=(t:ContactTriangle)=>{
      if(t.part!=='bottom'||!t.ids.length||!t.ids.every(id=>/^Shorts\.(Right|Left)\.Cuff\.\d+$/.test(id)))return false;
      const sides=new Set(t.ids.map(id=>id.split('.')[1]));return sides.size===1;
    };
    // 封口短裤的裤脚 Cap 专门允许可见小腿穿过；不放行腰口、裤身或其他部位。
    return cap(a)&&leg(b)||cap(b)&&leg(a);
  }
  if(bottom!=='true_short_skirt'&&bottom!=='long_skirt')return false;
  const cap=(t:ContactTriangle)=>t.part==='bottom'&&t.ids.includes('Skirt.HemCenter')&&t.ids.every(id=>id==='Skirt.HemCenter'||/^Skirt\.HemInset\.\d+$/.test(id));
  const terminal=(t:ContactTriangle)=>t.part==='bottom'&&t.ids.every(id=>/^Skirt\.(Hem|HemInset|HemFacing)\.\d+$/.test(id));
  // 真裙封底的邻接裙边/腿出口可能数学相交；仍逐对计算和记录。
  return cap(a)&&(terminal(b)||leg(b))||cap(b)&&(terminal(a)||leg(a));
}
