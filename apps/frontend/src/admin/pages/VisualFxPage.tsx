import type { VisualFxDefinition, VisualFxPlayOn } from '@theend/rpg-domain';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { imageService } from '../../services/content/imageService';
import { audioService } from '../../services/content/audioService';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import {
  emptyVisualFx,
  normalizeVisualFx,
  visualFxService,
  VISUAL_FX_CATEGORIES,
  VISUAL_FX_ELEMENTS,
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
      anchor: 'feet',
      offsetX: 0,
      offsetY: 12,
      rotateToDirection: false,
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

  function selectEntry(entry: VisualFxDefinition) {
    setSelectedId(entry.id);
    setDraft(entry);
    setStatus('');
  }

  function newEntry(template: 'blank' | 'fire' = 'blank') {
    setSelectedId(null);
    setDraft(template === 'fire' ? createFireCircleDraft() : emptyVisualFx());
    setStatus('New Visual FX draft.');
  }

  async function save() {
    setSaving(true);
    setSaveState({ state: 'saving', message: 'Saving...' });
    try {
      const normalized = normalizeVisualFx(draft);
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
        </div>

        <label className="admin-form-grid full-width">
          <AdminFieldLabel label="Description" hint="Internal note for designers/admins." />
          <textarea rows={2} value={draft.description ?? ''} onChange={(event) => patch({ description: event.target.value || undefined })} />
        </label>

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

        <FxBattlePreview fx={draft} />

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
              <span>{entry.category} / {entry.element ?? 'none'} / {entry.status}</span>
            </button>
          ))}
          {visibleEntries.length === 0 ? <p className="muted">No Visual FX entries.</p> : null}
        </div>
      </section>
    </div>
  );
}
