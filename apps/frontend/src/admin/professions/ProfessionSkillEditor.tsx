import React, { useEffect, useMemo, useState } from 'react';
import { AdminImageField } from '../AdminImageField';
import { AdminFieldLabel } from '../adminUi';
import {
  getProfessionSkillsByProfessionId,
  loadProfessionSkillsFromStorage,
  resetProfessionSkillsToDefaults,
  saveProfessionSkillsToStorage,
} from '../../services/professionSkillRepository';
import { loadProfessionBranchesFromStorage } from '../../services/professionBranchRepository';
import { validateMiningSkillConnectivity } from '../../services/miningSkillValidation';
import type {
  MiningSkillEffectType,
  ProfessionSkill,
  ProfessionSkillEffect,
  ProfessionSkillEffectCondition,
  ProfessionSkillEffectValueType,
} from '../../types/profession';

interface ProfessionSkillEditorProps {
  professions?: Array<{ id: string; name: string }>;
  filterByProfession?: string;
  onSave?: (skills: ProfessionSkill[]) => void;
}

const VALUE_TYPES: ProfessionSkillEffectValueType[] = ['flat', 'percent', 'boolean'];

const MINING_EFFECT_LABELS: Record<string, string> = {
  mine_stamina_cost_modifier: 'Расход stamina',
  mine_extra_stamina: 'Дополнительная stamina',
  mine_extra_hits: 'Дополнительные удары',
  mine_loot_quantity_modifier: 'Количество добычи',
  mine_block_hint_chance: 'Шанс подсказки блока',
  mine_ore_chance_modifier: 'Шанс руды',
  mine_rare_ore_chance_modifier: 'Шанс редкой руды',
  mine_gold_chance_modifier: 'Шанс золота',
  mine_gem_chance_modifier: 'Шанс самоцветов',
  mine_crystal_chance_modifier: 'Шанс кристаллов',
  mine_passage_chance_modifier: 'Шанс прохода',
  mine_exit_chance_modifier: 'Шанс выхода',
  mine_collapse_chance_modifier: 'Шанс обвала',
  mine_collapse_damage_modifier: 'Урон от обвала',
  mine_hazard_resistance: 'Сопротивление опасностям',
  mine_gas_resistance: 'Сопротивление газу',
  mine_lava_resistance: 'Сопротивление лаве',
  mine_fire_resistance: 'Сопротивление огню',
  mine_ice_resistance: 'Сопротивление холоду',
  mine_dust_resistance: 'Сопротивление пыли',
  mine_curse_resistance: 'Сопротивление проклятию',
  mine_spirit_resistance: 'Сопротивление духам',
  mine_once_per_run_escape: 'Аварийный побег',
  mine_once_per_run_survive_1hp: 'Выжить на 1 HP',
  mine_death_loot_save_modifier: 'Сохранение добычи при смерти',
  mine_retreat_loot_save: 'Сохранение добычи при отступлении',
  mine_area_break: 'Разбить область',
  mine_area_break_chance: 'Шанс разбить область',
  mine_reveal_adjacent_blocks: 'Подсветить соседние блоки',
  mine_free_adjacent_breaks: 'Бесплатные соседние удары',
  mine_porters_unlock: 'Носильщики',
  mine_porters_save_items_on_death: 'Носильщики: спасение добычи при смерти',
  mine_porters_save_items_on_retreat: 'Носильщики: спасение добычи при отступлении',
  mine_porters_capacity_modifier: 'Вместимость носильщиков',
  mine_reduce_risk_increase_per_hit: 'Снижение роста риска за удар',
  mine_start_with_exit_hint: 'Стартовая подсказка выхода',
  mine_start_with_passage_hint: 'Стартовая подсказка прохода',
  mine_ignore_first_hazard: 'Игнорировать первую опасность',
  mine_refund_hit_chance: 'Шанс вернуть удар',
  mine_refund_stamina_chance: 'Шанс вернуть stamina',
  mine_hazard_type_resistance: 'Сопротивление типу опасности',
  mine_block_type_yield_modifier: 'Модификатор выхода блока',
  mine_payload_type_chance_modifier: 'Модификатор шанса payload type',
  mine_rune_trace_chance_modifier: 'Шанс рунного следа',
  mine_block_weight_modifier: 'Модификатор веса блока',
  mine_hazard_weight_modifier: 'Модификатор веса опасности',
  mine_event_weight_modifier: 'Модификатор веса события',
};

