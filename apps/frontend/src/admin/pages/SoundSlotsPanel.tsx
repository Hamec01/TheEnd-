import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { writeStaticAudioFile } from '../../services/content/contentApi';
import { SOUND_CATEGORY_LABELS, soundsService } from '../../services/content/soundsService';
import {
  getSlotsForCategory,
  SOUND_SLOT_MAP,
  type SoundSlot,
} from '../../services/content/soundSlotDefinitions';
import type { SoundCategory, SoundDefinition } from '../../services/content/models';

// ─── SlotRow ─────────────────────────────────────────────────────────────────

interface SlotRowProps {
  slot: SoundSlot;
  existing: SoundDefinition | undefined;
  onSaved: (sound: SoundDefinition) => void;
}

interface SlotRowState {
  uploading: boolean;
  error: string;
  previewUrl: string;
  localDone: boolean;
}

function SlotRow({ slot, existing, onSaved }: SlotRowProps) {
  const [state, setState] = useState<SlotRowState>({
    uploading: false,
    error: '',
    previewUrl: existing?.assetUrl?.trim() ?? '',
    localDone: false,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // sync preview when existing changes (e.g. after full reload)
  useEffect(() => {
    if (existing?.assetUrl && !state.localDone) {
      setState((prev) => ({ ...prev, previewUrl: existing.assetUrl.trim() }));
    }
  }, [existing?.assetUrl]);

  const hasSound = Boolean(state.previewUrl || existing?.assetUrl);
  const isDone = state.localDone || Boolean(existing?.assetUrl);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setState((prev) => ({ ...prev, uploading: true, error: '', localDone: false }));

    try {
      // 1. Read as dataUrl
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
        reader.readAsDataURL(file);
      });

      // 2. Write static file (like the blacksmith)
      const { publicUrl } = await writeStaticAudioFile({
        targetPath: `audio/${slot.defaultPath}`,
        dataUrl,
        mimeType: file.type || 'audio/ogg',
      });

      // 3. Create / update SoundDefinition in the content registry
      const now = new Date().toISOString();
      const payload: SoundDefinition = {
        id: slot.id,
        name: slot.label,
        status: 'active',
        category: slot.category,
        kind: slot.kind,
        description: slot.hint,
        assetUrl: publicUrl,
        assetKey: slot.id,
        volume: 1,
        loop: slot.kind === 'loop' || slot.kind === 'ambient',
        tags: [slot.category],
        bindings: [],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      let saved: SoundDefinition;
      if (existing) {
        saved = await soundsService.update(slot.id, payload);
      } else {
        try {
          saved = await soundsService.create(payload);
        } catch {
          // might already exist — try update
          saved = await soundsService.update(slot.id, payload);
        }
      }

      setState({ uploading: false, error: '', previewUrl: localUrl, localDone: true });
      onSaved(saved);
    } catch (err) {
      setState((prev) => ({ ...prev, uploading: false, error: (err as Error).message }));
      URL.revokeObjectURL(localUrl);
    }
  }

  function togglePlay() {
    const src = state.previewUrl || existing?.assetUrl?.trim();
    if (!src) return;

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.onended = () => setIsPlaying(false);
    } else {
      audioRef.current.src = src;
    }
    void audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }

  return (
    <div className={`ssp-slot ${isDone ? 'is-filled' : ''}`}>
      <div className="ssp-slot-info">
        <span className="ssp-slot-label">{slot.label}</span>
        <span className="ssp-slot-path">{slot.defaultPath}</span>
        {slot.hint && <span className="ssp-slot-hint">{slot.hint}</span>}
      </div>

      <div className="ssp-slot-controls">
        {/* Play / Stop */}
        {hasSound && (
          <button
            type="button"
            className={`ssp-play-btn ${isPlaying ? 'is-playing' : ''}`}
            onClick={togglePlay}
            title={isPlaying ? 'Остановить' : 'Прослушать'}
          >
            {isPlaying ? '■' : '▶'}
          </button>
        )}

        {/* Upload */}
        <label
          className={`ssp-upload-btn ${state.uploading ? 'is-uploading' : ''} ${isDone ? 'is-done' : ''}`}
          title="Выбрать аудио-файл"
        >
          {state.uploading ? (
            <span className="ssp-upload-icon">⏳</span>
          ) : isDone ? (
            <span className="ssp-upload-icon">✅</span>
          ) : (
            <span className="ssp-upload-icon">
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="15" height="15">
                <path d="M10 3v10M6 7l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </span>
          )}
          <span>{state.uploading ? 'Загрузка...' : isDone ? 'Загружено' : 'Загрузить'}</span>
          <input
            type="file"
            accept="audio/*,.ogg,.mp3,.wav,.m4a,.webm"
            disabled={state.uploading}
            onChange={handleFile}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {state.error && <p className="ssp-slot-error">{state.error}</p>}
    </div>
  );
}

