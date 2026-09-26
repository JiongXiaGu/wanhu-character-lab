import type { Recipe } from '../character/v3/types';
import { SOLDIER_ARMOR_CLASS_IDS, SOLDIER_STYLE_IDS, SOLDIER_STYLE_CONTRACT } from './contract';
import { SOLDIER_ARMOR_NAMES, identifySoldierArmor, applySoldierArmor } from './armor-classes';
import { SOLDIER_IDENTITY_IDS, SOLDIER_IDENTITY_NAMES, identifySoldierHelmet, applySoldierIdentity } from './identities';
import { applySoldierStyle } from './looks';

type Props = { recipe: Recipe; edit: (change: (recipe: Recipe) => Recipe) => void };

/** 原工坊中的三个外观选择轴；所有选中状态由真实 Recipe 派生，不独立保存。 */
export function SoldierFitting({ recipe, edit }: Props) {
  const helmet = identifySoldierHelmet(recipe.slots.headwear);
  const armorClass = identifySoldierArmor(recipe);
  return <section className="spaced" aria-label="军人试衣">
    <div className="section-title"><h2>军人试衣</h2><span>甲装 / 驻地 / 身份</span></div>
    <div className="display-grid" role="group" aria-label="甲装等级">
      {SOLDIER_ARMOR_CLASS_IDS.map(id => <button key={id} data-testid={'soldier-armor-' + id} aria-pressed={armorClass === id} className={armorClass === id ? 'active' : ''} onClick={() => edit(r => applySoldierArmor(r, id))}>{SOLDIER_ARMOR_NAMES[id]}</button>)}
    </div>
    <div className="display-grid" role="group" aria-label="军人身份">
      {SOLDIER_IDENTITY_IDS.map(identity => <button key={identity} data-testid={'soldier-identity-' + identity} disabled={!helmet} aria-pressed={helmet?.identity === identity} className={helmet?.identity === identity ? 'active' : ''} onClick={() => edit(r => applySoldierIdentity(r, identity))}>{SOLDIER_IDENTITY_NAMES[identity]}</button>)}
    </div>
    {SOLDIER_STYLE_IDS.map(style => <button key={style} className={'clear-equipment ' + (helmet?.style === style ? 'active' : '')} data-testid={'soldier-' + style} aria-pressed={helmet?.style === style} onClick={() => edit(r => applySoldierStyle(r, style))}>{SOLDIER_STYLE_CONTRACT[style].name}</button>)}
    <p className="hint">甲装切换共享衣甲与配套军盔；驻地只换军盔与配色，普通／队长只换头盔。首次从居民装选择驻地会应用默认长枪搭配；已有甲装或军盔时保留混搭。不同等级也可共用同一驻地。</p>
    {!armorClass && helmet && <p className="hint">当前上下装为自由混搭，不强行归为轻、中或重甲。</p>}
  </section>;
}
