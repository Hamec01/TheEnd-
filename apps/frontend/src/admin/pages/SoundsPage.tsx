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

// ─── helpers ──────────────────────────────────────────────────────────────────

function isDirectAudioSource(src: string | undefined): boolean {
  if (!src) return false;
  const s = src.trim();
  return s.startsWith('/') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:audio/');
}

// ─── Filter / List ─────────────────────────────────────────────────────────────

interface SoundFilters {
  search: string;
  category: '' | SoundCategory;
  kind: '' | SoundKind;
  status: '' | 'active' | 'draft' | 'disabled';
}

function matchesFilters(sound: SoundDefinition, filters: SoundFilters): boolean {
  if (filters.search) {
    const q = filters.search.toLowerCase();
    if (!sound.id.toLowerCase().includes(q) && !sound.name.toLowerCase().includes(q)) return false;
  }
  if (filters.category && sound.category !== filters.category) return false;
  if (filters.kind && sound.kind !== filters.kind) return false;
  if (filters.status && sound.status !== filters.status) return false;
  return true;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type SoundsTab = 'slots' | 'editor';

export function SoundsPage() {
  const [activeTab, setActiveTab] = useState<SoundsTab>('slots');
  const [sounds, setSounds] = useState<SoundDefinition[]>([]);
  const [selected, setSelected] = useState<SoundDefinition | null>(null);
  const [draft, setDraft] = useState<SoundDefinition>(emptySound());
  const [isCreating, setCreating] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState('Готово.');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [filters, setFilters] = useState<SoundFilters>({ search: '', category: '', kind: '', status: '' });
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
      const data = await soundsService.getAll();
      setSounds(data);
      setStatus(`Загружено ${data.length} звуков.`);
    } catch (err) {
      setStatus(translateAdminErrorMessage((err as Error).message));
    } finally {
      setIsBusy(false);
    }
  }

  // ── selection ──
  function selectSound(sound: SoundDefinition) {
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
    setDraft(blank);
    setCreating(true);
    setValidationErrors([]);
    setValidationWarnings([]);
    setBindingsText('[]');
    stopAudio();
  }

  function updateDraft<K extends keyof SoundDefinition>(key: K, value: SoundDefinition[K]) {
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
      if (isCreating) {
        const created = await soundsService.create(toSave);
        setSounds((prev) => [...prev, created]);
        setSelected(created);
        setDraft(created);
        setCreating(false);
        setStatus(`Создан: ${created.id}`);
      } else if (selected) {
        const updated = selected.id !== toSave.id
          ? await soundsService.rename(selected.id, toSave.id, toSave)
          : await soundsService.update(toSave.id, toSave);
        setSounds((prev) => prev.map((s) => s.id === selected.id ? updated : s));
        setSelected(updated);
        setDraft(updated);
        setStatus(`Сохранён: ${updated.id}`);
      }
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
    setDraft(d);
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
      setSounds((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      setSelected(updated);
      setDraft(updated);
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
      setSounds((prev) => prev.filter((s) => s.id !== selected.id));
      setSelected(null);
      setDraft(emptySound());
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
      entries: sounds,
    });
    setStatus(`Экспортировано ${sounds.length} звуков.`);
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
      const refreshed = await soundsService.getAll();
      setSounds(refreshed);
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
    setSounds((prev) => {
      const idx = prev.findIndex((s) => s.id === sound.id);
      return idx >= 0 ? prev.map((s) => s.id === sound.id ? sound : s) : [...prev, sound];
    });
    setStatus(`Звук сохранён: ${sound.id}`);
  }

  const filteredSounds = useMemo(() => sounds.filter((s) => matchesFilters(s, filters)), [sounds, filters]);
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
        <SoundSlotsPanel sounds={sounds} onSoundSaved={handleSlotSaved} />
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

            <p className="admin-sounds-count muted">{filteredSounds.length} / {sounds.length} звуков</p>

            <div className="admin-sounds-list">
              {filteredSounds.length === 0 && (
                <p className="muted" style={{ padding: '12px' }}>Нет звуков.</p>
              )}
              {filteredSounds.map((sound) => (
                <button
                  key={sound.id}
                  type="button"
                  className={`admin-sounds-card ${selected?.id === sound.id ? 'is-active' : ''}`}
                  onClick={() => selectSound(sound)}
                >
                  <div className="admin-sounds-card-name">{sound.name}</div>
                  <div className="admin-sounds-card-id muted">{sound.id}</div>
                  <div className="admin-sounds-card-meta muted">
                    {SOUND_CATEGORY_LABELS[sound.category]} • {SOUND_KIND_LABELS[sound.kind]}
                    <span className={`admin-sounds-status admin-sounds-status--${sound.status}`}> {sound.status}</span>
                  </div>
                  {(sound.bindings?.length ?? 0) > 0 && (
                    <div className="admin-sounds-card-bindings muted">
                      {sound.bindings!.slice(0, 2).map((b) => `${b.targetType}${b.targetId ? `/${b.targetId}` : ''}`).join(', ')}
                      {(sound.bindings!.length > 2) && ` +${sound.bindings!.length - 2}`}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </aside>

          {/* RIGHT: editor */}
          <section className="admin-sounds-editor">
            {!isCreating && !selected ? (
              <div className="admin-sounds-empty">
                <p className="muted">Выберите звук из списка или создайте новый.</p>
              </div>
            ) : (
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
                  <button type="button" onClick={handleExportJson} disabled={isBusy || sounds.length === 0}>⬇ Экспорт JSON</button>
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
                    <select id="sounds-status" value={draft.status} onChange={(e) => updateDraft('status', e.target.value as SoundDefinition['status'])} disabled={isBusy}>
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
