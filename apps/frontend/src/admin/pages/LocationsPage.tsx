import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from 'react';
import type { BattleMapDefinition } from '@theend/rpg-domain';
import { getContentCollection } from '../../services/content/contentApi';
import { downloadCollectionJson, extractRawCollectionFromImportJson } from '../../services/content/adminJsonImportExport';
import { imageService } from '../../services/content/imageService';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import { locationService } from '../../services/locationRepository';
import type { AdminDialogue, AdminMerchant, AdminNpc, AdminQuest, StoredImage } from '../../services/content/models';
import { translateAdminErrorMessage } from '../adminUi';
import type {
  LocationArea,
  LocationAreaShapeType,
  LocationEffect,
  LocationEntryRequirements,
  LocationStateVariant,
  LocationStatus,
  LocationSubtype,
  WorldLocation,
} from '../../types/location';

const LOCATION_STATUSES: LocationStatus[] = ['draft', 'active', 'disabled', 'archived'];
const LOCATION_SUBTYPES: Array<{ value: LocationSubtype; label: string }> = [
  { value: 'camp', label: 'Лагерь' },
  { value: 'sanctuary', label: 'Святилище' },
  { value: 'ruins', label: 'Руины' },
  { value: 'cave', label: 'Пещера' },
  { value: 'mine', label: 'Шахта' },
  { value: 'outpost', label: 'Застава' },
  { value: 'hideout', label: 'Убежище' },
  { value: 'temple', label: 'Храм' },
  { value: 'tower', label: 'Башня' },
  { value: 'forest', label: 'Лесная локация' },
  { value: 'grove', label: 'Роща' },
  { value: 'graveyard', label: 'Кладбище' },
  { value: 'battlefield', label: 'Поле битвы' },
  { value: 'ritual_place', label: 'Ритуальное место' },
  { value: 'forge', label: 'Кузница' },
  { value: 'shrine', label: 'Алтарь' },
  { value: 'farm', label: 'Ферма' },
  { value: 'crossroad', label: 'Перекрёсток' },
  { value: 'custom', label: 'Другое' },
];

type EditorTab =
  | 'main'
  | 'states'
  | 'areas'
  | 'npcs'
  | 'merchants'
  | 'quests'
  | 'dialogues'
  | 'battleMaps'
  | 'requirements'
  | 'effects'
  | 'json';