const EXTRA_MINING_EFFECT_LABELS: Record<string, string> = {
  mine_extra_hits_on_descend: 'Удары после спуска',
  mine_loot_quality_modifier: 'Качество добычи',
  mine_fragile_loot_break_chance_modifier: 'Шанс повредить хрупкую добычу',
  mine_loot_sell_value_modifier: 'Цена добычи',
  mine_loot_special_property_chance: 'Шанс скрытого свойства',
  mine_rune_fragment_chance_modifier: 'Шанс рунного осколка',
  mine_event_chance_modifier: 'Шанс события',
};

const ALL_MINING_EFFECT_LABELS: Record<string, string> = {
  ...MINING_EFFECT_LABELS,
  ...EXTRA_MINING_EFFECT_LABELS,
};

const MINING_EFFECT_TYPES = Object.keys(ALL_MINING_EFFECT_LABELS) as MiningSkillEffectType[];

function emptyEffect(index: number): ProfessionSkillEffect {
  return {
    id: `effect_${Date.now()}_${index}`,
    type: 'mine_stamina_cost_modifier',
    value: 0,
    valueType: 'flat',
    chance: undefined,
    maxUsesPerRun: undefined,
    maxUsesPerDepth: undefined,
    target: '',
    condition: undefined,
    params: undefined,
  };
}

