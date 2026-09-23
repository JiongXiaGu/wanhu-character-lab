import type { SaddleId } from '../horse/saddles/catalog';
import type { MountId } from '../mounts/types';
import './animal-mode-switcher.css';

/** 三个职责栏目共用动物入口；家畜不进入骑乘协议。往返仍携带原坐骑与鞍具。 */
export function AnimalModeSwitcher({ active, saddleId = 'none', mountId = 'horse_chestnut', onNavigate }: { active: 'horse' | 'riding' | 'livestock'; saddleId?: SaddleId; mountId?: MountId; onNavigate?: () => void }) {
  const args = `preview=resume&mount=${encodeURIComponent(mountId)}&saddle=${encodeURIComponent(saddleId)}`;
  return <nav className="animal-mode-switcher" aria-label="动物预览模式">
    <a onClick={onNavigate} href={`?lab=mount&${args}`} data-testid="animal-mode-horse" aria-current={active === 'horse' ? 'page' : undefined}>坐骑本体</a>
    <a onClick={onNavigate} href={`?lab=riding&${args}`} data-testid="animal-mode-riding" aria-current={active === 'riding' ? 'page' : undefined}>骑乘试衣</a>
    <a onClick={onNavigate} href={`?lab=livestock&${args}`} data-testid="animal-mode-livestock" aria-current={active === 'livestock' ? 'page' : undefined}>家畜</a>
  </nav>;
}
