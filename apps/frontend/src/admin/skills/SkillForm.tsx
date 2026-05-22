import { CastType, SkillTargetType, type AdminSkillDefinition, type SkillAcquisitionConfig, type SkillRequirementConfig } from '@theend/rpg-domain';
import { useMemo, useState } from 'react';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { AdminImageField } from '../AdminImageField';
import { AdminHelpTooltip } from '../help/AdminHelpTooltip';
import { AdminFieldLabel, translateAdminErrorMessage } from '../adminUi';
import type { AdminSaveViewModel } from '../adminSaveTools';
import { SkillAcquisitionEditor } from './SkillAcquisitionEditor';
import { SkillEffectsEditor } from './SkillEffectsEditor';
import { SkillJsonField } from './SkillJsonField';
import { SkillLevelEditor } from './SkillLevelEditor';
import { SkillPreview } from './SkillPreview';
import { SkillRequirementsEditor } from './SkillRequirementsEditor';
import { clampLevel, formatCommaList, formatEnumLabel, parseCommaList, SKILL_CAST_TYPES, SKILL_TARGET_TYPES, SKILL_TYPES, syncLevels } from './skillAdminUtils';
import { BATTLE_EFFECT_IDS } from '../../phaser/effects/effectRegistry';

type SkillTab = 'basic' | 'levels' | 'costs' | 'effects' | 'visuals' | 'target' | 'requirements' | 'acquisition' | 'classes' | 'races' | 'runes' | 'shamanism' | 'risks' | 'preview';

interface SkillFormProps {
  draft: AdminSkillDefinition;
  selectedId: string | null;
  previewLevel: number;
  iconSrc?: string;
  status: string;
  saveState: AdminSaveViewModel;
  isSaving: boolean;
  onChange: (next: AdminSkillDefinition) => void;
  onPreviewLevelChange: (next: number) => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
}

const TABS: Array<{ id: SkillTab; label: string }> = [
  { id: 'basic', label: 'Основное' },
  { id: 'levels', label: 'Уровни' },
  { id: 'costs', label: 'Стоимость' },
  { id: 'effects', label: 'Урон и эффекты' },
  { id: 'visuals', label: 'VFX' },
  { id: 'target', label: 'Цель и каст' },
  { id: 'requirements', label: 'Требования' },
  { id: 'acquisition', label: 'Получение' },
  { id: 'classes', label: 'Классы' },
  { id: 'races', label: 'Расы' },
  { id: 'runes', label: 'Руны' },
  { id: 'shamanism', label: 'Шаманизм' },
  { id: 'risks', label: 'Риски' },
  { id: 'preview', label: 'Предпросмотр' },
];

