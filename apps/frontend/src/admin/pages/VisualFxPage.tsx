import type { VisualFxDefinition, VisualFxPlayOn } from '@theend/rpg-domain';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { imageService } from '../../services/content/imageService';
import { audioService } from '../../services/content/audioService';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import {
  emptyVisualFx,
  emptyVisualFxStage,
  normalizeVisualFx,
  visualFxService,
  VISUAL_FX_CATEGORIES,
  VISUAL_FX_ELEMENTS,
  VISUAL_FX_KINDS,
  VISUAL_FX_PLACEMENT_MODES,
  VISUAL_FX_STAGE_CONDITIONS,
  VISUAL_FX_STAGE_FOLLOW_MODES,
  VISUAL_FX_STAGE_MOVEMENT_BEHAVIORS,
  VISUAL_FX_STAGE_PLAY_ON,
  VISUAL_FX_STAGE_TARGET_MODES,
  VISUAL_FX_STAGE_TRIGGERS,
  VISUAL_FX_STAGE_TYPES,
} from '../../services/content/visualFxService';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { AdminFieldLabel, translateAdminErrorMessage } from '../adminUi';
import type { AdminSaveViewModel } from '../adminSaveTools';
import { FxBattlePreview } from '../visual-fx/FxBattlePreview';

const PLAY_ON: VisualFxPlayOn[] = ['caster', 'target', 'projectile', 'area', 'screen'];
const ANCHORS: NonNullable<VisualFxDefinition['placement']['anchor']>[] = ['center', 'feet', 'head', 'front', 'behind', 'weapon_right', 'weapon_left', 'ground'];
const BLEND_MODES: NonNullable<VisualFxDefinition['render']['blendMode']>[] = ['NORMAL', 'ADD', 'MULTIPLY', 'SCREEN'];

