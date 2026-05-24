import { useEffect, useMemo, useState } from 'react';
import { AdminImageField } from '../AdminImageField';
import type { MineDepth } from '../../types/mining';
import { downloadCollectionJson } from '../../services/content/adminJsonImportExport';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import {
  loadMineDepthsFromStorage,
  loadMinesFromStorage,
  saveMineDepthsToStorage,
} from '../../services/miningRepository';
import { AdminFieldLabel } from '../adminUi';

interface MineDepthEditorProps {
  onSave?: (depths: MineDepth[]) => void;
}

function emptyDepth(defaultMineId = ''): MineDepth {
  return {
    id: '',
    mineId: defaultMineId,
    depthLevel: 1,
    name: '',
    description: '',
    rows: 4,
    columns: 6,
    baseHits: 13,
    staminaCostPerHit: 2,
    baseCollapseRisk: 0.03,
    riskIncreasePerHit: 0.005,
    lootTableId: '',
    blockTableId: '',
    hazardTableId: '',
    guaranteedExit: true,
    canSpawnPassage: true,
    isFinalDepth: false,
    requiredMiningLevel: 1,
    backgroundImage: '',
    blockSpriteAssetId: '',
    blockSpriteUrl: '',
    blockCrackSpriteAssetId: '',
    blockCrackSpriteUrl: '',
    blockBreakSpriteSheetAssetId: '',
    blockBreakSpriteSheetUrl: '',
    particleTextureAssetId: '',
    particleTextureUrl: '',
    isEnabled: true,
  };
}

