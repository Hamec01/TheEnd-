import { useEffect, useMemo, useState } from 'react';
import { AdminImageField } from '../AdminImageField';
import type { MineDefinition, MineDangerLevel, MineVisualTheme } from '../../types/mining';
import { downloadCollectionJson } from '../../services/content/adminJsonImportExport';
import { itemsService } from '../../services/content/itemsService';
import { materialsService } from '../../services/content/materialsService';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import {
  loadMineBlockTablesFromStorage,
  loadMineDepthsFromStorage,
  loadMineLootTablesFromStorage,
  loadMinesFromStorage,
  loadMiningToolsFromStorage,
  saveMinesToStorage,
} from '../../services/miningRepository';
import { AdminFieldLabel } from '../adminUi';

interface MineEditorProps {
  onSave?: (mines: MineDefinition[]) => void;
}

const DANGER_LEVELS: MineDangerLevel[] = ['low', 'medium', 'high', 'deadly'];
const VISUAL_THEMES: MineVisualTheme[] = ['teramor_stone', 'coal', 'zeptyrite', 'lava', 'ice', 'shadow', 'crystal'];

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => String(entry ?? '').trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'ru'));
}

function appendCsv(current: string[], next: string): string[] {
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || current.includes(normalizedNext)) {
    return current;
  }
  return [...current, normalizedNext];
}

function emptyMine(): MineDefinition {
  return {
    id: '',
    name: '',
    description: '',
    shortDescription: '',
    requiredProfessionId: 'mining',
    requiredMiningLevel: 1,
    dangerLevel: 'low',
    visualTheme: 'teramor_stone',
    region: '',
    locationId: '',
    backgroundImageAssetId: '',
    backgroundImageUrl: '',
    depthIds: [],
    knownResources: [],
    knownResourceItemIds: [],
    knownMaterialIds: [],
    entryText: '',
    isEnabled: true,
  };
}

function normalizeMineDraft(draft: MineDefinition): MineDefinition {
  return {
    ...draft,
    id: draft.id.trim(),
    name: draft.name.trim(),
    description: draft.description.trim(),
    shortDescription: draft.shortDescription?.trim() || undefined,
    region: draft.region?.trim() || undefined,
    locationId: draft.locationId?.trim() || undefined,
    backgroundImageAssetId: draft.backgroundImageAssetId?.trim() || undefined,
    backgroundImageUrl: draft.backgroundImageUrl?.trim() || undefined,
    depthIds: draft.depthIds.map((entry) => entry.trim()).filter(Boolean),
    knownResources: draft.knownResources.map((entry) => entry.trim()).filter(Boolean),
    knownResourceItemIds: (draft.knownResourceItemIds ?? []).map((entry) => entry.trim()).filter(Boolean),
    knownMaterialIds: (draft.knownMaterialIds ?? []).map((entry) => entry.trim()).filter(Boolean),
    entryText: draft.entryText?.trim() || undefined,
    requiredProfessionId: 'mining',
    requiredMiningLevel: Math.max(1, Math.floor(Number(draft.requiredMiningLevel || 1))),
  };
}

