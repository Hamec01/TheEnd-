import type { BlacksmithForgeTier } from '../../services/content/models';
import { BlacksmithCrudEditor } from './BlacksmithCrudEditor';

const DEFAULT_DRAFT: BlacksmithForgeTier = {
  id: '',
  name: '',
  description: '',
  tier: 1,
  requiredBlacksmithLevel: 1,
  requiredSkillIds: [],
  allowedRecipeTypes: [],
  allowedRecipeGroups: [],
  allowedMaterialTiers: [],
  heatControlBonus: 0,
  qualityCapBonus: 0,
  failureChanceReduction: 0,
  moduleSlotLimits: {},
  visualPresetId: '',
  isEnabled: true,
};

export function BlacksmithForgeTierEditor() {
  return (
    <BlacksmithCrudEditor<BlacksmithForgeTier>
      title="Кузни"
      collection="blacksmithForgeTiers"
      createDraft={() => ({ ...DEFAULT_DRAFT })}
      renderDraft={(draft, setDraft) => (
        <>
          <label><span className="muted">ID</span><input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} /></label>
          <label><span className="muted">Название</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label><span className="muted">Тир</span><input type="number" value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: Number(e.target.value) || 1 })} /></label>
          <label><span className="muted">Мин. уровень кузнеца</span><input type="number" value={draft.requiredBlacksmithLevel} onChange={(e) => setDraft({ ...draft, requiredBlacksmithLevel: Number(e.target.value) || 1 })} /></label>
          <label><span className="muted">Visual preset id</span><input value={draft.visualPresetId ?? ''} onChange={(e) => setDraft({ ...draft, visualPresetId: e.target.value })} /></label>
          <label><span className="muted">Описание</span><textarea rows={3} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
          <label><span className="muted">Recipe types (через запятую)</span><input value={draft.allowedRecipeTypes.join(', ')} onChange={(e) => setDraft({ ...draft, allowedRecipeTypes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
          <label><span className="muted">Recipe groups (через запятую)</span><input value={draft.allowedRecipeGroups.join(', ')} onChange={(e) => setDraft({ ...draft, allowedRecipeGroups: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
          <label><span className="muted">Material tiers (через запятую)</span><input value={draft.allowedMaterialTiers.join(', ')} onChange={(e) => setDraft({ ...draft, allowedMaterialTiers: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
          <label><span className="muted">Heat control bonus</span><input type="number" value={draft.heatControlBonus} onChange={(e) => setDraft({ ...draft, heatControlBonus: Number(e.target.value) || 0 })} /></label>
          <label><span className="muted">Quality cap bonus</span><input type="number" value={draft.qualityCapBonus} onChange={(e) => setDraft({ ...draft, qualityCapBonus: Number(e.target.value) || 0 })} /></label>
          <label><span className="muted">Failure chance reduction</span><input type="number" value={draft.failureChanceReduction} onChange={(e) => setDraft({ ...draft, failureChanceReduction: Number(e.target.value) || 0 })} /></label>
          <label><span className="muted">Module slot limits (JSON)</span><textarea rows={3} value={JSON.stringify(draft.moduleSlotLimits ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, moduleSlotLimits: JSON.parse(e.target.value) as Record<string, number> }); } catch {} }} /></label>
          <label><input type="checkbox" checked={draft.isEnabled} onChange={(e) => setDraft({ ...draft, isEnabled: e.target.checked })} /> Включено</label>
        </>
      )}
    />
  );
}
