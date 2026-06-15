import {
  Race,
  RACE_DEFINITIONS,
  inferRelationStance,
  normalizeDiplomaticActorId,
  normalizeRelationValue,
  type CombatPolicy,
  type DiplomaticActorDefinition,
  type DiplomaticActorType,
  type GlobalRelation,
  type RelationStance,
} from '@theend/rpg-domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { downloadCollectionJson, extractRawCollectionFromImportJson, importCollectionFromJsonEntries, type JsonImportMode } from '../../services/content/adminJsonImportExport';
import { createContentEntry, deleteContentEntry, getContentCollection, updateContentEntry } from '../../services/content/contentApi';
import type { BattleMapDefinition } from '@theend/rpg-domain';
import type { AdminNpc } from '../../services/content/models';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { runSaveWithFeedback, useAdminSaveShortcut, type AdminSaveViewModel } from '../adminSaveTools';

type ActorLinkType = NonNullable<DiplomaticActorDefinition['linkedContentType']>;

const KINGDOM_OPTIONS = [
  { id: 'argos', name: 'Аргос' },
  { id: 'artalon', name: 'Арталон' },
  { id: 'luminor', name: 'Луминор' },
  { id: 'terimia', name: 'Теримия' },
  { id: 'kriantar', name: 'Криантар' },
] as const;

const ACTOR_TYPE_OPTIONS: Array<{ value: DiplomaticActorType; label: string }> = [
  { value: 'kingdom', label: 'Kingdom' },
  { value: 'faction', label: 'Faction' },
  { value: 'race', label: 'Race' },
  { value: 'clan', label: 'Clan' },
  { value: 'guild', label: 'Guild' },
  { value: 'bandit_group', label: 'Bandit Group' },
  { value: 'monster_group', label: 'Monster Group' },
  { value: 'animal_group', label: 'Animal Group' },
  { value: 'undead_group', label: 'Undead Group' },
  { value: 'cult', label: 'Cult' },
  { value: 'custom', label: 'Custom' },
] as const;

const STANCE_OPTIONS: Array<{ value: RelationStance; label: string }> = [
  { value: 'war', label: 'WAR' },
  { value: 'hostile', label: 'HOSTILE' },
  { value: 'unfriendly', label: 'UNFRIENDLY' },
  { value: 'neutral', label: 'NEUTRAL' },
  { value: 'friendly', label: 'FRIENDLY' },
  { value: 'ally', label: 'ALLY' },
];

const MAGIC_POLICY_OPTIONS: Array<{ value: '' | NonNullable<CombatPolicy['magicPolicy']>; label: string }> = [
  { value: '', label: 'unset' },
  { value: 'allowed', label: 'allowed' },
  { value: 'forbidden', label: 'forbidden' },
  { value: 'restricted', label: 'restricted' },
  { value: 'unknown', label: 'unknown' },
];

const RELATION_PRESETS = [
  { id: 'war', label: 'War / Война', value: -100, stance: 'war' as const, attackOnSight: true, assistInCombat: false },
  { id: 'hostile', label: 'Hostile / Вражда', value: -60, stance: 'hostile' as const, attackOnSight: false, assistInCombat: false },
  { id: 'neutral', label: 'Neutral / Нейтралитет', value: 0, stance: 'neutral' as const, attackOnSight: false, assistInCombat: false },
  { id: 'friendly', label: 'Friendly / Дружба', value: 50, stance: 'friendly' as const, attackOnSight: false, assistInCombat: false },
  { id: 'ally', label: 'Ally / Союз', value: 100, stance: 'ally' as const, attackOnSight: false, assistInCombat: true },
] as const;

type RelationPresetId = typeof RELATION_PRESETS[number]['id'];

function nowIso(): string {
  return new Date().toISOString();
}

function createEmptyActor(seed = Date.now()): DiplomaticActorDefinition {
  const now = nowIso();
  return {
    id: `diplomatic_actor_${seed}`,
    actorType: 'custom',
    name: 'New diplomatic actor',
    linkedContentType: 'custom',
    linkedContentId: '',
    sourceContentId: '',
    aliases: [],
    description: '',
    notes: '',
    combatPolicy: {},
    createdAt: now,
    updatedAt: now,
  };
}

