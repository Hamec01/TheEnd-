import { useEffect, useMemo, useRef, useState } from 'react';
import { audioService } from '../../services/content/audioService';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import {
  downloadCollectionJson,
  extractRawCollectionFromImportJson,
  importCollectionFromJsonEntries,
  type JsonImportResult,
} from '../../services/content/adminJsonImportExport';
import {
  emptySound,
  normalizeSound,
  SOUND_CATEGORIES,
  SOUND_CATEGORY_LABELS,
  SOUND_KINDS,
  SOUND_KIND_LABELS,
  soundsService,
  validateSound,
} from '../../services/content/soundsService';
import type { SoundDefinition, SoundCategory, SoundKind } from '../../services/content/models';
import { AdminFieldLabel, translateAdminErrorMessage } from '../adminUi';
import { SoundSlotsPanel } from './SoundSlotsPanel';
import {
  getContentSnapshot,
  listAudioAssets,
  getWorldMapContent,
  saveWorldMapContent,
  getContentEntry,
  updateContentEntry,
  type ContentSnapshot,
} from '../../services/content/contentApi';

// ─── helpers & types ──────────────────────────────────────────────────────────

export interface LegacySoundReference {
  id: string;
  name: string;
  source: 'legacy';
  category: SoundCategory;
  kind: SoundKind;
  assetUrl?: string;
  assetKey?: string;

  ownerCollection: string;
  ownerId: string;
  ownerName?: string;
  fieldPath: string;

  canReplace: boolean;
}

export type SoundSource = 'registry' | 'legacy' | 'asset_only';

export interface CombinedSound {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'disabled';
  category: SoundCategory;
  kind: SoundKind;
  description?: string;
  assetUrl: string;
  assetKey?: string;
  volume?: number;
  loop?: boolean;
  randomPitch?: boolean;
  pitchMin?: number;
  pitchMax?: number;
  cooldownMs?: number;
  tags?: string[];
  bindings?: any[];
  adminNotes?: string;

  source: SoundSource;
  legacyReference?: LegacySoundReference;
  problems?: string[];
}

function isDirectAudioSource(src: string | undefined): boolean {
  if (!src) return false;
  const s = src.trim();
  return s.startsWith('/') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:audio/');
}

function findSoundStrings(obj: any, path: string = ''): Array<{ path: string, value: string }> {
  const results: Array<{ path: string, value: string }> = [];
  if (!obj || typeof obj !== 'object') return results;
  
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const currentPath = path ? `${path}.${key}` : key;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      const isSound = trimmed.startsWith('/') && 
                      (/\.(mp3|ogg|wav|m4a|webm)$/i.test(trimmed) || trimmed.includes('/assets/upload/audio/') || trimmed.includes('/audio/'));
      if (isSound) {
        results.push({ path: currentPath, value: trimmed });
      }
    } else if (typeof val === 'object' && val !== null) {
      results.push(...findSoundStrings(val, currentPath));
    }
  }
  return results;
}

function inferCategoryFromPath(url: string): SoundCategory {
  const lower = url.toLowerCase();
  if (lower.includes('/steps/') || lower.includes('/footsteps/')) return 'footsteps';
  if (lower.includes('/ui/') || lower.includes('/interface/')) return 'ui';
  if (lower.includes('/combat/') || lower.includes('/battle/')) return 'combat';
  if (lower.includes('/weapons/') || lower.includes('/weapon/')) return 'weapons';
  if (lower.includes('/magic/') || lower.includes('/spells/')) return 'magic';
  if (lower.includes('/skills/') || lower.includes('/skill/')) return 'skills';
  if (lower.includes('/items/') || lower.includes('/item/')) return 'items';
  if (lower.includes('/inventory/')) return 'inventory';
  if (lower.includes('/quests/') || lower.includes('/quest/')) return 'quests';
  if (lower.includes('/dialogues/') || lower.includes('/dialogue/')) return 'dialogues';
  if (lower.includes('/npc/') || lower.includes('/npcs/')) return 'npc';
  if (lower.includes('/cities/') || lower.includes('/city/')) return 'cities';
  if (lower.includes('/kingdoms/') || lower.includes('/kingdom/')) return 'kingdoms';
  if (lower.includes('/locations/') || lower.includes('/location/')) return 'locations';
  if (lower.includes('/battle_maps/') || lower.includes('/battlemaps/')) return 'battle_maps';
  if (lower.includes('/ambient/')) return 'ambient';
  if (lower.includes('/weather/')) return 'weather';
  if (lower.includes('/resources/')) return 'resources';
  if (lower.includes('/events/')) return 'events';
  return 'ui';
}

