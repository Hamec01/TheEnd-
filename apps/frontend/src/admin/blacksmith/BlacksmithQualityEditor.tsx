import type { BlacksmithQualityTier } from '../../services/content/models';
import { BlacksmithCrudEditor } from './BlacksmithCrudEditor';
import { AdminImageField } from '../AdminImageField';

const DEFAULT_DRAFT: BlacksmithQualityTier = {
  id: '',
  name: '',
  minScore: 0,
  maxScore: 100,
  priceMultiplier: 1,
  xpMultiplier: 1,
  statMultiplier: 1,
  frameImageRef: '',
  isFailureTier: false,
};

export function BlacksmithQualityEditor() {
  return (
    <BlacksmithCrudEditor<BlacksmithQualityTier>
      title="Качество"
      collection="blacksmithQualityTiers"
      createDraft={() => ({ ...DEFAULT_DRAFT })}
      renderDraft={(draft, setDraft) => (
        <>
          <label><span className="muted">ID</span><input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} /></label>
          <label><span className="muted">Название</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label><span className="muted">Min score</span><input type="number" value={draft.minScore} onChange={(e) => setDraft({ ...draft, minScore: Number(e.target.value) || 0 })} /></label>
          <label><span className="muted">Max score</span><input type="number" value={draft.maxScore} onChange={(e) => setDraft({ ...draft, maxScore: Number(e.target.value) || 0 })} /></label>
          <label><span className="muted">Price multiplier</span><input type="number" step="0.01" value={draft.priceMultiplier} onChange={(e) => setDraft({ ...draft, priceMultiplier: Number(e.target.value) || 0 })} /></label>
          <label><span className="muted">XP multiplier</span><input type="number" step="0.01" value={draft.xpMultiplier} onChange={(e) => setDraft({ ...draft, xpMultiplier: Number(e.target.value) || 0 })} /></label>
          <label><span className="muted">Stat multiplier</span><input type="number" step="0.01" value={draft.statMultiplier} onChange={(e) => setDraft({ ...draft, statMultiplier: Number(e.target.value) || 0 })} /></label>
          <AdminImageField
            value={draft.frameImageRef}
            onChange={(next) => setDraft({ ...draft, frameImageRef: next })}
            presetId="item-icon"
            label="Frame image ref"
            suggestedId={`${draft.id || 'quality'}_frame`}
            suggestedName={`${draft.name || 'Quality'} Frame`}
          />
          <label><input type="checkbox" checked={draft.isFailureTier} onChange={(e) => setDraft({ ...draft, isFailureTier: e.target.checked })} /> Failure tier</label>
        </>
      )}
    />
  );
}
