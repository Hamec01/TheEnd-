import type { BlacksmithBalance } from '../../services/content/models';
import { BlacksmithCrudEditor } from './BlacksmithCrudEditor';

const DEFAULT_DRAFT: BlacksmithBalance = {
  id: '',
  baseXpByRecipeType: {},
  xpByMaterialTier: {},
  qualityBonuses: {},
  qualityPenalties: {},
  repeatCraftDiminishingReturns: {
    startAfter: 0,
    floorMultiplier: 0.5,
    decayPerCraft: 0.1,
  },
  heatRanges: {},
  baseDefectChances: {},
  quenchProfiles: {},
  strikeProfiles: {},
  finishProfiles: {},
};

export function BlacksmithBalanceEditor() {
  return (
    <BlacksmithCrudEditor<BlacksmithBalance>
      title="XP / Баланс"
      collection="blacksmithBalance"
      createDraft={() => ({ ...DEFAULT_DRAFT })}
      renderDraft={(draft, setDraft) => (
        <>
          <label><span className="muted">ID</span><input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} /></label>
          <label><span className="muted">Base XP by recipe type (JSON)</span><textarea rows={4} value={JSON.stringify(draft.baseXpByRecipeType ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, baseXpByRecipeType: JSON.parse(e.target.value) as Record<string, number> }); } catch {} }} /></label>
          <label><span className="muted">XP by material tier (JSON)</span><textarea rows={4} value={JSON.stringify(draft.xpByMaterialTier ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, xpByMaterialTier: JSON.parse(e.target.value) as Record<string, number> }); } catch {} }} /></label>
          <label><span className="muted">Quality bonuses (JSON)</span><textarea rows={3} value={JSON.stringify(draft.qualityBonuses ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, qualityBonuses: JSON.parse(e.target.value) as Record<string, number> }); } catch {} }} /></label>
          <label><span className="muted">Quality penalties (JSON)</span><textarea rows={3} value={JSON.stringify(draft.qualityPenalties ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, qualityPenalties: JSON.parse(e.target.value) as Record<string, number> }); } catch {} }} /></label>
          <label><span className="muted">Repeat craft DR (JSON)</span><textarea rows={3} value={JSON.stringify(draft.repeatCraftDiminishingReturns ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, repeatCraftDiminishingReturns: JSON.parse(e.target.value) as BlacksmithBalance['repeatCraftDiminishingReturns'] }); } catch {} }} /></label>
        </>
      )}
    />
  );
}
