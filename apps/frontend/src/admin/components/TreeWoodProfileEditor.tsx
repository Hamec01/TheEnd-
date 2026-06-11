import React, { useEffect, useMemo, useState } from 'react';
import type {
  ItemEffect,
  ItemEffectType,
  TreeDefinition,
  TreeWoodProfile,
  WoodTraitTag,
} from '../../services/content/models';
import { AdminFieldLabel } from '../adminUi';

const MATERIAL_TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const;
const WOOD_TRAIT_TAGS: WoodTraitTag[] = [
  'cold_resistant',
  'heat_resistant',
  'fire_affinity',
  'water_affinity',
  'earth_affinity',
  'air_affinity',
  'light_affinity',
  'dark_affinity',
  'life_affinity',
  'nature_affinity',
  'mana_conductive',
  'rune_friendly',
  'ritual_wood',
  'forbidden_wood',
  'volatile',
  'dense',
  'lightweight',
  'flexible',
  'brittle',
  'hard',
  'elastic',
  'resinous',
  'dry',
  'wet',
  'luxury',
  'building_grade',
  'weapon_grade',
  'bow_grade',
  'staff_grade',
  'shield_grade',
  'furniture_grade',
];

const KNOWN_EFFECT_TYPES: ItemEffectType[] = [
  'stat_bonus',
  'incoming_damage_modifier',
  'outgoing_damage_modifier',
  'armor_penetration',
  'crit_chance_modifier',
  'crit_damage_modifier',
  'crit_chance_taken_modifier',
  'lifesteal',
  'apply_status',
  'status_resistance',
  'status_immunity',
  'block_chance_modifier',
  'dodge_chance_modifier',
  'hit_chance_modifier',
  'extra_attack_chance',
];

type WoodSubTab = 'general' | 'physical' | 'elemental' | 'magical' | 'alchemy' | 'runic' | 'economic' | 'effects' | 'json';

interface ValidationState {
  errors: string[];
  warnings: string[];
}

interface TreeWoodProfileEditorProps {
  tree: TreeDefinition;
  onTreePatch: (patch: Partial<TreeDefinition>) => void;
  onValidationChange?: (state: ValidationState) => void;
}

const PHYSICAL_FIELDS = [
  'hardness', 'flexibility', 'density', 'weight', 'sharpnessPotential', 'durability', 'corrosionResistance', 'heatResistance',
  'coldResistance', 'conductivity', 'fragility', 'elasticity', 'grainStability', 'knotDensity', 'crackRisk', 'resinContent',
  'moistureRetention', 'dryingDifficulty', 'processingDifficulty', 'splinterRisk', 'polishPotential', 'carvingPrecision',
  'bowTension', 'shaftStraightness', 'shieldIntegrity', 'staffBalance',
] as const;
const ELEMENTAL_FIELDS = ['firePower', 'waterPower', 'earthPower', 'airPower', 'lightPower', 'darkPower'] as const;
const MAGICAL_FIELDS = [
  'magicPower', 'manaConductivity', 'spellAmplification', 'curseAffinity', 'spiritAffinity', 'demonAffinity',
  'necroticAffinity', 'holyAffinity', 'natureAffinity', 'illusionAffinity', 'mindAffinity',
] as const;
const ALCHEMY_FIELDS = [
  'healingPower', 'poisonPower', 'stimulantPower', 'sedativePower', 'painkillerPower', 'regenerationPower',
  'visionPower', 'manaPower', 'toxicity', 'addictionRisk', 'resinAlchemyPower', 'barkMedicinePower',
] as const;
const RUNIC_NUMERIC_FIELDS = [
  'runePower', 'instability', 'soulRisk', 'bloodCost', 'memoryCost', 'corruptionRisk',
  'runeCarvingPrecision', 'socketStability', 'magicStoneGrip',
] as const;
const ECONOMIC_FIELDS = [
  'baseDemand', 'militaryDemand', 'foodDemand', 'luxuryValue', 'illegalValue', 'exportValue',
  'craftGuildValue', 'kingdomDemand', 'rarityPower',
] as const;

export function createEmptyTreeWoodProfile(): TreeWoodProfile {
  return {
    materialTier: 'common',
    defaultMaterialCategory: 'wood',
    traitTags: [],
    physical: {},
    elemental: {},
    magical: {},
    alchemy: {},
    runic: {},
    economic: {},
    preferredComponentKinds: [],
    forbiddenComponentKinds: [],
    defaultInheritedEffects: [],
    processingDifficultyBonus: 0,
    processingRiskBonus: 0,
    notes: '',
  };
}

