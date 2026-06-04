import { useEffect, useState } from 'react';
import { AdminFieldLabel } from '../adminUi';
import { itemsService } from '../../services/content/itemsService';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import { loadRuntimeImages } from '../../services/content/runtimeImageService';
import type { StoredImage } from '../../services/content/models';
import { loadMiningToolsFromStorage, saveMiningToolsToStorage } from '../../services/miningRepository';
import type { MiningToolDefinition, MiningToolEffectType, MiningToolType } from '../../types/mining';
import { ImageSheetPicker } from '../components/ImageSheetPicker';
import { materializeTilesetFrameToPreset } from '../../services/content/materializeTilesetFrame';
import { normalizeGameImageRef, toLegacyImagePath } from '../../services/content/gameImageRefs';

interface MiningToolEditorProps {
  onSave?: (tools: MiningToolDefinition[]) => void;
}

const TOOL_TYPES: MiningToolType[] = ['pickaxe', 'dynamite', 'rope', 'torch', 'support', 'food', 'helper', 'special'];
const EFFECT_TYPES: MiningToolEffectType[] = ['extra_hits', 'break_block', 'safe_retreat', 'reveal_hint', 'reduce_next_hazard', 'restore_stamina', 'extra_loot_slots'];
const LEGACY_TOOL_ITEM_ID_MAP: Record<string, string> = {
  tool_pickaxe_rusty: 'mining_tool_rusty_pickaxe',
  tool_dynamite: 'mining_tool_dynamite',
  tool_torch: 'mining_tool_torch',
};

function emptyTool(): MiningToolDefinition {
  return {
    id: '',
    professionId: 'mining',
    itemId: '',
    toolType: 'pickaxe',
    name: '',
    description: '',
    effectType: 'extra_hits',
    effectValue: 0,
    spriteRef: undefined,
    spriteAssetId: '',
    spriteUrl: '',
    isConsumable: false,
    isEnabled: true,
  };
}

function normalizeToolItemId(value: string): string {
  const normalized = value.trim();
  return LEGACY_TOOL_ITEM_ID_MAP[normalized] ?? normalized;
}

