import './animal-mode-switcher.css';

/** 动物工坊内部的二级模式，不增加一级工坊或人物Recipe槽位。 */
export function AnimalModeSwitcher({ active }: { active: 'horse' | 'riding' }) {
  return <nav className="animal-mode-switcher" aria-label="动物预览模式">
    <a href="?lab=horse" data-testid="animal-mode-horse" aria-current={active === 'horse' ? 'page' : undefined}>马匹本体</a>
    <a href="?lab=riding" data-testid="animal-mode-riding" aria-current={active === 'riding' ? 'page' : undefined}>骑乘试衣</a>
  </nav>;
}