function toLines(values?: string[]): string {
  return (values || []).join('\n');
}

function fromLines(text: string): string[] {
  return text.split('\n').map((v) => v.trim()).filter(Boolean);
}

function parseEffects(value: string): { parsed: ItemEffect[] | null; error?: string } {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return { parsed: null, error: 'defaultInheritedEffects должен быть массивом JSON.' };
    }
    return { parsed: parsed as ItemEffect[] };
  } catch (error) {
    return { parsed: null, error: `Ошибка JSON эффектов: ${(error as Error).message}` };
  }
}

function validateWoodProfile(profile: TreeWoodProfile, effectsParseError?: string): ValidationState {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (profile.materialTier && !MATERIAL_TIERS.includes(profile.materialTier)) {
    errors.push('materialTier вне допустимого списка common/uncommon/rare/epic/legendary/mythic.');
  }

  const tags = profile.traitTags || [];
  const unknownTag = tags.find((tag) => !WOOD_TRAIT_TAGS.includes(tag));
  if (unknownTag) {
    errors.push(`Неизвестный traitTag: ${unknownTag}.`);
  }

  if (effectsParseError) {
    errors.push(effectsParseError);
  } else if (!Array.isArray(profile.defaultInheritedEffects)) {
    errors.push('defaultInheritedEffects должен быть массивом.');
  } else {
    const wrongType = profile.defaultInheritedEffects.find((effect) => !KNOWN_EFFECT_TYPES.includes(effect.type));
    if (wrongType) {
      errors.push(`Неизвестный effect.type: ${String(wrongType.type)}.`);
    }
  }

  if ((profile.processingRiskBonus || 0) > 50) warnings.push('processingRiskBonus больше 50.');
  if ((profile.processingDifficultyBonus || 0) > 50) warnings.push('processingDifficultyBonus больше 50.');
  if (tags.includes('forbidden_wood') && (profile.processingRiskBonus || 0) <= 0) warnings.push('forbidden_wood без processingRiskBonus.');
  if (tags.includes('volatile') && (profile.processingRiskBonus || 0) <= 0) warnings.push('volatile без processingRiskBonus.');
  if (tags.includes('fire_affinity') && (profile.elemental?.firePower || 0) <= 0) warnings.push('fire_affinity без elemental.firePower.');
  if (tags.includes('cold_resistant') && (profile.physical?.coldResistance || 0) <= 0) warnings.push('cold_resistant без physical.coldResistance.');
  if (tags.includes('mana_conductive') && (profile.magical?.manaConductivity || 0) <= 0) warnings.push('mana_conductive без magical.manaConductivity.');
  if (tags.includes('rune_friendly') && (profile.runic?.runePower || 0) <= 0) warnings.push('rune_friendly без runic.runePower.');
  if (tags.includes('bow_grade') && (profile.physical?.flexibility || 0) <= 0 && (profile.physical?.bowTension || 0) <= 0) warnings.push('bow_grade без physical.flexibility/bowTension.');
  if (tags.includes('shield_grade') && (profile.physical?.durability || 0) <= 0 && (profile.physical?.shieldIntegrity || 0) <= 0) warnings.push('shield_grade без physical.durability/shieldIntegrity.');

  return { errors, warnings };
}

