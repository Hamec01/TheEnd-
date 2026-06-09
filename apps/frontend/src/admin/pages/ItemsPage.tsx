import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AdminSaveStatus } from '../AdminSaveStatus';
import type {
  AdminItem,
  DamageCategory,
  ElementType,
  HandsRequired,
  ItemAugmentType,
  ItemEffect,
  ItemRarity,
  ItemSlot,
  ItemType,
  MagicSchool,
  PhysicalType,
  StatKey,
  StoredImage,
} from '../../services/content/models';
import { imageService } from '../../services/content/imageService';
import { loadRuntimeImages, resolveStoredImageSource } from '../../services/content/runtimeImageService';
import {
  normalizeGameImageRef,
  toLegacyImagePath,
  validateGameImageRef,
} from '../../services/content/gameImageRefs';
import { ensureItemImagePersisted } from '../../services/content/ensureItemImagePersisted';
import {
  createAdminItemDefaults,
  extractRawItemsFromImportJson,
  importItemsFromJsonEntries,
  itemsService,
  validateItem,
} from '../../services/content/itemsService';
import { uid } from '../../services/content/storage';
import { AdminAudioField } from '../AdminAudioField';
import { ItemEffectEditor } from '../components/ItemEffectEditor';
import { GameImageView } from '../components/GameImageView';
import { ImageSheetPicker } from '../components/ImageSheetPicker';
import type { ItemEffectJson } from '../itemEffectConstants';
import { AdminHelpTooltip } from '../help/AdminHelpTooltip';
import { getContentCollection, getItemPreview, type ItemPreviewResponse } from '../../services/content/contentApi';
import { visualFxService } from '../../services/content/visualFxService';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import { BATTLE_EFFECT_IDS } from '../../phaser/effects/effectRegistry';
import { PLAYER_HIDDEN_RUNTIME_ITEM_TAG, PLAYER_RUNTIME_ITEM_TAG } from '../../services/playerItemInstances';
import {
  AdminFieldLabel,
  translateAdminErrorMessage,
  translateDamageCategory,
  translateElementType,
  translateEnabledState,
  translateHandsRequired,
  translateItemSlot,
  translateItemType,
  translateMagicSchool,
  translatePhysicalType,
  translateRarity,
  translateStatKey,
} from '../adminUi';
import { getIdQualityWarning, runSaveWithFeedback, useAdminSaveShortcut, type AdminSaveViewModel } from '../adminSaveTools';

const STAT_KEYS: StatKey[] = ['hp', 'mp', 'stamina', 'strength', 'constitution', 'dexterity', 'intelligence', 'luck', 'perception', 'willpower'];
const ITEM_TYPES: ItemType[] = ['weapon', 'armor', 'potion', 'material', 'quest', 'misc', 'profession_tool', 'profession_transport'];
const RARITIES: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'forbidden'];
const SLOTS: ItemSlot[] = ['head', 'necklace', 'chest', 'outerwear', 'belt', 'leftHand', 'rightHand', 'gloves', 'legs', 'boots', 'ring', 'trinket', 'charm', 'quick', 'none'];
const DAMAGE_CATEGORIES: DamageCategory[] = ['physical', 'elemental', 'magic', 'shamanic', 'runic', 'poison', 'bleed', 'true'];
const PHYSICAL_TYPES: PhysicalType[] = ['slash', 'pierce', 'blunt', 'cleave', 'unarmed'];
const ELEMENT_TYPES: ElementType[] = ['fire', 'water', 'earth', 'air', 'light', 'dark'];
const MAGIC_SCHOOLS: MagicSchool[] = ['blood', 'death', 'life', 'mind', 'illusion', 'curse', 'arcane'];
const AUGMENT_TYPES: ItemAugmentType[] = ['rune', 'magic_stone', 'enchantment', 'other'];
const SOCKET_SOURCES: Array<'base' | 'blacksmith_added' | 'scripted'> = ['base', 'blacksmith_added', 'scripted'];
const SLOT_FAILURE_MODES: Array<'none' | 'material_lost' | 'item_damaged' | 'slot_locked'> = ['none', 'material_lost', 'item_damaged', 'slot_locked'];

type ExtendedAdminItemCollections = {
  itemSets: Array<{ id: string; name: string; isEnabled: boolean }>;
  runeComplexes: Array<{ id: string; name: string; isEnabled: boolean }>;
};

function emptyItem(): AdminItem {
  return createAdminItemDefaults();
}

