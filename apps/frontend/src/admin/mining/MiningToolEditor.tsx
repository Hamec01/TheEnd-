import { useEffect, useState } from 'react';
import { AdminImageField } from '../AdminImageField';
import { AdminFieldLabel } from '../adminUi';
import { itemsService } from '../../services/content/itemsService';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import { loadMiningToolsFromStorage, saveMiningToolsToStorage } from '../../services/miningRepository';
import type { MiningToolDefinition, MiningToolEffectType, MiningToolType } from '../../types/mining';

interface MiningToolEditorProps {
  onSave?: (tools: MiningToolDefinition[]) => void;
}

const TOOL_TYPES: MiningToolType[] = ['pickaxe', 'dynamite', 'rope', 'torch', 'support', 'food', 'helper', 'special'];
const EFFECT_TYPES: MiningToolEffectType[] = ['extra_hits', 'break_block', 'safe_retreat', 'reveal_hint', 'reduce_next_hazard', 'restore_stamina', 'extra_loot_slots'];

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
    spriteAssetId: '',
    spriteUrl: '',
    isConsumable: false,
    isEnabled: true,
  };
}

export function MiningToolEditor({ onSave }: MiningToolEditorProps) {
  const [tools, setTools] = useState<MiningToolDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MiningToolDefinition>(emptyTool());
  const [status, setStatus] = useState('Ready');
  const [knownItems, setKnownItems] = useState<Array<{ id: string; name: string }>>([]);

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
    const normalized: MiningToolDefinition = {
      ...draft,
      id: draft.id.trim(),
      itemId: draft.itemId.trim(),
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      spriteAssetId: draft.spriteAssetId?.trim() || undefined,
      spriteUrl: draft.spriteUrl?.trim() || undefined,
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

        <AdminImageField
          value={draft.spriteUrl ?? ''}
          onChange={(nextValue) => setDraft((current) => ({ ...current, spriteUrl: nextValue, spriteAssetId: nextValue }))}
          onUploaded={(image) => setStatus(`Tool image uploaded to ${uploadFolder} as ${image.id} (${image.width}x${image.height}, PNG).`)}
          onStatus={setStatus}
          presetId="mining-tool-icon"
          suggestedId={draft.id ? `${draft.id}-icon` : undefined}
          suggestedName={`${draft.id || draft.name || 'mining-tool'}-icon`}
          uploadFolder={uploadFolder}
          label="Tool icon / sprite"
          hint="Always use upload. The file will be saved into the correct folder and resized to PNG 128x128."
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