interface ReferenceOption {
  id: string;
  name: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function splitCsv(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function joinCsv(value: string[] | undefined): string {
  return (value ?? []).join(', ');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function translateSubtype(value: string | undefined): string {
  return LOCATION_SUBTYPES.find((entry) => entry.value === value)?.label ?? value ?? '—';
}

function createStateVariant(stateKey = `state_${Date.now()}`): LocationStateVariant {
  return {
    stateKey,
    name: 'Новое состояние',
    visibleOnMap: true,
    canEnter: true,
    npcIds: [],
    merchantIds: [],
    questIds: [],
    dialogueIds: [],
    battleMapIds: [],
    tags: [],
  };
}

function createLocationEffect(): LocationEffect {
  return { type: 'custom', description: '' };
}

function createLocationArea(id = `area_${Date.now()}`): LocationArea {
  return {
    id,
    name: 'Новое место',
    shapeType: 'rectangle',
    shape: { x: 80, y: 80, width: 140, height: 84 },
    npcIds: [],
    merchantIds: [],
    questIds: [],
    dialogueIds: [],
    battleMapIds: [],
    visibleInStates: [],
    canEnter: true,
    isHidden: false,
    tags: [],
  };
}

function createNewLocation(): WorldLocation {
  const timestamp = nowIso();
  return {
    id: `loc_${Date.now()}`,
    name: 'Новая локация',
    type: 'location',
    subtype: 'custom',
    status: 'draft',
    description: '',
    shortDescription: '',
    regionId: '',
    factionId: '',
    clanId: '',
    tribeId: '',
    currentState: 'active',
    stateVariants: [createStateVariant('active')],
    npcIds: [],
    merchantIds: [],
    questIds: [],
    dialogueIds: [],
    battleMapIds: [],
    areas: [],
    locationEffects: [],
    tags: [],
    published: false,
    hidden: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeDraft(location: WorldLocation): WorldLocation {
  return {
    ...structuredClone(location),
    type: 'location',
    stateVariants: Array.isArray(location.stateVariants) ? location.stateVariants : [],
    npcIds: Array.isArray(location.npcIds) ? location.npcIds : [],
    merchantIds: Array.isArray(location.merchantIds) ? location.merchantIds : [],
    questIds: Array.isArray(location.questIds) ? location.questIds : [],
    dialogueIds: Array.isArray(location.dialogueIds) ? location.dialogueIds : [],
    battleMapIds: Array.isArray(location.battleMapIds) ? location.battleMapIds : [],
    areas: Array.isArray(location.areas) ? location.areas : [],
    locationEffects: Array.isArray(location.locationEffects) ? location.locationEffects : [],
    tags: Array.isArray(location.tags) ? location.tags : [],
  };
}

function validateLocation(location: WorldLocation): string[] {
  const errors: string[] = [];
  if (!location.id.trim()) errors.push('Нужно заполнить ID.');
  if (!location.name.trim()) errors.push('Нужно заполнить название.');
  if (location.type !== 'location') errors.push('type должен быть location.');

  const stateKeys = new Set<string>();
  for (const state of location.stateVariants ?? []) {
    if (!state.stateKey?.trim()) errors.push('У состояния нужен stateKey.');
    if (!state.name?.trim()) errors.push(`У состояния ${state.stateKey || 'без ключа'} нужно название.`);
    if (state.stateKey && stateKeys.has(state.stateKey)) errors.push(`Повторяющийся stateKey: ${state.stateKey}`);
    if (state.stateKey) stateKeys.add(state.stateKey);
  }

  const areaIds = new Set<string>();
  for (const area of location.areas ?? []) {
    if (!area.id?.trim()) errors.push('У внутреннего места нужен ID.');
    if (!area.name?.trim()) errors.push(`У внутреннего места ${area.id || 'без ID'} нужно название.`);
    if (area.id && areaIds.has(area.id)) errors.push(`Повторяющийся area id: ${area.id}`);
    if (area.id) areaIds.add(area.id);
  }

  return errors;
}

function resolvePreview(location: WorldLocation, images: StoredImage[]): string | null {
  const activeState = location.stateVariants?.find((entry) => entry.stateKey === location.currentState);
  const imageId = activeState?.imageId ?? location.defaultImageId;
  const imagePath = activeState?.imagePath ?? location.defaultImagePath;
  if (imageId) {
    const stored = images.find((image) => image.id === imageId);
    if (stored) return stored.dataUrl;
    return imageId.startsWith('img_') ? null : imageId;
  }
  return imagePath || null;
}

function getThumbLabel(location: WorldLocation): string {
  return (location.name || location.id || '?').slice(0, 2).toUpperCase();
}

function AreaEditor({
  area,
  images,
  onPatch,
  onUploadImage,
}: {
  area: LocationArea;
  images: StoredImage[];
  onPatch: (patch: Partial<LocationArea>) => void;
  onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const preview = area.imageId ? images.find((image) => image.id === area.imageId)?.dataUrl : area.imagePath;
  const shape = area.shape ?? {};

  return (
    <div className="admin-area-editor">
      <div className="admin-form-grid admin-location-main-grid">
        <label><span>ID</span><input value={area.id} onChange={(event) => onPatch({ id: event.target.value })} /></label>
        <label><span>Name</span><input value={area.name} onChange={(event) => onPatch({ name: event.target.value })} /></label>
        <label><span>Type</span><input value={area.type ?? ''} onChange={(event) => onPatch({ type: event.target.value || undefined })} /></label>
        <label>
          <span>Shape Type</span>
          <select
            value={area.shapeType ?? 'none'}
            onChange={(event) => onPatch({
              shapeType: event.target.value as LocationAreaShapeType,
              shape: event.target.value === 'circle'
                ? { x: shape.x ?? 80, y: shape.y ?? 80, radius: shape.radius ?? 42 }
                : event.target.value === 'rectangle'
                  ? { x: shape.x ?? 80, y: shape.y ?? 80, width: shape.width ?? 140, height: shape.height ?? 84 }
                  : undefined,
            })}
          >
            <option value="none">none</option>
            <option value="rectangle">rectangle</option>
            <option value="circle">circle</option>
            <option value="polygon">polygon</option>
          </select>
        </label>
        <label><span>X</span><input type="number" value={shape.x ?? ''} onChange={(event) => onPatch({ shape: { ...shape, x: event.target.value ? Number(event.target.value) : undefined } })} /></label>
        <label><span>Y</span><input type="number" value={shape.y ?? ''} onChange={(event) => onPatch({ shape: { ...shape, y: event.target.value ? Number(event.target.value) : undefined } })} /></label>
        {area.shapeType === 'circle' ? (
          <label><span>Radius</span><input type="number" value={shape.radius ?? ''} onChange={(event) => onPatch({ shape: { ...shape, radius: event.target.value ? Number(event.target.value) : undefined } })} /></label>
        ) : null}
        {area.shapeType === 'rectangle' ? (
          <>
            <label><span>Width</span><input type="number" value={shape.width ?? ''} onChange={(event) => onPatch({ shape: { ...shape, width: event.target.value ? Number(event.target.value) : undefined } })} /></label>
            <label><span>Height</span><input type="number" value={shape.height ?? ''} onChange={(event) => onPatch({ shape: { ...shape, height: event.target.value ? Number(event.target.value) : undefined } })} /></label>
          </>
        ) : null}
        <label><span>NPC IDs</span><input value={joinCsv(area.npcIds)} onChange={(event) => onPatch({ npcIds: splitCsv(event.target.value) })} /></label>
        <label><span>Merchant IDs</span><input value={joinCsv(area.merchantIds)} onChange={(event) => onPatch({ merchantIds: splitCsv(event.target.value) })} /></label>
        <label><span>Quest IDs</span><input value={joinCsv(area.questIds)} onChange={(event) => onPatch({ questIds: splitCsv(event.target.value) })} /></label>
        <label><span>Dialogue IDs</span><input value={joinCsv(area.dialogueIds)} onChange={(event) => onPatch({ dialogueIds: splitCsv(event.target.value) })} /></label>
        <label><span>Battle Map IDs</span><input value={joinCsv(area.battleMapIds)} onChange={(event) => onPatch({ battleMapIds: splitCsv(event.target.value) })} /></label>
        <label><span>Visible in states</span><input value={joinCsv(area.visibleInStates)} onChange={(event) => onPatch({ visibleInStates: splitCsv(event.target.value) })} /></label>
        <label><span>Hidden until quest</span><input value={area.hiddenUntilQuestId ?? ''} onChange={(event) => onPatch({ hiddenUntilQuestId: event.target.value || undefined })} /></label>
        <label><span>Hidden after quest</span><input value={area.hiddenAfterQuestId ?? ''} onChange={(event) => onPatch({ hiddenAfterQuestId: event.target.value || undefined })} /></label>
        <label><span>Tags</span><input value={joinCsv(area.tags)} onChange={(event) => onPatch({ tags: splitCsv(event.target.value) })} /></label>
        <label>
          <span>Image</span>
          <select value={area.imageId ?? ''} onChange={(event) => onPatch({ imageId: event.target.value || undefined, imagePath: undefined })}>
            <option value="">—</option>
            {images.map((image) => <option key={image.id} value={image.id}>{image.name}</option>)}
          </select>
        </label>
        <label><span>Upload image</span><input type="file" accept="image/*" onChange={onUploadImage} /></label>
        <label className="admin-checkbox"><input type="checkbox" checked={area.canEnter !== false} onChange={(event) => onPatch({ canEnter: event.target.checked })} /><span>Can enter</span></label>
        <label className="admin-checkbox"><input type="checkbox" checked={area.isHidden === true} onChange={(event) => onPatch({ isHidden: event.target.checked })} /><span>Is hidden</span></label>
        <label className="admin-form-grid full-width"><span>Description</span><textarea rows={4} value={area.description ?? ''} onChange={(event) => onPatch({ description: event.target.value || undefined })} /></label>
      </div>

      {preview ? (
        <div className="admin-preview-card admin-location-header-card">
          <img src={preview} alt={area.name} style={{ maxWidth: 260, maxHeight: 180, objectFit: 'cover' }} />
        </div>
      ) : null}
    </div>
  );
}

export function LocationsPage() {
  const [locations, setLocations] = useState<WorldLocation[]>([]);
  const [draft, setDraft] = useState<WorldLocation | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [tab, setTab] = useState<EditorTab>('main');
  const [status, setStatus] = useState('Готово');
  const [images, setImages] = useState<StoredImage[]>([]);
  const [npcs, setNpcs] = useState<ReferenceOption[]>([]);
  const [merchants, setMerchants] = useState<ReferenceOption[]>([]);
  const [quests, setQuests] = useState<ReferenceOption[]>([]);
  const [dialogues, setDialogues] = useState<ReferenceOption[]>([]);
  const [battleMaps, setBattleMaps] = useState<ReferenceOption[]>([]);
  const [queryId, setQueryId] = useState('');
  const [queryName, setQueryName] = useState('');
  const [querySubtype, setQuerySubtype] = useState('');
  const [queryRegionId, setQueryRegionId] = useState('');
  const [queryFactionId, setQueryFactionId] = useState('');
  const [queryState, setQueryState] = useState('');
  const [queryTags, setQueryTags] = useState('');
  const [jsonDraft, setJsonDraft] = useState('');
  const [areaTool, setAreaTool] = useState<'select' | 'rectangle' | 'circle'>('select');
  const [areaZoom, setAreaZoom] = useState(1);
  const [areaPan, setAreaPan] = useState({ x: 0, y: 0 });
  const [isAreaPanning, setIsAreaPanning] = useState(false);
  const [areaPanStart, setAreaPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });
  const [dragAreaId, setDragAreaId] = useState<string | null>(null);
  const [dragAreaPointerId, setDragAreaPointerId] = useState<number | null>(null);
  const [dragAreaStart, setDragAreaStart] = useState<{ x: number; y: number; shapeX: number; shapeY: number; shape: NonNullable<LocationArea['shape']> } | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const areaCanvasRef = useRef<HTMLDivElement | null>(null);

  async function reload(selectId?: string) {
    const [nextLocations, nextImages, nextNpcs, nextMerchants, nextQuests, nextDialogues, nextBattleMaps] = await Promise.all([
      locationService.getLocations(),
      imageService.getAll().catch(() => []),
      getContentCollection<AdminNpc>('npcs').then((entries) => entries.map((entry) => ({ id: entry.id, name: entry.name || entry.id }))).catch(() => []),
      getContentCollection<AdminMerchant>('merchants').then((entries) => entries.map((entry) => ({ id: entry.id, name: entry.name || entry.id }))).catch(() => []),
      getContentCollection<AdminQuest>('quests').then((entries) => entries.map((entry) => ({ id: entry.id, name: entry.title || entry.id }))).catch(() => []),
      getContentCollection<AdminDialogue>('dialogues').then((entries) => entries.map((entry) => ({ id: entry.id, name: entry.title || entry.id }))).catch(() => []),
      getContentCollection<BattleMapDefinition>('battleMaps').then((entries) => entries.map((entry) => ({ id: entry.id, name: entry.name || entry.id }))).catch(() => []),
    ]);

    setLocations(nextLocations);
    setImages(nextImages);
    setNpcs(nextNpcs);
    setMerchants(nextMerchants);
    setQuests(nextQuests);
    setDialogues(nextDialogues);
    setBattleMaps(nextBattleMaps);

    const nextId = selectId ?? selectedId ?? nextLocations[0]?.id ?? '';
    const selected = nextLocations.find((entry) => entry.id === nextId) ?? nextLocations[0] ?? null;
    const normalized = selected ? normalizeDraft(selected) : null;
    setSelectedId(selected?.id ?? '');
    setDraft(normalized);
    setSelectedAreaId(normalized?.areas?.[0]?.id ?? '');
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    setJsonDraft(draft ? JSON.stringify(draft, null, 2) : '');
  }, [draft]);

  const filteredLocations = useMemo(() => {
    const tagTerms = splitCsv(queryTags.toLowerCase());
    return locations.filter((location) => {
      if (queryId && !location.id.toLowerCase().includes(queryId.toLowerCase())) return false;
      if (queryName && !location.name.toLowerCase().includes(queryName.toLowerCase())) return false;
      if (querySubtype && String(location.subtype ?? '').toLowerCase() !== querySubtype.toLowerCase()) return false;
      if (queryRegionId && String(location.regionId ?? '').toLowerCase() !== queryRegionId.toLowerCase()) return false;
      if (queryFactionId && String(location.factionId ?? '').toLowerCase() !== queryFactionId.toLowerCase()) return false;
      if (queryState && String(location.currentState ?? '').toLowerCase() !== queryState.toLowerCase()) return false;
      if (tagTerms.length > 0 && !tagTerms.every((term) => (location.tags ?? []).some((tag) => tag.toLowerCase().includes(term)))) return false;
      return true;
    });
  }, [locations, queryFactionId, queryId, queryName, queryRegionId, queryState, querySubtype, queryTags]);

  const requirements: LocationEntryRequirements = draft?.entryRequirements ?? {};
  const previewUrl = draft ? resolvePreview(draft, images) : null;
  const selectedArea = useMemo(
    () => draft?.areas?.find((area) => area.id === selectedAreaId) ?? draft?.areas?.[0] ?? null,
    [draft?.areas, selectedAreaId],
  );

  function selectLocation(id: string) {
    const selected = locations.find((entry) => entry.id === id) ?? null;
    const normalized = selected ? normalizeDraft(selected) : null;
    setSelectedId(id);
    setDraft(normalized);
    setSelectedAreaId(normalized?.areas?.[0]?.id ?? '');
  }

  function patchDraft(patch: Partial<WorldLocation>) {
    setDraft((current) => current ? normalizeDraft({ ...current, ...patch, updatedAt: nowIso() }) : current);
  }

  function patchState(index: number, patch: Partial<LocationStateVariant>) {
    setDraft((current) => {
      if (!current) return current;
      const nextStates = [...(current.stateVariants ?? [])];
      nextStates[index] = { ...nextStates[index], ...patch };
      return normalizeDraft({ ...current, stateVariants: nextStates, updatedAt: nowIso() });
    });
  }

  function patchArea(areaId: string, patch: Partial<LocationArea>) {
    setDraft((current) => {
      if (!current) return current;
      return normalizeDraft({
        ...current,
        areas: (current.areas ?? []).map((area) => area.id === areaId ? { ...area, ...patch } : area),
        updatedAt: nowIso(),
      });
    });
  }

  function patchRequirements(nextRequirements: NonNullable<WorldLocation['entryRequirements']>) {
    patchDraft({ entryRequirements: nextRequirements });
  }

  function patchEffects(nextEffects: LocationEffect[]) {
    patchDraft({ locationEffects: nextEffects });
  }

  function patchReferenceList(key: 'npcIds' | 'merchantIds' | 'questIds' | 'dialogueIds' | 'battleMapIds', rawValue: string) {
    patchDraft({ [key]: splitCsv(rawValue) } as Partial<WorldLocation>);
  }

  async function saveLocation() {
    if (!draft) return;
    const candidate = normalizeDraft({ ...draft, updatedAt: nowIso() });
    const errors = validateLocation(candidate);
    if (errors.length > 0) {
      setStatus(errors.join(' '));
      return;
    }

    if (locations.some((entry) => entry.id === candidate.id)) {
      await locationService.updateLocation(candidate);
      setStatus('Локация обновлена.');
    } else {
      await locationService.createLocation(candidate);
      setStatus('Локация создана.');
    }

    await reload(candidate.id);
  }

  function addLocation() {
    const next = createNewLocation();
    setSelectedId(next.id);
    setDraft(next);
    setSelectedAreaId('');
    setTab('main');
    setStatus('Создан черновик новой локации. Нажмите «Сохранить», чтобы записать её в content.locations.');
  }

  async function duplicateLocation() {
    if (!draft) return;
    const duplicated = await locationService.duplicateLocation(draft.id);
    setStatus('Локация дублирована.');
    await reload(duplicated.id);
  }

  async function deleteLocation() {
    if (!draft) return;
    if (!window.confirm(`Удалить локацию ${draft.name}?`)) return;
    await locationService.deleteLocation(draft.id);
    setStatus('Локация удалена.');
    const fallbackId = locations.find((entry) => entry.id !== draft.id)?.id;
    await reload(fallbackId);
  }

  function addArea() {
    if (!draft) return;
    const nextArea = createLocationArea();
    patchDraft({ areas: [...(draft.areas ?? []), nextArea] });
    setSelectedAreaId(nextArea.id);
    setTab('areas');
  }

  function duplicateArea() {
    if (!draft || !selectedArea) return;
    const copy = structuredClone(selectedArea);
    copy.id = `${selectedArea.id}_copy`;
    copy.name = `${selectedArea.name} Copy`;
    patchDraft({ areas: [...(draft.areas ?? []), copy] });
    setSelectedAreaId(copy.id);
  }

  function deleteArea() {
    if (!draft || !selectedArea) return;
    const nextAreas = (draft.areas ?? []).filter((area) => area.id !== selectedArea.id);
    patchDraft({ areas: nextAreas });
    setSelectedAreaId(nextAreas[0]?.id ?? '');
  }

  function exportLocations() {
    downloadCollectionJson({ filePrefix: 'theend_locations', collectionKey: 'locations', entries: locations });
    setStatus(`Экспортировано локаций: ${locations.length}`);
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const rawText = await file.text();
      const payload = JSON.parse(rawText) as unknown;
      const rawEntries = extractRawCollectionFromImportJson(payload, 'locations');
      let created = 0;
      let skippedExisting = 0;

      for (const rawEntry of rawEntries) {
        if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
        const candidate = normalizeDraft(rawEntry as WorldLocation);
        const errors = validateLocation(candidate);
        if (errors.length > 0) {
          throw new Error(`${candidate.id || 'без id'}: ${errors.join(' ')}`);
        }
        if (locations.some((entry) => entry.id === candidate.id)) skippedExisting += 1;
        else {
          await locationService.createLocation(candidate);
          created += 1;
        }
      }
      setStatus(`Импорт завершён. Создано: ${created}, пропущено существующих: ${skippedExisting}.`);
      await reload();
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function uploadDefaultImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !draft) return;
    const image = await imageService.upload(file, {
      id: draft.id ? `${draft.id}_default` : undefined,
      name: `${draft.id || 'location'}-default`,
      folder: buildUploadFolder('images', 'locations', draft.id || draft.name || undefined),
    });
    setImages((current) => [...current, image]);
    patchDraft({ defaultImageId: image.id, defaultImagePath: undefined });
    setStatus(`Загружено изображение: ${image.name}`);
  }

  async function uploadStateImage(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !draft) return;
    const image = await imageService.upload(file, {
      id: draft.id ? `${draft.id}_state_${index}` : undefined,
      name: `${draft.id || 'location'}-state-${index}`,
      folder: buildUploadFolder('images', 'locations', draft.id || draft.name || undefined, 'states'),
    });
    setImages((current) => [...current, image]);
    patchState(index, { imageId: image.id, imagePath: undefined });
    setStatus(`Загружено изображение состояния: ${image.name}`);
  }

  async function uploadAreaImage(areaId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !draft) return;
    const image = await imageService.upload(file, {
      id: draft.id ? `${draft.id}_area_${areaId}` : undefined,
      name: `${draft.id || 'location'}-area-${areaId}`,
      folder: buildUploadFolder('images', 'locations', draft.id || draft.name || undefined, 'areas'),
    });
    setImages((current) => [...current, image]);
    patchArea(areaId, { imageId: image.id, imagePath: undefined });
    setStatus(`Загружено изображение внутреннего места: ${image.name}`);
  }

  function stopAreaDrag() {
    setIsAreaPanning(false);
    setDragAreaId(null);
    setDragAreaPointerId(null);
    setDragAreaStart(null);
  }

  function handleAreaCanvasWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.altKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setAreaZoom((current) => Math.max(0.25, Math.min(4, Number((current + delta).toFixed(2)))));
  }

