import { Race, RACE_DEFINITIONS, type EquipmentVisualBindingDefinition, type RuntimeAssemblyRuleDefinition, type SkillAnimationBindingDefinition, type SpriteAnchorKey, type SpriteAnimationClipDefinition, type SpriteAnimationSetDefinition, type SpriteBodyTemplateDefinition, type SpriteImageRef, type SpriteProfileDefinition, type SpriteSurface } from '@theend/rpg-domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createEmptyAnimationClip,
  createEmptyAnimationSet,
  createEmptyBodyTemplate,
  createEmptyEquipmentBinding,
  createEmptyRuntimeAssemblyRule,
  createEmptySkillAnimationBinding,
  createEmptySpriteProfile,
  drawSpriteStudioPreview,
  listProfileBindings,
  SPRITE_ACTION_OPTIONS,
  SPRITE_ANCHOR_KEYS,
  SPRITE_BODY_TYPE_OPTIONS,
  SPRITE_SURFACE_OPTIONS,
  WEAPON_GRIP_OPTIONS,
} from '../../sprite-studio-core';
import { downloadCollectionJson, extractRawCollectionFromImportJson, formatExportStamp, type JsonImportMode } from '../../services/content/adminJsonImportExport';
import type { AdminItem, AdminNpc, AdminSkill, AdminVisualFx } from '../../services/content/models';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import { ImageSheetPicker } from '../components/ImageSheetPicker';
import { SpriteStudioBindingsPanel } from './SpriteStudioBindingsPanel';
import { SpriteStudioExportPanel } from './SpriteStudioExportPanel';
import { SpriteStudioTabs } from './SpriteStudioTabs';
import type { SpriteStudioDraftState, SpriteStudioReferenceData, SpriteStudioTab } from './types';

interface SpriteStudioWorkspaceProps {
  draft: SpriteStudioDraftState;
  setDraft: React.Dispatch<React.SetStateAction<SpriteStudioDraftState>>;
  referenceData: SpriteStudioReferenceData;
  onStatus: (message: string) => void;
  onRefreshAssets: () => Promise<void>;
}

type DraftCollectionKey =
  | 'bodyTemplates'
  | 'animationSets'
  | 'equipmentBindings'
  | 'spriteProfiles'
  | 'skillBindings'
  | 'runtimeRules';

type DraftCollectionEntry<K extends DraftCollectionKey> = SpriteStudioDraftState[K] extends Array<infer T> ? T : never;

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
  paperdoll?: { imageRef?: SpriteImageRef; imagePath?: string; scale?: number; offsetX?: number; offsetY?: number };
  world?: { imageRef?: SpriteImageRef; imagePath?: string; scale?: number; offsetX?: number; offsetY?: number };
  battle?: { imageRef?: SpriteImageRef; imagePath?: string; scale?: number; offsetX?: number; offsetY?: number };
}>(entry: T, surface: SpriteSurface) {
  if (surface === 'paperdoll') {
    return entry.paperdoll;
  }
  if (surface === 'world') {
    return entry.world;
  }
  return entry.battle;
}

