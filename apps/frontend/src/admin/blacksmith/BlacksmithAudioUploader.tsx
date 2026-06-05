import { useState } from 'react';
import { writeStaticAudioFile } from '../../services/content/contentApi';

// ── Типы слотов ────────────────────────────────────────────────────────────

interface AudioSlot {
  key: string;
  label: string;
  hint: string;
  /** Путь относительно /audio/blacksmith/ , куда файл будет сохранён */
  targetPath: string;
}

const BUTTON_SFX_SLOTS: AudioSlot[] = [
  {
    key: 'button_select_recipe',
    label: 'Выбор рецепта',
    hint: 'Звук при выборе рецепта в списке.',
    targetPath: 'sfx/buttons/button_select_recipe.ogg',
  },
  {
    key: 'button_start_session',
    label: 'Старт сессии',
    hint: 'Звук при нажатии «Старт сессии».',
    targetPath: 'sfx/buttons/button_start_session.ogg',
  },
  {
    key: 'button_prepare',
    label: 'Подготовка',
    hint: 'Звук подготовки заготовки.',
    targetPath: 'sfx/buttons/button_prepare.ogg',
  },
  {
    key: 'button_heat',
    label: 'Поддать жару',
    hint: 'Гудение горна / вспышка огня.',
    targetPath: 'sfx/buttons/button_heat.ogg',
  },
  {
    key: 'button_stabilize',
    label: 'Стабилизировать жар',
    hint: 'Подув мехов / мягкий гул.',
    targetPath: 'sfx/buttons/button_stabilize.ogg',
  },
  {
    key: 'button_light_strike',
    label: 'Лёгкий удар молота',
    hint: 'Тихий металлический удар по наковальне.',
    targetPath: 'sfx/buttons/button_light_strike.ogg',
  },
  {
    key: 'button_medium_strike',
    label: 'Средний удар молота',
    hint: 'Средний удар по металлу.',
    targetPath: 'sfx/buttons/button_medium_strike.ogg',
  },
  {
    key: 'button_heavy_strike',
    label: 'Тяжёлый удар молота',
    hint: 'Мощный удар кувалдой.',
    targetPath: 'sfx/buttons/button_heavy_strike.ogg',
  },
  {
    key: 'button_quench_water',
    label: 'Закалка водой',
    hint: 'Шипение горячего металла в воде.',
    targetPath: 'sfx/buttons/button_quench_water.ogg',
  },
  {
    key: 'button_quench_oil',
    label: 'Закалка маслом',
    hint: 'Мягкое шипение масляной закалки.',
    targetPath: 'sfx/buttons/button_quench_oil.ogg',
  },
  {
    key: 'button_finish',
    label: 'Финишная обработка',
    hint: 'Звук полировки / шлифовки.',
    targetPath: 'sfx/buttons/button_finish.ogg',
  },
  {
    key: 'button_take_result',
    label: 'Забрать результат',
    hint: 'Звук подтверждения / получения предмета.',
    targetPath: 'sfx/buttons/button_take_result.ogg',
  },
  {
    key: 'button_reset',
    label: 'Сброс',
    hint: 'Лёгкий звук отмены.',
    targetPath: 'sfx/buttons/button_reset.ogg',
  },
];

const AMBIENT_SLOTS: AudioSlot[] = Array.from({ length: 10 }, (_, i) => ({
  key: `forge_theme_${String(i + 1).padStart(2, '0')}`,
  label: `Ambient / тема ${i + 1}`,
  hint: `Фоновая музыка кузни — трек ${i + 1}. Проигрывается случайно.`,
  targetPath: `music/forge_theme_${String(i + 1).padStart(2, '0')}.ogg`,
}));

// ── Компонент одного слота ──────────────────────────────────────────────────

interface SlotState {
  uploading: boolean;
  uploaded: boolean;
  error: string;
  previewUrl: string;
}

