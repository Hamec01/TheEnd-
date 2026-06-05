import type { BlacksmithModule } from '../../services/content/models';
import { BlacksmithCrudEditor } from './BlacksmithCrudEditor';
import { AdminImageField } from '../AdminImageField';

const DEFAULT_DRAFT: BlacksmithModule = {
  id: '',
  name: '',
  moduleType: 'airflow',
  tier: 1,
  description: '',
  bonuses: {},
  requiredBlacksmithLevel: 1,
  requiredSkillIds: [],
  compatibleForgeTierIds: [],
  imageRef: '',
  isEnabled: true,
};

export function BlacksmithModuleEditor() {
  return (
    <BlacksmithCrudEditor<BlacksmithModule>
      title="Модули"
      collection="blacksmithModules"
      createDraft={() => ({ ...DEFAULT_DRAFT })}
      renderDraft={(draft, setDraft) => (
        <>
          <label><span className="muted">ID</span><input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} /></label>
          <label><span className="muted">Название</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label><span className="muted">Тип модуля</span><input value={draft.moduleType} onChange={(e) => setDraft({ ...draft, moduleType: e.target.value })} /></label>
          <label><span className="muted">Тир</span><input type="number" value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: Number(e.target.value) || 1 })} /></label>
          <label><span className="muted">Мин. уровень</span><input type="number" value={draft.requiredBlacksmithLevel} onChange={(e) => setDraft({ ...draft, requiredBlacksmithLevel: Number(e.target.value) || 1 })} /></label>
          <AdminImageField
            value={draft.imageRef}
            onChange={(next) => setDraft({ ...draft, imageRef: next })}
            presetId="item-icon"
            label="Image ref"
            suggestedId={`${draft.id || 'module'}`}
            suggestedName={`${draft.name || 'Module'}`}
          />
          <label><span className="muted">Описание</span><textarea rows={3} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
          <label><span className="muted">Skill ids (через запятую)</span><input value={draft.requiredSkillIds.join(', ')} onChange={(e) => setDraft({ ...draft, requiredSkillIds: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
          <label><span className="muted">Forge tier ids (через запятую)</span><input value={draft.compatibleForgeTierIds.join(', ')} onChange={(e) => setDraft({ ...draft, compatibleForgeTierIds: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
          <label><span className="muted">Bonuses (JSON)</span><textarea rows={4} value={JSON.stringify(draft.bonuses ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, bonuses: JSON.parse(e.target.value) as Record<string, number | string | boolean> }); } catch {} }} /></label>
          <label><input type="checkbox" checked={draft.isEnabled} onChange={(e) => setDraft({ ...draft, isEnabled: e.target.checked })} /> Включено</label>
        </>
      )}
    />
  );
}
