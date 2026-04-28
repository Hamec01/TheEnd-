import { CastType, SkillTargetType, type AdminSkillDefinition, type SkillAcquisitionConfig, type SkillRequirementConfig } from '@theend/rpg-domain';
import { useMemo, useState } from 'react';
import { AdminImageField } from '../AdminImageField';
import { AdminFieldLabel, translateAdminErrorMessage } from '../adminUi';
import { SkillAcquisitionEditor } from './SkillAcquisitionEditor';
import { SkillEffectsEditor } from './SkillEffectsEditor';
import { SkillJsonField } from './SkillJsonField';
import { SkillLevelEditor } from './SkillLevelEditor';
import { SkillPreview } from './SkillPreview';
import { SkillRequirementsEditor } from './SkillRequirementsEditor';
import { clampLevel, formatCommaList, formatEnumLabel, parseCommaList, SKILL_CAST_TYPES, SKILL_TARGET_TYPES, SKILL_TYPES, syncLevels } from './skillAdminUtils';

type SkillTab = 'basic' | 'levels' | 'costs' | 'effects' | 'target' | 'requirements' | 'acquisition' | 'classes' | 'races' | 'runes' | 'shamanism' | 'risks' | 'preview';

interface SkillFormProps {
  draft: AdminSkillDefinition;
  selectedId: string | null;
  previewLevel: number;
  iconSrc?: string;
  status: string;
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
  const { draft, selectedId, previewLevel, iconSrc, status, onChange, onPreviewLevelChange, onSave, onDuplicate, onDelete, onTogglePublish } = props;
  const [activeTab, setActiveTab] = useState<SkillTab>('basic');

  function patch(patchValue: Partial<AdminSkillDefinition>) {
    onChange({ ...draft, ...patchValue });
  }

  function patchRequirements(next: SkillRequirementConfig) {
    patch({ requirements: next });
  }

  function patchAcquisition(next: SkillAcquisitionConfig) {
    patch({ acquisition: next });
  }

  const translatedStatus = useMemo(() => translateAdminErrorMessage(status), [status]);

  return (
    <section className="admin-form-panel admin-skill-form-panel">
      <div className="admin-form-grid">
        <label>
          <AdminFieldLabel label="ID" hint="Технический идентификатор навыка. Лучше задавать стабильно и не менять после публикации." />
          <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} />
        </label>
        <label>
          <AdminFieldLabel label="Название" hint="Имя навыка, которое увидит игрок." />
          <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
        </label>
        <label>
          <AdminFieldLabel label="Slug" hint="Человеко-понятный идентификатор для ссылок, экспортов и совместимости." />
          <input value={draft.slug} onChange={(event) => patch({ slug: event.target.value })} />
        </label>
        <label>
          <AdminFieldLabel label="Тип" hint="Главный тип навыка: physical, magic, forbidden, shamanism, rune, mixed или passive." />
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

        {activeTab === 'target' ? (
          <div className="admin-page-grid">
            <div className="admin-form-grid">
              <label>
                <AdminFieldLabel label="Target Type" hint="Тип цели: single enemy, area, cone, global и т.д." />
                <select value={draft.target.targetType} onChange={(event) => patch({ target: { ...draft.target, targetType: event.target.value as SkillTargetType } })}>
                  {SKILL_TARGET_TYPES.map((type) => <option key={type} value={type}>{formatEnumLabel(type)}</option>)}
                </select>
              </label>
              <label>
                <AdminFieldLabel label="Range" hint="Дальность применения в условных клетках или боевых шагах." />
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
        <button onClick={onSave}>{selectedId ? 'Сохранить' : 'Создать'}</button>
        <button disabled={!selectedId} onClick={onDuplicate}>Дублировать</button>
        <button disabled={!selectedId} onClick={onTogglePublish}>{draft.isPublished ? 'Снять публикацию' : 'Опубликовать'}</button>
        <button disabled={!selectedId} onClick={onDelete}>Удалить</button>
      </div>

      <p className="muted">{translatedStatus}</p>
    </section>
  );
}