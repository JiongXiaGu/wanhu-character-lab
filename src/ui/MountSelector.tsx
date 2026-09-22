import { SADDLES, isSaddleId, saddleDefinition, type SaddleId } from '../horse/saddles/catalog';
import { MOUNTS, isMountId, mountDefinition } from '../mounts/catalog';
import type { MountId } from '../mounts/types';
import './mount-selector.css';

/** 只有种类和整套鞍具；灰驴使用自己的资产，不把行囊拆成额外槽位。 */
export function MountSelector({ mountId, onMountChange, saddleId, onChange }: { mountId: MountId; onMountChange: (id: MountId) => void; saddleId: SaddleId; onChange: (id: SaddleId) => void }) {
  const animal = mountDefinition(mountId), saddle = saddleDefinition(saddleId);
  return <section className="mount-selector">
    <p className="horse-eyebrow">01 / MOUNT</p><h2>坐骑</h2>
    <label className="mount-selector-row"><span>种类</span><select aria-label="坐骑种类" data-testid="mount-horse" value={mountId} onChange={event => { if (isMountId(event.target.value)) onMountChange(event.target.value); }}>{MOUNTS.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
    <label className="mount-selector-row"><span>鞍具</span><select aria-label="鞍具" data-testid="mount-saddle" value={saddleId} onChange={event => { if (isSaddleId(event.target.value)) onChange(event.target.value); }}>{SADDLES.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
    <p className="mount-selector-note" data-testid="mount-description">{animal.name} · {saddle.description}</p>
  </section>;
}
