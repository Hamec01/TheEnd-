import { AdminImageField } from '../AdminImageField';
import { ImageSheetPicker } from '../components/ImageSheetPicker';
import type { BlacksmithVisualPreset, GameImageRef } from '../../services/content/models';
import { toLegacyImagePath } from '../../services/content/gameImageRefs';
import { BlacksmithCrudEditor } from './BlacksmithCrudEditor';
import type { ImagePresetId } from '../../services/content/imagePresets';

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

interface VisualListFieldProps {
  title: string;
  presetId: ImagePresetId;
  values: string[];
  onChange: (nextList: string[]) => void;
  suggestedPrefix: string;
  draftId: string;
  draftName: string;
}

function VisualListField({
  title,
  presetId,
  values,
  onChange,
  suggestedPrefix,
  draftId,
  draftName,
}: VisualListFieldProps) {
  const list = values || [];

  return (
    <div className="admin-visual-list-field" style={{
      border: '1px solid #443',
      padding: '15px',
      borderRadius: '4px',
      marginBottom: '20px',
      backgroundColor: 'rgba(0, 0, 0, 0.2)'
    }}>
      <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #443', paddingBottom: '5px' }}>{title}</h4>
      
      {list.map((val, index) => (
        <div key={index} style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <AdminImageField
              value={val}
              onChange={(next) => {
                const copy = [...list];
                copy[index] = next;
                onChange(copy);
              }}
              presetId={presetId}
              label={`${title} #${index + 1}`}
              suggestedId={`${draftId || 'blacksmith'}_${suggestedPrefix}_${index}_${Math.random().toString(36).substring(2, 7)}`}
              suggestedName={`${draftName || 'Blacksmith'} ${title} ${index + 1}`}
            />
          </div>
          <button
            type="button"
            className="admin-btn-delete"
            style={{
              marginTop: '35px',
              padding: '6px 12px',
              backgroundColor: '#833',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={() => {
              const copy = [...list];
              copy.splice(index, 1);
              onChange(copy);
            }}
          >
            Удалить
          </button>
        </div>
      ))}

      <button
        type="button"
        className="admin-btn-add"
        style={{
          padding: '8px 16px',
          backgroundColor: '#353',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
        onClick={() => {
          onChange([...list, '']);
        }}
      >
        + Добавить {title}
      </button>
    </div>
  );
}

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
            
            <VisualListField
              title="Defect Overlay"
              presetId="item-icon"
              values={draft.defectOverlayRefs}
              onChange={(next) => setDraft({ ...draft, defectOverlayRefs: next })}
              suggestedPrefix="defect"
              draftId={draft.id}
              draftName={draft.name}
            />

            <VisualListField
              title="Blank Image"
              presetId="item-icon"
              values={draft.blankImageRefs}
              onChange={(next) => setDraft({ ...draft, blankImageRefs: next })}
              suggestedPrefix="blank"
              draftId={draft.id}
              draftName={draft.name}
            />

            <VisualListField
              title="Quality Frame"
              presetId="item-icon"
              values={draft.qualityFrameRefs}
              onChange={(next) => setDraft({ ...draft, qualityFrameRefs: next })}
              suggestedPrefix="frame"
              draftId={draft.id}
              draftName={draft.name}
            />
          </>
        );
      }}
    />
  );
}
