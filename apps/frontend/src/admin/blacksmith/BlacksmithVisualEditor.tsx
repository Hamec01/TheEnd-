import { AdminImageField } from '../AdminImageField';
import { ImageSheetPicker } from '../components/ImageSheetPicker';
import type { BlacksmithVisualPreset, GameImageRef } from '../../services/content/models';
import { toLegacyImagePath } from '../../services/content/gameImageRefs';
import { BlacksmithCrudEditor } from './BlacksmithCrudEditor';

const DEFAULT_DRAFT: BlacksmithVisualPreset = {
  id: '',
  name: '',
  backgroundImageRef: '',
  anvilImageRef: '',
  furnaceImageRef: '',
  hammerImageRefs: [],
  defectOverlayRefs: [],
  blankImageRefs: [],
  qualityFrameRefs: [],
};

export function BlacksmithVisualEditor() {
  return (
    <BlacksmithCrudEditor<BlacksmithVisualPreset>
      title="Визуал"
      collection="blacksmithVisualPresets"
      createDraft={() => ({ ...DEFAULT_DRAFT })}
      renderDraft={(draft, setDraft) => {
        const hammerRef: GameImageRef | undefined = draft.hammerImageRefs[0]
          ? { type: 'image', src: draft.hammerImageRefs[0] }
          : undefined;

        return (
          <>
            <label><span className="muted">ID</span><input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} /></label>
            <label><span className="muted">Название</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <AdminImageField
              value={draft.backgroundImageRef}
              onChange={(next) => setDraft({ ...draft, backgroundImageRef: next })}
              presetId="world-location-sprite"
              label="Background"
              suggestedId={`${draft.id || 'blacksmith'}_bg`}
              suggestedName={`${draft.name || 'Blacksmith'} Background`}
            />
            <AdminImageField
              value={draft.anvilImageRef}
              onChange={(next) => setDraft({ ...draft, anvilImageRef: next })}
              presetId="item-icon"
              label="Anvil"
              suggestedId={`${draft.id || 'blacksmith'}_anvil`}
              suggestedName={`${draft.name || 'Blacksmith'} Anvil`}
            />
            <AdminImageField
              value={draft.furnaceImageRef}
              onChange={(next) => setDraft({ ...draft, furnaceImageRef: next })}
              presetId="item-icon"
              label="Furnace"
              suggestedId={`${draft.id || 'blacksmith'}_furnace`}
              suggestedName={`${draft.name || 'Blacksmith'} Furnace`}
            />
            <ImageSheetPicker
              label="Hammer image / spritesheet"
              value={hammerRef}
              legacyImagePath={hammerRef ? toLegacyImagePath(hammerRef) : undefined}
              showUploadForImage
              uploadPresetId="item-icon"
              uploadSuggestedId={`${draft.id || 'blacksmith'}_hammer`}
              uploadSuggestedName={`${draft.name || 'Blacksmith'} Hammer`}
              onChange={(next) => {
                const src = next ? toLegacyImagePath(next) ?? '' : '';
                const current = draft.hammerImageRefs;
                const tail = current.slice(1);
                setDraft({ ...draft, hammerImageRefs: src ? [src, ...tail] : tail });
              }}
            />
            <label><span className="muted">Defect overlays (через запятую)</span><input value={draft.defectOverlayRefs.join(', ')} onChange={(e) => setDraft({ ...draft, defectOverlayRefs: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
            <label><span className="muted">Blank images (через запятую)</span><input value={draft.blankImageRefs.join(', ')} onChange={(e) => setDraft({ ...draft, blankImageRefs: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
            <label><span className="muted">Quality frames (через запятую)</span><input value={draft.qualityFrameRefs.join(', ')} onChange={(e) => setDraft({ ...draft, qualityFrameRefs: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
          </>
        );
      }}
    />
  );
}
