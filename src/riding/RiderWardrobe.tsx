import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { BODY_TYPES, HAIR_STYLE_IDS, createRecipe, patchSlots, type Recipe, type CharacterSlots } from '../character/v3/types';
import { SLOT_OPTIONS, SLOT_LABELS, HAIR_NAMES, WARDROBE_LOOKS, applyLook, parseRecipeFile } from '../character/wardrobe/catalog';

interface Props { recipe: Recipe; setRecipe: Dispatch<SetStateAction<Recipe>> }
/** 只编辑同一份V5配方；骑乘读取存档，但不静默覆盖人物工坊保存的装扮。 */
export function RiderWardrobe({ recipe, setRecipe }: Props) {
  const [notice, setNotice] = useState(''), [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const patchSlot = (slot: keyof CharacterSlots, value: string) => setRecipe(current => patchSlots(current, { [slot]: value } as Partial<CharacterSlots>));
  const restore = () => {
    try {
      const saved = localStorage.getItem('wanhu.character.wardrobe.v5');
      if (!saved) throw new Error('人物工坊尚未保存装扮。请先在那里保存，或在此导入V5配方。');
      setRecipe(parseRecipeFile(saved)); setImportError(''); setNotice('已载入人物工坊保存的装扮；骑乘不会覆盖该存档。');
    } catch (reason) { setImportError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const importRecipe = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 32768) throw new Error('配方文件过大（最多32 KB）。');
      setRecipe(parseRecipeFile(await file.text())); setImportError(''); setNotice('已导入V5装扮，播放相位保持不变。');
    } catch (reason) { setImportError(reason instanceof Error ? reason.message : String(reason)); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  const skirt = recipe.slots.bottom === 'true_short_skirt' || recipe.slots.bottom === 'long_skirt';
  const equipped = recipe.slots.leftHand !== 'none' || recipe.slots.rightHand !== 'none';
  const slots = (keys: (keyof CharacterSlots)[]) => <div className="riding-slots">{keys.map(key => <label key={key}><span>{SLOT_LABELS[key]}</span>
    <select data-testid={'riding-slot-' + key} aria-label={'骑手' + SLOT_LABELS[key]} value={recipe.slots[key]} onChange={event => patchSlot(key, event.target.value)}>{SLOT_OPTIONS[key].map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
  </label>)}</div>;
  return <section><p className="horse-eyebrow">02 / RIDER</p><h2>骑手与装扮</h2>
    <div className="horse-display-options">{BODY_TYPES.map(type => <button key={type} data-testid={'riding-body-' + type} aria-pressed={recipe.bodyType === type} onClick={() => setRecipe(current => createRecipe({ ...current, bodyType: type }))}>{type === 'female' ? '女性' : '男性'}</button>)}</div>
    <div className="riding-recipe-actions"><button data-testid="riding-default" onClick={() => { setRecipe(createRecipe({ bodyType: recipe.bodyType })); setNotice('已恢复默认裤装；没有改动人物工坊存档。'); setImportError(''); }}>默认搭配</button><button data-testid="riding-restore" onClick={restore}>读取保存装扮</button><button onClick={() => fileRef.current?.click()}>导入V5配方</button></div>
    <input hidden ref={fileRef} type="file" accept=".json,application/json" aria-label="导入骑手配方" onChange={event => void importRecipe(event.target.files?.[0])}/>
    {(notice || importError) && <p className={'riding-notice' + (importError ? ' is-error' : '')} role="status">{importError || notice}</p>}
    {slots(['top', 'bottom', 'headwear', 'shoes'])}
    <details className="riding-extra"><summary>发式、配色与随身装备</summary>
      <div className="riding-slots"><label><span>发型</span><select aria-label="骑手发型" value={recipe.hairStyle} onChange={event => setRecipe(current => createRecipe({ ...current, hairStyle: event.target.value as Recipe['hairStyle'] }))}>{HAIR_STYLE_IDS.map(id => <option key={id} value={id}>{HAIR_NAMES[id]}</option>)}</select></label>
        <label><span>发色</span><input aria-label="骑手发色" type="color" value={recipe.hairColor} onChange={event => setRecipe(current => createRecipe({ ...current, hairColor: event.target.value }))}/></label>
      </div>
      <div className="riding-dyes">{([['primary', '主布'], ['secondary', '下装'], ['accent', '缘边']] as const).map(([key, label]) => <label key={key}>{label}<input aria-label={'骑手' + label + '颜色'} type="color" value={recipe.dyes[key]} onChange={event => setRecipe(current => createRecipe({ ...current, dyes: { ...current.dyes, [key]: event.target.value } }))}/></label>)}</div>
      {slots(['back', 'leftHand', 'rightHand'])}
      <select aria-label="骑手搭配灵感" value="" onChange={event => { const id = event.target.value; if (id) setRecipe(current => applyLook(current, id)); }}><option value="">应用搭配灵感…</option>{WARDROBE_LOOKS.map(look => <option key={look.id} value={look.id}>{look.name}</option>)}</select>
    </details>
    {skirt && <p className="riding-warning" data-testid="riding-skirt-warning">连续封底裙暂列骑乘试验装扮：跨坐可能与马背、马腹穿插。不会自动换裤子、拆裙或删除封底。</p>}
    {equipped && <p className="riding-warning">手持物保持原装扮，可能与持缰姿态冲突；未制作持械握缰、骑射或工具使用动作。</p>}
  </section>;
}
