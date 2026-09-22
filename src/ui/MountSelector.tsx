import { HORSES, SADDLES, isSaddleId, saddleDefinition, type SaddleId } from '../horse/saddles/catalog';
import './mount-selector.css';

/** 只有马匹和整体马鞍两项；行囊、辔头和缰绳不暴露成更多槽位。 */
export function MountSelector({ saddleId, onChange }: { saddleId: SaddleId; onChange: (id: SaddleId) => void }) {
  const definition = saddleDefinition(saddleId);
  return <section className="mount-selector">
    <p className="horse-eyebrow">01 / MOUNT</p><h2>坐骑</h2>
    <label className="mount-selector-row"><span>马匹</span><select aria-label="马匹" data-testid="mount-horse" defaultValue="chestnut">{HORSES.map(horse => <option key={horse.id} value={horse.id}>{horse.name}</option>)}</select></label>
    <label className="mount-selector-row"><span>马鞍</span><select aria-label="马鞍" data-testid="mount-saddle" value={saddleId} onChange={event => { if (isSaddleId(event.target.value)) onChange(event.target.value); }}>{SADDLES.map(saddle => <option key={saddle.id} value={saddle.id}>{saddle.name}</option>)}</select></label>
    <p className="mount-selector-note" data-testid="mount-description">{definition.description}</p>
  </section>;
}