export function MineDepthEditor({ onSave }: MineDepthEditorProps) {
  const [depths, setDepths] = useState<MineDepth[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMineId, setSelectedMineId] = useState<string>('');
  const [draft, setDraft] = useState<MineDepth>(emptyDepth());
  const [status, setStatus] = useState('Ready');
  const mines = useMemo(() => loadMinesFromStorage(), []);

  useEffect(() => {
    const loaded = loadMineDepthsFromStorage();
    setDepths(loaded);
    const firstMineId = loaded[0]?.mineId ?? mines[0]?.id ?? '';
    setSelectedMineId(firstMineId);
    if (loaded.length > 0) {
      setSelectedId(loaded[0]!.id);
      setDraft(loaded[0]!);
    } else {
      setDraft(emptyDepth(firstMineId));
    }
  }, [mines]);

  const filteredDepths = useMemo(
    () => depths
      .filter((entry) => !selectedMineId || entry.mineId === selectedMineId)
      .sort((left, right) => left.depthLevel - right.depthLevel),
    [depths, selectedMineId],
  );

  const baseFolder = buildUploadFolder('images', 'mining', 'depths', draft.id || draft.name || undefined);
  const backgroundFolder = buildUploadFolder(baseFolder, 'background');
  const blockFolder = buildUploadFolder(baseFolder, 'blocks');
  const crackFolder = buildUploadFolder(baseFolder, 'cracks');
  const breakFolder = buildUploadFolder(baseFolder, 'break');
  const particleFolder = buildUploadFolder(baseFolder, 'particles');

  function persist(next: MineDepth[], nextStatus: string) {
    setDepths(next);
    saveMineDepthsToStorage(next);
    onSave?.(next);
    setStatus(nextStatus);
  }

  function startNew() {
    setSelectedId(null);
    setDraft(emptyDepth(selectedMineId || mines[0]?.id || ''));
  }

  function selectDepth(id: string) {
    const found = depths.find((entry) => entry.id === id);
    if (!found) {
      return;
    }
    setSelectedId(id);
    setSelectedMineId(found.mineId);
    setDraft(found);
  }

  function saveDraft() {
    const normalized: MineDepth = {
      ...draft,
      id: draft.id.trim(),
      mineId: draft.mineId.trim(),
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      lootTableId: draft.lootTableId.trim(),
      blockTableId: draft.blockTableId.trim(),
      hazardTableId: draft.hazardTableId.trim(),
      backgroundImage: draft.backgroundImage?.trim() || undefined,
      blockSpriteAssetId: draft.blockSpriteAssetId?.trim() || undefined,
      blockSpriteUrl: draft.blockSpriteUrl?.trim() || undefined,
      blockCrackSpriteAssetId: draft.blockCrackSpriteAssetId?.trim() || undefined,
      blockCrackSpriteUrl: draft.blockCrackSpriteUrl?.trim() || undefined,
      blockBreakSpriteSheetAssetId: draft.blockBreakSpriteSheetAssetId?.trim() || undefined,
      blockBreakSpriteSheetUrl: draft.blockBreakSpriteSheetUrl?.trim() || undefined,
      particleTextureAssetId: draft.particleTextureAssetId?.trim() || undefined,
      particleTextureUrl: draft.particleTextureUrl?.trim() || undefined,
      depthLevel: Math.max(1, Math.floor(Number(draft.depthLevel || 1))),
      rows: Math.max(1, Math.floor(Number(draft.rows || 1))),
      columns: Math.max(1, Math.floor(Number(draft.columns || 1))),
      baseHits: Math.max(1, Math.floor(Number(draft.baseHits || 1))),
      staminaCostPerHit: Math.max(0, Math.floor(Number(draft.staminaCostPerHit || 0))),
      baseCollapseRisk: Math.max(0, Number(draft.baseCollapseRisk || 0)),
      riskIncreasePerHit: Math.max(0, Number(draft.riskIncreasePerHit || 0)),
      requiredMiningLevel: Math.max(1, Math.floor(Number(draft.requiredMiningLevel || 1))),
    };

    if (!normalized.id || !normalized.mineId || !normalized.name || !normalized.lootTableId || !normalized.blockTableId || !normalized.hazardTableId) {
      setStatus('Fill in id, mine, name and all linked tables.');
      return;
    }

    if (selectedId) {
      if (selectedId !== normalized.id && depths.some((entry) => entry.id === normalized.id)) {
        setStatus(`A depth with id ${normalized.id} already exists.`);
        return;
      }
      const next = depths.filter((entry) => entry.id !== selectedId).concat([normalized]);
      setSelectedId(normalized.id);
      setDraft(normalized);
      persist(next, `Depth saved: ${normalized.name}`);
      return;
    }

    if (depths.some((entry) => entry.id === normalized.id)) {
      setStatus(`A depth with id ${normalized.id} already exists.`);
      return;
    }
    const next = [...depths, normalized];
    setSelectedId(normalized.id);
    setDraft(normalized);
    persist(next, `Depth created: ${normalized.name}`);
  }

  function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm(`Delete depth ${selectedId}?`)) {
      return;
    }
    const next = depths.filter((entry) => entry.id !== selectedId);
    persist(next, `Depth deleted: ${selectedId}`);
    if (next.length > 0) {
      selectDepth(next[0]!.id);
    } else {
      startNew();
    }
  }

  function exportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_mine_depths',
      collectionKey: 'mineDepths',
      entries: depths,
    });
    setStatus(`Exported depths: ${depths.length}`);
  }

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <button onClick={startNew}>New depth</button>
          <button onClick={exportJson}>Export JSON</button>
        </div>
        <label>
          <AdminFieldLabel label="Mine" />
          <select value={selectedMineId} onChange={(event) => setSelectedMineId(event.target.value)}>
            <option value="">All mines</option>
            {mines.map((mine) => <option key={mine.id} value={mine.id}>{mine.name}</option>)}
          </select>
        </label>
        <div className="admin-scroll-list">
          {filteredDepths.map((depth) => (
            <button key={depth.id} className={selectedId === depth.id ? 'is-active' : ''} onClick={() => selectDepth(depth.id)}>
              <strong>{depth.name || `Depth ${depth.depthLevel}`}</strong>
              <span>{depth.id} | {depth.rows}x{depth.columns} | hits {depth.baseHits}</span>
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
            <AdminFieldLabel label="Mine" />
            <select value={draft.mineId} onChange={(event) => setDraft((current) => ({ ...current, mineId: event.target.value }))}>
              <option value="">Choose mine</option>
              {mines.map((mine) => <option key={mine.id} value={mine.id}>{mine.name}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Name" />
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Depth level" />
            <input type="number" min={1} value={draft.depthLevel} onChange={(event) => setDraft((current) => ({ ...current, depthLevel: Number(event.target.value) || 1 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Rows" />
            <input type="number" min={1} value={draft.rows} onChange={(event) => setDraft((current) => ({ ...current, rows: Number(event.target.value) || 1 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Columns" />
            <input type="number" min={1} value={draft.columns} onChange={(event) => setDraft((current) => ({ ...current, columns: Number(event.target.value) || 1 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Base hits" />
            <input type="number" min={1} value={draft.baseHits} onChange={(event) => setDraft((current) => ({ ...current, baseHits: Number(event.target.value) || 1 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Stamina per hit" />
            <input type="number" min={0} value={draft.staminaCostPerHit} onChange={(event) => setDraft((current) => ({ ...current, staminaCostPerHit: Number(event.target.value) || 0 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Base collapse risk" />
            <input type="number" min={0} step="0.001" value={draft.baseCollapseRisk} onChange={(event) => setDraft((current) => ({ ...current, baseCollapseRisk: Number(event.target.value) || 0 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Risk increase per hit" />
            <input type="number" min={0} step="0.001" value={draft.riskIncreasePerHit} onChange={(event) => setDraft((current) => ({ ...current, riskIncreasePerHit: Number(event.target.value) || 0 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Loot table" />
            <input value={draft.lootTableId} onChange={(event) => setDraft((current) => ({ ...current, lootTableId: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Block table" />
            <input value={draft.blockTableId} onChange={(event) => setDraft((current) => ({ ...current, blockTableId: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Hazard table" />
            <input value={draft.hazardTableId} onChange={(event) => setDraft((current) => ({ ...current, hazardTableId: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Required Mining level" />
            <input type="number" min={1} value={draft.requiredMiningLevel} onChange={(event) => setDraft((current) => ({ ...current, requiredMiningLevel: Number(event.target.value) || 1 }))} />
          </label>
        </div>

        <label>
          <AdminFieldLabel label="Description" />
          <textarea value={draft.description ?? ''} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} />
        </label>

        <AdminImageField
          value={draft.backgroundImage ?? ''}
          onChange={(nextValue) => setDraft((current) => ({ ...current, backgroundImage: nextValue }))}
          onUploaded={(image) => setStatus(`Legacy depth background uploaded to ${backgroundFolder} as ${image.id} (${image.width}x${image.height}, PNG).`)}
          onStatus={setStatus}
          presetId="battle-map-background"
          suggestedId={draft.id ? `${draft.id}-background` : undefined}
          suggestedName={`${draft.id || draft.name || 'depth'}-background`}
          uploadFolder={backgroundFolder}
          label="Legacy background depth image"
          hint="Only needed as a fallback. The main background should now be set on the mine."
        />

        <AdminImageField
          value={draft.blockSpriteUrl ?? ''}
          onChange={(nextValue) => setDraft((current) => ({ ...current, blockSpriteUrl: nextValue, blockSpriteAssetId: nextValue }))}
          onUploaded={(image) => setStatus(`Block sprite uploaded to ${blockFolder} as ${image.id} (${image.width}x${image.height}, PNG).`)}
          onStatus={setStatus}
          presetId="mining-block"
          suggestedId={draft.id ? `${draft.id}-block` : undefined}
          suggestedName={`${draft.id || draft.name || 'depth'}-block`}
          uploadFolder={blockFolder}
          label="Block sprite"
          hint="Use upload. The image will be resized to PNG 256x256."
        />

        <AdminImageField
          value={draft.blockCrackSpriteUrl ?? ''}
          onChange={(nextValue) => setDraft((current) => ({ ...current, blockCrackSpriteUrl: nextValue, blockCrackSpriteAssetId: nextValue }))}
          onUploaded={(image) => setStatus(`Crack sprite uploaded to ${crackFolder} as ${image.id} (${image.width}x${image.height}, PNG).`)}
          onStatus={setStatus}
          presetId="mining-block"
          suggestedId={draft.id ? `${draft.id}-crack` : undefined}
          suggestedName={`${draft.id || draft.name || 'depth'}-crack`}
          uploadFolder={crackFolder}
          label="Crack sprite"
          hint="Rendered over the block when it is hit."
        />

        <AdminImageField
          value={draft.blockBreakSpriteSheetUrl ?? ''}
          onChange={(nextValue) => setDraft((current) => ({ ...current, blockBreakSpriteSheetUrl: nextValue, blockBreakSpriteSheetAssetId: nextValue }))}
          onUploaded={(image) => setStatus(`Break spritesheet uploaded to ${breakFolder} as ${image.id} (${image.width}x${image.height}, PNG).`)}
          onStatus={setStatus}
          presetId="mining-block"
          suggestedId={draft.id ? `${draft.id}-break` : undefined}
          suggestedName={`${draft.id || draft.name || 'depth'}-break`}
          uploadFolder={breakFolder}
          label="Break spritesheet"
          hint="For the first version a regular PNG placeholder of the same size is fine."
        />

        <AdminImageField
          value={draft.particleTextureUrl ?? ''}
          onChange={(nextValue) => setDraft((current) => ({ ...current, particleTextureUrl: nextValue, particleTextureAssetId: nextValue }))}
          onUploaded={(image) => setStatus(`Particle texture uploaded to ${particleFolder} as ${image.id} (${image.width}x${image.height}, PNG).`)}
          onStatus={setStatus}
          presetId="mining-block"
          suggestedId={draft.id ? `${draft.id}-particle` : undefined}
          suggestedName={`${draft.id || draft.name || 'depth'}-particle`}
          uploadFolder={particleFolder}
          label="Particle texture"
          hint="Leave empty if you do not have a dedicated particle texture yet."
        />

        <div className="admin-form-grid">
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.guaranteedExit} onChange={(event) => setDraft((current) => ({ ...current, guaranteedExit: event.target.checked }))} />
            <AdminFieldLabel label="Guaranteed exit" />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.canSpawnPassage} onChange={(event) => setDraft((current) => ({ ...current, canSpawnPassage: event.target.checked }))} />
            <AdminFieldLabel label="Can spawn passage" />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isFinalDepth} onChange={(event) => setDraft((current) => ({ ...current, isFinalDepth: event.target.checked }))} />
            <AdminFieldLabel label="Final depth" />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isEnabled} onChange={(event) => setDraft((current) => ({ ...current, isEnabled: event.target.checked }))} />
            <AdminFieldLabel label="Enabled" />
          </label>
        </div>

        <div className="admin-actions-row">
          <button onClick={saveDraft}>{selectedId ? 'Save' : 'Create'}</button>
          <button disabled={!selectedId} onClick={deleteSelected}>Delete</button>
        </div>
        <p className="muted">{status}</p>
      </section>
    </div>
  );
}