function createLinkedActor(params: {
  actorType: DiplomaticActorType;
  id: string;
  name: string;
  linkedContentType: ActorLinkType;
}): DiplomaticActorDefinition {
  const normalizedId = normalizeDiplomaticActorId(params.id);
  return {
    ...createEmptyActor(),
    id: normalizedId,
    actorType: params.actorType,
    name: params.name,
    linkedContentType: params.linkedContentType,
    linkedContentId: normalizedId,
    sourceContentId: normalizedId,
    updatedAt: nowIso(),
  };
}

function createEmptyRelation(seed = Date.now(), actors: DiplomaticActorDefinition[] = []): GlobalRelation {
  const now = nowIso();
  const first = actors[0];
  const actorType = first?.actorType ?? 'custom';
  const actorId = normalizeDiplomaticActorId(first?.id ?? '');
  return {
    id: `global_relation_${seed}`,
    sourceActorType: actorType,
    sourceActorId: actorId,
    targetActorType: actorType,
    targetActorId: actorId,
    value: 0,
    stance: 'neutral',
    isMutual: true,
    attackOnSight: false,
    assistInCombat: false,
    allowTrade: true,
    allowDialogue: true,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeActor(actor: DiplomaticActorDefinition): DiplomaticActorDefinition {
  const normalizedId = normalizeDiplomaticActorId(actor.id);
  const linkedContentId = normalizeDiplomaticActorId(actor.linkedContentId ?? actor.sourceContentId ?? normalizedId);
  return {
    ...actor,
    id: normalizedId || actor.id.trim(),
    name: actor.name.trim() || normalizedId || actor.id.trim(),
    linkedContentType: actor.linkedContentType ?? 'custom',
    linkedContentId,
    sourceContentId: linkedContentId,
    aliases: Array.isArray(actor.aliases)
      ? actor.aliases.map((entry) => String(entry ?? '').trim()).filter(Boolean)
      : [],
    description: actor.description ?? '',
    notes: actor.notes ?? '',
    combatPolicy: actor.combatPolicy?.magicPolicy ? { ...actor.combatPolicy } : actor.combatPolicy?.allowedSkillTags?.length || actor.combatPolicy?.forbiddenSkillTags?.length ? actor.combatPolicy : undefined,
    createdAt: actor.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function normalizeRelation(relation: GlobalRelation): GlobalRelation {
  const value = normalizeRelationValue(relation.value);
  return {
    ...relation,
    sourceActorId: normalizeDiplomaticActorId(relation.sourceActorId),
    targetActorId: normalizeDiplomaticActorId(relation.targetActorId),
    value,
    stance: relation.stance ?? inferRelationStance(value),
    isMutual: relation.isMutual ?? false,
    attackOnSight: relation.attackOnSight ?? value <= -75,
    assistInCombat: relation.assistInCombat ?? value >= 75,
    allowTrade: relation.allowTrade ?? value >= 0,
    allowDialogue: relation.allowDialogue ?? value > -75,
    notes: relation.notes ?? '',
    createdAt: relation.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function buildFactionSuggestions(npcs: AdminNpc[], battleMaps: BattleMapDefinition[]): Array<{ id: string; name: string }> {
  const ids = new Set<string>();
  for (const npc of npcs) {
    const candidate = normalizeDiplomaticActorId((npc as unknown as { factionId?: string }).factionId);
    if (candidate) {
      ids.add(candidate);
    }
  }
  for (const map of battleMaps) {
    for (const npc of map.npcs ?? []) {
      const candidate = normalizeDiplomaticActorId(npc.factionId);
      if (candidate) {
        ids.add(candidate);
      }
    }
  }
  return [...ids].sort().map((id) => ({ id, name: id.replace(/_/g, ' ') }));
}

function validateActor(actor: DiplomaticActorDefinition, actors: DiplomaticActorDefinition[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!actor.id.trim()) {
    errors.push('ID is required.');
  }
  if (!actor.name.trim()) {
    errors.push('Name is required.');
  }
  const duplicates = actors.filter((entry) => normalizeDiplomaticActorId(entry.id) === normalizeDiplomaticActorId(actor.id)).length;
  if (duplicates > 1) {
    warnings.push('Duplicate actor id.');
  }
  if (actor.actorType !== 'custom' && actor.linkedContentId && normalizeDiplomaticActorId(actor.linkedContentId) !== normalizeDiplomaticActorId(actor.id)) {
    warnings.push('Linked content id differs from actor id.');
  }
  return { errors, warnings };
}

function validateRelation(relation: GlobalRelation, actors: DiplomaticActorDefinition[], relations: GlobalRelation[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceExists = actors.some((actor) => actor.actorType === relation.sourceActorType && normalizeDiplomaticActorId(actor.id) === normalizeDiplomaticActorId(relation.sourceActorId));
  const targetExists = actors.some((actor) => actor.actorType === relation.targetActorType && normalizeDiplomaticActorId(actor.id) === normalizeDiplomaticActorId(relation.targetActorId));
  if (!sourceExists) {
    errors.push('Source actor does not exist.');
  }
  if (!targetExists) {
    errors.push('Target actor does not exist.');
  }
  if (relation.value < -100 || relation.value > 100) {
    errors.push('Value must be between -100 and +100.');
  }
  if (relation.sourceActorType === relation.targetActorType && normalizeDiplomaticActorId(relation.sourceActorId) === normalizeDiplomaticActorId(relation.targetActorId)) {
    warnings.push('Source and target are the same actor.');
  }
  const duplicates = relations.filter((entry) =>
    entry.id !== relation.id
    && entry.sourceActorType === relation.sourceActorType
    && entry.targetActorType === relation.targetActorType
    && normalizeDiplomaticActorId(entry.sourceActorId) === normalizeDiplomaticActorId(relation.sourceActorId)
    && normalizeDiplomaticActorId(entry.targetActorId) === normalizeDiplomaticActorId(relation.targetActorId),
  ).length;
  if (duplicates > 0) {
    warnings.push('Duplicate relation exists.');
  }
  return { errors, warnings };
}

function formatRelationPreview(relation: GlobalRelation, actorNameByKey: Map<string, string>): string {
  const sourceName = actorNameByKey.get(`${relation.sourceActorType}:${normalizeDiplomaticActorId(relation.sourceActorId)}`) ?? relation.sourceActorId;
  const targetName = actorNameByKey.get(`${relation.targetActorType}:${normalizeDiplomaticActorId(relation.targetActorId)}`) ?? relation.targetActorId;
  const direction = relation.isMutual ? '↔' : '→';
  const extras: string[] = [];
  if (relation.attackOnSight) {
    extras.push('attack on sight');
  }
  if (relation.assistInCombat) {
    extras.push('assist in combat');
  }
  return `${sourceName} ${direction} ${targetName}: ${(relation.stance ?? inferRelationStance(relation.value)).toUpperCase()} (${relation.value})${extras.length > 0 ? `, ${extras.join(', ')}` : ''}`;
}

function actorTypeLabel(value: DiplomaticActorType): string {
  return ACTOR_TYPE_OPTIONS.find((entry) => entry.value === value)?.label ?? value;
}

export function DiplomacyPage() {
  const [actors, setActors] = useState<DiplomaticActorDefinition[]>([]);
  const [relations, setRelations] = useState<GlobalRelation[]>([]);
  const [originalActorIds, setOriginalActorIds] = useState<string[]>([]);
  const [originalRelationIds, setOriginalRelationIds] = useState<string[]>([]);
  const [npcs, setNpcs] = useState<AdminNpc[]>([]);
  const [battleMaps, setBattleMaps] = useState<BattleMapDefinition[]>([]);
  const [status, setStatus] = useState('Готово.');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово.' });
  const [isSaving, setIsSaving] = useState(false);
  const [actorImportMode, setActorImportMode] = useState<JsonImportMode>('merge');
  const [relationImportMode, setRelationImportMode] = useState<JsonImportMode>('merge');
  const [newKingdomActorId, setNewKingdomActorId] = useState('argos');
  const [newRaceActor, setNewRaceActor] = useState<Race>(Race.Human);
  const [newFactionActorId, setNewFactionActorId] = useState('');
  const [activeSourceKey, setActiveSourceKey] = useState('');
  const actorImportRef = useRef<HTMLInputElement | null>(null);
  const relationImportRef = useRef<HTMLInputElement | null>(null);

  const raceOptions = useMemo(() => Object.values(Race).map((race) => ({
    race,
    id: normalizeDiplomaticActorId(race),
    name: RACE_DEFINITIONS[race].label,
  })), []);

  const factionOptions = useMemo(() => buildFactionSuggestions(npcs, battleMaps), [battleMaps, npcs]);

  const actorNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const actor of actors) {
      map.set(`${actor.actorType}:${normalizeDiplomaticActorId(actor.id)}`, actor.name);
    }
    return map;
  }, [actors]);

  const actorValidationById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof validateActor>>();
    for (const actor of actors) {
      map.set(actor.id, validateActor(actor, actors));
    }
    return map;
  }, [actors]);

  const relationValidationById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof validateRelation>>();
    for (const relation of relations) {
      map.set(relation.id, validateRelation(relation, actors, relations));
    }
    return map;
  }, [actors, relations]);
  const actorSelectorOptions = useMemo(() => actors.map((actor) => ({
    key: `${actor.actorType}:${normalizeDiplomaticActorId(actor.id)}`,
    label: `${actor.name} (${actorTypeLabel(actor.actorType)})`,
    actorType: actor.actorType,
    actorId: normalizeDiplomaticActorId(actor.id),
  })), [actors]);

  const loadAll = useCallback(async () => {
    const [nextActors, nextRelations, nextNpcs, nextBattleMaps] = await Promise.all([
      getContentCollection<DiplomaticActorDefinition>('diplomaticActors'),
      getContentCollection<GlobalRelation>('globalRelations'),
      getContentCollection<AdminNpc>('npcs'),
      getContentCollection<BattleMapDefinition>('battleMaps'),
    ]);
    const normalizedActors = nextActors.map(normalizeActor);
    const normalizedRelations = nextRelations.map(normalizeRelation);
    setActors(normalizedActors);
    setRelations(normalizedRelations);
    setOriginalActorIds(normalizedActors.map((entry) => entry.id));
    setOriginalRelationIds(normalizedRelations.map((entry) => entry.id));
    setNpcs(nextNpcs);
    setBattleMaps(nextBattleMaps);
  }, []);

  useEffect(() => {
    void loadAll().catch((error) => {
      console.error('[diplomacy] load failed', error);
      setStatus(`Ошибка загрузки: ${(error as Error).message}`);
    });
  }, [loadAll]);

  useEffect(() => {
    if (!activeSourceKey && actorSelectorOptions.length > 0) {
      setActiveSourceKey(actorSelectorOptions[0]!.key);
      return;
    }
    if (activeSourceKey && !actorSelectorOptions.some((option) => option.key === activeSourceKey)) {
      setActiveSourceKey(actorSelectorOptions[0]?.key ?? '');
    }
  }, [activeSourceKey, actorSelectorOptions]);

  const saveAll = useCallback(async (): Promise<boolean> => {
    if (isSaving) {
      return false;
    }
    const normalizedActors = actors.map(normalizeActor);
    const normalizedRelations = relations.map(normalizeRelation);
    const actorErrors = normalizedActors.flatMap((actor) => validateActor(actor, normalizedActors).errors.map((message) => `${actor.id}: ${message}`));
    const relationErrors = normalizedRelations.flatMap((relation) => validateRelation(relation, normalizedActors, normalizedRelations).errors.map((message) => `${relation.id}: ${message}`));
    if (actorErrors.length > 0 || relationErrors.length > 0) {
      setSaveState({ state: 'error', message: [...actorErrors, ...relationErrors].join(' | ') });
      return false;
    }

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: 'diplomacy',
      onSave: async () => {
        const actorIdSet = new Set(normalizedActors.map((entry) => entry.id));
        for (const removedId of originalActorIds) {
          if (!actorIdSet.has(removedId)) {
            await deleteContentEntry('diplomaticActors', removedId);
          }
        }
        for (const actor of normalizedActors) {
          if (originalActorIds.includes(actor.id)) {
            await updateContentEntry('diplomaticActors', actor.id, actor);
          } else {
            await createContentEntry('diplomaticActors', actor);
          }
        }

        const relationIdSet = new Set(normalizedRelations.map((entry) => entry.id));
        for (const removedId of originalRelationIds) {
          if (!relationIdSet.has(removedId)) {
            await deleteContentEntry('globalRelations', removedId);
          }
        }
        for (const relation of normalizedRelations) {
          if (originalRelationIds.includes(relation.id)) {
            await updateContentEntry('globalRelations', relation.id, relation);
          } else {
            await createContentEntry('globalRelations', relation);
          }
        }
        return true;
      },
      onAfterSave: async () => {
        await loadAll();
      },
      successLabel: () => 'Дипломатия сохранена.',
    });
    setIsSaving(false);
    if (saved) {
      setStatus('Дипломатия сохранена.');
    }
    return Boolean(saved);
  }, [actors, isSaving, loadAll, originalActorIds, originalRelationIds, relations]);

  useAdminSaveShortcut({
    enabled: true,
    isSaving,
    onSave: saveAll,
    successMessage: 'Дипломатия сохранена.',
  });

  function patchActor(actorId: string, updater: (current: DiplomaticActorDefinition) => DiplomaticActorDefinition) {
    setActors((current) => current.map((entry) => entry.id === actorId ? normalizeActor(updater(entry)) : entry));
  }

  function patchRelation(relationId: string, updater: (current: GlobalRelation) => GlobalRelation) {
    setRelations((current) => current.map((entry) => entry.id === relationId ? normalizeRelation(updater(entry)) : entry));
  }

  function addActor(candidate: DiplomaticActorDefinition) {
    const normalizedId = normalizeDiplomaticActorId(candidate.id);
    if (actors.some((entry) => normalizeDiplomaticActorId(entry.id) === normalizedId)) {
      setStatus(`Actor already exists: ${normalizedId}`);
      return;
    }
    setActors((current) => [...current, normalizeActor(candidate)]);
  }

  function createRelationForActiveSource(presetId: RelationPresetId = 'neutral') {
    if (!activeSourceKey) {
      setStatus('Сначала выберите source actor.');
      return;
    }
    const preset = RELATION_PRESETS.find((entry) => entry.id === presetId) ?? RELATION_PRESETS[2] ?? RELATION_PRESETS[0];
    const [sourceActorType, sourceActorId] = activeSourceKey.split(':');
    const firstAvailableTarget = actorSelectorOptions.find((option) => option.key !== activeSourceKey);
    const targetActorType = (firstAvailableTarget?.actorType ?? sourceActorType) as DiplomaticActorType;
    const targetActorId = firstAvailableTarget?.actorId ?? sourceActorId;
    setRelations((current) => [
      ...current,
      normalizeRelation({
        id: `global_relation_${Date.now()}_${current.length + 1}`,
        sourceActorType: sourceActorType as DiplomaticActorType,
        sourceActorId,
        targetActorType,
        targetActorId,
        value: preset.value,
        stance: preset.stance,
        isMutual: true,
        attackOnSight: preset.attackOnSight,
        assistInCombat: preset.assistInCombat,
        allowTrade: preset.value >= 0,
        allowDialogue: preset.value > -75,
        notes: '',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }),
    ]);
  }

  const groupedRelations = useMemo(() => {
    const groups = new Map<string, GlobalRelation[]>();
    for (const relation of relations) {
      const key = `${relation.sourceActorType}:${normalizeDiplomaticActorId(relation.sourceActorId)}`;
      const bucket = groups.get(key);
      if (bucket) {
        bucket.push(relation);
      } else {
        groups.set(key, [relation]);
      }
    }
    return groups;
  }, [relations]);

  const activeSourceRelations = useMemo(() => groupedRelations.get(activeSourceKey) ?? [], [activeSourceKey, groupedRelations]);

  async function handleActorImport(file: File | null) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const entries = extractRawCollectionFromImportJson(payload, 'diplomaticActors');
      const result = await importCollectionFromJsonEntries<DiplomaticActorDefinition>({
        entries,
        mode: actorImportMode,
        defaults: () => createEmptyActor(),
        normalize: (value) => normalizeActor(value),
        validate: (value) => validateActor(value, [value]).errors,
        getAll: () => getContentCollection<DiplomaticActorDefinition>('diplomaticActors'),
        create: (value) => createContentEntry('diplomaticActors', value),
        update: (id, value) => updateContentEntry('diplomaticActors', id, value),
        delete: (id) => deleteContentEntry('diplomaticActors', id),
      });
      await loadAll();
      setStatus(`Import actors: +${result.created.length} / ~${result.updated.length} / skip ${result.skippedExisting.length}`);
    } catch (error) {
      setStatus(`Import actors failed: ${(error as Error).message}`);
    } finally {
      if (actorImportRef.current) actorImportRef.current.value = '';
    }
  }

  async function handleRelationImport(file: File | null) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const entries = extractRawCollectionFromImportJson(payload, 'globalRelations');
      const result = await importCollectionFromJsonEntries<GlobalRelation>({
        entries,
        mode: relationImportMode,
        defaults: () => createEmptyRelation(),
        normalize: (value) => normalizeRelation(value),
        validate: (value) => validateRelation(value, actors, [value]).errors,
        getAll: () => getContentCollection<GlobalRelation>('globalRelations'),
        create: (value) => createContentEntry('globalRelations', value),
        update: (id, value) => updateContentEntry('globalRelations', id, value),
        delete: (id) => deleteContentEntry('globalRelations', id),
      });
      await loadAll();
      setStatus(`Import relations: +${result.created.length} / ~${result.updated.length} / skip ${result.skippedExisting.length}`);
    } catch (error) {
      setStatus(`Import relations failed: ${(error as Error).message}`);
    } finally {
      if (relationImportRef.current) relationImportRef.current.value = '';
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ border: '1px solid rgba(214, 182, 121, 0.28)', borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Diplomatic Actors</h2>
            <p className="muted" style={{ margin: '6px 0 0 0' }}>Королевства, фракции, расы и другие дипломатические источники.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setActors((current) => [...current, createEmptyActor()])}>+ Создать actor</button>
            <button type="button" onClick={() => downloadCollectionJson({ filePrefix: 'theend_diplomatic_actors', collectionKey: 'diplomaticActors', entries: actors })}>Export actors</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Создать actor из kingdom</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={newKingdomActorId} onChange={(event) => setNewKingdomActorId(event.target.value)}>
                {KINGDOM_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
              <button
                type="button"
                onClick={() => {
                  const option = KINGDOM_OPTIONS.find((entry) => entry.id === newKingdomActorId);
                  if (!option) return;
                  addActor(createLinkedActor({ actorType: 'kingdom', id: option.id, name: option.name, linkedContentType: 'kingdom' }));
                }}
              >
                Добавить
              </button>
            </div>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Создать actor из race</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={newRaceActor} onChange={(event) => setNewRaceActor(event.target.value as Race)}>
                {raceOptions.map((option) => <option key={option.id} value={option.race}>{option.name}</option>)}
              </select>
              <button
                type="button"
                onClick={() => {
                  const option = raceOptions.find((entry) => entry.race === newRaceActor);
                  if (!option) return;
                  addActor(createLinkedActor({ actorType: 'race', id: option.id, name: option.name, linkedContentType: 'race' }));
                }}
              >
                Добавить
              </button>
            </div>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Создать actor из faction</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={newFactionActorId} onChange={(event) => setNewFactionActorId(event.target.value)}>
                <option value="">Выберите faction</option>
                {factionOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
              <button
                type="button"
                disabled={!newFactionActorId}
                onClick={() => {
                  const option = factionOptions.find((entry) => entry.id === newFactionActorId);
                  if (!option) return;
                  addActor(createLinkedActor({ actorType: 'faction', id: option.id, name: option.name, linkedContentType: 'faction' }));
                }}
              >
                Добавить
              </button>
            </div>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          <select value={actorImportMode} onChange={(event) => setActorImportMode(event.target.value as JsonImportMode)}>
            <option value="merge">merge</option>
            <option value="addOnly">addOnly</option>
            <option value="replaceAll">replaceAll</option>
          </select>
          <input ref={actorImportRef} type="file" accept="application/json" onChange={(event) => void handleActorImport(event.target.files?.[0] ?? null)} />
        </div>

        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          {actors.length === 0 ? <p className="muted">Нет diplomatic actors.</p> : null}
          {actors.map((actor) => {
            const validation = actorValidationById.get(actor.id) ?? { errors: [], warnings: [] };
            return (
              <article key={actor.id} style={{ border: '1px solid rgba(214, 182, 121, 0.2)', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <strong>{actor.name}</strong>
                  <button type="button" onClick={() => setActors((current) => current.filter((entry) => entry.id !== actor.id))}>Удалить actor</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 8 }}>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span>ID</span>
                    <input value={actor.id} onChange={(event) => patchActor(actor.id, (current) => ({ ...current, id: normalizeDiplomaticActorId(event.target.value) }))} />
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span>Name</span>
                    <input value={actor.name} onChange={(event) => patchActor(actor.id, (current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span>Type</span>
                    <select value={actor.actorType} onChange={(event) => patchActor(actor.id, (current) => ({ ...current, actorType: event.target.value as DiplomaticActorType }))}>
                      {ACTOR_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span>Magic policy</span>
                    <select
                      value={actor.combatPolicy?.magicPolicy ?? ''}
                      onChange={(event) => patchActor(actor.id, (current) => ({
                        ...current,
                        combatPolicy: event.target.value ? { ...(current.combatPolicy ?? {}), magicPolicy: event.target.value as NonNullable<CombatPolicy['magicPolicy']> } : undefined,
                      }))}
                    >
                      {MAGIC_POLICY_OPTIONS.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span>Linked type</span>
                    <select value={actor.linkedContentType ?? 'custom'} onChange={(event) => patchActor(actor.id, (current) => ({ ...current, linkedContentType: event.target.value as ActorLinkType }))}>
                      <option value="kingdom">kingdom</option>
                      <option value="race">race</option>
                      <option value="faction">faction</option>
                      <option value="npc_faction">npc_faction</option>
                      <option value="custom">custom</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span>linked/source content id</span>
                    <input
                      value={actor.linkedContentId ?? actor.sourceContentId ?? ''}
                      onChange={(event) => patchActor(actor.id, (current) => ({
                        ...current,
                        linkedContentId: normalizeDiplomaticActorId(event.target.value),
                        sourceContentId: normalizeDiplomaticActorId(event.target.value),
                      }))}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span>Notes</span>
                    <input value={actor.notes ?? ''} onChange={(event) => patchActor(actor.id, (current) => ({ ...current, notes: event.target.value }))} />
                  </label>
                </div>
                {validation.errors.length > 0 || validation.warnings.length > 0 ? (
                  <div style={{ display: 'grid', gap: 4 }}>
                    {validation.errors.map((message) => <span key={`e-${message}`} style={{ color: '#ff9b9b' }}>{message}</span>)}
                    {validation.warnings.map((message) => <span key={`w-${message}`} style={{ color: '#f6d680' }}>{message}</span>)}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section style={{ border: '1px solid rgba(214, 182, 121, 0.28)', borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Global Relations</h2>
            <p className="muted" style={{ margin: '6px 0 0 0' }}>Source/target выбираются из existing diplomatic actors.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setRelations((current) => [...current, createEmptyRelation(Date.now(), actors)])}>+ Создать relation</button>
            <button type="button" onClick={() => downloadCollectionJson({ filePrefix: 'theend_global_relations', collectionKey: 'globalRelations', entries: relations })}>Export relations</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          <select value={relationImportMode} onChange={(event) => setRelationImportMode(event.target.value as JsonImportMode)}>
            <option value="merge">merge</option>
            <option value="addOnly">addOnly</option>
            <option value="replaceAll">replaceAll</option>
          </select>
          <input ref={relationImportRef} type="file" accept="application/json" onChange={(event) => void handleRelationImport(event.target.files?.[0] ?? null)} />
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 16, padding: 12, border: '1px solid rgba(214, 182, 121, 0.18)', borderRadius: 12 }}>
          <strong>Grouped editor: один source actor и много target rows</strong>
          <div className="muted">Выберите source actor выше тут. Ниже будут все для них relation rows, и можно добавлять новые target rows по кнопке.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr auto auto', gap: 8, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>Source actor</span>
              <select value={activeSourceKey} onChange={(event) => setActiveSourceKey(event.target.value)}>
                <option value="">Выберите actor</option>
                {actorSelectorOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => createRelationForActiveSource('neutral')} disabled={!activeSourceKey}>+ Target row</button>
            <button type="button" onClick={() => createRelationForActiveSource('war')} disabled={!activeSourceKey}>+ War row</button>
          </div>
          <div className="muted">Выбран: {activeSourceKey ? (actorSelectorOptions.find((option) => option.key === activeSourceKey)?.label ?? activeSourceKey) : 'не выбрано'}. Всего в группе: {activeSourceRelations.length}.</div>
        </div>

        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          {relations.length === 0 ? <p className="muted">Нет global relations.</p> : null}
          {activeSourceRelations.map((relation) => {
            const validation = relationValidationById.get(relation.id) ?? { errors: [], warnings: [] };
            return (
              <article key={relation.id} style={{ border: '1px solid rgba(214, 182, 121, 0.2)', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <strong>{formatRelationPreview(relation, actorNameByKey)}</strong>
                  <button type="button" onClick={() => setRelations((current) => current.filter((entry) => entry.id !== relation.id))}>Удалить relation</button>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {RELATION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => patchRelation(relation.id, (current) => ({
                        ...current,
                        value: preset.value,
                        stance: preset.stance,
                        attackOnSight: preset.attackOnSight,
                        assistInCombat: preset.assistInCombat,
                        allowTrade: preset.value >= 0,
                        allowDialogue: preset.value > -75,
                      }))}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 0.8fr 0.9fr', gap: 8 }}>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span>Source actor</span>
                    <select
                      value={`${relation.sourceActorType}:${normalizeDiplomaticActorId(relation.sourceActorId)}`}
                      onChange={(event) => {
                        const [sourceActorType, sourceActorId] = event.target.value.split(':');
                        patchRelation(relation.id, (current) => ({
                          ...current,
                          sourceActorType: sourceActorType as DiplomaticActorType,
                          sourceActorId: normalizeDiplomaticActorId(sourceActorId),
                        }));
                      }}
                    >
                      {actors.map((actor) => (
                        <option key={`${actor.actorType}:${actor.id}`} value={`${actor.actorType}:${normalizeDiplomaticActorId(actor.id)}`}>
                          {actor.name} ({actorTypeLabel(actor.actorType)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span>Target actor</span>
                    <select
                      value={`${relation.targetActorType}:${normalizeDiplomaticActorId(relation.targetActorId)}`}
                      onChange={(event) => {
                        const [targetActorType, targetActorId] = event.target.value.split(':');
                        patchRelation(relation.id, (current) => ({
                          ...current,
                          targetActorType: targetActorType as DiplomaticActorType,
                          targetActorId: normalizeDiplomaticActorId(targetActorId),
                        }));
                      }}
                    >
                      {actors.map((actor) => (
                        <option key={`${actor.actorType}:${actor.id}`} value={`${actor.actorType}:${normalizeDiplomaticActorId(actor.id)}`}>
                          {actor.name} ({actorTypeLabel(actor.actorType)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span>Value</span>
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      value={relation.value}
                      onChange={(event) => patchRelation(relation.id, (current) => {
                        const value = normalizeRelationValue(Number(event.target.value));
                        return { ...current, value, stance: inferRelationStance(value) };
                      })}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span>Stance</span>
                    <select value={relation.stance ?? inferRelationStance(relation.value)} onChange={(event) => patchRelation(relation.id, (current) => ({ ...current, stance: event.target.value as RelationStance }))}>
                      {STANCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: 8 }}>
                  <label><input type="checkbox" checked={relation.isMutual ?? false} onChange={(event) => patchRelation(relation.id, (current) => ({ ...current, isMutual: event.target.checked }))} /> mutual</label>
                  <label><input type="checkbox" checked={relation.attackOnSight ?? false} onChange={(event) => patchRelation(relation.id, (current) => ({ ...current, attackOnSight: event.target.checked }))} /> attackOnSight</label>
                  <label><input type="checkbox" checked={relation.assistInCombat ?? false} onChange={(event) => patchRelation(relation.id, (current) => ({ ...current, assistInCombat: event.target.checked }))} /> assistInCombat</label>
                  <label><input type="checkbox" checked={relation.allowTrade ?? false} onChange={(event) => patchRelation(relation.id, (current) => ({ ...current, allowTrade: event.target.checked }))} /> allowTrade</label>
                  <label><input type="checkbox" checked={relation.allowDialogue ?? false} onChange={(event) => patchRelation(relation.id, (current) => ({ ...current, allowDialogue: event.target.checked }))} /> allowDialogue</label>
                </div>

                <label style={{ display: 'grid', gap: 4 }}>
                  <span>Notes</span>
                  <textarea rows={2} value={relation.notes ?? ''} onChange={(event) => patchRelation(relation.id, (current) => ({ ...current, notes: event.target.value }))} />
                </label>

                {validation.errors.length > 0 || validation.warnings.length > 0 ? (
                  <div style={{ display: 'grid', gap: 4 }}>
                    {validation.errors.map((message) => <span key={`e-${message}`} style={{ color: '#ff9b9b' }}>{message}</span>)}
                    {validation.warnings.map((message) => <span key={`w-${message}`} style={{ color: '#f6d680' }}>{message}</span>)}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <AdminSaveStatus value={saveState} />
          <p className="muted" style={{ margin: '6px 0 0 0' }}>{status}</p>
        </div>
        <button type="button" onClick={() => void saveAll()} disabled={isSaving}>
          {isSaving ? 'Сохраняем...' : 'Сохранить дипломатию'}
        </button>
      </div>
    </div>
  );
}
