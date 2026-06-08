import React, { useEffect, useMemo, useState } from 'react';
import { MiningPhaserRenderer } from '../features/mining/MiningPhaserRenderer';
import type { MineDefinition, MineDepth, MineRunState } from '../types/mining';
import { fixMojibake } from '../utils/fixMojibake';
import { itemsService } from '../services/content/itemsService';
import { materialsService } from '../services/content/materialsService';
import { loadRuntimeImages, resolveStoredImageSource } from '../services/content/runtimeImageService';
import type { GameImageRef, StoredImage } from '../services/content/models';
import { normalizeGameImageRef } from '../services/content/gameImageRefs';
import { GameImageView } from '../admin/components/GameImageView';
import {
  loadWorldAudioSettings,
  WORLD_AUDIO_SETTINGS_EVENT,
  type WorldAudioSettings,
} from './worldAudioSettings';

const SLOT_ICON_FALLBACK = '/assets/mining/cell_opened.png';
const MINING_MUSIC_TRACKS = [
  '/assets/mining/music/mining_music_1.mp3',
  '/assets/mining/music/mining_music_2.mp3',
  '/assets/mining/music/mining_music_3.mp3',
  '/assets/mining/music/mining_music_4.mp3',
  '/assets/mining/music/mining_music_5.mp3',
  '/assets/mining/music/mining_music_6.mp3',
  '/assets/mining/music/mining_music_7.mp3',
];

export interface MiningScreenProps {
  mine: MineDefinition;
  depth: MineDepth;
  run: MineRunState;
  miningLevel: number;
  pickaxeName?: string | null;
  emergencyEscapeAvailable?: boolean;
  resolveItemName: (itemId: string) => string;
  resolveItemMeta?: (itemId: string) => {
    name?: string;
    description?: string;
    iconUrl?: string;
  } | null;
  onHitBlock: (blockIndex: number) => void;
  activeMiningSkills?: Array<{
    id: string;
    name: string;
    description?: string;
    iconUrl?: string;
    enabled?: boolean;
    used?: boolean;
  }>;
  onUseActiveMiningSkill?: (skillId: string, blockIndex: number) => string | void;
  onDropLoot?: (itemId: string, quantity: number) => void;
  onEscape: () => void;
  onRetreat: () => void;
  onDescend: () => void;
  onFinalize: () => void;
  onClose: () => void;
}

interface MiningItemMeta {
  itemId: string;
  name: string;
  description: string;
  iconUrl?: string;
  imageRef?: GameImageRef;
}

interface MiningVisibleSlot {
  slotIndex: number;
  itemId?: string;
  name: string;
  quantity: number;
  iconUrl?: string;
  imageRef?: GameImageRef;
}

interface SlotActionState {
  section: 'loot' | 'inventory';
  itemId: string;
  name: string;
  quantity: number;
  iconUrl?: string;
  imageRef?: GameImageRef;
  description?: string;
}

interface SkillWheelTarget {
  blockIndex: number;
  x: number;
  y: number;
}

interface SkillWheelEntry {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  enabled: boolean;
  used: boolean;
  x: number;
  y: number;
}

function areMetaMapsEqual(
  left: Record<string, MiningItemMeta>,
  right: Record<string, MiningItemMeta>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const key of leftKeys) {
    const a = left[key];
    const b = right[key];
    if (!a || !b) {
      return false;
    }
    if (
      a.itemId !== b.itemId
      || a.name !== b.name
      || a.description !== b.description
      || a.iconUrl !== b.iconUrl
    ) {
      return false;
    }
  }
  return true;
}

function resolveImageSource(value?: string | null): string | undefined {
  const normalized = String(value ?? '').trim().replace(/\\/g, '/');
  if (!normalized) {
    return undefined;
  }

  const assetsMarkerIndex = normalized.toLowerCase().indexOf('/assets/');
  if (assetsMarkerIndex >= 0) {
    return normalized.slice(assetsMarkerIndex);
  }
  if (normalized.toLowerCase().startsWith('assets/')) {
    return `/${normalized}`;
  }

  if (
    normalized.startsWith('/')
    || normalized.startsWith('data:')
    || normalized.startsWith('http://')
    || normalized.startsWith('https://')
  ) {
    return normalized;
  }
  return `/api/content/images/${encodeURIComponent(normalized)}/raw`;
}

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function dangerLabel(depthLevel: number): string {
  if (depthLevel >= 3) {
    return 'Высокая опасность';
  }
  if (depthLevel === 2) {
    return 'Средняя опасность';
  }
  return 'Низкая опасность';
}

function buildVisibleSlots(run: MineRunState, resolveItemName: (itemId: string) => string) {
  const derivedSlots = run.temporaryLoot.map((entry, index) => ({
    slotIndex: index,
    itemId: entry.itemId,
    name: fixMojibake(resolveItemName(entry.itemId)),
    quantity: entry.quantity,
    iconUrl: undefined,
  }));
  const maxSlots = run.temporaryLootSlots?.maxSlots ?? 10;
  const slots: MiningVisibleSlot[] = run.temporaryLootSlots?.slots?.length
    ? run.temporaryLootSlots.slots.map((entry) => ({
      ...entry,
      name: entry.itemId ? fixMojibake(resolveItemName(entry.itemId)) : entry.name,
    }))
    : derivedSlots;
  return {
    maxSlots,
    slots,
  };
}

