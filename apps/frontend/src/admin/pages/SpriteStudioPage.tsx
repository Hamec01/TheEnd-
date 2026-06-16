import type {
  EquipmentVisualBindingDefinition,
  RuntimeAssemblyRuleDefinition,
  SkillAnimationBindingDefinition,
  SpriteAnimationSetDefinition,
  SpriteBodyTemplateDefinition,
  SpriteProfileDefinition,
} from '@theend/rpg-domain';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { validateSpriteStudioState } from '../../sprite-studio-core';
import {
  createContentEntry,
  deleteContentEntry,
  getContentCollection,
  updateContentEntry,
  type ContentCollectionName,
} from '../../services/content/contentApi';
import { hydrateImageSheetsFromContent } from '../../services/content/gameImageRefs';
import type {
  AdminItem,
  AdminNpc,
  AdminSkill,
  AdminVisualFx,
  ImageSheetDefinition,
  StoredImage,
} from '../../services/content/models';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { runSaveWithFeedback, useAdminSaveShortcut, type AdminSaveViewModel } from '../adminSaveTools';
import { SpriteStudioValidationPanel } from '../spriteStudio/SpriteStudioValidationPanel';
import { SpriteStudioWorkspace } from '../spriteStudio/SpriteStudioWorkspace';
import type { SpriteStudioDraftState, SpriteStudioReferenceData } from '../spriteStudio/types';

interface OriginalSpriteStudioState {
  bodyTemplateIds: string[];
  animationSetIds: string[];
  equipmentBindingIds: string[];
  spriteProfileIds: string[];
  skillBindingIds: string[];
  runtimeRuleIds: string[];
  npcLinks: Record<string, string>;
  itemLinks: Record<string, string>;
  skillLinks: Record<string, string>;
}

const EMPTY_DRAFT: SpriteStudioDraftState = {
  bodyTemplates: [],
  animationSets: [],
  equipmentBindings: [],
  spriteProfiles: [],
  skillBindings: [],
  runtimeRules: [],
  npcs: [],
  items: [],
  skills: [],
};

const EMPTY_REFERENCE_DATA: SpriteStudioReferenceData = {
  visualFx: [],
  images: [],
  imageSheets: [],
};

const EMPTY_ORIGINAL_STATE: OriginalSpriteStudioState = {
  bodyTemplateIds: [],
  animationSetIds: [],
  equipmentBindingIds: [],
  spriteProfileIds: [],
  skillBindingIds: [],
  runtimeRuleIds: [],
  npcLinks: {},
  itemLinks: {},
  skillLinks: {},
};

function normalizeLinkValue(value: string | undefined): string {
  return String(value ?? '').trim();
}

function captureLinkMap<T extends { id: string }>(entries: T[], key: keyof T): Record<string, string> {
  return Object.fromEntries(entries.map((entry) => [entry.id, normalizeLinkValue(String(entry[key] ?? ''))]));
}