  function handleAreaCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button === 1) {
      event.preventDefault();
      setIsAreaPanning(true);
      setAreaPanStart({ x: event.clientX, y: event.clientY, panX: areaPan.x, panY: areaPan.y });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (!draft || areaTool === 'select') return;
    const rect = areaCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.round((event.clientX - rect.left - areaPan.x) / areaZoom);
    const y = Math.round((event.clientY - rect.top - areaPan.y) / areaZoom);
    const nextArea = createLocationArea();
    nextArea.shapeType = areaTool;
    nextArea.shape = areaTool === 'circle' ? { x, y, radius: 42 } : { x, y, width: 140, height: 84 };
    patchDraft({ areas: [...(draft.areas ?? []), nextArea] });
    setSelectedAreaId(nextArea.id);
  }

  function handleAreaCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragAreaId && dragAreaStart && (dragAreaPointerId === null || dragAreaPointerId === event.pointerId)) {
      event.preventDefault();
      const dx = (event.clientX - dragAreaStart.x) / areaZoom;
      const dy = (event.clientY - dragAreaStart.y) / areaZoom;
      patchArea(dragAreaId, {
        shape: {
          ...dragAreaStart.shape,
          x: Math.max(0, Math.min(1200, Math.round(dragAreaStart.shapeX + dx))),
          y: Math.max(0, Math.min(720, Math.round(dragAreaStart.shapeY + dy))),
        },
      });
      return;
    }

    if (!isAreaPanning) return;
    setAreaPan({
      x: areaPanStart.panX + event.clientX - areaPanStart.x,
      y: areaPanStart.panY + event.clientY - areaPanStart.y,
    });
  }

  function validateJsonDraft() {
    try {
      const parsed = JSON.parse(jsonDraft) as WorldLocation;
      const candidate = normalizeDraft(parsed);
      const errors = validateLocation(candidate);
      setStatus(errors.length > 0 ? errors.join(' ') : 'JSON валиден.');
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  function applyJsonDraft() {
    try {
      const parsed = JSON.parse(jsonDraft) as WorldLocation;
      const candidate = normalizeDraft(parsed);
      const errors = validateLocation(candidate);
      if (errors.length > 0) {
        setStatus(errors.join(' '));
        return;
      }
      setDraft(candidate);
      setSelectedId(candidate.id);
      setSelectedAreaId(candidate.areas?.[0]?.id ?? '');
      setStatus('JSON применён к черновику.');
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  function renderReferenceButtons(options: ReferenceOption[], currentIds: string[], key: 'npcIds' | 'merchantIds' | 'questIds' | 'dialogueIds' | 'battleMapIds') {
    return (
      <div className="admin-reference-list">
        {options.map((entry) => {
          const active = currentIds.includes(entry.id);
          return (
            <button
              key={entry.id}
              type="button"
              className={active ? 'is-active' : ''}
              onClick={() => patchDraft({
                [key]: active ? currentIds.filter((id) => id !== entry.id) : [...new Set([...currentIds, entry.id])],
              } as Partial<WorldLocation>)}
            >
              {entry.name}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="admin-location-page">
      <section className="card admin-location-browser">
        <div className="admin-list-tools admin-location-list-tools">
          <input placeholder="Поиск по ID" value={queryId} onChange={(event) => setQueryId(event.target.value)} />
          <input placeholder="Поиск по названию" value={queryName} onChange={(event) => setQueryName(event.target.value)} />
          <select value={querySubtype} onChange={(event) => setQuerySubtype(event.target.value)}>
            <option value="">Все типы</option>
            {LOCATION_SUBTYPES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
          <input placeholder="Регион" value={queryRegionId} onChange={(event) => setQueryRegionId(event.target.value)} />
          <input placeholder="Фракция" value={queryFactionId} onChange={(event) => setQueryFactionId(event.target.value)} />
          <input placeholder="Состояние" value={queryState} onChange={(event) => setQueryState(event.target.value)} />
          <input placeholder="Теги через запятую" value={queryTags} onChange={(event) => setQueryTags(event.target.value)} />
        </div>

        <div className="admin-actions-row admin-location-browser-actions">
          <button type="button" onClick={addLocation}>Создать локацию</button>
          <button type="button" onClick={() => { void duplicateLocation(); }} disabled={!draft}>Дублировать</button>
          <button type="button" onClick={() => { void deleteLocation(); }} disabled={!draft}>Удалить</button>
          <button type="button" onClick={exportLocations}>Экспорт JSON</button>
          <button type="button" onClick={() => importRef.current?.click()}>Импорт JSON</button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
        </div>

        {locations.length === 0 ? (
          <div className="card admin-empty-state">
            <h3>Локаций пока нет</h3>
            <p className="muted">Создайте первую локацию, чтобы она сохранилась в content.locations и появилась в базе.</p>
            <button type="button" onClick={addLocation}>Создать первую локацию</button>
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="card admin-empty-state">
            <h3>Ничего не найдено</h3>
            <p className="muted">Измените фильтры или создайте новую локацию.</p>
            <button type="button" onClick={addLocation}>Создать локацию</button>
          </div>
        ) : (
          <div className="admin-location-catalog">
            {filteredLocations.map((location) => {
              const image = resolvePreview(location, images);
              return (
                <button
                  key={location.id}
                  type="button"
                  className={`admin-location-card ${selectedId === location.id ? 'is-active' : ''}`}
                  onClick={() => selectLocation(location.id)}
                  title={`${location.name} (${location.id})`}
                >
                  <div className="admin-location-thumb">
                    {image ? <img src={image} alt={location.name} /> : getThumbLabel(location)}
                  </div>
                  <strong>{location.name}</strong>
                  <small>{location.id}</small>
                  <span>{translateSubtype(location.subtype)}</span>
                  <span>{location.currentState || '—'}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="card admin-location-editor-panel">
        {draft ? (
          <>
            <div className="admin-preview-card admin-location-header-card">
              <div className="admin-selected-visual admin-location-selected-visual">
                <div className="admin-location-thumb">
                  {previewUrl ? <img src={previewUrl} alt={draft.name} /> : getThumbLabel(draft)}
                </div>
                <div className="admin-location-meta">
                  <h3>{draft.name}</h3>
                  <p className="muted">{draft.id}</p>
                  <p className="muted">{translateSubtype(draft.subtype)} • {draft.currentState || '—'} • {draft.status}</p>
                </div>
              </div>
            </div>

            <div className="admin-tabbar admin-location-tabbar">
              <button type="button" className={tab === 'main' ? 'is-active' : ''} onClick={() => setTab('main')}>Основное</button>
              <button type="button" className={tab === 'states' ? 'is-active' : ''} onClick={() => setTab('states')}>Изображения / состояния</button>
              <button type="button" className={tab === 'areas' ? 'is-active' : ''} onClick={() => setTab('areas')}>Внутренние места</button>
              <button type="button" className={tab === 'npcs' ? 'is-active' : ''} onClick={() => setTab('npcs')}>NPC</button>
              <button type="button" className={tab === 'merchants' ? 'is-active' : ''} onClick={() => setTab('merchants')}>Торговцы</button>
              <button type="button" className={tab === 'quests' ? 'is-active' : ''} onClick={() => setTab('quests')}>Квесты</button>
              <button type="button" className={tab === 'dialogues' ? 'is-active' : ''} onClick={() => setTab('dialogues')}>Диалоги</button>
              <button type="button" className={tab === 'battleMaps' ? 'is-active' : ''} onClick={() => setTab('battleMaps')}>Battle Maps</button>
              <button type="button" className={tab === 'requirements' ? 'is-active' : ''} onClick={() => setTab('requirements')}>Требования входа</button>
              <button type="button" className={tab === 'effects' ? 'is-active' : ''} onClick={() => setTab('effects')}>Эффекты локации</button>
              <button type="button" className={tab === 'json' ? 'is-active' : ''} onClick={() => setTab('json')}>JSON</button>
            </div>

            <div className="admin-location-editor-body">
            {tab === 'main' && (
              <div className="admin-form-grid admin-location-main-grid">
                <label><span>ID</span><input value={draft.id} onChange={(event) => patchDraft({ id: event.target.value })} /></label>
                <label><span>Название</span><input value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} /></label>
                <label><span>Slug</span><input value={draft.slug ?? ''} onChange={(event) => patchDraft({ slug: event.target.value })} /></label>
                <label><span>Тип</span><input value="location" disabled /></label>
                <label>
                  <span>Подтип</span>
                  <select value={String(draft.subtype ?? 'custom')} onChange={(event) => patchDraft({ subtype: event.target.value })}>
                    {LOCATION_SUBTYPES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Статус</span>
                  <select value={draft.status} onChange={(event) => patchDraft({ status: event.target.value as LocationStatus })}>
                    {LOCATION_STATUSES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                  </select>
                </label>
                <label><span>Регион</span><input value={draft.regionId ?? ''} onChange={(event) => patchDraft({ regionId: event.target.value })} /></label>
                <label><span>Родительское место</span><input value={draft.parentLocationId ?? ''} onChange={(event) => patchDraft({ parentLocationId: event.target.value })} /></label>
                <label><span>Королевство</span><input value={draft.kingdomId ?? ''} onChange={(event) => patchDraft({ kingdomId: event.target.value })} /></label>
                <label><span>Фракция</span><input value={draft.factionId ?? ''} onChange={(event) => patchDraft({ factionId: event.target.value })} /></label>
                <label><span>Клан</span><input value={draft.clanId ?? ''} onChange={(event) => patchDraft({ clanId: event.target.value })} /></label>
                <label><span>Племя</span><input value={draft.tribeId ?? ''} onChange={(event) => patchDraft({ tribeId: event.target.value })} /></label>
                <label><span>Квест открытия</span><input value={draft.discoveryQuestId ?? ''} onChange={(event) => patchDraft({ discoveryQuestId: event.target.value })} /></label>
                <label><span>Текущее состояние</span><input value={draft.currentState ?? ''} onChange={(event) => patchDraft({ currentState: event.target.value })} /></label>
                <label><span>Tags</span><input value={joinCsv(draft.tags)} onChange={(event) => patchDraft({ tags: splitCsv(event.target.value) })} /></label>
                <label className="admin-checkbox"><input type="checkbox" checked={draft.isHidden === true} onChange={(event) => patchDraft({ isHidden: event.target.checked })} /><span>Скрытая локация</span></label>
                <label className="admin-checkbox"><input type="checkbox" checked={draft.requiresDiscovery === true} onChange={(event) => patchDraft({ requiresDiscovery: event.target.checked })} /><span>Требует открытия</span></label>
                <label className="admin-checkbox"><input type="checkbox" checked={draft.isDiscovered === true} onChange={(event) => patchDraft({ isDiscovered: event.target.checked })} /><span>Открыта</span></label>
                <label className="admin-checkbox"><input type="checkbox" checked={draft.published === true} onChange={(event) => patchDraft({ published: event.target.checked })} /><span>Published</span></label>
                <label className="admin-checkbox"><input type="checkbox" checked={draft.hidden === true} onChange={(event) => patchDraft({ hidden: event.target.checked })} /><span>Hidden</span></label>
                <label className="admin-form-grid full-width"><span>Описание</span><textarea rows={5} value={draft.description ?? ''} onChange={(event) => patchDraft({ description: event.target.value })} /></label>
                <label className="admin-form-grid full-width"><span>Краткое описание</span><textarea rows={3} value={draft.shortDescription ?? ''} onChange={(event) => patchDraft({ shortDescription: event.target.value })} /></label>
              </div>
            )}

            {tab === 'states' && (
              <div className="admin-stack">
                <div className="admin-actions-row admin-location-browser-actions">
                  <label>
                    <span>Базовое изображение</span>
                    <select value={draft.defaultImageId ?? ''} onChange={(event) => patchDraft({ defaultImageId: event.target.value || undefined, defaultImagePath: undefined })}>
                      <option value="">—</option>
                      {images.map((image) => <option key={image.id} value={image.id}>{image.name} ({image.id})</option>)}
                    </select>
                  </label>
                  <label><span>Загрузить новое</span><input type="file" accept="image/*" onChange={(event) => { void uploadDefaultImage(event); }} /></label>
                  <button type="button" onClick={() => patchDraft({ defaultImageId: undefined, defaultImagePath: undefined })}>Очистить изображение</button>
                </div>
                <div className="admin-preview-card">
                  {previewUrl ? <img src={previewUrl} alt={draft.name} style={{ maxWidth: 240, maxHeight: 160 }} /> : <div className="admin-image-placeholder">No image</div>}
                </div>
                <div className="admin-actions-row">
                  <button type="button" onClick={() => patchDraft({ stateVariants: [...(draft.stateVariants ?? []), createStateVariant()], updatedAt: nowIso() })}>+ Добавить состояние</button>
                </div>
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>State key</th>
                      <th>Название</th>
                      <th>Картинка</th>
                      <th>Preview</th>
                      <th>Видна на карте</th>
                      <th>Можно войти</th>
                      <th>Владелец / фракция</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draft.stateVariants ?? []).map((state, index) => {
                      const stateImage = state.imageId ? images.find((image) => image.id === state.imageId)?.dataUrl : state.imagePath;
                      return (
                        <tr key={`${state.stateKey}-${index}`}>
                          <td><input value={state.stateKey} onChange={(event) => patchState(index, { stateKey: event.target.value })} /></td>
                          <td><input value={state.name} onChange={(event) => patchState(index, { name: event.target.value })} /></td>
                          <td>
                            <select value={state.imageId ?? ''} onChange={(event) => patchState(index, { imageId: event.target.value || undefined, imagePath: undefined })}>
                              <option value="">—</option>
                              {images.map((image) => <option key={image.id} value={image.id}>{image.name}</option>)}
                            </select>
                            <input type="file" accept="image/*" onChange={(event) => { void uploadStateImage(index, event); }} />
                          </td>
                          <td>{stateImage ? <img src={stateImage} alt={state.name} style={{ width: 64, height: 64, objectFit: 'cover' }} /> : '—'}</td>
                          <td><input type="checkbox" checked={state.visibleOnMap === true} onChange={(event) => patchState(index, { visibleOnMap: event.target.checked })} /></td>
                          <td><input type="checkbox" checked={state.canEnter !== false} onChange={(event) => patchState(index, { canEnter: event.target.checked })} /></td>
                          <td><input value={state.ownerFactionId ?? ''} onChange={(event) => patchState(index, { ownerFactionId: event.target.value })} /></td>
                          <td>
                            <button type="button" onClick={() => patchDraft({ stateVariants: [...(draft.stateVariants ?? []), structuredClone(state)] })}>Дублировать</button>
                            <button type="button" onClick={() => patchDraft({ stateVariants: (draft.stateVariants ?? []).filter((_, stateIndex) => stateIndex !== index) })}>Удалить</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'areas' && (
              <div className="location-area-workbench">
                <section className="location-area-canvas-panel card">
                  <div className="city-canvas-toolbar">
                    <button type="button" className={areaTool === 'select' ? 'is-active' : ''} onClick={() => setAreaTool('select')}>SELECT</button>
                    <button type="button" className={areaTool === 'rectangle' ? 'is-active' : ''} onClick={() => setAreaTool('rectangle')}>RECT</button>
                    <button type="button" className={areaTool === 'circle' ? 'is-active' : ''} onClick={() => setAreaTool('circle')}>CIRCLE</button>
                    <button type="button" onClick={addArea}>+ AREA</button>
                    <button type="button" onClick={() => { setAreaZoom(1); setAreaPan({ x: 0, y: 0 }); }}>FIT</button>
                    <span>Alt + wheel = zoom, middle mouse drag = pan, hold left click + move = move marker, hold left click + wheel = resize marker</span>
                  </div>
                  <div
                    ref={areaCanvasRef}
                    className="city-canvas-viewport"
                    onWheel={handleAreaCanvasWheel}
                    onPointerDown={handleAreaCanvasPointerDown}
                    onPointerMove={handleAreaCanvasPointerMove}
                    onPointerUp={stopAreaDrag}
                    onPointerCancel={stopAreaDrag}
                  >
                    <div
                      className="city-canvas-stage"
                      style={{
                        transform: `translate(${areaPan.x}px, ${areaPan.y}px) scale(${areaZoom})`,
                        ...(previewUrl ? { backgroundImage: `url("${previewUrl}")` } : {}),
                      }}
                    >
                      {!previewUrl ? <div className="city-canvas-empty">Выберите изображение локации во вкладке состояний</div> : null}
                      {(draft.areas ?? []).map((area) => {
                        if (area.shapeType === 'none' || !area.shape) return null;
                        const selected = area.id === selectedArea?.id;
                        const shape = area.shape;
                        const common: CSSProperties = { left: `${shape.x ?? 0}px`, top: `${shape.y ?? 0}px` };

                        if (area.shapeType === 'circle') {
                          const radius = shape.radius ?? 42;
                          return (
                            <button
                              key={area.id}
                              type="button"
                              className={`city-location-shape city-location-circle ${selected ? 'is-selected' : ''}`}
                              style={{ ...common, width: `${radius * 2}px`, height: `${radius * 2}px` }}
                              onPointerDown={(event) => {
                                if (event.button !== 0 || areaTool !== 'select') return;
                                event.preventDefault();
                                event.stopPropagation();
                                setSelectedAreaId(area.id);
                                setDragAreaId(area.id);
                                setDragAreaPointerId(event.pointerId);
                                setDragAreaStart({
                                  x: event.clientX,
                                  y: event.clientY,
                                  shapeX: shape.x ?? 0,
                                  shapeY: shape.y ?? 0,
                                  shape: structuredClone(shape),
                                });
                                event.currentTarget.setPointerCapture(event.pointerId);
                              }}
                              onWheel={(event) => {
                                if (dragAreaId !== area.id || dragAreaPointerId === null) return;
                                event.preventDefault();
                                event.stopPropagation();
                                const direction = event.deltaY > 0 ? -1 : 1;
                                patchArea(area.id, { shape: { ...shape, radius: clamp((shape.radius ?? 42) + direction * 6, 18, 240) } });
                              }}
                              onClick={() => setSelectedAreaId(area.id)}
                            >
                              <span className="city-location-label">{area.name}</span>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={area.id}
                            type="button"
                            className={`city-location-shape city-location-rect ${selected ? 'is-selected' : ''}`}
                            style={{ ...common, width: `${shape.width ?? 140}px`, height: `${shape.height ?? 84}px` }}
                            onPointerDown={(event) => {
                              if (event.button !== 0 || areaTool !== 'select') return;
                              event.preventDefault();
                              event.stopPropagation();
                              setSelectedAreaId(area.id);
                              setDragAreaId(area.id);
                              setDragAreaPointerId(event.pointerId);
                              setDragAreaStart({
                                x: event.clientX,
                                y: event.clientY,
                                shapeX: shape.x ?? 0,
                                shapeY: shape.y ?? 0,
                                shape: structuredClone(shape),
                              });
                              event.currentTarget.setPointerCapture(event.pointerId);
                            }}
                            onWheel={(event) => {
                              if (dragAreaId !== area.id || dragAreaPointerId === null) return;
                              event.preventDefault();
                              event.stopPropagation();
                              const direction = event.deltaY > 0 ? -1 : 1;
                              const scale = 1 + direction * 0.08;
                              patchArea(area.id, {
                                shape: {
                                  ...shape,
                                  width: clamp(Math.round((shape.width ?? 140) * scale), 60, 520),
                                  height: clamp(Math.round((shape.height ?? 84) * scale), 40, 360),
                                },
                              });
                            }}
                            onClick={() => setSelectedAreaId(area.id)}
                          >
                            <span className="city-location-label">{area.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <div className="location-area-lower">
                  <section className="location-area-sidebar card">
                    <div className="admin-actions-row">
                      <button type="button" onClick={addArea}>+ Добавить место</button>
                      <button type="button" onClick={duplicateArea} disabled={!selectedArea}>Дублировать</button>
                      <button type="button" onClick={deleteArea} disabled={!selectedArea}>Удалить</button>
                    </div>
                    <div className="admin-location-areas-list">
                      {(draft.areas ?? []).map((area) => (
                        <button key={area.id} type="button" className={`admin-area-card ${selectedAreaId === area.id ? 'is-active' : ''}`} onClick={() => setSelectedAreaId(area.id)}>
                          <strong>{area.name}</strong>
                          <span>{area.id}</span>
                          <span>{area.type || area.shapeType || '—'}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="location-area-detail card">
                    {selectedArea ? (
                      <AreaEditor area={selectedArea} images={images} onPatch={(patch) => patchArea(selectedArea.id, patch)} onUploadImage={(event) => { void uploadAreaImage(selectedArea.id, event); }} />
                    ) : (
                      <div className="admin-empty-state">
                        <h3>Внутреннее место не выбрано</h3>
                        <p className="muted">Добавьте первое место или выберите существующее из списка слева.</p>
                        <button type="button" onClick={addArea}>Создать место</button>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}
            {tab === 'npcs' && <div className="admin-stack"><label><span>NPC IDs</span><input value={joinCsv(draft.npcIds)} onChange={(event) => patchReferenceList('npcIds', event.target.value)} /></label>{renderReferenceButtons(npcs, draft.npcIds ?? [], 'npcIds')}</div>}
            {tab === 'merchants' && <div className="admin-stack"><label><span>Merchant IDs</span><input value={joinCsv(draft.merchantIds)} onChange={(event) => patchReferenceList('merchantIds', event.target.value)} /></label>{renderReferenceButtons(merchants, draft.merchantIds ?? [], 'merchantIds')}</div>}
            {tab === 'quests' && <div className="admin-stack"><label><span>Quest IDs</span><input value={joinCsv(draft.questIds)} onChange={(event) => patchReferenceList('questIds', event.target.value)} /></label>{renderReferenceButtons(quests, draft.questIds ?? [], 'questIds')}</div>}
            {tab === 'dialogues' && <div className="admin-stack"><label><span>Dialogue IDs</span><input value={joinCsv(draft.dialogueIds)} onChange={(event) => patchReferenceList('dialogueIds', event.target.value)} /></label>{renderReferenceButtons(dialogues, draft.dialogueIds ?? [], 'dialogueIds')}</div>}
            {tab === 'battleMaps' && <div className="admin-stack"><label><span>Battle Map IDs</span><input value={joinCsv(draft.battleMapIds)} onChange={(event) => patchReferenceList('battleMapIds', event.target.value)} /></label>{renderReferenceButtons(battleMaps, draft.battleMapIds ?? [], 'battleMapIds')}</div>}

            {tab === 'requirements' && (
              <div className="admin-form-grid">
                <label><span>Min level</span><input type="number" value={requirements.minLevel ?? ''} onChange={(event) => patchRequirements({ ...requirements, minLevel: event.target.value ? Number(event.target.value) : undefined })} /></label>
                <label><span>Required quest ID</span><input value={requirements.requiredQuestId ?? ''} onChange={(event) => patchRequirements({ ...requirements, requiredQuestId: event.target.value || undefined })} /></label>
                <label><span>Required completed quest ID</span><input value={requirements.requiredCompletedQuestId ?? ''} onChange={(event) => patchRequirements({ ...requirements, requiredCompletedQuestId: event.target.value || undefined })} /></label>
                <label><span>Required item IDs</span><input value={joinCsv(requirements.requiredItemIds)} onChange={(event) => patchRequirements({ ...requirements, requiredItemIds: splitCsv(event.target.value) })} /></label>
                <label><span>Required faction ID</span><input value={requirements.requiredFactionId ?? ''} onChange={(event) => patchRequirements({ ...requirements, requiredFactionId: event.target.value || undefined })} /></label>
                <label><span>Required faction reputation</span><input type="number" value={requirements.requiredFactionReputation ?? ''} onChange={(event) => patchRequirements({ ...requirements, requiredFactionReputation: event.target.value ? Number(event.target.value) : undefined })} /></label>
                <label><span>Required races</span><input value={joinCsv(requirements.requiredRace)} onChange={(event) => patchRequirements({ ...requirements, requiredRace: splitCsv(event.target.value) })} /></label>
                <label><span>Required classes</span><input value={joinCsv(requirements.requiredClass)} onChange={(event) => patchRequirements({ ...requirements, requiredClass: splitCsv(event.target.value) })} /></label>
                <label><span>Required professions</span><input value={joinCsv(requirements.requiredProfession)} onChange={(event) => patchRequirements({ ...requirements, requiredProfession: splitCsv(event.target.value) })} /></label>
                <label><span>Required flag</span><input value={requirements.requiredFlag ?? ''} onChange={(event) => patchRequirements({ ...requirements, requiredFlag: event.target.value || undefined })} /></label>
              </div>
            )}

            {tab === 'effects' && (
              <div className="admin-stack">
                <button type="button" onClick={() => patchEffects([...(draft.locationEffects ?? []), createLocationEffect()])}>+ Добавить эффект</button>
                {(draft.locationEffects ?? []).map((effect, index) => (
                  <div key={`${effect.type}-${index}`} className="card admin-inline-card">
                    <div className="admin-form-grid">
                      <label><span>Type</span><input value={effect.type} onChange={(event) => patchEffects((draft.locationEffects ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, type: event.target.value } : entry))} /></label>
                      <label><span>Value</span><input type="number" value={effect.value ?? ''} onChange={(event) => patchEffects((draft.locationEffects ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, value: event.target.value ? Number(event.target.value) : undefined } : entry))} /></label>
                      <label><span>Stat</span><input value={effect.stat ?? ''} onChange={(event) => patchEffects((draft.locationEffects ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, stat: event.target.value || undefined } : entry))} /></label>
                      <label><span>Element</span><input value={effect.element ?? ''} onChange={(event) => patchEffects((draft.locationEffects ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, element: event.target.value || undefined } : entry))} /></label>
                      <label className="admin-form-grid full-width"><span>Description</span><textarea rows={2} value={effect.description ?? ''} onChange={(event) => patchEffects((draft.locationEffects ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, description: event.target.value || undefined } : entry))} /></label>
                    </div>
                    <button type="button" onClick={() => patchEffects((draft.locationEffects ?? []).filter((_, entryIndex) => entryIndex !== index))}>Удалить эффект</button>
                  </div>
                ))}
              </div>
            )}

            {tab === 'json' && (
              <div className="admin-stack">
                <textarea rows={24} value={jsonDraft} onChange={(event) => setJsonDraft(event.target.value)} />
                <div className="admin-actions-row">
                  <button type="button" onClick={() => { void navigator.clipboard.writeText(jsonDraft); }}>Copy JSON</button>
                  <button type="button" onClick={validateJsonDraft}>Validate</button>
                  <button type="button" onClick={applyJsonDraft}>Import JSON</button>
                  <button type="button" onClick={() => setJsonDraft(JSON.stringify(draft, null, 2))}>Export JSON</button>
                </div>
              </div>
            )}
            </div>

            <div className="admin-actions-row admin-location-editor-actions">
              <button type="button" onClick={() => { void saveLocation(); }}>Сохранить</button>
            </div>
          </>
        ) : (
          <div className="card admin-empty-state">
            <h3>Локация не выбрана</h3>
            <p className="muted">Создайте или выберите локацию из списка слева.</p>
            <button type="button" onClick={addLocation}>Создать локацию</button>
          </div>
        )}

        <p className="muted">{status}</p>
      </section>
    </div>
  );
}
