import type {
  EquipmentVisualBindingDefinition,
  RuntimeAssemblyRuleDefinition,
  SkillAnimationBindingDefinition,
  SpriteAnimationSetDefinition,
  SpriteBodyTemplateDefinition,
  SpriteProfileDefinition,
} from '@theend/rpg-domain';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createStarterSpriteStudioContentIfMissing,
  createStarterSpriteStudioVisualContentIfMissing,
  validateSpriteStudioState,
} from '../../sprite-studio-core';
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
import { runSaveWithFeedback, useAdminSaveShortcut, type AdminSaveViewModel } from '../adminSaveTools';
import { SpriteStudioWorkspace } from '../spriteStudio/SpriteStudioWorkspace';
import {
  describeMaterializedStarterVisuals,
  materializeStarterSpriteStudioVisualAssets,
} from '../spriteStudio/v0StarterVisualGenerator';
import type { SpriteStudioDraftState, SpriteStudioReferenceData } from '../spriteStudio/types';
import '../spriteStudio/spriteStudio.css';

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
  const [isGeneratingStarterVisuals, setIsGeneratingStarterVisuals] = useState(false);

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

async function upsertEntries<T extends { id: string }>(
  collectionName: ContentCollectionName,
  entries: T[],
  existingIds: string[],
): Promise<void> {
  const existingIdSet = new Set(existingIds);
  for (const entry of entries) {
    try {
      if (existingIdSet.has(entry.id)) {
        await updateContentEntry<T>(collectionName, entry.id, entry);
        continue;
      }
      await createContentEntry<T>(collectionName, entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown content save error';
      const duplicateCreate =
        !existingIdSet.has(entry.id)
        && /duplicate\b/i.test(message);
      if (duplicateCreate) {
        try {
          await updateContentEntry<T>(collectionName, entry.id, entry);
          existingIdSet.add(entry.id);
          continue;
        } catch (updateError) {
          const updateMessage = updateError instanceof Error ? updateError.message : 'Unknown content update error';
          throw new Error(`Failed to recover duplicate upsert for ${collectionName}/${entry.id}: ${updateMessage}`);
        }
      }
      throw new Error(`Failed to upsert ${collectionName}/${entry.id}: ${message}`);
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

  const handleCreateStarterTemplates = useCallback(() => {
    setDraft((current) => {
      const starter = createStarterSpriteStudioContentIfMissing({
        bodyTemplates: current.bodyTemplates,
        animationSets: current.animationSets,
      });
      const nextDraft = {
        ...current,
        bodyTemplates: starter.bodyTemplates,
        animationSets: starter.animationSets,
      };
      const createdCount = starter.createdBodyTemplateIds.length + starter.createdAnimationSetIds.length;
      setStatus(
        createdCount > 0
          ? `Starter templates added to draft: ${createdCount}. Save when ready.`
          : 'Starter templates already exist. No duplicates were created.',
      );
      return nextDraft;
    });
  }, []);

  const handleGenerateStarterVisuals = useCallback(async () => {
    if (isGeneratingStarterVisuals) {
      return;
    }
    setIsGeneratingStarterVisuals(true);
    setStatus('Generating V0 starter visuals from internal TheEnd generator...');
    try {
      const starterDraft = createStarterSpriteStudioContentIfMissing({
        bodyTemplates: draft.bodyTemplates,
        animationSets: draft.animationSets,
      });
      setStatus('Generating V0 starter visuals: uploading rendered body/equipment assets...');
      const materialized = await materializeStarterSpriteStudioVisualAssets({
        existingImages: referenceData.images,
      });
      setStatus('Generating V0 starter visuals: preparing sprite body/binding/profile content...');
      const visualDraft = createStarterSpriteStudioVisualContentIfMissing({
        bodyTemplates: starterDraft.bodyTemplates,
        animationSets: starterDraft.animationSets,
        equipmentBindings: draft.equipmentBindings,
        spriteProfiles: draft.spriteProfiles,
        items: draft.items,
        assets: materialized.refs,
      });

      setStatus('Generating V0 starter visuals: saving body templates...');
      await upsertEntries<SpriteBodyTemplateDefinition>(
        'spriteBodyTemplates',
        visualDraft.bodyTemplates.filter((entry) => visualDraft.touchedBodyTemplateIds.includes(entry.id)),
        originalState.bodyTemplateIds,
      );
      setStatus('Generating V0 starter visuals: saving animation sets...');
      await upsertEntries<SpriteAnimationSetDefinition>(
        'spriteAnimationSets',
        visualDraft.animationSets.filter((entry) => visualDraft.touchedAnimationSetIds.includes(entry.id)),
        originalState.animationSetIds,
      );
      setStatus('Generating V0 starter visuals: saving equipment bindings...');
      await upsertEntries<EquipmentVisualBindingDefinition>(
        'equipmentVisualBindings',
        visualDraft.equipmentBindings.filter((entry) => visualDraft.touchedEquipmentBindingIds.includes(entry.id)),
        originalState.equipmentBindingIds,
      );
      setStatus('Generating V0 starter visuals: saving sprite profiles...');
      await upsertEntries<SpriteProfileDefinition>(
        'spriteProfiles',
        visualDraft.spriteProfiles.filter((entry) => visualDraft.touchedSpriteProfileIds.includes(entry.id)),
        originalState.spriteProfileIds,
      );

      setStatus('Generating V0 starter visuals: linking starter items to equipment bindings...');
      for (const item of visualDraft.items.filter((entry) => visualDraft.touchedItemIds.includes(entry.id))) {
        try {
          await updateContentEntry<AdminItem>('items', item.id, {
            defaultEquipmentVisualBindingId: item.defaultEquipmentVisualBindingId,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown item link error';
          throw new Error(`Failed to link items/${item.id} -> ${item.defaultEquipmentVisualBindingId ?? 'none'}: ${message}`);
        }
      }

      setStatus('Generating V0 starter visuals: reloading Sprite Studio state...');
      await loadAll();
      setStatus(describeMaterializedStarterVisuals(materialized));
      setSaveState({
        state: 'saved',
        message: 'V0 starter visuals generated and registered through content APIs.',
      });
    } catch (error) {
      const message = `Starter visual generation failed: ${(error as Error).message}`;
      setStatus(message);
      setSaveState({ state: 'error', message });
    } finally {
      setIsGeneratingStarterVisuals(false);
    }
  }, [
    draft.animationSets,
    draft.bodyTemplates,
    draft.equipmentBindings,
    draft.items,
    draft.spriteProfiles,
    isGeneratingStarterVisuals,
    loadAll,
    originalState.animationSetIds,
    originalState.bodyTemplateIds,
    originalState.equipmentBindingIds,
    originalState.spriteProfileIds,
    referenceData.images,
  ]);

  return (
    <div className="sprite-studio-page-root">
      <SpriteStudioWorkspace
        draft={draft}
        setDraft={setDraft}
        referenceData={referenceData}
        onStatus={setStatus}
        onRefreshAssets={loadAll}
        statusMessage={status}
        saveState={saveState}
        validation={validation}
        onCreateStarterTemplates={handleCreateStarterTemplates}
        onGenerateStarterVisuals={handleGenerateStarterVisuals}
        isGeneratingStarterVisuals={isGeneratingStarterVisuals}
      />
    </div>
  );
}