function formatExportStamp(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}`;
}

function downloadItemsJson(items: AdminItem[]) {
  const envelope = {
    schemaVersion: 1,
    game: 'TheEnd' as const,
    exportedAt: new Date().toISOString(),
    exportedBy: 'admin' as const,
    contentCounts: { items: items.length },
    items,
  };
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `theend_items_${formatExportStamp()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseNumber(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePositiveInt(value: string): number | undefined {
  const parsed = parseNumber(value);
  if (typeof parsed !== 'number') {
    return undefined;
  }
  const intValue = Math.floor(parsed);
  return Number.isFinite(intValue) && intValue > 0 ? intValue : undefined;
}

function parseNonNegativeInt(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  const intValue = Math.floor(parsed);
  return intValue >= 0 ? intValue : undefined;
}

function toPrettyJson(value: unknown, emptyFallback: string): string {
  if (value === undefined || value === null) {
    return emptyFallback;
  }
  return JSON.stringify(value, null, 2);
}

function parseCsvTags(raw: string): string[] | undefined {
  const parsed = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry, index, arr) => entry.length > 0 && arr.indexOf(entry) === index);
  return parsed.length > 0 ? parsed : undefined;
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

function isDirectImageSource(value: string): boolean {
  return value.startsWith('data:') || value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://');
}

export interface ItemsPageProps {
  onNavigate?: (path: string) => void;
}

export function ItemsPage(props: ItemsPageProps = {}) {
  const { onNavigate } = props;
  const [items, setItems] = useState<AdminItem[]>([]);
  const [itemSets, setItemSets] = useState<ExtendedAdminItemCollections['itemSets']>([]);
  const [runeComplexes, setRuneComplexes] = useState<ExtendedAdminItemCollections['runeComplexes']>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [rarityFilter, setRarityFilter] = useState<'all' | ItemRarity>('all');
  const [showLegacyMaterials, setShowLegacyMaterials] = useState(false);
  const [showPlayerRuntimeItems, setShowPlayerRuntimeItems] = useState(false);
  const [showOnlyCarpenter, setShowOnlyCarpenter] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminItem>(emptyItem());
  const [status, setStatus] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);
  const [rangePanelOpen, setRangePanelOpen] = useState(false);
  const [itemPreview, setItemPreview] = useState<ItemPreviewResponse | null>(null);

  const [equipmentEffectsText, setEquipmentEffectsText] = useState('[]');
  const [useEffectsText, setUseEffectsText] = useState('[]');
  const [augmentText, setAugmentText] = useState('{}');
  const [augmentSlotsText, setAugmentSlotsText] = useState('[]');
  const [slotUpgradeRulesText, setSlotUpgradeRulesText] = useState('{}');
  const [tagsText, setTagsText] = useState('');

  const [previewImage, setPreviewImage] = useState<StoredImage | null>(null);
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);
  const [visualFxIds, setVisualFxIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  function syncAdvancedEditors(item: AdminItem) {
    setEquipmentEffectsText(toPrettyJson(item.equipmentEffects, '[]'));
    setUseEffectsText(toPrettyJson(item.useEffects, '[]'));
    setAugmentText(toPrettyJson(item.augment, '{}'));
    setAugmentSlotsText(toPrettyJson(item.augmentSlots, '[]'));
    setSlotUpgradeRulesText(toPrettyJson(item.slotUpgradeRules, '{}'));
    setTagsText((item.tags ?? []).join(', '));
  }

  function patchBattleVisuals(patchValue: NonNullable<AdminItem['battleVisuals']>) {
    patch({ battleVisuals: { ...(draft.battleVisuals ?? {}), ...patchValue } });
  }

  async function refresh() {
    const [all, images, fetchedItemSets, fetchedRuneComplexes, fetchedVisualFx] = await Promise.all([
      itemsService.getAll(),
      loadRuntimeImages(),
      getContentCollection<ExtendedAdminItemCollections['itemSets'][number]>('itemSets').catch(() => []),
      getContentCollection<ExtendedAdminItemCollections['runeComplexes'][number]>('runeComplexes').catch(() => []),
      visualFxService.getAll().catch(() => []),
    ]);
    setItems(all);
    setRuntimeImages(images);
    setItemSets(fetchedItemSets);
    setRuneComplexes(fetchedRuneComplexes);
    setVisualFxIds(fetchedVisualFx.filter((entry) => entry.status !== 'disabled').map((entry) => entry.id));
    if (selectedId && !all.some((item) => item.id === selectedId)) {
      setSelectedId(null);
      const next = emptyItem();
      setDraft(next);
      syncAdvancedEditors(next);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const itemBattleEffectIds = useMemo(
    () => Array.from(new Set([...visualFxIds, ...BATTLE_EFFECT_IDS])).sort(),
    [visualFxIds],
  );

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const tags = new Set(item.tags ?? []);
      const isHiddenRuntimeItem = tags.has(PLAYER_RUNTIME_ITEM_TAG) || tags.has(PLAYER_HIDDEN_RUNTIME_ITEM_TAG);
      if (!showPlayerRuntimeItems && isHiddenRuntimeItem) {
        return false;
      }
      if (!showLegacyMaterials && item.type === 'material') {
        return false;
      }
      if (showOnlyCarpenter && item.profession !== 'carpenter') {
        return false;
      }
      if (q && !item.id.toLowerCase().includes(q) && !item.name.toLowerCase().includes(q)) {
        return false;
      }
      if (typeFilter !== 'all' && item.type !== typeFilter) {
        return false;
      }
      if (rarityFilter !== 'all' && item.rarity !== rarityFilter) {
        return false;
      }
      return true;
    });
  }, [items, query, rarityFilter, showLegacyMaterials, showPlayerRuntimeItems, typeFilter, showOnlyCarpenter]);

  const selectedItem = useMemo(
    () => (selectedId ? items.find((item) => item.id === selectedId) ?? null : null),
    [items, selectedId],
  );

  function resolveItemImage(item: AdminItem): string | undefined {
    const imageRef = normalizeGameImageRef(item.imageRef, item.imagePath);
    const legacyPath = toLegacyImagePath(imageRef) ?? item.imagePath;
    return resolveStoredImageSource(legacyPath?.trim(), runtimeImages);
  }

  function getItemCardAccent(item: AdminItem): string {
    switch (item.rarity) {
      case 'legendary':
      case 'mythic':
        return 'is-gold';
      case 'epic':
      case 'forbidden':
        return 'is-crimson';
      case 'rare':
        return 'is-sky';
      default:
        return 'is-olive';
    }
  }

  function select(item: AdminItem) {
    setSelectedId(item.id);
    setDraft(item);
    syncAdvancedEditors(item);
    setRangePanelOpen(Boolean(item.attackRange || item.pierceTargets || item.splashRadius));
  }

  function patchJsonField<K extends keyof AdminItem>(
    key: K,
    raw: string,
    options: { emptyAs: 'undefined' | 'array' | 'object'; expect: 'array' | 'object'; label: string },
  ) {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (options.emptyAs === 'array') {
        patch({ [key]: [] } as Partial<AdminItem>);
        return;
      }
      if (options.emptyAs === 'object') {
        patch({ [key]: {} } as Partial<AdminItem>);
        return;
      }
      patch({ [key]: undefined } as Partial<AdminItem>);
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      const valid = options.expect === 'array' ? Array.isArray(parsed) : parsed && typeof parsed === 'object' && !Array.isArray(parsed);
      if (!valid) {
        setStatus(`${options.label}: ожидается ${options.expect === 'array' ? 'JSON-массив' : 'JSON-объект'}.`);
        return;
      }
      patch({ [key]: parsed } as Partial<AdminItem>);
    } catch {
      setStatus(`${options.label}: некорректный JSON.`);
    }
  }

  function patch(next: Partial<AdminItem>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function patchStatBucket(bucket: 'requiredStats' | 'bonuses', key: StatKey, rawValue: string) {
    setDraft((current) => {
      const parsed = parseNumber(rawValue);
      const nextBucket = { ...(current[bucket] ?? {}) };
      if (parsed === undefined) {
        delete nextBucket[key];
      } else {
        nextBucket[key] = parsed;
      }
      return {
        ...current,
        [bucket]: nextBucket,
      };
    });
  }

  function setEquipmentEffects(next: ItemEffect[] | undefined) {
    const normalized = next && next.length > 0 ? next : undefined;
    patch({ equipmentEffects: normalized });
    setEquipmentEffectsText(toPrettyJson(normalized, '[]'));
  }

  function setUseEffects(next: ItemEffect[] | undefined) {
    const normalized = next && next.length > 0 ? next : undefined;
    patch({ useEffects: normalized });
    setUseEffectsText(toPrettyJson(normalized, '[]'));
  }

  function setAugment(next: AdminItem['augment']) {
    patch({ augment: next });
    setAugmentText(toPrettyJson(next, '{}'));
  }

  function setAugmentSlots(next: AdminItem['augmentSlots']) {
    const normalized = next && next.length > 0 ? next : undefined;
    patch({ augmentSlots: normalized });
    setAugmentSlotsText(toPrettyJson(normalized, '[]'));
  }

  function setSlotUpgradeRules(next: AdminItem['slotUpgradeRules']) {
    patch({ slotUpgradeRules: next });
    setSlotUpgradeRulesText(toPrettyJson(next, '{}'));
  }

  function ensureAugment() {
    if (draft.augment) {
      return;
    }
    setAugment({ type: 'other', activationContexts: [], effects: [] });
  }

  function addAugmentSlot() {
    const next = [
      ...(draft.augmentSlots ?? []),
      {
        id: `slot_${(draft.augmentSlots?.length ?? 0) + 1}`,
        source: 'base' as const,
        isLocked: false,
      },
    ];
    setAugmentSlots(next);
  }

  function updateAugmentSlot(index: number, patchData: Partial<NonNullable<AdminItem['augmentSlots']>[number]>) {
    const next = (draft.augmentSlots ?? []).map((entry, idx) => (idx === index ? { ...entry, ...patchData } : entry));
    setAugmentSlots(next);
  }

  function removeAugmentSlot(index: number) {
    const next = (draft.augmentSlots ?? []).filter((_, idx) => idx !== index);
    setAugmentSlots(next);
  }

  function ensureSlotUpgradeRules() {
    if (draft.slotUpgradeRules) {
      return;
    }
    setSlotUpgradeRules({
      materialCosts: [],
      failureModes: [],
    });
  }

  function patchSlotUpgradeRules(nextPatch: Partial<NonNullable<AdminItem['slotUpgradeRules']>>) {
    const current = draft.slotUpgradeRules ?? {};
    setSlotUpgradeRules({ ...current, ...nextPatch });
  }

  function addSlotMaterialCost() {
    const current = draft.slotUpgradeRules ?? {};
    const nextCosts = [...(current.materialCosts ?? []), { itemId: '', quantity: 1 }];
    setSlotUpgradeRules({ ...current, materialCosts: nextCosts });
  }

  function patchSlotMaterialCost(index: number, patchData: { itemId?: string; quantity?: number }) {
    const current = draft.slotUpgradeRules ?? {};
    const nextCosts = (current.materialCosts ?? []).map((entry, idx) => (idx === index ? { ...entry, ...patchData } : entry));
    setSlotUpgradeRules({ ...current, materialCosts: nextCosts });
  }

  function removeSlotMaterialCost(index: number) {
    const current = draft.slotUpgradeRules ?? {};
    const nextCosts = (current.materialCosts ?? []).filter((_, idx) => idx !== index);
    setSlotUpgradeRules({ ...current, materialCosts: nextCosts });
  }

  function toggleFailureMode(mode: 'none' | 'material_lost' | 'item_damaged' | 'slot_locked', enabled: boolean) {
    const current = draft.slotUpgradeRules ?? {};
    const modes = new Set(current.failureModes ?? []);
    if (enabled) {
      modes.add(mode);
    } else {
      modes.delete(mode);
    }
    setSlotUpgradeRules({ ...current, failureModes: Array.from(modes) });
  }

  useEffect(() => {
    if (draft.type === 'material') {
      patch({ slot: 'none' });
      return;
    }
    if (draft.type === 'potion' && (!draft.slot || draft.slot === 'none')) {
      patch({ slot: 'quick' });
    }
  }, [draft.type, draft.slot]);

  useEffect(() => {
    if (draft.type !== 'weapon' && draft.handsRequired !== 1) {
      patch({ handsRequired: 1 });
    }
  }, [draft.handsRequired, draft.type]);

  useEffect(() => {
    const lookupId = selectedId || draft.id.trim();
    if (!lookupId) {
      setItemPreview(null);
      return;
    }

    let disposed = false;
    void getItemPreview(lookupId)
      .then((payload) => {
        if (!disposed) {
          setItemPreview(payload);
        }
      })
      .catch(() => {
        if (!disposed) {
          setItemPreview(null);
        }
      });

    return () => {
      disposed = true;
    };
  }, [selectedId, draft.id]);

  useEffect(() => {
    const normalized = draft.imagePath?.trim();
    if (!normalized || isDirectImageSource(normalized)) {
      setPreviewImage(null);
      return;
    }

    let disposed = false;
    void imageService.get(normalized).then((image) => {
      if (!disposed) {
        setPreviewImage(image);
      }
    });

    return () => {
      disposed = true;
    };
  }, [draft.imagePath]);

  const draftPreviewLabel = useMemo(() => {
    const source = draft.name.trim() || draft.subtype?.trim() || draft.type;
    return source.charAt(0).toUpperCase() || '?';
  }, [draft.name, draft.subtype, draft.type]);

  async function createOrUpdate() {
    if (isSaving) {
      return;
    }

    const id = draft.id.trim() || uid('item');
    const normalizedImageRef = normalizeGameImageRef(draft.imageRef, draft.imagePath);
    const persistedImage = await ensureItemImagePersisted(normalizedImageRef, draft.imagePath, {
      entityId: id,
      entityKind: 'items',
      runtimeImages,
    });
    const normalized: AdminItem = {
      ...draft,
      id,
      imageRef: persistedImage.imageRef ?? normalizedImageRef,
      imagePath: persistedImage.imagePath ?? toLegacyImagePath(normalizedImageRef),
      handsRequired: draft.type === 'weapon' && draft.handsRequired === 2 ? 2 : 1,
      maxStack: draft.stackable ? Math.max(2, draft.maxStack ?? 2) : 1,
      updatedAt: new Date().toISOString(),
    };

    const imageErrors = validateGameImageRef(normalized.imageRef);
    if (imageErrors.length > 0) {
      setStatus(`Проверка изображения: ${translateAdminErrorMessage(imageErrors.join(', '))}`);
      return;
    }

    const errors = validateItem(normalized);
    if (errors.length > 0) {
      setStatus(`Проверка: ${translateAdminErrorMessage(errors.join(', '))}`);
      return;
    }

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: id,
      onSave: () => (selectedId
        ? (normalized.id !== selectedId
          ? itemsService.rename(selectedId, normalized.id, normalized)
          : itemsService.update(selectedId, normalized))
        : itemsService.create(normalized)),
      onAfterSave: async (entry) => {
        const verified = await itemsService.getById(entry.id);
        if (!verified) {
          throw new Error('Сохранение не подтверждено: запись не найдена после сохранения.');
        }
      },
      successLabel: (entry) => `Сохранено: ${entry.id}`,
    });

    if (!saved) {
      setIsSaving(false);
      return;
    }

    setSelectedId(saved.id);
    setDraft(saved);
    syncAdvancedEditors(saved);
    await refresh();

    const warning = getIdQualityWarning(saved.id);
    if (warning) {
      setStatus(`Предупреждение: ${warning}`);
      setSaveState({ state: 'warning', message: warning });
    } else {
      setStatus(selectedId ? `Предмет обновлён: ${saved.id}` : `Предмет создан: ${saved.id}`);
    }
    setIsSaving(false);
  }

  useAdminSaveShortcut({
    enabled: true,
    isSaving,
    onSave: createOrUpdate,
  });

  async function duplicateSelected() {
    if (!selectedId) {
      return;
    }
    const copy = {
      ...draft,
      id: `${draft.id || 'item'}_copy_${Math.floor(Math.random() * 10000)}`,
      name: `${draft.name} Копия`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await itemsService.create(copy);
      setStatus(`Создана копия предмета: ${selectedId}`);
      await refresh();
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function disableSelected() {
    if (!selectedId) {
      return;
    }
    await itemsService.disable(selectedId);
    await refresh();
    setStatus(`Предмет отключён: ${selectedId}`);
  }

  async function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm('Вы уверены? Это действие нельзя отменить.')) {
      return;
    }
    const deletedId = selectedId;
    await itemsService.delete(deletedId);
    setSelectedId(null);
    const next = emptyItem();
    setDraft(next);
    syncAdvancedEditors(next);
    await refresh();
    setStatus(`Предмет удалён: ${deletedId}`);
  }

  function exportItemsJson() {
    try {
      downloadItemsJson(items);
      setStatus(`Экспорт: ${items.length} предметов в JSON.`);
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  function openItemsImportPicker() {
    importFileRef.current?.click();
  }

  async function onItemsImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (isImporting || isSaving) {
      return;
    }
    setIsImporting(true);
    setStatus('Импорт JSON…');
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const rawList = extractRawItemsFromImportJson(parsed);
      if (!window.confirm(
        `Импортировать ${rawList.length} записей из «${file.name}»?\n`
        + 'Существующие id будут обновлены; новые id будут созданы. Проверка такая же, как при сохранении в форме.',
      )) {
        setStatus('Импорт отменён.');
        setIsImporting(false);
        return;
      }
      const result = await importItemsFromJsonEntries(rawList);
      await refresh();
      const errPreview = result.errors.slice(0, 8).map((e) => `${e.id}: ${translateAdminErrorMessage(e.message)}`).join('; ');
      const extra = result.errors.length > 8 ? ` ...ещё ${result.errors.length - 8}` : '';
      setStatus(
        `Импорт завершён: создано ${result.created.length}, пропущено существующих ${result.skippedExisting.length}, ошибок ${result.errors.length}.`
        + (result.errors.length ? ` ${errPreview}${extra}` : ''),
      );
      if (result.errors.length === 0) {
        setSaveState({ state: 'saved', message: `Импорт: +${result.created.length} / =${result.skippedExisting.length}` });
      } else {
        setSaveState({ state: 'warning', message: `Импорт с ошибками: ${result.errors.length}` });
      }
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
      setSaveState({ state: 'error', message: translateAdminErrorMessage((error as Error).message) });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="admin-items-page admin-page-grid">
      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Технический уникальный идентификатор. Используется в коде, магазинах, луте и сохранениях. После публикации лучше не менять." />
            <AdminHelpTooltip section="items" field="id" />
            <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Название" hint="Имя предмета, которое увидит игрок." />
            <AdminHelpTooltip section="items" field="name" />
            <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Тип" hint="Главная категория предмета. Она влияет на поведение предмета в игре." />
            <select value={draft.type} onChange={(event) => patch({ type: event.target.value as ItemType })}>
              {ITEM_TYPES.map((type) => <option key={type} value={type}>{translateItemType(type)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Подтип" hint="Уточнение внутри типа: например меч, топор, лечебное зелье или руда." />
            <input value={draft.subtype ?? ''} onChange={(event) => patch({ subtype: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Слот" hint="Куда предмет можно экипировать. Для расходников обычно используется быстрый слот, для материалов — не экипируется." />
            <select value={draft.slot ?? 'none'} onChange={(event) => patch({ slot: event.target.value as ItemSlot })}>
              {SLOTS.map((slot) => <option key={slot} value={slot}>{translateItemSlot(slot)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Редкость" hint="Редкость предмета. Помогает балансировать ценность и редкость выпадения." />
            <select value={draft.rarity} onChange={(event) => patch({ rarity: event.target.value as ItemRarity })}>
              {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{translateRarity(rarity)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Цена" hint="Базовая цена покупки у торговца в золоте." />
            <input type="number" min={0} value={draft.price} onChange={(event) => patch({ price: Number(event.target.value) || 0 })} />
          </label>
          <label>
            <AdminFieldLabel label="Хват" hint="Сколько рук нужно, чтобы держать оружие. Для двуручного оружия левая рука автоматически освобождается." />
            <select
              value={draft.handsRequired ?? 1}
              onChange={(event) => patch({ handsRequired: Number(event.target.value) as HandsRequired })}
              disabled={draft.type !== 'weapon'}
            >
              <option value={1}>{translateHandsRequired(1)}</option>
              <option value={2}>{translateHandsRequired(2)}</option>
            </select>
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.stackable} onChange={(event) => patch({ stackable: event.target.checked })} />
            <AdminFieldLabel label="Складывается в стопку" hint="Если включено, несколько копий предмета могут лежать в одном слоте инвентаря." />
          </label>
          <label>
            <AdminFieldLabel label="Макс. в стопке" hint="Сколько копий этого предмета можно хранить в одной стопке." />
            <input type="number" min={1} value={draft.maxStack ?? 1} onChange={(event) => patch({ maxStack: Number(event.target.value) || 1 })} />
          </label>
          <label>
            <AdminFieldLabel label="Мин. урон" hint="Нижняя граница урона оружия или атакующего предмета." />
            <input type="number" value={draft.damageMin ?? ''} onChange={(event) => patch({ damageMin: parseNumber(event.target.value) })} />
          </label>
          <label>
            <AdminFieldLabel label="Макс. урон" hint="Верхняя граница урона. Не должна быть ниже минимального урона." />
            <input type="number" value={draft.damageMax ?? ''} onChange={(event) => patch({ damageMax: parseNumber(event.target.value) })} />
          </label>
          <div className="admin-item-range-tools card">
            <div className="admin-item-range-tools-head">
              <button type="button" onClick={() => setRangePanelOpen((value) => !value)}>
                RANGE {rangePanelOpen ? '▲' : '▼'}
              </button>
              <span className="muted">Дальность / пробитие / урон по площади (лук, арбалет, посох, бомбы, метательное копьё)</span>
            </div>

            {rangePanelOpen ? (
              <div className="admin-item-range-tools-grid">
                <label className="zone-editor-checkbox">
                  <input
                    type="checkbox"
                    checked={typeof draft.attackRange === 'number' && draft.attackRange > 1}
                    onChange={(event) => {
                      if (event.target.checked) {
                        patch({ attackRange: Math.max(2, draft.attackRange ?? 2) });
                        return;
                      }
                      patch({
                        attackRange: undefined,
                        pierceTargets: undefined,
                        splashRadius: undefined,
                        splashCenterMultiplier: undefined,
                        splashOuterMultiplier: undefined,
                      });
                    }}
                  />
                  <AdminFieldLabel label="Дальний бой" hint="Если включено — предмет может атаковать дальше 1 клетки." />
                </label>

                {typeof draft.attackRange === 'number' && draft.attackRange > 1 ? (
                  <>
                    <label>
                      <AdminFieldLabel label="Range (клетки)" hint="Максимальная дальность в клетках. Пример: лук 3, посох 5, бомба 5." />
                      <input
                        type="number"
                        min={2}
                        value={draft.attackRange ?? ''}
                        onChange={(event) => {
                          const parsed = parsePositiveInt(event.target.value);
                          if (!parsed) {
                            patch({
                              attackRange: undefined,
                              pierceTargets: undefined,
                              splashRadius: undefined,
                              splashCenterMultiplier: undefined,
                              splashOuterMultiplier: undefined,
                            });
                            return;
                          }
                          patch({ attackRange: Math.max(2, parsed) });
                        }}
                      />
                    </label>
                    <label>
                      <AdminFieldLabel label="Пробитие (целей)" hint="Сколько целей по линии может задеть снаряд. Пример: метательное копьё 2." />
                      <input
                        type="number"
                        min={2}
                        value={draft.pierceTargets ?? ''}
                        onChange={(event) => {
                          const parsed = parsePositiveInt(event.target.value);
                          patch({ pierceTargets: parsed ? Math.max(2, parsed) : undefined });
                        }}
                      />
                    </label>

                    <label className="zone-editor-checkbox">
                      <input
                        type="checkbox"
                        checked={typeof draft.splashRadius === 'number' && draft.splashRadius >= 1}
                        onChange={(event) => {
                          if (event.target.checked) {
                            patch({
                              splashRadius: Math.max(1, draft.splashRadius ?? 1),
                              splashCenterMultiplier: typeof draft.splashCenterMultiplier === 'number' ? Math.max(1, draft.splashCenterMultiplier) : 1,
                              splashOuterMultiplier: typeof draft.splashOuterMultiplier === 'number' ? Math.max(0, draft.splashOuterMultiplier) : 0.5,
                            });
                            return;
                          }
                          patch({
                            splashRadius: undefined,
                            splashCenterMultiplier: undefined,
                            splashOuterMultiplier: undefined,
                          });
                        }}
                      />
                      <AdminFieldLabel label="Урон по площади" hint="Если включено — атакует клетку попадания и клетки вокруг (бомбы/заклинания из посоха)." />
                    </label>

                    {typeof draft.splashRadius === 'number' && draft.splashRadius >= 1 ? (
                      <>
                        <label>
                          <AdminFieldLabel label="Радиус AoE (клетки)" hint="Радиус поражения вокруг клетки попадания. 1 = ближайшие клетки вокруг." />
                          <input
                            type="number"
                            min={1}
                            value={draft.splashRadius ?? ''}
                            onChange={(event) => {
                              const parsed = parsePositiveInt(event.target.value);
                              if (!parsed) {
                                patch({
                                  splashRadius: undefined,
                                  splashCenterMultiplier: undefined,
                                  splashOuterMultiplier: undefined,
                                });
                                return;
                              }
                              patch({ splashRadius: Math.max(1, parsed) });
                            }}
                          />
                        </label>
                        <label>
                          <AdminFieldLabel label="Множитель центра" hint="Во сколько раз урон по клетке попадания выше, чем базовый (>= 1)." />
                          <input
                            type="number"
                            min={1}
                            step={0.1}
                            value={draft.splashCenterMultiplier ?? ''}
                            onChange={(event) => patch({ splashCenterMultiplier: parseNumber(event.target.value) })}
                          />
                        </label>
                        <label>
                          <AdminFieldLabel label="Множитель вокруг" hint="Урон по клеткам вокруг. 0..(множитель центра). Обычно 0.5." />
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={draft.splashOuterMultiplier ?? ''}
                            onChange={(event) => patch({ splashOuterMultiplier: parseNumber(event.target.value) })}
                          />
                        </label>
                      </>
                    ) : null}
                  </>
                ) : (
                  <p className="muted admin-item-range-tools-note">Для ближнего боя оставь выключенным.</p>
                )}
              </div>
            ) : null}
          </div>
          <label>
            <AdminFieldLabel label="Категория урона" hint="Определяет, к какому типу относится урон предмета: физический, магический, стихия и так далее." />
            <select value={draft.damageCategory ?? ''} onChange={(event) => patch({ damageCategory: (event.target.value || undefined) as DamageCategory | undefined })}>
              <option value="">Не задана</option>
              {DAMAGE_CATEGORIES.map((entry) => <option key={entry} value={entry}>{translateDamageCategory(entry)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Физический тип" hint="Уточняет физический вид урона: режущий, колющий, дробящий и т.д." />
            <select value={draft.physicalType ?? ''} onChange={(event) => patch({ physicalType: (event.target.value || undefined) as PhysicalType | undefined })}>
              <option value="">Не задан</option>
              {PHYSICAL_TYPES.map((entry) => <option key={entry} value={entry}>{translatePhysicalType(entry)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Стихия" hint="Если урон стихийный, здесь указывается конкретная стихия." />
            <select value={draft.elementType ?? ''} onChange={(event) => patch({ elementType: (event.target.value || undefined) as ElementType | undefined })}>
              <option value="">Не задана</option>
              {ELEMENT_TYPES.map((entry) => <option key={entry} value={entry}>{translateElementType(entry)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Школа магии" hint="Если предмет связан с магией, здесь можно указать школу магии." />
            <select value={draft.magicSchool ?? ''} onChange={(event) => patch({ magicSchool: (event.target.value || undefined) as MagicSchool | undefined })}>
              <option value="">Не задана</option>
              {MAGIC_SCHOOLS.map((entry) => <option key={entry} value={entry}>{translateMagicSchool(entry)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Броня" hint="Плоское значение защиты, которое даёт предмет." />
            <input type="number" value={draft.armorValue ?? ''} onChange={(event) => patch({ armorValue: parseNumber(event.target.value) })} />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isEnabled} onChange={(event) => patch({ isEnabled: event.target.checked })} />
            <AdminFieldLabel label="Включён" hint="Если выключить, предмет останется в базе, но не будет использоваться в игровом контенте." />
          </label>
        </div>

        <ImageSheetPicker
          label="Изображение предмета"
          hint="Загрузите файл: система сама сохранит его и подставит ID. Для тайлсета можно выбрать frame."
          category="items"
          value={draft.imageRef}
          legacyImagePath={draft.imagePath}
          runtimeImages={runtimeImages}
          showUploadForImage
          disableManualImageInput
          uploadPresetId="item-icon"
          uploadSuggestedId={draft.id || undefined}
          uploadSuggestedName={`${draft.id || draft.name || 'item'}-icon`}
          uploadFolder={buildUploadFolder('images', 'items', draft.type, draft.subtype || undefined)}
          onStatus={setStatus}
          onChange={(next) => patch({
            imageRef: next,
            imagePath: toLegacyImagePath(next),
          })}
        />

        <section className="card">
          <h4>Battle visuals (Phaser)</h4>
          <div className="admin-form-grid">
            <label>
              <AdminFieldLabel label="Battle sprite asset ID" hint="Asset id for Phaser battle token. Empty uses portrait/icon fallback." />
              <input value={draft.battleVisuals?.battleSpriteAssetId ?? ''} onChange={(event) => patchBattleVisuals({ battleSpriteAssetId: event.target.value || undefined })} placeholder="actor_sword_01" />
            </label>
            <label>
              <AdminFieldLabel label="Death effect ID" hint="Effect registry id for item-related actor death visuals." />
              <input list="item-battle-effect-ids" value={draft.battleVisuals?.deathEffectId ?? ''} onChange={(event) => patchBattleVisuals({ deathEffectId: event.target.value || undefined })} placeholder="death_fade" />
            </label>
            <label>
              <AdminFieldLabel label="Hit effect preset" hint="Effect registry id for this weapon or item impact." />
              <input list="item-battle-effect-ids" value={draft.battleVisuals?.hitEffectPreset ?? ''} onChange={(event) => patchBattleVisuals({ hitEffectPreset: event.target.value || undefined })} placeholder="hit_slash" />
            </label>
            <label>
              <AdminFieldLabel label="Cast sound ID" hint="Опциональный звук подготовки/каста для оружия или предмета." />
              <input value={draft.battleVisuals?.castSoundId ?? ''} onChange={(event) => patchBattleVisuals({ castSoundId: event.target.value || undefined })} placeholder="sfx_item_cast_01" />
            </label>
            <label>
              <AdminFieldLabel label="Impact sound ID" hint="Опциональный звук попадания/удара для предмета." />
              <input value={draft.battleVisuals?.impactSoundId ?? ''} onChange={(event) => patchBattleVisuals({ impactSoundId: event.target.value || undefined })} placeholder="sfx_item_impact_01" />
            </label>
          </div>
          <AdminAudioField
            value={draft.battleVisuals?.castSoundId}
            onChange={(nextValue) => patchBattleVisuals({ castSoundId: nextValue || undefined })}
            onStatus={setStatus}
            mode="assetId"
            suggestedAssetId={`${draft.id || 'item'}_cast_sound`}
            suggestedName={`${draft.id || 'item'}-cast-sound`}
            uploadFolder={buildUploadFolder('audio', 'items', draft.type, draft.subtype || undefined, draft.id || undefined)}
            label="Загрузить item cast sound"
            hint="Загружает audio-файл и подставляет asset ID в поле Cast sound ID."
          />
          <AdminAudioField
            value={draft.battleVisuals?.impactSoundId}
            onChange={(nextValue) => patchBattleVisuals({ impactSoundId: nextValue || undefined })}
            onStatus={setStatus}
            mode="assetId"
            suggestedAssetId={`${draft.id || 'item'}_impact_sound`}
            suggestedName={`${draft.id || 'item'}-impact-sound`}
            uploadFolder={buildUploadFolder('audio', 'items', draft.type, draft.subtype || undefined, draft.id || undefined)}
            label="Загрузить item impact sound"
            hint="Загружает audio-файл и подставляет asset ID в поле Impact sound ID."
          />
          <datalist id="item-battle-effect-ids">
            {itemBattleEffectIds.map((id) => <option key={id} value={id}>{id}</option>)}
          </datalist>
        </section>

        <div className="admin-stat-grid">
          <h4 title="Минимальные характеристики, которые нужны, чтобы экипировать или использовать предмет.">Требования</h4>
          {STAT_KEYS.map((key) => (
            <label key={`required-${key}`}>
              <AdminFieldLabel label={translateStatKey(key)} hint={`Минимальное значение характеристики "${translateStatKey(key)}", которое требуется для использования или экипировки предмета.`} />
              <input type="number" value={draft.requiredStats?.[key] ?? ''} onChange={(event) => patchStatBucket('requiredStats', key, event.target.value)} />
            </label>
          ))}
        </div>

        <div className="admin-stat-grid">
          <h4 title="Бонусы, которые предмет даёт персонажу, пока надет или активен.">Бонусы</h4>
          {STAT_KEYS.map((key) => (
            <label key={`bonus-${key}`}>
              <AdminFieldLabel label={translateStatKey(key)} hint={`Прибавка к характеристике "${translateStatKey(key)}", которую предмет даёт персонажу.`} />
              <input type="number" value={draft.bonuses?.[key] ?? ''} onChange={(event) => patchStatBucket('bonuses', key, event.target.value)} />
            </label>
          ))}
        </div>

        <section className="card">
          <h4>Пассивные эффекты экипировки (equipmentEffects)</h4>
          <ItemEffectEditor
            effects={(draft.equipmentEffects ?? []) as ItemEffectJson[]}
            onChange={(next) => setEquipmentEffects(next as ItemEffect[])}
          />
          <p className="muted">Raw JSON (для точной ручной правки):</p>
          <textarea
            rows={6}
            value={equipmentEffectsText}
            onChange={(event) => {
              const raw = event.target.value;
              setEquipmentEffectsText(raw);
              patchJsonField('equipmentEffects', raw, {
                emptyAs: 'undefined',
                expect: 'array',
                label: 'equipmentEffects',
              });
            }}
          />
        </section>

        <section className="card">
          <h4>Эффекты использования (useEffects)</h4>
          <ItemEffectEditor
            effects={(draft.useEffects ?? []) as ItemEffectJson[]}
            onChange={(next) => setUseEffects(next as ItemEffect[])}
          />
          <p className="muted">Raw JSON (для точной ручной правки). Legacy useEffect остаётся без изменений:</p>
          <textarea
            rows={6}
            value={useEffectsText}
            onChange={(event) => {
              const raw = event.target.value;
              setUseEffectsText(raw);
              patchJsonField('useEffects', raw, {
                emptyAs: 'undefined',
                expect: 'array',
                label: 'useEffects',
              });
            }}
          />
        </section>

        <section className="card">
          <h4>Усиление предмета (augment)</h4>
          <div className="admin-form-grid">
            <label className="zone-editor-checkbox">
              <input
                type="checkbox"
                checked={Boolean(draft.augment)}
                onChange={(event) => {
                  if (event.target.checked) {
                    ensureAugment();
                    return;
                  }
                  setAugment(undefined);
                }}
              />
              <AdminFieldLabel label="Есть augment" hint="Включает/отключает объект усиления предмета." />
            </label>
            {draft.augment ? (
              <>
                <label>
                  <AdminFieldLabel label="augment.type" hint="Тип усиления." />
                  <select
                    value={draft.augment.type}
                    onChange={(event) => setAugment({ ...draft.augment!, type: event.target.value as ItemAugmentType })}
                  >
                    {AUGMENT_TYPES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                  </select>
                </label>
                <label>
                  <AdminFieldLabel label="augment.activationContexts" hint="Контексты активации через запятую." />
                  <input
                    value={formatCommaList(draft.augment.activationContexts)}
                    onChange={(event) => setAugment({ ...draft.augment!, activationContexts: parseCommaList(event.target.value) })}
                  />
                </label>
                <label>
                  <AdminFieldLabel label="augment.tags" hint="Теги аугмента через запятую." />
                  <input
                    value={formatCommaList(draft.augment.tags)}
                    onChange={(event) => setAugment({ ...draft.augment!, tags: parseCommaList(event.target.value) })}
                  />
                </label>
              </>
            ) : null}
          </div>
          <p className="muted">JSON-объект ItemAugment. Поле optional.</p>
          <textarea
            rows={6}
            value={augmentText}
            onChange={(event) => {
              const raw = event.target.value;
              setAugmentText(raw);
              patchJsonField('augment', raw, {
                emptyAs: 'undefined',
                expect: 'object',
                label: 'augment',
              });
            }}
          />
        </section>

        <section className="card">
          <h4>Слоты усилений (augmentSlots)</h4>
          <div className="admin-actions-row">
            <button type="button" onClick={addAugmentSlot}>Добавить слот</button>
          </div>
          {(draft.augmentSlots ?? []).map((slot, index) => (
            <div key={`${slot.id}-${index}`} className="admin-form-grid card">
              <label>
                <AdminFieldLabel label="id" hint="Уникальный ID слота внутри предмета." />
                <input value={slot.id} onChange={(event) => updateAugmentSlot(index, { id: event.target.value })} />
              </label>
              <label>
                <AdminFieldLabel label="source" hint="Источник появления слота." />
                <select
                  value={slot.source ?? ''}
                  onChange={(event) => updateAugmentSlot(index, { source: (event.target.value || undefined) as 'base' | 'blacksmith_added' | 'scripted' | undefined })}
                >
                  <option value="">Не задан</option>
                  {SOCKET_SOURCES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                </select>
              </label>
              <label className="zone-editor-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(slot.isLocked)}
                  onChange={(event) => updateAugmentSlot(index, { isLocked: event.target.checked })}
                />
                <AdminFieldLabel label="isLocked" hint="Заблокирован ли слот." />
              </label>
              <label>
                <AdminFieldLabel label="allowedAugmentTypes" hint="Типы аугментов через запятую: rune, magic_stone..." />
                <input
                  value={formatCommaList(slot.allowedAugmentTypes)}
                  onChange={(event) => updateAugmentSlot(index, { allowedAugmentTypes: parseCommaList(event.target.value) as ItemAugmentType[] | undefined })}
                />
              </label>
              <label>
                <AdminFieldLabel label="activationContexts" hint="Контексты активации сокета через запятую." />
                <input
                  value={formatCommaList(slot.activationContexts)}
                  onChange={(event) => updateAugmentSlot(index, { activationContexts: parseCommaList(event.target.value) })}
                />
              </label>
              <label>
                <AdminFieldLabel label="socketedAugmentItemId" hint="ID вставленного аугмента (опционально)." />
                <input
                  value={slot.socketedAugmentItemId ?? ''}
                  onChange={(event) => updateAugmentSlot(index, { socketedAugmentItemId: event.target.value || undefined })}
                />
              </label>
              <button type="button" onClick={() => removeAugmentSlot(index)}>Удалить слот</button>
            </div>
          ))}
          <p className="muted">Raw JSON (для точной ручной правки):</p>
          <p className="muted">JSON-массив ItemSocket. Поле optional.</p>
          <textarea
            rows={6}
            value={augmentSlotsText}
            onChange={(event) => {
              const raw = event.target.value;
              setAugmentSlotsText(raw);
              patchJsonField('augmentSlots', raw, {
                emptyAs: 'undefined',
                expect: 'array',
                label: 'augmentSlots',
              });
            }}
          />
        </section>

        <section className="card">
          <h4>Настройки кузнеца</h4>
          <div className="admin-form-grid">
            <label className="zone-editor-checkbox">
              <input
                type="checkbox"
                checked={Boolean(draft.canAddAugmentSlots)}
                onChange={(event) => patch({ canAddAugmentSlots: event.target.checked })}
              />
              <AdminFieldLabel label="canAddAugmentSlots" hint="Можно ли добавлять слоты усиления через кузнеца." />
            </label>
            <label>
              <AdminFieldLabel label="maxAugmentSlots" hint="Максимум слотов усилений для этого предмета." />
              <input
                type="number"
                min={0}
                value={draft.maxAugmentSlots ?? ''}
                onChange={(event) => patch({ maxAugmentSlots: parseNonNegativeInt(event.target.value) })}
              />
            </label>
            <label className="zone-editor-checkbox">
              <input
                type="checkbox"
                checked={Boolean(draft.slotUpgradeRules)}
                onChange={(event) => {
                  if (event.target.checked) {
                    ensureSlotUpgradeRules();
                    return;
                  }
                  setSlotUpgradeRules(undefined);
                }}
              />
              <AdminFieldLabel label="Есть slotUpgradeRules" hint="Включает/отключает правила апгрейда слотов у кузнеца." />
            </label>
            {draft.slotUpgradeRules ? (
              <>
                <label>
                  <AdminFieldLabel label="minBlacksmithTier" hint="Минимальный уровень кузнеца для апгрейда." />
                  <input
                    type="number"
                    min={0}
                    value={draft.slotUpgradeRules.minBlacksmithTier ?? ''}
                    onChange={(event) => patchSlotUpgradeRules({ minBlacksmithTier: parseNonNegativeInt(event.target.value) })}
                  />
                </label>
                <label>
                  <AdminFieldLabel label="goldCost" hint="Стоимость апгрейда в золоте." />
                  <input
                    type="number"
                    min={0}
                    value={draft.slotUpgradeRules.goldCost ?? ''}
                    onChange={(event) => patchSlotUpgradeRules({ goldCost: parseNonNegativeInt(event.target.value) })}
                  />
                </label>
                <label>
                  <AdminFieldLabel label="successChancePercent" hint="Шанс успеха апгрейда (0-100)." />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.slotUpgradeRules.successChancePercent ?? ''}
                    onChange={(event) => {
                      const parsed = parseNumber(event.target.value);
                      patchSlotUpgradeRules({
                        successChancePercent: typeof parsed === 'number' ? Math.max(0, Math.min(100, parsed)) : undefined,
                      });
                    }}
                  />
                </label>

                <div className="card">
                  <h5>materialCosts</h5>
                  <div className="admin-actions-row">
                    <button type="button" onClick={addSlotMaterialCost}>Добавить материал</button>
                  </div>
                  {(draft.slotUpgradeRules.materialCosts ?? []).map((entry, index) => (
                    <div key={`slot-cost-${index}`} className="admin-form-grid card">
                      <label>
                        <AdminFieldLabel label="itemId" hint="ID материала из items." />
                        <input
                          value={entry.itemId}
                          onChange={(event) => patchSlotMaterialCost(index, { itemId: event.target.value })}
                        />
                      </label>
                      <label>
                        <AdminFieldLabel label="quantity" hint="Требуемое количество." />
                        <input
                          type="number"
                          min={1}
                          value={entry.quantity}
                          onChange={(event) => patchSlotMaterialCost(index, { quantity: parsePositiveInt(event.target.value) ?? 1 })}
                        />
                      </label>
                      <button type="button" onClick={() => removeSlotMaterialCost(index)}>Удалить материал</button>
                    </div>
                  ))}
                </div>

                <div className="card">
                  <h5>failureModes</h5>
                  <div className="admin-form-grid">
                    {SLOT_FAILURE_MODES.map((mode) => (
                      <label key={mode} className="zone-editor-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(draft.slotUpgradeRules?.failureModes?.includes(mode))}
                          onChange={(event) => toggleFailureMode(mode, event.target.checked)}
                        />
                        <AdminFieldLabel label={mode} hint="Вариант поведения при неуспешном апгрейде." />
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <p className="muted">Raw JSON (необязательно, для тонкой ручной правки):</p>
          <textarea
            rows={5}
            value={slotUpgradeRulesText}
            onChange={(event) => {
              const raw = event.target.value;
              setSlotUpgradeRulesText(raw);
              patchJsonField('slotUpgradeRules', raw, {
                emptyAs: 'undefined',
                expect: 'object',
                label: 'slotUpgradeRules',
              });
            }}
          />
        </section>

        <section className="card">
          <h4>Сет и теги</h4>
          <div className="admin-form-grid">
            <label>
              <AdminFieldLabel label="setId" hint="ID сета предметов. Значения загружаются из content API itemSets." />
              <select
                value={draft.setId ?? ''}
                onChange={(event) => patch({ setId: event.target.value || undefined })}
              >
                <option value="">Не задан</option>
                {draft.setId && !itemSets.some((s) => s.id === draft.setId) ? (
                  <option value={draft.setId}>{draft.setId} (нет в списке)</option>
                ) : null}
                {itemSets.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.name} ({set.id}){set.isEnabled ? '' : ' [disabled]'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <AdminFieldLabel label="tags" hint="Теги через запятую. Поле optional." />
              <input
                value={tagsText}
                onChange={(event) => {
                  const raw = event.target.value;
                  setTagsText(raw);
                  patch({ tags: parseCsvTags(raw) });
                }}
              />
            </label>
          </div>
          <p className="muted">Rune complexes из content API загружены: {runeComplexes.length}.</p>
          <p className="muted">Legacy-поля effects/combatEffects/useEffect сохранены для обратной совместимости и не удаляются.</p>
        </section>

        <label>
          <AdminFieldLabel label="Игровое описание" hint="Краткое описание эффекта предмета для игрока: что делает, какие бонусы даёт, зачем нужен." />
          <AdminHelpTooltip section="items" field="description" />
          <textarea rows={3} value={draft.gameplayDescription} onChange={(event) => patch({ gameplayDescription: event.target.value })} />
        </label>
        <label>
          <AdminFieldLabel label="Лор / описание мира" hint="Художественное описание предмета: происхождение, легенда, атмосфера." />
          <textarea rows={3} value={draft.loreDescription} onChange={(event) => patch({ loreDescription: event.target.value })} />
        </label>

        <div className="admin-actions-row">
          <button disabled={isSaving} onClick={() => { void createOrUpdate(); }}>{isSaving ? 'Сохранение...' : (selectedId ? 'Сохранить' : 'Создать')}</button>
          <button disabled={!selectedId} onClick={() => { void duplicateSelected(); }}>Дублировать</button>
          <button disabled={!selectedId} onClick={() => { void disableSelected(); }}>Отключить</button>
          <button disabled={!selectedId} onClick={() => { void deleteSelected(); }}>Удалить</button>
        </div>

        <AdminSaveStatus value={saveState} />

        <section className="card admin-item-preview">
          <div className="admin-item-preview-layout">
            <div className="admin-item-preview-icon-shell" aria-hidden="true">
              <GameImageView
                className="admin-item-preview-icon"
                imageRef={normalizeGameImageRef(draft.imageRef, draft.imagePath)}
                legacyImagePath={draft.imagePath}
                runtimeImages={previewImage ? [previewImage] : runtimeImages}
                alt={draft.name || 'preview'}
                size={88}
                fallbackText={draftPreviewLabel}
              />
            </div>
          </div>
          <h4>Предпросмотр предмета</h4>
          {draft.imagePath ? <p className="muted">Legacy icon: {draft.imagePath}</p> : null}
          <p><strong>{draft.name || '(без названия)'}</strong> ({draft.id || 'ID ещё не задан'})</p>
          <p>{translateItemType(draft.type)} / {draft.subtype || 'без подтипа'} / {translateRarity(draft.rarity)}</p>
          <p>Цена: {draft.price}</p>
          <p>{draft.gameplayDescription || 'Игровое описание пока не заполнено.'}</p>
          <p className="muted">{draft.loreDescription || 'Лоровое описание пока не заполнено.'}</p>
          {itemPreview ? (
            <>
              <h4>Server preview</h4>
              <p className="muted">humanReadableEffects: {itemPreview.humanReadableEffects.length}</p>
              {itemPreview.humanReadableEffects.length > 0 ? (
                <ul>
                  {itemPreview.humanReadableEffects.map((effect, index) => <li key={`${effect}-${index}`}>{effect}</li>)}
                </ul>
              ) : (
                <p className="muted">Нет активных эффектов для превью.</p>
              )}
              <p className="muted">Сокетов: {itemPreview.socketsPreview.length}, неактивных аугментов: {itemPreview.inactiveAugments.length}</p>
              {itemPreview.setPreview ? (
                <div className="muted">
                  <p>
                    Сет: {itemPreview.setPreview.setName} ({itemPreview.setPreview.setId}), частей: {itemPreview.setPreview.totalPieces}
                  </p>
                  {itemPreview.setPreview.pieceSummaries && itemPreview.setPreview.pieceSummaries.length > 0 ? (
                    <ul>
                      {itemPreview.setPreview.pieceSummaries.map((p) => (
                        <li key={p.itemId}>{p.itemName} ({p.itemId})</li>
                      ))}
                    </ul>
                  ) : null}
                  {itemPreview.setPreview.bonuses?.length ? (
                    <ul>
                      {itemPreview.setPreview.bonuses.map((b, i) => (
                        <li key={i}>
                          {b.requiredPieces} ч.: {b.effects.join('; ')}
                          {b.penaltyEffects?.length ? ` | штрафы: ${b.penaltyEffects.join('; ')}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">Server preview станет доступен после сохранения предмета с валидным ID.</p>
          )}
        </section>

        <p className="muted">{status}</p>
      </section>

      <section className="admin-items-catalog card">
        <div className="admin-catalog-header">
          <div>
            <p className="admin-catalog-kicker">Asset Library</p>
            <h3>Все предметы</h3>
            <p className="muted">Режим как в проводнике Windows: обычные значки. Нажми на иконку предмета, чтобы снова редактировать его выше.</p>
            {onNavigate ? (
              <div className="admin-actions-row">
                <button type="button" onClick={() => onNavigate('/admin/item-sets')}>Сеты предметов</button>
              </div>
            ) : null}
          </div>
          <div className="admin-catalog-metrics">
            <span>{visibleItems.length} в выдаче</span>
            <span>{items.filter((item) => item.isEnabled).length} активных</span>
          </div>
        </div>

        <div className="admin-list-tools admin-catalog-toolbar">
          <input placeholder="Поиск по ID или названию" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | ItemType)}>
            <option value="all">Все типы</option>
            {ITEM_TYPES.map((type) => <option key={type} value={type}>{translateItemType(type)}</option>)}
          </select>
          <select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value as 'all' | ItemRarity)}>
            <option value="all">Любая редкость</option>
            {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{translateRarity(rarity)}</option>)}
          </select>
          <label
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
            title="Показывает legacy item-записи типа 'Материал'. Новые ресурсы и сырьё создавайте в разделе 'Материалы'."
          >
            <input
              type="checkbox"
              checked={showLegacyMaterials}
              onChange={(event) => setShowLegacyMaterials(event.target.checked)}
            />
            <span>Показывать материалы</span>
          </label>
          <label
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
            title="Показывает служебные игроковые предметы, созданные кузнецом для конкретных персонажей."
          >
            <input
              type="checkbox"
              checked={showPlayerRuntimeItems}
              onChange={(event) => setShowPlayerRuntimeItems(event.target.checked)}
            />
            <span>Показывать игроковые экземпляры</span>
          </label>
          <label
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
            title="Показывает только предметы профессии Плотник (carpenter)."
          >
            <input
              type="checkbox"
              checked={showOnlyCarpenter}
              onChange={(event) => setShowOnlyCarpenter(event.target.checked)}
            />
            <span>Только Плотник (carpenter)</span>
          </label>
          <button type="button" disabled={isImporting} onClick={exportItemsJson}>
            Экспорт JSON
          </button>
          <button type="button" disabled={isImporting || isSaving} onClick={openItemsImportPicker}>
            {isImporting ? 'Импорт…' : 'Импорт JSON'}
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(event) => { void onItemsImportFileChange(event); }}
          />
          <button
            onClick={() => {
              setSelectedId(null);
              const next = emptyItem();
              setDraft(next);
              syncAdvancedEditors(next);
              setRangePanelOpen(false);
            }}
          >
            Новый предмет
          </button>
        </div>

        {selectedItem ? (
          <section className="admin-items-selected-row">
            <strong>Сейчас редактируется:</strong>
            <span>{selectedItem.name} ({selectedItem.id})</span>
          </section>
        ) : null}

        <div className="admin-items-icons-grid">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              className={`admin-item-icon-card ${selectedId === item.id ? 'is-active' : ''}`}
              onClick={() => select(item)}
              title={`${item.name} (${item.id})`}
            >
              <div className={`admin-catalog-thumb admin-catalog-thumb-lg ${getItemCardAccent(item)}`}>
                {normalizeGameImageRef(item.imageRef, item.imagePath) ? (
                  <GameImageView
                    imageRef={normalizeGameImageRef(item.imageRef, item.imagePath)}
                    legacyImagePath={item.imagePath}
                    runtimeImages={runtimeImages}
                    alt={item.name}
                    size={64}
                    fallbackText={(item.name.trim() || item.type).charAt(0).toUpperCase()}
                  />
                ) : resolveItemImage(item) ? <img src={resolveItemImage(item)} alt={item.name} /> : (item.name.trim() || item.type).charAt(0).toUpperCase()}
              </div>
              <strong>{item.name || '(без названия)'}</strong>
              <span>{item.id || 'ID ещё не задан'}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