// ─── SoundSlotsPanel ─────────────────────────────────────────────────────────

interface Props {
  sounds: SoundDefinition[];
  onSoundSaved: (sound: SoundDefinition) => void;
}

const SLOT_CATEGORIES = Object.keys(SOUND_SLOT_MAP) as SoundCategory[];

export function SoundSlotsPanel({ sounds, onSoundSaved }: Props) {
  const [activeCategory, setActiveCategory] = useState<SoundCategory>(SLOT_CATEGORIES[0]);

  // Index sounds by ID for O(1) lookups
  const soundsById = useMemo(() => {
    const map = new Map<string, SoundDefinition>();
    for (const s of sounds) map.set(s.id, s);
    return map;
  }, [sounds]);

  const slots = useMemo(() => getSlotsForCategory(activeCategory), [activeCategory]);

  // Count filled slots per category for the badge
  const filledCount = useCallback(
    (cat: SoundCategory) => getSlotsForCategory(cat).filter((s) => soundsById.has(s.id)).length,
    [soundsById],
  );

  const totalCount = useCallback(
    (cat: SoundCategory) => getSlotsForCategory(cat).length,
    [],
  );

  const label = SOUND_CATEGORY_LABELS[activeCategory];

  return (
    <div className="ssp-panel">
      {/* ── Category sidebar ── */}
      <nav className="ssp-categories" aria-label="Категории звуков">
        {SLOT_CATEGORIES.map((cat) => {
          const filled = filledCount(cat);
          const total = totalCount(cat);
          const isActive = cat === activeCategory;
          return (
            <button
              key={cat}
              type="button"
              className={`ssp-cat-btn ${isActive ? 'is-active' : ''} ${filled === total ? 'is-full' : filled > 0 ? 'is-partial' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              <span className="ssp-cat-label">{SOUND_CATEGORY_LABELS[cat]}</span>
              <span className={`ssp-cat-badge ${filled === total ? 'is-full' : filled > 0 ? 'is-partial' : ''}`}>
                {filled}/{total}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── Slots area ── */}
      <div className="ssp-slots-area">
        <div className="ssp-slots-header">
          <div className="ssp-slots-header-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 19c-4.418 0-8-1.79-8-4V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M9 15V5l11-3v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="19" r="3" stroke="currentColor" strokeWidth="1.6"/>
              <circle cx="20" cy="15" r="3" stroke="currentColor" strokeWidth="1.6"/>
            </svg>
          </div>
          <div>
            <h3 className="ssp-slots-title">{label}</h3>
            <p className="ssp-slots-desc">
              {filledCount(activeCategory)} из {totalCount(activeCategory)} слотов заполнено.
              Файлы сохраняются в <code>public/audio/</code> и регистрируются в реестре звуков.
              Поддерживаются форматы <strong>.ogg · .mp3 · .wav · .m4a · .webm</strong>
            </p>
          </div>
        </div>

        <div className="ssp-slot-list">
          {slots.length === 0 && (
            <p className="ssp-empty muted">Для этой категории слоты не определены.</p>
          )}
          {slots.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              existing={soundsById.get(slot.id)}
              onSaved={onSoundSaved}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