export function MiningToolEditor({ onSave }: MiningToolEditorProps) {
  const [tools, setTools] = useState<MiningToolDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MiningToolDefinition>(emptyTool());
  const [status, setStatus] = useState('Ready');
  const [knownItems, setKnownItems] = useState<Array<{ id: string; name: string }>>([]);
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);

  useEffect(() => {
    const loaded = loadMiningToolsFromStorage();
    setTools(loaded);
    if (loaded.length > 0) {
      setSelectedId(loaded[0]!.id);
      setDraft(loaded[0]!);
    }
    void itemsService.getAll()
      .then((items) => {
        const filtered = items
          .map((item) => ({ id: String(item.id ?? '').trim(), name: String(item.name ?? item.id ?? '').trim() }))
          .filter((item) => item.id.length > 0)
          .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
        setKnownItems(filtered);
      })
      .catch(() => setKnownItems([]));
  }, []);

  useEffect(() => {
    void loadRuntimeImages()
      .then((images) => setRuntimeImages(images))
      .catch(() => setRuntimeImages([]));
  }, []);

  function persist(next: MiningToolDefinition[], nextStatus: string) {
    setTools(next);
    saveMiningToolsToStorage(next);
    onSave?.(next);
    setStatus(nextStatus);
  }

  function beginCreate() {
    setSelectedId(null);
    setDraft(emptyTool());
  }

  function beginEdit(id: string) {
    const found = tools.find((entry) => entry.id === id);
    if (!found) {
      return;
    }
    setSelectedId(id);
    setDraft(found);
  }

  function saveDraft() {
    const normalizedSpriteRef = normalizeGameImageRef(draft.spriteRef, draft.spriteUrl);
    const normalized: MiningToolDefinition = {
      ...draft,
      id: draft.id.trim(),
      itemId: normalizeToolItemId(draft.itemId),
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      spriteRef: normalizedSpriteRef,
      spriteAssetId: (toLegacyImagePath(normalizedSpriteRef) ?? draft.spriteAssetId)?.trim() || undefined,
      spriteUrl: (toLegacyImagePath(normalizedSpriteRef) ?? draft.spriteUrl)?.trim() || undefined,
      effectValue: Number.isFinite(Number(draft.effectValue)) ? Number(draft.effectValue) : 0,
    };

    if (!normalized.id || !normalized.itemId || !normalized.name) {
      setStatus('Fill in id, itemId and tool name.');
      return;
    }

    if (selectedId) {
      if (selectedId !== normalized.id && tools.some((entry) => entry.id === normalized.id)) {
        setStatus(`A tool with id ${normalized.id} already exists.`);
        return;
      }
      const next = tools.filter((entry) => entry.id !== selectedId).concat([normalized]);
      setSelectedId(normalized.id);
      setDraft(normalized);
      persist(next, `Tool saved: ${normalized.name}`);
      return;
    }

    if (tools.some((entry) => entry.id === normalized.id)) {
      setStatus(`A tool with id ${normalized.id} already exists.`);
      return;
    }

    const next = [...tools, normalized];
    setSelectedId(normalized.id);
    setDraft(normalized);
    persist(next, `Tool created: ${normalized.name}`);
  }

  function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm(`Delete tool ${selectedId}?`)) {
      return;
    }
    const next = tools.filter((entry) => entry.id !== selectedId);
    persist(next, `Tool deleted: ${selectedId}`);
    if (next.length > 0) {
      beginEdit(next[0]!.id);
      return;
    }
    beginCreate();
  }

  const uploadFolder = buildUploadFolder('images', 'mining', 'tools', draft.id || draft.name || undefined);

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <button onClick={beginCreate}>New tool</button>
        </div>
        <div className="admin-scroll-list">
          {tools.map((tool) => (
            <button key={tool.id} className={selectedId === tool.id ? 'is-active' : ''} onClick={() => beginEdit(tool.id)}>
              <strong>{tool.name}</strong>
              <span>{tool.id} | {tool.toolType} | {tool.itemId}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" />
            <input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Name" />
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Item ID" />
            <input value={draft.itemId} list="mining-tool-items" onChange={(event) => setDraft((current) => ({ ...current, itemId: event.target.value }))} />
            <datalist id="mining-tool-items">
              {knownItems.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </datalist>
          </label>
          <label>
            <AdminFieldLabel label="Tool type" />
            <select value={draft.toolType} onChange={(event) => setDraft((current) => ({ ...current, toolType: event.target.value as MiningToolType }))}>
              {TOOL_TYPES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Effect type" />
            <select value={draft.effectType ?? ''} onChange={(event) => setDraft((current) => ({ ...current, effectType: event.target.value as MiningToolEffectType }))}>
              {EFFECT_TYPES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Effect value" />
            <input type="number" value={draft.effectValue ?? 0} onChange={(event) => setDraft((current) => ({ ...current, effectValue: Number(event.target.value) || 0 }))} />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isConsumable} onChange={(event) => setDraft((current) => ({ ...current, isConsumable: event.target.checked }))} />
            <AdminFieldLabel label="Consumable" />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isEnabled} onChange={(event) => setDraft((current) => ({ ...current, isEnabled: event.target.checked }))} />
            <AdminFieldLabel label="Enabled" />
          </label>
        </div>

        <ImageSheetPicker
          label="Tool icon / sprite"
          hint="128x128. Можно загрузить отдельную картинку или выбрать frame из tileset (кадр 128x128)."
          category="items"
          value={draft.spriteRef}
          legacyImagePath={draft.spriteUrl}
          runtimeImages={runtimeImages}
          showUploadForImage
          uploadPresetId="mining-tool-icon"
          uploadSuggestedId={draft.id ? `${draft.id}-icon` : undefined}
          uploadSuggestedName={`${draft.id || draft.name || 'mining-tool'}-icon`}
          uploadFolder={uploadFolder}
          defaultTilesetFrameWidth={128}
          defaultTilesetFrameHeight={128}
          onStatus={setStatus}
          onChange={(next) => {
            setDraft((current) => ({
              ...current,
              spriteRef: next,
              spriteUrl: next?.type === 'image' ? next.src : current.spriteUrl,
              spriteAssetId: next?.type === 'image' ? next.src : current.spriteAssetId,
            }));
            if (next?.type !== 'tileset' || !draft.id) {
              return;
            }
            void materializeTilesetFrameToPreset(next, {
              presetId: 'mining-tool-icon',
              runtimeImages,
              folder: uploadFolder,
              id: `${draft.id}-icon`,
              name: `${draft.id || draft.name || 'mining-tool'}-icon`,
            }).then((result) => {
              if (!result) {
                return;
              }
              setDraft((current) => ({
                ...current,
                spriteUrl: result.imageId,
                spriteAssetId: result.imageId,
              }));
              setStatus(`Tool icon frame materialized as ${result.imageId} (128x128 PNG).`);
            }).catch((error) => setStatus(String((error as Error).message ?? error)));
          }}
        />

        <label>
          <AdminFieldLabel label="Description" />
          <textarea value={draft.description ?? ''} rows={4} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
        </label>

        <div className="admin-actions-row">
          <button onClick={saveDraft}>{selectedId ? 'Save' : 'Create'}</button>
          <button disabled={!selectedId} onClick={deleteSelected}>Delete</button>
        </div>
        <p className="muted">{status}</p>
      </section>
    </div>
  );
}
