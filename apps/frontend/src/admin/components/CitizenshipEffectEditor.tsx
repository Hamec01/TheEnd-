import { AdminFieldLabel } from '../adminUi';
import { KINGDOM_REPUTATION_OPTIONS } from './ReputationChangesEditor';

export interface CitizenshipEffectEditorValue {
  kingdomId: 'luminor' | 'artalon' | 'kriantar' | 'terimia' | 'argos';
  oldKingdomPenalty?: number;
  newKingdomBonus?: number;
  requireAuthorityNpc?: boolean;
}

interface CitizenshipEffectEditorProps {
  value: CitizenshipEffectEditorValue | null;
  onChange: (next: CitizenshipEffectEditorValue | null) => void;
}

const DEFAULT_CITIZENSHIP_EFFECT: CitizenshipEffectEditorValue = {
  kingdomId: 'luminor',
  oldKingdomPenalty: -50,
  newKingdomBonus: 20,
  requireAuthorityNpc: true,
};

export function CitizenshipEffectEditor({ value, onChange }: CitizenshipEffectEditorProps) {
  const enabled = value !== null;
  const current = value ?? DEFAULT_CITIZENSHIP_EFFECT;

  return (
    <section className="card admin-item-preview citizenship-editor-card">
      <h4>Подданство</h4>

      <label className="zone-editor-checkbox">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onChange(event.target.checked ? { ...DEFAULT_CITIZENSHIP_EFFECT } : null)}
        />
        <AdminFieldLabel label="Сменить подданство" hint="Включает/выключает citizenship-эффект для этой сущности." />
      </label>

      {enabled ? (
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="Королевство" hint="Королевство, чье подданство получает игрок." />
            <select
              value={current.kingdomId}
              onChange={(event) => {
                onChange({
                  ...current,
                  kingdomId: event.target.value as CitizenshipEffectEditorValue['kingdomId'],
                });
              }}
            >
              {KINGDOM_REPUTATION_OPTIONS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label>

          <label>
            <AdminFieldLabel label="Штраф старому королевству" hint="Обычно отрицательное значение, по умолчанию -50." />
            <input
              type="number"
              value={Number.isFinite(current.oldKingdomPenalty) ? current.oldKingdomPenalty : -50}
              onChange={(event) => onChange({ ...current, oldKingdomPenalty: Number(event.target.value) })}
            />
          </label>

          <label>
            <AdminFieldLabel label="Бонус новому королевству" hint="Обычно положительное значение, по умолчанию +20." />
            <input
              type="number"
              value={Number.isFinite(current.newKingdomBonus) ? current.newKingdomBonus : 20}
              onChange={(event) => onChange({ ...current, newKingdomBonus: Number(event.target.value) })}
            />
          </label>

          <label className="zone-editor-checkbox">
            <input
              type="checkbox"
              checked={current.requireAuthorityNpc === true}
              onChange={(event) => onChange({ ...current, requireAuthorityNpc: event.target.checked })}
            />
            <AdminFieldLabel label="Только через правителя / уполномоченного NPC" hint="Маркер лор-ограничения для контент-модерации." />
          </label>
        </div>
      ) : null}

      <p className="muted">Подданство не должно выдаваться случайным NPC. По лору это делает король, совет, правитель города или официальный представитель королевства.</p>
    </section>
  );
}
