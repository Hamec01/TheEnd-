import { AdminFieldLabel } from '../adminUi';

export type ReputationTargetType = 'kingdom' | 'faction';

export interface ReputationChangeEditorValue {
  targetType: ReputationTargetType;
  targetId: string;
  amount: number;
  reason?: string;
}

export const KINGDOM_REPUTATION_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'luminor', label: 'Луминор' },
  { id: 'artalon', label: 'Арталон' },
  { id: 'kriantar', label: 'Криантар' },
  { id: 'terimia', label: 'Теримия' },
  { id: 'argos', label: 'Аргос' },
];

interface ReputationChangesEditorProps {
  value: ReputationChangeEditorValue[];
  onChange: (next: ReputationChangeEditorValue[]) => void;
}

function withPatchedRow(
  rows: ReputationChangeEditorValue[],
  index: number,
  patch: Partial<ReputationChangeEditorValue>,
): ReputationChangeEditorValue[] {
  return rows.map((entry, entryIndex) => {
    if (entryIndex !== index) {
      return entry;
    }
    return { ...entry, ...patch };
  });
}

export function ReputationChangesEditor({ value, onChange }: ReputationChangesEditorProps) {
  function addRow() {
    onChange([
      ...value,
      {
        targetType: 'kingdom',
        targetId: KINGDOM_REPUTATION_OPTIONS[0]?.id ?? 'luminor',
        amount: 0,
        reason: '',
      },
    ]);
  }

  function removeRow(index: number) {
    onChange(value.filter((_, entryIndex) => entryIndex !== index));
  }

  return (
    <section className="card admin-item-preview reputation-editor-card">
      <h4>Репутация</h4>
      <p className="muted">Можно добавить несколько изменений: например +20 Арталону и -15 Аргосу.</p>
      <div className="admin-actions-row">
        <button type="button" onClick={addRow}>+ Добавить изменение репутации</button>
      </div>

      {value.map((entry, index) => {
        const amountClass = entry.amount > 0
          ? 'is-positive'
          : (entry.amount < 0 ? 'is-negative' : 'is-neutral');
        return (
          <div key={`rep-${index}`} className="admin-form-grid card reputation-editor-row">
            <label>
              <AdminFieldLabel label="Тип цели" hint="Выберите, меняется репутация королевства или фракции." />
              <select
                value={entry.targetType}
                onChange={(event) => {
                  const nextType = event.target.value as ReputationTargetType;
                  onChange(
                    withPatchedRow(value, index, {
                      targetType: nextType,
                      targetId: nextType === 'kingdom' ? (KINGDOM_REPUTATION_OPTIONS[0]?.id ?? 'luminor') : '',
                    }),
                  );
                }}
              >
                <option value="kingdom">Королевство</option>
                <option value="faction">Фракция</option>
              </select>
            </label>

            <label>
              <AdminFieldLabel label="Кому изменить" hint="ID королевства или фракции." />
              {entry.targetType === 'kingdom' ? (
                <select
                  value={entry.targetId}
                  onChange={(event) => onChange(withPatchedRow(value, index, { targetId: event.target.value }))}
                >
                  {KINGDOM_REPUTATION_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              ) : (
                <input
                  value={entry.targetId}
                  placeholder="faction_id"
                  onChange={(event) => onChange(withPatchedRow(value, index, { targetId: event.target.value }))}
                />
              )}
            </label>

            <label>
              <AdminFieldLabel label="Сколько репутации" hint="Можно указать положительное или отрицательное значение." />
              <input
                className={`reputation-amount-input ${amountClass}`}
                type="number"
                value={Number.isFinite(entry.amount) ? entry.amount : 0}
                onChange={(event) => onChange(withPatchedRow(value, index, { amount: Number(event.target.value) }))}
              />
            </label>

            <label>
              <AdminFieldLabel label="Причина" hint="Необязательное пояснение для контент-команды." />
              <input
                value={entry.reason ?? ''}
                onChange={(event) => onChange(withPatchedRow(value, index, { reason: event.target.value || undefined }))}
              />
            </label>

            <div className="admin-actions-row">
              <button type="button" onClick={() => removeRow(index)}>Удалить</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
