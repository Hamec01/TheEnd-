import { Race, RACE_DEFINITIONS, type EquipmentVisualBindingDefinition, type RuntimeAssemblyRuleDefinition, type SkillAnimationBindingDefinition, type SpriteActionType, type SpriteAnchorKey, type SpriteAnimationClipDefinition, type SpriteAnimationSetDefinition, type SpriteBodyAuthoringDefinition, type SpriteBodyTemplateDefinition, type SpriteEquipmentVisualAuthoringDefinition, type SpriteImageRef, type SpriteProfileDefinition, type SpriteSurface, type SpriteVectorDocument, type SpriteVisualAssetDefinition, type SpriteVisualFittingAnchor } from '@theend/rpg-domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildBodyVectorDocument,
  buildEquipmentVectorDocument,
  createDefaultAnchorSet,
  createDefaultBodyAuthoring,
  createDefaultEquipmentVisualAuthoring,
  createEmptyAnimationClip,
  createEmptyAnimationSet,
  createEmptyBodyTemplate,
  createEmptyEquipmentBinding,
  createEmptyRuntimeAssemblyRule,
  createEmptySkillAnimationBinding,
  createEmptySpriteProfile,
  createEmptyVectorDocument,
  createEmptyVisualAsset,
  drawSpriteStudioPreview,
  fittingAnchorToSpriteAnchor,
  listProfileBindings,
  normalizeBindingFitting,
  normalizeBodyAuthoring,
  normalizeEquipmentVisualAuthoring,
  renderVectorDocumentToDataUrl,
  SPRITE_ACTION_OPTIONS,
  SPRITE_ANCHOR_KEYS,
  SPRITE_BODY_TYPE_OPTIONS,
  SPRITE_EQUIPMENT_VISUAL_CATEGORIES,
  SPRITE_SURFACE_OPTIONS,
  SPRITE_VISUAL_FITTING_ANCHORS,
  WEAPON_GRIP_OPTIONS,
  resolveCharacterVisual,
  type CharacterVisualIssue,
  type ResolvedCharacterVisual,
  type SpriteStudioValidationResult,
} from '../../sprite-studio-core';
import { downloadCollectionJson, extractRawCollectionFromImportJson, formatExportStamp, type JsonImportMode } from '../../services/content/adminJsonImportExport';
import type { AdminItem, AdminNpc, AdminSkill, AdminVisualFx } from '../../services/content/models';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import { ImageSheetPicker } from '../components/ImageSheetPicker';
import { GameImageView } from '../components/GameImageView';
import { SpriteStudioBindingsPanel } from './SpriteStudioBindingsPanel';
import { SpriteStudioExportPanel } from './SpriteStudioExportPanel';
import { SpriteStudioTabs } from './SpriteStudioTabs';
import {
  buildSpriteStudioSelectionWarning,
  describeAssetEligibility,
  classifySpriteStudioAsset,
  describeSpriteStudioAssetKind,
  getBodyLayerEligibility,
  getEquipmentOverlayEligibility,
} from './spriteStudioAssetKinds';
import type { SpriteStudioDraftState, SpriteStudioReferenceData, SpriteStudioTab } from './types';
import type { AdminSaveViewModel } from '../adminSaveTools';
import { AdminSaveStatus } from '../AdminSaveStatus';

interface SpriteStudioWorkspaceProps {
  draft: SpriteStudioDraftState;
  setDraft: React.Dispatch<React.SetStateAction<SpriteStudioDraftState>>;
  referenceData: SpriteStudioReferenceData;
  onStatus: (message: string) => void;
  onRefreshAssets: () => Promise<void>;
  onCreateStarterTemplates: () => void;
  onGenerateStarterVisuals: () => Promise<void>;
  isGeneratingStarterVisuals?: boolean;
  statusMessage?: string;
  saveState?: AdminSaveViewModel;
  validation?: SpriteStudioValidationResult;
}

type DraftCollectionKey =
  | 'bodyTemplates'
  | 'animationSets'
  | 'vectorDocuments'
  | 'visualAssets'
  | 'equipmentBindings'
  | 'spriteProfiles'
  | 'skillBindings'
  | 'runtimeRules';

type DraftCollectionEntry<K extends DraftCollectionKey> = SpriteStudioDraftState[K] extends Array<infer T> ? T : never;

type SpriteSurfaceDraftAsset = {
  imageRef?: SpriteImageRef;
  imagePath?: string;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  zLayer?: number;
};

