import type { SaddleId } from '../horse/saddles/catalog';
import './animal-mode-switcher.css';

/** 二级模式只携带当前两项外观选择，不增加马具装配页或存档协议。 */
export function AnimalModeSwitcher({ active, saddleId }: { active: 'horse' | 'riding'; saddleId?: SaddleId }) {
  const suffix = saddleId === undefined ? '' : `&horse=chestnut&saddle=${saddleId}`;
  return <nav className="animal-mode-switcher" aria-label="动物预览模式">
    <a href={'?lab=horse' + suffix} data-testid="animal-mode-horse" aria-current={active === 'horse' ? 'page' : undefined}>马匹本体</a>
    <a href={'?lab=riding' + suffix} data-testid="animal-mode-riding" aria-current={active === 'riding' ? 'page' : undefined}>骑乘试衣</a>
  </nav>;
}