export function SkillForm(props: SkillFormProps) {
  const { draft, selectedId, previewLevel, iconSrc, status, saveState, isSaving, onChange, onPreviewLevelChange, onSave, onDuplicate, onDelete, onTogglePublish } = props;
  const [activeTab, setActiveTab] = useState<SkillTab>('basic');

  function patch(patchValue: Partial<AdminSkillDefinition>) {
    onChange({ ...draft, ...patchValue });
  }

  function patchVisuals(patchValue: NonNullable<AdminSkillDefinition['visuals']>) {
    patch({ visuals: { ...(draft.visuals ?? {}), ...patchValue } });
  }

  function patchRequirements(next: SkillRequirementConfig) {
    patch({ requirements: next });
  }

  function patchAcquisition(next: SkillAcquisitionConfig) {
    patch({ acquisition: next });
  }

  const translatedStatus = useMemo(() => translateAdminErrorMessage(status), [status]);

  function renderEffectOptions() {
    return BATTLE_EFFECT_IDS.map((id) => <option key={id} value={id}>{id}</option>);
  }

  return (
    <section className="admin-form-panel admin-skill-form-panel">
      <div className="admin-form-grid">
        <label>
          <AdminFieldLabel label="ID" hint="Технический идентификатор навыка. Лучше задавать стабильно и не менять после публикации." />
          <AdminHelpTooltip section="skills" field="id" />
          <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} />
        </label>
        <label>
          <AdminFieldLabel label="Название" hint="Имя навыка, которое увидит игрок." />
          <AdminHelpTooltip section="skills" field="name" />
          <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
        </label>
        <label>
          <AdminFieldLabel label="Slug" hint="Человеко-понятный идентификатор для ссылок, экспортов и совместимости." />
          <AdminHelpTooltip section="skills" field="slug" />
          <input value={draft.slug} onChange={(event) => patch({ slug: event.target.value })} />
        </label>
        <label>
          <AdminFieldLabel label="Тип" hint="Главный тип навыка: physical, magic, forbidden, shamanism, rune, mixed или passive." />
          <AdminHelpTooltip section="skills" field="type" />
          <select value={draft.type} onChange={(event) => patch({ type: event.target.value as AdminSkillDefinition['type'] })}>
            {SKILL_TYPES.map((type) => <option key={type} value={type}>{formatEnumLabel(type)}</option>)}
          </select>
        </label>
        <label>
          <AdminFieldLabel label="Подтипы" hint="Через запятую: melee, spell, ritual, control, summon и любые другие комбинации из доменной модели." />
          <input value={formatCommaList(draft.subtypes)} onChange={(event) => patch({ subtypes: parseCommaList(event.target.value) as AdminSkillDefinition['subtypes'] })} />
        </label>
        <label>
          <AdminFieldLabel label="Макс. уровень" hint="От 1 до 5. При смене автоматически синхронизируются записи levels." />
          <AdminHelpTooltip section="skills" field="maxLevel" />
          <select
            value={draft.maxLevel}
            onChange={(event) => {
              const maxLevel = clampLevel(Number(event.target.value), 5) as AdminSkillDefinition['maxLevel'];
              patch({ maxLevel, levels: syncLevels(draft.levels, maxLevel) });
              onPreviewLevelChange(clampLevel(previewLevel, maxLevel));
            }}
          >
            {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <AdminFieldLabel label="Tags" hint="Через запятую: свободные теги для поиска, группировки и будущих фильтров." />
          <input value={formatCommaList(draft.tags)} onChange={(event) => patch({ tags: parseCommaList(event.target.value) })} />
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={draft.isActive} onChange={(event) => patch({ isActive: event.target.checked })} />
          <AdminFieldLabel label="Active" hint="Активный навык. Если выключено, это пассивный или системный ability flow." />
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={draft.isPassive} onChange={(event) => patch({ isPassive: event.target.checked })} />
          <AdminFieldLabel label="Passive" hint="Навык работает как пассивный эффект." />
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={draft.isToggleable} onChange={(event) => patch({ isToggleable: event.target.checked })} />
          <AdminFieldLabel label="Toggleable" hint="Навык можно включать и выключать вместо разового каста." />
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={draft.isPublished} onChange={(event) => patch({ isPublished: event.target.checked })} />
          <AdminFieldLabel label="Published" hint="Опубликованный контент попадает в рабочие снапшоты и готов к использованию." />
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={draft.isHidden} onChange={(event) => patch({ isHidden: event.target.checked })} />
          <AdminFieldLabel label="Hidden" hint="Скрытый навык не показывается игроку напрямую, но может использоваться системой." />
        </label>
      </div>

      <AdminImageField
        value={draft.iconUrl}
        onChange={(nextValue) => patch({ iconUrl: nextValue })}
        onStatus={() => undefined}
        presetId="item-icon"
        suggestedName={`${draft.id || draft.name || 'skill'}-icon`}
        label="Иконка навыка"
        hint="Загружает иконку навыка в тот же content image store, что и предметы, поэтому preview и экспорт работают одинаково."
      />

      <div className="admin-tabbar" role="tablist" aria-label="Skill editor tabs">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? 'is-active' : ''} onClick={() => setActiveTab(tab.id)} role="tab" aria-selected={activeTab === tab.id}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-tabpanel" role="tabpanel">
        {activeTab === 'basic' ? (
          <div className="admin-page-grid">
            <label>
              <AdminFieldLabel label="Short Description" hint="Короткий текст для списка, тултипа и карточки навыка." />
              <textarea rows={2} value={draft.shortDescription} onChange={(event) => patch({ shortDescription: event.target.value })} />
            </label>
            <label>
              <AdminFieldLabel label="Gameplay Description" hint="Игровое описание с упором на эффект, стоимость и боевую роль навыка." />
              <AdminHelpTooltip section="skills" field="description" />
              <textarea rows={4} value={draft.gameplayDescription} onChange={(event) => patch({ gameplayDescription: event.target.value })} />
            </label>
            <label>
              <AdminFieldLabel label="Lore Description" hint="Лор, происхождение и атмосферное описание навыка." />
              <textarea rows={4} value={draft.loreDescription ?? ''} onChange={(event) => patch({ loreDescription: event.target.value || undefined })} />
            </label>
            <label>
              <AdminFieldLabel label="Admin Notes" hint="Внутренние заметки редактора. Здесь можно фиксировать исключения вроде dwarf magic exception." />
              <textarea rows={3} value={draft.adminNotes ?? ''} onChange={(event) => patch({ adminNotes: event.target.value || undefined })} />
            </label>

            <label>
              <AdminFieldLabel label="Получение" hint="Как навык должен выдаваться: обычное обучение, квест, диалог, предмет, скрытый или только админ." />
              <AdminHelpTooltip section="skills" field="acquisitionMode" />
              <select
                value={draft.acquisitionMode ?? 'admin'}
                onChange={(event) => patch({ acquisitionMode: event.target.value as AdminSkillDefinition['acquisitionMode'] })}
              >
                <option value="trainer">trainer</option>
                <option value="quest">quest</option>
                <option value="dialogue">dialogue</option>
                <option value="item">item</option>
                <option value="hidden">hidden</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <label className="zone-editor-checkbox">
              <input
                type="checkbox"
                checked={draft.isTrainable === true}
                onChange={(event) => patch({ isTrainable: event.target.checked })}
              />
              <AdminFieldLabel label="Доступен для обычного обучения" hint="Только такие навыки показываются в разделе Обучение у игрока." />
            </label>
            <label>
              <AdminFieldLabel label="Required level" hint="Минимальный уровень для обычного обучения." />
              <input
                type="number"
                min={0}
                value={draft.requiredLevel ?? ''}
                onChange={(event) => patch({ requiredLevel: event.target.value === '' ? undefined : Number(event.target.value) })}
              />
            </label>
            <label>
              <AdminFieldLabel label="Required completed quest" hint="ID квеста, который должен быть завершён, чтобы навык можно было обучить." />
              <AdminHelpTooltip section="skills" field="requiredCompletedQuestId" />
              <input value={draft.requiredCompletedQuestId ?? ''} onChange={(event) => patch({ requiredCompletedQuestId: event.target.value || undefined })} />
            </label>
            <label>
              <AdminFieldLabel label="Required quest item" hint="ID квестового предмета, который должен быть у игрока." />
              <AdminHelpTooltip section="skills" field="requiredQuestItemId" />
              <input value={draft.requiredQuestItemId ?? ''} onChange={(event) => patch({ requiredQuestItemId: event.target.value || undefined })} />
            </label>
            <label>
              <AdminFieldLabel label="Required NPC / trainer" hint="ID NPC, у которого можно изучить навык в обычном обучении." />
              <AdminHelpTooltip section="skills" field="requiredNpcId" />
              <input value={draft.requiredNpcId ?? ''} onChange={(event) => patch({ requiredNpcId: event.target.value || undefined })} />
            </label>
            <label>
              <AdminFieldLabel label="Required known skills" hint="Через запятую: навыки, которые должны быть уже изучены." />
              <input
                value={formatCommaList(draft.requiredKnownSkillIds)}
                onChange={(event) => patch({ requiredKnownSkillIds: parseCommaList(event.target.value) })}
              />
            </label>
            <label>
              <AdminFieldLabel label="Allowed class IDs" hint="Через запятую: если список непустой, обучение доступно только этим классам." />
              <input
                value={formatCommaList(draft.requiredClassIds)}
                onChange={(event) => patch({ requiredClassIds: parseCommaList(event.target.value) })}
              />
            </label>
            <label>
              <AdminFieldLabel label="Allowed race IDs" hint="Через запятую: если список непустой, обучение доступно только этим расам." />
              <input
                value={formatCommaList(draft.requiredRaceIds)}
                onChange={(event) => patch({ requiredRaceIds: parseCommaList(event.target.value) })}
              />
            </label>
          </div>
        ) : null}

        {activeTab === 'levels' ? <SkillLevelEditor maxLevel={draft.maxLevel} levels={draft.levels} onChange={(next) => patch({ levels: next })} onStatus={() => undefined} /> : null}

        {activeTab === 'costs' ? (
          <div className="admin-page-grid">
            <div className="admin-form-grid">
              <label className="zone-editor-checkbox">
                <input type="checkbox" checked={draft.costs.isFree ?? false} onChange={(event) => patch({ costs: { ...draft.costs, isFree: event.target.checked } })} />
                <AdminFieldLabel label="Free Skill" hint="Если включено, активный навык можно использовать без ресурсов." />
              </label>
              <label className="zone-editor-checkbox">
                <input type="checkbox" checked={draft.costs.allowClassModifiers} onChange={(event) => patch({ costs: { ...draft.costs, allowClassModifiers: event.target.checked } })} />
                <AdminFieldLabel label="Class Modifiers" hint="Разрешить классовым коэффициентам влиять на стоимость." />
              </label>
              <label className="zone-editor-checkbox">
                <input type="checkbox" checked={draft.costs.allowRaceModifiers} onChange={(event) => patch({ costs: { ...draft.costs, allowRaceModifiers: event.target.checked } })} />
                <AdminFieldLabel label="Race Modifiers" hint="Разрешить расовым коэффициентам влиять на стоимость." />
              </label>
              <label className="zone-editor-checkbox">
                <input type="checkbox" checked={draft.costs.allowEquipmentModifiers} onChange={(event) => patch({ costs: { ...draft.costs, allowEquipmentModifiers: event.target.checked } })} />
                <AdminFieldLabel label="Equipment Modifiers" hint="Разрешить экипировке изменять стоимость навыка." />
              </label>
            </div>
            <SkillJsonField label="Resource Costs" hint="Массив SkillResourceCost. Здесь можно комбинировать mp, stamina, hp, blood, memory, soul, rune charges и item costs." value={draft.costs.resources} onChange={(next) => patch({ costs: { ...draft.costs, resources: next } })} onStatus={() => undefined} rows={12} />
          </div>
        ) : null}

        {activeTab === 'effects' ? (
          <SkillEffectsEditor
            damage={draft.damage}
            healing={draft.healing}
            effects={draft.effects}
            summons={draft.summons}
            transformations={draft.transformations}
            onDamageChange={(next) => patch({ damage: next })}
            onHealingChange={(next) => patch({ healing: next })}
            onEffectsChange={(next) => patch({ effects: next })}
            onSummonsChange={(next) => patch({ summons: next })}
            onTransformationsChange={(next) => patch({ transformations: next })}
            onStatus={() => undefined}
          />
        ) : null}

        {activeTab === 'visuals' ? (
          <div className="admin-page-grid">
            <div className="admin-form-grid">
              <label>
                <AdminFieldLabel label="Visual effect ID" hint="General renderer preset. Empty means default." />
                <input list="battle-effect-ids" value={draft.visuals?.visualEffectId ?? ''} onChange={(event) => patchVisuals({ visualEffectId: event.target.value || undefined })} placeholder="hit_slash" />
              </label>
              <label>
                <AdminFieldLabel label="Cast effect ID" hint="Effect played at cast start." />
                <input list="battle-effect-ids" value={draft.visuals?.castEffectId ?? ''} onChange={(event) => patchVisuals({ castEffectId: event.target.value || undefined })} placeholder="hit_blunt" />
              </label>
              <label>
                <AdminFieldLabel label="Projectile effect ID" hint="projectile_arrow, projectile_fire, projectile_ice." />
                <input list="battle-effect-ids" value={draft.visuals?.projectileEffectId ?? ''} onChange={(event) => patchVisuals({ projectileEffectId: event.target.value || undefined })} placeholder="projectile_arrow" />
              </label>
              <label>
                <AdminFieldLabel label="Impact effect ID" hint="impact_blood, impact_fire, impact_ice." />
                <input list="battle-effect-ids" value={draft.visuals?.impactEffectId ?? ''} onChange={(event) => patchVisuals({ impactEffectId: event.target.value || undefined })} placeholder="impact_blood" />
              </label>
              <label>
                <AdminFieldLabel label="Hit effect ID" hint="hit_slash or hit_blunt." />
                <input list="battle-effect-ids" value={draft.visuals?.hitEffectId ?? ''} onChange={(event) => patchVisuals({ hitEffectId: event.target.value || undefined })} placeholder="hit_slash" />
              </label>
              <label>
                <AdminFieldLabel label="Camera shake" hint="Camera shake preset for readable impact." />
                <select
                  value={draft.visuals?.cameraShakePreset ?? 'none'}
                  onChange={(event) => patchVisuals({ cameraShakePreset: event.target.value as NonNullable<AdminSkillDefinition['visuals']>['cameraShakePreset'] })}
                >
                  <option value="none">none</option>
                  <option value="small">small</option>
                  <option value="medium">medium</option>
                  <option value="heavy">heavy</option>
                </select>
              </label>
              <label>
                <AdminFieldLabel label="Cast sound ID" hint="Future audio asset id for cast." />
                <input value={draft.visuals?.castSoundId ?? ''} onChange={(event) => patchVisuals({ castSoundId: event.target.value || undefined })} placeholder="sfx_cast_01" />
              </label>
              <label>
                <AdminFieldLabel label="Impact sound ID" hint="Future audio asset id for impact." />
                <input value={draft.visuals?.impactSoundId ?? ''} onChange={(event) => patchVisuals({ impactSoundId: event.target.value || undefined })} placeholder="sfx_impact_01" />
              </label>
            </div>
            <datalist id="battle-effect-ids">
              {renderEffectOptions()}
            </datalist>
            <SkillJsonField label="Visual JSON" hint="SkillVisualConfig. Optional fields only; old skills work with defaults." value={draft.visuals ?? {}} onChange={(next) => patch({ visuals: next })} onStatus={() => undefined} rows={10} />
          </div>
        ) : null}

        {activeTab === 'target' ? (
          <div className="admin-page-grid">
            <div className="admin-form-grid">
              <label>
                <AdminFieldLabel label="Target Type" hint="Тип цели: single enemy, area, cone, global и т.д." />
                <AdminHelpTooltip section="skills" field="targetType" />
                <select value={draft.target.targetType} onChange={(event) => patch({ target: { ...draft.target, targetType: event.target.value as SkillTargetType } })}>
                  {SKILL_TARGET_TYPES.map((type) => <option key={type} value={type}>{formatEnumLabel(type)}</option>)}
                </select>
              </label>
              <label>
                <AdminFieldLabel label="Range" hint="Дальность применения в условных клетках или боевых шагах." />
                <AdminHelpTooltip section="skills" field="range" />
                <input type="number" value={draft.target.range} onChange={(event) => patch({ target: { ...draft.target, range: Number(event.target.value) || 0 } })} />
              </label>
              <label>
                <AdminFieldLabel label="Cast Type" hint="Instant, cast time, channeling, ritual или toggle." />
                <select value={draft.cast.castType} onChange={(event) => patch({ cast: { ...draft.cast, castType: event.target.value as CastType } })}>
                  {SKILL_CAST_TYPES.map((type) => <option key={type} value={type}>{formatEnumLabel(type)}</option>)}
                </select>
              </label>
              <label>
                <AdminFieldLabel label="Cooldown" hint="Кулдаун навыка в ходах." />
                <AdminHelpTooltip section="skills" field="cooldown" />
                <input type="number" min={0} value={draft.cooldown.cooldownTurns} onChange={(event) => patch({ cooldown: { ...draft.cooldown, cooldownTurns: Number(event.target.value) || 0 } })} />
              </label>
              <label className="zone-editor-checkbox">
                <input type="checkbox" checked={draft.target.canTargetSelf} onChange={(event) => patch({ target: { ...draft.target, canTargetSelf: event.target.checked } })} />
                <AdminFieldLabel label="Can Target Self" hint="Разрешить нацеливание на себя." />
              </label>
              <label className="zone-editor-checkbox">
                <input type="checkbox" checked={draft.target.canTargetAllies} onChange={(event) => patch({ target: { ...draft.target, canTargetAllies: event.target.checked } })} />
                <AdminFieldLabel label="Can Target Allies" hint="Разрешить нацеливание на союзников." />
              </label>
              <label className="zone-editor-checkbox">
                <input type="checkbox" checked={draft.target.canTargetEnemies} onChange={(event) => patch({ target: { ...draft.target, canTargetEnemies: event.target.checked } })} />
                <AdminFieldLabel label="Can Target Enemies" hint="Разрешить нацеливание на врагов." />
              </label>
              <label className="zone-editor-checkbox">
                <input type="checkbox" checked={draft.cast.requiresLineOfSight} onChange={(event) => patch({ cast: { ...draft.cast, requiresLineOfSight: event.target.checked } })} />
                <AdminFieldLabel label="Requires Line of Sight" hint="Нужна ли прямая видимость до цели." />
              </label>
            </div>
            <SkillJsonField label="Advanced Target JSON" hint="SkillTargetConfig с AoE shape, radius, cone, line, friendly fire и max targets." value={draft.target} onChange={(next) => patch({ target: next })} onStatus={() => undefined} rows={12} />
            <SkillJsonField label="Advanced Cast JSON" hint="SkillCastConfig и SkillCooldownConfig для line of sight, ritual, channeling, charges и weapon requirements." value={{ cast: draft.cast, cooldown: draft.cooldown }} onChange={(next) => {
              patch({ cast: next.cast, cooldown: next.cooldown });
            }} onStatus={() => undefined} rows={12} />
          </div>
        ) : null}

        {activeTab === 'requirements' ? <SkillRequirementsEditor value={draft.requirements} onChange={patchRequirements} onStatus={() => undefined} /> : null}
        {activeTab === 'acquisition' ? <SkillAcquisitionEditor value={draft.acquisition} onChange={patchAcquisition} onStatus={() => undefined} /> : null}
        {activeTab === 'classes' ? <SkillJsonField label="Class Scaling" hint="Массив SkillClassScalingConfig: мастерство, штрафы, мультипликаторы урона/лечения/стоимости и риск." value={draft.classScaling} onChange={(next) => patch({ classScaling: next })} onStatus={() => undefined} rows={16} /> : null}
        {activeTab === 'races' ? <SkillJsonField label="Race Rules" hint="Массив SkillRaceRuleConfig. Здесь же удобно зафиксировать canUse=false для race_dwarf на магии." value={draft.raceRules} onChange={(next) => patch({ raceRules: next })} onStatus={() => undefined} rows={16} /> : null}
        {activeTab === 'runes' ? <SkillJsonField label="Rune Config" hint="SkillRuneConfig: required runes, bindings, rune costs, overload risk и ritual allowance." value={draft.rune} onChange={(next) => patch({ rune: next })} onStatus={() => undefined} rows={16} /> : null}
        {activeTab === 'shamanism' ? <SkillJsonField label="Shamanism Config" hint="SkillShamanismConfig: духи, контракт, spirit type, summon flags, anger risk и possession risk." value={draft.shamanism} onChange={(next) => patch({ shamanism: next })} onStatus={() => undefined} rows={16} /> : null}
        {activeTab === 'risks' ? <SkillJsonField label="Risk Components" hint="Массив SkillRiskComponent для self burn, backfire, loss of soul, possession, friendly fire и random target." value={draft.risks} onChange={(next) => patch({ risks: next })} onStatus={() => undefined} rows={16} /> : null}
        {activeTab === 'preview' ? <SkillPreview skill={draft} level={previewLevel} iconSrc={iconSrc} /> : null}
      </div>

      <div className="admin-preview-toolbar">
        <label>
          <AdminFieldLabel label="Preview Level" hint="Быстрый переключатель предпросмотра навыка по уровням 1-5." />
          <select value={previewLevel} onChange={(event) => onPreviewLevelChange(clampLevel(Number(event.target.value), draft.maxLevel))}>
            {Array.from({ length: draft.maxLevel }, (_, index) => index + 1).map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>
      </div>

      <div className="admin-actions-row">
        <button disabled={isSaving} onClick={onSave}>{isSaving ? 'Сохранение...' : (selectedId ? 'Сохранить' : 'Создать')}</button>
        <button disabled={!selectedId} onClick={onDuplicate}>Дублировать</button>
        <button disabled={!selectedId} onClick={onTogglePublish}>{draft.isPublished ? 'Снять публикацию' : 'Опубликовать'}</button>
        <button disabled={!selectedId} onClick={onDelete}>Удалить</button>
      </div>

      <AdminSaveStatus value={saveState} />
      <p className="muted">{translatedStatus}</p>
    </section>
  );
}
