import type { BlacksmithTool } from '../../services/content/models';
import { BlacksmithCrudEditor } from './BlacksmithCrudEditor';
import { AdminImageField } from '../AdminImageField';

const DEFAULT_DRAFT: BlacksmithTool = {
  id: '',
  name: '',
  toolType: 'hammer',
  tier: 1,
  description: '',
  bonuses: {},
  minResultFloor: 0,
  specialRules: [],
  imageRef: '',
  isEnabled: true,
};

export function BlacksmithToolEditor() {
  return (
    <BlacksmithCrudEditor<BlacksmithTool>
      title="Инструменты"
      collection="blacksmithTools"
      createDraft={() => ({ ...DEFAULT_DRAFT })}
      renderDraft={(draft, setDraft) => (
        <>
          <label><span className="muted">ID</span><input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} /></label>
          <label><span className="muted">Название</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label><span className="muted">Тип инструмента</span><input value={draft.toolType} onChange={(e) => setDraft({ ...draft, toolType: e.target.value })} /></label>
          <label><span className="muted">Тир</span><input type="number" value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: Number(e.target.value) || 1 })} /></label>
          <label><span className="muted">Минимальный порог результата</span><input type="number" value={draft.minResultFloor} onChange={(e) => setDraft({ ...draft, minResultFloor: Number(e.target.value) || 0 })} /></label>
          <AdminImageField
            value={draft.imageRef}
            onChange={(next) => setDraft({ ...draft, imageRef: next })}
            presetId="item-icon"
            label="Image ref"
            suggestedId={`${draft.id || 'tool'}`}
            suggestedName={`${draft.name || 'Tool'}`}
          />
          <label><span className="muted">Описание</span><textarea rows={3} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
          <label><span className="muted">Special rules (через запятую)</span><input value={draft.specialRules.join(', ')} onChange={(e) => setDraft({ ...draft, specialRules: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
          <label><span className="muted">Bonuses (JSON)</span><textarea rows={4} value={JSON.stringify(draft.bonuses ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, bonuses: JSON.parse(e.target.value) as Record<string, number | string | boolean> }); } catch {} }} /></label>
          <label><input type="checkbox" checked={draft.isEnabled} onChange={(e) => setDraft({ ...draft, isEnabled: e.target.checked })} /> Включено</label>
        </>
      )}
    />
  );
}