function AudioSlotRow({ slot }: { slot: AudioSlot }) {
  const [state, setState] = useState<SlotState>({
    uploading: false,
    uploaded: false,
    error: '',
    previewUrl: '',
  });

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    // Локальный preview URL
    const localUrl = URL.createObjectURL(file);

    setState((prev) => ({ ...prev, uploading: true, error: '', uploaded: false }));
    try {
      // Конвертируем в dataUrl
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
        reader.readAsDataURL(file);
      });

      await writeStaticAudioFile({
        targetPath: `audio/blacksmith/${slot.targetPath}`,
        dataUrl,
        mimeType: file.type || 'audio/ogg',
      });

      setState({ uploading: false, uploaded: true, error: '', previewUrl: localUrl });
    } catch (err) {
      setState({ uploading: false, uploaded: false, error: (err as Error).message, previewUrl: '' });
      URL.revokeObjectURL(localUrl);
    }
  }

  return (
    <div className="bs-audio-slot">
      <div className="bs-audio-slot-info">
        <span className="bs-audio-slot-label">{slot.label}</span>
        <span className="bs-audio-slot-path">{slot.targetPath}</span>
        {slot.hint ? <span className="bs-audio-slot-hint">{slot.hint}</span> : null}
      </div>

      <div className="bs-audio-slot-controls">
        <label
          className={`bs-audio-upload-btn ${state.uploading ? 'is-uploading' : ''} ${state.uploaded ? 'is-done' : ''}`}
          title="Выбрать файл"
        >
          {state.uploading
            ? (
              <span className="bs-audio-upload-icon" aria-hidden="true">⏳</span>
            )
            : state.uploaded
              ? (
                <span className="bs-audio-upload-icon" aria-hidden="true">✅</span>
              )
              : (
                <span className="bs-audio-upload-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                    <path d="M10 3v10M6 7l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </span>
              )}
          <span>{state.uploading ? 'Загрузка...' : state.uploaded ? 'Загружено' : 'Загрузить'}</span>
          <input
            type="file"
            accept="audio/*,.ogg,.mp3,.wav,.m4a,.webm"
            disabled={state.uploading}
            onChange={handleFile}
            style={{ display: 'none' }}
          />
        </label>

        {state.previewUrl ? (
          <audio
            controls
            preload="none"
            src={state.previewUrl}
            className="bs-audio-preview"
            aria-label={`Предпросмотр: ${slot.label}`}
          />
        ) : null}
      </div>

      {state.error ? <p className="bs-audio-slot-error">{state.error}</p> : null}
    </div>
  );
}

// ── Главный компонент ───────────────────────────────────────────────────────

