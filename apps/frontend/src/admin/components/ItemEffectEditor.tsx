import type { ReactNode } from 'react';
import { canonicalCombatStatusId, KNOWN_STATUS_IDS } from '@theend/rpg-domain';
import type { ItemEffect } from '../../services/content/models';
import {
  ADMIN_DAMAGE_CATEGORIES,
  ADMIN_EFFECT_TRIGGERS,
  ADMIN_ELEMENT_TYPES,
  ADMIN_ITEM_EFFECT_TYPES,
  ADMIN_MAGIC_SCHOOLS,
  ADMIN_PHYSICAL_TYPES,
  ADMIN_STAT_KEYS,
  type ItemEffectJson,
  isKnownItemEffectType,
} from '../itemEffectConstants';
import {
  translateDamageCategory,
  translateElementType,
  translateMagicSchool,
  translatePhysicalType,
  translateStatKey,
} from '../adminUi';

function parseNumber(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCommaList(raw: string): string[] | undefined {
  const parsed = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry, index, arr) => entry.length > 0 && arr.indexOf(entry) === index);
  return parsed.length > 0 ? parsed : undefined;
}

function formatCommaList(value?: string[]): string {
  return Array.isArray(value) ? value.join(', ') : '';
}

function cloneEffect(effect: ItemEffectJson): ItemEffectJson {
  return { ...effect };
}

function normalizeStatusIdInput(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return canonicalCombatStatusId(trimmed) ?? trimmed;
}

function updateEffectAt(
  effects: ItemEffectJson[],
  index: number,
  patch: Partial<ItemEffectJson>,
  onChange: (next: ItemEffectJson[]) => void,
) {
  const next = effects.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
  onChange(next);
}

interface ItemEffectEditorProps {
  effects: ItemEffectJson[];
  onChange: (next: ItemEffectJson[]) => void;
  addLabel?: string;
}

