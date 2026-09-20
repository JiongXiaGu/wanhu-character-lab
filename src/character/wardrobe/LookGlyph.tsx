import type { LookDefinition } from './catalog';
/** 目录示意图标，不冒充真实模型缩略图；分裳必须显示分腿结构，不再画旧连筒长裙。 */
export function LookGlyph({look}:{look:LookDefinition}) {
  const split=look.slots.bottom.includes('skirt'),long=look.slots.top==='ceremony_robe'||look.slots.top==='layered_vest';
  return <svg viewBox="0 0 84 100" aria-hidden="true" className="look-glyph">
    <path d="M33 8h18l-2 12H35z" fill="#8f8170"/>
    <path d={split?'M27 49h30l3 37-6 5H44L42 62 39 91H27l-4-5z':'M27 49h30l-5 42H42L40 62l-3 29H25z'} fill={look.dyes.secondary}/>
    <path d={long?'M30 19 18 23 9 45l12 5 5-12-2 32h15l3-13 3 13h15l-2-32 5 12 12-5-9-22-12-4z':'M30 19 18 23 9 45l12 5 5-12-2 20h36l-2-20 5 12 12-5-9-22-12-4z'} fill={look.dyes.primary}/>
    <path d="m33 20 17 20 3 12M51 20l-9 11" fill="none" stroke={look.dyes.accent} strokeWidth="3"/>
    <path d="M26 51h33v4H26z" fill={look.dyes.accent}/>
    {split&&<path d="M26 80h12m7 0h12" fill="none" stroke={look.dyes.accent} strokeWidth="2" opacity=".8"/>}
    <path d="M26 93h11m7 0h9" stroke="#5d615b" strokeWidth="4" strokeLinecap="round"/>
  </svg>;
}