function asTags(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function formatTags(value: string[] | undefined): string {
  return (value ?? []).join(', ');
}

function createFireCircleDraft(): VisualFxDefinition {
  return normalizeVisualFx({
    id: 'fx_fire_circle',
    name: 'Fire Circle',
    status: 'draft',
    category: 'area',
    element: 'fire',
    type: 'sprite_sheet',
    asset: {
      url: '',
      key: 'fx_fire_circle',
      frameWidth: 512,
      frameHeight: 512,
      frameCount: 6,
    },
    animation: {
      frameRate: 16,
      repeat: 0,
      durationMs: 700,
    },
    placement: {
      defaultPlayOn: 'caster',
      mode: 'ground_persist',
      anchor: 'feet',
      offsetX: 0,
      offsetY: 12,
      rotateToDirection: false,
      lingerDurationMs: 900,
    },
    render: {
      scale: 1.4,
      alpha: 1,
      blendMode: 'ADD',
      originX: 0.5,
      originY: 0.5,
      depth: 5000,
    },
    camera: {
      shakePreset: 'medium',
    },
    tags: ['fire', 'circle', 'aoe'],
  });
}

function validateVisualFxDraft(draft: VisualFxDefinition, library: VisualFxDefinition[]): string[] {
  if (draft.kind !== 'composite') {
    return [];
  }
  const errors: string[] = [];
  const stages = draft.stages ?? [];
  const stageIds = new Set(stages.map((stage) => stage.id.trim()).filter(Boolean));
  const singleFxIds = new Set(
    library
      .filter((entry) => entry.kind !== 'composite')
      .map((entry) => entry.id),
  );

  if (stages.length === 0) {
    errors.push('Composite FX must contain at least one stage.');
  }

  for (const stage of stages) {
    if (!stage.id.trim()) {
      errors.push('Every stage must have an id.');
    }
    const needsFxRef = stage.stageType === 'cast'
      || stage.stageType === 'projectile'
      || stage.stageType === 'impact'
      || stage.stageType === 'linger';
    const hasAnyFx = Boolean(stage.fxRefId?.trim()) || (stage.fxVariantIds?.length ?? 0) > 0;
    if (needsFxRef && !hasAnyFx) {
      errors.push(`Stage '${stage.id}' requires an FX ref or variant FX refs.`);
    }
    if (stage.stageType === 'linger' && !(stage.persistMs && stage.persistMs > 0)) {
      errors.push(`Stage '${stage.id}' is linger and needs persistMs > 0.`);
    }
    if ((stage.stageType === 'projectile' || stage.stageType === 'movement') && !stage.movementBehavior) {
      errors.push(`Stage '${stage.id}' needs movementBehavior.`);
    }
    if (stage.fxRefId && !singleFxIds.has(stage.fxRefId)) {
      errors.push(`Stage '${stage.id}' references missing single FX '${stage.fxRefId}'.`);
    }
    for (const variantId of stage.fxVariantIds ?? []) {
      if (!singleFxIds.has(variantId)) {
        errors.push(`Stage '${stage.id}' references missing variant FX '${variantId}'.`);
      }
    }
    for (const branchId of stage.branchToStageIds ?? []) {
      if (!stageIds.has(branchId)) {
        errors.push(`Stage '${stage.id}' branches to missing stage '${branchId}'.`);
      }
      if (branchId === stage.id) {
        errors.push(`Stage '${stage.id}' cannot branch directly to itself.`);
      }
    }
  }

  return errors;
}

export function VisualFxPage() {
  const [entries, setEntries] = useState<VisualFxDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VisualFxDefinition>(() => createFireCircleDraft());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>(() => ({ state: 'idle', message: '' }));
  const [isSaving, setSaving] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [isAudioUploading, setAudioUploading] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [dragStageId, setDragStageId] = useState<string | null>(null);

  async function reload(nextSelectedId = selectedId) {
    try {
      const next = await visualFxService.getAll();
      setEntries(next);
      if (nextSelectedId) {
        const found = next.find((entry) => entry.id === nextSelectedId);
        if (found) {
          setSelectedId(found.id);
          setDraft(found);
          return;
        }
      }
      if (next.length > 0) {
        setSelectedId(next[0]!.id);
        setDraft(next[0]!);
      }
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return entries;
    }
    return entries.filter((entry) => {
      const haystack = [
        entry.id,
        entry.name,
        entry.category,
        entry.element,
        ...(entry.tags ?? []),
      ].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [entries, query]);

  function patch(nextPatch: Partial<VisualFxDefinition>) {
    setDraft((current) => normalizeVisualFx({ ...current, ...nextPatch, id: nextPatch.id ?? current.id }));
  }

  function patchAsset(nextPatch: Partial<VisualFxDefinition['asset']>) {
    setDraft((current) => normalizeVisualFx({ ...current, asset: { ...current.asset, ...nextPatch } }));
  }

  function patchAnimation(nextPatch: Partial<VisualFxDefinition['animation']>) {
    setDraft((current) => normalizeVisualFx({ ...current, animation: { ...current.animation, ...nextPatch } }));
  }

  function patchPlacement(nextPatch: Partial<VisualFxDefinition['placement']>) {
    setDraft((current) => normalizeVisualFx({ ...current, placement: { ...current.placement, ...nextPatch } }));
  }

  function patchRender(nextPatch: Partial<VisualFxDefinition['render']>) {
    setDraft((current) => normalizeVisualFx({ ...current, render: { ...current.render, ...nextPatch } }));
  }

  function patchProjectile(nextPatch: Partial<NonNullable<VisualFxDefinition['projectile']>>) {
    setDraft((current) => normalizeVisualFx({ ...current, projectile: { ...(current.projectile ?? {}), ...nextPatch } }));
  }

  function patchCamera(nextPatch: Partial<NonNullable<VisualFxDefinition['camera']>>) {
    setDraft((current) => normalizeVisualFx({ ...current, camera: { ...(current.camera ?? {}), ...nextPatch } }));
  }

  function patchAudio(nextPatch: Partial<NonNullable<VisualFxDefinition['audio']>>) {
    setDraft((current) => normalizeVisualFx({ ...current, audio: { ...(current.audio ?? {}), ...nextPatch } }));
  }

  function patchStage(stageId: string, nextPatch: Partial<NonNullable<VisualFxDefinition['stages']>[number]>) {
    setDraft((current) => normalizeVisualFx({
      ...current,
      stages: (current.stages ?? []).map((stage) => (stage.id === stageId ? { ...stage, ...nextPatch } : stage)),
    }));
  }

  function addStage() {
    setDraft((current) => {
      const nextStage = emptyVisualFxStage((current.stages ?? []).length);
      setSelectedStageId(nextStage.id);
      return normalizeVisualFx({
        ...current,
        kind: 'composite',
        stages: [...(current.stages ?? []), nextStage],
      });
    });
  }

  function duplicateStage(stageId: string) {
    setDraft((current) => {
      const stages = [...(current.stages ?? [])];
      const index = stages.findIndex((stage) => stage.id === stageId);
      if (index < 0) {
        return current;
      }
      const source = stages[index]!;
      const copy = {
        ...source,
        id: `${source.id}_copy`,
        name: source.name ? `${source.name} Copy` : undefined,
      };
      stages.splice(index + 1, 0, copy);
      setSelectedStageId(copy.id);
      return normalizeVisualFx({ ...current, stages });
    });
  }

  function removeStage(stageId: string) {
    setDraft((current) => normalizeVisualFx({
      ...current,
      stages: (current.stages ?? []).filter((stage) => stage.id !== stageId),
    }));
    setSelectedStageId((current) => (current === stageId ? null : current));
  }

  function moveStage(stageId: string, direction: -1 | 1) {
    setDraft((current) => {
      const stages = [...(current.stages ?? [])];
      const index = stages.findIndex((stage) => stage.id === stageId);
      if (index < 0) {
        return current;
      }
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= stages.length) {
        return current;
      }
      const [stage] = stages.splice(index, 1);
      stages.splice(nextIndex, 0, stage!);
      return normalizeVisualFx({ ...current, stages });
    });
  }

  function reorderStage(fromId: string, toId: string) {
    if (!fromId || !toId || fromId === toId) {
      return;
    }
    setDraft((current) => {
      const stages = [...(current.stages ?? [])];
      const fromIndex = stages.findIndex((stage) => stage.id === fromId);
      const toIndex = stages.findIndex((stage) => stage.id === toId);
      if (fromIndex < 0 || toIndex < 0) {
        return current;
      }
      const [stage] = stages.splice(fromIndex, 1);
      stages.splice(toIndex, 0, stage!);
      return normalizeVisualFx({ ...current, stages });
    });
  }

  function selectEntry(entry: VisualFxDefinition) {
    setSelectedId(entry.id);
    setDraft(entry);
    setSelectedStageId(entry.stages?.[0]?.id ?? null);
    setStatus('');
  }

  function newEntry(template: 'blank' | 'fire' = 'blank') {
    setSelectedId(null);
    setDraft(template === 'fire' ? createFireCircleDraft() : emptyVisualFx());
    setSelectedStageId(null);
    setStatus('New Visual FX draft.');
  }

  async function save() {
    setSaving(true);
    setSaveState({ state: 'saving', message: 'Saving...' });
    try {
      const normalized = normalizeVisualFx(draft);
      const validationErrors = validateVisualFxDraft(normalized, entries.some((entry) => entry.id === normalized.id) ? entries : [...entries, normalized]);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors[0]!);
      }
      const saved = selectedId
        ? selectedId === normalized.id
          ? await visualFxService.update(selectedId, normalized)
          : await visualFxService.rename(selectedId, normalized.id, normalized)
        : await visualFxService.create(normalized);
      setSelectedId(saved.id);
      setDraft(saved);
      setSaveState({ state: 'saved', message: `Saved Visual FX: ${saved.id}` });
      setStatus(`Saved Visual FX: ${saved.id}`);
      await reload(saved.id);
    } catch (error) {
      const message = translateAdminErrorMessage((error as Error).message);
      setSaveState({ state: 'error', message });
      setStatus(message);
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    const copy = normalizeVisualFx({
      ...draft,
      id: `${draft.id || 'fx'}_copy`,
      name: `${draft.name || draft.id || 'FX'} Copy`,
      status: 'draft',
    });
    setSelectedId(null);
    setDraft(copy);
    setStatus('Duplicated into a new draft.');
  }

  async function remove() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm(`Delete Visual FX '${selectedId}'?`)) {
      return;
    }
    try {
      await visualFxService.delete(selectedId);
      setSelectedId(null);
      setDraft(emptyVisualFx());
      await reload(null);
      setStatus(`Deleted Visual FX: ${selectedId}`);
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function uploadAsset(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const uploaded = await imageService.upload(file, {
        id: draft.id ? `${draft.id}_sprite` : undefined,
        name: `${draft.id || 'fx'}-sprite`,
        folder: buildUploadFolder('images', 'fx', draft.category, draft.element || undefined, draft.id || undefined),
      });
      const frameHeight = uploaded.height || draft.asset.frameHeight || 256;
      const frameCount = Math.max(1, Math.round((uploaded.width || frameHeight) / Math.max(1, frameHeight)));
      patchAsset({
        url: uploaded.dataUrl || `/api/content/images/${encodeURIComponent(uploaded.id)}/raw`,
        key: draft.asset.key || draft.id || uploaded.id,
        frameWidth: draft.asset.frameWidth || Math.max(1, Math.floor((uploaded.width || frameHeight) / frameCount)),
        frameHeight: draft.asset.frameHeight || frameHeight,
        frameCount: draft.asset.frameCount && draft.asset.frameCount > 1 ? draft.asset.frameCount : frameCount,
      });
      setStatus(`Uploaded image ${uploaded.name} (${uploaded.width}x${uploaded.height}).`);
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    } finally {
      setUploading(false);
    }
  }

  async function uploadAudioAsset(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setAudioUploading(true);
    try {
      const uploaded = await audioService.upload(file, {
        id: draft.id ? `${draft.id}_sound` : undefined,
        name: `${draft.id || 'fx'}-sound`,
        folder: buildUploadFolder('audio', 'fx', draft.category, draft.element || undefined, draft.id || undefined),
      });
      patchAudio({ defaultSoundId: uploaded.publicUrl });
      setStatus(`Uploaded audio ${uploaded.assetId} (${uploaded.mimeType}).`);
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    } finally {
      setAudioUploading(false);
    }
  }

  return (
    <div className="visual-fx-page admin-page-grid">
      <section className="admin-form-panel">
        <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2>Visual FX Registry</h2>
            <p className="muted">Reusable combat animations for skills, weapons, items and statuses.</p>
          </div>
          <div className="admin-actions-row">
            <button type="button" onClick={() => newEntry('blank')}>New FX</button>
            <button type="button" onClick={() => newEntry('fire')}>Fire Circle Template</button>
          </div>
        </div>

        <div className="admin-tabbar">
          <button type="button" className="is-active">Editor</button>
        </div>

        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Stable id referenced by skill.visualEffectId, projectileEffectId, impactEffectId and item visuals." />
            <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} placeholder="fx_fire_circle" />
          </label>
          <label>
            <AdminFieldLabel label="Name" hint="Admin-facing readable name." />
            <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Fire Circle" />
          </label>
          <label>
            <AdminFieldLabel label="Status" hint="Only disabled FX are ignored by Phaser runtime." />
            <select value={draft.status} onChange={(event) => patch({ status: event.target.value as VisualFxDefinition['status'] })}>
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Category" hint="Semantic slot: cast, projectile, impact, hit, area, aura and so on." />
            <select value={draft.category} onChange={(event) => patch({ category: event.target.value as VisualFxDefinition['category'] })}>
              {VISUAL_FX_CATEGORIES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Element" hint="Optional grouping for filtering and future defaults." />
            <select value={draft.element ?? ''} onChange={(event) => patch({ element: event.target.value ? event.target.value as VisualFxDefinition['element'] : undefined })}>
              <option value="">none</option>
              {VISUAL_FX_ELEMENTS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Type" hint="MVP supports static images and horizontal sprite sheets." />
            <select value={draft.type} onChange={(event) => patch({ type: event.target.value as VisualFxDefinition['type'] })}>
              <option value="sprite_sheet">sprite_sheet</option>
              <option value="static_image">static_image</option>
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Effect kind" hint="single = one FX as before. composite = full sequence with stages, branching, parallel groups and movement." />
            <select value={draft.kind ?? 'single'} onChange={(event) => patch({ kind: event.target.value as NonNullable<VisualFxDefinition['kind']> })}>
              {VISUAL_FX_KINDS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
        </div>

        <label className="admin-form-grid full-width">
          <AdminFieldLabel label="Description" hint="Internal note for designers/admins." />
          <textarea rows={2} value={draft.description ?? ''} onChange={(event) => patch({ description: event.target.value || undefined })} />
        </label>

        {draft.kind === 'composite' ? (
          <section className="card visual-fx-section">
            <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h3>Sequence Stages</h3>
                <p className="muted">Build a full combat script here: cast, projectile, impact, linger, sounds, camera, dash, teleports, branches and parallel groups.</p>
              </div>
              <button type="button" onClick={addStage}>Add Stage</button>
            </div>
            <div className="visual-fx-list" style={{ display: 'grid', gap: 12 }}>
              {(draft.stages ?? []).map((stage, index) => (
                <section
                  key={stage.id}
                  className={`card ${selectedStageId === stage.id ? 'is-active' : ''}`}
                  draggable
                  onDragStart={() => setDragStageId(stage.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragStageId) {
                      reorderStage(dragStageId, stage.id);
                      setDragStageId(null);
                    }
                  }}
                  style={{ padding: 12, border: selectedStageId === stage.id ? '1px solid rgba(243, 204, 120, 0.95)' : undefined }}
                >
                  <div className="admin-actions-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <button type="button" onClick={() => setSelectedStageId(stage.id)} style={{ fontWeight: 700 }}>
                      {index + 1}. {stage.name || stage.id}
                    </button>
                    <div className="admin-actions-row">
                      <button type="button" onClick={() => moveStage(stage.id, -1)}>Up</button>
                      <button type="button" onClick={() => moveStage(stage.id, 1)}>Down</button>
                      <button type="button" onClick={() => duplicateStage(stage.id)}>Duplicate</button>
                      <button type="button" onClick={() => removeStage(stage.id)}>Remove</button>
                    </div>
                  </div>
                  <div className="admin-form-grid" style={{ marginTop: 12 }}>
                    <label>
                      <AdminFieldLabel label="Stage ID" hint="Stable stage identifier used for branching and preview." />
                      <input value={stage.id} onChange={(event) => patchStage(stage.id, { id: event.target.value })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Name" hint="Readable label for the timeline/editor." />
                      <input value={stage.name ?? ''} onChange={(event) => patchStage(stage.id, { name: event.target.value || undefined })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Stage type" hint="Gameplay-neutral phase type understood by the runtime." />
                      <select value={stage.stageType} onChange={(event) => patchStage(stage.id, { stageType: event.target.value as typeof stage.stageType })}>
                        {VISUAL_FX_STAGE_TYPES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                      </select>
                    </label>
                    <label className="zone-editor-checkbox">
                      <input type="checkbox" checked={stage.enabled !== false} onChange={(event) => patchStage(stage.id, { enabled: event.target.checked })} />
                      <AdminFieldLabel label="Enabled" hint="Disabled stages stay in the timeline but do not execute." />
                    </label>
                    <label>
                      <AdminFieldLabel label="Trigger" hint="When this stage starts: immediately, after previous, after delay, on hit, or after previous complete." />
                      <select value={stage.trigger} onChange={(event) => patchStage(stage.id, { trigger: event.target.value as typeof stage.trigger })}>
                        {VISUAL_FX_STAGE_TRIGGERS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                      </select>
                    </label>
                    <label>
                      <AdminFieldLabel label="Delay ms" hint="Extra wait before this stage starts." />
                      <input type="number" min={0} value={stage.delayMs ?? 0} onChange={(event) => patchStage(stage.id, { delayMs: Number(event.target.value) || 0 })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="FX ref ID" hint="Usually points to a saved single FX. Movement/sound/camera stages may work without it." />
                      <input value={stage.fxRefId ?? ''} onChange={(event) => patchStage(stage.id, { fxRefId: event.target.value || undefined })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Variant FX refs" hint="Comma-separated alternatives. Enable randomize to pick one variant each run." />
                      <input value={(stage.fxVariantIds ?? []).join(', ')} onChange={(event) => patchStage(stage.id, { fxVariantIds: asTags(event.target.value) })} />
                    </label>
                    <label className="zone-editor-checkbox">
                      <input type="checkbox" checked={stage.randomizeFxVariant === true} onChange={(event) => patchStage(stage.id, { randomizeFxVariant: event.target.checked })} />
                      <AdminFieldLabel label="Randomize variants" hint="Choose a random variant FX when the stage runs." />
                    </label>
                    <label>
                      <AdminFieldLabel label="Play on" hint="Where this stage anchors visually." />
                      <select value={stage.playOn ?? 'target'} onChange={(event) => patchStage(stage.id, { playOn: event.target.value as typeof stage.playOn })}>
                        {VISUAL_FX_STAGE_PLAY_ON.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                      </select>
                    </label>
                    <label>
                      <AdminFieldLabel label="Follow mode" hint="What the stage should stay attached to while it persists." />
                      <select value={stage.followMode ?? 'none'} onChange={(event) => patchStage(stage.id, { followMode: event.target.value as typeof stage.followMode })}>
                        {VISUAL_FX_STAGE_FOLLOW_MODES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                      </select>
                    </label>
                    <label>
                      <AdminFieldLabel label="Movement behavior" hint="Projectile paths, dashes and teleports can be driven directly from the stage." />
                      <select value={stage.movementBehavior ?? 'none'} onChange={(event) => patchStage(stage.id, { movementBehavior: event.target.value as typeof stage.movementBehavior })}>
                        {VISUAL_FX_STAGE_MOVEMENT_BEHAVIORS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                      </select>
                    </label>
                    <label>
                      <AdminFieldLabel label="Condition" hint="Optional runtime gate: always, only on hit, only on crit, or only on miss." />
                      <select value={stage.condition ?? 'always'} onChange={(event) => patchStage(stage.id, { condition: event.target.value as typeof stage.condition })}>
                        {VISUAL_FX_STAGE_CONDITIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                      </select>
                    </label>
                    <label>
                      <AdminFieldLabel label="Target mode" hint="Primary target, all targets, AoE targets, or chained targets for lightning/beam style stages." />
                      <select value={stage.targetMode ?? 'primary_target'} onChange={(event) => patchStage(stage.id, { targetMode: event.target.value as typeof stage.targetMode })}>
                        {VISUAL_FX_STAGE_TARGET_MODES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                      </select>
                    </label>
                    <label>
                      <AdminFieldLabel label="Parallel group" hint="Stages with the same non-empty parallel group can run together." />
                      <input value={stage.parallelGroup ?? ''} onChange={(event) => patchStage(stage.id, { parallelGroup: event.target.value || undefined })} placeholder="impact_bundle_a" />
                    </label>
                    <label>
                      <AdminFieldLabel label="Branch to stages" hint="Comma-separated stage ids to jump to after this stage. Useful for branching and custom follow-ups." />
                      <input value={(stage.branchToStageIds ?? []).join(', ')} onChange={(event) => patchStage(stage.id, { branchToStageIds: asTags(event.target.value) })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Duration ms" hint="Optional stage-level duration override." />
                      <input type="number" min={0} value={stage.durationMs ?? 0} onChange={(event) => patchStage(stage.id, { durationMs: Number(event.target.value) || 0 })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Persist ms" hint="How long lingering and attached stages stay alive." />
                      <input type="number" min={0} value={stage.persistMs ?? 0} onChange={(event) => patchStage(stage.id, { persistMs: Number(event.target.value) || 0 })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Audio refs" hint="Comma-separated layered audio sources or ids. All of them can fire together." />
                      <input value={(stage.audioRefIds ?? []).join(', ')} onChange={(event) => patchStage(stage.id, { audioRefIds: asTags(event.target.value) })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="Camera shake" hint="Optional stage-local shake preset." />
                      <select value={stage.cameraShakePreset ?? 'none'} onChange={(event) => patchStage(stage.id, { cameraShakePreset: event.target.value as typeof stage.cameraShakePreset })}>
                        <option value="none">none</option>
                        <option value="small">small</option>
                        <option value="medium">medium</option>
                        <option value="heavy">heavy</option>
                      </select>
                    </label>
                    <label className="zone-editor-checkbox">
                      <input type="checkbox" checked={stage.stopSequenceOnFailure === true} onChange={(event) => patchStage(stage.id, { stopSequenceOnFailure: event.target.checked })} />
                      <AdminFieldLabel label="Stop on failure" hint="If the stage cannot execute, stop the rest of the sequence." />
                    </label>
                    <label className="zone-editor-checkbox">
                      <input type="checkbox" checked={stage.chainFromPrevious === true} onChange={(event) => patchStage(stage.id, { chainFromPrevious: event.target.checked })} />
                      <AdminFieldLabel label="Chain from previous" hint="Useful for chain lightning / beam hops; the next target starts from the previous resolved impact point." />
                    </label>
                    <label>
                      <AdminFieldLabel label="Max chain targets" hint="Maximum number of extra targets used by chain target mode." />
                      <input type="number" min={1} value={stage.maxChainTargets ?? 3} onChange={(event) => patchStage(stage.id, { maxChainTargets: Number(event.target.value) || 1 })} />
                    </label>
                  </div>
                </section>
              ))}
              {(draft.stages ?? []).length === 0 ? <p className="muted">No stages yet. Add a stage to begin building a composite FX.</p> : null}
            </div>
          </section>
        ) : null}

        {draft.kind !== 'composite' ? (
        <section className="card visual-fx-section">
          <h3>Asset</h3>
          <div className="admin-form-grid">
            <label>
              <AdminFieldLabel label="Asset URL" hint="Can be a public path, uploaded content raw URL, or external URL." />
              <input value={draft.asset.url} onChange={(event) => patchAsset({ url: event.target.value })} placeholder="/assets/fx/fire/fire_circle.png" />
            </label>
            <label>
              <AdminFieldLabel label="Asset key" hint="Stable Phaser cache key base. Defaults to FX id." />
              <input value={draft.asset.key ?? ''} onChange={(event) => patchAsset({ key: event.target.value || undefined })} placeholder={draft.id || 'fx_key'} />
            </label>
            <label>
              <AdminFieldLabel label="Upload sprite sheet" hint="Stores the image in content assets and writes a direct public URL (for example /assets/upload/...)." />
              <span className="admin-inline-image-upload">
                <span>{isUploading ? 'Uploading...' : 'Choose image'}</span>
                <input type="file" accept="image/png,image/webp,image/jpeg,image/gif" disabled={isUploading} onChange={uploadAsset} />
              </span>
            </label>
          </div>
          <div className="admin-form-grid">
            <label>
              <AdminFieldLabel label="Frame width" hint="Width of one sprite-sheet frame." />
              <input type="number" min={1} value={draft.asset.frameWidth ?? 1} onChange={(event) => patchAsset({ frameWidth: Number(event.target.value) || 1 })} />
            </label>
            <label>
              <AdminFieldLabel label="Frame height" hint="Height of one sprite-sheet frame." />
              <input type="number" min={1} value={draft.asset.frameHeight ?? 1} onChange={(event) => patchAsset({ frameHeight: Number(event.target.value) || 1 })} />
            </label>
            <label>
              <AdminFieldLabel label="Frame count" hint="How many frames to play from index 0." />
              <input type="number" min={1} value={draft.asset.frameCount ?? 1} onChange={(event) => patchAsset({ frameCount: Number(event.target.value) || 1 })} />
            </label>
          </div>
        </section>
        ) : null}

        {draft.kind !== 'composite' ? (
        <section className="card visual-fx-section">
          <h3>Animation / Placement / Render</h3>
          <div className="admin-form-grid">
            <label>
              <AdminFieldLabel label="Frame rate" hint="Playback speed for sprite sheets." />
              <input type="number" min={1} value={draft.animation.frameRate ?? 12} onChange={(event) => patchAnimation({ frameRate: Number(event.target.value) || 12 })} />
            </label>
            <label>
              <AdminFieldLabel label="Repeat" hint="0 once, -1 loop. Preview auto-cleans long loops." />
              <input type="number" value={draft.animation.repeat ?? 0} onChange={(event) => patchAnimation({ repeat: Number(event.target.value) || 0 })} />
            </label>
            <label>
              <AdminFieldLabel label="Duration ms" hint="Fallback duration for static images and loop cleanup." />
              <input type="number" min={1} value={draft.animation.durationMs ?? 500} onChange={(event) => patchAnimation({ durationMs: Number(event.target.value) || 500 })} />
            </label>
            <label>
              <AdminFieldLabel label="Default play on" hint="Where this FX appears by default." />
              <select value={draft.placement.defaultPlayOn} onChange={(event) => patchPlacement({ defaultPlayOn: event.target.value as VisualFxPlayOn })}>
                {PLAY_ON.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label>
              <AdminFieldLabel label="Placement mode" hint="once: разовый FX. linger/follow_target: горение или аура на цели. ground_persist: стоит на месте у ног/на земле." />
              <select
                value={draft.placement.mode ?? 'once'}
                onChange={(event) => patchPlacement({ mode: event.target.value as NonNullable<VisualFxDefinition['placement']['mode']> })}
              >
                {VISUAL_FX_PLACEMENT_MODES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label>
              <AdminFieldLabel label="Anchor" hint="Semantic anchor for future placement refinements." />
              <select value={draft.placement.anchor ?? 'center'} onChange={(event) => patchPlacement({ anchor: event.target.value as NonNullable<VisualFxDefinition['placement']['anchor']> })}>
                {ANCHORS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label className="zone-editor-checkbox">
              <input type="checkbox" checked={draft.placement.rotateToDirection !== false} onChange={(event) => patchPlacement({ rotateToDirection: event.target.checked })} />
              <AdminFieldLabel label="Rotate to direction" hint="Projectiles face their travel direction." />
            </label>
            <label>
              <AdminFieldLabel label="Offset X" hint="Pixel offset relative to caster/target/area point." />
              <input type="number" value={draft.placement.offsetX ?? 0} onChange={(event) => patchPlacement({ offsetX: Number(event.target.value) || 0 })} />
            </label>
            <label>
              <AdminFieldLabel label="Offset Y" hint="Positive moves the FX down." />
              <input type="number" value={draft.placement.offsetY ?? 0} onChange={(event) => patchPlacement({ offsetY: Number(event.target.value) || 0 })} />
            </label>
            <label>
              <AdminFieldLabel label="Linger ms" hint="Сколько держать FX на месте/на цели для режимов linger/follow_target/follow_caster/ground_persist." />
              <input
                type="number"
                min={80}
                value={draft.placement.lingerDurationMs ?? 900}
                onChange={(event) => patchPlacement({ lingerDurationMs: Number(event.target.value) || 900 })}
              />
            </label>
            <label>
              <AdminFieldLabel label="Scale" hint="Visual scale only; gameplay radius still comes from skill targeting." />
              <input type="number" step="0.05" min={0.01} value={draft.render.scale ?? 1} onChange={(event) => patchRender({ scale: Number(event.target.value) || 1 })} />
            </label>
            <label>
              <AdminFieldLabel label="Alpha" hint="Opacity 0..1." />
              <input type="number" step="0.05" min={0} max={1} value={draft.render.alpha ?? 1} onChange={(event) => patchRender({ alpha: Number(event.target.value) })} />
            </label>
            <label>
              <AdminFieldLabel label="Blend mode" hint="ADD is useful for fire, magic, lightning and glow FX." />
              <select value={draft.render.blendMode ?? 'NORMAL'} onChange={(event) => patchRender({ blendMode: event.target.value as NonNullable<VisualFxDefinition['render']['blendMode']> })}>
                {BLEND_MODES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label>
              <AdminFieldLabel label="Rotation" hint="Base rotation in radians." />
              <input type="number" step="0.05" value={draft.render.rotation ?? 0} onChange={(event) => patchRender({ rotation: Number(event.target.value) || 0 })} />
            </label>
            <label>
              <AdminFieldLabel label="Origin X" hint="0 left, 0.5 center, 1 right." />
              <input type="number" step="0.05" min={0} max={1} value={draft.render.originX ?? 0.5} onChange={(event) => patchRender({ originX: Number(event.target.value) })} />
            </label>
            <label>
              <AdminFieldLabel label="Origin Y" hint="0 top, 0.5 center, 1 bottom." />
              <input type="number" step="0.05" min={0} max={1} value={draft.render.originY ?? 0.5} onChange={(event) => patchRender({ originY: Number(event.target.value) })} />
            </label>
            <label>
              <AdminFieldLabel label="Depth" hint="Higher draws above actors." />
              <input type="number" value={draft.render.depth ?? 5000} onChange={(event) => patchRender({ depth: Number(event.target.value) || 5000 })} />
            </label>
          </div>
        </section>
        ) : null}

        {draft.kind !== 'composite' ? (
        <section className="card visual-fx-section">
          <h3>Projectile / Camera / Audio</h3>
          <div className="admin-form-grid">
            <label>
              <AdminFieldLabel label="Projectile speed" hint="Pixels per second in preview and battle projectile playback." />
              <input type="number" min={1} value={draft.projectile?.speed ?? 650} onChange={(event) => patchProjectile({ speed: Number(event.target.value) || 650 })} />
            </label>
            <label>
              <AdminFieldLabel label="Projectile arc" hint="Reserved for later arced projectiles." />
              <input type="number" step="0.05" value={draft.projectile?.arc ?? 0} onChange={(event) => patchProjectile({ arc: Number(event.target.value) || 0 })} />
            </label>
            <label className="zone-editor-checkbox">
              <input type="checkbox" checked={draft.projectile?.destroyOnImpact !== false} onChange={(event) => patchProjectile({ destroyOnImpact: event.target.checked })} />
              <AdminFieldLabel label="Destroy on impact" hint="Projectile object disappears when it reaches target." />
            </label>
            <label>
              <AdminFieldLabel label="Camera shake" hint="Used by real battle when this FX is selected." />
              <select value={draft.camera?.shakePreset ?? 'none'} onChange={(event) => patchCamera({ shakePreset: event.target.value as NonNullable<VisualFxDefinition['camera']>['shakePreset'] })}>
                <option value="none">none</option>
                <option value="small">small</option>
                <option value="medium">medium</option>
                <option value="heavy">heavy</option>
              </select>
            </label>
            <label>
              <AdminFieldLabel label="Default sound ID" hint="Optional sound id or URL; skill can still override it." />
              <input value={draft.audio?.defaultSoundId ?? ''} onChange={(event) => patchAudio({ defaultSoundId: event.target.value || undefined })} />
            </label>
            <label>
              <AdminFieldLabel label="Upload sound" hint="Stores audio in content assets and writes URL into Default sound ID." />
              <span className="admin-inline-image-upload">
                <span>{isAudioUploading ? 'Uploading audio...' : 'Choose audio'}</span>
                <input type="file" accept="audio/*,.ogg,.mp3,.wav,.m4a,.webm" disabled={isAudioUploading} onChange={uploadAudioAsset} />
              </span>
            </label>
            <label>
              <AdminFieldLabel label="Sound volume" hint="0..1." />
              <input type="number" step="0.05" min={0} max={1} value={draft.audio?.volume ?? 1} onChange={(event) => patchAudio({ volume: Number(event.target.value) })} />
            </label>
            <label>
              <AdminFieldLabel label="Tags" hint="Comma-separated search tags." />
              <input value={formatTags(draft.tags)} onChange={(event) => patch({ tags: asTags(event.target.value) })} placeholder="fire, circle, aoe" />
            </label>
          </div>
        </section>
        ) : null}

        <FxBattlePreview fx={draft} registry={entries.some((entry) => entry.id === draft.id) ? entries.map((entry) => entry.id === draft.id ? draft : entry) : [...entries, draft]} selectedStageId={selectedStageId ?? undefined} />

        <section className="card visual-fx-section">
          <h3>JSON</h3>
          <textarea
            rows={12}
            value={JSON.stringify(draft, null, 2)}
            onChange={(event) => {
              try {
                patch(JSON.parse(event.target.value) as Partial<VisualFxDefinition>);
                setStatus('JSON applied.');
              } catch {
                setStatus('JSON is not valid yet.');
              }
            }}
          />
        </section>

        <div className="admin-actions-row">
          <button type="button" disabled={isSaving} onClick={save}>{isSaving ? 'Saving...' : (selectedId ? 'Save' : 'Create')}</button>
          <button type="button" disabled={!draft.id} onClick={duplicate}>Duplicate</button>
          <button type="button" disabled={!selectedId} onClick={remove}>Delete</button>
        </div>
        <AdminSaveStatus value={saveState} />
        <p className="muted">{status}</p>
      </section>

      <section className="admin-items-catalog card">
        <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
          <h3>FX Library</h3>
          <span>{entries.length} total</span>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search id, name, tag..." />
        <div className="admin-items-icons-grid visual-fx-list">
          {visibleEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === selectedId ? 'is-active' : ''}
              onClick={() => selectEntry(entry)}
            >
              <strong>{entry.name || entry.id}</strong>
              <span>{entry.id}</span>
              <span>{entry.kind ?? 'single'} / {entry.category} / {entry.element ?? 'none'} / {entry.status}</span>
            </button>
          ))}
          {visibleEntries.length === 0 ? <p className="muted">No Visual FX entries.</p> : null}
        </div>
      </section>
    </div>
  );
}
