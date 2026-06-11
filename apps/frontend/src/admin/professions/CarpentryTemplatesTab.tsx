import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from '../../services/content/contentApi';
import type {
  AdminSkill,
  CarpenterComponentKind,
  CarpenterItemTemplate,
  CarpenterRecipeGroup,
  CarpenterStationType,
  CarpenterTemplateDifficultyType,
  CarpenterTemplateInputSlot,
  CarpenterTraitTransferRule,
} from '../../services/content/models';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { runSaveWithFeedback, type AdminSaveViewModel, useAdminSaveShortcut } from '../adminSaveTools';
import { AdminFieldLabel } from '../adminUi';
import { downloadCollectionJson, extractRawCollectionFromImportJson, importCollectionFromJsonEntries, type JsonImportMode } from '../../services/content/adminJsonImportExport';
import '../pages/LivingWorldPage.css';

type TemplateSubTab = 'general' | 'inputs' | 'traits' | 'json';

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

const CARPENTER_RECIPE_GROUPS: CarpenterRecipeGroup[] = [
  'construction',
  'furniture',
  'weapon_parts',
  'armor_parts',
  'transport_parts',
  'tools',
  'household',
  'ritual',
  'misc',
];

const CARPENTER_STATIONS: CarpenterStationType[] = [
  'none',
  'workbench',
  'sawmill',
  'drying_rack',
  'carving_table',
  'assembly_table',
];

const CARPENTER_DIFFICULTY: CarpenterTemplateDifficultyType[] = ['basic', 'standard', 'advanced', 'master'];

const CARPENTER_COMPONENT_KINDS: CarpenterComponentKind[] = [
  'log',
  'plank',
  'beam',
  'board',
  'shaft',
  'handle',
  'frame',
  'panel',
  'binding',
  'resin_part',
  'bark_part',
  'charcoal_part',
  'composite',
  'unknown',
];

function defaultInputSlot(index: number): CarpenterTemplateInputSlot {
  return {
    id: `slot_${index + 1}`,
    label: `Слот ${index + 1}`,
    quantity: 1,
    required: true,
    acceptedComponentKinds: [],
    acceptedItemIds: [],
    acceptedMaterialIds: [],
    notes: '',
  };
}

function defaultTraitRule(): CarpenterTraitTransferRule {
  return {
    sourceTraitTag: '',
    targetTraitTag: '',
    transferPercent: 100,
    notes: '',
  };
}