function renderLootSummary(loot: MineRunState['temporaryLoot'], resolveItemName: (itemId: string) => string) {
  if (loot.length === 0) {
    return <p className="mining-muted">Пока пусто.</p>;
  }
  return loot.map((entry) => (
    <p key={`${entry.itemId}-${entry.quantity}`} className="mining-row">
      <span>{fixMojibake(resolveItemName(entry.itemId))}</span>
      <strong>x{entry.quantity}</strong>
    </p>
  ));
}

export function MiningScreen({
  mine,
  depth,
  run,
  miningLevel,
  pickaxeName,
  emergencyEscapeAvailable = false,
  resolveItemName,
  resolveItemMeta,
  onHitBlock,
  activeMiningSkills = [],
  onUseActiveMiningSkill,
  onDropLoot,
  onEscape,
  onRetreat,
  onDescend,
  onFinalize,
  onClose,
}: MiningScreenProps) {
  const canEscape = run.status === 'active' && run.foundExit;
  const canDescend = run.status === 'active' && run.foundPassage;
  const canRetreat = run.status === 'active';
  const visibleSlots = useMemo(
    () => buildVisibleSlots(run, resolveItemName),
    [resolveItemName, run],
  );
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);
  const [itemMetaById, setItemMetaById] = useState<Record<string, MiningItemMeta>>({});
  const [slotActions, setSlotActions] = useState<SlotActionState | null>(null);
  const [inspectTarget, setInspectTarget] = useState<SlotActionState | null>(null);
  const [skillWheelTarget, setSkillWheelTarget] = useState<SkillWheelTarget | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [activeSkillHint, setActiveSkillHint] = useState<string | null>(null);
  const [musicStatus, setMusicStatus] = useState<string>('Музыка: инициализация...');
  const [worldAudioSettings, setWorldAudioSettings] = useState<WorldAudioSettings>(() => loadWorldAudioSettings());
  const mineMusicRef = React.useRef<HTMLAudioElement | null>(null);
  const visibleSlotIdsKey = useMemo(
    () => visibleSlots.slots.map((entry) => `${entry.slotIndex}:${entry.itemId ?? ''}:${entry.quantity}`).join('|'),
    [visibleSlots.slots],
  );
  const miningInventoryIdsKey = useMemo(
    () => (run.miningInventory ?? []).map((entry) => `${entry.toolId}:${entry.itemId}:${entry.quantity}`).join('|'),
    [run.miningInventory],
  );

  useEffect(() => {
    let cancelled = false;
    loadRuntimeImages()
      .then((images) => {
        if (!cancelled) {
          setRuntimeImages(images);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRuntimeImages([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleAudioSettingsChanged = (event: Event) => {
      if (event instanceof StorageEvent) {
        setWorldAudioSettings(loadWorldAudioSettings());
        return;
      }

      const nextValue = (event as CustomEvent<WorldAudioSettings>).detail;
      if (nextValue && typeof nextValue === 'object') {
        setWorldAudioSettings(nextValue);
      }
    };

    window.addEventListener('storage', handleAudioSettingsChanged);
    window.addEventListener(WORLD_AUDIO_SETTINGS_EVENT, handleAudioSettingsChanged as EventListener);
    return () => {
      window.removeEventListener('storage', handleAudioSettingsChanged);
      window.removeEventListener(WORLD_AUDIO_SETTINGS_EVENT, handleAudioSettingsChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    setSlotActions(null);
    setInspectTarget(null);
    setSkillWheelTarget(null);
    setSelectedSkillId(null);
    setActiveSkillHint(null);
  }, [run.runId, run.currentDepthId, run.status]);

  const skillWheelEntries = useMemo<SkillWheelEntry[]>(() => {
    const radius = 108;
    const count = Math.max(1, activeMiningSkills.length);
    return activeMiningSkills.map((skill, index) => {
      const angle = ((Math.PI * 2) * index / count) - (Math.PI / 2);
      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        iconUrl: skill.iconUrl,
        enabled: skill.enabled !== false,
        used: Boolean(skill.used),
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });
  }, [activeMiningSkills]);

  const selectedSkill = useMemo(() => (
    selectedSkillId ? skillWheelEntries.find((entry) => entry.id === selectedSkillId) ?? null : null
  ), [selectedSkillId, skillWheelEntries]);

  useEffect(() => {
    let stopped = false;
    const failedTracks = new Set<number>();
    let retryTimer: number | null = null;
    let unlockHandler: (() => void) | null = null;

    const isAutoplayBlocked = (error: unknown): boolean => {
      if (!(error instanceof Error)) {
        return false;
      }
      const name = String((error as { name?: string }).name ?? '').toLowerCase();
      const message = String(error.message ?? '').toLowerCase();
      return name.includes('notallowed')
        || message.includes('user') && message.includes('interact')
        || message.includes('play() failed');
    };

    const isBenignPlayInterruption = (error: unknown): boolean => {
      if (!(error instanceof Error)) {
        return false;
      }
      const name = String((error as { name?: string }).name ?? '').toLowerCase();
      const message = String(error.message ?? '').toLowerCase();
      return name.includes('aborterror')
        || message.includes('interrupted by a call to pause');
    };

    const audio = mineMusicRef.current ?? new Audio();
    mineMusicRef.current = audio;
    audio.preload = 'auto';
    audio.loop = false;
    const effectiveMusicVolume = worldAudioSettings.musicEnabled
      ? Math.max(0, Math.min(1, 0.28 * worldAudioSettings.musicVolume))
      : 0;
    audio.volume = effectiveMusicVolume;

    if (effectiveMusicVolume <= 0) {
      audio.pause();
      audio.currentTime = 0;
      setMusicStatus('Музыка: выключена в настройках.');
      return () => {
        stopped = true;
      };
    }

    const pickNextTrack = (exclude: number | null): number | null => {
      const available = MINING_MUSIC_TRACKS.map((_, index) => index)
        .filter((index) => index !== exclude && !failedTracks.has(index));
      if (available.length === 0) {
        return null;
      }
      return available[Math.floor(Math.random() * available.length)] ?? null;
    };

    const detachUnlockListener = () => {
      if (!unlockHandler || typeof window === 'undefined') {
        return;
      }
      window.removeEventListener('pointerdown', unlockHandler);
      window.removeEventListener('keydown', unlockHandler);
      unlockHandler = null;
    };

    const scheduleRetry = (exclude: number | null, delayMs: number) => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        playNextTrack(exclude);
      }, delayMs);
    };

    const waitForUserUnlock = (exclude: number | null) => {
      if (unlockHandler || typeof window === 'undefined') {
        return;
      }
      setMusicStatus('Музыка: кликните по окну шахты для запуска.');
      unlockHandler = () => {
        detachUnlockListener();
        scheduleRetry(exclude, 10);
      };
      window.addEventListener('pointerdown', unlockHandler, { once: true });
      window.addEventListener('keydown', unlockHandler, { once: true });
    };

    const playNextTrack = (exclude: number | null) => {
      if (stopped) {
        return;
      }
      const nextTrack = pickNextTrack(exclude);
      if (nextTrack === null) {
        setMusicStatus('Музыка: не найден рабочий трек.');
        return;
      }

      const source = MINING_MUSIC_TRACKS[nextTrack]!;
      audio.pause();
      audio.currentTime = 0;
      audio.src = source;
      void audio.play().then(() => {
        setMusicStatus(`Музыка: играет ${source.split('/').pop() ?? 'трек'}.`);
      }).catch((error) => {
        if (stopped) {
          return;
        }
        if (isBenignPlayInterruption(error)) {
          return;
        }
        if (isAutoplayBlocked(error)) {
          waitForUserUnlock(nextTrack);
          return;
        }
        failedTracks.add(nextTrack);
        const errText = error instanceof Error ? error.message : 'unknown error';
        setMusicStatus(`Музыка: ошибка ${source.split('/').pop() ?? 'трек'} (${errText}).`);
        scheduleRetry(nextTrack, 200);
      });
    };

    audio.onended = () => playNextTrack(null);
    audio.onerror = () => {
      setMusicStatus('Музыка: ошибка загрузки трека, переключаю...');
      scheduleRetry(null, 200);
    };

    playNextTrack(null);

    return () => {
      stopped = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      detachUnlockListener();
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.currentTime = 0;
      setMusicStatus('Музыка: остановлена.');
    };
  }, [worldAudioSettings]);

  useEffect(() => {
    let cancelled = false;
    const ids = new Set<string>();

    visibleSlots.slots.forEach((entry) => {
      if (entry.itemId) {
        ids.add(entry.itemId);
      }
    });
    (run.miningInventory ?? []).forEach((entry) => {
      if (entry.itemId) {
        ids.add(entry.itemId);
      }
    });

    if (ids.size === 0) {
      setItemMetaById((previous) => (Object.keys(previous).length === 0 ? previous : {}));
      return () => {
        cancelled = true;
      };
    }

    const resolveMeta = async (itemId: string): Promise<MiningItemMeta> => {
      const base = resolveItemMeta?.(itemId) ?? null;
      const runtimeToolEntry = (run.miningInventory ?? []).find((entry) => entry.itemId === itemId) ?? null;

      const item = await itemsService.getById(itemId);
      if (item) {
        return {
          itemId,
          name: fixMojibake(firstNonEmpty(base?.name, item.name, resolveItemName(itemId), itemId) ?? itemId),
          description: fixMojibake(firstNonEmpty(base?.description, item.gameplayDescription, item.loreDescription, 'Описание отсутствует.') ?? 'Описание отсутствует.'),
          iconUrl: firstNonEmpty(
            base?.iconUrl,
            resolveStoredImageSource(item.imagePath, runtimeImages),
            resolveImageSource(item.imagePath),
          ),
          imageRef: normalizeGameImageRef(item.imageRef, item.imagePath),
        };
      }

      const material = await materialsService.getById(itemId);
      if (material) {
        return {
          itemId,
          name: fixMojibake(firstNonEmpty(base?.name, material.name, resolveItemName(itemId), itemId) ?? itemId),
          description: fixMojibake(firstNonEmpty(base?.description, material.gameplayDescription, material.loreDescription, 'Описание отсутствует.') ?? 'Описание отсутствует.'),
          iconUrl: firstNonEmpty(
            base?.iconUrl,
            resolveStoredImageSource(material.imagePath, runtimeImages),
            resolveImageSource(material.imagePath),
          ),
          imageRef: normalizeGameImageRef(material.imageRef, material.imagePath),
        };
      }

      return {
        itemId,
        name: fixMojibake(firstNonEmpty(base?.name, runtimeToolEntry?.name, resolveItemName(itemId), itemId) ?? itemId),
        description: fixMojibake(firstNonEmpty(base?.description, 'Описание отсутствует.') ?? 'Описание отсутствует.'),
        iconUrl: firstNonEmpty(base?.iconUrl, resolveImageSource(runtimeToolEntry?.iconUrl)),
        imageRef: undefined,
      };
    };

    Promise.all(Array.from(ids).map(async (itemId) => [itemId, await resolveMeta(itemId)] as const))
      .then((pairs) => {
        if (cancelled) {
          return;
        }
        const nextMap: Record<string, MiningItemMeta> = {};
        pairs.forEach(([itemId, meta]) => {
          nextMap[itemId] = meta;
        });
        setItemMetaById((previous) => (areMetaMapsEqual(previous, nextMap) ? previous : nextMap));
      })
      .catch(() => {
        if (!cancelled) {
          setItemMetaById((previous) => (Object.keys(previous).length === 0 ? previous : {}));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [miningInventoryIdsKey, resolveItemMeta, resolveItemName, run.miningInventory, runtimeImages, visibleSlotIdsKey]);

  const lootGridSlots = useMemo(() => {
    const occupied = visibleSlots.slots.map((entry) => {
      const meta = entry.itemId ? itemMetaById[entry.itemId] : undefined;
      return {
        key: `loot-${entry.slotIndex}-${entry.itemId ?? 'empty'}`,
        slotIndex: entry.slotIndex,
        empty: false,
        itemId: entry.itemId,
        quantity: entry.quantity,
        name: fixMojibake(firstNonEmpty(meta?.name, entry.name, entry.itemId ?? 'Неизвестный ресурс') ?? 'Неизвестный ресурс'),
        description: meta?.description ?? 'Описание отсутствует.',
        iconUrl: firstNonEmpty(entry.iconUrl, meta?.iconUrl),
        imageRef: meta?.imageRef,
      };
    });
    const emptyCount = Math.max(0, visibleSlots.maxSlots - occupied.length);
    const empties = Array.from({ length: emptyCount }, (_, index) => ({
      key: `loot-empty-${index}`,
      slotIndex: occupied.length + index,
      empty: true,
      itemId: undefined,
      quantity: 0,
      name: 'Пустой слот',
      description: '',
      iconUrl: undefined,
      imageRef: undefined,
    }));
    return [...occupied, ...empties];
  }, [itemMetaById, visibleSlots.maxSlots, visibleSlots.slots]);

  const inventoryGridSlots = useMemo(() => {
    const entries = (run.miningInventory ?? []).map((entry) => {
      const meta = itemMetaById[entry.itemId];
      return {
        key: `inv-${entry.toolId}`,
        toolId: entry.toolId,
        itemId: entry.itemId,
        quantity: entry.quantity,
        name: fixMojibake(firstNonEmpty(meta?.name, entry.name, entry.itemId) ?? entry.itemId),
        description: meta?.description ?? 'Описание отсутствует.',
        iconUrl: firstNonEmpty(resolveImageSource(entry.iconUrl), meta?.iconUrl),
        imageRef: meta?.imageRef,
        selected: run.selectedToolId === entry.toolId,
      };
    });
    const filler = Array.from({ length: Math.max(0, 8 - entries.length) }, (_, index) => ({
      key: `inv-empty-${index}`,
      toolId: '',
      itemId: '',
      quantity: 0,
      name: 'Пустой слот',
      description: '',
      iconUrl: undefined,
      imageRef: undefined,
      selected: false,
    }));
    return [...entries, ...filler];
  }, [itemMetaById, run.miningInventory, run.selectedToolId]);

  const openSlotActions = (state: SlotActionState) => {
    setInspectTarget(null);
    setSlotActions(state);
  };

  const handleBlockContextMenu = (payload: { blockIndex: number; x: number; y: number }) => {
    if (run.status !== 'active') {
      return;
    }
    setSlotActions(null);
    setInspectTarget(null);
    setActiveSkillHint(null);
    setSkillWheelTarget(payload);
    setSelectedSkillId(null);
  };

  const handleUseActiveSkill = (skillId: string) => {
    if (!skillWheelTarget || !onUseActiveMiningSkill) {
      return;
    }
    const message = onUseActiveMiningSkill(skillId, skillWheelTarget.blockIndex);
    if (message) {
      setActiveSkillHint(fixMojibake(message));
    }
    setSkillWheelTarget(null);
    setSelectedSkillId(null);
  };

  const handleDropLootFromMenu = () => {
    if (!slotActions || slotActions.section !== 'loot' || !onDropLoot) {
      setSlotActions(null);
      return;
    }
    const maxQuantity = Math.max(1, Math.floor(slotActions.quantity));
    const raw = window.prompt(`Сколько выбросить? (1-${maxQuantity})`, '1');
    if (raw === null) {
      return;
    }
    const parsed = Math.max(1, Math.min(maxQuantity, Math.floor(Number(raw) || 0)));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    onDropLoot(slotActions.itemId, parsed);
    setSlotActions(null);
  };

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true">
      <section className="card mining-window wm-modal" onContextMenu={(event) => event.preventDefault()}>
        <div className="battle-window-head">
          <h2>Горняк / Горянка</h2>
          <button onClick={onClose}>x</button>
        </div>

        <div className="mining-layout">
          <aside className="mining-panel">
            <h3>{fixMojibake(mine.name)}</h3>
            <p className="mining-muted">{fixMojibake(depth.name)} | глубина {depth.depthLevel}</p>
            <div className="mining-stat-list">
              <p className="mining-row"><span>Уровень Горняка</span><strong>{miningLevel}</strong></p>
              <p className="mining-row"><span>HP</span><strong>{run.hp} / {run.maxHp}</strong></p>
              <p className="mining-row"><span>Выносливость</span><strong>{run.stamina} / {run.maxStamina}</strong></p>
              <p className="mining-row"><span>Осталось ударов</span><strong>{run.remainingHits}</strong></p>
              <p className="mining-row"><span>Риск обвала</span><strong>{Math.round(run.collapseRisk * 100)}%</strong></p>
              <p className="mining-row"><span>Кирка</span><strong>{fixMojibake(pickaxeName || 'Безымянная кирка')}</strong></p>
              <p className="mining-row"><span>Слоты добычи</span><strong>{visibleSlots.slots.length} / {visibleSlots.maxSlots}</strong></p>
              <p className="mining-row"><span>Опасность</span><strong>{dangerLabel(depth.depthLevel)}</strong></p>
            </div>
            {mine.entryText ? <p className="mining-muted">{fixMojibake(mine.entryText)}</p> : null}
            {emergencyEscapeAvailable ? <p className="mining-muted">Аварийный выход доступен навыком.</p> : null}
            <p className="mining-muted">{musicStatus}</p>
          </aside>

          <main className="mining-center" onContextMenu={(event) => event.preventDefault()}>
            <MiningPhaserRenderer
              mine={mine}
              depth={depth}
              run={run}
              disabled={run.status !== 'active'}
              onHitBlock={onHitBlock}
              onBlockContextMenu={handleBlockContextMenu}
            />
            {activeSkillHint ? <p className="mining-active-skill-hint">{activeSkillHint}</p> : null}
            {skillWheelTarget ? (
              <div
                className="mining-skill-wheel-backdrop"
                onClick={() => {
                  setSkillWheelTarget(null);
                  setSelectedSkillId(null);
                }}
                onContextMenu={(event) => event.preventDefault()}
              >
                <section
                  className="mining-skill-wheel"
                  style={{ left: `${skillWheelTarget.x}px`, top: `${skillWheelTarget.y}px` }}
                  onClick={(event) => event.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Активные навыки"
                >
                  {skillWheelEntries.length === 0 ? <p className="mining-muted">Нет доступных активных навыков.</p> : null}
                  {skillWheelEntries.map((skill) => (
                    <button
                      key={skill.id}
                      type="button"
                      className={`mining-skill-wheel-icon${skill.used ? ' mining-skill-wheel-icon-used' : ''}`}
                      style={{ left: `${50 + skill.x / 3.2}%`, top: `${50 + skill.y / 3.2}%` }}
                      disabled={skill.enabled === false}
                      onClick={() => setSelectedSkillId(skill.id)}
                      title={skill.description || skill.name}
                    >
                      <img src={skill.iconUrl || SLOT_ICON_FALLBACK} alt={skill.name} loading="lazy" />
                    </button>
                  ))}
                  {selectedSkill ? (
                    <section className="mining-skill-mini-pop" onClick={(event) => event.stopPropagation()}>
                      <div className="mining-skill-mini-head">
                        <div className="mining-slot-icon">
                          <img src={selectedSkill.iconUrl || SLOT_ICON_FALLBACK} alt={selectedSkill.name} loading="lazy" />
                        </div>
                        <div>
                          <h4>{selectedSkill.name}</h4>
                          <p className="mining-muted">{selectedSkill.used ? 'Уже использовано в этом спуске' : 'Готово к применению'}</p>
                        </div>
                      </div>
                      <p className="mining-muted">{selectedSkill.description || 'Описание отсутствует.'}</p>
                      <div className="mining-item-modal-actions">
                        <button type="button" disabled={!selectedSkill.enabled} onClick={() => handleUseActiveSkill(selectedSkill.id)}>Применить</button>
                        <button type="button" onClick={() => setSelectedSkillId(null)}>Назад</button>
                      </div>
                    </section>
                  ) : (
                    <section className="mining-skill-mini-pop mining-skill-mini-pop-hint">
                      <p className="mining-muted">Выберите иконку навыка.</p>
                      <div className="mining-item-modal-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setSkillWheelTarget(null);
                            setSelectedSkillId(null);
                          }}
                        >
                          Закрыть
                        </button>
                      </div>
                    </section>
                  )}
                </section>
              </div>
            ) : null}
          </main>

          <aside className="mining-panel mining-side-tabs">
            <div className="mining-side-section">
              <h3>Добыча</h3>
              <div className="mining-slot-grid" role="grid" aria-label="Слоты добычи">
                {lootGridSlots.map((entry) => (
                  entry.empty ? (
                    <div key={entry.key} className="mining-slot mining-slot-empty" role="gridcell" aria-label="Пустой слот">
                      <div className="mining-slot-icon mining-slot-icon-empty">•</div>
                      <div className="mining-slot-meta">
                        <p className="mining-slot-name">Пусто</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      key={entry.key}
                      type="button"
                      className="mining-slot"
                      role="gridcell"
                      onClick={() => openSlotActions({
                        section: 'loot',
                        itemId: entry.itemId ?? '',
                        name: entry.name,
                        quantity: entry.quantity,
                        iconUrl: entry.iconUrl,
                        imageRef: entry.imageRef,
                        description: entry.description,
                      })}
                      title={entry.name}
                    >
                      <div className="mining-slot-icon">
                        {entry.imageRef ? (
                          <GameImageView imageRef={entry.imageRef} runtimeImages={runtimeImages} alt={entry.name} className="mining-slot-icon-image" />
                        ) : (
                          <img src={entry.iconUrl || SLOT_ICON_FALLBACK} alt={entry.name} loading="lazy" />
                        )}
                      </div>
                      <div className="mining-slot-meta">
                        <p className="mining-slot-name">{entry.name}</p>
                        <p className="mining-slot-qty">x{entry.quantity}</p>
                      </div>
                    </button>
                  )
                ))}
                <p className="mining-row mining-gold-row"><span>Золото</span><strong>{run.temporaryGold}</strong></p>
              </div>
            </div>

            <div className="mining-side-section">
              <h3>Инвентарь</h3>
              <div className="mining-slot-grid" role="grid" aria-label="Слоты инвентаря">
                {inventoryGridSlots.map((entry) => (
                  entry.itemId ? (
                    <button
                      key={entry.key}
                      type="button"
                      className={`mining-slot${entry.selected ? ' mining-slot-selected' : ''}`}
                      role="gridcell"
                      onClick={() => openSlotActions({
                        section: 'inventory',
                        itemId: entry.itemId,
                        name: entry.name,
                        quantity: entry.quantity,
                        iconUrl: entry.iconUrl,
                        imageRef: entry.imageRef,
                        description: entry.description,
                      })}
                      title={entry.name}
                    >
                      <div className="mining-slot-icon">
                        {entry.imageRef ? (
                          <GameImageView imageRef={entry.imageRef} runtimeImages={runtimeImages} alt={entry.name} className="mining-slot-icon-image" />
                        ) : (
                          <img src={entry.iconUrl || SLOT_ICON_FALLBACK} alt={entry.name} loading="lazy" />
                        )}
                      </div>
                      <div className="mining-slot-meta">
                        <p className="mining-slot-name">{entry.name}</p>
                        <p className="mining-slot-qty">x{entry.quantity}</p>
                      </div>
                    </button>
                  ) : (
                    <div key={entry.key} className="mining-slot mining-slot-empty" role="gridcell" aria-label="Пустой слот инвентаря">
                      <div className="mining-slot-icon mining-slot-icon-empty">•</div>
                      <div className="mining-slot-meta">
                        <p className="mining-slot-name">Пусто</p>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>

            {run.status !== 'active' && run.resultSummary ? (
              <div className="mining-result-summary">
                <h3>Итог</h3>
                <p className="mining-muted">
                  {run.status === 'escaped' ? 'Спуск завершён безопасным выходом.' : null}
                  {run.status === 'retreated' ? 'Вы отступили и потеряли часть добычи.' : null}
                  {run.status === 'dead' ? 'Шахта оказалась сильнее вас.' : null}
                  {run.status === 'failed' ? 'Спуск провален.' : null}
                </p>
                <div className="mining-loot-list">
                  <p className="mining-row"><span>Добыча</span><strong>{run.resultSummary.totalLoot.reduce((sum, entry) => sum + entry.quantity, 0)}</strong></p>
                  <p className="mining-row"><span>Сохранено</span><strong>{run.resultSummary.savedLoot.reduce((sum, entry) => sum + entry.quantity, 0)}</strong></p>
                  <p className="mining-row"><span>Потеряно</span><strong>{run.resultSummary.lostLoot.reduce((sum, entry) => sum + entry.quantity, 0)}</strong></p>
                  <p className="mining-row"><span>Золото</span><strong>+{run.resultSummary.goldAwarded}</strong></p>
                  <p className="mining-row"><span>Опыт Горняка</span><strong>+{run.resultSummary.xpAwarded}</strong></p>
                </div>
                <div className="mining-result-details">
                  <h4>Сохранено</h4>
                  {renderLootSummary(run.resultSummary.savedLoot, resolveItemName)}
                </div>
              </div>
            ) : null}
          </aside>
        </div>

        <div className="mining-log">
          {run.eventLog.slice(-30).map((entry, index) => (
            <p key={`${run.runId}-log-${index}`}>{fixMojibake(entry)}</p>
          ))}
        </div>

        <div className="mining-actions">
          {run.status === 'active' ? (
            <>
              <button disabled={!canRetreat} onClick={onRetreat}>Отступить</button>
              <button disabled={!canEscape} onClick={onEscape}>Выйти</button>
              <button disabled={!canDescend} onClick={onDescend}>Спуститься глубже</button>
            </>
          ) : (
            <>
              <button onClick={onFinalize}>Подтвердить результат</button>
              <button onClick={onClose}>Покинуть шахту</button>
            </>
          )}
        </div>

        {slotActions ? (
          <div className="mining-item-modal-backdrop" onClick={() => setSlotActions(null)}>
            <section className="mining-item-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
              <div className="mining-item-modal-head">
                <h3>{slotActions.name}</h3>
                <button type="button" onClick={() => setSlotActions(null)}>×</button>
              </div>
              <div className="mining-item-modal-preview">
                <div className="mining-slot-icon mining-slot-icon-lg">
                  {slotActions.imageRef ? (
                    <GameImageView imageRef={slotActions.imageRef} runtimeImages={runtimeImages} alt={slotActions.name} className="mining-slot-icon-image" />
                  ) : (
                    <img src={slotActions.iconUrl || SLOT_ICON_FALLBACK} alt={slotActions.name} loading="lazy" />
                  )}
                </div>
                <p className="mining-muted">Количество: {slotActions.quantity}</p>
              </div>
              <div className="mining-item-modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setInspectTarget(slotActions);
                    setSlotActions(null);
                  }}
                >
                  Осмотреть
                </button>
                {slotActions.section === 'loot' && onDropLoot ? (
                  <button type="button" onClick={handleDropLootFromMenu}>Выкинуть</button>
                ) : null}
                <button type="button" onClick={() => setSlotActions(null)}>Закрыть</button>
              </div>
            </section>
          </div>
        ) : null}

        {inspectTarget ? (
          <div className="mining-item-modal-backdrop" onClick={() => setInspectTarget(null)}>
            <section className="mining-item-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
              <div className="mining-item-modal-head">
                <h3>{inspectTarget.name}</h3>
                <button type="button" onClick={() => setInspectTarget(null)}>×</button>
              </div>
              <div className="mining-item-modal-preview">
                <div className="mining-slot-icon mining-slot-icon-lg">
                  {inspectTarget.imageRef ? (
                    <GameImageView imageRef={inspectTarget.imageRef} runtimeImages={runtimeImages} alt={inspectTarget.name} className="mining-slot-icon-image" />
                  ) : (
                    <img src={inspectTarget.iconUrl || SLOT_ICON_FALLBACK} alt={inspectTarget.name} loading="lazy" />
                  )}
                </div>
                <p className="mining-muted">{fixMojibake(inspectTarget.description ?? 'Описание отсутствует.')}</p>
              </div>
              <div className="mining-item-modal-actions">
                <button type="button" onClick={() => setInspectTarget(null)}>Закрыть</button>
              </div>
            </section>
          </div>
        ) : null}

        <style>{`
          .mining-window {
            width: min(1500px, 96vw);
            height: min(900px, 92vh);
            max-width: 96vw;
            max-height: 92vh;
            position: relative;
            display: flex;
            flex-direction: column;
            overflow: visible;
            isolation: isolate;
            gap: 1rem;
            background: linear-gradient(180deg, rgba(18, 14, 11, 0.98), rgba(10, 8, 7, 0.99));
          }
          .mining-layout {
            flex: 1;
            min-height: 0;
            display: grid;
            grid-template-columns: 260px minmax(640px, 1fr) 280px;
            gap: 1rem;
            align-items: stretch;
            overflow: hidden;
          }
          .mining-panel {
            min-height: 0;
            overflow: auto;
            border: 1px solid rgba(164, 141, 110, 0.22);
            background: rgba(27, 22, 18, 0.95);
            padding: 0.9rem;
            border-radius: 8px;
          }
          .mining-panel h3 {
            margin: 0 0 0.5rem 0;
          }
          .mining-side-tabs {
            display: grid;
            gap: 0.9rem;
          }
          .mining-side-section {
            display: grid;
            gap: 0.45rem;
            align-content: start;
          }
          .mining-center {
            min-width: 0;
            min-height: 0;
            display: flex;
            position: relative;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            border-radius: 10px;
            background: radial-gradient(circle at top, rgba(72, 50, 34, 0.24), rgba(16, 11, 8, 0.92));
            border: 1px solid rgba(164, 141, 110, 0.2);
          }
          .mining-active-skill-hint {
            position: absolute;
            top: 12px;
            left: 12px;
            margin: 0;
            z-index: 13;
            padding: 0.35rem 0.55rem;
            border-radius: 6px;
            border: 1px solid rgba(223, 188, 132, 0.55);
            background: rgba(31, 24, 18, 0.92);
            color: #f6d7a1;
            font-size: 12px;
            max-width: min(75%, 520px);
          }
          .mining-skill-wheel-backdrop {
            position: absolute;
            inset: 0;
            overflow: visible;
            z-index: 40;
          }
          .mining-skill-wheel {
            position: absolute;
            transform: translate(-50%, -50%);
            width: 340px;
            height: 340px;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 41;
            isolation: isolate;
          }
          .mining-skill-wheel-icon {
            position: absolute;
            width: 66px;
            height: 66px;
            border-radius: 999px;
            border: 1px solid rgba(218, 184, 127, 0.6);
            background: rgba(42, 31, 23, 0.95);
            transform: translate(-50%, -50%);
            padding: 0;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
            transform-origin: center;
            will-change: transform;
            transition: transform 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;
            z-index: 44;
          }
          .mining-skill-wheel-icon img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .mining-skill-wheel button.mining-skill-wheel-icon:hover:enabled {
            transform: translate(-50%, -50%) scale(1.12) !important;
            border-color: rgba(240, 203, 139, 0.9);
            box-shadow: 0 0 0 2px rgba(240, 203, 139, 0.2), 0 10px 22px rgba(0, 0, 0, 0.45);
            z-index: 45;
          }
          .mining-skill-wheel button.mining-skill-wheel-icon:focus-visible {
            transform: translate(-50%, -50%) scale(1.12) !important;
            border-color: rgba(240, 203, 139, 0.9);
            box-shadow: 0 0 0 2px rgba(240, 203, 139, 0.2), 0 10px 22px rgba(0, 0, 0, 0.45);
            z-index: 45;
          }
          .mining-skill-wheel button.mining-skill-wheel-icon:active:enabled {
            transform: translate(-50%, -50%) scale(1.06) !important;
          }
          .mining-skill-wheel-icon-used {
            filter: grayscale(0.7) brightness(0.72);
          }
          .mining-skill-mini-pop {
            position: relative;
            width: 220px;
            min-height: 140px;
            border-radius: 10px;
            border: 1px solid rgba(218, 184, 127, 0.45);
            background: rgba(24, 18, 14, 0.96);
            padding: 0.6rem;
            display: grid;
            gap: 0.5rem;
            z-index: 42;
          }
          .mining-skill-mini-pop-hint {
            align-content: center;
          }
          .mining-skill-mini-head {
            display: grid;
            grid-template-columns: 44px 1fr;
            gap: 0.45rem;
            align-items: center;
          }
          .mining-skill-mini-head h4 {
            margin: 0;
            font-size: 0.88rem;
            color: #ead3ac;
            line-height: 1.15;
          }
          .mining-stat-list,
          .mining-loot-list,
          .mining-result-details {
            display: grid;
            gap: 0.45rem;
          }
          .mining-slot-grid {
            display: grid;
            gap: 0.45rem;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .mining-slot {
            display: grid;
            grid-template-columns: 44px 1fr;
            align-items: center;
            gap: 0.5rem;
            width: 100%;
            border: 1px solid rgba(164, 141, 110, 0.26);
            border-radius: 8px;
            background: rgba(36, 29, 24, 0.88);
            color: #eadbc2;
            text-align: left;
            padding: 0.4rem;
            cursor: pointer;
          }
          .mining-slot:hover {
            border-color: rgba(215, 187, 144, 0.55);
            background: rgba(61, 47, 36, 0.95);
          }
          .mining-slot-selected {
            box-shadow: inset 0 0 0 1px rgba(231, 190, 129, 0.9);
          }
          .mining-slot-empty {
            opacity: 0.55;
            cursor: default;
          }
          .mining-slot-icon {
            width: 44px;
            height: 44px;
            border-radius: 6px;
            border: 1px solid rgba(164, 141, 110, 0.28);
            background: linear-gradient(180deg, rgba(92, 75, 58, 0.35), rgba(36, 29, 24, 0.85));
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            color: #d8c4a1;
            font-size: 18px;
          }
          .mining-slot-icon img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            image-rendering: auto;
          }
          .mining-slot-icon-empty {
            font-size: 22px;
          }
          .mining-slot-icon-lg {
            width: 68px;
            height: 68px;
          }
          .mining-slot-meta {
            min-width: 0;
          }
          .mining-slot-name,
          .mining-slot-qty {
            margin: 0;
            line-height: 1.2;
          }
          .mining-slot-name {
            font-size: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .mining-slot-qty {
            font-size: 11px;
            color: #c9b290;
          }
          .mining-row {
            display: flex;
            justify-content: space-between;
            gap: 0.75rem;
            margin: 0;
          }
          .mining-muted {
            color: #c7b69c;
            margin: 0;
          }
          .mining-gold-row {
            padding-top: 0.5rem;
            border-top: 1px solid rgba(164, 141, 110, 0.16);
          }
          .mining-log {
            flex: 0 0 auto;
            height: 160px;
            min-height: 140px;
            overflow-y: auto;
            border: 1px solid rgba(164, 141, 110, 0.22);
            background: rgba(18, 15, 13, 0.98);
            border-radius: 8px;
            padding: 12px;
            font-size: 13px;
            line-height: 1.35;
          }
          .mining-log p {
            margin: 0 0 0.4rem 0;
          }
          .mining-actions {
            flex: 0 0 auto;
            display: flex;
            gap: 0.75rem;
            justify-content: flex-end;
            flex-wrap: wrap;
            padding-top: 10px;
          }
          .mining-item-modal-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(3, 3, 3, 0.56);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            z-index: 60;
          }
          .mining-item-modal {
            width: min(420px, 92vw);
            border-radius: 10px;
            border: 1px solid rgba(170, 143, 108, 0.36);
            background: rgba(20, 16, 13, 0.98);
            padding: 0.8rem;
            display: grid;
            gap: 0.75rem;
          }
          .mining-item-modal-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
          }
          .mining-item-modal-head h3 {
            margin: 0;
            font-size: 1rem;
          }
          .mining-item-modal-preview {
            display: grid;
            gap: 0.6rem;
            justify-items: start;
          }
          .mining-item-modal-actions {
            display: flex;
            gap: 0.5rem;
            justify-content: flex-end;
            flex-wrap: wrap;
          }
          @media (max-width: 1100px) {
            .mining-window {
              width: 98vw;
              height: 94vh;
              max-width: 98vw;
              max-height: 94vh;
            }
            .mining-layout {
              grid-template-columns: 1fr;
              overflow-y: auto;
              overflow-x: hidden;
            }
            .mining-center {
              min-height: 460px;
            }
            .mining-slot-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
        `}</style>
      </section>
    </div>
  );
}
