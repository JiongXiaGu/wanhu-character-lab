import type { LookDefinition } from './catalog';
/** 目录示意图标，不冒充真实模型缩略图；验收使用同提交 WebGL 截图。 */
export function LookGlyph({look}:{look:LookDefinition}) {
  const skirt=look.slots.bottom.includes('skirt'),long=look.slots.top==='ceremony_robe'||look.slots.top==='layered_vest';
  return <svg viewBox="0 0 84 100" aria-hidden="true" className="look-glyph">
    <path d="M33 8h18l-2 12H35z" fill="#8f8170"/>
    {skirt?<path d="M29 50h26l13 39H17z" fill={look.dyes.secondary}/>:<path d="M27 49h30l-5 42H42L40 62l-3 29H25z" fill={look.dyes.secondary}/>}
    <path d={long?'M30 19 18 22 6 49l12 5 8-15-4 31h40l-4-31 8 15 12-5-12-27-12-3z':'M30 19 18 23 9 45l12 5 5-12-2 20h36l-2-20 5 12 12-5-9-22-12-4z'} fill={look.dyes.primary}/>
    <path d="m33 20 17 20 3 12M51 20l-9 11" fill="none" stroke={look.dyes.accent} strokeWidth="3"/>
    <path d="M26 51h33v4H26z" fill={look.dyes.accent}/>
    {skirt&&<path d="M31 65 27 87m14-22-1 22m11-22 5 22" stroke={look.dyes.accent} strokeWidth="1.3" opacity=".6"/>}
    <path d="M26 93h11m7 0h9" stroke="#5d615b" strokeWidth="4" strokeLinecap="round"/>
  </svg>;
}