export function TreeWoodProfileEditor({ tree, onTreePatch, onValidationChange }: TreeWoodProfileEditorProps) {
  const [activeTab, setActiveTab] = useState<WoodSubTab>('general');
  const profile = tree.woodProfile ?? createEmptyTreeWoodProfile();
  const [effectsJson, setEffectsJson] = useState(JSON.stringify(profile.defaultInheritedEffects ?? [], null, 2));

  useEffect(() => {
    setEffectsJson(JSON.stringify((tree.woodProfile ?? createEmptyTreeWoodProfile()).defaultInheritedEffects ?? [], null, 2));
  }, [tree.woodProfile]);

  const effectsParse = useMemo(() => parseEffects(effectsJson), [effectsJson]);
  const validation = useMemo(() => validateWoodProfile(profile, effectsParse.error), [profile, effectsParse.error]);

  useEffect(() => {
    onValidationChange?.(validation);
  }, [onValidationChange, validation]);

  function patchWoodProfile(next: Partial<TreeWoodProfile>) {
    onTreePatch({ woodProfile: { ...profile, ...next } });
  }

  function patchNested<K extends keyof TreeWoodProfile>(key: K, nestedPatch: Record<string, unknown>) {
    const current = (profile[key] as Record<string, unknown>) || {};
    patchWoodProfile({ [key]: { ...current, ...nestedPatch } } as Partial<TreeWoodProfile>);
  }

  function updateNumericField(group: keyof TreeWoodProfile, key: string, value: string) {
    const normalized = value.trim() === '' ? undefined : Number(value);
    patchNested(group, { [key]: Number.isFinite(normalized) ? normalized : undefined });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="sub-tabs-container">
        {([
          ['general', 'Общее'],
          ['physical', 'Физика'],
          ['elemental', 'Стихии'],
          ['magical', 'Магия'],
          ['alchemy', 'Алхимия'],
          ['runic', 'Руны'],
          ['economic', 'Экономика'],
          ['effects', 'Эффекты'],
          ['json', 'JSON'],
        ] as Array<[WoodSubTab, string]>).map(([key, label]) => (
          <button key={key} type="button" className={`sub-tab-btn ${activeTab === key ? 'is-active' : ''}`} onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="card" style={{ padding: '0.8rem', border: '1px solid rgba(169,139,87,0.3)' }}>
          {validation.errors.map((error) => (
            <div key={error} style={{ color: '#ff8080', fontSize: '0.85rem' }}>Ошибка: {error}</div>
          ))}
          {validation.warnings.map((warning) => (
            <div key={warning} className="muted" style={{ fontSize: '0.85rem' }}>Предупреждение: {warning}</div>
          ))}
        </div>
      )}

      {activeTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-grid-premium three-cols">
            <div className="field-group">
              <AdminFieldLabel label="materialTier" />
              <select value={profile.materialTier ?? 'common'} onChange={(e) => patchWoodProfile({ materialTier: e.target.value as TreeWoodProfile['materialTier'] })}>
                {MATERIAL_TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
              </select>
            </div>
            <div className="field-group">
              <AdminFieldLabel label="processingDifficultyBonus" />
              <input type="number" value={profile.processingDifficultyBonus ?? 0} onChange={(e) => patchWoodProfile({ processingDifficultyBonus: Number(e.target.value) || 0 })} />
            </div>
            <div className="field-group">
              <AdminFieldLabel label="processingRiskBonus" />
              <input type="number" value={profile.processingRiskBonus ?? 0} onChange={(e) => patchWoodProfile({ processingRiskBonus: Number(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="field-group">
            <AdminFieldLabel label="traitTags" hint="Выберите теги свойств древесины." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
              {WOOD_TRAIT_TAGS.map((tag) => {
                const active = (profile.traitTags || []).includes(tag);
                return (
                  <label key={tag} className="zone-editor-checkbox" style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => {
                        const current = profile.traitTags || [];
                        patchWoodProfile({ traitTags: active ? current.filter((entry) => entry !== tag) : [...current, tag] });
                      }}
                    />
                    <span style={{ fontSize: '0.8rem' }}>{tag}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="form-grid-premium">
            <div className="field-group">
              <AdminFieldLabel label="preferredComponentKinds" hint="Один id на строку." />
              <textarea rows={5} value={toLines(profile.preferredComponentKinds)} onChange={(e) => patchWoodProfile({ preferredComponentKinds: fromLines(e.target.value) })} />
            </div>
            <div className="field-group">
              <AdminFieldLabel label="forbiddenComponentKinds" hint="Один id на строку." />
              <textarea rows={5} value={toLines(profile.forbiddenComponentKinds)} onChange={(e) => patchWoodProfile({ forbiddenComponentKinds: fromLines(e.target.value) })} />
            </div>
            <div className="field-group">
              <AdminFieldLabel label="sourceMaterialIds" hint="Один material id на строку." />
              <textarea rows={5} value={toLines(tree.sourceMaterialIds)} onChange={(e) => onTreePatch({ sourceMaterialIds: fromLines(e.target.value) })} />
            </div>
          </div>

          <div className="form-grid-premium three-cols">
            <div className="field-group"><AdminFieldLabel label="defaultLogMaterialId" /><input value={tree.defaultLogMaterialId ?? ''} onChange={(e) => onTreePatch({ defaultLogMaterialId: e.target.value || undefined })} /></div>
            <div className="field-group"><AdminFieldLabel label="defaultPlankMaterialId" /><input value={tree.defaultPlankMaterialId ?? ''} onChange={(e) => onTreePatch({ defaultPlankMaterialId: e.target.value || undefined })} /></div>
            <div className="field-group"><AdminFieldLabel label="defaultBeamMaterialId" /><input value={tree.defaultBeamMaterialId ?? ''} onChange={(e) => onTreePatch({ defaultBeamMaterialId: e.target.value || undefined })} /></div>
            <div className="field-group"><AdminFieldLabel label="defaultResinMaterialId" /><input value={tree.defaultResinMaterialId ?? ''} onChange={(e) => onTreePatch({ defaultResinMaterialId: e.target.value || undefined })} /></div>
            <div className="field-group"><AdminFieldLabel label="defaultBarkMaterialId" /><input value={tree.defaultBarkMaterialId ?? ''} onChange={(e) => onTreePatch({ defaultBarkMaterialId: e.target.value || undefined })} /></div>
          </div>

          <div className="field-group">
            <AdminFieldLabel label="notes" />
            <textarea rows={3} value={profile.notes ?? ''} onChange={(e) => patchWoodProfile({ notes: e.target.value })} />
          </div>
        </div>
      )}

      {activeTab === 'physical' && (
        <div className="form-grid-premium three-cols">
          {PHYSICAL_FIELDS.map((field) => (
            <div key={field} className="field-group">
              <AdminFieldLabel label={field} />
              <input type="number" value={(profile.physical as Record<string, number | undefined> | undefined)?.[field] ?? ''} onChange={(e) => updateNumericField('physical', field, e.target.value)} />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'elemental' && (
        <div className="form-grid-premium three-cols">
          {ELEMENTAL_FIELDS.map((field) => (
            <div key={field} className="field-group">
              <AdminFieldLabel label={field} />
              <input type="number" value={(profile.elemental as Record<string, number | undefined> | undefined)?.[field] ?? ''} onChange={(e) => updateNumericField('elemental', field, e.target.value)} />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'magical' && (
        <div className="form-grid-premium three-cols">
          {MAGICAL_FIELDS.map((field) => (
            <div key={field} className="field-group">
              <AdminFieldLabel label={field} />
              <input type="number" value={(profile.magical as Record<string, number | undefined> | undefined)?.[field] ?? ''} onChange={(e) => updateNumericField('magical', field, e.target.value)} />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'alchemy' && (
        <div className="form-grid-premium three-cols">
          {ALCHEMY_FIELDS.map((field) => (
            <div key={field} className="field-group">
              <AdminFieldLabel label={field} />
              <input type="number" value={(profile.alchemy as Record<string, number | undefined> | undefined)?.[field] ?? ''} onChange={(e) => updateNumericField('alchemy', field, e.target.value)} />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'runic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-grid-premium three-cols">
            {RUNIC_NUMERIC_FIELDS.map((field) => (
              <div key={field} className="field-group">
                <AdminFieldLabel label={field} />
                <input type="number" value={(profile.runic as Record<string, number | undefined> | undefined)?.[field] ?? ''} onChange={(e) => updateNumericField('runic', field, e.target.value)} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {(['canContainSpirit', 'canContainDemon', 'canBindToItem'] as const).map((flag) => (
              <label key={flag} className="zone-editor-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input type="checkbox" checked={Boolean(profile.runic?.[flag])} onChange={(e) => patchNested('runic', { [flag]: e.target.checked })} />
                <span>{flag}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'economic' && (
        <div className="form-grid-premium three-cols">
          {ECONOMIC_FIELDS.map((field) => (
            <div key={field} className="field-group">
              <AdminFieldLabel label={field} />
              <input type="number" value={(profile.economic as Record<string, number | undefined> | undefined)?.[field] ?? ''} onChange={(e) => updateNumericField('economic', field, e.target.value)} />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'effects' && (
        <div className="field-group">
          <AdminFieldLabel label="defaultInheritedEffects" hint="JSON-массив эффектов. На этом этапе только хранение." />
          <textarea
            rows={12}
            value={effectsJson}
            onChange={(e) => {
              const next = e.target.value;
              setEffectsJson(next);
              const parsed = parseEffects(next);
              if (parsed.parsed) patchWoodProfile({ defaultInheritedEffects: parsed.parsed });
            }}
            style={{ fontFamily: 'monospace' }}
          />
        </div>
      )}

      {activeTab === 'json' && (
        <div className="field-group">
          <AdminFieldLabel label="woodProfile JSON" hint="Только для просмотра и отладки." />
          <textarea readOnly rows={14} value={JSON.stringify(profile, null, 2)} style={{ fontFamily: 'monospace' }} />
        </div>
      )}
    </div>
  );
}
