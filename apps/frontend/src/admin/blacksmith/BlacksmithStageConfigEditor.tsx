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

export function BlacksmithStageConfigEditor() {
  return (
    <BlacksmithCrudEditor<BlacksmithBalance>
      title="Этапы"
      collection="blacksmithBalance"
      createDraft={() => ({ ...DEFAULT_DRAFT })}
      renderDraft={(draft, setDraft) => (
        <>
          <label><span className="muted">ID</span><input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} /></label>
          <label><span className="muted">Heat ranges (JSON)</span><textarea rows={4} value={JSON.stringify(draft.heatRanges ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, heatRanges: JSON.parse(e.target.value) as Record<string, { min: number; max: number }> }); } catch {} }} /></label>
          <label><span className="muted">Quench profiles (JSON)</span><textarea rows={4} value={JSON.stringify(draft.quenchProfiles ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, quenchProfiles: JSON.parse(e.target.value) as Record<string, Record<string, number>> }); } catch {} }} /></label>
          <label><span className="muted">Strike profiles (JSON)</span><textarea rows={4} value={JSON.stringify(draft.strikeProfiles ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, strikeProfiles: JSON.parse(e.target.value) as Record<string, Record<string, number>> }); } catch {} }} /></label>
          <label><span className="muted">Finish profiles (JSON)</span><textarea rows={4} value={JSON.stringify(draft.finishProfiles ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, finishProfiles: JSON.parse(e.target.value) as Record<string, Record<string, number>> }); } catch {} }} /></label>
          <label><span className="muted">Base defect chances (JSON)</span><textarea rows={3} value={JSON.stringify(draft.baseDefectChances ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, baseDefectChances: JSON.parse(e.target.value) as Record<string, number> }); } catch {} }} /></label>
          <label><span className="muted">Repeat craft diminishing returns (JSON)</span><textarea rows={3} value={JSON.stringify(draft.repeatCraftDiminishingReturns ?? {}, null, 2)} onChange={(e) => { try { setDraft({ ...draft, repeatCraftDiminishingReturns: JSON.parse(e.target.value) as BlacksmithBalance['repeatCraftDiminishingReturns'] }); } catch {} }} /></label>
        </>
      )}
    />
  );
}
