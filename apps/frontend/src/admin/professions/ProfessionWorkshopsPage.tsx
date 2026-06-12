import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { runSaveWithFeedback, type AdminSaveViewModel, useAdminSaveShortcut } from '../adminSaveTools';
import {
  createContentEntry,
  deleteContentEntry,
  getContentCollection,
  getContentEntry,
  updateContentEntry,
} from '../../services/content/contentApi';
import {
  downloadCollectionJson,
  extractRawCollectionFromImportJson,
  importCollectionFromJsonEntries,
  type JsonImportMode,
} from '../../services/content/adminJsonImportExport';
import { ImageSheetPicker } from '../components/ImageSheetPicker';
import { NpcReferenceSelector } from '../components/NpcReferenceSelector';
import { cityService } from '../../services/cityRepository';
import { toLegacyImagePath } from '../../services/content/gameImageRefs';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import { loadRuntimeImages, resolveStoredImageSource } from '../../services/content/runtimeImageService';
import { locationService } from '../../services/locationRepository';
import { refreshZonesFromBackend } from '../../services/worldRepository';
import type {
  AdminNpc,
  ProfessionWorkshopAccessRules,
  ProfessionWorkshopDefinition,
  ProfessionWorkshopInteractionPoint,
  ProfessionWorkshopInteractionType,
  ProfessionWorkshopKind,
  ProfessionWorkshopRental,
  StoredImage,
} from '../../services/content/models';
import type { City } from '../../types/city';
import type { WorldLocation } from '../../types/location';
import type { WorldMapZone } from '../../worldmap/zoneEditorTypes';
import { buildWorkshopReferenceContexts } from '../utils/npcReferenceSearch';

interface PendingImportPreview<T extends { id: string }> {
  fileName: string;
  mode: JsonImportMode;
  totalFound: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  replaceWarningCount: number;
  firstIds: string[];
  errors: string[];
  entries: T[];
}

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const WORKSHOP_KINDS: ProfessionWorkshopKind[] = [
  'carpenter',
  'blacksmith',
  'alchemy',
  'runecrafting',
  'enchanting',
  'leatherworking',
  'cooking',
  'mining',
];

const WORKSHOP_STATUSES: ProfessionWorkshopDefinition['status'][] = ['active', 'disabled', 'draft'];
const INTERACTION_TYPES: ProfessionWorkshopInteractionType[] = ['station', 'npc', 'dialog', 'rental', 'storage', 'exit', 'custom'];

function nowIso(): string {
  return new Date().toISOString();
}