export function ItemEffectEditor({ effects, onChange, addLabel = 'Добавить эффект' }: ItemEffectEditorProps) {
  function addEffect() {
    onChange([...effects, { type: 'stat_bonus', trigger: 'always' } as ItemEffectJson]);
  }

  function removeEffect(index: number) {
    onChange(effects.filter((_, i) => i !== index));
  }

  function applyRawJson(index: number, raw: string) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
        return;
      }
      const normalizedParsed = { ...parsed };
      if (typeof normalizedParsed.statusId === 'string') {
        normalizedParsed.statusId = normalizeStatusIdInput(normalizedParsed.statusId);
      }
      const prev = effects[index] ?? {};
      onChange(effects.map((entry, i) => (i === index ? { ...prev, ...normalizedParsed } as ItemEffectJson : entry)));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="admin-item-effect-editor">
      <div className="admin-actions-row">
        <button type="button" onClick={addEffect}>{addLabel}</button>
      </div>
      {effects.map((effect, index) => {
        const t = String(effect.type ?? '');
        if (!isKnownItemEffectType(t)) {
          return (
            <div key={`fx-${index}`} className="admin-form-grid card">
              <p className="muted">Неизвестный тип эффекта — правка через JSON (все поля сохраняются).</p>
              <label>
                <span>JSON эффекта</span>
                <textarea
                  rows={8}
                  defaultValue={JSON.stringify(effect, null, 2)}
                  onBlur={(event) => applyRawJson(index, event.target.value)}
                />
              </label>
              <button type="button" onClick={() => removeEffect(index)}>Удалить эффект</button>
            </div>
          );
        }

        const patch = (p: Partial<ItemEffectJson>) => updateEffectAt(effects, index, p, onChange);

        const commonTrigger = (
          <>
            <label>
              <span>Когда срабатывает</span>
              <select
                value={effect.trigger ?? ''}
                onChange={(event) => patch({ trigger: (event.target.value || undefined) as ItemEffect['trigger'] })}
              >
                <option value="">Не задан</option>
                {ADMIN_EFFECT_TRIGGERS.map((tr) => <option key={tr} value={tr}>{tr}</option>)}
              </select>
            </label>
            <label>
              <span>Контексты активации</span>
              <input
                value={formatCommaList(effect.activationContexts)}
                onChange={(event) => patch({ activationContexts: parseCommaList(event.target.value) })}
              />
            </label>
            <label>
              <span>Условие</span>
              <input value={effect.condition ?? ''} onChange={(event) => patch({ condition: event.target.value || undefined })} />
            </label>
          </>
        );

        const damageFilters = (
          <>
            <label>
              <span>Категория урона</span>
              <select
                value={effect.damageCategory ?? ''}
                onChange={(event) => patch({ damageCategory: (event.target.value || undefined) as ItemEffect['damageCategory'] })}
              >
                <option value="">Не задана</option>
                {ADMIN_DAMAGE_CATEGORIES.map((c) => <option key={c} value={c}>{translateDamageCategory(c)}</option>)}
              </select>
            </label>
            <label>
              <span>Физический тип</span>
              <select
                value={effect.physicalType ?? ''}
                onChange={(event) => patch({ physicalType: (event.target.value || undefined) as ItemEffect['physicalType'] })}
              >
                <option value="">Не задан</option>
                {ADMIN_PHYSICAL_TYPES.map((c) => <option key={c} value={c}>{translatePhysicalType(c)}</option>)}
              </select>
            </label>
            <label>
              <span>Стихия</span>
              <select
                value={effect.elementType ?? ''}
                onChange={(event) => patch({ elementType: (event.target.value || undefined) as ItemEffect['elementType'] })}
              >
                <option value="">Не задана</option>
                {ADMIN_ELEMENT_TYPES.map((c) => <option key={c} value={c}>{translateElementType(c)}</option>)}
              </select>
            </label>
            <label>
              <span>Школа магии</span>
              <select
                value={effect.magicSchool ?? ''}
                onChange={(event) => patch({ magicSchool: (event.target.value || undefined) as ItemEffect['magicSchool'] })}
              >
                <option value="">Не задана</option>
                {ADMIN_MAGIC_SCHOOLS.map((c) => <option key={c} value={c}>{translateMagicSchool(c)}</option>)}
              </select>
            </label>
          </>
        );

        let body: ReactNode = null;
        switch (effect.type) {
          case 'stat_bonus':
            body = (
              <>
                <label>
                  <span>Стат</span>
                  <select
                    value={effect.stat ?? ''}
                    onChange={(event) => patch({ stat: (event.target.value || undefined) as ItemEffect['stat'] })}
                  >
                    <option value="">Не задан</option>
                    {ADMIN_STAT_KEYS.map((s) => <option key={s} value={s}>{translateStatKey(s)}</option>)}
                  </select>
                </label>
                <label>
                  <span>Плоское значение</span>
                  <input type="number" value={effect.flat ?? ''} onChange={(event) => patch({ flat: parseNumber(event.target.value) })} />
                </label>
                <label>
                  <span>Процент</span>
                  <input type="number" value={effect.percent ?? ''} onChange={(event) => patch({ percent: parseNumber(event.target.value) })} />
                </label>
                <label>
                  <span>Значение (value)</span>
                  <input type="number" value={effect.value ?? ''} onChange={(event) => patch({ value: parseNumber(event.target.value) })} />
                </label>
                {commonTrigger}
              </>
            );
            break;
          case 'apply_status':
            body = (
              <>
                <label>
                  <span>Статус</span>
                  <input
                    list={`status-id-pick-${index}`}
                    value={effect.statusId ?? ''}
                    onChange={(event) => patch({ statusId: normalizeStatusIdInput(event.target.value) })}
                  />
                  <datalist id={`status-id-pick-${index}`}>
                    {KNOWN_STATUS_IDS.map((id) => <option key={id} value={id} />)}
                  </datalist>
                </label>
                <label>
                  <span>Шанс, %</span>
                  <input type="number" value={effect.chancePercent ?? ''} onChange={(event) => patch({ chancePercent: parseNumber(event.target.value) })} />
                </label>
                <label>
                  <span>Длительность, ходов</span>
                  <input type="number" value={effect.durationTurns ?? ''} onChange={(event) => patch({ durationTurns: parseNumber(event.target.value) })} />
                </label>
                {commonTrigger}
              </>
            );
            break;
          case 'status_resistance':
            body = (
              <>
                <label>
                  <span>Статус</span>
                  <input
                    list={`status-res-${index}`}
                    value={effect.statusId ?? ''}
                    onChange={(event) => patch({ statusId: normalizeStatusIdInput(event.target.value) })}
                  />
                  <datalist id={`status-res-${index}`}>
                    {KNOWN_STATUS_IDS.map((id) => <option key={id} value={id} />)}
                  </datalist>
                </label>
                <label>
                  <span>Плоское значение</span>
                  <input type="number" value={effect.flat ?? ''} onChange={(event) => patch({ flat: parseNumber(event.target.value) })} />
                </label>
                <label>
                  <span>Процент</span>
                  <input type="number" value={effect.percent ?? ''} onChange={(event) => patch({ percent: parseNumber(event.target.value) })} />
                </label>
                {commonTrigger}
              </>
            );
            break;
          case 'status_immunity':
            body = (
              <>
                <label>
                  <span>Статус</span>
                  <input
                    list={`status-im-${index}`}
                    value={effect.statusId ?? ''}
                    onChange={(event) => patch({ statusId: normalizeStatusIdInput(event.target.value) })}
                  />
                  <datalist id={`status-im-${index}`}>
                    {KNOWN_STATUS_IDS.map((id) => <option key={id} value={id} />)}
                  </datalist>
                </label>
                {commonTrigger}
              </>
            );
            break;
          case 'incoming_damage_modifier':
          case 'outgoing_damage_modifier':
          case 'armor_penetration':
            body = (
              <>
                {damageFilters}
                <label>
                  <span>Плоское значение</span>
                  <input type="number" value={effect.flat ?? ''} onChange={(event) => patch({ flat: parseNumber(event.target.value) })} />
                </label>
                <label>
                  <span>Процент</span>
                  <input type="number" value={effect.percent ?? ''} onChange={(event) => patch({ percent: parseNumber(event.target.value) })} />
                </label>
                {commonTrigger}
              </>
            );
            break;
          case 'crit_chance_modifier':
          case 'crit_damage_modifier':
          case 'crit_chance_taken_modifier':
          case 'block_chance_modifier':
          case 'dodge_chance_modifier':
          case 'hit_chance_modifier':
            body = (
              <>
                <label>
                  <span>Плоское значение</span>
                  <input type="number" value={effect.flat ?? ''} onChange={(event) => patch({ flat: parseNumber(event.target.value) })} />
                </label>
                <label>
                  <span>Процент</span>
                  <input type="number" value={effect.percent ?? ''} onChange={(event) => patch({ percent: parseNumber(event.target.value) })} />
                </label>
                {commonTrigger}
              </>
            );
            break;
          case 'lifesteal':
          case 'extra_attack_chance':
            body = (
              <>
                <label>
                  <span>Процент</span>
                  <input type="number" value={effect.percent ?? ''} onChange={(event) => patch({ percent: parseNumber(event.target.value) })} />
                </label>
                <label>
                  <span>Плоское значение</span>
                  <input type="number" value={effect.flat ?? ''} onChange={(event) => patch({ flat: parseNumber(event.target.value) })} />
                </label>
                {commonTrigger}
              </>
            );
            break;
          default:
            body = <p className="muted">Тип не поддержан визуально.</p>;
        }

        return (
          <div key={`fx-${index}`} className="admin-form-grid card">
            <label>
              <span>Тип эффекта</span>
              <select
                value={effect.type}
                onChange={(event) => {
                  const nextType = event.target.value;
                  const base = cloneEffect(effect);
                  base.type = nextType as ItemEffect['type'];
                  updateEffectAt(effects, index, base, onChange);
                }}
              >
                {ADMIN_ITEM_EFFECT_TYPES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </label>
            {body}
            <button type="button" onClick={() => removeEffect(index)}>Удалить эффект</button>
          </div>
        );
      })}
    </div>
  );
}