function createEmptyTemplate(): CarpenterItemTemplate {
  return {
    id: '',
    name: '',
    description: '',
    recipeGroup: 'misc',
    stationType: 'workbench',
    difficulty: 'basic',
    outputItemId: '',
    outputComponentKind: 'unknown',
    outputQuantity: 1,
    requiredCarpenterLevel: 1,
    requiredSkillIds: [],
    inputSlots: [defaultInputSlot(0)],
    traitTransferRules: [],
    tags: [],
    isEnabled: true,
    notes: '',
  };
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

function normalizeTemplateInput(raw: CarpenterItemTemplate): CarpenterItemTemplate {
  const next = { ...createEmptyTemplate(), ...raw };
  next.id = String(next.id ?? '').trim();
  next.name = String(next.name ?? '').trim();
  next.description = String(next.description ?? '').trim();
  next.outputItemId = String(next.outputItemId ?? '').trim();
  next.notes = String(next.notes ?? '').trim();
  next.outputQuantity = Math.max(1, Number.isFinite(Number(next.outputQuantity)) ? Math.round(Number(next.outputQuantity)) : 1);
  next.requiredCarpenterLevel = Math.max(1, Number.isFinite(Number(next.requiredCarpenterLevel)) ? Math.round(Number(next.requiredCarpenterLevel)) : 1);
  next.requiredSkillIds = (next.requiredSkillIds ?? []).map((id) => String(id).trim()).filter(Boolean);
  next.tags = (next.tags ?? []).map((id) => String(id).trim()).filter(Boolean);
  next.inputSlots = Array.isArray(next.inputSlots) && next.inputSlots.length > 0
    ? next.inputSlots.map((slot, index) => ({
      id: String(slot?.id ?? '').trim() || `slot_${index + 1}`,
      label: String(slot?.label ?? '').trim() || `Слот ${index + 1}`,
      quantity: Math.max(1, Number.isFinite(Number(slot?.quantity)) ? Math.round(Number(slot?.quantity)) : 1),
      required: slot?.required !== false,
      acceptedComponentKinds: (slot?.acceptedComponentKinds ?? [])
        .map((kind) => String(kind).trim() as CarpenterComponentKind)
        .filter((kind) => Boolean(kind)),
      acceptedItemIds: (slot?.acceptedItemIds ?? []).map((id) => String(id).trim()).filter(Boolean),
      acceptedMaterialIds: (slot?.acceptedMaterialIds ?? []).map((id) => String(id).trim()).filter(Boolean),
      notes: String(slot?.notes ?? '').trim(),
    }))
    : [defaultInputSlot(0)];
  next.traitTransferRules = Array.isArray(next.traitTransferRules)
    ? next.traitTransferRules.map((rule) => ({
      sourceTraitTag: String(rule?.sourceTraitTag ?? '').trim(),
      targetTraitTag: String(rule?.targetTraitTag ?? '').trim(),
      transferPercent: Math.max(0, Math.min(100, Number.isFinite(Number(rule?.transferPercent)) ? Number(rule?.transferPercent) : 100)),
      notes: String(rule?.notes ?? '').trim(),
    }))
    : [];
  next.isEnabled = next.isEnabled !== false;
  return next;
}

function validateTemplateInput(template: CarpenterItemTemplate, knownSkillIds: Set<string>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!template.id.trim()) {
    errors.push('ID шаблона обязателен.');
  }
  if (!template.name.trim()) {
    errors.push('Название шаблона обязательно.');
  }
  if (!template.outputComponentKind) {
    errors.push('Нужно указать outputComponentKind.');
  }
  if (!Array.isArray(template.inputSlots) || template.inputSlots.length === 0) {
    errors.push('Нужен хотя бы один inputSlot.');
  }

  const slotIds = new Set<string>();
  for (const slot of template.inputSlots ?? []) {
    const slotId = String(slot.id ?? '').trim();
    if (!slotId) {
      errors.push('Каждый inputSlot должен иметь id.');
      continue;
    }
    if (slotIds.has(slotId)) {
      errors.push(`Повторяющийся inputSlot.id: ${slotId}`);
    }
    slotIds.add(slotId);
    if (!slot.label?.trim()) {
      errors.push(`Input slot ${slotId}: label обязателен.`);
    }
    if (!Number.isFinite(slot.quantity) || slot.quantity <= 0) {
      errors.push(`Input slot ${slotId}: quantity должен быть > 0.`);
    }
    if (!Array.isArray(slot.acceptedComponentKinds) || slot.acceptedComponentKinds.length === 0) {
      warnings.push(`Input slot ${slotId}: acceptedComponentKinds пока пустой.`);
    }
  }

  for (const rule of template.traitTransferRules ?? []) {
    if (!String(rule.sourceTraitTag ?? '').trim()) {
      errors.push('Каждое правило traitTransferRules должно иметь sourceTraitTag.');
    }
    if (!Number.isFinite(rule.transferPercent) || rule.transferPercent < 0 || rule.transferPercent > 100) {
      errors.push(`Некорректный transferPercent у sourceTraitTag=${rule.sourceTraitTag || 'unknown'}.`);
    }
  }

  for (const skillId of template.requiredSkillIds ?? []) {
    if (skillId && !knownSkillIds.has(skillId)) {
      warnings.push(`requiredSkillIds: навык '${skillId}' не найден в коллекции skills.`);
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
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const normalizedEntries: T[] = [];

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

function createStarterCarpenterTemplates(): CarpenterItemTemplate[] {
  return [
    normalizeTemplateInput({
      id: 'carpenter_template_plank_shield_core',
      name: 'Щитовой сердечник из досок',
      description: 'Базовый деревянный сердечник для будущих щитов.',
      recipeGroup: 'armor_parts',
      stationType: 'workbench',
      difficulty: 'basic',
      outputComponentKind: 'panel',
      outputQuantity: 1,
      requiredCarpenterLevel: 1,
      requiredSkillIds: ['carpenter_basic_joinery'],
      inputSlots: [
        {
          id: 'main_planks',
          label: 'Доски основы',
          quantity: 3,
          required: true,
          acceptedComponentKinds: ['plank', 'board'],
          acceptedItemIds: [],
          acceptedMaterialIds: [],
          notes: '',
        },
        {
          id: 'binder',
          label: 'Связующий материал',
          quantity: 1,
          required: false,
          acceptedComponentKinds: ['binding', 'resin_part'],
          acceptedItemIds: [],
          acceptedMaterialIds: [],
          notes: '',
        },
      ],
      traitTransferRules: [
        { sourceTraitTag: 'shield_grade', targetTraitTag: 'shield_grade', transferPercent: 100, notes: '' },
        { sourceTraitTag: 'hard', targetTraitTag: 'hard', transferPercent: 70, notes: '' },
      ],
      tags: ['starter', 'shield', 'component'],
      isEnabled: true,
      notes: 'Только справочник template-ов, без runtime crafting.',
    }),
    normalizeTemplateInput({
      id: 'carpenter_template_tool_handle_standard',
      name: 'Стандартная рукоять инструмента',
      description: 'Универсальная рукоять для будущих инструментов.',
      recipeGroup: 'tools',
      stationType: 'carving_table',
      difficulty: 'standard',
      outputComponentKind: 'handle',
      outputQuantity: 1,
      requiredCarpenterLevel: 3,
      requiredSkillIds: ['carpenter_toolmaking'],
      inputSlots: [
        {
          id: 'shaft_source',
          label: 'Заготовка древка',
          quantity: 1,
          required: true,
          acceptedComponentKinds: ['shaft', 'beam'],
          acceptedItemIds: [],
          acceptedMaterialIds: [],
          notes: '',
        },
      ],
      traitTransferRules: [
        { sourceTraitTag: 'flexible', targetTraitTag: 'flexible', transferPercent: 80, notes: '' },
      ],
      tags: ['starter', 'tools', 'component'],
      isEnabled: true,
      notes: 'Справочный шаблон. Ничего не крафтит в runtime.',
    }),
    normalizeTemplateInput({
      id: 'carpenter_template_cart_frame_reinforced',
      name: 'Усиленная рама повозки',
      description: 'Каркас транспортной платформы из балок и досок.',
      recipeGroup: 'transport_parts',
      stationType: 'assembly_table',
      difficulty: 'advanced',
      outputComponentKind: 'frame',
      outputQuantity: 1,
      requiredCarpenterLevel: 6,
      requiredSkillIds: ['carpenter_transport_framework'],
      inputSlots: [
        {
          id: 'main_beams',
          label: 'Основные балки',
          quantity: 2,
          required: true,
          acceptedComponentKinds: ['beam'],
          acceptedItemIds: [],
          acceptedMaterialIds: [],
          notes: '',
        },
        {
          id: 'support_boards',
          label: 'Поддерживающие доски',
          quantity: 4,
          required: true,
          acceptedComponentKinds: ['board', 'plank'],
          acceptedItemIds: [],
          acceptedMaterialIds: [],
          notes: '',
        },
      ],
      traitTransferRules: [
        { sourceTraitTag: 'building_grade', targetTraitTag: 'building_grade', transferPercent: 90, notes: '' },
        { sourceTraitTag: 'dense', targetTraitTag: 'dense', transferPercent: 60, notes: '' },
      ],
      tags: ['starter', 'transport', 'component'],
      isEnabled: true,
      notes: 'Хранится как template-схема без запуска craft action.',
    }),
  ];
}

export function CarpentryTemplatesTab() {
  const [templates, setTemplates] = useState<CarpenterItemTemplate[]>([]);
  const [skills, setSkills] = useState<AdminSkill[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CarpenterItemTemplate>(createEmptyTemplate());
  const [query, setQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<'all' | CarpenterRecipeGroup>('all');
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [activeSubTab, setActiveSubTab] = useState<TemplateSubTab>('general');

  const [status, setStatus] = useState('Готово');
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [importMode, setImportMode] = useState<JsonImportMode>('addOnly');
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const [pendingImport, setPendingImport] = useState<PendingImportPreview<CarpenterItemTemplate> | null>(null);
  const [pendingStarterAdd, setPendingStarterAdd] = useState<PendingImportPreview<CarpenterItemTemplate> | null>(null);
  const [validation, setValidation] = useState<ValidationResult>({ errors: [], warnings: [] });

  const starterTemplates = useMemo(() => createStarterCarpenterTemplates(), []);
  const knownSkillIds = useMemo(() => new Set(skills.map((skill) => String(skill.id ?? '').trim()).filter(Boolean)), [skills]);

  async function refresh() {
    try {
      const [nextTemplates, nextSkills] = await Promise.all([
        getContentCollection<CarpenterItemTemplate>('carpenterItemTemplates'),
        getContentCollection<AdminSkill>('skills'),
      ]);
      setTemplates(nextTemplates ?? []);
      setSkills(nextSkills ?? []);
      if (selectedId && !(nextTemplates ?? []).some((entry) => entry.id === selectedId)) {
        setSelectedId(null);
        setDraft(createEmptyTemplate());
      }
    } catch (error) {
      console.error(error);
      setStatus('Ошибка загрузки шаблонов плотника.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    setValidation(validateTemplateInput(draft, knownSkillIds));
  }, [draft, knownSkillIds]);

  const visibleTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((template) => {
      const byQuery = !q
        || template.id.toLowerCase().includes(q)
        || template.name.toLowerCase().includes(q)
        || (template.description ?? '').toLowerCase().includes(q);
      const byGroup = filterGroup === 'all' || template.recipeGroup === filterGroup;
      const byEnabled = filterEnabled === 'all'
        || (filterEnabled === 'enabled' ? template.isEnabled !== false : template.isEnabled === false);
      return byQuery && byGroup && byEnabled;
    });
  }, [templates, query, filterGroup, filterEnabled]);

  function clearImportPreview() {
    setPendingImport(null);
  }

  function clearStarterPreview() {
    setPendingStarterAdd(null);
  }

  function selectTemplate(template: CarpenterItemTemplate) {
    setSelectedId(template.id);
    setDraft(normalizeTemplateInput(template));
    setActiveSubTab('general');
  }

  function createNew() {
    setSelectedId(null);
    setDraft(createEmptyTemplate());
    setActiveSubTab('general');
  }

  function patch(next: Partial<CarpenterItemTemplate>) {
    setDraft((current) => normalizeTemplateInput({ ...current, ...next }));
  }

  function updateInputSlot(index: number, patchValue: Partial<CarpenterTemplateInputSlot>) {
    const next = [...(draft.inputSlots ?? [])];
    next[index] = { ...next[index], ...patchValue };
    patch({ inputSlots: next });
  }

  function addInputSlot() {
    const next = [...(draft.inputSlots ?? []), defaultInputSlot(draft.inputSlots?.length ?? 0)];
    patch({ inputSlots: next });
  }

  function removeInputSlot(index: number) {
    const next = [...(draft.inputSlots ?? [])];
    next.splice(index, 1);
    patch({ inputSlots: next.length > 0 ? next : [defaultInputSlot(0)] });
  }

  function updateTraitRule(index: number, patchValue: Partial<CarpenterTraitTransferRule>) {
    const next = [...(draft.traitTransferRules ?? [])];
    next[index] = { ...next[index], ...patchValue };
    patch({ traitTransferRules: next });
  }

  function addTraitRule() {
    patch({ traitTransferRules: [...(draft.traitTransferRules ?? []), defaultTraitRule()] });
  }

  function removeTraitRule(index: number) {
    const next = [...(draft.traitTransferRules ?? [])];
    next.splice(index, 1);
    patch({ traitTransferRules: next });
  }

  async function saveCurrent() {
    if (isSaving) return;
    const normalized = normalizeTemplateInput(draft);
    const check = validateTemplateInput(normalized, knownSkillIds);
    setValidation(check);
    if (check.errors.length > 0) {
      setStatus('Ошибка: исправьте ошибки шаблона перед сохранением.');
      return;
    }

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: normalized.id || 'carpenter_template',
      onSave: async () => {
        const payload = normalizeTemplateInput(normalized);
        if (!payload.id) {
          throw new Error('ID шаблона обязателен.');
        }
        if (selectedId && selectedId !== payload.id) {
          await deleteContentEntry('carpenterItemTemplates', selectedId);
          return createContentEntry('carpenterItemTemplates', payload);
        }
        if (templates.some((entry) => entry.id === payload.id)) {
          return updateContentEntry('carpenterItemTemplates', payload.id, payload);
        }
        return createContentEntry('carpenterItemTemplates', payload);
      },
      onAfterSave: async (entry) => {
        const verified = await getContentEntry<CarpenterItemTemplate>('carpenterItemTemplates', entry.id);
        if (!verified) {
          throw new Error('Запись не найдена на бэкенде после сохранения.');
        }
      },
      successLabel: (entry) => `Шаблон сохранён: ${entry.id}`,
    });

    if (saved) {
      setSelectedId(saved.id);
      setDraft(normalizeTemplateInput(saved));
      await refresh();
      setStatus(`Шаблон сохранён: ${saved.id}`);
    }
    setIsSaving(false);
  }

  async function removeCurrent() {
    if (!selectedId) return;
    if (!window.confirm(`Удалить шаблон ${selectedId}?`)) return;
    try {
      await deleteContentEntry('carpenterItemTemplates', selectedId);
      setSelectedId(null);
      setDraft(createEmptyTemplate());
      await refresh();
      setStatus(`Шаблон удалён: ${selectedId}`);
    } catch (error) {
      console.error(error);
      setStatus('Ошибка удаления шаблона.');
    }
  }

  function handleExportAll() {
    downloadCollectionJson({
      filePrefix: 'theend_carpenter_item_templates',
      collectionKey: 'carpenterItemTemplates',
      entries: templates,
    });
    setStatus(`Экспортировано шаблонов: ${templates.length}.`);
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    clearImportPreview();
    setStatus('Подготовка preview импорта шаблонов...');
    try {
      const parsed = JSON.parse(await file.text());
      const entries = extractRawCollectionFromImportJson(parsed, 'carpenterItemTemplates');
      if (!Array.isArray(entries)) {
        throw new Error('В файле не найдена коллекция carpenterItemTemplates.');
      }
      const existing = await getContentCollection<CarpenterItemTemplate>('carpenterItemTemplates');
      const preview = buildImportPreview<CarpenterItemTemplate>({
        fileName: file.name,
        mode: importMode,
        entries: entries as CarpenterItemTemplate[],
        existingIds: existing.map((entry) => entry.id),
        replaceWarningCount: importMode === 'replaceAll' ? existing.length : 0,
        normalize: (value) => normalizeTemplateInput(value),
        validate: (value) => validateTemplateInput(value, knownSkillIds).errors,
      });
      setPendingImport(preview);
      setStatus('Preview импорта шаблонов готов. Подтвердите импорт.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка импорта.';
      setPendingImport({
        fileName: file.name,
        mode: importMode,
        totalFound: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        replaceWarningCount: 0,
        firstIds: [],
        errors: [message],
        entries: [],
      });
      setStatus(message);
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    if (pendingImport.mode === 'replaceAll') {
      if (!window.confirm('ВНИМАНИЕ: Replace all полностью заменит коллекцию carpenterItemTemplates. Продолжить?')) return;
      if (!window.confirm('Подтвердите ещё раз: текущие шаблоны будут удалены и заменены импортом.')) return;
    }
    setIsSaving(true);
    setStatus('Импорт шаблонов...');
    try {
      const result = await importCollectionFromJsonEntries<CarpenterItemTemplate>({
        entries: pendingImport.entries,
        defaults: createEmptyTemplate,
        normalize: (value) => normalizeTemplateInput(value),
        validate: (value) => validateTemplateInput(value, knownSkillIds).errors,
        getAll: () => getContentCollection<CarpenterItemTemplate>('carpenterItemTemplates'),
        create: (value) => createContentEntry('carpenterItemTemplates', value),
        update: (id, value) => updateContentEntry('carpenterItemTemplates', id, value),
        delete: (id) => deleteContentEntry('carpenterItemTemplates', id),
        mode: pendingImport.mode,
      });
      await refresh();
      clearImportPreview();
      setStatus(`Импорт завершён: добавлено ${result.created.length}, обновлено ${result.updated.length}, пропущено ${result.skippedExisting.length}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка импорта шаблонов.');
    } finally {
      setIsSaving(false);
    }
  }

  async function prepareStarterTemplatesPreview() {
    clearStarterPreview();
    const existing = await getContentCollection<CarpenterItemTemplate>('carpenterItemTemplates');
    const preview = buildImportPreview<CarpenterItemTemplate>({
      fileName: 'starter-carpenter-templates',
      mode: 'addOnly',
      entries: starterTemplates,
      existingIds: existing.map((entry) => entry.id),
      replaceWarningCount: 0,
      normalize: (value) => normalizeTemplateInput(value),
      validate: (value) => validateTemplateInput(value, knownSkillIds).errors,
    });
    setPendingStarterAdd(preview);
    setStatus(`Preview стартового набора готов: будет добавлено ${preview.createdCount}, пропущено ${preview.skippedCount}.`);
  }

  async function confirmStarterTemplatesAdd() {
    if (!pendingStarterAdd) return;
    if (!window.confirm(`Добавить стартовые шаблоны плотника? Будет добавлено только новых: ${pendingStarterAdd.createdCount}.`)) return;
    setIsSaving(true);
    setStatus('Добавление стартовых шаблонов...');
    try {
      const result = await importCollectionFromJsonEntries<CarpenterItemTemplate>({
        entries: pendingStarterAdd.entries,
        defaults: createEmptyTemplate,
        normalize: (value) => normalizeTemplateInput(value),
        validate: (value) => validateTemplateInput(value, knownSkillIds).errors,
        getAll: () => getContentCollection<CarpenterItemTemplate>('carpenterItemTemplates'),
        create: (value) => createContentEntry('carpenterItemTemplates', value),
        update: (id, value) => updateContentEntry('carpenterItemTemplates', id, value),
        mode: 'addOnly',
      });
      await refresh();
      clearStarterPreview();
      setStatus(`Стартовый набор: добавлено ${result.created.length}, пропущено существующих ${result.skippedExisting.length}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка добавления стартового набора.');
    } finally {
      setIsSaving(false);
    }
  }

  useAdminSaveShortcut({
    enabled: true,
    isSaving,
    onSave: saveCurrent,
  });

  return (
    <div className="living-editor-grid">
      <section className="catalog-sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Шаблоны плотника</h4>
          <span className="premium-badge">{visibleTemplates.length} / {templates.length}</span>
        </div>

        <input
          className="catalog-search-input"
          placeholder="Поиск по ID/названию..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="filters-grid" style={{ marginTop: '0.6rem', marginBottom: '0.6rem' }}>
          <select className="filter-select" value={filterGroup} onChange={(event) => setFilterGroup(event.target.value as 'all' | CarpenterRecipeGroup)}>
            <option value="all">Все группы</option>
            {CARPENTER_RECIPE_GROUPS.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
          <select className="filter-select" value={filterEnabled} onChange={(event) => setFilterEnabled(event.target.value as 'all' | 'enabled' | 'disabled')}>
            <option value="all">Все статусы</option>
            <option value="enabled">Только включённые</option>
            <option value="disabled">Только выключенные</option>
          </select>
        </div>

        <div className="catalog-scrollable-list custom-scroll" style={{ maxHeight: 'calc(100vh - 540px)', minHeight: '240px' }}>
          {visibleTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`catalog-card ${selectedId === template.id ? 'is-selected' : ''}`}
              onClick={() => selectTemplate(template)}
            >
              <strong style={{ display: 'block', fontSize: '0.95rem' }}>{template.name || template.id}</strong>
              <span className="muted" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{template.id}</span>
            </button>
          ))}
          {visibleTemplates.length === 0 ? <p className="muted">Нет шаблонов.</p> : null}
        </div>

        <button
          type="button"
          className="action-btn-lw secondary"
          style={{ width: '100%', marginTop: '0.8rem', borderStyle: 'dashed' }}
          onClick={createNew}
        >
          + Новый шаблон
        </button>

        <div className="card" style={{ padding: '0.8rem', marginTop: '0.8rem' }}>
          <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Стартовые шаблоны</h5>
          <button type="button" className="action-btn-lw secondary" style={{ width: '100%' }} onClick={() => void prepareStarterTemplatesPreview()}>
            Добавить стартовые шаблоны плотника
          </button>
          {pendingStarterAdd ? (
            <div style={{ marginTop: '0.6rem', padding: '0.5rem', border: '1px solid rgba(169,139,87,0.25)', borderRadius: 6 }}>
              <div style={{ fontSize: '0.82rem' }}>Preview: добавить {pendingStarterAdd.createdCount}, пропустить {pendingStarterAdd.skippedCount}</div>
              <div style={{ fontSize: '0.78rem' }} className="muted">IDs: {pendingStarterAdd.firstIds.join(', ') || '—'}</div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                <button type="button" className="action-btn-lw primary" onClick={() => void confirmStarterTemplatesAdd()} disabled={pendingStarterAdd.errors.length > 0 || isSaving}>
                  Подтвердить
                </button>
                <button type="button" className="action-btn-lw secondary" onClick={clearStarterPreview}>
                  Отмена
                </button>
              </div>
              {pendingStarterAdd.errors.length > 0 ? (
                <ul className="muted" style={{ margin: '0.4rem 0 0 1rem', padding: 0 }}>
                  {pendingStarterAdd.errors.map((error, index) => <li key={`starter-error-${index}`}>{error}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="card" style={{ padding: '0.8rem', marginTop: '0.8rem' }}>
          <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Импорт / Экспорт JSON</h5>
          <button type="button" className="action-btn-lw secondary" style={{ width: '100%', marginBottom: '0.5rem' }} onClick={handleExportAll}>
            Экспортировать шаблоны
          </button>
          <label className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>
            Режим импорта:
            <select className="filter-select" value={importMode} onChange={(event) => setImportMode(event.target.value as JsonImportMode)} style={{ marginTop: '0.2rem' }}>
              <option value="addOnly">Добавить новые</option>
              <option value="merge">Обновить и добавить</option>
              <option value="replaceAll">Полная замена (replace all)</option>
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
              <div style={{ fontSize: '0.78rem' }} className="muted">IDs: {pendingImport.firstIds.join(', ') || '—'}</div>
              {pendingImport.errors.length > 0 ? (
                <ul className="muted" style={{ margin: '0.4rem 0 0 1rem', padding: 0 }}>
                  {pendingImport.errors.map((error, index) => <li key={`import-error-${index}`}>{error}</li>)}
                </ul>
              ) : null}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                <button type="button" className="action-btn-lw primary" onClick={() => void confirmImport()} disabled={pendingImport.errors.length > 0 || isSaving}>
                  Подтвердить импорт
                </button>
                <button type="button" className="action-btn-lw secondary" onClick={clearImportPreview}>
                  Отмена
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="editor-workspace">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent)' }}>
            {selectedId ? `Шаблон: ${draft.name || draft.id}` : 'Создание шаблона'}
          </h4>
          {selectedId ? <span className="muted" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>ID: {selectedId}</span> : null}
        </div>

        <div className="sub-tabs-container">
          {(['general', 'inputs', 'traits', 'json'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`sub-tab-btn ${activeSubTab === tab ? 'is-active' : ''}`}
              onClick={() => setActiveSubTab(tab)}
            >
              {tab === 'general' ? 'Общее' : tab === 'inputs' ? 'Input slots' : tab === 'traits' ? 'Trait transfer' : 'JSON'}
            </button>
          ))}
        </div>

        {validation.errors.length > 0 || validation.warnings.length > 0 ? (
          <div className="card" style={{ padding: '0.6rem', marginBottom: '0.8rem' }}>
            {validation.errors.length > 0 ? (
              <div style={{ marginBottom: validation.warnings.length > 0 ? '0.4rem' : 0 }}>
                <strong style={{ color: '#f08f8f' }}>Ошибки</strong>
                <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                  {validation.errors.map((error, index) => <li key={`err-${index}`}>{error}</li>)}
                </ul>
              </div>
            ) : null}
            {validation.warnings.length > 0 ? (
              <div>
                <strong style={{ color: '#f0c46b' }}>Warnings</strong>
                <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                  {validation.warnings.map((warning, index) => <li key={`warn-${index}`}>{warning}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }} className="custom-scroll">
          {activeSubTab === 'general' ? (
            <div className="form-grid-premium">
              <div className="field-group">
                <AdminFieldLabel label="ID шаблона" hint="Например: carpenter_template_plank_shield_core" />
                <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Название" hint="Отображаемое имя шаблона" />
                <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Группа рецепта" hint="Только классификация для каталога" />
                <select value={draft.recipeGroup} onChange={(event) => patch({ recipeGroup: event.target.value as CarpenterRecipeGroup })}>
                  {CARPENTER_RECIPE_GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}
                </select>
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Станция" hint="Справочная станция, не запускает runtime craft" />
                <select value={draft.stationType} onChange={(event) => patch({ stationType: event.target.value as CarpenterStationType })}>
                  {CARPENTER_STATIONS.map((station) => <option key={station} value={station}>{station}</option>)}
                </select>
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Сложность" hint="Справочный уровень сложности" />
                <select value={draft.difficulty} onChange={(event) => patch({ difficulty: event.target.value as CarpenterTemplateDifficultyType })}>
                  {CARPENTER_DIFFICULTY.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
                </select>
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Output component kind" hint="Категория результата template-а" />
                <select value={draft.outputComponentKind} onChange={(event) => patch({ outputComponentKind: event.target.value as CarpenterComponentKind })}>
                  {CARPENTER_COMPONENT_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                </select>
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Output item ID (optional)" hint="Справочная привязка к будущему item" />
                <input value={draft.outputItemId ?? ''} onChange={(event) => patch({ outputItemId: event.target.value })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Output quantity" hint="Количество на выходе" />
                <input type="number" min={1} value={draft.outputQuantity} onChange={(event) => patch({ outputQuantity: Number(event.target.value) || 1 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Required carpenter level" hint="Требуемый уровень профессии" />
                <input
                  type="number"
                  min={1}
                  value={draft.requiredCarpenterLevel ?? 1}
                  onChange={(event) => patch({ requiredCarpenterLevel: Number(event.target.value) || 1 })}
                />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Required skill IDs" hint="По одному id на строку (warning, если id не найден)" />
                <textarea
                  rows={4}
                  value={toMultiline(draft.requiredSkillIds)}
                  onChange={(event) => patch({ requiredSkillIds: parseMultiline(event.target.value) })}
                />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Tags" hint="По одному тегу на строку" />
                <textarea
                  rows={4}
                  value={toMultiline(draft.tags)}
                  onChange={(event) => patch({ tags: parseMultiline(event.target.value) })}
                />
              </div>
              <div className="field-group" style={{ gridColumn: 'span 2' }}>
                <AdminFieldLabel label="Описание" hint="Описание template-а для админки" />
                <textarea rows={3} value={draft.description ?? ''} onChange={(event) => patch({ description: event.target.value })} />
              </div>
              <div className="field-group" style={{ gridColumn: 'span 2' }}>
                <AdminFieldLabel label="Примечания" hint="Свободные notes, только хранение" />
                <textarea rows={3} value={draft.notes ?? ''} onChange={(event) => patch({ notes: event.target.value })} />
              </div>
              <div className="field-group">
                <label className="zone-editor-checkbox" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', cursor: 'pointer', marginTop: '1.5rem' }}>
                  <input type="checkbox" checked={draft.isEnabled !== false} onChange={(event) => patch({ isEnabled: event.target.checked })} />
                  <span>Шаблон включён</span>
                </label>
              </div>
            </div>
          ) : null}

          {activeSubTab === 'inputs' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {(draft.inputSlots ?? []).map((slot, index) => (
                <div key={`${slot.id}-${index}`} className="card" style={{ padding: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>Input slot #{index + 1}</strong>
                    <button type="button" className="action-btn-lw danger" onClick={() => removeInputSlot(index)}>Удалить слот</button>
                  </div>
                  <div className="form-grid-premium" style={{ marginTop: '0.6rem' }}>
                    <div className="field-group">
                      <AdminFieldLabel label="Slot ID" />
                      <input value={slot.id} onChange={(event) => updateInputSlot(index, { id: event.target.value })} />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="Label" />
                      <input value={slot.label} onChange={(event) => updateInputSlot(index, { label: event.target.value })} />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="Quantity" />
                      <input type="number" min={1} value={slot.quantity} onChange={(event) => updateInputSlot(index, { quantity: Number(event.target.value) || 1 })} />
                    </div>
                    <div className="field-group">
                      <label className="zone-editor-checkbox" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '1.6rem' }}>
                        <input
                          type="checkbox"
                          checked={slot.required !== false}
                          onChange={(event) => updateInputSlot(index, { required: event.target.checked })}
                        />
                        <span>Required</span>
                      </label>
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="acceptedComponentKinds" hint="По одному kind на строку" />
                      <textarea
                        rows={3}
                        value={toMultiline(slot.acceptedComponentKinds as string[])}
                        onChange={(event) => {
                          const values = parseMultiline(event.target.value) as CarpenterComponentKind[];
                          updateInputSlot(index, { acceptedComponentKinds: values });
                        }}
                      />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="acceptedItemIds" hint="Опционально, по одному item id на строку" />
                      <textarea
                        rows={3}
                        value={toMultiline(slot.acceptedItemIds)}
                        onChange={(event) => updateInputSlot(index, { acceptedItemIds: parseMultiline(event.target.value) })}
                      />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="acceptedMaterialIds" hint="Опционально, по одному material id на строку" />
                      <textarea
                        rows={3}
                        value={toMultiline(slot.acceptedMaterialIds)}
                        onChange={(event) => updateInputSlot(index, { acceptedMaterialIds: parseMultiline(event.target.value) })}
                      />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="Notes" />
                      <textarea
                        rows={3}
                        value={slot.notes ?? ''}
                        onChange={(event) => updateInputSlot(index, { notes: event.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" className="action-btn-lw secondary" onClick={addInputSlot}>
                + Добавить input slot
              </button>
            </div>
          ) : null}

          {activeSubTab === 'traits' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {(draft.traitTransferRules ?? []).map((rule, index) => (
                <div key={`rule-${index}`} className="card" style={{ padding: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>Rule #{index + 1}</strong>
                    <button type="button" className="action-btn-lw danger" onClick={() => removeTraitRule(index)}>Удалить rule</button>
                  </div>
                  <div className="form-grid-premium" style={{ marginTop: '0.6rem' }}>
                    <div className="field-group">
                      <AdminFieldLabel label="sourceTraitTag" />
                      <input value={rule.sourceTraitTag ?? ''} onChange={(event) => updateTraitRule(index, { sourceTraitTag: event.target.value })} />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="targetTraitTag" />
                      <input value={rule.targetTraitTag ?? ''} onChange={(event) => updateTraitRule(index, { targetTraitTag: event.target.value })} />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="transferPercent" />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rule.transferPercent}
                        onChange={(event) => updateTraitRule(index, { transferPercent: Number(event.target.value) })}
                      />
                    </div>
                    <div className="field-group" style={{ gridColumn: 'span 2' }}>
                      <AdminFieldLabel label="Notes" />
                      <textarea rows={3} value={rule.notes ?? ''} onChange={(event) => updateTraitRule(index, { notes: event.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" className="action-btn-lw secondary" onClick={addTraitRule}>
                + Добавить traitTransferRule
              </button>
              <p className="muted" style={{ margin: 0 }}>
                `traitTransferRules` сейчас только сохраняются в template и не применяются к runtime item/effects.
              </p>
            </div>
          ) : null}

          {activeSubTab === 'json' ? (
            <div>
              <AdminFieldLabel label="JSON (read-only)" hint="Для отладки и проверки структуры" />
              <textarea
                readOnly
                rows={20}
                value={JSON.stringify(draft, null, 2)}
                style={{ width: '100%', fontFamily: 'monospace', background: 'rgba(0,0,0,0.22)' }}
              />
            </div>
          ) : null}
        </div>

        <div className="action-buttons-bar">
          <button type="button" className="action-btn-lw primary" onClick={() => void saveCurrent()} disabled={isSaving}>
            {isSaving ? 'Сохранение...' : selectedId ? 'Сохранить шаблон' : 'Создать шаблон'}
          </button>
          {selectedId ? (
            <button type="button" className="action-btn-lw danger" onClick={() => void removeCurrent()} style={{ marginLeft: 'auto' }}>
              Удалить шаблон
            </button>
          ) : null}
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <AdminSaveStatus value={saveState} />
          <p className="muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}>{status}</p>
        </div>
      </section>
    </div>
  );
}