function collectLegacySounds(snapshot: ContentSnapshot, registrySounds: SoundDefinition[]): LegacySoundReference[] {
  const result: LegacySoundReference[] = [];
  const registryIds = new Set(registrySounds.map((s) => s.id));
  
  // 1. Scan Cities
  if (Array.isArray(snapshot.cities)) {
    for (const city of snapshot.cities) {
      if (city.music) {
        if (city.music.url) {
          result.push({
            id: city.music.assetId || `legacy_city_music_${city.id}`,
            name: `Музыка города: ${city.name}`,
            source: 'legacy',
            category: 'cities',
            kind: 'music',
            assetUrl: city.music.url,
            assetKey: city.music.assetId,
            ownerCollection: 'cities',
            ownerId: city.id,
            ownerName: city.name,
            fieldPath: 'music.url',
            canReplace: true,
          });
        }
        if (Array.isArray((city.music as any).urls)) {
          (city.music as any).urls.forEach((url: string, index: number) => {
            if (url) {
              const specAssetId = (city.music as any).assetIds?.[index];
              const baseAssetId = city.music?.assetId;
              const generatedId = baseAssetId
                ? (index === 0 ? baseAssetId : `${baseAssetId}_track${index + 1}`)
                : `legacy_city_music_${city.id}_${index}`;
              const assetId = specAssetId || generatedId;
              result.push({
                id: assetId,
                name: `Музыка города: ${city.name} (${index + 1})`,
                source: 'legacy',
                category: 'cities',
                kind: 'music',
                assetUrl: url,
                assetKey: specAssetId || baseAssetId || assetId,
                ownerCollection: 'cities',
                ownerId: city.id,
                ownerName: city.name,
                fieldPath: `music.urls.${index}`,
                canReplace: true,
              });
            }
          });
        }
      }
      if (city.ambientSound?.url) {
        result.push({
          id: city.ambientSound.assetId || `legacy_city_ambient_${city.id}`,
          name: `Окружение города: ${city.name}`,
          source: 'legacy',
          category: 'cities',
          kind: 'ambient',
          assetUrl: city.ambientSound.url,
          assetKey: city.ambientSound.assetId,
          ownerCollection: 'cities',
          ownerId: city.id,
          ownerName: city.name,
          fieldPath: 'ambientSound.url',
          canReplace: true,
        });
      }
      if (Array.isArray(city.locations)) {
        city.locations.forEach((loc: any, index: number) => {
          if (loc.music?.url) {
            result.push({
              id: loc.music.assetId || `legacy_city_loc_music_${city.id}_${loc.id}`,
              name: `Музыка локации: ${loc.name} (${city.name})`,
              source: 'legacy',
              category: 'locations',
              kind: 'music',
              assetUrl: loc.music.url,
              assetKey: loc.music.assetId,
              ownerCollection: 'cities',
              ownerId: city.id,
              ownerName: `${city.name} -> ${loc.name}`,
              fieldPath: `locations.${index}.music.url`,
              canReplace: true,
            });
          }
          if (loc.ambientSound?.url) {
            result.push({
              id: loc.ambientSound.assetId || `legacy_city_loc_ambient_${city.id}_${loc.id}`,
              name: `Окружение локации: ${loc.name} (${city.name})`,
              source: 'legacy',
              category: 'locations',
              kind: 'ambient',
              assetUrl: loc.ambientSound.url,
              assetKey: loc.ambientSound.assetId,
              ownerCollection: 'cities',
              ownerId: city.id,
              ownerName: `${city.name} -> ${loc.name}`,
              fieldPath: `locations.${index}.ambientSound.url`,
              canReplace: true,
            });
          }
        });
      }
    }
  }

  // 2. Scan World Map Zones
  if (snapshot.worldMap && Array.isArray(snapshot.worldMap.zones)) {
    for (const zone of snapshot.worldMap.zones) {
      const isKingdom = zone.type === 'kingdom_area';
      const category = isKingdom ? 'kingdoms' : 'locations';
      if (zone.music) {
        if (zone.music.url) {
          result.push({
            id: zone.music.assetId || `legacy_zone_music_${zone.id}`,
            name: `${isKingdom ? 'Тема королевства' : 'Музыка зоны'}: ${zone.name}`,
            source: 'legacy',
            category: category,
            kind: 'music',
            assetUrl: zone.music.url,
            assetKey: zone.music.assetId,
            ownerCollection: 'worldMapZones',
            ownerId: zone.id,
            ownerName: zone.name,
            fieldPath: 'music.url',
            canReplace: true,
          });
        }
        if (Array.isArray((zone.music as any).urls)) {
          (zone.music as any).urls.forEach((url: string, index: number) => {
            if (url) {
              const specAssetId = (zone.music as any)?.assetIds?.[index];
              const baseAssetId = zone.music?.assetId;
              const generatedId = baseAssetId
                ? (index === 0 ? baseAssetId : `${baseAssetId}_track${index + 1}`)
                : `legacy_zone_music_${zone.id}_${index}`;
              const assetId = specAssetId || generatedId;
              result.push({
                id: assetId,
                name: `${isKingdom ? 'Тема королевства' : 'Музыка зоны'}: ${zone.name} (${index + 1})`,
                source: 'legacy',
                category: category,
                kind: 'music',
                assetUrl: url,
                assetKey: specAssetId || baseAssetId || assetId,
                ownerCollection: 'worldMapZones',
                ownerId: zone.id,
                ownerName: zone.name,
                fieldPath: `music.urls.${index}`,
                canReplace: true,
              });
            }
          });
        }
      }
      if (zone.ambientSound?.url) {
        result.push({
          id: zone.ambientSound.assetId || `legacy_zone_ambient_${zone.id}`,
          name: `Окружение зоны: ${zone.name}`,
          source: 'legacy',
          category: 'locations',
          kind: 'ambient',
          assetUrl: zone.ambientSound.url,
          assetKey: zone.ambientSound.assetId,
          ownerCollection: 'worldMapZones',
          ownerId: zone.id,
          ownerName: zone.name,
          fieldPath: 'ambientSound.url',
          canReplace: true,
        });
      }
    }
  }

  // 3. Scan Battle Maps
  if (Array.isArray(snapshot.battleMaps)) {
    for (const map of snapshot.battleMaps) {
      if (map.musicUrl) {
        result.push({
          id: map.musicAssetId || `legacy_battle_map_music_${map.id}`,
          name: `Музыка карты боя: ${map.name}`,
          source: 'legacy',
          category: 'battle_maps',
          kind: 'music',
          assetUrl: map.musicUrl,
          assetKey: map.musicAssetId,
          ownerCollection: 'battleMaps',
          ownerId: map.id,
          ownerName: map.name,
          fieldPath: 'musicUrl',
          canReplace: true,
        });
      }
      if (map.ambientUrl) {
        result.push({
          id: map.ambientAssetId || `legacy_battle_map_ambient_${map.id}`,
          name: `Окружение карты боя: ${map.name}`,
          source: 'legacy',
          category: 'battle_maps',
          kind: 'ambient',
          assetUrl: map.ambientUrl,
          assetKey: map.ambientAssetId,
          ownerCollection: 'battleMaps',
          ownerId: map.id,
          ownerName: map.name,
          fieldPath: 'ambientUrl',
          canReplace: true,
        });
      }
    }
  }

  // 4. Scan Skills
  if (Array.isArray(snapshot.skills)) {
    for (const skill of snapshot.skills) {
      const visuals = skill.visuals || (skill as any).visualConfig;
      if (visuals) {
        if (visuals.castSoundId) {
          result.push({
            id: visuals.castSoundId,
            name: `Звук каста навыка: ${skill.name}`,
            source: 'legacy',
            category: 'skills',
            kind: 'sfx',
            assetKey: visuals.castSoundId,
            ownerCollection: 'skills',
            ownerId: skill.id,
            ownerName: skill.name,
            fieldPath: skill.visuals ? 'visuals.castSoundId' : 'visualConfig.castSoundId',
            canReplace: false,
          });
        }
        if (visuals.impactSoundId) {
          result.push({
            id: visuals.impactSoundId,
            name: `Звук удара навыка: ${skill.name}`,
            source: 'legacy',
            category: 'skills',
            kind: 'sfx',
            assetKey: visuals.impactSoundId,
            ownerCollection: 'skills',
            ownerId: skill.id,
            ownerName: skill.name,
            fieldPath: skill.visuals ? 'visuals.impactSoundId' : 'visualConfig.impactSoundId',
            canReplace: false,
          });
        }
      }
    }
  }

  // 5. Scan Items
  if (Array.isArray(snapshot.items)) {
    for (const item of snapshot.items) {
      if (item.battleVisuals) {
        if (item.battleVisuals.castSoundId) {
          result.push({
            id: item.battleVisuals.castSoundId,
            name: `Звук каста предмета: ${item.name}`,
            source: 'legacy',
            category: 'items',
            kind: 'sfx',
            assetKey: item.battleVisuals.castSoundId,
            ownerCollection: 'items',
            ownerId: item.id,
            ownerName: item.name,
            fieldPath: 'battleVisuals.castSoundId',
            canReplace: false,
          });
        }
        if (item.battleVisuals.impactSoundId) {
          result.push({
            id: item.battleVisuals.impactSoundId,
            name: `Звук удара предмета: ${item.name}`,
            source: 'legacy',
            category: 'items',
            kind: 'sfx',
            assetKey: item.battleVisuals.impactSoundId,
            ownerCollection: 'items',
            ownerId: item.id,
            ownerName: item.name,
            fieldPath: 'battleVisuals.impactSoundId',
            canReplace: false,
          });
        }
      }
    }
  }

  // 6. Scan VisualFx
  if (Array.isArray(snapshot.visualFx)) {
    for (const fx of snapshot.visualFx) {
      if (fx.audio?.defaultSoundId) {
        const soundId = fx.audio.defaultSoundId;
        const isUrl = soundId.startsWith('/') || soundId.includes('.');
        result.push({
          id: isUrl ? `legacy_fx_${fx.id}` : soundId,
          name: `Звук эффекта: ${fx.name}`,
          source: 'legacy',
          category: 'combat',
          kind: 'sfx',
          assetUrl: isUrl ? soundId : undefined,
          assetKey: isUrl ? undefined : soundId,
          ownerCollection: 'visualFx',
          ownerId: fx.id,
          ownerName: fx.name,
          fieldPath: 'audio.defaultSoundId',
          canReplace: isUrl,
        });
      }
    }
  }

  // 7. Generic Scanner
  const collectionsToScan: Array<{ key: string; name: string }> = [
    { key: 'npcs', name: 'NPC' },
    { key: 'dialogues', name: 'Диалог' },
    { key: 'quests', name: 'Квест' },
    { key: 'questInteractions', name: 'Интеракция квеста' },
  ];

  collectionsToScan.forEach(({ key, name: collLabel }) => {
    const coll = (snapshot as any)[key];
    if (Array.isArray(coll)) {
      coll.forEach((entity: any) => {
        const found = findSoundStrings(entity);
        found.forEach(({ path, value }) => {
          let category: SoundCategory = 'ui';
          if (path.toLowerCase().includes('step') || value.toLowerCase().includes('step')) category = 'footsteps';
          else if (path.toLowerCase().includes('dialogue') || key === 'dialogues') category = 'dialogues';
          else if (path.toLowerCase().includes('quest') || key === 'quests') category = 'quests';
          else if (path.toLowerCase().includes('npc') || key === 'npcs') category = 'npc';

          result.push({
            id: `legacy_${key}_${entity.id}_${path.replace(/\./g, '_')}`,
            name: `Звук в ${collLabel}: ${entity.name || entity.id} (${path})`,
            source: 'legacy',
            category,
            kind: value.includes('/music/') ? 'music' : 'sfx',
            assetUrl: value,
            ownerCollection: key,
            ownerId: entity.id,
            ownerName: entity.name || entity.id,
            fieldPath: path,
            canReplace: true,
          });
        });
      });
    }
  });

  for (const ref of result) {
    if (!ref.assetUrl && ref.assetKey) {
      const reg = registrySounds.find((s) => s.id === ref.assetKey);
      if (reg) {
        ref.assetUrl = reg.assetUrl;
        ref.canReplace = true;
      } else {
        const other = result.find((r) => r.assetKey === ref.assetKey && r.assetUrl);
        if (other) {
          ref.assetUrl = other.assetUrl;
          ref.canReplace = true;
        }
      }
    }
  }

  // Deduplicate by owner + fieldPath
  const seen = new Set<string>();
  return result.filter((ref) => {
    const key = `${ref.ownerCollection}::${ref.ownerId}::${ref.fieldPath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function setByPath(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      const nextPart = parts[i + 1];
      const isNextNumber = /^\d+$/.test(nextPart);
      current[part] = isNextNumber ? [] : {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

// ─── Filter / List ─────────────────────────────────────────────────────────────

interface SoundFilters {
  search: string;
  category: '' | SoundCategory;
  kind: '' | SoundKind;
  status: '' | 'active' | 'draft' | 'disabled';
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type SoundsTab = 'slots' | 'editor';
type SourceFilter = 'all' | 'registry' | 'legacy' | 'asset_only' | 'problems';

export function SoundsPage() {
  const [activeTab, setActiveTab] = useState<SoundsTab>('slots');
  const [registrySounds, setRegistrySounds] = useState<SoundDefinition[]>([]);
  const [legacySounds, setLegacySounds] = useState<LegacySoundReference[]>([]);
  const [assetOnlySounds, setAssetOnlySounds] = useState<CombinedSound[]>([]);
  const [scannedAssets, setScannedAssets] = useState<string[]>([]);
  const [snapshot, setSnapshot] = useState<ContentSnapshot | null>(null);

  const [selected, setSelected] = useState<CombinedSound | null>(null);
  const [draft, setDraft] = useState<CombinedSound>({
    ...emptySound(),
    source: 'registry',
  });
  const [isCreating, setCreating] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState('Готово.');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [filters, setFilters] = useState<SoundFilters>({ search: '', category: '', kind: '', status: '' });
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [isUploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<JsonImportResult | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [bindingsText, setBindingsText] = useState('[]');

  // ── load ──
  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsBusy(true);
    try {
      const regSounds = await soundsService.getAll();
      setRegistrySounds(regSounds);
      
      const snap = await getContentSnapshot();
      setSnapshot(snap);

      const assets = await listAudioAssets();
      setScannedAssets(assets);

      const collectedLegacy = collectLegacySounds(snap, regSounds);
      setLegacySounds(collectedLegacy);

      const usedUrls = new Set<string>();
      regSounds.forEach((s) => {
        if (s.assetUrl) usedUrls.add(s.assetUrl.trim().toLowerCase());
      });
      collectedLegacy.forEach((l) => {
        if (l.assetUrl) usedUrls.add(l.assetUrl.trim().toLowerCase());
      });

      const inferredAssetOnly = assets
        .filter((url) => !usedUrls.has(url.trim().toLowerCase()))
        .map((url) => {
          const filename = url.split('/').pop() || url;
          return {
            id: filename,
            name: filename,
            status: 'active' as const,
            category: inferCategoryFromPath(url),
            kind: url.includes('/music/') ? ('music' as const) : ('sfx' as const),
            assetUrl: url,
            source: 'asset_only' as const,
          };
        });
      setAssetOnlySounds(inferredAssetOnly);

      setStatus(`Загружено: ${regSounds.length} реестровых, ${collectedLegacy.length} legacy, ${inferredAssetOnly.length} ассетов.`);
    } catch (err) {
      setStatus(translateAdminErrorMessage((err as Error).message));
    } finally {
      setIsBusy(false);
    }
  }

  // ── combined view memo ──
  const allCombinedSounds = useMemo(() => {
    const registryCombined: CombinedSound[] = registrySounds.map((s) => ({
      ...s,
      source: 'registry',
    }));

    const legacyCombined: CombinedSound[] = legacySounds.map((ref) => ({
      id: ref.id,
      name: ref.name,
      status: 'active',
      category: ref.category,
      kind: ref.kind,
      assetUrl: ref.assetUrl || '',
      assetKey: ref.assetKey,
      source: 'legacy',
      legacyReference: ref,
    }));

    const list = [...registryCombined, ...legacyCombined, ...assetOnlySounds];

    const registryIds = new Set(registrySounds.map((s) => s.id));
    const scannedAssetsLower = new Set(scannedAssets.map((a) => a.trim().toLowerCase()));

    return list.map((sound) => {
      const problems: string[] = [];

      if (sound.source === 'registry') {
        const dupes = registrySounds.filter((s) => s.id === sound.id).length;
        if (dupes > 1) {
          problems.push(`Дубликат ID в реестре (${dupes} совпадений)`);
        }
      }

      if (!sound.assetUrl) {
        problems.push('Пустой Asset URL');
      } else {
        const fileExists = scannedAssetsLower.has(sound.assetUrl.trim().toLowerCase());
        if (!fileExists) {
          problems.push(`Файл звука не найден на диске: ${sound.assetUrl}`);
        }
      }

      if (sound.source === 'legacy' && sound.legacyReference) {
        const ref = sound.legacyReference;
        if (ref.assetKey && !registryIds.has(ref.assetKey)) {
          problems.push(`Указывает на несуществующий в реестре Sound ID: ${ref.assetKey}`);
        }
      }

      return {
        ...sound,
        problems: problems.length > 0 ? problems : undefined,
      };
    });
  }, [registrySounds, legacySounds, assetOnlySounds, scannedAssets]);

  const filteredCombinedSounds = useMemo(() => {
    return allCombinedSounds.filter((sound) => {
      if (sourceFilter === 'registry' && sound.source !== 'registry') return false;
      if (sourceFilter === 'legacy' && sound.source !== 'legacy') return false;
      if (sourceFilter === 'asset_only' && sound.source !== 'asset_only') return false;
      if (sourceFilter === 'problems' && !sound.problems) return false;

      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchesSearch =
          sound.id.toLowerCase().includes(q) ||
          sound.name.toLowerCase().includes(q) ||
          (sound.legacyReference?.ownerId || '').toLowerCase().includes(q) ||
          (sound.legacyReference?.ownerName || '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (filters.category && sound.category !== filters.category) return false;
      if (filters.kind && sound.kind !== filters.kind) return false;
      if (filters.status && sound.status !== filters.status) return false;

      return true;
    });
  }, [allCombinedSounds, sourceFilter, filters]);

  // ── selection ──
  function selectSound(sound: CombinedSound) {
    setSelected(sound);
    setDraft({ ...sound });
    setCreating(false);
    setValidationErrors([]);
    setValidationWarnings([]);
    setBindingsText(JSON.stringify(sound.bindings ?? [], null, 2));
    stopAudio();
  }

  function startNew() {
    const blank = emptySound();
    setSelected(null);
    setDraft({ ...blank, source: 'registry' });
    setCreating(true);
    setValidationErrors([]);
    setValidationWarnings([]);
    setBindingsText('[]');
    stopAudio();
  }

  function updateDraft<K extends keyof CombinedSound>(key: K, value: CombinedSound[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  // ── audio ──
  function playAudio() {
    const src = draft.assetUrl?.trim();
    if (!src) { setStatus('Нет URL для воспроизведения.'); return; }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = src;
    } else {
      audioRef.current = new Audio(src);
    }
    audioRef.current.volume = draft.volume ?? 1;
    audioRef.current.loop = draft.loop ?? false;
    audioRef.current.onended = () => setPlaying(false);
    void audioRef.current.play().then(() => setPlaying(true)).catch((err: Error) => {
      setStatus(`Ошибка воспроизведения: ${err.message}`);
      setPlaying(false);
    });
  }

  function stopAudio() {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setPlaying(false);
  }

  // ── upload ──
  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setStatus('Загрузка аудио...');
    try {
      const folder = buildUploadFolder('audio', 'urls', draft.category || undefined);
      const uploaded = await audioService.upload(file, { name: draft.name || file.name, folder });
      updateDraft('assetUrl', uploaded.publicUrl);
      if (!draft.assetKey) updateDraft('assetKey', uploaded.assetId);
      setStatus(`Аудио загружено: ${uploaded.publicUrl}`);
    } catch (err) {
      setStatus(translateAdminErrorMessage((err as Error).message));
    } finally {
      setUploading(false);
    }
  }

  // ── replace legacy referenced sound ──
  async function replaceLegacySoundReference(ref: LegacySoundReference, newAssetUrl: string) {
    if (ref.ownerCollection === 'worldMapZones') {
      const worldMap = await getWorldMapContent();
      const zone = worldMap.zones.find((z) => z.id === ref.ownerId);
      if (!zone) throw new Error(`Зона не найдена: ${ref.ownerId}`);
      setByPath(zone, ref.fieldPath, newAssetUrl);
      await saveWorldMapContent(worldMap);
    } else if (ref.ownerCollection === 'cities') {
      const city = await getContentEntry<any>('cities', ref.ownerId);
      if (!city) throw new Error(`Город не найден: ${ref.ownerId}`);
      setByPath(city, ref.fieldPath, newAssetUrl);
      await updateContentEntry<any>('cities', ref.ownerId, city);
    } else {
      const entity = await getContentEntry<any>(ref.ownerCollection as any, ref.ownerId);
      if (!entity) throw new Error(`Сущность не найдена: ${ref.ownerCollection}/${ref.ownerId}`);
      setByPath(entity, ref.fieldPath, newAssetUrl);
      await updateContentEntry<any>(ref.ownerCollection as any, ref.ownerId, entity);
    }
  }

  async function handleLegacyReplace(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selected || !selected.legacyReference) return;
    
    setIsBusy(true);
    setStatus('Загрузка аудио и обновление legacy-ссылки...');
    try {
      const ref = selected.legacyReference;
      const folder = buildUploadFolder('audio', ref.category || undefined);
      const uploaded = await audioService.upload(file, { name: file.name, folder });
      
      await replaceLegacySoundReference(ref, uploaded.publicUrl);
      await load();
      setStatus(`Файл успешно заменен на: ${uploaded.publicUrl}`);
    } catch (err) {
      setStatus(translateAdminErrorMessage((err as Error).message));
    } finally {
      setIsBusy(false);
    }
  }

  // ── convert legacy/asset to registry ──
  function handleCreateRegistryFromLegacy(sound: CombinedSound) {
    if (!sound.legacyReference) return;
    const ref = sound.legacyReference;
    
    const bindings: any[] = [];
    if (ref.ownerCollection === 'worldMapZones') {
      const isKingdom = ref.category === 'kingdoms';
      bindings.push({
        id: `bind_${ref.id}_enter`,
        targetType: isKingdom ? 'kingdom' : 'location',
        targetId: ref.ownerId,
        event: 'enter',
        priority: 10
      });
    } else if (ref.ownerCollection === 'cities') {
      bindings.push({
        id: `bind_${ref.id}_enter`,
        targetType: 'city',
        targetId: ref.ownerId,
        event: 'enter',
        priority: 10
      });
    } else if (ref.ownerCollection === 'battleMaps') {
      bindings.push({
        id: `bind_${ref.id}_enter`,
        targetType: 'battle_map',
        targetId: ref.ownerId,
        event: 'enter',
        priority: 10
      });
    } else if (ref.ownerCollection === 'skills') {
      const isCast = ref.fieldPath.includes('cast');
      bindings.push({
        id: `bind_${ref.id}_${isCast ? 'cast' : 'impact'}`,
        targetType: 'skill',
        targetId: ref.ownerId,
        event: isCast ? 'cast' : 'impact',
        priority: 10
      });
    } else if (ref.ownerCollection === 'items') {
      bindings.push({
        id: `bind_${ref.id}_equip`,
        targetType: 'item',
        targetId: ref.ownerId,
        event: 'equip',
        priority: 10
      });
    }

    const blank = emptySound();
    const newSound: SoundDefinition = {
      ...blank,
      id: ref.id,
      name: ref.name,
      status: 'active',
      category: ref.category,
      kind: ref.kind,
      assetUrl: ref.assetUrl || '',
      assetKey: ref.assetKey || ref.id,
      loop: ref.kind === 'music' || ref.kind === 'ambient',
      bindings,
      adminNotes: `Создано из legacy: ${ref.ownerCollection}/${ref.ownerId} (${ref.fieldPath})`,
    } as any;
    
    setSelected(null);
    setDraft({
      ...newSound,
      source: 'registry',
    });
    setCreating(true);
    setValidationErrors([]);
    setValidationWarnings([]);
    setBindingsText(JSON.stringify(newSound.bindings ?? [], null, 2));
    stopAudio();
  }

  function handleAddAssetOnlyToRegistry(sound: CombinedSound) {
    const filename = sound.assetUrl.split('/').pop() || sound.id;
    const nameWithoutExt = filename.replace(/\.[a-z0-9]+$/i, '');
    const cleanId = nameWithoutExt.toLowerCase().replace(/[^\w.-]+/g, '_');

    const blank = emptySound();
    const newSound: SoundDefinition = {
      ...blank,
      id: cleanId,
      name: nameWithoutExt,
      status: 'active',
      category: sound.category,
      kind: sound.kind,
      assetUrl: sound.assetUrl,
      assetKey: cleanId,
      loop: sound.kind === 'music' || sound.kind === 'ambient',
      bindings: [],
    };

    setSelected(null);
    setDraft({
      ...newSound,
      source: 'registry',
    });
    setCreating(true);
    setValidationErrors([]);
    setValidationWarnings([]);
    setBindingsText('[]');
    stopAudio();
  }

  // ── validate ──
  function runValidation(entry: SoundDefinition): { errors: string[]; warnings: string[] } {
    const errors = validateSound(entry);
    const warnings: string[] = [];
    if (!entry.assetUrl) warnings.push('Asset URL пустой — звук не будет воспроизведён.');
    if (entry.loop && entry.kind === 'sfx') warnings.push('Loop=true для SFX — это необычно. Рекомендуется kind=loop или ambient.');
    if (entry.status === 'active' && !entry.assetUrl) warnings.push('Звук active, но Asset URL пустой.');
    return { errors, warnings };
  }

  // ── save ──
  async function handleSave() {
    let bindings = draft.bindings ?? [];
    try {
      bindings = JSON.parse(bindingsText) as typeof bindings;
    } catch {
      setStatus('Bindings: неверный JSON.');
      return;
    }
    const toSave = normalizeSound({ ...draft, bindings });
    const { errors, warnings } = runValidation(toSave);
    setValidationErrors(errors);
    setValidationWarnings(warnings);
    if (errors.length > 0) {
      setStatus(`Валидация: ${errors.length} ошибок.`);
      return;
    }

    setIsBusy(true);
    try {
      let saved: SoundDefinition;
      if (isCreating) {
        saved = await soundsService.create(toSave);
        setStatus(`Создан: ${saved.id}`);
      } else if (selected) {
        saved = selected.id !== toSave.id
          ? await soundsService.rename(selected.id, toSave.id, toSave)
          : await soundsService.update(toSave.id, toSave);
        setStatus(`Сохранён: ${saved.id}`);
      } else {
        throw new Error('No selected registry sound to save');
      }
      
      await load();
      const combined = { ...saved, source: 'registry' as const };
      setSelected(combined);
      setDraft(combined);
      setCreating(false);
    } catch (err) {
      setStatus(translateAdminErrorMessage((err as Error).message));
    } finally {
      setIsBusy(false);
    }
  }

  // ── duplicate ──
  function handleDuplicate() {
    if (!selected) return;
    const copy = emptySound();
    const d: SoundDefinition = {
      ...selected,
      id: `${selected.id}_copy`,
      name: `${selected.name} (копия)`,
      status: 'draft',
      createdAt: copy.createdAt,
      updatedAt: copy.updatedAt,
    };
    setDraft({ ...d, source: 'registry' });
    setSelected(null);
    setCreating(true);
    setBindingsText(JSON.stringify(d.bindings ?? [], null, 2));
  }

  // ── disable ──
  async function handleDisable() {
    if (!selected) return;
    setIsBusy(true);
    try {
      const updated = await soundsService.update(selected.id, { status: 'disabled' });
      await load();
      const combined = { ...updated, source: 'registry' as const };
      setSelected(combined);
      setDraft(combined);
      setStatus(`Отключён: ${updated.id}`);
    } catch (err) {
      setStatus(translateAdminErrorMessage((err as Error).message));
    } finally {
      setIsBusy(false);
    }
  }

  // ── delete ──
  async function handleDelete() {
    if (!selected) return;
    const msg = `Удалить "${selected.id}"?\n\nЭтот звук может быть привязан к kingdom/city/location/item/skill. Продолжить?`;
    if (!window.confirm(msg)) return;
    setIsBusy(true);
    try {
      await soundsService.delete(selected.id);
      await load();
      setSelected(null);
      setDraft({ ...emptySound(), source: 'registry' });
      setCreating(false);
      setStatus('Удалён.');
    } catch (err) {
      setStatus(translateAdminErrorMessage((err as Error).message));
    } finally {
      setIsBusy(false);
    }
  }

  // ── export JSON ──
  function handleExportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_sounds',
      collectionKey: 'sounds',
      entries: registrySounds,
    });
    setStatus(`Экспортировано ${registrySounds.length} звуков.`);
  }

  // ── import JSON ──
  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsBusy(true);
    setStatus('Импорт...');
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const entries = extractRawCollectionFromImportJson(parsed, 'sounds');
      const result = await importCollectionFromJsonEntries<SoundDefinition>({
        entries,
        defaults: emptySound,
        normalize: normalizeSound,
        validate: (entry) => (!entry.id ? ['Sound id is required.'] : []),
        getAll: () => soundsService.getAll(),
        create: (value) => soundsService.create(value),
        update: (id, value) => soundsService.update(id, value),
      });
      setImportResult(result);
      await load();
      setStatus(`Импорт: создано ${result.created.length}, пропущено ${result.skippedExisting.length}, ошибок ${result.errors.length}.`);
    } catch (err) {
      setStatus(translateAdminErrorMessage((err as Error).message));
    } finally {
      setIsBusy(false);
    }
  }

  // ── validation check button ──
  function handleValidate() {
    const toCheck = normalizeSound({ ...draft });
    const { errors, warnings } = runValidation(toCheck);
    setValidationErrors(errors);
    setValidationWarnings(warnings);
    setStatus(`Проверка: ошибок ${errors.length}, предупреждений ${warnings.length}.`);
  }

  // ── slot saved callback ──
  function handleSlotSaved(sound: SoundDefinition) {
    load();
    setStatus(`Звук сохранён: ${sound.id}`);
  }

  const canPlay = isDirectAudioSource(draft.assetUrl);

  return (
    <div className="admin-sounds-page">

      {/* ── Top bar ── */}
      <div className="admin-sounds-topbar">
        {/* Tabs */}
        <div className="admin-sounds-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'slots'}
            className={`admin-sounds-tab ${activeTab === 'slots' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('slots')}
          >
            🎯 Слоты
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'editor'}
            className={`admin-sounds-tab ${activeTab === 'editor' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            ✏️ Редактор
          </button>
        </div>

        {/* Toolbar buttons */}
        <div className="admin-sounds-toolbar">
          {activeTab === 'editor' && (
            <button type="button" onClick={startNew} disabled={isBusy}>+ Новый звук</button>
          )}
          <button type="button" onClick={handleExportJson} disabled={isBusy}>⬇ Экспорт JSON</button>
          <button type="button" onClick={() => importRef.current?.click()} disabled={isBusy}>⬆ Импорт JSON</button>
          <input ref={importRef} type="file" accept="application/json,.json" onChange={handleImportFile} hidden />
          <button type="button" onClick={load} disabled={isBusy}>↻ Обновить</button>
        </div>
      </div>

      {/* ── TAB: Слоты ── */}
      {activeTab === 'slots' && (
        <SoundSlotsPanel sounds={registrySounds} onSoundSaved={handleSlotSaved} />
      )}

      {/* ── TAB: Редактор ── */}
      {activeTab === 'editor' && (
        <div className="admin-sounds-layout">

          {/* LEFT: list */}
          <aside className="admin-sounds-sidebar">
            <div className="admin-sounds-filters">
              <input
                id="sounds-search"
                type="search"
                placeholder="Поиск по ID / названию"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
              <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value as SoundFilters['category'] }))}>
                <option value="">Все категории</option>
                {SOUND_CATEGORIES.map((c) => <option key={c} value={c}>{SOUND_CATEGORY_LABELS[c]}</option>)}
              </select>
              <select value={filters.kind} onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value as SoundFilters['kind'] }))}>
                <option value="">Все типы</option>
                {SOUND_KINDS.map((k) => <option key={k} value={k}>{SOUND_KIND_LABELS[k]}</option>)}
              </select>
              <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as SoundFilters['status'] }))}>
                <option value="">Все статусы</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            <div className="admin-sounds-source-tabs">
              <button
                type="button"
                className={sourceFilter === 'all' ? 'is-active' : ''}
                onClick={() => setSourceFilter('all')}
              >
                Все
              </button>
              <button
                type="button"
                className={sourceFilter === 'registry' ? 'is-active' : ''}
                onClick={() => setSourceFilter('registry')}
              >
                Registry
              </button>
              <button
                type="button"
                className={sourceFilter === 'legacy' ? 'is-active' : ''}
                onClick={() => setSourceFilter('legacy')}
              >
                Legacy
              </button>
              <button
                type="button"
                className={sourceFilter === 'asset_only' ? 'is-active' : ''}
                onClick={() => setSourceFilter('asset_only')}
              >
                Asset only
              </button>
              <button
                type="button"
                className={sourceFilter === 'problems' ? 'is-active' : ''}
                onClick={() => setSourceFilter('problems')}
              >
                Проблемные
              </button>
            </div>

            <p className="admin-sounds-count muted">{filteredCombinedSounds.length} / {allCombinedSounds.length} звуков</p>

            <div className="admin-sounds-list">
              {filteredCombinedSounds.length === 0 && (
                <p className="muted" style={{ padding: '12px' }}>Нет звуков.</p>
              )}
              {filteredCombinedSounds.map((sound) => {
                const isSelected = selected?.id === sound.id && selected?.source === sound.source;
                return (
                  <button
                    key={`${sound.source}_${sound.id}_${sound.legacyReference?.fieldPath || ''}`}
                    type="button"
                    className={`admin-sounds-card ${isSelected ? 'is-active' : ''}`}
                    onClick={() => selectSound(sound)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span className="admin-sounds-card-name">{sound.name}</span>
                      <span className={`admin-sounds-source-badge source-${sound.source}`}>
                        {sound.source === 'registry' ? 'Registry' : sound.source === 'legacy' ? 'Legacy' : 'Asset Only'}
                      </span>
                    </div>
                    <div className="admin-sounds-card-id muted">{sound.id}</div>
                    
                    {sound.problems && (
                      <div style={{ color: '#ffa0a0', fontSize: '0.72rem', fontWeight: 'bold', margin: '2px 0' }}>
                        ⚠️ Проблемы: {sound.problems.length}
                      </div>
                    )}

                    <div className="admin-sounds-card-meta muted">
                      {SOUND_CATEGORY_LABELS[sound.category]} • {SOUND_KIND_LABELS[sound.kind]}
                      {sound.source === 'registry' && (
                        <span className={`admin-sounds-status admin-sounds-status--${sound.status}`}> {sound.status}</span>
                      )}
                    </div>

                    {sound.source === 'registry' && (sound.bindings?.length ?? 0) > 0 && (
                      <div className="admin-sounds-card-bindings muted">
                        {sound.bindings!.slice(0, 2).map((b) => `${b.targetType}${b.targetId ? `/${b.targetId}` : ''}`).join(', ')}
                        {(sound.bindings!.length > 2) && ` +${sound.bindings!.length - 2}`}
                      </div>
                    )}

                    {sound.source === 'legacy' && sound.legacyReference && (
                      <div className="admin-sounds-card-bindings muted" style={{ color: '#dca888' }}>
                        Owner: {sound.legacyReference.ownerCollection} / {sound.legacyReference.ownerId}
                      </div>
                    )}

                    {sound.source === 'asset_only' && (
                      <div className="admin-sounds-card-bindings muted" style={{ color: '#a0cca0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Path: {sound.assetUrl}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* RIGHT: editor / viewer */}
          <section className="admin-sounds-editor">
            {!isCreating && !selected ? (
              <div className="admin-sounds-empty">
                <p className="muted">Выберите звук из списка или создайте новый.</p>
              </div>
            ) : selected && selected.source === 'legacy' ? (
              // ── LEGACY REFERENCED SOUND VIEW ──
              <>
                <div className="admin-sounds-editor-actions">
                  {registrySounds.some((s) => s.id === selected.id) ? (
                    <span style={{ color: '#5cd65c', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      ✅ Зарегистрирован в реестре
                    </span>
                  ) : (
                    <button type="button" onClick={() => handleCreateRegistryFromLegacy(selected)}>Создать registry-запись</button>
                  )}
                </div>

                {/* Audio preview */}
                {selected.assetUrl && (
                  <div className="admin-sounds-preview-bar">
                    <button type="button" onClick={isPlaying ? stopAudio : playAudio} className="admin-sounds-play-btn">
                      {isPlaying ? '■ Стоп' : '▶ Прослушать'}
                    </button>
                    <audio controls preload="none" src={selected.assetUrl} style={{ flex: 1 }} />
                  </div>
                )}
                {!selected.assetUrl && (
                  <p className="muted" style={{ margin: '8px 0', color: '#ffa0a0' }}>Файл звука не привязан или пустой.</p>
                )}

                <div className="card" style={{ padding: '16px', display: 'grid', gap: '10px', background: 'rgba(28, 22, 16, 0.86)', border: '1px solid rgba(166, 132, 82, 0.5)', borderRadius: '8px' }}>
                  <h3 style={{ margin: 0, color: '#f2dfbc' }}>Legacy Reference Info</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', fontSize: '0.84rem' }}>
                    <span className="muted">ID:</span>
                    <code style={{ color: '#fff', fontFamily: 'monospace' }}>{selected.id}</code>
                    
                    <span className="muted">Название:</span>
                    <span>{selected.name}</span>

                    <span className="muted">Источник:</span>
                    <span style={{ color: '#ffb366', fontWeight: 'bold' }}>Legacy Referenced</span>

                    <span className="muted">Владелец:</span>
                    <span>
                      <code>{selected.legacyReference?.ownerCollection}</code> / <code>{selected.legacyReference?.ownerId}</code>
                      {selected.legacyReference?.ownerName && ` (${selected.legacyReference.ownerName})`}
                    </span>

                    <span className="muted">Путь в объекте:</span>
                    <code>{selected.legacyReference?.fieldPath}</code>

                    <span className="muted">Asset URL:</span>
                    <code style={{ fontSize: '0.78rem' }}>{selected.assetUrl || '(пусто)'}</code>

                    {selected.assetKey && (
                      <>
                        <span className="muted">Asset Key:</span>
                        <code>{selected.assetKey}</code>
                      </>
                    )}
                  </div>

                  {selected.problems && (
                    <div style={{ border: '1px solid rgba(220, 80, 80, 0.4)', borderRadius: '6px', padding: '8px 12px', background: 'rgba(102, 28, 28, 0.2)', marginTop: '8px' }}>
                      <strong style={{ color: '#ff8080', fontSize: '0.84rem' }}>Проблемы:</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.8rem', color: '#ffc0c0' }}>
                        {selected.problems.map((p, idx) => <li key={idx}>❌ {p}</li>)}
                      </ul>
                    </div>
                  )}

                  {selected.legacyReference?.canReplace ? (
                    <div className="admin-inline-audio-field card" style={{ marginTop: '12px' }}>
                      <div className="admin-inline-image-field-head">
                        <AdminFieldLabel label="Заменить файл" hint="Загружает новый аудио-файл и точечно обновляет поле в БД" />
                        <span className="muted">→ /assets/upload/audio/{selected.category}/</span>
                      </div>
                      <div className="admin-inline-image-field-body">
                        <label className="admin-inline-image-upload">
                          <span>{isBusy ? 'Загрузка...' : 'Выбрать новый файл'}</span>
                          <input type="file" accept="audio/*,.ogg,.mp3,.wav,.m4a" onChange={handleLegacyReplace} disabled={isBusy} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: '#ffa868', fontSize: '0.78rem', marginTop: '10px', margin: 0 }}>
                      ⚠️ Замена файла напрямую недоступна: это поле ссылается на реестровый Sound ID. Найдите и замените соответствующую запись в реестре (Registry).
                    </p>
                  )}
                </div>
              </>
            ) : selected && selected.source === 'asset_only' ? (
              // ── ASSET ONLY VIEW ──
              <>
                <div className="admin-sounds-editor-actions">
                  <button type="button" onClick={() => handleAddAssetOnlyToRegistry(selected)}>Добавить в sounds</button>
                </div>

                {/* Audio preview */}
                <div className="admin-sounds-preview-bar">
                  <button type="button" onClick={isPlaying ? stopAudio : playAudio} className="admin-sounds-play-btn">
                    {isPlaying ? '■ Стоп' : '▶ Прослушать'}
                  </button>
                  <audio controls preload="none" src={selected.assetUrl} style={{ flex: 1 }} />
                </div>

                <div className="card" style={{ padding: '16px', display: 'grid', gap: '10px', background: 'rgba(28, 22, 16, 0.86)', border: '1px solid rgba(166, 132, 82, 0.5)', borderRadius: '8px' }}>
                  <h3 style={{ margin: 0, color: '#f2dfbc' }}>Asset File Info</h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', fontSize: '0.84rem' }}>
                    <span className="muted">Имя файла:</span>
                    <span>{selected.name}</span>

                    <span className="muted">Источник:</span>
                    <span style={{ color: '#5cd65c', fontWeight: 'bold' }}>Asset Only (Не привязан)</span>

                    <span className="muted">Относительный путь:</span>
                    <code style={{ fontSize: '0.78rem' }}>{selected.assetUrl}</code>

                    <span className="muted">Категория (оценка):</span>
                    <span>{SOUND_CATEGORY_LABELS[selected.category]}</span>

                    <span className="muted">Тип (оценка):</span>
                    <span>{SOUND_KIND_LABELS[selected.kind]}</span>
                  </div>
                </div>
              </>
            ) : (
              // ── STANDARD REGISTRY SOUND EDITOR ──
              <>
                <div className="admin-sounds-editor-actions">
                  {isCreating ? (
                    <button type="button" onClick={handleSave} disabled={isBusy}>✓ Создать</button>
                  ) : (
                    <>
                      <button type="button" onClick={handleSave} disabled={isBusy}>✓ Сохранить</button>
                      <button type="button" onClick={handleDuplicate} disabled={isBusy}>⎘ Дублировать</button>
                      <button type="button" onClick={handleDisable} disabled={isBusy || selected?.status === 'disabled'}>⊘ Отключить</button>
                      <button type="button" onClick={handleDelete} disabled={isBusy} className="admin-sounds-danger">✕ Удалить</button>
                    </>
                  )}
                  <button type="button" onClick={handleValidate} disabled={isBusy}>✔ Проверить</button>
                  <button type="button" onClick={handleExportJson} disabled={isBusy || registrySounds.length === 0}>⬇ Экспорт JSON</button>
                </div>

                {/* Audio preview */}
                {canPlay && (
                  <div className="admin-sounds-preview-bar">
                    <button type="button" onClick={isPlaying ? stopAudio : playAudio} className="admin-sounds-play-btn">
                      {isPlaying ? '■ Стоп' : '▶ Прослушать'}
                    </button>
                    <audio controls preload="none" src={draft.assetUrl?.trim()} style={{ flex: 1 }} />
                  </div>
                )}
                {!canPlay && draft.assetUrl?.trim() && (
                  <p className="muted" style={{ margin: '8px 0' }}>URL не похож на прямую ссылку — предпросмотр недоступен.</p>
                )}

                {/* Fields */}
                <div className="admin-sounds-fields">

                  <label className="admin-field-label">
                    <AdminFieldLabel label="ID" hint="Уникальный идентификатор звука. Например: ui_click_01, kingdom_argos_theme" />
                    <input id="sounds-id" value={draft.id} onChange={(e) => updateDraft('id', e.target.value)} placeholder="ui_click_01" disabled={isBusy} />
                  </label>

                  <label className="admin-field-label">
                    <AdminFieldLabel label="Название" hint="Человекочитаемое название звука" />
                    <input id="sounds-name" value={draft.name} onChange={(e) => updateDraft('name', e.target.value)} placeholder="UI Click 01" disabled={isBusy} />
                  </label>

                  <label className="admin-field-label">
                    <AdminFieldLabel label="Статус" hint="active — работает, draft — заготовка, disabled — выключен" />
                    <select id="sounds-status" value={draft.status} onChange={(e) => updateDraft('status', e.target.value as any)} disabled={isBusy}>
                      <option value="draft">draft</option>
                      <option value="active">active</option>
                      <option value="disabled">disabled</option>
                    </select>
                  </label>

                  <label className="admin-field-label">
                    <AdminFieldLabel label="Категория" hint="Категория звука для фильтрации и организации" />
                    <select id="sounds-category" value={draft.category} onChange={(e) => updateDraft('category', e.target.value as SoundCategory)} disabled={isBusy}>
                      {SOUND_CATEGORIES.map((c) => <option key={c} value={c}>{SOUND_CATEGORY_LABELS[c]}</option>)}
                    </select>
                  </label>

                  <label className="admin-field-label">
                    <AdminFieldLabel label="Тип (Kind)" hint="sfx — эффект, music — фоновая музыка, ambient — окружение, voice — голос, loop — зацикленный, one_shot — одиночный" />
                    <select id="sounds-kind" value={draft.kind} onChange={(e) => updateDraft('kind', e.target.value as SoundKind)} disabled={isBusy}>
                      {SOUND_KINDS.map((k) => <option key={k} value={k}>{SOUND_KIND_LABELS[k]}</option>)}
                    </select>
                  </label>

                  <label className="admin-field-label">
                    <AdminFieldLabel label="Описание" hint="Описание назначения звука для администратора" />
                    <textarea id="sounds-description" value={draft.description ?? ''} onChange={(e) => updateDraft('description', e.target.value)} placeholder="Звук клика по кнопке интерфейса" rows={2} disabled={isBusy} />
                  </label>

                  <label className="admin-field-label">
                    <AdminFieldLabel label="Asset URL" hint="Путь к аудио-файлу. Например: /assets/audio/ui/click.ogg" />
                    <input id="sounds-asset-url" value={draft.assetUrl ?? ''} onChange={(e) => updateDraft('assetUrl', e.target.value)} placeholder="/assets/audio/ui/click.ogg" disabled={isBusy} />
                  </label>

                  <label className="admin-field-label">
                    <AdminFieldLabel label="Asset Key (опционально)" hint="Ключ для Phaser / игрового движка" />
                    <input id="sounds-asset-key" value={draft.assetKey ?? ''} onChange={(e) => updateDraft('assetKey', e.target.value)} placeholder="sound_ui_click_01" disabled={isBusy} />
                  </label>

                  <div className="admin-inline-audio-field card">
                    <div className="admin-inline-image-field-head">
                      <AdminFieldLabel label="Загрузить аудио" hint="Загружает .mp3 / .ogg / .wav / .m4a и подставляет URL" />
                      <span className="muted">→ /assets/upload/audio/{draft.category}/</span>
                    </div>
                    <div className="admin-inline-image-field-body">
                      <label className="admin-inline-image-upload">
                        <span>{isUploading ? 'Загрузка...' : 'Выбрать аудио'}</span>
                        <input type="file" accept="audio/*,.ogg,.mp3,.wav,.m4a" onChange={handleUpload} disabled={isUploading || isBusy} />
                      </label>
                    </div>
                  </div>

                  <div className="admin-sounds-row">
                    <label className="admin-field-label">
                      <AdminFieldLabel label="Volume" hint="Громкость от 0 до 1" />
                      <input id="sounds-volume" type="number" min={0} max={1} step={0.1} value={draft.volume ?? 1} onChange={(e) => updateDraft('volume', parseFloat(e.target.value))} disabled={isBusy} />
                    </label>
                    <label className="admin-field-label">
                      <AdminFieldLabel label="Loop" hint="Зациклить воспроизведение" />
                      <input id="sounds-loop" type="checkbox" checked={draft.loop ?? false} onChange={(e) => updateDraft('loop', e.target.checked)} disabled={isBusy} />
                    </label>
                    <label className="admin-field-label">
                      <AdminFieldLabel label="Random Pitch" hint="Случайная высота тона" />
                      <input id="sounds-random-pitch" type="checkbox" checked={draft.randomPitch ?? false} onChange={(e) => updateDraft('randomPitch', e.target.checked)} disabled={isBusy} />
                    </label>
                  </div>

                  {draft.randomPitch && (
                    <div className="admin-sounds-row">
                      <label className="admin-field-label">
                        <AdminFieldLabel label="Pitch Min" hint="Минимальный питч (0.5 = -1 октава)" />
                        <input id="sounds-pitch-min" type="number" min={0.1} max={2} step={0.05} value={draft.pitchMin ?? 0.9} onChange={(e) => updateDraft('pitchMin', parseFloat(e.target.value))} disabled={isBusy} />
                      </label>
                      <label className="admin-field-label">
                        <AdminFieldLabel label="Pitch Max" hint="Максимальный питч (2.0 = +1 октава)" />
                        <input id="sounds-pitch-max" type="number" min={0.1} max={2} step={0.05} value={draft.pitchMax ?? 1.1} onChange={(e) => updateDraft('pitchMax', parseFloat(e.target.value))} disabled={isBusy} />
                      </label>
                    </div>
                  )}

                  <label className="admin-field-label">
                    <AdminFieldLabel label="Cooldown (мс)" hint="Минимальный интервал между воспроизведениями (мс). 0 = без кулдауна" />
                    <input id="sounds-cooldown" type="number" min={0} step={100} value={draft.cooldownMs ?? 0} onChange={(e) => updateDraft('cooldownMs', parseInt(e.target.value) || 0)} disabled={isBusy} />
                  </label>

                  <label className="admin-field-label">
                    <AdminFieldLabel label="Теги" hint="Теги через запятую. Например: grass, outdoor, footstep" />
                    <input id="sounds-tags" value={(draft.tags ?? []).join(', ')} onChange={(e) => updateDraft('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} placeholder="grass, outdoor" disabled={isBusy} />
                  </label>

                  <label className="admin-field-label">
                    <AdminFieldLabel
                      label="Bindings (JSON)"
                      hint='Привязки звука к игровым сущностям. Например: [{"id":"bind_1","targetType":"kingdom","targetId":"argos","event":"enter","priority":10}]'
                    />
                    <textarea id="sounds-bindings" value={bindingsText} onChange={(e) => setBindingsText(e.target.value)} rows={5} style={{ fontFamily: 'monospace', fontSize: 12 }} disabled={isBusy} />
                  </label>

                  <label className="admin-field-label">
                    <AdminFieldLabel label="Admin Notes" hint="Заметки для администратора (не видны в игре)" />
                    <textarea id="sounds-admin-notes" value={draft.adminNotes ?? ''} onChange={(e) => updateDraft('adminNotes', e.target.value)} rows={2} disabled={isBusy} />
                  </label>
                </div>

                {/* Validation */}
                <section className="admin-sounds-validation">
                  <h3>Валидация</h3>
                  <p>Ошибки: <strong>{validationErrors.length}</strong> &nbsp; Предупреждения: <strong>{validationWarnings.length}</strong></p>
                  {validationErrors.length > 0 && (
                    <ul className="admin-sounds-validation-errors">
                      {validationErrors.map((e) => <li key={e}>❌ {e}</li>)}
                    </ul>
                  )}
                  {validationWarnings.length > 0 && (
                    <ul className="admin-sounds-validation-warnings">
                      {validationWarnings.map((w) => <li key={w}>⚠️ {w}</li>)}
                    </ul>
                  )}
                </section>
              </>
            )}
          </section>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <section className="admin-sounds-import-result">
          <h3>Результат импорта</h3>
          {importResult.created.length > 0 && <p>✅ Создано: {importResult.created.join(', ')}</p>}
          {importResult.skippedExisting.length > 0 && <p>⏭ Пропущено: {importResult.skippedExisting.join(', ')}</p>}
          {importResult.errors.length > 0 && (
            <ul>{importResult.errors.map((e) => <li key={e.id}>❌ {e.id}: {e.message}</li>)}</ul>
          )}
          <button type="button" onClick={() => setImportResult(null)}>Закрыть</button>
        </section>
      )}

      {/* Status */}
      <p className="admin-editor-status" aria-live="polite">{isBusy ? 'Работаю... ' : ''}{status}</p>
    </div>
  );
}