function emptySkill(professionId = ''): ProfessionSkill {
  const now = new Date().toISOString();
  return {
    id: '',
    professionId,
    name: '',
    description: '',
    requiredLevel: 1,
    requiredSkillIds: [],
    requiredBranchIds: [],
    branchId: undefined,
    skillPointCost: 1,
    effects: [],
    icon: undefined,
    positionX: 0,
    positionY: 0,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

function parseCsv(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function formatCsv(value: string[] | undefined): string {
  return (value ?? []).join(', ');
}

function parseConditionField(
  condition: ProfessionSkillEffectCondition | undefined,
  field: keyof ProfessionSkillEffectCondition,
  value: string,
): ProfessionSkillEffectCondition | undefined {
  const next = { ...(condition ?? {}) };
  if (field === 'minDepth' || field === 'maxDepth') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== '') {
      next[field] = Math.max(0, Math.floor(numeric)) as never;
    } else {
      delete next[field];
    }
  } else {
    const parsed = parseCsv(value);
    if (parsed.length > 0) {
      next[field] = parsed as never;
    } else {
      delete next[field];
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function parseParams(value: string): Record<string, unknown> | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function ProfessionSkillEditor({ professions = [], filterByProfession, onSave }: ProfessionSkillEditorProps) {
  const [skills, setSkills] = useState<ProfessionSkill[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfessionSkill>(emptySkill(filterByProfession || ''));
  const [filterProfession, setFilterProfession] = useState<string>(filterByProfession || '');
  const effectiveProfessionId = filterByProfession || filterProfession;

  useEffect(() => {
    setSkills(loadProfessionSkillsFromStorage());
  }, []);

  useEffect(() => {
    setDraft((current) => ({ ...current, professionId: current.professionId || effectiveProfessionId }));
  }, [effectiveProfessionId]);

  const filteredSkills = useMemo(() => {
    if (!effectiveProfessionId) {
      return skills;
    }
    return skills.filter((entry) => entry.professionId === effectiveProfessionId);
  }, [effectiveProfessionId, skills]);

  const availableRequiredSkills = useMemo(() => {
    return filteredSkills.filter((entry) => entry.id !== editingId);
  }, [editingId, filteredSkills]);

  const miningWarnings = useMemo(
    () => validateMiningSkillConnectivity(skills, loadProfessionBranchesFromStorage()),
    [skills],
  );

  function persist(nextSkills: ProfessionSkill[]) {
    const saved = saveProfessionSkillsToStorage(nextSkills);
    setSkills(saved);
    onSave?.(saved);
  }

  function startCreate() {
    setEditingId(null);
    setDraft(emptySkill(effectiveProfessionId));
  }

  function startEdit(skill: ProfessionSkill) {
    setEditingId(skill.id);
    setDraft({
      ...skill,
      requiredSkillIds: [...(skill.requiredSkillIds ?? [])],
      effects: [...(skill.effects ?? [])],
    });
  }

  function deleteSkill(skillId: string) {
    if (!window.confirm('Удалить этот навык профессии?')) {
      return;
    }
    persist(skills.filter((entry) => entry.id !== skillId));
    if (editingId === skillId) {
      startCreate();
    }
  }

  function saveDraft() {
    if (!draft.id.trim() || !draft.name.trim() || !draft.professionId.trim()) {
      return;
    }
    const normalized: ProfessionSkill = {
      ...draft,
      id: draft.id.trim(),
      professionId: draft.professionId.trim(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      requiredSkillIds: draft.requiredSkillIds ?? [],
      effects: draft.effects ?? [],
      updatedAt: new Date().toISOString(),
      createdAt: draft.createdAt ?? new Date().toISOString(),
    };

    const nextSkills = editingId
      ? skills.map((entry) => (entry.id === editingId ? normalized : entry))
      : [...skills, normalized];

    persist(nextSkills);
    setEditingId(normalized.id);
    setDraft(normalized);
  }

  function resetDefaults() {
    if (!window.confirm('Сбросить навыки профессий к дефолтным?')) {
      return;
    }
    const next = resetProfessionSkillsToDefaults();
    setSkills(next);
    onSave?.(next);
    if (effectiveProfessionId) {
      const first = getProfessionSkillsByProfessionId(effectiveProfessionId)[0] ?? null;
      if (first) {
        startEdit(first);
      } else {
        startCreate();
      }
    } else {
      startCreate();
    }
  }

  function patchEffect(index: number, patch: Partial<ProfessionSkillEffect>) {
    const effects = [...(draft.effects ?? [])];
    effects[index] = { ...effects[index], ...patch };
    setDraft((current) => ({ ...current, effects }));
  }

  function addEffect() {
    const effects = [...(draft.effects ?? []), emptyEffect((draft.effects ?? []).length)];
    setDraft((current) => ({ ...current, effects }));
  }

  function deleteEffect(index: number) {
    const effects = [...(draft.effects ?? [])];
    effects.splice(index, 1);
    setDraft((current) => ({ ...current, effects }));
  }

  return (
    <div className="profession-skill-editor">
      <div className="profession-skill-toolbar">
        <button type="button" className="btn-primary" onClick={startCreate}>+ Новый навык</button>
        <button type="button" className="btn-secondary" onClick={saveDraft}>Сохранить</button>
        <button type="button" className="btn-secondary" onClick={resetDefaults}>Сбросить дефолты</button>
        {!filterByProfession ? (
          <select value={filterProfession} onChange={(event) => setFilterProfession(event.target.value)}>
            <option value="">Все профессии</option>
            {professions.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name}</option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="profession-skill-layout">
        <aside className="card profession-skill-list">
          {filteredSkills.map((skill) => (
            <button
              key={skill.id}
              type="button"
              className={`profession-skill-list-item ${editingId === skill.id ? 'is-active' : ''}`}
              onClick={() => startEdit(skill)}
            >
              <strong>{skill.name}</strong>
              <span>{skill.id}</span>
              <small>{skill.effects?.length ?? 0} эффектов</small>
            </button>
          ))}
          {filteredSkills.length === 0 ? <p className="muted">Навыков пока нет.</p> : null}
        </aside>

        <section className="card profession-skill-form">
          <div className="profession-skill-grid">
            <label>
              <AdminFieldLabel label="ID" hint="Технический ID навыка." />
              <input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} />
            </label>

            <label>
              <AdminFieldLabel label="Профессия" hint="Для Горняка используйте mining." />
              {filterByProfession ? (
                <input value={filterByProfession} disabled />
              ) : (
                <select value={draft.professionId} onChange={(event) => setDraft((current) => ({ ...current, professionId: event.target.value }))}>
                  <option value="">Выберите профессию</option>
                  {professions.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.name}</option>
                  ))}
                </select>
              )}
            </label>

            <label>
              <AdminFieldLabel label="Название" />
              <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>

            <label>
              <AdminFieldLabel label="Требуемый уровень" />
              <input type="number" min={1} value={draft.requiredLevel} onChange={(event) => setDraft((current) => ({ ...current, requiredLevel: Math.max(1, Number(event.target.value) || 1) }))} />
            </label>

            <label>
              <AdminFieldLabel label="Стоимость в skill points" />
              <input type="number" min={0} value={draft.skillPointCost} onChange={(event) => setDraft((current) => ({ ...current, skillPointCost: Math.max(0, Number(event.target.value) || 0) }))} />
            </label>

            <label>
              <AdminFieldLabel label="Branch ID" hint="Опциональная ветка профессии." />
              <input value={draft.branchId ?? ''} onChange={(event) => setDraft((current) => ({ ...current, branchId: event.target.value || undefined }))} />
            </label>

            <label className="profession-skill-grid-span">
              <AdminFieldLabel label="Описание" />
              <textarea rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
            </label>

            <label className="profession-skill-grid-span">
              <AdminFieldLabel label="Required skill IDs" hint="Через запятую." />
              <input value={(draft.requiredSkillIds ?? []).join(', ')} list="profession-skill-required-list" onChange={(event) => setDraft((current) => ({ ...current, requiredSkillIds: parseCsv(event.target.value) }))} />
              <datalist id="profession-skill-required-list">
                {availableRequiredSkills.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </datalist>
            </label>

            <label className="profession-skill-grid-span">
              <AdminFieldLabel label="Required branch IDs" hint="Через запятую." />
              <input value={(draft.requiredBranchIds ?? []).join(', ')} onChange={(event) => setDraft((current) => ({ ...current, requiredBranchIds: parseCsv(event.target.value) }))} />
            </label>

            <label className="profession-skill-checkbox">
              <input type="checkbox" checked={draft.isEnabled} onChange={(event) => setDraft((current) => ({ ...current, isEnabled: event.target.checked }))} />
              <span>Включен</span>
            </label>
          </div>

          <AdminImageField
            value={draft.icon}
            onChange={(nextValue) => setDraft((current) => ({ ...current, icon: nextValue || undefined }))}
            presetId="item-icon"
            suggestedName={`${draft.id || draft.name || 'profession-skill'}-icon`}
            label="Иконка навыка"
            hint="Квадратная иконка навыка 128x128."
          />

          <div className="profession-skill-effects-head">
            <h3>Эффекты</h3>
            <button type="button" className="btn-secondary" onClick={addEffect}>+ Добавить эффект</button>
          </div>

          {effectiveProfessionId === 'mining' && miningWarnings.length > 0 ? (
            <div className="card" style={{ background: 'rgba(57, 30, 20, 0.72)', border: '1px solid rgba(215, 166, 114, 0.42)' }}>
              <strong>Предупреждения связности mining-навыков</strong>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {miningWarnings.map((warning, index) => (
                  <p key={`${warning.skillId}-${warning.effectType}-${index}`} className="muted" style={{ margin: 0 }}>
                    [{warning.skillName}] {warning.effectType}: {warning.message}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {(draft.effects ?? []).length === 0 ? <p className="muted">У навыка пока нет эффектов.</p> : null}

          <div className="profession-skill-effects-list">
            {(draft.effects ?? []).map((entry, index) => (
              <section key={entry.id ?? `${entry.type}-${index}`} className="card profession-skill-effect-card">
                <div className="profession-skill-effect-head">
                  <strong>Эффект {index + 1}</strong>
                  <button type="button" className="btn-danger" onClick={() => deleteEffect(index)}>Удалить</button>
                </div>

                <div className="profession-skill-grid">
                  <label>
                    <AdminFieldLabel label="Effect type" />
                    <select value={entry.type} onChange={(event) => patchEffect(index, { type: event.target.value })}>
                      {MINING_EFFECT_TYPES.map((effectType) => (
                        <option key={effectType} value={effectType}>{ALL_MINING_EFFECT_LABELS[effectType] ?? effectType}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <AdminFieldLabel label="Value" />
                    <input type="number" value={entry.value ?? ''} onChange={(event) => patchEffect(index, { value: event.target.value === '' ? undefined : Number(event.target.value) })} />
                  </label>

                  <label>
                    <AdminFieldLabel label="Value type" />
                    <select value={entry.valueType ?? 'flat'} onChange={(event) => patchEffect(index, { valueType: event.target.value as ProfessionSkillEffectValueType })}>
                      {VALUE_TYPES.map((valueType) => (
                        <option key={valueType} value={valueType}>{valueType}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <AdminFieldLabel label="Chance 0..1" />
                    <input type="number" min={0} max={1} step={0.01} value={entry.chance ?? ''} onChange={(event) => patchEffect(index, { chance: event.target.value === '' ? undefined : Number(event.target.value) })} />
                  </label>

                  <label>
                    <AdminFieldLabel label="Max uses per run" />
                    <input type="number" min={0} value={entry.maxUsesPerRun ?? ''} onChange={(event) => patchEffect(index, { maxUsesPerRun: event.target.value === '' ? undefined : Number(event.target.value) })} />
                  </label>

                  <label>
                    <AdminFieldLabel label="Max uses per depth" />
                    <input type="number" min={0} value={entry.maxUsesPerDepth ?? ''} onChange={(event) => patchEffect(index, { maxUsesPerDepth: event.target.value === '' ? undefined : Number(event.target.value) })} />
                  </label>

                  <label className="profession-skill-grid-span">
                    <AdminFieldLabel label="Target" />
                    <input value={entry.target ?? ''} onChange={(event) => patchEffect(index, { target: event.target.value || undefined })} />
                  </label>

                  <label className="profession-skill-grid-span">
                    <AdminFieldLabel label="Params JSON" hint="Дополнительные параметры эффекта." />
                    <textarea
                      rows={4}
                      value={entry.params ? JSON.stringify(entry.params, null, 2) : ''}
                      onChange={(event) => patchEffect(index, { params: parseParams(event.target.value) })}
                    />
                  </label>
                </div>

                <details>
                  <summary>Conditions</summary>
                  <div className="profession-skill-grid profession-skill-conditions">
                    <label>
                      <AdminFieldLabel label="Min depth" />
                      <input value={entry.condition?.minDepth ?? ''} onChange={(event) => patchEffect(index, { condition: parseConditionField(entry.condition, 'minDepth', event.target.value) })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Max depth" />
                      <input value={entry.condition?.maxDepth ?? ''} onChange={(event) => patchEffect(index, { condition: parseConditionField(entry.condition, 'maxDepth', event.target.value) })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Mine themes" hint="Через запятую." />
                      <input value={formatCsv(entry.condition?.mineTheme)} onChange={(event) => patchEffect(index, { condition: parseConditionField(entry.condition, 'mineTheme', event.target.value) })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Danger levels" hint="Через запятую." />
                      <input value={formatCsv(entry.condition?.mineDangerLevel)} onChange={(event) => patchEffect(index, { condition: parseConditionField(entry.condition, 'mineDangerLevel', event.target.value) })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Hazard types" hint="Через запятую." />
                      <input value={formatCsv(entry.condition?.hazardType)} onChange={(event) => patchEffect(index, { condition: parseConditionField(entry.condition, 'hazardType', event.target.value) })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Block types" hint="Через запятую." />
                      <input value={formatCsv(entry.condition?.blockType)} onChange={(event) => patchEffect(index, { condition: parseConditionField(entry.condition, 'blockType', event.target.value) })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Loot rarity" hint="Через запятую." />
                      <input value={formatCsv(entry.condition?.lootRarity)} onChange={(event) => patchEffect(index, { condition: parseConditionField(entry.condition, 'lootRarity', event.target.value) })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Item tags" hint="Через запятую." />
                      <input value={formatCsv(entry.condition?.itemTags)} onChange={(event) => patchEffect(index, { condition: parseConditionField(entry.condition, 'itemTags', event.target.value) })} />
                    </label>
                  </div>
                </details>
              </section>
            ))}
          </div>
        </section>
      </div>

      <style>{`
        .profession-skill-editor {
          display: grid;
          gap: 1rem;
        }
        .profession-skill-toolbar {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .profession-skill-layout {
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: 1rem;
          align-items: start;
        }
        .profession-skill-list {
          display: grid;
          gap: 0.5rem;
        }
        .profession-skill-list-item {
          display: grid;
          gap: 0.2rem;
          text-align: left;
          padding: 0.75rem;
          border: 1px solid rgba(164, 141, 110, 0.2);
          background: rgba(27, 22, 18, 0.95);
          border-radius: 8px;
        }
        .profession-skill-list-item.is-active {
          border-color: rgba(197, 163, 113, 0.8);
        }
        .profession-skill-form {
          display: grid;
          gap: 1rem;
        }
        .profession-skill-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }
        .profession-skill-grid-span {
          grid-column: 1 / -1;
        }
        .profession-skill-grid label,
        .profession-skill-checkbox {
          display: grid;
          gap: 0.35rem;
        }
        .profession-skill-grid input,
        .profession-skill-grid textarea,
        .profession-skill-grid select {
          width: 100%;
        }
        .profession-skill-checkbox {
          align-content: end;
        }
        .profession-skill-effects-head,
        .profession-skill-effect-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .profession-skill-effects-list {
          display: grid;
          gap: 0.9rem;
        }
        .profession-skill-effect-card {
          display: grid;
          gap: 0.75rem;
          padding: 0.9rem;
          background: rgba(24, 20, 17, 0.9);
        }
        .profession-skill-conditions {
          margin-top: 0.75rem;
        }
        @media (max-width: 980px) {
          .profession-skill-layout {
            grid-template-columns: 1fr;
          }
          .profession-skill-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
