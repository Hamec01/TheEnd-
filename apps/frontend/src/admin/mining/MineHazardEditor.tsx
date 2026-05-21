import { useEffect, useState } from 'react';
import type { MineHazard, MineHazardType } from '../../types/mining';
import { downloadCollectionJson } from '../../services/content/adminJsonImportExport';
import { loadMineHazardsFromStorage, saveMineHazardsToStorage } from '../../services/miningRepository';
import { MINING_HAZARD_TYPES } from '../../services/miningSkillValidation';
import { AdminFieldLabel } from '../adminUi';

const HAZARD_TYPES: MineHazardType[] = MINING_HAZARD_TYPES;

interface MineHazardEditorProps {
  onSave?: (hazards: MineHazard[]) => void;
}

function emptyHazard(): MineHazard {
  return {
    id: '',
    name: '',
    type: 'minor_collapse',
    description: '',
    hpDamageMin: 0,
    hpDamageMax: 0,
    staminaDamageMin: 0,
    staminaDamageMax: 0,
    lootLossChance: 0,
    lootLossPercent: 0,
    statusEffectIds: [],
    canBeReducedByConstitution: true,
    canBeDodgedByDexterity: false,
    isDeadly: false,
    isEnabled: true,
  };
}

export function MineHazardEditor({ onSave }: MineHazardEditorProps) {
  const [hazards, setHazards] = useState<MineHazard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MineHazard>(emptyHazard());
  const [status, setStatus] = useState('Готово');

  useEffect(() => {
    const loaded = loadMineHazardsFromStorage();
    setHazards(loaded);
    if (loaded.length > 0) {
      setSelectedId(loaded[0]!.id);
      setDraft(loaded[0]!);
    }
  }, []);

  function persist(next: MineHazard[], nextStatus: string) {
    setHazards(next);
    saveMineHazardsToStorage(next);
    onSave?.(next);
    setStatus(nextStatus);
  }

  function startNew() {
    setSelectedId(null);
    setDraft(emptyHazard());
  }

  function selectHazard(id: string) {
    const found = hazards.find((entry) => entry.id === id);
    if (!found) {
      return;
    }
    setSelectedId(id);
    setDraft(found);
  }

  function saveDraft() {
    const normalized: MineHazard = {
      ...draft,
      id: draft.id.trim(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      statusEffectIds: (draft.statusEffectIds ?? []).map((entry) => entry.trim()).filter(Boolean),
      hpDamageMin: Math.max(0, Math.floor(Number(draft.hpDamageMin || 0))),
      hpDamageMax: Math.max(0, Math.floor(Number(draft.hpDamageMax || 0))),
      staminaDamageMin: Math.max(0, Math.floor(Number(draft.staminaDamageMin || 0))),
      staminaDamageMax: Math.max(0, Math.floor(Number(draft.staminaDamageMax || 0))),
      lootLossChance: Math.max(0, Number(draft.lootLossChance || 0)),
      lootLossPercent: Math.max(0, Number(draft.lootLossPercent || 0)),
    };
    if (!normalized.id || !normalized.name || !normalized.description) {
      setStatus('Заполните id, название и описание опасности.');
      return;
    }

    if (selectedId) {
      if (selectedId !== normalized.id && hazards.some((entry) => entry.id === normalized.id)) {
        setStatus(`Опасность с id ${normalized.id} уже существует.`);
        return;
      }
      const next = hazards.filter((entry) => entry.id !== selectedId).concat([normalized]);
      setSelectedId(normalized.id);
      persist(next, `Опасность сохранена: ${normalized.name}`);
      return;
    }

    if (hazards.some((entry) => entry.id === normalized.id)) {
      setStatus(`Опасность с id ${normalized.id} уже существует.`);
      return;
    }
    const next = [...hazards, normalized];
    setSelectedId(normalized.id);
    persist(next, `Опасность создана: ${normalized.name}`);
  }

  function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm(`Удалить опасность ${selectedId}?`)) {
      return;
    }
    const next = hazards.filter((entry) => entry.id !== selectedId);
    persist(next, `Опасность удалена: ${selectedId}`);
    startNew();
  }

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <button onClick={startNew}>Новая опасность</button>
          <button onClick={() => {
            downloadCollectionJson({ filePrefix: 'theend_mine_hazards', collectionKey: 'mineHazards', entries: hazards });
            setStatus(`Экспортировано опасностей: ${hazards.length}`);
          }}
          >
            Экспорт JSON
          </button>
        </div>
        <div className="admin-scroll-list">
          {hazards.map((hazard) => (
            <button key={hazard.id} className={selectedId === hazard.id ? 'is-active' : ''} onClick={() => selectHazard(hazard.id)}>
              <strong>{hazard.name}</strong>
              <span>{hazard.id} | {hazard.type}</span>
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
            <AdminFieldLabel label="Название" />
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Тип" />
            <select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as MineHazardType }))}>
              {HAZARD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isEnabled} onChange={(event) => setDraft((current) => ({ ...current, isEnabled: event.target.checked }))} />
            <AdminFieldLabel label="Включена" />
          </label>
        </div>

        <label>
          <AdminFieldLabel label="Описание" />
          <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} />
        </label>

        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="HP min" />
            <input type="number" min={0} value={draft.hpDamageMin} onChange={(event) => setDraft((current) => ({ ...current, hpDamageMin: Number(event.target.value) || 0 }))} />
          </label>
          <label>
            <AdminFieldLabel label="HP max" />
            <input type="number" min={0} value={draft.hpDamageMax} onChange={(event) => setDraft((current) => ({ ...current, hpDamageMax: Number(event.target.value) || 0 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Stamina min" />
            <input type="number" min={0} value={draft.staminaDamageMin} onChange={(event) => setDraft((current) => ({ ...current, staminaDamageMin: Number(event.target.value) || 0 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Stamina max" />
            <input type="number" min={0} value={draft.staminaDamageMax} onChange={(event) => setDraft((current) => ({ ...current, staminaDamageMax: Number(event.target.value) || 0 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Шанс потери добычи" />
            <input type="number" min={0} max={1} step="0.01" value={draft.lootLossChance} onChange={(event) => setDraft((current) => ({ ...current, lootLossChance: Number(event.target.value) || 0 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Процент потери добычи" />
            <input type="number" min={0} max={1} step="0.01" value={draft.lootLossPercent} onChange={(event) => setDraft((current) => ({ ...current, lootLossPercent: Number(event.target.value) || 0 }))} />
          </label>
        </div>

        <label>
          <AdminFieldLabel label="Status effects" hint="Через запятую." />
          <input value={(draft.statusEffectIds ?? []).join(', ')} onChange={(event) => setDraft((current) => ({ ...current, statusEffectIds: event.target.value.split(',') }))} />
        </label>

        <div className="admin-form-grid">
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.canBeReducedByConstitution} onChange={(event) => setDraft((current) => ({ ...current, canBeReducedByConstitution: event.target.checked }))} />
            <AdminFieldLabel label="Снижается телосложением" />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.canBeDodgedByDexterity} onChange={(event) => setDraft((current) => ({ ...current, canBeDodgedByDexterity: event.target.checked }))} />
            <AdminFieldLabel label="Можно увернуться ловкостью" />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isDeadly} onChange={(event) => setDraft((current) => ({ ...current, isDeadly: event.target.checked }))} />
            <AdminFieldLabel label="Смертельная" />
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