function parseMultiline(value: string): string[] {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toMultiline(value: string[] | undefined): string {
  return Array.isArray(value) ? value.join('\n') : '';
}

function createEmptyWorkshop(): ProfessionWorkshopDefinition {
  const timestamp = nowIso();
  return {
    id: '',
    name: '',
    description: '',
    professionId: 'carpenter',
    workshopKind: 'carpenter',
    status: 'draft',
    tier: 1,
    stationTypes: [],
    allowedTemplateGroups: [],
    forbiddenTemplateGroups: [],
    allowedTemplateIds: [],
    forbiddenTemplateIds: [],
    requiredReputation: 0,
    requiredQuestId: '',
    requiredFactionId: '',
    rental: {
      enabled: false,
      priceGold: 0,
      durationHours: 24,
      requiresNpcDialogue: false,
      ownerNpcId: '',
      rentalDialogueId: '',
    },
    accessRules: {
      publicAccess: true,
      kingdomId: '',
      factionId: '',
      onlyCitizens: false,
    },
    imagePath: '',
    interactionPoints: [],
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeRental(rental: ProfessionWorkshopRental | undefined): ProfessionWorkshopRental {
  return {
    enabled: rental?.enabled === true,
    priceGold: Math.max(0, Number.isFinite(Number(rental?.priceGold)) ? Number(rental?.priceGold) : 0),
    durationHours: Math.max(0, Number.isFinite(Number(rental?.durationHours)) ? Number(rental?.durationHours) : 24),
    requiresNpcDialogue: rental?.requiresNpcDialogue === true,
    ownerNpcId: String(rental?.ownerNpcId ?? '').trim(),
    rentalDialogueId: String(rental?.rentalDialogueId ?? '').trim(),
  };
}

function normalizeAccessRules(accessRules: ProfessionWorkshopAccessRules | undefined): ProfessionWorkshopAccessRules {
  return {
    publicAccess: accessRules?.publicAccess !== false,
    kingdomId: String(accessRules?.kingdomId ?? '').trim(),
    factionId: String(accessRules?.factionId ?? '').trim(),
    onlyCitizens: accessRules?.onlyCitizens === true,
  };
}

function normalizeInteractionPoint(raw: ProfessionWorkshopInteractionPoint | undefined, index: number): ProfessionWorkshopInteractionPoint {
  return {
    id: String(raw?.id ?? `point_${index + 1}`).trim() || `point_${index + 1}`,
    label: String(raw?.label ?? '').trim(),
    type: INTERACTION_TYPES.includes(raw?.type as ProfessionWorkshopInteractionType) ? (raw?.type as ProfessionWorkshopInteractionType) : 'custom',
    x: Math.max(0, Math.min(100, Number.isFinite(Number(raw?.x)) ? Number(raw?.x) : 0)),
    y: Math.max(0, Math.min(100, Number.isFinite(Number(raw?.y)) ? Number(raw?.y) : 0)),
    stationType: String(raw?.stationType ?? '').trim(),
    npcId: String(raw?.npcId ?? '').trim(),
    dialogId: String(raw?.dialogId ?? '').trim(),
    serviceId: String(raw?.serviceId ?? '').trim(),
    requiredWorkshopTier: Math.max(0, Number.isFinite(Number(raw?.requiredWorkshopTier)) ? Number(raw?.requiredWorkshopTier) : 0),
    requiredQuestId: String(raw?.requiredQuestId ?? '').trim(),
    requiredSkillId: String(raw?.requiredSkillId ?? '').trim(),
    isEnabled: raw?.isEnabled !== false,
    description: String(raw?.description ?? '').trim(),
  };
}

function normalizeWorkshopInput(raw: ProfessionWorkshopDefinition): ProfessionWorkshopDefinition {
  const base = createEmptyWorkshop();
  const next: ProfessionWorkshopDefinition = {
    ...base,
    ...raw,
    id: String(raw.id ?? '').trim(),
    name: String(raw.name ?? '').trim(),
    description: String(raw.description ?? '').trim(),
    professionId: String(raw.professionId ?? base.professionId).trim() || base.professionId,
    workshopKind: WORKSHOP_KINDS.includes(raw.workshopKind) ? raw.workshopKind : base.workshopKind,
    status: WORKSHOP_STATUSES.includes(raw.status) ? raw.status : base.status,
    tier: Math.max(1, Number.isFinite(Number(raw.tier)) ? Math.round(Number(raw.tier)) : 1),
    stationTypes: (raw.stationTypes ?? []).map((entry) => String(entry).trim()).filter(Boolean),
    allowedTemplateGroups: (raw.allowedTemplateGroups ?? []).map((entry) => String(entry).trim()).filter(Boolean),
    forbiddenTemplateGroups: (raw.forbiddenTemplateGroups ?? []).map((entry) => String(entry).trim()).filter(Boolean),
    allowedTemplateIds: (raw.allowedTemplateIds ?? []).map((entry) => String(entry).trim()).filter(Boolean),
    forbiddenTemplateIds: (raw.forbiddenTemplateIds ?? []).map((entry) => String(entry).trim()).filter(Boolean),
    requiredReputation: Math.max(0, Number.isFinite(Number(raw.requiredReputation)) ? Number(raw.requiredReputation) : 0),
    requiredQuestId: String(raw.requiredQuestId ?? '').trim(),
    requiredFactionId: String(raw.requiredFactionId ?? '').trim(),
    rental: normalizeRental(raw.rental),
    accessRules: normalizeAccessRules(raw.accessRules),
    imagePath: String(raw.imagePath ?? '').trim(),
    interactionPoints: (raw.interactionPoints ?? []).map((entry, index) => normalizeInteractionPoint(entry, index)),
    tags: (raw.tags ?? []).map((entry) => String(entry).trim()).filter(Boolean),
    createdAt: String(raw.createdAt ?? base.createdAt ?? nowIso()).trim() || nowIso(),
    updatedAt: String(raw.updatedAt ?? base.updatedAt ?? nowIso()).trim() || nowIso(),
  };
  if (!raw.imageRef) {
    delete next.imageRef;
  }
  return next;
}

function validateWorkshopInput(workshop: ProfessionWorkshopDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!workshop.id.trim()) errors.push('ID мастерской обязателен.');
  if (!workshop.name.trim()) errors.push('Название мастерской обязательно.');
  if (!workshop.professionId.trim()) errors.push('Нужно указать professionId.');
  if (workshop.stationTypes.length === 0) warnings.push('У мастерской пока нет stationTypes.');
  if (workshop.rental?.enabled && !workshop.rental.durationHours) warnings.push('Для аренды желательно указать durationHours.');
  if (workshop.rental?.requiresNpcDialogue && !workshop.rental.rentalDialogueId?.trim()) warnings.push('requiresNpcDialogue включён, но rentalDialogueId пустой.');

  const seenIds = new Set<string>();
  for (const [index, point] of (workshop.interactionPoints ?? []).entries()) {
    if (!point.id.trim()) {
      errors.push(`interactionPoints[${index}] должен иметь id.`);
    } else if (seenIds.has(point.id.trim())) {
      errors.push(`Повторяющийся interactionPoints.id: ${point.id.trim()}.`);
    } else {
      seenIds.add(point.id.trim());
    }
    if (!point.label.trim()) {
      warnings.push(`interactionPoints[${index}] желательно дать label.`);
    }
    if (point.type === 'station' && !String(point.stationType ?? '').trim()) {
      warnings.push(`interactionPoints[${index}] с type=station желательно указать stationType.`);
    }
  }

  return { errors, warnings };
}

function buildImportPreview<T extends { id: string }>(params: {
  fileName: string;
  mode: JsonImportMode;
  entries: T[];
  existingIds: string[];
  replaceWarningCount: number;
  normalize: (value: T) => T;
  validate: (value: T) => string[];
}): PendingImportPreview<T> {
  const existing = new Set(params.existingIds);
  const seen = new Set<string>();
  const errors: string[] = [];
  const normalizedEntries: T[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const raw of params.entries) {
    const id = String(raw.id ?? '').trim();
    if (!id) {
      errors.push('У записи нет строкового id.');
      continue;
    }
    if (seen.has(id)) {
      errors.push(`Повторяющийся id внутри файла: ${id}.`);
      continue;
    }
    seen.add(id);
    const candidate = params.normalize({ ...raw, id } as T);
    const validationErrors = params.validate(candidate);
    if (validationErrors.length > 0) {
      errors.push(`${id}: ${validationErrors.join(', ')}`);
      continue;
    }
    normalizedEntries.push(candidate);
    if (existing.has(id)) {
      if (params.mode === 'addOnly') skippedCount += 1;
      else updatedCount += 1;
    } else {
      createdCount += 1;
    }
  }

  return {
    fileName: params.fileName,
    mode: params.mode,
    totalFound: params.entries.length,
    createdCount,
    updatedCount,
    skippedCount,
    replaceWarningCount: params.replaceWarningCount,
    firstIds: normalizedEntries.slice(0, 10).map((entry) => entry.id),
    errors,
    entries: normalizedEntries,
  };
}

function createStarterWorkshops(): ProfessionWorkshopDefinition[] {
  return [
    normalizeWorkshopInput({
      id: 'workshop_carpenter_basic_public',
      name: 'Простая плотницкая мастерская',
      description: 'Общественная мастерская с верстаком, сушилкой и простыми инструментами.',
      professionId: 'carpenter',
      workshopKind: 'carpenter',
      status: 'active',
      tier: 1,
      stationTypes: ['workbench', 'drying_rack', 'carving_bench'],
      allowedTemplateGroups: ['wood_processing', 'weapon_components'],
      rental: { enabled: false, priceGold: 0 },
      interactionPoints: [
        { id: 'point_workbench', label: 'Верстак', type: 'station', x: 45, y: 60, stationType: 'workbench', isEnabled: true },
        { id: 'point_drying_rack', label: 'Сушилка', type: 'station', x: 65, y: 55, stationType: 'drying_rack', isEnabled: true },
        { id: 'point_owner', label: 'Мастер плотник', type: 'npc', x: 75, y: 68, npcId: '', isEnabled: true },
        { id: 'point_exit', label: 'Выйти', type: 'exit', x: 10, y: 85, isEnabled: true },
      ],
      tags: ['starter', 'public', 'carpenter'],
    }),
    normalizeWorkshopInput({
      id: 'workshop_carpenter_sawmill_basic',
      name: 'Лесопильня',
      description: 'Мастерская для распила брёвен на доски и балки.',
      professionId: 'carpenter',
      workshopKind: 'carpenter',
      status: 'active',
      tier: 1,
      stationTypes: ['sawmill', 'workbench'],
      allowedTemplateGroups: ['wood_processing'],
      rental: { enabled: false, priceGold: 0 },
      interactionPoints: [
        { id: 'point_sawmill', label: 'Лесопилка', type: 'station', x: 50, y: 60, stationType: 'sawmill', isEnabled: true },
        { id: 'point_workbench', label: 'Верстак', type: 'station', x: 72, y: 65, stationType: 'workbench', isEnabled: true },
        { id: 'point_exit', label: 'Выйти', type: 'exit', x: 10, y: 85, isEnabled: true },
      ],
      tags: ['starter', 'sawmill', 'carpenter'],
    }),
    normalizeWorkshopInput({
      id: 'workshop_carpenter_advanced',
      name: 'Полная мастерская плотника',
      description: 'Мастерская с верстаком, лесопилкой, столом сборки и резным столом.',
      professionId: 'carpenter',
      workshopKind: 'carpenter',
      status: 'active',
      tier: 2,
      stationTypes: ['workbench', 'sawmill', 'drying_rack', 'carving_bench', 'assembly_table', 'finishing_table'],
      allowedTemplateGroups: ['wood_processing', 'weapon_components', 'shields', 'bows', 'crossbows', 'arrows_and_bolts', 'furniture', 'building_parts'],
      rental: { enabled: true, priceGold: 25, durationHours: 24 },
      interactionPoints: [
        { id: 'point_workbench', label: 'Верстак', type: 'station', x: 35, y: 62, stationType: 'workbench', isEnabled: true },
        { id: 'point_sawmill', label: 'Лесопилка', type: 'station', x: 55, y: 62, stationType: 'sawmill', isEnabled: true },
        { id: 'point_assembly_table', label: 'Сборочный стол', type: 'station', x: 70, y: 60, stationType: 'assembly_table', isEnabled: true },
        { id: 'point_rental', label: 'Аренда мастерской', type: 'rental', x: 82, y: 72, isEnabled: true },
        { id: 'point_owner', label: 'Владелец мастерской', type: 'npc', x: 78, y: 55, npcId: '', isEnabled: true },
        { id: 'point_exit', label: 'Выйти', type: 'exit', x: 8, y: 86, isEnabled: true },
      ],
      tags: ['advanced', 'rental', 'carpenter'],
    }),
    normalizeWorkshopInput({
      id: 'workshop_carpenter_ritual',
      name: 'Ритуальная мастерская дерева',
      description: 'Редкая мастерская для рунной резьбы, посохов и ритуальных деревянных основ.',
      professionId: 'carpenter',
      workshopKind: 'carpenter',
      status: 'active',
      tier: 3,
      stationTypes: ['rune_carving_table', 'finishing_table', 'carving_bench'],
      allowedTemplateGroups: ['staffs_and_wands', 'ritual_woodwork'],
      rental: { enabled: true, priceGold: 100, durationHours: 24, requiresNpcDialogue: true },
      interactionPoints: [
        { id: 'point_rune_table', label: 'Рунный стол', type: 'station', x: 50, y: 60, stationType: 'rune_carving_table', isEnabled: true },
        { id: 'point_finishing_table', label: 'Стол отделки', type: 'station', x: 68, y: 62, stationType: 'finishing_table', isEnabled: true },
        { id: 'point_ritual_owner', label: 'Хранитель мастерской', type: 'npc', x: 75, y: 54, npcId: '', isEnabled: true },
        { id: 'point_rental', label: 'Аренда', type: 'rental', x: 82, y: 75, isEnabled: true },
        { id: 'point_exit', label: 'Выйти', type: 'exit', x: 8, y: 86, isEnabled: true },
      ],
      tags: ['ritual', 'rare', 'carpenter'],
    }),
  ];
}

export function ProfessionWorkshopsPage({ onBack }: { onBack: () => void }) {
  const [workshops, setWorkshops] = useState<ProfessionWorkshopDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfessionWorkshopDefinition>(createEmptyWorkshop());
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | ProfessionWorkshopKind>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProfessionWorkshopDefinition['status']>('all');
  const [status, setStatus] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);
  const [importMode, setImportMode] = useState<JsonImportMode>('addOnly');
  const [pendingImport, setPendingImport] = useState<PendingImportPreview<ProfessionWorkshopDefinition> | null>(null);
  const [pendingStarterAdd, setPendingStarterAdd] = useState<PendingImportPreview<ProfessionWorkshopDefinition> | null>(null);
  const [validation, setValidation] = useState<ValidationResult>({ errors: [], warnings: [] });
  const [imageRefDraft, setImageRefDraft] = useState('');
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);
  const [npcs, setNpcs] = useState<AdminNpc[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [locations, setLocations] = useState<WorldLocation[]>([]);
  const [zones, setZones] = useState<WorldMapZone[]>([]);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const starterWorkshops = useMemo(() => createStarterWorkshops(), []);

  async function refresh() {
    try {
      const next = await getContentCollection<ProfessionWorkshopDefinition>('professionWorkshops');
      setWorkshops(next ?? []);
      if (selectedId && !(next ?? []).some((entry) => entry.id === selectedId)) {
        setSelectedId(null);
        setDraft(createEmptyWorkshop());
        setImageRefDraft('');
      }
    } catch (error) {
      console.error(error);
      setStatus('Не удалось загрузить мастерские профессий.');
    }
  }

  useEffect(() => {
    void refresh();
    void loadRuntimeImages().then(setRuntimeImages).catch(() => setRuntimeImages([]));
    void getContentCollection<AdminNpc>('npcs').then(setNpcs).catch(() => setNpcs([]));
    void cityService.getCities().then(setCities).catch(() => setCities([]));
    void locationService.getLocations().then(setLocations).catch(() => setLocations([]));
    void refreshZonesFromBackend().then(setZones).catch(() => setZones([]));
  }, []);

  useEffect(() => {
    setValidation(validateWorkshopInput(draft));
    setImageRefDraft(draft.imageRef ? JSON.stringify(draft.imageRef, null, 2) : '');
  }, [draft]);

  const visibleWorkshops = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workshops.filter((workshop) => {
      const byQuery = !q
        || workshop.id.toLowerCase().includes(q)
        || workshop.name.toLowerCase().includes(q)
        || (workshop.description ?? '').toLowerCase().includes(q);
      const byKind = kindFilter === 'all' || workshop.workshopKind === kindFilter;
      const byStatus = statusFilter === 'all' || workshop.status === statusFilter;
      return byQuery && byKind && byStatus;
    });
  }, [workshops, query, kindFilter, statusFilter]);

  const draftWorkshopContexts = useMemo(() => buildWorkshopReferenceContexts({
    workshopId: draft.id,
    professionId: draft.professionId,
    locations,
    cities,
  }), [cities, draft.id, draft.professionId, locations]);

  function selectWorkshop(workshop: ProfessionWorkshopDefinition) {
    setSelectedId(workshop.id);
    setDraft(normalizeWorkshopInput(workshop));
  }

  function createNew() {
    setSelectedId(null);
    setDraft(createEmptyWorkshop());
  }

  function patch(next: Partial<ProfessionWorkshopDefinition>) {
    setDraft((current) => normalizeWorkshopInput({
      ...current,
      ...next,
      rental: next.rental ? { ...current.rental, ...next.rental } : current.rental,
      accessRules: next.accessRules ? { ...current.accessRules, ...next.accessRules } : current.accessRules,
      updatedAt: nowIso(),
    }));
  }

  function patchRental(next: Partial<ProfessionWorkshopRental>) {
    patch({ rental: normalizeRental({ ...normalizeRental(draft.rental), ...next }) });
  }

  function patchAccessRules(next: Partial<ProfessionWorkshopAccessRules>) {
    patch({ accessRules: normalizeAccessRules({ ...normalizeAccessRules(draft.accessRules), ...next }) });
  }

  function patchInteractionPoint(index: number, next: Partial<ProfessionWorkshopInteractionPoint>) {
    patch({
      interactionPoints: (draft.interactionPoints ?? []).map((point, pointIndex) => (
        pointIndex === index ? normalizeInteractionPoint({ ...point, ...next }, index) : point
      )),
    });
  }

  function addInteractionPoint() {
    patch({
      interactionPoints: [
        ...(draft.interactionPoints ?? []),
        normalizeInteractionPoint({
          id: `point_${(draft.interactionPoints?.length ?? 0) + 1}`,
          label: '',
          type: 'custom',
          x: 50,
          y: 50,
          isEnabled: true,
        }, draft.interactionPoints?.length ?? 0),
      ],
    });
  }

  function removeInteractionPoint(index: number) {
    patch({
      interactionPoints: (draft.interactionPoints ?? []).filter((_, pointIndex) => pointIndex !== index),
    });
  }

  async function saveCurrent() {
    if (isSaving) return;
    const normalized = normalizeWorkshopInput(draft);
    const check = validateWorkshopInput(normalized);
    setValidation(check);
    if (check.errors.length > 0) {
      setStatus('Исправьте ошибки мастерской перед сохранением.');
      return;
    }

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: normalized.id || 'profession_workshop',
      onSave: async () => {
        const payload = normalizeWorkshopInput(normalized);
        if (!payload.id) {
          throw new Error('ID мастерской обязателен.');
        }
        if (selectedId && selectedId !== payload.id) {
          await deleteContentEntry('professionWorkshops', selectedId);
          return createContentEntry('professionWorkshops', payload);
        }
        if (workshops.some((entry) => entry.id === payload.id)) {
          return updateContentEntry('professionWorkshops', payload.id, payload);
        }
        return createContentEntry('professionWorkshops', payload);
      },
      onAfterSave: async (entry) => {
        const verified = await getContentEntry<ProfessionWorkshopDefinition>('professionWorkshops', entry.id);
        if (!verified) {
          throw new Error('Запись не найдена на бэкенде после сохранения.');
        }
      },
      successLabel: (entry) => `Мастерская сохранена: ${entry.id}`,
    });

    if (saved) {
      setSelectedId(saved.id);
      setDraft(normalizeWorkshopInput(saved));
      await refresh();
      setStatus(`Мастерская сохранена: ${saved.id}`);
    }
    setIsSaving(false);
  }

  async function removeCurrent() {
    if (!selectedId) return;
    if (!window.confirm(`Удалить мастерскую ${selectedId}?`)) return;
    try {
      await deleteContentEntry('professionWorkshops', selectedId);
      setSelectedId(null);
      setDraft(createEmptyWorkshop());
      await refresh();
      setStatus(`Мастерская удалена: ${selectedId}`);
    } catch (error) {
      console.error(error);
      setStatus('Ошибка удаления мастерской.');
    }
  }

  function handleExportAll() {
    downloadCollectionJson({
      filePrefix: 'theend_profession_workshops',
      collectionKey: 'professionWorkshops',
      entries: workshops,
    });
    setStatus(`Экспортировано мастерских: ${workshops.length}.`);
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPendingImport(null);
    setStatus('Подготовка preview импорта мастерских...');
    try {
      const parsed = JSON.parse(await file.text());
      const entries = extractRawCollectionFromImportJson(parsed, 'professionWorkshops');
      const existing = await getContentCollection<ProfessionWorkshopDefinition>('professionWorkshops');
      const preview = buildImportPreview<ProfessionWorkshopDefinition>({
        fileName: file.name,
        mode: importMode,
        entries: entries as ProfessionWorkshopDefinition[],
        existingIds: (existing ?? []).map((entry) => entry.id),
        replaceWarningCount: importMode === 'replaceAll' ? (existing ?? []).length : 0,
        normalize: normalizeWorkshopInput,
        validate: (value) => validateWorkshopInput(value).errors,
      });
      setPendingImport(preview);
      setStatus(`Preview готов: найдено ${preview.totalFound}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка чтения JSON импорта.');
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setIsSaving(true);
    setStatus('Импорт мастерских...');
    try {
      const result = await importCollectionFromJsonEntries<ProfessionWorkshopDefinition>({
        entries: pendingImport.entries,
        defaults: createEmptyWorkshop,
        normalize: normalizeWorkshopInput,
        validate: (value) => validateWorkshopInput(value).errors,
        getAll: () => getContentCollection<ProfessionWorkshopDefinition>('professionWorkshops'),
        create: (value) => createContentEntry('professionWorkshops', value),
        update: (id, value) => updateContentEntry('professionWorkshops', id, value),
        mode: pendingImport.mode,
      });
      await refresh();
      setPendingImport(null);
      setStatus(`Импорт завершён: создано ${result.created.length}, обновлено ${result.updated.length}, пропущено ${result.skippedExisting.length}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка импорта мастерских.');
    } finally {
      setIsSaving(false);
    }
  }

  async function prepareStarterPreview() {
    setStatus('Подготовка стартовых мастерских...');
    try {
      const existing = await getContentCollection<ProfessionWorkshopDefinition>('professionWorkshops');
      const preview = buildImportPreview<ProfessionWorkshopDefinition>({
        fileName: 'starter-workshops',
        mode: 'addOnly',
        entries: starterWorkshops,
        existingIds: (existing ?? []).map((entry) => entry.id),
        replaceWarningCount: 0,
        normalize: normalizeWorkshopInput,
        validate: (value) => validateWorkshopInput(value).errors,
      });
      setPendingStarterAdd(preview);
      setStatus(`Starter preview: добавить ${preview.createdCount}, пропустить ${preview.skippedCount}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка подготовки стартовых мастерских.');
    }
  }

  async function confirmStarterAdd() {
    if (!pendingStarterAdd) return;
    setIsSaving(true);
    setStatus('Добавление стартовых мастерских...');
    try {
      const result = await importCollectionFromJsonEntries<ProfessionWorkshopDefinition>({
        entries: pendingStarterAdd.entries,
        defaults: createEmptyWorkshop,
        normalize: normalizeWorkshopInput,
        validate: (value) => validateWorkshopInput(value).errors,
        getAll: () => getContentCollection<ProfessionWorkshopDefinition>('professionWorkshops'),
        create: (value) => createContentEntry('professionWorkshops', value),
        update: (id, value) => updateContentEntry('professionWorkshops', id, value),
        mode: 'addOnly',
      });
      await refresh();
      setPendingStarterAdd(null);
      setStatus(`Стартовый набор: добавлено ${result.created.length}, пропущено ${result.skippedExisting.length}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка добавления стартовых мастерских.');
    } finally {
      setIsSaving(false);
    }
  }

  useAdminSaveShortcut({
    enabled: true,
    isSaving,
    onSave: saveCurrent,
  });

  const previewImage = resolveStoredImageSource(draft.imagePath ?? '', runtimeImages) ?? draft.imagePath ?? '';

  return (
    <div className="living-editor-grid">
      <section className="catalog-sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <button type="button" className="btn-back" onClick={onBack}>← Назад к профессиям</button>
          <span className="premium-badge">{visibleWorkshops.length} / {workshops.length}</span>
        </div>
        <h3 style={{ marginTop: 0 }}>Мастерские профессий</h3>

        <input
          className="catalog-search-input"
          placeholder="Поиск по ID/названию..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="filters-grid" style={{ marginTop: '0.6rem', marginBottom: '0.6rem' }}>
          <select className="filter-select" value={kindFilter} onChange={(event) => setKindFilter(event.target.value as 'all' | ProfessionWorkshopKind)}>
            <option value="all">Все типы</option>
            {WORKSHOP_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
          <select className="filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ProfessionWorkshopDefinition['status'])}>
            <option value="all">Все статусы</option>
            {WORKSHOP_STATUSES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </div>

        <div className="catalog-scrollable-list custom-scroll" style={{ maxHeight: 'calc(100vh - 560px)', minHeight: '240px' }}>
          {visibleWorkshops.map((workshop) => (
            <button
              key={workshop.id}
              type="button"
              className={`catalog-card ${selectedId === workshop.id ? 'is-selected' : ''}`}
              onClick={() => selectWorkshop(workshop)}
            >
              <strong style={{ display: 'block', fontSize: '0.95rem' }}>{workshop.name || workshop.id}</strong>
              <span className="muted" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{workshop.id}</span>
              <span className="muted" style={{ fontSize: '0.75rem' }}>{workshop.workshopKind} · tier {workshop.tier}</span>
            </button>
          ))}
          {visibleWorkshops.length === 0 ? <p className="muted">Нет мастерских.</p> : null}
        </div>

        <button type="button" className="action-btn-lw secondary" style={{ width: '100%', marginTop: '0.8rem', borderStyle: 'dashed' }} onClick={createNew}>
          + Новая мастерская
        </button>

        <div className="card" style={{ padding: '0.8rem', marginTop: '0.8rem' }}>
          <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Стартовые мастерские</h5>
          <button type="button" className="action-btn-lw secondary" style={{ width: '100%' }} onClick={() => void prepareStarterPreview()}>
            Добавить стартовые мастерские
          </button>
          <p className="muted" style={{ margin: '0.45rem 0 0 0', fontSize: '0.78rem' }}>Режим: missing only.</p>
          {pendingStarterAdd ? (
            <div style={{ marginTop: '0.6rem', padding: '0.5rem', border: '1px solid rgba(169,139,87,0.25)', borderRadius: 6 }}>
              <div style={{ fontSize: '0.82rem' }}>Preview: добавить {pendingStarterAdd.createdCount}, пропустить {pendingStarterAdd.skippedCount}</div>
              <div style={{ fontSize: '0.78rem' }} className="muted">IDs: {pendingStarterAdd.firstIds.join(', ') || '—'}</div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                <button type="button" className="action-btn-lw primary" onClick={() => void confirmStarterAdd()} disabled={pendingStarterAdd.errors.length > 0 || isSaving}>
                  Подтвердить
                </button>
                <button type="button" className="action-btn-lw secondary" onClick={() => setPendingStarterAdd(null)}>
                  Отмена
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="card" style={{ padding: '0.8rem', marginTop: '0.8rem' }}>
          <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Import / Export JSON</h5>
          <button type="button" className="action-btn-lw secondary" style={{ width: '100%', marginBottom: '0.5rem' }} onClick={handleExportAll}>
            Экспортировать мастерские
          </button>
          <label className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>
            Режим импорта:
            <select className="filter-select" value={importMode} onChange={(event) => setImportMode(event.target.value as JsonImportMode)} style={{ marginTop: '0.2rem' }}>
              <option value="addOnly">Добавить новые</option>
              <option value="merge">Обновить и добавить</option>
              <option value="replaceAll">Полная замена</option>
            </select>
          </label>
          <button type="button" className="action-btn-lw primary" style={{ width: '100%', marginTop: '0.4rem' }} onClick={() => importFileRef.current?.click()}>
            Загрузить файл (preview)
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          {pendingImport ? (
            <div style={{ marginTop: '0.6rem', padding: '0.5rem', border: '1px solid rgba(169,139,87,0.25)', borderRadius: 6 }}>
              <div style={{ fontSize: '0.82rem' }}>Файл: {pendingImport.fileName}</div>
              <div style={{ fontSize: '0.82rem' }}>
                Найдено {pendingImport.totalFound}, добавить {pendingImport.createdCount}, обновить {pendingImport.updatedCount}, пропустить {pendingImport.skippedCount}
              </div>
              {pendingImport.mode === 'replaceAll' ? (
                <div style={{ fontSize: '0.78rem', color: '#ffb36b' }}>
                  Replace warning: будет заменено текущих записей {pendingImport.replaceWarningCount}
                </div>
              ) : null}
              {pendingImport.firstIds.length > 0 ? <div className="muted" style={{ fontSize: '0.78rem' }}>IDs: {pendingImport.firstIds.join(', ')}</div> : null}
              {pendingImport.errors.length > 0 ? (
                <ul className="muted" style={{ margin: '0.4rem 0 0 1rem', padding: 0 }}>
                  {pendingImport.errors.map((error, index) => <li key={`import-error-${index}`}>{error}</li>)}
                </ul>
              ) : null}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                <button type="button" className="action-btn-lw primary" onClick={() => void confirmImport()} disabled={pendingImport.errors.length > 0 || isSaving}>
                  Подтвердить импорт
                </button>
                <button type="button" className="action-btn-lw secondary" onClick={() => setPendingImport(null)}>
                  Отмена
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="living-editor-main">
        <div className="living-toolbar" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0 }}>{selectedId ? 'Редактор мастерской' : 'Новая мастерская'}</h2>
            <p className="muted" style={{ margin: '0.3rem 0 0 0' }}>{status}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <button type="button" className="action-btn-lw primary" onClick={() => void saveCurrent()} disabled={isSaving}>
              Сохранить
            </button>
            <button type="button" className="action-btn-lw danger" onClick={() => void removeCurrent()} disabled={!selectedId || isSaving}>
              Удалить
            </button>
          </div>
        </div>

        <AdminSaveStatus value={saveState} />

        <div className="card" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label><span>ID</span><input value={draft.id} onChange={(event) => patch({ id: event.target.value })} /></label>
            <label><span>Название</span><input value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></label>
            <label><span>professionId</span><input value={draft.professionId} onChange={(event) => patch({ professionId: event.target.value })} /></label>
            <label>
              <span>workshopKind</span>
              <select value={draft.workshopKind} onChange={(event) => patch({ workshopKind: event.target.value as ProfessionWorkshopKind })}>
                {WORKSHOP_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
              </select>
            </label>
            <label>
              <span>status</span>
              <select value={draft.status} onChange={(event) => patch({ status: event.target.value as ProfessionWorkshopDefinition['status'] })}>
                {WORKSHOP_STATUSES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label><span>tier</span><input type="number" min={1} value={draft.tier} onChange={(event) => patch({ tier: Number(event.target.value) || 1 })} /></label>
            <label><span>requiredReputation</span><input type="number" min={0} value={draft.requiredReputation ?? 0} onChange={(event) => patch({ requiredReputation: Number(event.target.value) || 0 })} /></label>
            <label><span>requiredQuestId</span><input value={draft.requiredQuestId ?? ''} onChange={(event) => patch({ requiredQuestId: event.target.value })} /></label>
            <label><span>requiredFactionId</span><input value={draft.requiredFactionId ?? ''} onChange={(event) => patch({ requiredFactionId: event.target.value })} /></label>
            <label><span>createdAt</span><input value={draft.createdAt ?? ''} onChange={(event) => patch({ createdAt: event.target.value })} /></label>
            <label><span>updatedAt</span><input value={draft.updatedAt ?? ''} onChange={(event) => patch({ updatedAt: event.target.value })} /></label>
            <label className="full-width"><span>Описание</span><textarea rows={3} value={draft.description ?? ''} onChange={(event) => patch({ description: event.target.value })} /></label>
            <label className="full-width"><span>stationTypes (по одному на строку)</span><textarea rows={4} value={toMultiline(draft.stationTypes)} onChange={(event) => patch({ stationTypes: parseMultiline(event.target.value) })} /></label>
            <label className="full-width"><span>allowedTemplateGroups</span><textarea rows={3} value={toMultiline(draft.allowedTemplateGroups)} onChange={(event) => patch({ allowedTemplateGroups: parseMultiline(event.target.value) })} /></label>
            <label className="full-width"><span>forbiddenTemplateGroups</span><textarea rows={3} value={toMultiline(draft.forbiddenTemplateGroups)} onChange={(event) => patch({ forbiddenTemplateGroups: parseMultiline(event.target.value) })} /></label>
            <label className="full-width"><span>allowedTemplateIds</span><textarea rows={3} value={toMultiline(draft.allowedTemplateIds)} onChange={(event) => patch({ allowedTemplateIds: parseMultiline(event.target.value) })} /></label>
            <label className="full-width"><span>forbiddenTemplateIds</span><textarea rows={3} value={toMultiline(draft.forbiddenTemplateIds)} onChange={(event) => patch({ forbiddenTemplateIds: parseMultiline(event.target.value) })} /></label>
            <label className="full-width"><span>tags</span><textarea rows={2} value={toMultiline(draft.tags)} onChange={(event) => patch({ tags: parseMultiline(event.target.value) })} /></label>
            <label className="full-width">
              <span>imageRef (JSON)</span>
              <textarea
                rows={4}
                value={imageRefDraft}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setImageRefDraft(nextValue);
                  if (!nextValue.trim()) {
                    patch({ imageRef: undefined });
                    return;
                  }
                  try {
                    patch({ imageRef: JSON.parse(nextValue) as ProfessionWorkshopDefinition['imageRef'] });
                  } catch {
                    // Keep raw JSON visible until it becomes valid.
                  }
                }}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>Изображение мастерской</h3>
            <ImageSheetPicker
              label="Интерьер мастерской"
              hint="Загрузка идёт через текущий upload pipeline и сохраняет совместимые imageRef + imagePath."
              category="other"
              value={draft.imageRef}
              legacyImagePath={draft.imagePath}
              runtimeImages={runtimeImages}
              showUploadForImage
              disableManualImageInput
              uploadPresetId="world-location-sprite"
              uploadSuggestedId={draft.id || undefined}
              uploadSuggestedName={`${draft.id || draft.name || 'workshop'}-interior`}
              uploadFolder={buildUploadFolder('images', 'workshops', draft.id || draft.name || undefined)}
              onStatus={setStatus}
              onChange={(next) => patch({
                imageRef: next,
                imagePath: toLegacyImagePath(next) ?? '',
              })}
            />
            <label className="full-width">
              <span>imagePath</span>
              <input value={draft.imagePath ?? ''} onChange={(event) => patch({ imagePath: event.target.value })} />
            </label>
            {previewImage ? (
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="muted" style={{ fontSize: '0.8rem' }}>Preview</span>
                <img
                  src={previewImage}
                  alt={draft.name || draft.id}
                  style={{ width: '100%', maxWidth: 480, maxHeight: 280, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(169,139,87,0.25)' }}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          <h3 style={{ margin: 0 }}>Аренда</h3>
          <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label className="admin-checkbox"><input type="checkbox" checked={draft.rental?.enabled === true} onChange={(event) => patchRental({ enabled: event.target.checked })} /><span>rental.enabled</span></label>
            <label><span>priceGold</span><input type="number" min={0} value={draft.rental?.priceGold ?? 0} onChange={(event) => patchRental({ priceGold: Number(event.target.value) || 0 })} /></label>
            <label><span>durationHours</span><input type="number" min={0} value={draft.rental?.durationHours ?? 0} onChange={(event) => patchRental({ durationHours: Number(event.target.value) || 0 })} /></label>
            <label className="admin-checkbox"><input type="checkbox" checked={draft.rental?.requiresNpcDialogue === true} onChange={(event) => patchRental({ requiresNpcDialogue: event.target.checked })} /><span>requiresNpcDialogue</span></label>
            <label><span>ownerNpcId</span><input value={draft.rental?.ownerNpcId ?? ''} onChange={(event) => patchRental({ ownerNpcId: event.target.value })} /></label>
            <label><span>rentalDialogueId</span><input value={draft.rental?.rentalDialogueId ?? ''} onChange={(event) => patchRental({ rentalDialogueId: event.target.value })} /></label>
          </div>
          <NpcReferenceSelector
            label="NPC-владелец мастерской"
            selectedIds={draft.rental?.ownerNpcId?.trim() ? [draft.rental.ownerNpcId.trim()] : []}
            onChange={(nextIds) => patchRental({ ownerNpcId: nextIds[0] ?? '' })}
            npcs={npcs}
            cities={cities}
            locations={locations}
            zones={zones}
            context={{ professionId: draft.professionId, workshopId: draft.id }}
            extraContexts={draftWorkshopContexts}
            single
            manualPlaceholder={'npc_carpenter_master_argos'}
          />
        </div>

        <div className="card" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          <h3 style={{ margin: 0 }}>Access Rules</h3>
          <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label className="admin-checkbox"><input type="checkbox" checked={draft.accessRules?.publicAccess !== false} onChange={(event) => patchAccessRules({ publicAccess: event.target.checked })} /><span>publicAccess</span></label>
            <label className="admin-checkbox"><input type="checkbox" checked={draft.accessRules?.onlyCitizens === true} onChange={(event) => patchAccessRules({ onlyCitizens: event.target.checked })} /><span>onlyCitizens</span></label>
            <label><span>kingdomId</span><input value={draft.accessRules?.kingdomId ?? ''} onChange={(event) => patchAccessRules({ kingdomId: event.target.value })} /></label>
            <label><span>factionId</span><input value={draft.accessRules?.factionId ?? ''} onChange={(event) => patchAccessRules({ factionId: event.target.value })} /></label>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>Interaction Points</h3>
            <button type="button" className="action-btn-lw secondary" onClick={addInteractionPoint}>+ Добавить точку</button>
          </div>
          {(draft.interactionPoints ?? []).length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Точки пока не добавлены. Координаты задаются в процентах 0-100.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              {(draft.interactionPoints ?? []).map((point, index) => (
                <div key={`${point.id}-${index}`} style={{ border: '1px solid rgba(169,139,87,0.25)', borderRadius: 10, padding: '0.9rem', display: 'grid', gap: '0.7rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
                    <strong>{point.label || point.id || `Point ${index + 1}`}</strong>
                    <button type="button" className="action-btn-lw danger" onClick={() => removeInteractionPoint(index)}>Удалить</button>
                  </div>
                  <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    <label><span>ID</span><input value={point.id} onChange={(event) => patchInteractionPoint(index, { id: event.target.value })} /></label>
                    <label><span>label</span><input value={point.label} onChange={(event) => patchInteractionPoint(index, { label: event.target.value })} /></label>
                    <label>
                      <span>type</span>
                      <select value={point.type} onChange={(event) => patchInteractionPoint(index, { type: event.target.value as ProfessionWorkshopInteractionType })}>
                        {INTERACTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>
                    <label><span>x %</span><input type="number" min={0} max={100} value={point.x} onChange={(event) => patchInteractionPoint(index, { x: Number(event.target.value) || 0 })} /></label>
                    <label><span>y %</span><input type="number" min={0} max={100} value={point.y} onChange={(event) => patchInteractionPoint(index, { y: Number(event.target.value) || 0 })} /></label>
                    <label><span>stationType</span><input value={point.stationType ?? ''} onChange={(event) => patchInteractionPoint(index, { stationType: event.target.value })} /></label>
                    <label><span>npcId</span><input value={point.npcId ?? ''} onChange={(event) => patchInteractionPoint(index, { npcId: event.target.value })} /></label>
                    <label><span>dialogId</span><input value={point.dialogId ?? ''} onChange={(event) => patchInteractionPoint(index, { dialogId: event.target.value })} /></label>
                    <label><span>serviceId</span><input value={point.serviceId ?? ''} onChange={(event) => patchInteractionPoint(index, { serviceId: event.target.value })} /></label>
                    <label><span>requiredWorkshopTier</span><input type="number" min={0} value={point.requiredWorkshopTier ?? 0} onChange={(event) => patchInteractionPoint(index, { requiredWorkshopTier: Number(event.target.value) || 0 })} /></label>
                    <label><span>requiredQuestId</span><input value={point.requiredQuestId ?? ''} onChange={(event) => patchInteractionPoint(index, { requiredQuestId: event.target.value })} /></label>
                    <label><span>requiredSkillId</span><input value={point.requiredSkillId ?? ''} onChange={(event) => patchInteractionPoint(index, { requiredSkillId: event.target.value })} /></label>
                    <label className="admin-checkbox"><input type="checkbox" checked={point.isEnabled !== false} onChange={(event) => patchInteractionPoint(index, { isEnabled: event.target.checked })} /><span>isEnabled</span></label>
                    <label className="full-width"><span>description</span><textarea rows={2} value={point.description ?? ''} onChange={(event) => patchInteractionPoint(index, { description: event.target.value })} /></label>
                  </div>
                  {point.type === 'npc' ? (
                    <NpcReferenceSelector
                      label={`NPC для точки ${point.label || point.id || index + 1}`}
                      selectedIds={point.npcId?.trim() ? [point.npcId.trim()] : []}
                      onChange={(nextIds) => patchInteractionPoint(index, { npcId: nextIds[0] ?? '' })}
                      npcs={npcs}
                      cities={cities}
                      locations={locations}
                      zones={zones}
                      context={{ professionId: draft.professionId, workshopId: draft.id }}
                      extraContexts={draftWorkshopContexts}
                      single
                      manualPlaceholder={'npc_carpenter_master_argos'}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Preview</h3>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(draft, null, 2)}</pre>
        </div>

        {(validation.errors.length > 0 || validation.warnings.length > 0) ? (
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Проверка</h3>
            {validation.errors.length > 0 ? (
              <>
                <strong style={{ color: '#ff8f8f' }}>Ошибки</strong>
                <ul>
                  {validation.errors.map((error, index) => <li key={`err-${index}`}>{error}</li>)}
                </ul>
              </>
            ) : null}
            {validation.warnings.length > 0 ? (
              <>
                <strong style={{ color: '#f6d680' }}>Предупреждения</strong>
                <ul>
                  {validation.warnings.map((warning, index) => <li key={`warn-${index}`}>{warning}</li>)}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