export function SpriteStudioPage() {
  const [draft, setDraft] = useState<SpriteStudioDraftState>(EMPTY_DRAFT);
  const [referenceData, setReferenceData] = useState<SpriteStudioReferenceData>(EMPTY_REFERENCE_DATA);
  const [originalState, setOriginalState] = useState<OriginalSpriteStudioState>(EMPTY_ORIGINAL_STATE);
  const [status, setStatus] = useState('Загрузка Sprite Studio...');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово.' });
  const [isSaving, setIsSaving] = useState(false);

  const validation = useMemo(
    () => validateSpriteStudioState({
      bodyTemplates: draft.bodyTemplates,
      animationSets: draft.animationSets,
      equipmentBindings: draft.equipmentBindings,
      spriteProfiles: draft.spriteProfiles,
      skillBindings: draft.skillBindings,
      runtimeRules: draft.runtimeRules,
      npcs: draft.npcs,
      items: draft.items,
      skills: draft.skills,
      visualFx: referenceData.visualFx,
      images: referenceData.images,
      imageSheets: referenceData.imageSheets,
    }),
    [draft, referenceData],
  );

  const loadAll = useCallback(async () => {
    const [
      bodyTemplates,
      animationSets,
      equipmentBindings,
      spriteProfiles,
      skillBindings,
      runtimeRules,
      npcs,
      items,
      skills,
      visualFx,
      images,
      imageSheets,
    ] = await Promise.all([
      getContentCollection<SpriteBodyTemplateDefinition>('spriteBodyTemplates'),
      getContentCollection<SpriteAnimationSetDefinition>('spriteAnimationSets'),
      getContentCollection<EquipmentVisualBindingDefinition>('equipmentVisualBindings'),
      getContentCollection<SpriteProfileDefinition>('spriteProfiles'),
      getContentCollection<SkillAnimationBindingDefinition>('skillAnimationBindings'),
      getContentCollection<RuntimeAssemblyRuleDefinition>('runtimeAssemblyRules'),
      getContentCollection<AdminNpc>('npcs'),
      getContentCollection<AdminItem>('items'),
      getContentCollection<AdminSkill>('skills'),
      getContentCollection<AdminVisualFx>('visualFx'),
      getContentCollection<StoredImage>('images'),
      getContentCollection<ImageSheetDefinition>('imageSheets'),
    ]);

    hydrateImageSheetsFromContent(imageSheets);

    setDraft({
      bodyTemplates,
      animationSets,
      equipmentBindings,
      spriteProfiles,
      skillBindings,
      runtimeRules,
      npcs,
      items,
      skills,
    });
    setReferenceData({
      visualFx,
      images,
      imageSheets,
    });
    setOriginalState({
      bodyTemplateIds: bodyTemplates.map((entry) => entry.id),
      animationSetIds: animationSets.map((entry) => entry.id),
      equipmentBindingIds: equipmentBindings.map((entry) => entry.id),
      spriteProfileIds: spriteProfiles.map((entry) => entry.id),
      skillBindingIds: skillBindings.map((entry) => entry.id),
      runtimeRuleIds: runtimeRules.map((entry) => entry.id),
      npcLinks: captureLinkMap(npcs, 'spriteProfileId'),
      itemLinks: captureLinkMap(items, 'defaultEquipmentVisualBindingId'),
      skillLinks: captureLinkMap(skills, 'skillAnimationBindingId'),
    });
    setStatus('Sprite Studio готов. Runtime assembly остаётся выключенным.');
  }, []);

  useEffect(() => {
    void loadAll().catch((error) => {
      console.error('[sprite-studio] load failed', error);
      setStatus(`Ошибка загрузки Sprite Studio: ${(error as Error).message}`);
      setSaveState({ state: 'error', message: `Ошибка загрузки: ${(error as Error).message}` });
    });
  }, [loadAll]);

  async function syncCollection<T extends { id: string }>(
    collectionName: ContentCollectionName,
    currentEntries: T[],
    originalIds: string[],
  ): Promise<void> {
    const currentIdSet = new Set(currentEntries.map((entry) => entry.id));
    for (const originalId of originalIds) {
      if (!currentIdSet.has(originalId)) {
        await deleteContentEntry(collectionName, originalId);
      }
    }
    for (const entry of currentEntries) {
      if (originalIds.includes(entry.id)) {
        await updateContentEntry<T>(collectionName, entry.id, entry);
      } else {
        await createContentEntry<T>(collectionName, entry);
      }
    }
  }

  async function syncSoftLinks<T extends { id: string }>(params: {
    collection: ContentCollectionName;
    entries: T[];
    originalLinks: Record<string, string>;
    readValue: (entry: T) => string;
    buildPatch: (value: string) => Partial<T>;
  }): Promise<void> {
    for (const entry of params.entries) {
      const nextValue = normalizeLinkValue(params.readValue(entry));
      const previousValue = params.originalLinks[entry.id] ?? '';
      if (nextValue === previousValue) {
        continue;
      }
      await updateContentEntry<T>(params.collection, entry.id, params.buildPatch(nextValue));
    }
  }

  const saveAll = useCallback(async (): Promise<boolean> => {
    if (isSaving) {
      return false;
    }
    if (validation.errors.length > 0) {
      setSaveState({ state: 'error', message: `Исправьте ошибки validation: ${validation.errors[0]}` });
      setStatus('Сохранение заблокировано validation-ошибками.');
      return false;
    }

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: 'sprite-studio',
      onSave: async () => {
        await syncCollection('spriteBodyTemplates', draft.bodyTemplates, originalState.bodyTemplateIds);
        await syncCollection('spriteAnimationSets', draft.animationSets, originalState.animationSetIds);
        await syncCollection('equipmentVisualBindings', draft.equipmentBindings, originalState.equipmentBindingIds);
        await syncCollection('spriteProfiles', draft.spriteProfiles, originalState.spriteProfileIds);
        await syncCollection('skillAnimationBindings', draft.skillBindings, originalState.skillBindingIds);
        await syncCollection('runtimeAssemblyRules', draft.runtimeRules, originalState.runtimeRuleIds);

        await syncSoftLinks<AdminNpc>({
          collection: 'npcs',
          entries: draft.npcs,
          originalLinks: originalState.npcLinks,
          readValue: (entry) => normalizeLinkValue(entry.spriteProfileId),
          buildPatch: (value) => ({ spriteProfileId: value || undefined }),
        });
        await syncSoftLinks<AdminItem>({
          collection: 'items',
          entries: draft.items,
          originalLinks: originalState.itemLinks,
          readValue: (entry) => normalizeLinkValue(entry.defaultEquipmentVisualBindingId),
          buildPatch: (value) => ({ defaultEquipmentVisualBindingId: value || undefined }),
        });
        await syncSoftLinks<AdminSkill>({
          collection: 'skills',
          entries: draft.skills,
          originalLinks: originalState.skillLinks,
          readValue: (entry) => normalizeLinkValue(entry.skillAnimationBindingId),
          buildPatch: (value) => ({ skillAnimationBindingId: value || undefined }),
        });

        return true;
      },
      onAfterSave: async () => {
        await loadAll();
      },
      successLabel: () => 'Sprite Studio сохранён. JSON refs и bindings пережили reload.',
    });
    setIsSaving(false);
    if (saved) {
      setStatus('Sprite Studio сохранён. Runtime не переключался.');
    }
    return Boolean(saved);
  }, [draft, isSaving, loadAll, originalState, validation.errors]);

  useAdminSaveShortcut({
    enabled: true,
    isSaving,
    onSave: saveAll,
    successMessage: 'Sprite Studio сохранён.',
  });

  return (
    <div className="admin-editor-page" style={{ display: 'grid', gap: 16 }}>
      <section className="card admin-item-preview">
        <h3 style={{ marginTop: 0 }}>Sprite Studio Phase 1</h3>
        <p className="muted">
          Этот слой добавляет только admin + bindings + persistence + preview. Combat/world runtime не трогаем,
          `enableSpriteRuntimeAssembly` остаётся `false`, а старые NPC/items/skills продолжают жить через legacy fallback.
        </p>
        <p className="muted">{status}</p>
      </section>

      <SpriteStudioWorkspace
        draft={draft}
        setDraft={setDraft}
        referenceData={referenceData}
        onStatus={setStatus}
        onRefreshAssets={loadAll}
      />

      <SpriteStudioValidationPanel validation={validation} />
      <AdminSaveStatus value={saveState} />
    </div>
  );
}

