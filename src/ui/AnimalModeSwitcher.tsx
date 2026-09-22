import type { SaddleId } from '../horse/saddles/catalog';
import type { MountId } from '../mounts/types';
import './animal-mode-switcher.css';

/** 两种预览共用目录；往返携带种类和鞍具，不把无鞍静默改成普通鞍。 */
export function AnimalModeSwitcher({ active, saddleId = 'none', mountId = 'horse_chestnut' }: { active: 'horse' | 'riding'; saddleId?: SaddleId; mountId?: MountId }) {
  const args = `mount=${encodeURIComponent(mountId)}&saddle=${encodeURIComponent(saddleId)}`;
  return <nav className="animal-mode-switcher" aria-label="动物预览模式">
    <a href={`?lab=mount&${args}`} data-testid="animal-mode-horse" aria-current={active === 'horse' ? 'page' : undefined}>坐骑本体</a>
    <a href={`?lab=riding&${args}`} data-testid="animal-mode-riding" aria-current={active === 'riding' ? 'page' : undefined}>骑乘试衣</a>
  </nav>;
}
