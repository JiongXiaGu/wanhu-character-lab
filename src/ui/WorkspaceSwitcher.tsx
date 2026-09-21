import './workspace-switcher.css';

export type WorkspaceMode = 'character' | 'animal';

function CharacterIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="5" r="2.2"/>
    <path d="M3.7 13.2c.45-2.7 2.05-4.05 4.3-4.05s3.85 1.35 4.3 4.05"/>
  </svg>;
}

function AnimalIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4.4 13V7.1L6.1 3l2 1.35L11.35 3l.9 3.25v4.2c0 1.65-1.35 2.95-3 2.95H7.1c-1.5 0-2.7-1.2-2.7-2.7Z"/>
    <path d="M8.55 7.35h.05M6.35 10.4c.9.7 2.5.75 3.45.05"/>
  </svg>;
}

export function WorkspaceSwitcher({ active }: { active: WorkspaceMode }) {
  return <nav className="workspace-switcher" aria-label="工作区切换">
    <a
      className="workspace-switcher__item"
      data-testid="workspace-character"
      aria-current={active === 'character' ? 'page' : undefined}
      href="./"
    >
      <CharacterIcon/><span>人物工坊</span>
    </a>
    <a
      className="workspace-switcher__item"
      data-testid="workspace-animal"
      aria-current={active === 'animal' ? 'page' : undefined}
      href="?lab=horse"
    >
      <AnimalIcon/><span>动物工坊</span>
    </a>
  </nav>;
}