function formatCsv(values: string[] | undefined): string {
  return (values ?? []).join(', ');
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toggleListValue(values: string[], value: string, checked: boolean): string[] {
  if (checked) {
    return values.includes(value) ? values : [...values, value];
  }
  return values.filter((entry) => entry !== value);
}

function ensureSelection<T extends { id: string }>(currentId: string, entries: T[]): string {
  if (entries.length === 0) {
    return '';
  }
  if (currentId && entries.some((entry) => entry.id === currentId)) {
    return currentId;
  }
  return entries[0]!.id;
}

function cloneSpriteImageRef(value: SpriteImageRef | undefined): SpriteImageRef | undefined {
  if (!value) {
    return undefined;
  }
  return value.type === 'image'
    ? { type: 'image', src: value.src }
    : { type: 'tileset', sheetId: value.sheetId, frame: value.frame };
}

function localImportById<T extends { id: string }>(current: T[], incoming: T[], mode: JsonImportMode): T[] {
  if (mode === 'replaceAll') {
    return incoming;
  }
  const next = [...current];
  const byId = new Map(current.map((entry, index) => [entry.id, index] as const));
  for (const entry of incoming) {
    const existingIndex = byId.get(entry.id);
    if (existingIndex === undefined) {
      byId.set(entry.id, next.length);
      next.push(entry);
      continue;
    }
    if (mode === 'merge') {
      next[existingIndex] = { ...next[existingIndex], ...entry };
    }
  }
  return next;
}

function selectAnchorLabel(key: SpriteAnchorKey): string {
  return key.replace(/Anchor$/, '');
}

function surfaceAssetFor<T extends {
  paperdoll?: SpriteSurfaceDraftAsset;
  world?: SpriteSurfaceDraftAsset;
  battle?: SpriteSurfaceDraftAsset;
}>(entry: T, surface: SpriteSurface) {
  if (surface === 'paperdoll') {
    return entry.paperdoll;
  }
  if (surface === 'world') {
    return entry.world;
  }
  return entry.battle;
}

interface SpriteStudioReferenceCardEntry {
  label: string;
  imageRef?: SpriteImageRef;
  legacyImagePath?: string;
  description: string;
}

interface PreviewLayerInspection {
  layer: ResolvedCharacterVisual['layers'][number];
  asset: string;
  kind: import('./spriteStudioAssetKinds').SpriteStudioAssetKind;
  eligibility: ReturnType<typeof getBodyLayerEligibility>;
  warning: string | null;
}

function mapItemSlotToPreviewSlot(slot: string | undefined): keyof NonNullable<import('../../sprite-studio-core').PlayerLikeVisualEntity['equippedItemIds']> | null {
  switch (slot) {
    case 'head':
      return 'head';
    case 'chest':
      return 'chest';
    case 'gloves':
      return 'gloves';
    case 'legs':
      return 'legs';
    case 'boots':
      return 'boots';
    case 'rightHand':
      return 'mainHand';
    case 'leftHand':
      return 'offHand';
    case 'outerwear':
      return 'cloak';
    case 'belt':
      return 'back';
    default:
      return null;
  }
}

function isBodyLikeLayerGroup(group: string): boolean {
  return group === 'body_torso' || group === 'body_legs' || group === 'head' || group === 'hair' || group === 'arms';
}

export function SpriteStudioWorkspace({
  draft,
  setDraft,
  referenceData,
  onStatus,
  onRefreshAssets,
  onCreateStarterTemplates,
  onGenerateStarterVisuals,
  isGeneratingStarterVisuals = false,
  statusMessage,
  saveState,
  validation,
}: SpriteStudioWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<SpriteStudioTab>('control');
  const [importMode, setImportMode] = useState<JsonImportMode>('merge');
  const [selectedBodyTemplateId, setSelectedBodyTemplateId] = useState('');
  const [selectedAnimationSetId, setSelectedAnimationSetId] = useState('');
  const [selectedVisualAssetId, setSelectedVisualAssetId] = useState('');
  const [selectedEquipmentBindingId, setSelectedEquipmentBindingId] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedSkillBindingId, setSelectedSkillBindingId] = useState('');
  const [selectedRuntimeRuleId, setSelectedRuntimeRuleId] = useState('');
  const [selectedItemForgeItemId, setSelectedItemForgeItemId] = useState('');
  const [itemForgeExistingBindingId, setItemForgeExistingBindingId] = useState('');
  const [itemForgePreviewBindingId, setItemForgePreviewBindingId] = useState('');
  const [activeSurface, setActiveSurface] = useState<SpriteSurface>('battle');
  const [activeAction, setActiveAction] = useState<string>('idle');
  const [selectedPreviewSkillBindingId, setSelectedPreviewSkillBindingId] = useState('');
  const [selectedPreviewFxId, setSelectedPreviewFxId] = useState('');
  const [previewEquippedItemIds, setPreviewEquippedItemIds] = useState<Record<string, string> | null>(null);
  const [previewFrameIndex, setPreviewFrameIndex] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isPreviewLooping, setIsPreviewLooping] = useState(true);
  const [showPreviewAnchors, setShowPreviewAnchors] = useState(true);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);
  const [bottomTab, setBottomTab] = useState<'spritesheet' | 'import' | 'export'>('spritesheet');

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('theend-admin-sidebar-collapse', { detail: isFocusMode }));
  }, [isFocusMode]);

  useEffect(() => {
    setSelectedBodyTemplateId((current) => ensureSelection(current, draft.bodyTemplates));
    setSelectedAnimationSetId((current) => ensureSelection(current, draft.animationSets));
    setSelectedVisualAssetId((current) => ensureSelection(current, draft.visualAssets));
    setSelectedEquipmentBindingId((current) => ensureSelection(current, draft.equipmentBindings));
    setSelectedProfileId((current) => ensureSelection(current, draft.spriteProfiles));
    setSelectedSkillBindingId((current) => ensureSelection(current, draft.skillBindings));
    setSelectedRuntimeRuleId((current) => ensureSelection(current, draft.runtimeRules));
    setSelectedItemForgeItemId((current) => ensureSelection(current, draft.items));
  }, [draft.animationSets, draft.bodyTemplates, draft.equipmentBindings, draft.items, draft.runtimeRules, draft.skillBindings, draft.spriteProfiles, draft.visualAssets]);

  const raceOptions = useMemo(
    () => Object.values(Race).map((race) => ({ id: race, label: RACE_DEFINITIONS[race].label })),
    [],
  );

  const selectedBodyTemplate = useMemo(
    () => draft.bodyTemplates.find((entry) => entry.id === selectedBodyTemplateId) ?? null,
    [draft.bodyTemplates, selectedBodyTemplateId],
  );
  const selectedAnimationSet = useMemo(
    () => draft.animationSets.find((entry) => entry.id === selectedAnimationSetId) ?? null,
    [draft.animationSets, selectedAnimationSetId],
  );
  const selectedVisualAsset = useMemo(
    () => draft.visualAssets.find((entry) => entry.id === selectedVisualAssetId) ?? null,
    [draft.visualAssets, selectedVisualAssetId],
  );
  const selectedEquipmentBinding = useMemo(
    () => draft.equipmentBindings.find((entry) => entry.id === selectedEquipmentBindingId) ?? null,
    [draft.equipmentBindings, selectedEquipmentBindingId],
  );
  const selectedItemForgeItem = useMemo(
    () => draft.items.find((entry) => entry.id === selectedItemForgeItemId) ?? null,
    [draft.items, selectedItemForgeItemId],
  );
  const selectedProfile = useMemo(
    () => draft.spriteProfiles.find((entry) => entry.id === selectedProfileId) ?? null,
    [draft.spriteProfiles, selectedProfileId],
  );
  const selectedSkillBinding = useMemo(
    () => draft.skillBindings.find((entry) => entry.id === selectedSkillBindingId) ?? null,
    [draft.skillBindings, selectedSkillBindingId],
  );
  const selectedRuntimeRule = useMemo(
    () => draft.runtimeRules.find((entry) => entry.id === selectedRuntimeRuleId) ?? null,
    [draft.runtimeRules, selectedRuntimeRuleId],
  );
  const previewSkillBinding = useMemo(
    () => draft.skillBindings.find((entry) => entry.id === selectedPreviewSkillBindingId)
      ?? (selectedProfile?.previewSkillIds.length
        ? draft.skillBindings.find((entry) => entry.skillId === selectedProfile.previewSkillIds[0])
        : null)
      ?? null,
    [draft.skillBindings, selectedPreviewSkillBindingId, selectedProfile],
  );
  const previewFx = useMemo(
    () => referenceData.visualFx.find((entry) => entry.id === selectedPreviewFxId)
      ?? (selectedProfile?.previewFxIds.length
        ? referenceData.visualFx.find((entry) => entry.id === selectedProfile.previewFxIds[0])
        : null)
      ?? null,
    [referenceData.visualFx, selectedPreviewFxId, selectedProfile],
  );
  const previewBodyTemplate = useMemo(
    () => draft.bodyTemplates.find((entry) => entry.id === selectedProfile?.bodyTemplateId)
      ?? selectedBodyTemplate,
    [draft.bodyTemplates, selectedBodyTemplate, selectedProfile],
  );
  const previewAnimationSet = useMemo(
    () => draft.animationSets.find((entry) => entry.id === selectedProfile?.animationSetId)
      ?? selectedAnimationSet,
    [draft.animationSets, selectedAnimationSet, selectedProfile],
  );
  const selectedProfileNpc = useMemo(
    () => draft.npcs.find((entry) => entry.id === selectedProfile?.npcId) ?? null,
    [draft.npcs, selectedProfile],
  );
  const selectedEquipmentItem = useMemo(
    () => draft.items.find((entry) => entry.id === selectedEquipmentBinding?.itemId) ?? null,
    [draft.items, selectedEquipmentBinding],
  );
  const selectedBodyVectorDocument = useMemo(
    () => draft.vectorDocuments.find((entry) => entry.id === selectedBodyTemplate?.vectorDocumentId) ?? null,
    [draft.vectorDocuments, selectedBodyTemplate],
  );
  const selectedVisualVectorDocument = useMemo(
    () => draft.vectorDocuments.find((entry) => entry.id === selectedVisualAsset?.vectorDocumentId) ?? null,
    [draft.vectorDocuments, selectedVisualAsset],
  );
  const itemForgeBindings = useMemo(
    () => selectedItemForgeItem
      ? draft.equipmentBindings.filter((entry) => entry.itemId === selectedItemForgeItem.id)
      : [],
    [draft.equipmentBindings, selectedItemForgeItem],
  );
  const itemForgeCurrentDefaultBinding = useMemo(
    () => selectedItemForgeItem?.defaultEquipmentVisualBindingId
      ? draft.equipmentBindings.find((entry) => entry.id === selectedItemForgeItem.defaultEquipmentVisualBindingId) ?? null
      : null,
    [draft.equipmentBindings, selectedItemForgeItem],
  );
  const profileReferenceImages = useMemo<SpriteStudioReferenceCardEntry[]>(
    () => selectedProfileNpc ? [
      {
        label: 'Portrait',
        imageRef: selectedProfileNpc.portraitImageRef,
        legacyImagePath: selectedProfileNpc.portraitUrl,
        description: 'Reference only',
      },
      {
        label: 'Battle image',
        imageRef: selectedProfileNpc.combatImageRef,
        legacyImagePath: selectedProfileNpc.combatImageUrl,
        description: 'Reference only',
      },
      {
        label: 'Card / icon',
        imageRef: selectedProfileNpc.iconImageRef,
        legacyImagePath: selectedProfileNpc.iconUrl,
        description: 'Reference only',
      },
    ].filter((entry) => entry.imageRef || entry.legacyImagePath) : [],
    [selectedProfileNpc],
  );
  const selectedEquipmentItemReference = useMemo<SpriteStudioReferenceCardEntry | null>(
    () => selectedEquipmentItem && (selectedEquipmentItem.imageRef || selectedEquipmentItem.imagePath)
      ? {
        label: 'Item UI icon',
        imageRef: selectedEquipmentItem.imageRef,
        legacyImagePath: selectedEquipmentItem.imagePath,
        description: 'Reference only',
      }
      : null,
    [selectedEquipmentItem],
  );
  const selectedBodyAuthoringSignature = JSON.stringify(selectedBodyTemplate?.authoring ?? null);
  const selectedVisualAuthoringSignature = JSON.stringify(selectedVisualAsset?.equipmentAuthoring ?? null);

  useEffect(() => {
    const nextBindingId = itemForgeCurrentDefaultBinding?.id
      ?? itemForgeBindings[0]?.id
      ?? '';
    setItemForgeExistingBindingId((current) => (
      current && itemForgeBindings.some((entry) => entry.id === current)
        ? current
        : nextBindingId
    ));
    setItemForgePreviewBindingId((current) => (
      current && itemForgeBindings.some((entry) => entry.id === current)
        ? current
        : nextBindingId
    ));
  }, [itemForgeBindings, itemForgeCurrentDefaultBinding]);

  useEffect(() => {
    if (!selectedBodyTemplate?.authoring) {
      return;
    }
    void saveBodyAuthoringToDraft();
  }, [selectedBodyAuthoringSignature, selectedBodyTemplate?.id]);

  useEffect(() => {
    if (!selectedVisualAsset?.equipmentAuthoring) {
      return;
    }
    void saveEquipmentVisualAssetToDraft();
  }, [selectedVisualAsset?.id, selectedVisualAuthoringSignature]);

  const resolvedProfileBindings = useMemo(
    () => listProfileBindings({
      profile: selectedProfile,
      templates: draft.bodyTemplates,
      bindings: draft.equipmentBindings,
      raceId: selectedProfile?.npcId ? draft.npcs.find((entry) => entry.id === selectedProfile.npcId)?.race : null,
      surface: activeSurface,
    }),
    [activeSurface, draft.bodyTemplates, draft.equipmentBindings, draft.npcs, selectedProfile],
  );

  const previewSanitizedDraft = useMemo(() => {
    const issues: CharacterVisualIssue[] = [];

    function sanitizeSurfaceAsset(
      ownerType: 'body_template' | 'equipment_binding' | 'animation_clip',
      ownerId: string,
      label: string,
      asset: SpriteSurfaceDraftAsset | undefined,
    ) {
      if (!asset?.imageRef && !asset?.imagePath) {
        return asset;
      }
      const sheetId = asset?.imageRef && asset.imageRef.type === 'tileset'
        ? asset.imageRef.sheetId
        : undefined;
      const imageSheet = sheetId
        ? referenceData.imageSheets.find((entry) => entry.id === sheetId)
        : undefined;
      const kind = classifySpriteStudioAsset({
        imageRef: asset?.imageRef,
        legacyImagePath: asset?.imagePath,
        runtimeImages: referenceData.images,
        imageSheet,
        label,
      });
      const eligibility = ownerType === 'equipment_binding'
        ? getEquipmentOverlayEligibility(kind)
        : getBodyLayerEligibility(kind);
      const warning = buildSpriteStudioSelectionWarning(kind)
        ?? (eligibility === 'warning'
          ? 'Body template uses an image that looks like a portrait/reference image. It may not be a valid body/paperdoll sprite.'
          : null);
      if (eligibility !== 'blocked') {
        return asset;
      }
      issues.push({
        severity: 'warning',
        code: `sprite_studio_preview_filtered_${ownerType}`,
        message: `${warning} Sprite Studio preview filtered it out for '${label}'.`,
        entityId: ownerId,
        refId: label,
      });
      return {
        ...asset,
        imageRef: undefined,
        imagePath: undefined,
      };
    }

    return {
      bodyTemplates: draft.bodyTemplates.map((entry) => ({
        ...entry,
        paperdoll: sanitizeSurfaceAsset('body_template', entry.id, `${entry.name} paperdoll`, entry.paperdoll),
        world: sanitizeSurfaceAsset('body_template', entry.id, `${entry.name} world`, entry.world),
        battle: sanitizeSurfaceAsset('body_template', entry.id, `${entry.name} battle`, entry.battle),
      })),
      animationSets: draft.animationSets.map((entry) => ({
        ...entry,
        clips: entry.clips.map((clip, index) => {
          const sanitized = sanitizeSurfaceAsset(
            'animation_clip',
            entry.id,
            `${entry.name} ${clip.action} clip ${index + 1}`,
            clip,
          );
          return sanitized ? { ...clip, ...sanitized } : clip;
        }),
      })),
      equipmentBindings: draft.equipmentBindings.map((entry) => ({
        ...entry,
        paperdoll: sanitizeSurfaceAsset('equipment_binding', entry.id, `${entry.name} paperdoll`, entry.paperdoll),
        world: sanitizeSurfaceAsset('equipment_binding', entry.id, `${entry.name} world`, entry.world),
        battle: sanitizeSurfaceAsset('equipment_binding', entry.id, `${entry.name} battle`, entry.battle),
      })),
      issues,
    };
  }, [draft.animationSets, draft.bodyTemplates, draft.equipmentBindings, referenceData.imageSheets, referenceData.images]);

  const previewEquipmentBindings = useMemo(() => {
    if (!selectedItemForgeItem || !itemForgePreviewBindingId || !previewEquippedItemIds) {
      return previewSanitizedDraft.equipmentBindings;
    }
    return previewSanitizedDraft.equipmentBindings.filter((entry) => (
      entry.itemId !== selectedItemForgeItem.id || entry.id === itemForgePreviewBindingId
    ));
  }, [itemForgePreviewBindingId, previewEquippedItemIds, previewSanitizedDraft.equipmentBindings, selectedItemForgeItem]);

  function inspectResolvedLayer(layer: ResolvedCharacterVisual['layers'][number]): PreviewLayerInspection {
    const asset = layer.imageRef?.type === 'image'
      ? layer.imageRef.src
      : layer.imageRef?.type === 'tileset'
        ? `${layer.imageRef.sheetId}#${layer.imageRef.frame}`
        : layer.imagePath || 'none';
    const sheetId = layer.imageRef?.type === 'tileset' ? layer.imageRef.sheetId : undefined;
    const imageSheet = sheetId
      ? referenceData.imageSheets.find((entry) => entry.id === sheetId)
      : undefined;
    const kind = classifySpriteStudioAsset({
      imageRef: layer.imageRef,
      legacyImagePath: layer.imagePath,
      runtimeImages: referenceData.images,
      imageSheet,
      label: `${layer.group} ${layer.bindingId || layer.id}`,
    });

    const eligibility = isBodyLikeLayerGroup(layer.group)
      ? getBodyLayerEligibility(kind)
      : getEquipmentOverlayEligibility(kind);
    const warning = isBodyLikeLayerGroup(layer.group) && eligibility !== 'ok'
      ? `${resolvedPreview.bodyTemplateId || 'Selected body template'} uses ${asset}. This asset is not confirmed as a Sprite Studio body sprite. Create/link a proper body sprite asset before using this profile as animation source.`
      : buildSpriteStudioSelectionWarning(kind)
        ?? (eligibility === 'warning' && isBodyLikeLayerGroup(layer.group)
          ? 'Body template uses an image that looks like a portrait/reference image. It may not be a valid body/paperdoll sprite.'
          : null);

    return { layer, asset, kind, eligibility, warning };
  }

  const resolvedPreview = useMemo(() => {
    const resolved = resolveCharacterVisual({
      surface: activeSurface,
      entityType: 'npc',
      spriteProfileId: selectedProfileId || undefined,
      equippedItemIds: previewEquippedItemIds ?? undefined,
      preferredAction: activeAction || undefined,
      skillBindingId: selectedPreviewSkillBindingId || undefined,
      visualFxId: selectedPreviewFxId || undefined,
      content: {
        spriteProfiles: draft.spriteProfiles,
        spriteBodyTemplates: previewSanitizedDraft.bodyTemplates,
        spriteAnimationSets: previewSanitizedDraft.animationSets,
        equipmentVisualBindings: previewEquipmentBindings,
        skillAnimationBindings: draft.skillBindings,
        runtimeAssemblyRules: draft.runtimeRules,
        items: draft.items,
        skills: draft.skills,
        visualFx: referenceData.visualFx,
        images: referenceData.images,
        imageSheets: referenceData.imageSheets,
      },
    });

    const sanitizedLayers = resolved.layers
      .map((layer) => (
        layer.source !== 'fx' && !layer.imageRef && !layer.imagePath
          ? { ...layer, visible: false }
          : layer
      ))
      .filter((layer) => layer.visible || layer.source === 'fx');

    return {
      ...resolved,
      layers: sanitizedLayers,
      warnings: [...resolved.warnings, ...previewSanitizedDraft.issues],
    } satisfies ResolvedCharacterVisual;
  }, [
    activeAction,
    activeSurface,
    draft,
    previewEquippedItemIds,
    previewEquipmentBindings,
    previewSanitizedDraft,
    referenceData,
    selectedPreviewFxId,
    selectedPreviewSkillBindingId,
    selectedProfileId,
  ]);

  const previewLayerInspections = useMemo(
    () => resolvedPreview.layers
      .filter((layer) => layer.source !== 'fx')
      .map((layer) => inspectResolvedLayer(layer)),
    [resolvedPreview, referenceData.imageSheets, referenceData.images],
  );
  const invalidBodyInspection = useMemo(
    () => previewLayerInspections.find((entry) => isBodyLikeLayerGroup(entry.layer.group) && entry.eligibility !== 'ok') ?? null,
    [previewLayerInspections],
  );
  const guardedPreview = useMemo<ResolvedCharacterVisual>(
    () => invalidBodyInspection
      ? {
        ...resolvedPreview,
        layers: [],
        anchors: {},
      }
      : resolvedPreview,
    [invalidBodyInspection, resolvedPreview],
  );

  const previewFrameCount = Math.max(1, guardedPreview.clip?.frameCount ?? 1);
  const previewFps = Math.max(1, guardedPreview.clip?.fps ?? 8);
  const previewCanAnimate = previewFrameCount > 1;

  useEffect(() => {
    setPreviewFrameIndex((current) => Math.min(current, Math.max(0, previewFrameCount - 1)));
  }, [previewFrameCount]);

  useEffect(() => {
    setPreviewFrameIndex(0);
  }, [activeAction, activeSurface, selectedProfileId, selectedPreviewSkillBindingId, selectedPreviewFxId]);

  useEffect(() => {
    if (!isPreviewPlaying || !previewCanAnimate) {
      return undefined;
    }
    const frameDurationMs = Math.max(50, Math.round(1000 / previewFps));
    const timer = window.setTimeout(() => {
      setPreviewFrameIndex((current) => {
        const next = current + 1;
        if (next < previewFrameCount) {
          return next;
        }
        if (isPreviewLooping && guardedPreview.clip?.loop !== false) {
          return 0;
        }
        setIsPreviewPlaying(false);
        return Math.max(0, previewFrameCount - 1);
      });
    }, frameDurationMs);
    return () => window.clearTimeout(timer);
  }, [guardedPreview.clip?.loop, isPreviewLooping, isPreviewPlaying, previewCanAnimate, previewFps, previewFrameCount, previewFrameIndex]);

  useEffect(() => {
    const canvases = [previewCanvasRef.current, exportCanvasRef.current].filter((entry): entry is HTMLCanvasElement => Boolean(entry));
    if (canvases.length === 0) {
      return;
    }
    void Promise.all(canvases.map((canvas) => drawSpriteStudioPreview({
      canvas,
      resolved: guardedPreview,
      runtimeImages: referenceData.images,
      imageSheets: referenceData.imageSheets,
      showAnchors: showPreviewAnchors,
      frameIndex: previewFrameIndex,
    })));
  }, [guardedPreview, previewFrameIndex, referenceData.imageSheets, referenceData.images, showPreviewAnchors]);

  function patchCollectionEntry<K extends DraftCollectionKey>(
    key: K,
    id: string,
    updater: (current: DraftCollectionEntry<K> & { id: string }) => DraftCollectionEntry<K>,
  ) {
    setDraft((current) => ({
      ...current,
      [key]: ((current[key] as unknown as Array<DraftCollectionEntry<K> & { id: string }>).map((entry) => (
        entry.id === id ? updater(entry) : entry
      ))) as SpriteStudioDraftState[K],
    }));
  }

  function addCollectionEntry<K extends DraftCollectionKey>(key: K, entry: DraftCollectionEntry<K>) {
    setDraft((current) => ({
      ...current,
      [key]: ([...current[key], entry]) as SpriteStudioDraftState[K],
    }));
  }

  function deleteCollectionEntry<K extends DraftCollectionKey>(key: K, id: string) {
    setDraft((current) => ({
      ...current,
      [key]: (current[key].filter((entry) => entry.id !== id)) as SpriteStudioDraftState[K],
    }));
  }

  function patchNpc(id: string, patch: Partial<AdminNpc>) {
    setDraft((current) => ({
      ...current,
      npcs: current.npcs.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    }));
  }

  function patchItem(id: string, patch: Partial<AdminItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    }));
  }

  function patchSkill(id: string, patch: Partial<AdminSkill>) {
    setDraft((current) => ({
      ...current,
      skills: current.skills.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    }));
  }

  function patchBodyTemplate(updater: (current: SpriteBodyTemplateDefinition) => SpriteBodyTemplateDefinition) {
    if (!selectedBodyTemplate) {
      return;
    }
    patchCollectionEntry('bodyTemplates', selectedBodyTemplate.id, updater);
  }

  function patchAnimationSet(updater: (current: SpriteAnimationSetDefinition) => SpriteAnimationSetDefinition) {
    if (!selectedAnimationSet) {
      return;
    }
    patchCollectionEntry('animationSets', selectedAnimationSet.id, updater);
  }

  function patchVectorDocument(id: string, updater: (current: SpriteVectorDocument) => SpriteVectorDocument) {
    patchCollectionEntry('vectorDocuments', id, updater);
  }

  function patchVisualAsset(updater: (current: SpriteVisualAssetDefinition) => SpriteVisualAssetDefinition) {
    if (!selectedVisualAsset) {
      return;
    }
    patchCollectionEntry('visualAssets', selectedVisualAsset.id, updater);
  }

  function patchEquipmentBinding(updater: (current: EquipmentVisualBindingDefinition) => EquipmentVisualBindingDefinition) {
    if (!selectedEquipmentBinding) {
      return;
    }
    patchCollectionEntry('equipmentBindings', selectedEquipmentBinding.id, updater);
  }

  function patchSpriteProfile(updater: (current: SpriteProfileDefinition) => SpriteProfileDefinition) {
    if (!selectedProfile) {
      return;
    }
    patchCollectionEntry('spriteProfiles', selectedProfile.id, updater);
  }

  function patchSkillBinding(updater: (current: SkillAnimationBindingDefinition) => SkillAnimationBindingDefinition) {
    if (!selectedSkillBinding) {
      return;
    }
    patchCollectionEntry('skillBindings', selectedSkillBinding.id, updater);
  }

  function patchRuntimeRule(updater: (current: RuntimeAssemblyRuleDefinition) => RuntimeAssemblyRuleDefinition) {
    if (!selectedRuntimeRule) {
      return;
    }
    patchCollectionEntry('runtimeRules', selectedRuntimeRule.id, updater);
  }

  async function saveBodyAuthoringToDraft() {
    if (!selectedBodyTemplate) {
      return;
    }
    const authoring = normalizeBodyAuthoring(selectedBodyTemplate.authoring);
    const normalizedTemplate: SpriteBodyTemplateDefinition = {
      ...selectedBodyTemplate,
      authoring,
      vectorDocumentId: selectedBodyTemplate.vectorDocumentId || `${selectedBodyTemplate.id}_vector`,
      visualAssetId: selectedBodyTemplate.visualAssetId || `${selectedBodyTemplate.id}_asset`,
      anchors: buildBodyVectorDocument({ ...selectedBodyTemplate, authoring }).anchors as SpriteBodyTemplateDefinition['anchors'],
    };
    const vectorDocument = buildBodyVectorDocument(normalizedTemplate);
    const previewDataUrl = await renderVectorDocumentToDataUrl(vectorDocument, 128);
    const visualAsset: SpriteVisualAssetDefinition = {
      id: normalizedTemplate.visualAssetId || `${normalizedTemplate.id}_asset`,
      schemaVersion: 1,
      name: `${normalizedTemplate.name} visual`,
      kind: 'body',
      vectorDocumentId: vectorDocument.id,
      bodyAuthoring: authoring,
      previewImagePath: previewDataUrl,
      previewImageRef: undefined,
      width: vectorDocument.width,
      height: vectorDocument.height,
      tags: normalizedTemplate.tags,
      notes: normalizedTemplate.notes,
      createdAt: selectedVisualAsset?.createdAt || normalizedTemplate.createdAt,
      updatedAt: normalizedTemplate.updatedAt,
    };
    setDraft((current) => {
      const nextVectorDocuments = current.vectorDocuments.some((entry) => entry.id === vectorDocument.id)
        ? current.vectorDocuments.map((entry) => (entry.id === vectorDocument.id ? vectorDocument : entry))
        : [...current.vectorDocuments, vectorDocument];
      const nextVisualAssets = current.visualAssets.some((entry) => entry.id === visualAsset.id)
        ? current.visualAssets.map((entry) => (entry.id === visualAsset.id ? visualAsset : entry))
        : [...current.visualAssets, visualAsset];
      return {
        ...current,
        vectorDocuments: nextVectorDocuments,
        visualAssets: nextVisualAssets,
        bodyTemplates: current.bodyTemplates.map((entry) => (
          entry.id === normalizedTemplate.id
            ? {
              ...normalizedTemplate,
              paperdoll: { ...(entry.paperdoll ?? {}), imageRef: undefined, imagePath: previewDataUrl },
              world: { ...(entry.world ?? {}), imageRef: undefined, imagePath: previewDataUrl },
              battle: { ...(entry.battle ?? {}), imageRef: undefined, imagePath: previewDataUrl },
              anchors: vectorDocument.anchors as SpriteBodyTemplateDefinition['anchors'],
            }
            : entry
        )),
      };
    });
    setSelectedVisualAssetId(visualAsset.id);
    onStatus(`Body template '${selectedBodyTemplate.name}' regenerated from authoring controls.`);
  }

  async function saveEquipmentVisualAssetToDraft() {
    if (!selectedVisualAsset) {
      return;
    }
    const equipmentAuthoring = normalizeEquipmentVisualAuthoring(selectedVisualAsset.equipmentAuthoring);
    const normalizedAsset: SpriteVisualAssetDefinition = {
      ...selectedVisualAsset,
      equipmentAuthoring,
      vectorDocumentId: selectedVisualAsset.vectorDocumentId || `${selectedVisualAsset.id}_vector`,
    };
    const vectorDocument = buildEquipmentVectorDocument(normalizedAsset);
    const previewDataUrl = await renderVectorDocumentToDataUrl(vectorDocument, 128);
    setDraft((current) => ({
      ...current,
      vectorDocuments: current.vectorDocuments.some((entry) => entry.id === vectorDocument.id)
        ? current.vectorDocuments.map((entry) => (entry.id === vectorDocument.id ? vectorDocument : entry))
        : [...current.vectorDocuments, vectorDocument],
      visualAssets: current.visualAssets.map((entry) => (
        entry.id === normalizedAsset.id
          ? {
            ...normalizedAsset,
            previewImagePath: previewDataUrl,
            previewImageRef: undefined,
            width: vectorDocument.width,
            height: vectorDocument.height,
          }
          : entry
      )),
    }));
    onStatus(`Visual asset '${selectedVisualAsset.name}' regenerated from forge controls.`);
  }

  function createBindingFromSelectedVisualAsset() {
    if (!selectedVisualAsset) {
      return;
    }
    const nowId = `${selectedVisualAsset.id}_binding`;
    const authoring = normalizeEquipmentVisualAuthoring(selectedVisualAsset.equipmentAuthoring);
    const next = {
      ...createEmptyEquipmentBinding(),
      id: nowId,
      name: `${selectedVisualAsset.name} binding`,
      visualAssetId: selectedVisualAsset.id,
      vectorDocumentId: selectedVisualAsset.vectorDocumentId,
      equipmentSlot: authoring.category === 'shield'
        ? 'offHand'
        : authoring.category === 'helmet'
          ? 'head'
          : authoring.category === 'chest_armor'
            ? 'chest'
            : authoring.category === 'gloves'
              ? 'gloves'
              : authoring.category === 'boots'
                ? 'boots'
                : 'mainHand',
      weaponGripType: authoring.category === 'bow'
        ? 'bow'
        : authoring.category === 'staff'
          ? 'staff'
          : authoring.category === 'spear'
            ? 'spear'
            : authoring.category === 'shield'
              ? 'shield'
              : 'one_handed',
      preferredAnchor: authoring.category === 'shield'
        ? 'left_hand'
        : authoring.category === 'helmet'
          ? 'head'
          : authoring.category === 'chest_armor'
            ? 'torso'
            : authoring.category === 'boots'
              ? 'right_foot'
              : 'right_hand',
      secondaryAnchor: authoring.category === 'bow' ? 'left_hand' : undefined,
      twoHanded: authoring.category === 'bow' || authoring.category === 'staff' || authoring.category === 'spear',
      paperdoll: { scale: 1, offsetX: 0, offsetY: 0, rotation: authoring.rotation, zLayer: 0, imagePath: selectedVisualAsset.previewImagePath, imageRef: selectedVisualAsset.previewImageRef },
      world: { scale: 1, offsetX: 0, offsetY: 0, rotation: authoring.rotation, zLayer: 0, imagePath: selectedVisualAsset.previewImagePath, imageRef: selectedVisualAsset.previewImageRef },
      battle: { scale: 1, offsetX: 0, offsetY: 0, rotation: authoring.rotation, zLayer: 0, imagePath: selectedVisualAsset.previewImagePath, imageRef: selectedVisualAsset.previewImageRef },
      supportedActions: ['idle', 'walk', 'attack_melee', 'attack_ranged'] as SpriteActionType[],
    } satisfies EquipmentVisualBindingDefinition;
    addCollectionEntry('equipmentBindings', normalizeBindingFitting(next));
    setSelectedEquipmentBindingId(next.id);
    onStatus(`Created binding '${next.name}' from visual asset '${selectedVisualAsset.name}'.`);
  }

  function handleCollectionImport<K extends DraftCollectionKey>(
    key: K,
    file: File | undefined,
  ) {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result ?? '{}'));
        const collectionKey = ({
          bodyTemplates: 'spriteBodyTemplates',
          animationSets: 'spriteAnimationSets',
          vectorDocuments: 'spriteVectorDocuments',
          visualAssets: 'spriteVisualAssets',
          equipmentBindings: 'equipmentVisualBindings',
          spriteProfiles: 'spriteProfiles',
          skillBindings: 'skillAnimationBindings',
          runtimeRules: 'runtimeAssemblyRules',
        } as const)[key];
        const entries = extractRawCollectionFromImportJson(raw, collectionKey) as DraftCollectionEntry<K>[];
        setDraft((current) => ({
          ...current,
          [key]: localImportById(
            current[key] as unknown as Array<{ id: string }>,
            entries as Array<{ id: string }>,
            importMode,
          ) as SpriteStudioDraftState[K],
        }));
        onStatus(`Импортировано в local draft: ${collectionKey} (${(entries as Array<{ id: string }>).length}).`);
      } catch (error) {
        onStatus(`Ошибка импорта ${key}: ${(error as Error).message}`);
      }
    };
    reader.readAsText(file);
  }

  function exportDraftCollection(key: DraftCollectionKey) {
    const collectionKey = ({
      bodyTemplates: 'spriteBodyTemplates',
      animationSets: 'spriteAnimationSets',
      vectorDocuments: 'spriteVectorDocuments',
      visualAssets: 'spriteVisualAssets',
      equipmentBindings: 'equipmentVisualBindings',
      spriteProfiles: 'spriteProfiles',
      skillBindings: 'skillAnimationBindings',
      runtimeRules: 'runtimeAssemblyRules',
    } as const)[key];
    const filePrefix = `theend_${collectionKey}_${formatExportStamp()}`;
    downloadCollectionJson({
      filePrefix,
      collectionKey,
      entries: draft[key] as unknown[],
    });
    onStatus(`Экспортирован ${collectionKey}.`);
  }

  function renderReferenceCard(entry: SpriteStudioReferenceCardEntry) {
    return (
      <section key={entry.label} className="card admin-item-preview" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GameImageView
            imageRef={entry.imageRef}
            legacyImagePath={entry.legacyImagePath}
            runtimeImages={referenceData.images}
            alt={entry.label}
            size={72}
            fallbackText="N/A"
          />
          <div style={{ display: 'grid', gap: 6 }}>
            <strong>{entry.label}</strong>
            <span
              style={{
                display: 'inline-flex',
                width: 'fit-content',
                borderRadius: 999,
                padding: '3px 10px',
                fontSize: 12,
                fontWeight: 700,
                background: 'rgba(213, 180, 122, 0.18)',
                color: '#f0d6a4',
              }}
            >
              {entry.description}
            </span>
          </div>
        </div>
      </section>
    );
  }

  function renderAssetClassificationNotice(
    label: string,
    asset: { imageRef?: SpriteImageRef; imagePath?: string } | undefined,
  ) {
    const sheetId = asset?.imageRef && asset.imageRef.type === 'tileset'
      ? asset.imageRef.sheetId
      : undefined;
    const imageSheet = sheetId
      ? referenceData.imageSheets.find((entry) => entry.id === sheetId)
      : undefined;
    const kind = classifySpriteStudioAsset({
      imageRef: asset?.imageRef,
      legacyImagePath: asset?.imagePath,
      runtimeImages: referenceData.images,
      imageSheet,
      label,
    });
    const eligibility = label.toLowerCase().includes('clip')
      ? getBodyLayerEligibility(kind)
      : label.toLowerCase().includes('paperdoll') || label.toLowerCase().includes('body')
        ? getBodyLayerEligibility(kind)
        : getEquipmentOverlayEligibility(kind);
    const warning = buildSpriteStudioSelectionWarning(kind)
      ?? (eligibility === 'warning'
        ? 'Body template uses an image that looks like a portrait/reference image. It may not be a valid body/paperdoll sprite.'
        : null);
    if (!warning) {
      return null;
    }
    return (
      <p style={{ margin: '8px 0 0', color: '#ffb6b6' }}>
        {warning} Current asset kind: {describeSpriteStudioAssetKind(kind)}. Eligibility: {describeAssetEligibility(eligibility)}.
      </p>
    );
  }

  function renderAssetSourcesSection() {
    return (
      <section className="card admin-item-preview" style={{ display: 'grid', gap: 8 }}>
        <p className="muted" style={{ margin: 0 }}>
          Profile: {selectedProfileId || 'none'}
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Body template: {resolvedPreview.bodyTemplateId || 'none'} · Profile defaults: {selectedProfile?.defaultEquipmentItemIds.join(', ') || 'none'}
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {previewLayerInspections.map((entry) => (
            <div key={entry.layer.id} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(213, 180, 122, 0.14)' }}>
              <strong>{entry.layer.group}</strong>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                source: {entry.layer.source} · binding: {entry.layer.bindingId || 'none'} · item: {entry.layer.itemId || 'none'}
              </p>
              <p className="muted" style={{ margin: '4px 0 0', wordBreak: 'break-all' }}>
                asset: {entry.asset}
              </p>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                kind: {describeSpriteStudioAssetKind(entry.kind)} · eligibility: {describeAssetEligibility(entry.eligibility)}
              </p>
              {entry.warning ? <p style={{ margin: '4px 0 0', color: '#ffb6b6' }}>{entry.warning}</p> : null}
            </div>
          ))}
          {previewLayerInspections.length === 0 ? (
            <p className="muted">No drawable body/equipment layers resolved.</p>
          ) : null}
        </div>
      </section>
    );
  }

  function renderSurfaceAssetEditor(params: {
    title: string;
    asset: SpriteSurfaceDraftAsset | undefined;
    uploadSuggestedId: string;
    uploadSuggestedName: string;
    uploadFolder: string | undefined;
    onPatch: (next: SpriteSurfaceDraftAsset) => void;
  }) {
    return (
      <section className="card admin-item-preview" key={params.title}>
        <h5 style={{ marginTop: 0 }}>{params.title}</h5>
        <ImageSheetPicker
          label={`${params.title} art`}
          category="npcs"
          value={params.asset?.imageRef}
          legacyImagePath={params.asset?.imagePath}
          runtimeImages={referenceData.images}
          showUploadForImage
          uploadPresetId="world-location-sprite"
          uploadSuggestedId={params.uploadSuggestedId}
          uploadSuggestedName={params.uploadSuggestedName}
          uploadFolder={params.uploadFolder}
          selectionMode="sprite-layer"
          onStatus={onStatus}
          onChange={(next) => params.onPatch({
            ...params.asset,
            imageRef: cloneSpriteImageRef(next as SpriteImageRef | undefined),
            imagePath: next?.type === 'image' ? next.src : params.asset?.imagePath,
          })}
        />
        {renderAssetClassificationNotice(params.title, params.asset)}
        <div className="admin-form-grid" style={{ marginTop: 12 }}>
          <label>
            <span>Scale</span>
            <input
              type="number"
              step="0.1"
              value={params.asset?.scale ?? 1}
              onChange={(event) => params.onPatch({ ...params.asset, scale: Number(event.target.value) || 1 })}
            />
          </label>
          <label>
            <span>offsetX</span>
            <input
              type="number"
              value={params.asset?.offsetX ?? 0}
              onChange={(event) => params.onPatch({ ...params.asset, offsetX: Number(event.target.value) || 0 })}
            />
          </label>
          <label>
            <span>offsetY</span>
            <input
              type="number"
              value={params.asset?.offsetY ?? 0}
              onChange={(event) => params.onPatch({ ...params.asset, offsetY: Number(event.target.value) || 0 })}
            />
          </label>
          <label>
            <span>Rotation</span>
            <input
              type="number"
              step="1"
              value={params.asset?.rotation ?? 0}
              onChange={(event) => params.onPatch({ ...params.asset, rotation: Number(event.target.value) || 0 })}
            />
          </label>
          <label>
            <span>zLayer</span>
            <input
              type="number"
              step="1"
              value={params.asset?.zLayer ?? 0}
              onChange={(event) => params.onPatch({ ...params.asset, zLayer: Number(event.target.value) || 0 })}
            />
          </label>
        </div>
      </section>
    );
  }

  function renderBodyAuthoringPanel() {
    const authoring = normalizeBodyAuthoring(selectedBodyTemplate?.authoring);
    const linkedAsset = draft.visualAssets.find((entry) => entry.id === selectedBodyTemplate?.visualAssetId) ?? null;
    const bodySliderFields: Array<{ key: keyof Pick<SpriteBodyAuthoringDefinition, 'bodyHeight' | 'shoulderWidth' | 'torsoWidth' | 'bellySize' | 'armSize' | 'legSize' | 'headSize' | 'neckLength'>; label: string; min: number; max: number }> = [
      { key: 'bodyHeight', label: 'Body height', min: 0.6, max: 1.5 },
      { key: 'shoulderWidth', label: 'Shoulder width', min: 0.6, max: 1.5 },
      { key: 'torsoWidth', label: 'Torso width', min: 0.6, max: 1.5 },
      { key: 'bellySize', label: 'Belly size', min: 0, max: 1.2 },
      { key: 'armSize', label: 'Arm size', min: 0.6, max: 1.5 },
      { key: 'legSize', label: 'Leg size', min: 0.6, max: 1.5 },
      { key: 'headSize', label: 'Head size', min: 0.6, max: 1.5 },
      { key: 'neckLength', label: 'Neck length', min: 0.1, max: 1.2 },
    ];

    return (
      <section className="card admin-item-preview" style={{ display: 'grid', gap: 12 }}>
        <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
          <h5 style={{ margin: 0 }}>Body Authoring</h5>
          <div className="admin-actions-row">
            <button
              type="button"
              onClick={() => {
                const bodyTemplate = createEmptyBodyTemplate();
                const vectorDocument = createEmptyVectorDocument({ id: bodyTemplate.vectorDocumentId, name: `${bodyTemplate.name} vector`, kind: 'body' });
                const visualAsset = createEmptyVisualAsset({ id: bodyTemplate.visualAssetId, name: `${bodyTemplate.name} visual`, kind: 'body' });
                addCollectionEntry('bodyTemplates', bodyTemplate);
                addCollectionEntry('vectorDocuments', vectorDocument);
                addCollectionEntry('visualAssets', visualAsset);
                setSelectedBodyTemplateId(bodyTemplate.id);
                setSelectedVisualAssetId(visualAsset.id);
              }}
            >
              New Body
            </button>
            <button type="button" disabled={!selectedBodyTemplate} onClick={() => { void saveBodyAuthoringToDraft(); }}>
              Save Body Template
            </button>
            <button
              type="button"
              disabled={!selectedBodyTemplate}
              onClick={() => patchBodyTemplate((current) => ({ ...current, authoring: createDefaultBodyAuthoring(), anchors: createDefaultAnchorSet() }))}
            >
              Reset Parameters
            </button>
          </div>
        </div>
        <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label>
            <span>Race</span>
            <select value={authoring.raceId ?? 'human'} onChange={(event) => patchBodyTemplate((current) => ({ ...current, authoring: { ...authoring, raceId: event.target.value } }))}>
              {raceOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label>
          <label>
            <span>Sex / body type</span>
            <select value={authoring.bodyPresentation} onChange={(event) => patchBodyTemplate((current) => ({ ...current, authoring: { ...authoring, bodyPresentation: event.target.value as SpriteBodyAuthoringDefinition['bodyPresentation'] } }))}>
              <option value="male">male</option>
              <option value="female">female</option>
            </select>
          </label>
          <label>
            <span>Skin color</span>
            <input type="color" value={authoring.skinColor} onChange={(event) => patchBodyTemplate((current) => ({ ...current, authoring: { ...authoring, skinColor: event.target.value } }))} />
          </label>
          <label>
            <span>Underwear color</span>
            <input type="color" value={authoring.underwearColor} onChange={(event) => patchBodyTemplate((current) => ({ ...current, authoring: { ...authoring, underwearColor: event.target.value } }))} />
          </label>
        </div>
        <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {bodySliderFields.map(({ key, label, min, max }) => (
            <label key={key}>
              <span>{label}</span>
              <input
                type="range"
                min={min}
                max={max}
                step="0.01"
                value={String(authoring[key])}
                onChange={(event) => patchBodyTemplate((current) => ({
                  ...current,
                  authoring: {
                    ...authoring,
                    [key]: Number(event.target.value),
                  },
                }))}
              />
              <div className="muted">{authoring[key].toFixed(2)}</div>
            </label>
          ))}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Linked vector: {selectedBodyVectorDocument?.id || 'pending'} | linked visual asset: {linkedAsset?.id || selectedBodyTemplate?.visualAssetId || 'pending'}
        </p>
      </section>
    );
  }

  function renderEquipmentVisualForgePanel() {
    const authoring = normalizeEquipmentVisualAuthoring(selectedVisualAsset?.equipmentAuthoring);
    const colorFields: Array<{ key: keyof Pick<SpriteEquipmentVisualAuthoringDefinition, 'primaryColor' | 'secondaryColor' | 'accentColor' | 'outlineColor'>; label: string }> = [
      { key: 'primaryColor', label: 'Primary' },
      { key: 'secondaryColor', label: 'Secondary' },
      { key: 'accentColor', label: 'Accent' },
      { key: 'outlineColor', label: 'Outline' },
    ];
    const numericFields: Array<{ key: keyof Pick<SpriteEquipmentVisualAuthoringDefinition, 'width' | 'height' | 'length' | 'thickness' | 'rotation' | 'scale'>; label: string; min: number; max: number }> = [
      { key: 'width', label: 'Width', min: 0.3, max: 2 },
      { key: 'height', label: 'Height', min: 0.3, max: 2 },
      { key: 'length', label: 'Length', min: 0.3, max: 2.2 },
      { key: 'thickness', label: 'Thickness', min: 0.1, max: 1.5 },
      { key: 'rotation', label: 'Rotation', min: -180, max: 180 },
      { key: 'scale', label: 'Scale', min: 0.4, max: 2 },
    ];

    return (
      <section className="card admin-item-preview" style={{ display: 'grid', gap: 12 }}>
        <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
          <h5 style={{ margin: 0 }}>Equipment Visual Forge</h5>
          <div className="admin-actions-row">
            <button
              type="button"
              onClick={() => {
                const next = createEmptyVisualAsset();
                const vectorDocument = createEmptyVectorDocument({ id: next.vectorDocumentId, name: `${next.name} vector`, kind: 'equipment' });
                addCollectionEntry('visualAssets', next);
                addCollectionEntry('vectorDocuments', vectorDocument);
                setSelectedVisualAssetId(next.id);
              }}
            >
              New Equipment Visual
            </button>
            <button type="button" disabled={!selectedVisualAsset} onClick={() => { void saveEquipmentVisualAssetToDraft(); }}>
              Save Visual Asset
            </button>
            <button
              type="button"
              disabled={!selectedVisualAsset}
              onClick={() => {
                if (!selectedVisualAsset) {
                  return;
                }
                const duplicate = {
                  ...selectedVisualAsset,
                  id: `${selectedVisualAsset.id}_copy_${Date.now()}`,
                  name: `${selectedVisualAsset.name} Copy`,
                  vectorDocumentId: `${selectedVisualAsset.vectorDocumentId || selectedVisualAsset.id}_copy_${Date.now()}`,
                };
                addCollectionEntry('visualAssets', duplicate);
                addCollectionEntry('vectorDocuments', {
                  ...(selectedVisualVectorDocument ?? createEmptyVectorDocument({ kind: 'equipment' })),
                  id: duplicate.vectorDocumentId || `${duplicate.id}_vector`,
                  name: `${duplicate.name} vector`,
                });
                setSelectedVisualAssetId(duplicate.id);
              }}
            >
              Duplicate Visual
            </button>
            <button
              type="button"
              disabled={!selectedVisualAsset}
              onClick={() => patchVisualAsset((current) => ({ ...current, equipmentAuthoring: createDefaultEquipmentVisualAuthoring(current.equipmentAuthoring?.category) }))}
            >
              Reset Parameters
            </button>
          </div>
        </div>
        <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label>
            <span>Visual asset</span>
            <select value={selectedVisualAssetId} onChange={(event) => setSelectedVisualAssetId(event.target.value)}>
              {draft.visualAssets.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name} ({entry.kind})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Name</span>
            <input value={selectedVisualAsset?.name ?? ''} onChange={(event) => patchVisualAsset((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <span>Category</span>
            <select value={authoring.category} onChange={(event) => patchVisualAsset((current) => ({ ...current, equipmentAuthoring: { ...authoring, category: event.target.value as SpriteEquipmentVisualAuthoringDefinition['category'], shapePreset: event.target.value } }))}>
              {SPRITE_EQUIPMENT_VISUAL_CATEGORIES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <span>Shape preset</span>
            <input value={authoring.shapePreset} onChange={(event) => patchVisualAsset((current) => ({ ...current, equipmentAuthoring: { ...authoring, shapePreset: event.target.value } }))} />
          </label>
          <label>
            <span>Material preset</span>
            <input value={authoring.materialPreset} onChange={(event) => patchVisualAsset((current) => ({ ...current, equipmentAuthoring: { ...authoring, materialPreset: event.target.value } }))} />
          </label>
        </div>
        <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {colorFields.map(({ key, label }) => (
            <label key={key}>
              <span>{label}</span>
              <input type="color" value={authoring[key]} onChange={(event) => patchVisualAsset((current) => ({ ...current, equipmentAuthoring: { ...authoring, [key]: event.target.value } }))} />
            </label>
          ))}
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={authoring.outlineEnabled} onChange={(event) => patchVisualAsset((current) => ({ ...current, equipmentAuthoring: { ...authoring, outlineEnabled: event.target.checked } }))} />
            <span>Outline enabled</span>
          </label>
        </div>
        <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {numericFields.map(({ key, label, min, max }) => (
            <label key={key}>
              <span>{label}</span>
              <input
                type="range"
                min={String(min)}
                max={String(max)}
                step="0.01"
                value={String(authoring[key])}
                onChange={(event) => patchVisualAsset((current) => ({ ...current, equipmentAuthoring: { ...authoring, [key]: Number(event.target.value) } }))}
              />
              <div className="muted">{authoring[key].toFixed(2)}</div>
            </label>
          ))}
        </div>
        <div className="admin-actions-row">
          <button type="button" disabled={!selectedVisualAsset} onClick={createBindingFromSelectedVisualAsset}>
            Create Binding
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Linked vector: {selectedVisualVectorDocument?.id || selectedVisualAsset?.vectorDocumentId || 'pending'}
        </p>
      </section>
    );
  }

  function renderControlTab() {
    return (
      <div className="admin-editor-page" style={{ display: 'grid', gap: 16 }}>
        {renderBodyAuthoringPanel()}
        <section className="admin-form-panel">
          <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0 }}>Sprite Body Templates</h4>
            <div className="admin-actions-row">
              <button type="button" onClick={onCreateStarterTemplates}>
                Create starter templates
              </button>
              <button type="button" onClick={() => {
                const next = createEmptyBodyTemplate();
                addCollectionEntry('bodyTemplates', next);
                setSelectedBodyTemplateId(next.id);
              }}
              >
                + Body Template
              </button>
              <button type="button" disabled={!selectedBodyTemplate} onClick={() => selectedBodyTemplate && deleteCollectionEntry('bodyTemplates', selectedBodyTemplate.id)}>
                Delete
              </button>
            </div>
          </div>
          <div className="admin-form-grid">
            <label>
              <span>Template</span>
              <select value={selectedBodyTemplateId} onChange={(event) => setSelectedBodyTemplateId(event.target.value)}>
                {draft.bodyTemplates.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.id})</option>
                ))}
              </select>
            </label>
            <label>
              <span>ID</span>
              <input value={selectedBodyTemplate?.id ?? ''} onChange={(event) => patchBodyTemplate((current) => ({ ...current, id: event.target.value }))} />
            </label>
            <label>
              <span>Name</span>
              <input value={selectedBodyTemplate?.name ?? ''} onChange={(event) => patchBodyTemplate((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Body type</span>
              <select value={selectedBodyTemplate?.bodyType ?? 'humanoid'} onChange={(event) => patchBodyTemplate((current) => ({ ...current, bodyType: event.target.value as SpriteBodyTemplateDefinition['bodyType'] }))}>
                {SPRITE_BODY_TYPE_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Description</span>
            <textarea rows={2} value={selectedBodyTemplate?.description ?? ''} onChange={(event) => patchBodyTemplate((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <div className="admin-form-grid">
            <label>
              <span>Compatible body types (csv)</span>
              <input value={formatCsv(selectedBodyTemplate?.compatibleBodyTypes)} onChange={(event) => patchBodyTemplate((current) => ({ ...current, compatibleBodyTypes: parseCsv(event.target.value) }))} />
            </label>
            <label>
              <span>Tags (csv)</span>
              <input value={formatCsv(selectedBodyTemplate?.tags)} onChange={(event) => patchBodyTemplate((current) => ({ ...current, tags: parseCsv(event.target.value) }))} />
            </label>
          </div>
          <label>
            <span>Compatible races</span>
            <select
              multiple
              value={selectedBodyTemplate?.compatibleRaceIds ?? []}
              onChange={(event) => {
                const next = Array.from(event.target.selectedOptions).map((option) => option.value);
                patchBodyTemplate((current) => ({ ...current, compatibleRaceIds: next }));
              }}
            >
              {raceOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label} ({entry.id})</option>
              ))}
            </select>
          </label>
          <div className="admin-actions-row">
            {SPRITE_SURFACE_OPTIONS.map((surface) => (
              <label key={surface} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                    checked={selectedBodyTemplate?.supportedSurfaces.includes(surface) ?? false}
                    onChange={(event) => patchBodyTemplate((current) => ({
                      ...current,
                      supportedSurfaces: toggleListValue(current.supportedSurfaces, surface, event.target.checked) as SpriteSurface[],
                    }))}
                  />
                {surface}
              </label>
            ))}
          </div>
          <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {selectedBodyTemplate ? renderSurfaceAssetEditor({
              title: 'Paperdoll',
              asset: selectedBodyTemplate.paperdoll,
              uploadSuggestedId: `${selectedBodyTemplate.id}_paperdoll`,
              uploadSuggestedName: `${selectedBodyTemplate.name} paperdoll`,
              uploadFolder: buildUploadFolder('images', 'sprite-studio', selectedBodyTemplate.id, 'paperdoll'),
              onPatch: (next) => patchBodyTemplate((current) => ({ ...current, paperdoll: next })),
            }) : null}
            {selectedBodyTemplate ? renderSurfaceAssetEditor({
              title: 'World',
              asset: selectedBodyTemplate.world,
              uploadSuggestedId: `${selectedBodyTemplate.id}_world`,
              uploadSuggestedName: `${selectedBodyTemplate.name} world`,
              uploadFolder: buildUploadFolder('images', 'sprite-studio', selectedBodyTemplate.id, 'world'),
              onPatch: (next) => patchBodyTemplate((current) => ({ ...current, world: next })),
            }) : null}
            {selectedBodyTemplate ? renderSurfaceAssetEditor({
              title: 'Battle',
              asset: selectedBodyTemplate.battle,
              uploadSuggestedId: `${selectedBodyTemplate.id}_battle`,
              uploadSuggestedName: `${selectedBodyTemplate.name} battle`,
              uploadFolder: buildUploadFolder('images', 'sprite-studio', selectedBodyTemplate.id, 'battle'),
              onPatch: (next) => patchBodyTemplate((current) => ({ ...current, battle: next })),
            }) : null}
          </div>
          <section className="card admin-item-preview">
            <h5 style={{ marginTop: 0 }}>Anchors</h5>
            <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {SPRITE_ANCHOR_KEYS.map((anchorKey) => (
                <label key={anchorKey}>
                  <span>{selectAnchorLabel(anchorKey)}</span>
                  <div style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr 1fr' }}>
                    <input
                      type="number"
                      value={selectedBodyTemplate?.anchors[anchorKey].x ?? 0}
                      onChange={(event) => patchBodyTemplate((current) => ({
                        ...current,
                        anchors: {
                          ...current.anchors,
                          [anchorKey]: {
                            ...current.anchors[anchorKey],
                            x: Number(event.target.value) || 0,
                          },
                        },
                      }))}
                    />
                    <input
                      type="number"
                      value={selectedBodyTemplate?.anchors[anchorKey].y ?? 0}
                      onChange={(event) => patchBodyTemplate((current) => ({
                        ...current,
                        anchors: {
                          ...current.anchors,
                          [anchorKey]: {
                            ...current.anchors[anchorKey],
                            y: Number(event.target.value) || 0,
                          },
                        },
                      }))}
                    />
                  </div>
                </label>
              ))}
            </div>
          </section>
          <label>
            <span>Notes</span>
            <textarea rows={2} value={selectedBodyTemplate?.notes ?? ''} onChange={(event) => patchBodyTemplate((current) => ({ ...current, notes: event.target.value }))} />
          </label>
        </section>

        <section className="admin-form-panel">
          <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0 }}>Sprite Profiles</h4>
            <div className="admin-actions-row">
              <button type="button" onClick={() => {
                const next = createEmptySpriteProfile();
                addCollectionEntry('spriteProfiles', next);
                setSelectedProfileId(next.id);
              }}
              >
                + Sprite Profile
              </button>
              <button type="button" disabled={!selectedProfile} onClick={() => selectedProfile && deleteCollectionEntry('spriteProfiles', selectedProfile.id)}>
                Delete
              </button>
            </div>
          </div>
          <div className="admin-form-grid">
            <label>
              <span>Profile</span>
              <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)}>
                {draft.spriteProfiles.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.id})</option>
                ))}
              </select>
            </label>
            <label>
              <span>ID</span>
              <input value={selectedProfile?.id ?? ''} onChange={(event) => patchSpriteProfile((current) => ({ ...current, id: event.target.value }))} />
            </label>
            <label>
              <span>Name</span>
              <input value={selectedProfile?.name ?? ''} onChange={(event) => patchSpriteProfile((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>NPC</span>
              <select value={selectedProfile?.npcId ?? ''} onChange={(event) => patchSpriteProfile((current) => ({ ...current, npcId: event.target.value || undefined }))}>
                <option value="">No NPC linked</option>
                {draft.npcs.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.id})</option>
                ))}
              </select>
            </label>
            <label>
              <span>Body template</span>
              <select value={selectedProfile?.bodyTemplateId ?? ''} onChange={(event) => patchSpriteProfile((current) => ({ ...current, bodyTemplateId: event.target.value }))}>
                <option value="">Select template</option>
                {draft.bodyTemplates.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Animation set</span>
              <select value={selectedProfile?.animationSetId ?? ''} onChange={(event) => patchSpriteProfile((current) => ({ ...current, animationSetId: event.target.value }))}>
                <option value="">Select animation set</option>
                {draft.animationSets.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Default surface</span>
              <select value={selectedProfile?.defaultSurface ?? 'battle'} onChange={(event) => patchSpriteProfile((current) => ({ ...current, defaultSurface: event.target.value as SpriteSurface }))}>
                {SPRITE_SURFACE_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label>
              <span>Tags (csv)</span>
              <input value={formatCsv(selectedProfile?.tags)} onChange={(event) => patchSpriteProfile((current) => ({ ...current, tags: parseCsv(event.target.value) }))} />
            </label>
          </div>
          <label>
            <span>Default equipment items</span>
            <select
              multiple
              value={selectedProfile?.defaultEquipmentItemIds ?? []}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                patchSpriteProfile((current) => ({ ...current, defaultEquipmentItemIds: values }));
              }}
            >
              {draft.items.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name} ({entry.slot || entry.type})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Preview skills</span>
            <select
              multiple
              value={selectedProfile?.previewSkillIds ?? []}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                patchSpriteProfile((current) => ({ ...current, previewSkillIds: values }));
              }}
            >
              {draft.skills.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Preview FX</span>
            <select
              multiple
              value={selectedProfile?.previewFxIds ?? []}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                patchSpriteProfile((current) => ({ ...current, previewFxIds: values }));
              }}
            >
              {referenceData.visualFx.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name} ({entry.id})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Notes</span>
            <textarea rows={2} value={selectedProfile?.notes ?? ''} onChange={(event) => patchSpriteProfile((current) => ({ ...current, notes: event.target.value }))} />
          </label>
        </section>

        <section className="admin-form-panel">
          <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0 }}>Runtime Assembly Rules</h4>
            <div className="admin-actions-row">
              <button type="button" onClick={() => {
                const next = createEmptyRuntimeAssemblyRule();
                addCollectionEntry('runtimeRules', next);
                setSelectedRuntimeRuleId(next.id);
              }}
              >
                + Runtime Rule
              </button>
              <button type="button" disabled={!selectedRuntimeRule} onClick={() => selectedRuntimeRule && deleteCollectionEntry('runtimeRules', selectedRuntimeRule.id)}>
                Delete
              </button>
            </div>
          </div>
          <div className="admin-form-grid">
            <label>
              <span>Rule</span>
              <select value={selectedRuntimeRuleId} onChange={(event) => setSelectedRuntimeRuleId(event.target.value)}>
                {draft.runtimeRules.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.id})</option>
                ))}
              </select>
            </label>
            <label>
              <span>ID</span>
              <input value={selectedRuntimeRule?.id ?? ''} onChange={(event) => patchRuntimeRule((current) => ({ ...current, id: event.target.value }))} />
            </label>
            <label>
              <span>Name</span>
              <input value={selectedRuntimeRule?.name ?? ''} onChange={(event) => patchRuntimeRule((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Race</span>
              <select value={selectedRuntimeRule?.raceId ?? ''} onChange={(event) => patchRuntimeRule((current) => ({ ...current, raceId: event.target.value || undefined }))}>
                <option value="">Any race</option>
                {raceOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Body template</span>
              <select value={selectedRuntimeRule?.bodyTemplateId ?? ''} onChange={(event) => patchRuntimeRule((current) => ({ ...current, bodyTemplateId: event.target.value || undefined }))}>
                <option value="">Any template</option>
                {draft.bodyTemplates.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Animation set</span>
              <select value={selectedRuntimeRule?.animationSetId ?? ''} onChange={(event) => patchRuntimeRule((current) => ({ ...current, animationSetId: event.target.value || undefined }))}>
                <option value="">Any animation set</option>
                {draft.animationSets.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Profile</span>
              <select value={selectedRuntimeRule?.profileId ?? ''} onChange={(event) => patchRuntimeRule((current) => ({ ...current, profileId: event.target.value || undefined }))}>
                <option value="">No profile override</option>
                {draft.spriteProfiles.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-actions-row">
            {SPRITE_SURFACE_OPTIONS.map((surface) => (
              <label key={surface} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedRuntimeRule?.compatibleSurfaces.includes(surface) ?? false}
                  onChange={(event) => patchRuntimeRule((current) => ({
                    ...current,
                    compatibleSurfaces: toggleListValue(current.compatibleSurfaces, surface, event.target.checked) as SpriteSurface[],
                  }))}
                />
                {surface}
              </label>
            ))}
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={selectedRuntimeRule?.allowLegacyFallback ?? true}
                onChange={(event) => patchRuntimeRule((current) => ({ ...current, allowLegacyFallback: event.target.checked }))}
              />
              allowLegacyFallback
            </label>
          </div>
          <label>
            <span>Notes</span>
            <textarea rows={2} value={selectedRuntimeRule?.notes ?? ''} onChange={(event) => patchRuntimeRule((current) => ({ ...current, notes: event.target.value }))} />
          </label>
        </section>
      </div>
    );
  }

  function renderSpritesheetTab() {
    const selectedClip = selectedAnimationSet?.clips[0] ?? null;

    function patchClip(index: number, updater: (current: SpriteAnimationClipDefinition) => SpriteAnimationClipDefinition) {
      patchAnimationSet((current) => ({
        ...current,
        clips: current.clips.map((entry, clipIndex) => (clipIndex === index ? updater(entry) : entry)),
      }));
    }

    return (
      <div className="admin-editor-page" style={{ display: 'grid', gap: 16 }}>
        <section className="admin-form-panel">
          <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0 }}>Sprite Animation Sets</h4>
            <div className="admin-actions-row">
              <button type="button" onClick={() => {
                const next = createEmptyAnimationSet();
                addCollectionEntry('animationSets', next);
                setSelectedAnimationSetId(next.id);
              }}
              >
                + Animation Set
              </button>
              <button type="button" disabled={!selectedAnimationSet} onClick={() => selectedAnimationSet && deleteCollectionEntry('animationSets', selectedAnimationSet.id)}>
                Delete
              </button>
            </div>
          </div>
          <div className="admin-form-grid">
            <label>
              <span>Animation set</span>
              <select value={selectedAnimationSetId} onChange={(event) => setSelectedAnimationSetId(event.target.value)}>
                {draft.animationSets.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.id})</option>
                ))}
              </select>
            </label>
            <label>
              <span>ID</span>
              <input value={selectedAnimationSet?.id ?? ''} onChange={(event) => patchAnimationSet((current) => ({ ...current, id: event.target.value }))} />
            </label>
            <label>
              <span>Name</span>
              <input value={selectedAnimationSet?.name ?? ''} onChange={(event) => patchAnimationSet((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Compatible body types (csv)</span>
              <input value={formatCsv(selectedAnimationSet?.compatibleBodyTypes)} onChange={(event) => patchAnimationSet((current) => ({ ...current, compatibleBodyTypes: parseCsv(event.target.value) }))} />
            </label>
          </div>
          <label>
            <span>Description</span>
            <textarea rows={2} value={selectedAnimationSet?.description ?? ''} onChange={(event) => patchAnimationSet((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label>
            <span>Compatible body templates</span>
            <select
              multiple
              value={selectedAnimationSet?.compatibleBodyTemplateIds ?? []}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                patchAnimationSet((current) => ({ ...current, compatibleBodyTemplateIds: values }));
              }}
            >
              {draft.bodyTemplates.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Compatible races</span>
            <select
              multiple
              value={selectedAnimationSet?.compatibleRaceIds ?? []}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                patchAnimationSet((current) => ({ ...current, compatibleRaceIds: values }));
              }}
            >
              {raceOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label}</option>
              ))}
            </select>
          </label>
          <div className="admin-actions-row">
            {SPRITE_SURFACE_OPTIONS.map((surface) => (
              <label key={surface} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedAnimationSet?.compatibleSurfaces.includes(surface) ?? false}
                  onChange={(event) => patchAnimationSet((current) => ({
                    ...current,
                    compatibleSurfaces: toggleListValue(current.compatibleSurfaces, surface, event.target.checked) as SpriteSurface[],
                  }))}
                />
                {surface}
              </label>
            ))}
          </div>
          <label>
            <span>Notes</span>
            <textarea rows={2} value={selectedAnimationSet?.notes ?? ''} onChange={(event) => patchAnimationSet((current) => ({ ...current, notes: event.target.value }))} />
          </label>
        </section>

        <section className="admin-form-panel">
          <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0 }}>Animation clips</h4>
            <button type="button" onClick={() => patchAnimationSet((current) => ({ ...current, clips: [...current.clips, createEmptyAnimationClip()] }))}>
              + Clip
            </button>
          </div>
          {selectedAnimationSet?.clips.map((clip, index) => (
            <section key={`${clip.action}-${index}`} className="card admin-item-preview" style={{ marginBottom: 12 }}>
              <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
                <strong>{clip.label || clip.action}</strong>
                <button type="button" onClick={() => patchAnimationSet((current) => ({ ...current, clips: current.clips.filter((_, clipIndex) => clipIndex !== index) }))}>
                  Remove clip
                </button>
              </div>
              <div className="admin-form-grid">
                <label>
                  <span>Action</span>
                  <select value={clip.action} onChange={(event) => patchClip(index, (current) => ({ ...current, action: event.target.value as SpriteAnimationClipDefinition['action'] }))}>
                    {SPRITE_ACTION_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                  </select>
                </label>
                <label>
                  <span>Label</span>
                  <input value={clip.label ?? ''} onChange={(event) => patchClip(index, (current) => ({ ...current, label: event.target.value }))} />
                </label>
                <label>
                  <span>frameWidth</span>
                  <input type="number" value={clip.frameWidth} onChange={(event) => patchClip(index, (current) => ({ ...current, frameWidth: Number(event.target.value) || 1 }))} />
                </label>
                <label>
                  <span>frameHeight</span>
                  <input type="number" value={clip.frameHeight} onChange={(event) => patchClip(index, (current) => ({ ...current, frameHeight: Number(event.target.value) || 1 }))} />
                </label>
                <label>
                  <span>frameCount</span>
                  <input type="number" value={clip.frameCount} onChange={(event) => patchClip(index, (current) => ({ ...current, frameCount: Number(event.target.value) || 1 }))} />
                </label>
                <label>
                  <span>fps</span>
                  <input type="number" value={clip.fps} onChange={(event) => patchClip(index, (current) => ({ ...current, fps: Number(event.target.value) || 1 }))} />
                </label>
                <label>
                  <span>row</span>
                  <input type="number" value={clip.row ?? 0} onChange={(event) => patchClip(index, (current) => ({ ...current, row: Number(event.target.value) || 0 }))} />
                </label>
                <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={clip.loop ?? true} onChange={(event) => patchClip(index, (current) => ({ ...current, loop: event.target.checked }))} />
                  loop
                </label>
              </div>
              <ImageSheetPicker
                label="Clip art"
                category="npcs"
                value={clip.imageRef}
                legacyImagePath={clip.imagePath}
                runtimeImages={referenceData.images}
                showUploadForImage
                uploadPresetId="world-location-sprite"
                uploadSuggestedId={`${selectedAnimationSet?.id || 'animation_set'}_${clip.action}_${index}`}
                uploadSuggestedName={`${selectedAnimationSet?.name || 'animation'} ${clip.action}`}
                uploadFolder={buildUploadFolder('images', 'sprite-studio', selectedAnimationSet?.id || 'animation-set', clip.action)}
                selectionMode="sprite-layer"
                onStatus={onStatus}
                onChange={(next) => patchClip(index, (current) => ({
                  ...current,
                  imageRef: cloneSpriteImageRef(next as SpriteImageRef | undefined),
                  imagePath: next?.type === 'image' ? next.src : current.imagePath,
                }))}
              />
              {renderAssetClassificationNotice(`Clip ${clip.action}`, clip)}
              <label>
                <span>Legacy aliases (csv)</span>
                <input value={formatCsv(clip.legacyAliases)} onChange={(event) => patchClip(index, (current) => ({ ...current, legacyAliases: parseCsv(event.target.value) }))} />
              </label>
              <label>
                <span>Notes</span>
                <textarea rows={2} value={clip.notes ?? ''} onChange={(event) => patchClip(index, (current) => ({ ...current, notes: event.target.value }))} />
              </label>
            </section>
          ))}
          {!selectedClip ? <p className="muted">Create an animation set to start adding clips.</p> : null}
        </section>
      </div>
    );
  }

  function renderItemForgeTab() {
    return (
      <div className="admin-editor-page" style={{ display: 'grid', gap: 16 }}>
        {renderEquipmentVisualForgePanel()}

        <section className="admin-form-panel">
          <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0 }}>Equipment Visual Bindings</h4>
            <div className="admin-actions-row">
              <button type="button" onClick={() => {
                const next = createEmptyEquipmentBinding();
                addCollectionEntry('equipmentBindings', next);
                setSelectedEquipmentBindingId(next.id);
              }}
              >
                + Equipment Binding
              </button>
              <button type="button" disabled={!selectedEquipmentBinding} onClick={() => selectedEquipmentBinding && deleteCollectionEntry('equipmentBindings', selectedEquipmentBinding.id)}>
                Delete
              </button>
            </div>
          </div>
          <div className="admin-form-grid">
            <label>
              <span>Binding</span>
              <select value={selectedEquipmentBindingId} onChange={(event) => setSelectedEquipmentBindingId(event.target.value)}>
                {draft.equipmentBindings.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.id})</option>
                ))}
              </select>
            </label>
            <label>
              <span>ID</span>
              <input value={selectedEquipmentBinding?.id ?? ''} onChange={(event) => patchEquipmentBinding((current) => ({ ...current, id: event.target.value }))} />
            </label>
            <label>
              <span>Name</span>
              <input value={selectedEquipmentBinding?.name ?? ''} onChange={(event) => patchEquipmentBinding((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Item</span>
              <select value={selectedEquipmentBinding?.itemId ?? ''} onChange={(event) => patchEquipmentBinding((current) => ({ ...current, itemId: event.target.value }))}>
                <option value="">Select item</option>
                {draft.items.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.slot || entry.type})</option>
                ))}
              </select>
            </label>
            <label>
              <span>equipmentSlot</span>
              <input value={selectedEquipmentBinding?.equipmentSlot ?? ''} onChange={(event) => patchEquipmentBinding((current) => ({ ...current, equipmentSlot: event.target.value }))} />
            </label>
            <label>
              <span>weaponGripType</span>
              <select value={selectedEquipmentBinding?.weaponGripType ?? 'none'} onChange={(event) => patchEquipmentBinding((current) => ({ ...current, weaponGripType: event.target.value as EquipmentVisualBindingDefinition['weaponGripType'] }))}>
                {WEAPON_GRIP_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={selectedEquipmentBinding?.defaultForItem ?? false} onChange={(event) => patchEquipmentBinding((current) => ({ ...current, defaultForItem: event.target.checked }))} />
              defaultForItem
            </label>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={selectedEquipmentBinding?.twoHanded ?? false} onChange={(event) => patchEquipmentBinding((current) => ({ ...current, twoHanded: event.target.checked }))} />
              twoHanded
            </label>
          </div>
          <div className="admin-form-grid">
            <label>
              <span>Visual asset</span>
              <select
                value={selectedEquipmentBinding?.visualAssetId ?? ''}
                onChange={(event) => patchEquipmentBinding((current) => ({ ...current, visualAssetId: event.target.value || undefined }))}
              >
                <option value="">No linked visual asset</option>
                {draft.visualAssets.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.kind})</option>
                ))}
              </select>
            </label>
            <label>
              <span>Vector document</span>
              <select
                value={selectedEquipmentBinding?.vectorDocumentId ?? ''}
                onChange={(event) => patchEquipmentBinding((current) => ({ ...current, vectorDocumentId: event.target.value || undefined }))}
              >
                <option value="">No linked vector document</option>
                {draft.vectorDocuments.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.kind})</option>
                ))}
              </select>
            </label>
            <label>
              <span>Preferred anchor</span>
              <select
                value={selectedEquipmentBinding?.preferredAnchor ?? 'right_hand'}
                onChange={(event) => patchEquipmentBinding((current) => ({ ...current, preferredAnchor: event.target.value as SpriteVisualFittingAnchor }))}
              >
                {SPRITE_VISUAL_FITTING_ANCHORS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label>
              <span>Secondary anchor</span>
              <select
                value={selectedEquipmentBinding?.secondaryAnchor ?? ''}
                onChange={(event) => patchEquipmentBinding((current) => ({ ...current, secondaryAnchor: (event.target.value || undefined) as SpriteVisualFittingAnchor | undefined }))}
              >
                <option value="">None</option>
                {SPRITE_VISUAL_FITTING_ANCHORS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Supported actions</span>
            <select
              multiple
              value={selectedEquipmentBinding?.supportedActions ?? []}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value as SpriteActionType);
                patchEquipmentBinding((current) => ({ ...current, supportedActions: values }));
              }}
            >
              {SPRITE_ACTION_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>{entry}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Compatible body templates</span>
            <select
              multiple
              value={selectedEquipmentBinding?.compatibleBodyTemplateIds ?? []}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                patchEquipmentBinding((current) => ({ ...current, compatibleBodyTemplateIds: values }));
              }}
            >
              {draft.bodyTemplates.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>
          <div className="admin-form-grid">
            <label>
              <span>Compatible races</span>
              <select
                multiple
                value={selectedEquipmentBinding?.compatibleRaceIds ?? []}
                onChange={(event) => {
                  const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                  patchEquipmentBinding((current) => ({ ...current, compatibleRaceIds: values }));
                }}
              >
                {raceOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Compatible body types (csv)</span>
              <input value={formatCsv(selectedEquipmentBinding?.compatibleBodyTypes)} onChange={(event) => patchEquipmentBinding((current) => ({ ...current, compatibleBodyTypes: parseCsv(event.target.value) }))} />
            </label>
            <label>
              <span>Relative scale</span>
              <input
                type="number"
                step="0.01"
                value={selectedEquipmentBinding?.bodyRelativeScale ?? 1}
                onChange={(event) => patchEquipmentBinding((current) => ({ ...current, bodyRelativeScale: Number(event.target.value) || 1 }))}
              />
            </label>
            <label>
              <span>Relative width</span>
              <input
                type="number"
                step="0.01"
                value={selectedEquipmentBinding?.bodyRelativeWidth ?? 1}
                onChange={(event) => patchEquipmentBinding((current) => ({ ...current, bodyRelativeWidth: Number(event.target.value) || 1 }))}
              />
            </label>
            <label>
              <span>Relative height</span>
              <input
                type="number"
                step="0.01"
                value={selectedEquipmentBinding?.bodyRelativeHeight ?? 1}
                onChange={(event) => patchEquipmentBinding((current) => ({ ...current, bodyRelativeHeight: Number(event.target.value) || 1 }))}
              />
            </label>
          </div>
          <div className="admin-actions-row">
            {SPRITE_SURFACE_OPTIONS.map((surface) => (
              <label key={surface} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedEquipmentBinding?.compatibleSurfaces.includes(surface) ?? false}
                  onChange={(event) => patchEquipmentBinding((current) => ({
                    ...current,
                    compatibleSurfaces: toggleListValue(current.compatibleSurfaces, surface, event.target.checked) as SpriteSurface[],
                  }))}
                />
                {surface}
              </label>
            ))}
          </div>
          <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {selectedEquipmentBinding ? renderSurfaceAssetEditor({
              title: 'Paperdoll',
              asset: selectedEquipmentBinding.paperdoll,
              uploadSuggestedId: `${selectedEquipmentBinding.id}_paperdoll`,
              uploadSuggestedName: `${selectedEquipmentBinding.name} paperdoll`,
              uploadFolder: buildUploadFolder('images', 'sprite-studio', selectedEquipmentBinding.id, 'paperdoll'),
              onPatch: (next) => patchEquipmentBinding((current) => ({ ...current, paperdoll: next })),
            }) : null}
            {selectedEquipmentBinding ? renderSurfaceAssetEditor({
              title: 'World',
              asset: selectedEquipmentBinding.world,
              uploadSuggestedId: `${selectedEquipmentBinding.id}_world`,
              uploadSuggestedName: `${selectedEquipmentBinding.name} world`,
              uploadFolder: buildUploadFolder('images', 'sprite-studio', selectedEquipmentBinding.id, 'world'),
              onPatch: (next) => patchEquipmentBinding((current) => ({ ...current, world: next })),
            }) : null}
            {selectedEquipmentBinding ? renderSurfaceAssetEditor({
              title: 'Battle',
              asset: selectedEquipmentBinding.battle,
              uploadSuggestedId: `${selectedEquipmentBinding.id}_battle`,
              uploadSuggestedName: `${selectedEquipmentBinding.name} battle`,
              uploadFolder: buildUploadFolder('images', 'sprite-studio', selectedEquipmentBinding.id, 'battle'),
              onPatch: (next) => patchEquipmentBinding((current) => ({ ...current, battle: next })),
            }) : null}
          </div>
          <section className="card admin-item-preview">
            <h5 style={{ marginTop: 0 }}>Anchor overrides</h5>
            <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {SPRITE_ANCHOR_KEYS.map((anchorKey) => (
                <label key={anchorKey}>
                  <span>{selectAnchorLabel(anchorKey)}</span>
                  <div style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr 1fr' }}>
                    <input
                      type="number"
                      value={selectedEquipmentBinding?.anchorOverrides?.[anchorKey]?.x ?? ''}
                      onChange={(event) => patchEquipmentBinding((current) => ({
                        ...current,
                        anchorOverrides: {
                          ...current.anchorOverrides,
                          [anchorKey]: {
                            x: Number(event.target.value) || 0,
                            y: current.anchorOverrides?.[anchorKey]?.y ?? 0,
                          },
                        },
                      }))}
                    />
                    <input
                      type="number"
                      value={selectedEquipmentBinding?.anchorOverrides?.[anchorKey]?.y ?? ''}
                      onChange={(event) => patchEquipmentBinding((current) => ({
                        ...current,
                        anchorOverrides: {
                          ...current.anchorOverrides,
                          [anchorKey]: {
                            x: current.anchorOverrides?.[anchorKey]?.x ?? 0,
                            y: Number(event.target.value) || 0,
                          },
                        },
                      }))}
                    />
                  </div>
                </label>
              ))}
            </div>
          </section>
          <label>
            <span>Notes</span>
            <textarea rows={2} value={selectedEquipmentBinding?.notes ?? ''} onChange={(event) => patchEquipmentBinding((current) => ({ ...current, notes: event.target.value }))} />
          </label>
        </section>

        <section className="admin-form-panel">
          <h4>Item visual workflow</h4>
          <p className="muted">
            Item stats stay canonical gameplay data. `defaultEquipmentVisualBindingId` only controls equipped appearance in Sprite Studio and future runtime assembly.
          </p>
          <div className="admin-form-grid">
            <label>
              <span>Item</span>
              <select value={selectedItemForgeItemId} onChange={(event) => setSelectedItemForgeItemId(event.target.value)}>
                {draft.items.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} ({entry.slot || entry.type})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Current default binding</span>
              <input
                readOnly
                value={selectedItemForgeItem?.defaultEquipmentVisualBindingId ?? 'none'}
              />
            </label>
            <label>
              <span>Link existing binding</span>
              <select value={itemForgeExistingBindingId} onChange={(event) => setItemForgeExistingBindingId(event.target.value)}>
                <option value="">No binding selected</option>
                {itemForgeBindings.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} ({entry.id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Preview binding</span>
              <select value={itemForgePreviewBindingId} onChange={(event) => setItemForgePreviewBindingId(event.target.value)}>
                <option value="">Use linked/default choice</option>
                {itemForgeBindings.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} ({entry.equipmentSlot || entry.itemId})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-actions-row" style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                if (!selectedItemForgeItem) {
                  return;
                }
                const next = createEmptyEquipmentBinding();
                const nextSlot = selectedItemForgeItem.slot === 'leftHand'
                  ? 'offHand'
                  : selectedItemForgeItem.slot === 'rightHand'
                    ? 'mainHand'
                    : selectedItemForgeItem.slot || next.equipmentSlot;
                addCollectionEntry('equipmentBindings', {
                  ...next,
                  name: `${selectedItemForgeItem.name} visual`,
                  itemId: selectedItemForgeItem.id,
                  equipmentSlot: nextSlot,
                });
                setSelectedEquipmentBindingId(next.id);
                setItemForgeExistingBindingId(next.id);
                setItemForgePreviewBindingId(next.id);
              }}
            >
              Create Equipment Visual Binding
            </button>
            <button
              type="button"
              disabled={!selectedItemForgeItem || !itemForgeExistingBindingId}
              onClick={() => {
                if (!selectedItemForgeItem || !itemForgeExistingBindingId) {
                  return;
                }
                patchItem(selectedItemForgeItem.id, { defaultEquipmentVisualBindingId: itemForgeExistingBindingId });
                const linkedBinding = draft.equipmentBindings.find((entry) => entry.id === itemForgeExistingBindingId);
                if (linkedBinding) {
                  setSelectedEquipmentBindingId(linkedBinding.id);
                }
              }}
            >
              Link To Item
            </button>
            <button
              type="button"
              disabled={!selectedItemForgeItem || !selectedProfileId}
              onClick={() => {
                if (!selectedItemForgeItem) {
                  return;
                }
                const previewSlot = mapItemSlotToPreviewSlot(
                  draft.equipmentBindings.find((entry) => entry.id === (itemForgePreviewBindingId || itemForgeExistingBindingId || selectedItemForgeItem.defaultEquipmentVisualBindingId))?.equipmentSlot
                  || selectedItemForgeItem.slot,
                );
                if (!previewSlot) {
                  onStatus(`Cannot preview '${selectedItemForgeItem.name}' on character: item slot is not previewable in Sprite Studio.`);
                  return;
                }
                setPreviewEquippedItemIds({ [previewSlot]: selectedItemForgeItem.id });
                if (itemForgePreviewBindingId) {
                  setSelectedEquipmentBindingId(itemForgePreviewBindingId);
                } else if (itemForgeExistingBindingId) {
                  setSelectedEquipmentBindingId(itemForgeExistingBindingId);
                }
                onStatus(`Previewing '${selectedItemForgeItem.name}' on '${selectedProfile?.name || selectedProfileId}'.`);
              }}
            >
              Preview Equipped On Character
            </button>
            <button
              type="button"
              disabled={!selectedItemForgeItem?.defaultEquipmentVisualBindingId}
              onClick={() => {
                if (!selectedItemForgeItem) {
                  return;
                }
                patchItem(selectedItemForgeItem.id, { defaultEquipmentVisualBindingId: undefined });
                onStatus(`Unlinked equipment visual binding from '${selectedItemForgeItem.name}'.`);
              }}
            >
              Unlink Visual Binding
            </button>
            <button
              type="button"
              disabled={!previewEquippedItemIds}
              onClick={() => setPreviewEquippedItemIds(null)}
            >
              Clear Equipped Preview
            </button>
          </div>
          {selectedItemForgeItem ? (
            <section className="card admin-item-preview" style={{ marginTop: 12 }}>
              <h5 style={{ marginTop: 0 }}>Item data</h5>
              <div className="admin-form-grid">
                <label>
                  <span>Type</span>
                  <input readOnly value={selectedItemForgeItem.type} />
                </label>
                <label>
                  <span>Slot</span>
                  <input readOnly value={selectedItemForgeItem.slot || 'none'} />
                </label>
                <label>
                  <span>Rarity</span>
                  <input readOnly value={selectedItemForgeItem.rarity} />
                </label>
                <label>
                  <span>Damage / Armor</span>
                  <input
                    readOnly
                    value={selectedItemForgeItem.damageMin || selectedItemForgeItem.damageMax
                      ? `${selectedItemForgeItem.damageMin ?? 0}-${selectedItemForgeItem.damageMax ?? 0}`
                      : String(selectedItemForgeItem.armorValue ?? 0)}
                  />
                </label>
                <label>
                  <span>Durability</span>
                  <input
                    readOnly
                    value={selectedItemForgeItem.durability ?? selectedItemForgeItem.maxDurability ?? 'n/a'}
                  />
                </label>
              </div>
              <label>
                <span>Gameplay description</span>
                <textarea readOnly rows={2} value={selectedItemForgeItem.gameplayDescription ?? ''} />
              </label>
              {selectedItemForgeItem.imageRef || selectedItemForgeItem.imagePath ? renderReferenceCard({
                label: 'Inventory icon',
                imageRef: selectedItemForgeItem.imageRef,
                legacyImagePath: selectedItemForgeItem.imagePath,
                description: 'Reference only',
              }) : <p className="muted">Selected item has no inventory or merchant icon yet.</p>}
              {selectedItemForgeItem.imageRef || selectedItemForgeItem.imagePath ? renderReferenceCard({
                label: 'Merchant icon',
                imageRef: selectedItemForgeItem.imageRef,
                legacyImagePath: selectedItemForgeItem.imagePath,
                description: 'Reference only',
              }) : null}
              <p style={{ marginTop: 8, color: selectedItemForgeItem.defaultEquipmentVisualBindingId ? '#d7e2f7' : '#ffb6b6' }}>
                {selectedItemForgeItem.defaultEquipmentVisualBindingId
                  ? 'Inventory icon stays reference-only. Equipped appearance comes from the linked visual binding.'
                  : 'This item has an inventory icon, but no equipped visual sprite binding.'}
              </p>
              <h5 style={{ marginBottom: 8 }}>Equipment visual</h5>
              <div className="admin-form-grid">
                <label>
                  <span>equipmentVisualBindingId</span>
                  <input readOnly value={itemForgeCurrentDefaultBinding?.id ?? itemForgeExistingBindingId ?? 'none'} />
                </label>
                <label>
                  <span>Visual sprite</span>
                  <input
                    readOnly
                    value={itemForgeCurrentDefaultBinding?.battle?.imageRef?.type === 'image'
                      ? itemForgeCurrentDefaultBinding.battle.imageRef.src
                      : itemForgeCurrentDefaultBinding?.battle?.imagePath || 'none'}
                  />
                </label>
                <label>
                  <span>Slot</span>
                  <input readOnly value={itemForgeCurrentDefaultBinding?.equipmentSlot || 'none'} />
                </label>
                <label>
                  <span>Z-layer</span>
                  <input readOnly value={itemForgeCurrentDefaultBinding?.weaponGripType || 'default'} />
                </label>
              </div>
              <p className="muted" style={{ marginTop: 8 }}>
                Existing bindings for item: {itemForgeBindings.length}. Preview profile: {selectedProfile?.name || 'none selected'}.
              </p>
            </section>
          ) : null}
          <section className="card admin-item-preview" style={{ marginTop: 12 }}>
            <h5 style={{ marginTop: 0 }}>Legacy Sprite Assets</h5>
            <p className="muted" style={{ marginBottom: 8 }}>
              Legacy import stays deferred in Phase 2.7. This section is a controlled report/stub only.
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Local reference folder: `Sprite+engine/` (optional, legacy source only)
            </p>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              Next step later: scan/list old engine assets, classify them, and import only confirmed Sprite Visual Assets.
            </p>
          </section>
        </section>
      </div>
    );
  }

  function renderPlaygroundTab() {
    return (
      <div className="admin-editor-page" style={{ display: 'grid', gap: 16 }}>
        <section className="admin-form-panel">
          <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0 }}>Preview playground</h4>
            <button type="button" onClick={() => { void onRefreshAssets(); }}>
              Refresh images / sheets
            </button>
          </div>
          <div className="admin-form-grid">
            <label>
              <span>Sprite profile</span>
              <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)}>
                {draft.spriteProfiles.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Surface</span>
              <select value={activeSurface} onChange={(event) => setActiveSurface(event.target.value as SpriteSurface)}>
                {SPRITE_SURFACE_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label>
              <span>Action</span>
              <select value={activeAction} onChange={(event) => setActiveAction(event.target.value)}>
                {SPRITE_ACTION_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label>
              <span>Frame scrubber</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, previewFrameCount - 1)}
                value={Math.min(previewFrameIndex, Math.max(0, previewFrameCount - 1))}
                onChange={(event) => {
                  setIsPreviewPlaying(false);
                  setPreviewFrameIndex(Number(event.target.value) || 0);
                }}
                disabled={!previewCanAnimate}
              />
            </label>
            <label>
              <span>Preview skill binding</span>
              <select value={selectedPreviewSkillBindingId} onChange={(event) => setSelectedPreviewSkillBindingId(event.target.value)}>
                <option value="">Auto from profile</option>
                {draft.skillBindings.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.skillId})</option>
                ))}
              </select>
            </label>
            <label>
              <span>Preview FX</span>
              <select value={selectedPreviewFxId} onChange={(event) => setSelectedPreviewFxId(event.target.value)}>
                <option value="">Auto from profile</option>
                {referenceData.visualFx.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-actions-row">
            <button type="button" onClick={() => setIsPreviewPlaying((current) => !current)} disabled={!previewCanAnimate}>
              {isPreviewPlaying ? 'Pause preview' : 'Play preview'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPreviewPlaying(false);
                setPreviewFrameIndex(0);
              }}
            >
              Reset preview
            </button>
            <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={isPreviewLooping} onChange={(event) => setIsPreviewLooping(event.target.checked)} />
              <span>Loop</span>
            </label>
            <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={showPreviewAnchors} onChange={(event) => setShowPreviewAnchors(event.target.checked)} />
              <span>Show anchors</span>
            </label>
          </div>
        </section>

        <section className="card admin-item-preview" style={{ display: 'grid', gap: 16 }}>
          <div>
            <p><strong>Profile:</strong> {selectedProfile?.name || 'none'}</p>
            <p><strong>Body template:</strong> {previewBodyTemplate?.name || 'none'}</p>
            <p><strong>Animation set:</strong> {previewAnimationSet?.name || 'none'}</p>
            <p><strong>Clip:</strong> {guardedPreview.clip?.action || 'static'} · frame {Math.min(previewFrameCount, previewFrameIndex + 1)}/{previewFrameCount} · fps {previewFps}</p>
            <p><strong>Resolved equipment bindings:</strong> {resolvedProfileBindings.length}</p>
            <ul>
              {resolvedProfileBindings.map((binding) => (
                <li key={binding.id}>{binding.name} · {binding.itemId} · {binding.equipmentSlot}</li>
              ))}
            </ul>
            <p className="muted">
              Этот preview уже использует реальные body templates, animation sets, item bindings, skill bindings, FX ids,
              image refs и image sheets TheEnd. Runtime пока не включён: `enableSpriteRuntimeAssembly = false`.
            </p>
          </div>
        </section>
      </div>
    );
  }

  function renderImportTab() {
    const entries: Array<{ key: DraftCollectionKey; label: string; count: number }> = [
      { key: 'bodyTemplates', label: 'spriteBodyTemplates', count: draft.bodyTemplates.length },
      { key: 'animationSets', label: 'spriteAnimationSets', count: draft.animationSets.length },
      { key: 'vectorDocuments', label: 'spriteVectorDocuments', count: draft.vectorDocuments.length },
      { key: 'visualAssets', label: 'spriteVisualAssets', count: draft.visualAssets.length },
      { key: 'equipmentBindings', label: 'equipmentVisualBindings', count: draft.equipmentBindings.length },
      { key: 'spriteProfiles', label: 'spriteProfiles', count: draft.spriteProfiles.length },
      { key: 'skillBindings', label: 'skillAnimationBindings', count: draft.skillBindings.length },
      { key: 'runtimeRules', label: 'runtimeAssemblyRules', count: draft.runtimeRules.length },
    ];

    return (
      <div className="admin-editor-page" style={{ display: 'grid', gap: 16 }}>
        <section className="admin-form-panel">
          <h4>Collection import/export</h4>
          <p className="muted">
            Здесь мы работаем только с new sprite collections. Импорт сначала попадает в local draft,
            потом сохраняется обычной кнопкой `SAVE NOW` через content API.
          </p>
          <label>
            <span>Import mode</span>
            <select value={importMode} onChange={(event) => setImportMode(event.target.value as JsonImportMode)}>
              <option value="merge">merge</option>
              <option value="addOnly">addOnly</option>
              <option value="replaceAll">replaceAll</option>
            </select>
          </label>
        </section>
        {entries.map((entry) => (
          <section key={entry.key} className="card admin-item-preview">
            <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{entry.label}</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>Entries: {entry.count}</p>
              </div>
              <div className="admin-actions-row">
                <button type="button" onClick={() => exportDraftCollection(entry.key)}>Export JSON</button>
                <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <span>Import JSON</span>
                  <input
                    type="file"
                    accept="application/json"
                    onChange={(event) => handleCollectionImport(entry.key, event.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
          </section>
        ))}
      </div>
    );
  }

  function renderSkillBindingsEditor() {
    return (
      <section className="admin-form-panel">
        <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
          <h4 style={{ margin: 0 }}>Skill Animation Bindings</h4>
          <div className="admin-actions-row">
            <button type="button" onClick={() => {
              const next = createEmptySkillAnimationBinding();
              addCollectionEntry('skillBindings', next);
              setSelectedSkillBindingId(next.id);
            }}
            >
              + Skill Binding
            </button>
            <button type="button" disabled={!selectedSkillBinding} onClick={() => selectedSkillBinding && deleteCollectionEntry('skillBindings', selectedSkillBinding.id)}>
              Delete
            </button>
          </div>
        </div>
        <div className="admin-form-grid">
          <label>
            <span>Binding</span>
            <select value={selectedSkillBindingId} onChange={(event) => setSelectedSkillBindingId(event.target.value)}>
              {draft.skillBindings.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name} ({entry.id})</option>
              ))}
            </select>
          </label>
          <label>
            <span>ID</span>
            <input value={selectedSkillBinding?.id ?? ''} onChange={(event) => patchSkillBinding((current) => ({ ...current, id: event.target.value }))} />
          </label>
          <label>
            <span>Name</span>
            <input value={selectedSkillBinding?.name ?? ''} onChange={(event) => patchSkillBinding((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <span>Skill</span>
            <select value={selectedSkillBinding?.skillId ?? ''} onChange={(event) => patchSkillBinding((current) => ({ ...current, skillId: event.target.value }))}>
              <option value="">Select skill</option>
              {draft.skills.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Action</span>
            <select value={selectedSkillBinding?.action ?? 'cast'} onChange={(event) => patchSkillBinding((current) => ({ ...current, action: event.target.value as SkillAnimationBindingDefinition['action'] }))}>
              {SPRITE_ACTION_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <span>Animation set</span>
            <select value={selectedSkillBinding?.animationSetId ?? ''} onChange={(event) => patchSkillBinding((current) => ({ ...current, animationSetId: event.target.value || undefined }))}>
              <option value="">Use profile animation set</option>
              {draft.animationSets.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Cast FX</span>
            <select value={selectedSkillBinding?.castFxId ?? ''} onChange={(event) => patchSkillBinding((current) => ({ ...current, castFxId: event.target.value || undefined }))}>
              <option value="">None</option>
              {referenceData.visualFx.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Projectile FX</span>
            <select value={selectedSkillBinding?.projectileFxId ?? ''} onChange={(event) => patchSkillBinding((current) => ({ ...current, projectileFxId: event.target.value || undefined }))}>
              <option value="">None</option>
              {referenceData.visualFx.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Hit FX</span>
            <select value={selectedSkillBinding?.hitFxId ?? ''} onChange={(event) => patchSkillBinding((current) => ({ ...current, hitFxId: event.target.value || undefined }))}>
              <option value="">None</option>
              {referenceData.visualFx.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>sourceAnchor</span>
            <select value={selectedSkillBinding?.sourceAnchor ?? 'castFxAnchor'} onChange={(event) => patchSkillBinding((current) => ({ ...current, sourceAnchor: event.target.value as SkillAnimationBindingDefinition['sourceAnchor'] }))}>
              {SPRITE_ANCHOR_KEYS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <span>projectileAnchor</span>
            <select value={selectedSkillBinding?.projectileAnchor ?? 'projectileSpawnAnchor'} onChange={(event) => patchSkillBinding((current) => ({ ...current, projectileAnchor: event.target.value as SkillAnimationBindingDefinition['projectileAnchor'] }))}>
              {SPRITE_ANCHOR_KEYS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <span>hitAnchor</span>
            <select value={selectedSkillBinding?.hitAnchor ?? 'hitFxAnchor'} onChange={(event) => patchSkillBinding((current) => ({ ...current, hitAnchor: event.target.value as SkillAnimationBindingDefinition['hitAnchor'] }))}>
              {SPRITE_ANCHOR_KEYS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
        </div>
        <div className="admin-actions-row">
          {SPRITE_SURFACE_OPTIONS.map((surface) => (
            <label key={surface} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={selectedSkillBinding?.compatibleSurfaces.includes(surface) ?? false}
                onChange={(event) => patchSkillBinding((current) => ({
                  ...current,
                  compatibleSurfaces: toggleListValue(current.compatibleSurfaces, surface, event.target.checked) as SpriteSurface[],
                }))}
              />
              {surface}
            </label>
          ))}
        </div>
        <label>
          <span>Notes</span>
          <textarea rows={2} value={selectedSkillBinding?.notes ?? ''} onChange={(event) => patchSkillBinding((current) => ({ ...current, notes: event.target.value }))} />
        </label>
      </section>
    );
  }

  function renderBindingsTab() {
    return (
      <div className="admin-editor-page" style={{ display: 'grid', gap: 16 }}>
        {renderSkillBindingsEditor()}
        <SpriteStudioBindingsPanel
          npcs={draft.npcs}
          items={draft.items}
          skills={draft.skills}
          spriteProfiles={draft.spriteProfiles}
          equipmentBindings={draft.equipmentBindings}
          skillBindings={draft.skillBindings}
          onPatchNpc={patchNpc}
          onPatchItem={patchItem}
          onPatchSkill={patchSkill}
        />
      </div>
    );
  }

  function renderExportTab() {
    return (
      <div className="admin-editor-page" style={{ display: 'grid', gap: 16 }}>
        <SpriteStudioExportPanel previewCanvas={exportCanvasRef.current} activeProfile={selectedProfile} onUploaded={() => onStatus('Preview uploaded through image pipeline.')} />
        <section className="card admin-item-preview">
          <h4>Persistence notes</h4>
          <ul>
            <li>Content save/export stores only JSON metadata plus refs.</li>
            <li>Binary/base64 is blocked from the sprite collections.</li>
            <li>Legacy NPC/item/skill visuals stay intact until runtime assembly is explicitly enabled.</li>
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="sprite-studio-shell">
      <canvas ref={exportCanvasRef} width={384} height={384} style={{ display: 'none' }} />

      {/* Topbar с заголовком и статусом */}
      <div className="sprite-studio-topbar card">
        <div className="sprite-studio-topbar-main">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>🎞️ Sprite Studio</h2>
          </div>
          <div className="sprite-studio-topbar-side">
            <div className="sprite-studio-chip-row">
              <span className="sprite-studio-chip">Phase 2 Engine active</span>
              <span className="sprite-studio-chip">Preview: resolveCharacterVisual</span>
              <button
                type="button"
                onClick={() => { void onGenerateStarterVisuals(); }}
                className="sprite-studio-refresh-button"
                disabled={isGeneratingStarterVisuals}
              >
                {isGeneratingStarterVisuals ? 'Generating starter visuals...' : 'Generate V0 starter visuals'}
              </button>
              <button
                type="button"
                onClick={() => setIsFocusMode(!isFocusMode)}
                className="sprite-studio-refresh-button"
                style={{
                  background: isFocusMode ? 'rgba(213, 180, 122, 0.25)' : 'rgba(255, 255, 255, 0.02)',
                  borderColor: isFocusMode ? 'rgba(213, 180, 122, 0.5)' : 'rgba(213, 180, 122, 0.18)'
                }}
              >
                {isFocusMode ? 'Exit focus' : 'Focus mode'}
              </button>
            </div>
            {statusMessage && (
              <div className="sprite-studio-status-box">
                <p>{statusMessage}</p>
              </div>
            )}
            {saveState && <AdminSaveStatus value={saveState} />}
          </div>
        </div>
      </div>

      {/* Main Grid: Left sidebar, Center stage, Right validation */}
      <div className="sprite-studio-main">

        {/* Left column (sidebar panel) */}
        <div className="sprite-studio-panel sprite-studio-left">
          <div className="sprite-studio-tabbar">
            <SpriteStudioTabs activeTab={activeTab} onChange={setActiveTab} />
          </div>
          <div className="sprite-studio-panel-body sprite-studio-left-body sprite-studio-scroll-region">
            {activeTab === 'control' ? renderControlTab() : null}
            {activeTab === 'playground' ? renderPlaygroundTab() : null}
            {activeTab === 'itemForge' ? renderItemForgeTab() : null}
            {activeTab === 'bindings' ? renderBindingsTab() : null}
          </div>
        </div>

        {/* Center column (stage & canvas preview) */}
        <div className="sprite-studio-panel sprite-studio-preview">
          <div className="sprite-studio-panel-header">
            <h3>Visual Preview</h3>
            <div className="sprite-studio-toolbar">
              <button type="button" className="sprite-studio-refresh-button" onClick={() => { void onRefreshAssets(); }}>
                Refresh Assets
              </button>
            </div>
          </div>
          <div className="sprite-studio-panel-body sprite-studio-preview-body">
            <div className="sprite-studio-preview-stage">
              <div className="card sprite-studio-preview-card" style={{ position: 'relative' }}>
                <canvas
                  ref={previewCanvasRef}
                  width={384}
                  height={384}
                  style={{
                    width: 384,
                    height: 384,
                    border: '1px solid rgba(215, 178, 103, 0.25)',
                    borderRadius: 12,
                    background: 'rgba(0, 0, 0, 0.3)',
                    imageRendering: 'pixelated'
                  }}
                />
                {invalidBodyInspection ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'grid',
                      placeItems: 'center',
                      padding: 24,
                      textAlign: 'center',
                      background: 'rgba(10, 8, 6, 0.74)',
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ display: 'grid', gap: 8, maxWidth: 280 }}>
                      <strong style={{ color: '#f0d6a4' }}>Assembly preview disabled</strong>
                      <p style={{ margin: 0, color: '#ffb6b6' }}>
                        {invalidBodyInspection.warning || 'Invalid body asset: this looks like a portrait/reference image, not a body sprite.'}
                      </p>
                      <p className="muted" style={{ margin: 0 }}>
                        No valid body sprite selected. Create or link proper body/paperdoll sprite.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
              <section className="card admin-item-preview" style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                <div className="admin-actions-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>Animation Player</strong>
                  <div className="admin-actions-row">
                    <button
                      type="button"
                      onClick={() => setIsPreviewPlaying((current) => !current)}
                      disabled={!previewCanAnimate}
                    >
                      {isPreviewPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPreviewPlaying(false);
                        setPreviewFrameIndex(0);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                  <label>
                    <span>Action</span>
                    <select value={activeAction} onChange={(event) => setActiveAction(event.target.value)}>
                      {SPRITE_ACTION_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Surface</span>
                    <select value={activeSurface} onChange={(event) => setActiveSurface(event.target.value as SpriteSurface)}>
                      {SPRITE_SURFACE_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={isPreviewLooping} onChange={(event) => setIsPreviewLooping(event.target.checked)} />
                    <span>Loop clip</span>
                  </label>
                  <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={showPreviewAnchors} onChange={(event) => setShowPreviewAnchors(event.target.checked)} />
                    <span>Show anchors</span>
                  </label>
                </div>
                <label>
                  <span>Frame scrubber</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, previewFrameCount - 1)}
                    value={Math.min(previewFrameIndex, Math.max(0, previewFrameCount - 1))}
                    onChange={(event) => {
                      setIsPreviewPlaying(false);
                      setPreviewFrameIndex(Number(event.target.value) || 0);
                    }}
                    disabled={!previewCanAnimate}
                  />
                  <div className="muted" style={{ marginTop: 6 }}>
                    Frame {Math.min(previewFrameCount, previewFrameIndex + 1)} / {previewFrameCount}
                    {' · '}fps {previewFps}
                    {' · '}loop {guardedPreview.clip?.loop === false ? 'off' : 'on'}
                  </div>
                </label>
              </section>
            </div>
            <div className="sprite-studio-preview-meta">
              <div className="sprite-studio-metric-strip">
                <div>
                  <span>Active Surface</span>
                  <strong>{activeSurface}</strong>
                </div>
                <div>
                  <span>Active Action</span>
                  <strong>{resolvedPreview.resolvedAction || 'idle'}</strong>
                </div>
                <div>
                  <span>Frame</span>
                  <strong>{Math.min(previewFrameCount, previewFrameIndex + 1)} / {previewFrameCount}</strong>
                </div>
                <div>
                  <span>Body Template</span>
                  <strong>{resolvedPreview.bodyTemplateId || 'none'}</strong>
                </div>
                <div>
                  <span>Z-layers</span>
                  <strong>{resolvedPreview.layers.length}</strong>
                </div>
              </div>
              <div className="sprite-studio-summary-card">
                <p>
                  <strong>Profile:</strong> {selectedProfile?.name || 'none'} ({selectedProfileId || 'none'})
                </p>
                {resolvedPreview.fallback.used && (
                  <p style={{ color: 'var(--sprite-studio-accent)' }}>
                    <em>Using legacy fallback rendering for this entity.</em>
                  </p>
                )}
                {invalidBodyInspection ? (
                  <p style={{ color: '#ffb6b6' }}>
                    <em>Body invalid {'->'} assembly preview disabled. Resolved equipment remains listed below.</em>
                  </p>
                ) : null}
              </div>
              <div className="sprite-studio-debug-details" style={{ marginTop: 12 }}>
                <div className="sprite-studio-eyebrow">Asset Sources / Resolved Layers</div>
                {renderAssetSourcesSection()}
              </div>
            </div>
          </div>
        </div>

        {/* Right column (validation panel) */}
        <div className="sprite-studio-panel sprite-studio-right">
          <div className="sprite-studio-panel-header">
            <h3>Validation & Issues</h3>
          </div>
          <div className="sprite-studio-panel-body sprite-studio-scroll-region">
            {validation && (validation.errors.length > 0 || validation.warnings.length > 0) ? (
              <ul className="sprite-studio-issue-list">
                {validation.errors.map((error, idx) => (
                  <li key={`error-${idx}`} className="severity-error">
                    <strong>[ERROR]</strong>
                    <p>{error}</p>
                  </li>
                ))}
                {validation.warnings.map((warning, idx) => (
                  <li key={`warning-${idx}`} className="severity-warning">
                    <strong>[WARNING]</strong>
                    <p>{warning}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No issues found. Validation clean.</p>
            )}

            <div className="sprite-studio-debug-details" style={{ marginTop: 20 }}>
              <div className="sprite-studio-eyebrow">Debug Data</div>
              <section className="card admin-item-preview">
                <p className="muted" style={{ marginTop: 0, marginBottom: 8 }}>
                  Profile: {selectedProfileId || 'none'}
                </p>
                <div className="admin-form-grid">
                  <label>
                    <span>Surface Select</span>
                    <select value={activeSurface} onChange={(event) => setActiveSurface(event.target.value as SpriteSurface)}>
                      {SPRITE_SURFACE_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Action Select</span>
                    <select value={activeAction} onChange={(event) => setActiveAction(event.target.value)}>
                      {SPRITE_ACTION_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                    </select>
                  </label>
                </div>
              </section>
            </div>

            <div className="sprite-studio-debug-details" style={{ marginTop: 20 }}>
              <div className="sprite-studio-eyebrow">Game Reference Images</div>
              {profileReferenceImages.length ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {profileReferenceImages.map((entry) => renderReferenceCard(entry))}
                </div>
              ) : (
                <p className="muted">Linked NPC has no portrait/avatar/card references.</p>
              )}
              {selectedEquipmentItemReference ? (
                <div style={{ marginTop: 12 }}>
                  {renderReferenceCard(selectedEquipmentItemReference)}
                </div>
              ) : null}
            </div>

            <div className="sprite-studio-debug-details" style={{ marginTop: 20 }}>
              <div className="sprite-studio-eyebrow">Asset Sources</div>
              <section className="card admin-item-preview">
                <p className="muted" style={{ marginTop: 0 }}>
                  Body template: {resolvedPreview.bodyTemplateId || 'none'} · Profile defaults: {selectedProfile?.defaultEquipmentItemIds.join(', ') || 'none'}
                </p>
                <div style={{ display: 'grid', gap: 8 }}>
                  {resolvedPreview.layers.filter((layer) => layer.source !== 'fx').map((layer) => (
                    <div key={layer.id} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(213, 180, 122, 0.14)' }}>
                      <strong>{layer.group}</strong>
                      <p className="muted" style={{ margin: '4px 0 0' }}>
                        source: {layer.source} · binding: {layer.bindingId || 'none'} · item: {layer.itemId || 'none'}
                      </p>
                      <p className="muted" style={{ margin: '4px 0 0', wordBreak: 'break-all' }}>
                        asset: {layer.imageRef?.type === 'image'
                          ? layer.imageRef.src
                          : layer.imageRef?.type === 'tileset'
                            ? `${layer.imageRef.sheetId}#${layer.imageRef.frame}`
                            : layer.imagePath || 'none'}
                      </p>
                      {(() => {
                        const sheetId = layer.imageRef?.type === 'tileset' ? layer.imageRef.sheetId : undefined;
                        const imageSheet = sheetId
                          ? referenceData.imageSheets.find((entry) => entry.id === sheetId)
                          : undefined;
                        const kind = classifySpriteStudioAsset({
                          imageRef: layer.imageRef,
                          legacyImagePath: layer.imagePath,
                          runtimeImages: referenceData.images,
                          imageSheet,
                          label: `${layer.group} ${layer.bindingId || layer.id}`,
                        });
                        const eligibility = isBodyLikeLayerGroup(layer.group)
                          ? getBodyLayerEligibility(kind)
                          : getEquipmentOverlayEligibility(kind);
                        const warning = buildSpriteStudioSelectionWarning(kind)
                          ?? (eligibility === 'warning' && isBodyLikeLayerGroup(layer.group)
                            ? 'Body template uses an image that looks like a portrait/reference image. It may not be a valid body/paperdoll sprite.'
                            : null);
                        return (
                          <>
                            <p className="muted" style={{ margin: '4px 0 0' }}>
                              kind: {describeSpriteStudioAssetKind(kind)} · eligibility: {describeAssetEligibility(eligibility)}
                            </p>
                            {warning ? <p style={{ margin: '4px 0 0', color: '#ffb6b6' }}>{warning}</p> : null}
                          </>
                        );
                      })()}
                    </div>
                  ))}
                  {resolvedPreview.layers.filter((layer) => layer.source !== 'fx').length === 0 ? (
                    <p className="muted">No drawable body/equipment layers resolved.</p>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Deck Panel */}
      <div className={`sprite-studio-panel sprite-studio-bottom-deck ${isBottomCollapsed ? 'is-collapsed' : ''}`}>
        <div className="sprite-studio-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h3 style={{ margin: 0 }}>Bottom Deck</h3>
            <div className="sprite-studio-toolbar">
              <button
                type="button"
                className={bottomTab === 'spritesheet' ? 'is-active' : ''}
                onClick={() => { setBottomTab('spritesheet'); setIsBottomCollapsed(false); }}
              >
                🎬 Spritesheet
              </button>
              <button
                type="button"
                className={bottomTab === 'import' ? 'is-active' : ''}
                onClick={() => { setBottomTab('import'); setIsBottomCollapsed(false); }}
              >
                📥 Import
              </button>
              <button
                type="button"
                className={bottomTab === 'export' ? 'is-active' : ''}
                onClick={() => { setBottomTab('export'); setIsBottomCollapsed(false); }}
              >
                📤 Export
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="sprite-studio-refresh-button"
              onClick={() => setIsBottomCollapsed(!isBottomCollapsed)}
            >
              {isBottomCollapsed ? 'Expand Deck' : 'Collapse Deck'}
            </button>
          </div>
        </div>
        {!isBottomCollapsed && (
          <div className="sprite-studio-panel-body sprite-studio-scroll-region">
            {bottomTab === 'spritesheet' ? renderSpritesheetTab() : null}
            {bottomTab === 'import' ? renderImportTab() : null}
            {bottomTab === 'export' ? renderExportTab() : null}
          </div>
        )}
      </div>

      {/* Bottom panel with engine controls */}
      <div className="sprite-studio-panel sprite-studio-panel-compact sprite-studio-bottom" style={{ gridColumn: '1 / -1' }}>
        <div className="sprite-studio-panel-header">
          <h3>Quick Engine Playground Tools</h3>
        </div>
        <div className="sprite-studio-panel-body">
          <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label>
              <span>Preview skill binding</span>
              <select value={selectedPreviewSkillBindingId} onChange={(event) => setSelectedPreviewSkillBindingId(event.target.value)}>
                <option value="">Auto from profile</option>
                {draft.skillBindings.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.skillId})</option>
                ))}
              </select>
            </label>
            <label>
              <span>Preview FX</span>
              <select value={selectedPreviewFxId} onChange={(event) => setSelectedPreviewFxId(event.target.value)}>
                <option value="">Auto from profile</option>
                {referenceData.visualFx.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

    </div>
  );
}