export function BlacksmithAudioUploader() {
  return (
    <div className="bs-audio-uploader">
      <section className="bs-audio-section">
        <div className="bs-audio-section-header">
          <div className="bs-audio-section-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 19c-4.418 0-8-1.79-8-4V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M9 15V5l11-3v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="19" r="3" stroke="currentColor" strokeWidth="1.6"/>
              <circle cx="20" cy="15" r="3" stroke="currentColor" strokeWidth="1.6"/>
            </svg>
          </div>
          <div>
            <h3 className="bs-audio-section-title">Звуки кнопок (SFX)</h3>
            <p className="bs-audio-section-desc">
              Файлы сохраняются в <code>public/audio/blacksmith/sfx/buttons/</code> и подхватываются игрой автоматически.
              Поддерживаются форматы <strong>.ogg · .mp3 · .wav · .m4a · .webm</strong>
            </p>
          </div>
        </div>
        <div className="bs-audio-slot-list">
          {BUTTON_SFX_SLOTS.map((slot) => (
            <AudioSlotRow key={slot.key} slot={slot} />
          ))}
        </div>
      </section>

      <section className="bs-audio-section">
        <div className="bs-audio-section-header">
          <div className="bs-audio-section-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6"/>
              <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.6"/>
            </svg>
          </div>
          <div>
            <h3 className="bs-audio-section-title">Фоновая музыка кузни (Ambient)</h3>
            <p className="bs-audio-section-desc">
              До 10 треков. Воспроизводятся в случайном порядке в фоне во время ковки.
              Сохраняются в <code>public/audio/blacksmith/music/</code>
            </p>
          </div>
        </div>
        <div className="bs-audio-slot-list">
          {AMBIENT_SLOTS.map((slot) => (
            <AudioSlotRow key={slot.key} slot={slot} />
          ))}
        </div>
      </section>

      <style>{`
        .bs-audio-uploader {
          display: grid;
          gap: 20px;
          max-width: 900px;
        }
        .bs-audio-section {
          border: 1px solid rgba(164, 141, 110, 0.22);
          border-radius: 12px;
          background: rgba(20, 16, 12, 0.88);
          overflow: hidden;
        }
        .bs-audio-section-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px 18px;
          border-bottom: 1px solid rgba(164, 141, 110, 0.15);
          background: rgba(35, 28, 18, 0.6);
        }
        .bs-audio-section-icon {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          color: #c8a060;
          opacity: 0.85;
          margin-top: 2px;
        }
        .bs-audio-section-icon svg {
          width: 100%;
          height: 100%;
        }
        .bs-audio-section-title {
          margin: 0 0 4px;
          font-size: 0.95rem;
          font-weight: 700;
          color: #e8d4a8;
        }
        .bs-audio-section-desc {
          margin: 0;
          font-size: 0.75rem;
          color: #9a8870;
          line-height: 1.5;
        }
        .bs-audio-section-desc code {
          font-family: monospace;
          background: rgba(255,255,255,0.07);
          padding: 1px 5px;
          border-radius: 4px;
          color: #c8b48a;
        }
        .bs-audio-section-desc strong {
          color: #bfaa88;
        }
        .bs-audio-slot-list {
          display: grid;
          gap: 0;
        }
        .bs-audio-slot {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 10px 18px;
          border-bottom: 1px solid rgba(164, 141, 110, 0.1);
          transition: background 0.12s ease;
        }
        .bs-audio-slot:last-child { border-bottom: none; }
        .bs-audio-slot:hover { background: rgba(255, 255, 255, 0.02); }
        .bs-audio-slot-info {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .bs-audio-slot-label {
          font-size: 0.83rem;
          font-weight: 600;
          color: #ddc9a3;
        }
        .bs-audio-slot-path {
          font-size: 0.7rem;
          font-family: monospace;
          color: #7a6a52;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .bs-audio-slot-hint {
          font-size: 0.72rem;
          color: #7a6a52;
        }
        .bs-audio-slot-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .bs-audio-upload-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 7px;
          border: 1px solid rgba(164, 141, 110, 0.3);
          background: rgba(40, 32, 20, 0.9);
          color: #c8a860;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.13s ease, border-color 0.13s ease, box-shadow 0.13s ease;
          white-space: nowrap;
          user-select: none;
        }
        .bs-audio-upload-btn:hover {
          background: rgba(55, 43, 24, 0.95);
          border-color: rgba(210, 170, 80, 0.5);
          box-shadow: 0 0 8px rgba(200, 160, 60, 0.2);
        }
        .bs-audio-upload-btn.is-uploading {
          opacity: 0.6;
          cursor: wait;
        }
        .bs-audio-upload-btn.is-done {
          border-color: rgba(100, 180, 100, 0.45);
          background: rgba(20, 38, 20, 0.9);
          color: #80cc80;
        }
        .bs-audio-upload-icon {
          display: flex;
          align-items: center;
        }
        .bs-audio-preview {
          height: 28px;
          max-width: 180px;
        }
        .bs-audio-slot-error {
          grid-column: 1 / -1;
          margin: 0;
          font-size: 0.72rem;
          color: #d07060;
          padding: 4px 0;
        }
      `}</style>
    </div>
  );
}