export function MineEditor({ onSave }: MineEditorProps) {
  const [mines, setMines] = useState<MineDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MineDefinition>(emptyMine());
  const [status, setStatus] = useState('Ready');
  const [knownItemIds, setKnownItemIds] = useState<string[]>([]);
  const [knownMaterialIds, setKnownMaterialIds] = useState<string[]>([]);

  useEffect(() => {
    const loaded = loadMinesFromStorage();
    setMines(loaded);
    if (loaded.length > 0) {
      setSelectedId(loaded[0]!.id);
      setDraft(loaded[0]!);
    }

    const miningItemIds = uniqueSorted([
      ...loaded.flatMap((entry) => entry.knownResourceItemIds ?? []),
      ...loadMineLootTablesFromStorage().flatMap((table) => table.entries.map((entry) => entry.itemId)),
      ...loadMineBlockTablesFromStorage().flatMap((table) =>
        table.entries.flatMap((entry) =>
          (entry.payloads ?? []).map((payload) => payload.itemId).filter(Boolean) as string[],
        ),
      ),
      ...loadMiningToolsFromStorage().map((entry) => entry.itemId),
    ]);
    const miningMaterialIds = uniqueSorted([
      ...loaded.flatMap((entry) => entry.knownMaterialIds ?? []),
      ...loadMineBlockTablesFromStorage().flatMap((table) =>
        table.entries.flatMap((entry) =>
          (entry.payloads ?? []).map((payload) => payload.materialId).filter(Boolean) as string[],
        ),
      ),
    ]);

    void Promise.all([
      itemsService.getAll().then((items) => items.map((item) => item.id)),
      materialsService.getAll().then((materials) => materials.map((material) => material.id)),
    ])
      .then(([contentItemIds, contentMaterialIds]) => {
        setKnownItemIds(uniqueSorted([...miningItemIds, ...contentItemIds]));
        setKnownMaterialIds(uniqueSorted([...miningMaterialIds, ...contentMaterialIds]));
      })
      .catch(() => {
        setKnownItemIds(miningItemIds);
        setKnownMaterialIds(miningMaterialIds);
      });
  }, []);

  const knownDepthIds = useMemo(() => uniqueSorted([
    ...loadMineDepthsFromStorage().map((entry) => entry.id),
    ...mines.flatMap((entry) => entry.depthIds),
  ]), [mines]);

  const knownResourceNames = useMemo(() => uniqueSorted(
    mines.flatMap((entry) => entry.knownResources),
  ), [mines]);

  const selectedMine = useMemo(
    () => mines.find((entry) => entry.id === selectedId) ?? null,
    [mines, selectedId],
  );

  const backgroundUploadFolder = buildUploadFolder('images', 'mining', 'mines', draft.id || draft.name || undefined, 'background');

  function persist(next: MineDefinition[], nextStatus: string) {
    setMines(next);
    saveMinesToStorage(next);
    onSave?.(next);
    setStatus(nextStatus);
  }

  function beginCreate() {
    setSelectedId(null);
    setDraft(emptyMine());
  }

  function beginEdit(id: string) {
    const found = mines.find((entry) => entry.id === id);
    if (!found) {
      return;
    }
    setSelectedId(id);
    setDraft(found);
  }

  function saveDraft() {
    const normalized = normalizeMineDraft(draft);
    if (!normalized.id || !normalized.name || !normalized.description) {
      setStatus('Fill in id, mine name and description.');
      return;
    }

    if (selectedId) {
      if (selectedId !== normalized.id && mines.some((entry) => entry.id === normalized.id)) {
        setStatus(`A mine with id ${normalized.id} already exists.`);
        return;
      }
      const next = mines
        .filter((entry) => entry.id !== selectedId)
        .concat([{
          ...normalized,
          updatedAt: new Date().toISOString(),
          createdAt: selectedMine?.createdAt ?? new Date().toISOString(),
        }])
        .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
      setSelectedId(normalized.id);
      setDraft(normalized);
      persist(next, `Mine saved: ${normalized.name}`);
      return;
    }

    if (mines.some((entry) => entry.id === normalized.id)) {
      setStatus(`A mine with id ${normalized.id} already exists.`);
      return;
    }

    const entry = { ...normalized, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const next = [...mines, entry].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
    setSelectedId(entry.id);
    setDraft(entry);
    persist(next, `Mine created: ${entry.name}`);
  }

  function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm(`Delete mine ${selectedId}?`)) {
      return;
    }
    const next = mines.filter((entry) => entry.id !== selectedId);
    persist(next, `Mine deleted: ${selectedId}`);
    if (next.length > 0) {
      setSelectedId(next[0]!.id);
      setDraft(next[0]!);
    } else {
      beginCreate();
    }
  }

  function exportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_mines',
      collectionKey: 'mines',
      entries: mines,
    });
    setStatus(`Exported mines: ${mines.length}`);
  }

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <button onClick={beginCreate}>New mine</button>
          <button onClick={exportJson}>Export JSON</button>
        </div>
        <div className="admin-scroll-list">
          {mines.map((mine) => (
            <button
              key={mine.id}
              className={selectedId === mine.id ? 'is-active' : ''}
              onClick={() => beginEdit(mine.id)}
            >
              <strong>{mine.name}</strong>
              <span>{mine.id} | {mine.requiredMiningLevel}+ | {mine.dangerLevel}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Используется в open_mine и mineId." />
            <input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} placeholder="mine_teramor_old_iron" />
          </label>
          <label>
            <AdminFieldLabel label="Name" />
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Short description" />
            <input value={draft.shortDescription ?? ''} onChange={(event) => setDraft((current) => ({ ...current, shortDescription: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Region" />
            <input value={draft.region ?? ''} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Location ID" />
            <input value={draft.locationId ?? ''} onChange={(event) => setDraft((current) => ({ ...current, locationId: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Required Mining level" />
            <input type="number" min={1} value={draft.requiredMiningLevel} onChange={(event) => setDraft((current) => ({ ...current, requiredMiningLevel: Number(event.target.value) || 1 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Danger level" />
            <select value={draft.dangerLevel} onChange={(event) => setDraft((current) => ({ ...current, dangerLevel: event.target.value as MineDangerLevel }))}>
              {DANGER_LEVELS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Visual theme" />
            <select value={draft.visualTheme} onChange={(event) => setDraft((current) => ({ ...current, visualTheme: event.target.value as MineVisualTheme }))}>
              {VISUAL_THEMES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isEnabled} onChange={(event) => setDraft((current) => ({ ...current, isEnabled: event.target.checked }))} />
            <AdminFieldLabel label="Enabled" />
          </label>
        </div>

        <AdminImageField
          value={draft.backgroundImageUrl ?? ''}
          onChange={(nextValue) => setDraft((current) => ({ ...current, backgroundImageUrl: nextValue, backgroundImageAssetId: nextValue }))}
          onUploaded={(image) => setStatus(`Mine background uploaded to ${backgroundUploadFolder} as ${image.id} (${image.width}x${image.height}, PNG).`)}
          onStatus={setStatus}
          presetId="battle-map-background"
          suggestedId={draft.id ? `${draft.id}-background` : undefined}
          suggestedName={`${draft.id || draft.name || 'mine'}-background`}
          uploadFolder={backgroundUploadFolder}
          label="Mine background"
          hint="Always use upload. The file will be saved into the correct folder and resized to PNG 1920x1080."
        />

        <label>
          <AdminFieldLabel label="Description" />
          <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={4} />
        </label>

        <label>
          <AdminFieldLabel label="Entry text" />
          <textarea value={draft.entryText ?? ''} onChange={(event) => setDraft((current) => ({ ...current, entryText: event.target.value }))} rows={3} />
        </label>

        <label>
          <AdminFieldLabel label="Depth IDs" hint="Comma-separated. This defines the mine depth order." />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 320px)', gap: 8 }}>
            <input
              value={draft.depthIds.join(', ')}
              onChange={(event) => setDraft((current) => ({ ...current, depthIds: splitCsv(event.target.value) }))}
              placeholder="mine_teramor_old_iron_depth_1, mine_teramor_old_iron_depth_2"
            />
            <select
              defaultValue=""
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue) {
                  setDraft((current) => ({ ...current, depthIds: appendCsv(current.depthIds, nextValue) }));
                  event.currentTarget.value = '';
                }
              }}
            >
              <option value="">Добавить из созданных depth...</option>
              {knownDepthIds.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </div>
        </label>

        <label>
          <AdminFieldLabel label="Known resources" hint="Comma-separated. Shown to the player before entering." />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 320px)', gap: 8 }}>
            <input
              value={draft.knownResources.join(', ')}
              onChange={(event) => setDraft((current) => ({ ...current, knownResources: splitCsv(event.target.value) }))}
              placeholder="Камень, Железная руда, Золото"
            />
            <select
              defaultValue=""
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue) {
                  setDraft((current) => ({ ...current, knownResources: appendCsv(current.knownResources, nextValue) }));
                  event.currentTarget.value = '';
                }
              }}
            >
              <option value="">Добавить из созданных ресурсов...</option>
              {knownResourceNames.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </div>
        </label>

        <label>
          <AdminFieldLabel label="Known item IDs" hint="Comma-separated. For future links to real items." />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 320px)', gap: 8 }}>
            <input
              value={(draft.knownResourceItemIds ?? []).join(', ')}
              onChange={(event) => setDraft((current) => ({ ...current, knownResourceItemIds: splitCsv(event.target.value) }))}
              placeholder="item_raw_stone, item_iron_ore"
            />
            <select
              defaultValue=""
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue) {
                  setDraft((current) => ({ ...current, knownResourceItemIds: appendCsv(current.knownResourceItemIds ?? [], nextValue) }));
                  event.currentTarget.value = '';
                }
              }}
            >
              <option value="">Добавить из созданных предметов...</option>
              {knownItemIds.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </div>
        </label>

        <label>
          <AdminFieldLabel label="Known material IDs" hint="Comma-separated. For future links to materials." />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 320px)', gap: 8 }}>
            <input
              value={(draft.knownMaterialIds ?? []).join(', ')}
              onChange={(event) => setDraft((current) => ({ ...current, knownMaterialIds: splitCsv(event.target.value) }))}
              placeholder="material_stone, material_iron_ore"
            />
            <select
              defaultValue=""
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue) {
                  setDraft((current) => ({ ...current, knownMaterialIds: appendCsv(current.knownMaterialIds ?? [], nextValue) }));
                  event.currentTarget.value = '';
                }
              }}
            >
              <option value="">Добавить из созданных материалов...</option>
              {knownMaterialIds.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </div>
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
