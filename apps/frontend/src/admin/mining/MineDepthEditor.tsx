import { useEffect, useMemo, useState } from 'react';
import type { MineDepth } from '../../types/mining';
import { downloadCollectionJson } from '../../services/content/adminJsonImportExport';
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
    isEnabled: true,
  };
}

export function MineDepthEditor({ onSave }: MineDepthEditorProps) {
  const [depths, setDepths] = useState<MineDepth[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMineId, setSelectedMineId] = useState<string>('');
  const [draft, setDraft] = useState<MineDepth>(emptyDepth());
  const [status, setStatus] = useState('Готово');
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
      setStatus('Заполните id, шахту, название и все связанные таблицы.');
      return;
    }

    if (selectedId) {
      if (selectedId !== normalized.id && depths.some((entry) => entry.id === normalized.id)) {
        setStatus(`Глубина с id ${normalized.id} уже существует.`);
        return;
      }
      const next = depths.filter((entry) => entry.id !== selectedId).concat([normalized]);
      setSelectedId(normalized.id);
      persist(next, `Глубина сохранена: ${normalized.name}`);
      return;
    }

    if (depths.some((entry) => entry.id === normalized.id)) {
      setStatus(`Глубина с id ${normalized.id} уже существует.`);
      return;
    }
    const next = [...depths, normalized];
    setSelectedId(normalized.id);
    persist(next, `Глубина создана: ${normalized.name}`);
  }

  function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm(`Удалить глубину ${selectedId}?`)) {
      return;
    }
    const next = depths.filter((entry) => entry.id !== selectedId);
    persist(next, `Глубина удалена: ${selectedId}`);
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
    setStatus(`Экспортировано глубин: ${depths.length}`);
  }

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <button onClick={startNew}>Новая глубина</button>
          <button onClick={exportJson}>Экспорт JSON</button>
        </div>
        <label>
          <AdminFieldLabel label="Шахта" />
          <select value={selectedMineId} onChange={(event) => setSelectedMineId(event.target.value)}>
            <option value="">Все шахты</option>
            {mines.map((mine) => <option key={mine.id} value={mine.id}>{mine.name}</option>)}
          </select>
        </label>
        <div className="admin-scroll-list">
          {filteredDepths.map((depth) => (
            <button key={depth.id} className={selectedId === depth.id ? 'is-active' : ''} onClick={() => selectDepth(depth.id)}>
              <strong>{depth.name || `Глубина ${depth.depthLevel}`}</strong>
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
            <AdminFieldLabel label="Шахта" />
            <select value={draft.mineId} onChange={(event) => setDraft((current) => ({ ...current, mineId: event.target.value }))}>
              <option value="">Выберите шахту</option>
              {mines.map((mine) => <option key={mine.id} value={mine.id}>{mine.name}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Название" />
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Уровень глубины" />
            <input type="number" min={1} value={draft.depthLevel} onChange={(event) => setDraft((current) => ({ ...current, depthLevel: Number(event.target.value) || 1 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Строк" />
            <input type="number" min={1} value={draft.rows} onChange={(event) => setDraft((current) => ({ ...current, rows: Number(event.target.value) || 1 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Столбцов" />
            <input type="number" min={1} value={draft.columns} onChange={(event) => setDraft((current) => ({ ...current, columns: Number(event.target.value) || 1 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Базовые хиты" />
            <input type="number" min={1} value={draft.baseHits} onChange={(event) => setDraft((current) => ({ ...current, baseHits: Number(event.target.value) || 1 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Выносливость за удар" />
            <input type="number" min={0} value={draft.staminaCostPerHit} onChange={(event) => setDraft((current) => ({ ...current, staminaCostPerHit: Number(event.target.value) || 0 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Базовый риск обвала" />
            <input type="number" min={0} step="0.001" value={draft.baseCollapseRisk} onChange={(event) => setDraft((current) => ({ ...current, baseCollapseRisk: Number(event.target.value) || 0 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Рост риска за удар" />
            <input type="number" min={0} step="0.001" value={draft.riskIncreasePerHit} onChange={(event) => setDraft((current) => ({ ...current, riskIncreasePerHit: Number(event.target.value) || 0 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Таблица добычи" />
            <input value={draft.lootTableId} onChange={(event) => setDraft((current) => ({ ...current, lootTableId: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Таблица блоков" />
            <input value={draft.blockTableId} onChange={(event) => setDraft((current) => ({ ...current, blockTableId: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Таблица опасностей" />
            <input value={draft.hazardTableId} onChange={(event) => setDraft((current) => ({ ...current, hazardTableId: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Требуемый уровень Горняка" />
            <input type="number" min={1} value={draft.requiredMiningLevel} onChange={(event) => setDraft((current) => ({ ...current, requiredMiningLevel: Number(event.target.value) || 1 }))} />
          </label>
        </div>

        <label>
          <AdminFieldLabel label="Описание" />
          <textarea value={draft.description ?? ''} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} />
        </label>

        <label>
          <AdminFieldLabel label="Background image" />
          <input value={draft.backgroundImage ?? ''} onChange={(event) => setDraft((current) => ({ ...current, backgroundImage: event.target.value }))} />
        </label>

        <div className="admin-form-grid">
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.guaranteedExit} onChange={(event) => setDraft((current) => ({ ...current, guaranteedExit: event.target.checked }))} />
            <AdminFieldLabel label="Гарантированный выход" />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.canSpawnPassage} onChange={(event) => setDraft((current) => ({ ...current, canSpawnPassage: event.target.checked }))} />
            <AdminFieldLabel label="Может появиться проход" />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isFinalDepth} onChange={(event) => setDraft((current) => ({ ...current, isFinalDepth: event.target.checked }))} />
            <AdminFieldLabel label="Финальная глубина" />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isEnabled} onChange={(event) => setDraft((current) => ({ ...current, isEnabled: event.target.checked }))} />
            <AdminFieldLabel label="Включена" />
          </label>
        </div>

        <div className="admin-actions-row">
          <button onClick={saveDraft}>{selectedId ? 'Сохранить' : 'Создать'}</button>
          <button disabled={!selectedId} onClick={deleteSelected}>Удалить</button>
        </div>
        <p className="muted">{status}</p>
      </section>
    </div>
  );
}