export function SpriteStudioWorkspace({
  draft,
  setDraft,
  referenceData,
  onStatus,
  onRefreshAssets,
}: SpriteStudioWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<SpriteStudioTab>('control');
  const [importMode, setImportMode] = useState<JsonImportMode>('merge');
  const [selectedBodyTemplateId, setSelectedBodyTemplateId] = useState('');
  const [selectedAnimationSetId, setSelectedAnimationSetId] = useState('');
  const [selectedEquipmentBindingId, setSelectedEquipmentBindingId] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedSkillBindingId, setSelectedSkillBindingId] = useState('');
  const [selectedRuntimeRuleId, setSelectedRuntimeRuleId] = useState('');
  const [activeSurface, setActiveSurface] = useState<SpriteSurface>('battle');
  const [activeAction, setActiveAction] = useState<string>('idle');
  const [selectedPreviewSkillBindingId, setSelectedPreviewSkillBindingId] = useState('');
  const [selectedPreviewFxId, setSelectedPreviewFxId] = useState('');
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setSelectedBodyTemplateId((current) => ensureSelection(current, draft.bodyTemplates));
    setSelectedAnimationSetId((current) => ensureSelection(current, draft.animationSets));
    setSelectedEquipmentBindingId((current) => ensureSelection(current, draft.equipmentBindings));
    setSelectedProfileId((current) => ensureSelection(current, draft.spriteProfiles));
    setSelectedSkillBindingId((current) => ensureSelection(current, draft.skillBindings));
    setSelectedRuntimeRuleId((current) => ensureSelection(current, draft.runtimeRules));
  }, [draft.animationSets, draft.bodyTemplates, draft.equipmentBindings, draft.runtimeRules, draft.skillBindings, draft.spriteProfiles]);

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
  const selectedEquipmentBinding = useMemo(
    () => draft.equipmentBindings.find((entry) => entry.id === selectedEquipmentBindingId) ?? null,
    [draft.equipmentBindings, selectedEquipmentBindingId],
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

  useEffect(() => {
    const canvases = [previewCanvasRef.current, exportCanvasRef.current].filter((entry): entry is HTMLCanvasElement => Boolean(entry));
    if (canvases.length === 0) {
      return;
    }
    void Promise.all(canvases.map((canvas) => drawSpriteStudioPreview({
      canvas,
      profile: selectedProfile,
      bodyTemplate: previewBodyTemplate,
      animationSet: previewAnimationSet,
      equipmentBindings: resolvedProfileBindings,
      skillBinding: previewSkillBinding,
      visualFx: previewFx,
      surface: activeSurface,
      runtimeImages: referenceData.images,
      imageSheets: referenceData.imageSheets,
      selectedAction: activeAction,
    })));
  }, [activeAction, activeSurface, previewAnimationSet, previewBodyTemplate, previewFx, previewSkillBinding, referenceData.imageSheets, referenceData.images, resolvedProfileBindings, selectedProfile]);

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

  function renderSurfaceAssetEditor(params: {
    title: string;
    asset: { imageRef?: SpriteImageRef; imagePath?: string; scale?: number; offsetX?: number; offsetY?: number } | undefined;
    uploadSuggestedId: string;
    uploadSuggestedName: string;
    uploadFolder: string | undefined;
    onPatch: (next: { imageRef?: SpriteImageRef; imagePath?: string; scale?: number; offsetX?: number; offsetY?: number }) => void;
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
          onStatus={onStatus}
          onChange={(next) => params.onPatch({
            ...params.asset,
            imageRef: cloneSpriteImageRef(next as SpriteImageRef | undefined),
            imagePath: next?.type === 'image' ? next.src : params.asset?.imagePath,
          })}
        />
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
        </div>
      </section>
    );
  }

  function renderControlTab() {
    return (
      <div className="admin-editor-page" style={{ display: 'grid', gap: 16 }}>
        <section className="admin-form-panel">
          <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0 }}>Sprite Body Templates</h4>
            <div className="admin-actions-row">
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
                onStatus={onStatus}
                onChange={(next) => patchClip(index, (current) => ({
                  ...current,
                  imageRef: cloneSpriteImageRef(next as SpriteImageRef | undefined),
                  imagePath: next?.type === 'image' ? next.src : current.imagePath,
                }))}
              />
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
          </div>
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
          <h4>Default binding helper</h4>
          <p className="muted">
            Item остаётся канонической сущностью игры. Binding хранит `itemId`, а у item есть только soft default:
            `defaultEquipmentVisualBindingId`.
          </p>
          <label>
            <span>Preview current item defaults</span>
            <select
              value={selectedEquipmentBinding?.itemId ?? ''}
              onChange={(event) => {
                const candidate = draft.equipmentBindings.find((entry) => entry.itemId === event.target.value);
                if (candidate) {
                  setSelectedEquipmentBindingId(candidate.id);
                }
              }}
            >
              <option value="">Select item</option>
              {draft.items.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({entry.defaultEquipmentVisualBindingId || 'no default'})
                </option>
              ))}
            </select>
          </label>
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
        </section>

        <section className="card admin-item-preview" style={{ display: 'grid', gap: 16 }}>
          <canvas
            ref={previewCanvasRef}
            width={256}
            height={256}
            style={{ width: 256, height: 256, border: '1px solid rgba(215, 178, 103, 0.25)', borderRadius: 12, background: 'rgba(0, 0, 0, 0.3)' }}
          />
          <div>
            <p><strong>Profile:</strong> {selectedProfile?.name || 'none'}</p>
            <p><strong>Body template:</strong> {previewBodyTemplate?.name || 'none'}</p>
            <p><strong>Animation set:</strong> {previewAnimationSet?.name || 'none'}</p>
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
    <div className="sprite-studio-page">
      <canvas ref={exportCanvasRef} width={256} height={256} style={{ display: 'none' }} />
      <SpriteStudioTabs activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === 'control' ? renderControlTab() : null}
      {activeTab === 'playground' ? renderPlaygroundTab() : null}
      {activeTab === 'spritesheet' ? renderSpritesheetTab() : null}
      {activeTab === 'import' ? renderImportTab() : null}
      {activeTab === 'itemForge' ? renderItemForgeTab() : null}
      {activeTab === 'bindings' ? renderBindingsTab() : null}
      {activeTab === 'export' ? renderExportTab() : null}
    </div>
  );
}
