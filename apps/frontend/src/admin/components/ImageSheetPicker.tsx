import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameImageRef, ImageSheetCategory, StoredImage } from '../../services/content/models';
import { imageService } from '../../services/content/imageService';
import type { ImagePresetId } from '../../services/content/imagePresets';
import { translateAdminErrorMessage } from '../adminUi';
import {
  formatGameImageRefLabel,
  getImageSheet,
  getImageSheetsByCategory,
  getImageSheetTotalFrames,
  normalizeGameImageRef,
  registerCustomImageSheet,
  toLegacyImagePath,
} from '../../services/content/gameImageRefs';
import { imageSheetsService } from '../../services/content/imageSheetsService';
import { GameImageView } from './GameImageView';

export interface ImageSheetPickerProps {
  label?: string;
  hint?: string;
  category?: ImageSheetCategory;
  value?: GameImageRef | null;
  legacyImagePath?: string | null;
  runtimeImages?: StoredImage[];
  showUploadForImage?: boolean;
  disableManualImageInput?: boolean;
  defaultTilesetFrameWidth?: number;
  defaultTilesetFrameHeight?: number;
  uploadPresetId?: ImagePresetId;
  uploadSuggestedId?: string;
  uploadSuggestedName?: string;
  uploadFolder?: string;
  onStatus?: (message: string) => void;
  onChange: (next: GameImageRef | undefined) => void;
}

const frameCellStyle: CSSProperties = {
  width: 38,
  height: 38,
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: 8,
  background: 'rgba(0, 0, 0, 0.2)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};

export function ImageSheetPicker({
  label = 'Источник изображения',
  hint,
  category,
  value,
  legacyImagePath,
  runtimeImages = [],
  showUploadForImage = false,
  disableManualImageInput = false,
  defaultTilesetFrameWidth,
  defaultTilesetFrameHeight,
  uploadPresetId,
  uploadSuggestedId,
  uploadSuggestedName,
  uploadFolder,
  onStatus,
  onChange,
}: ImageSheetPickerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingTileset, setIsUploadingTileset] = useState(false);
  const [inlineStatus, setInlineStatus] = useState('');
  const [sheetsVersion, setSheetsVersion] = useState(0);
  const [tilesetFrameWidth, setTilesetFrameWidth] = useState(() => {
    const value = Number(defaultTilesetFrameWidth);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 128;
  });
  const [tilesetFrameHeight, setTilesetFrameHeight] = useState(() => {
    const value = Number(defaultTilesetFrameHeight);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 128;
  });
  const [tilesetName, setTilesetName] = useState('');
  const [uiSourceType, setUiSourceType] = useState<'image' | 'tileset'>(() => (value?.type === 'tileset' ? 'tileset' : 'image'));

  const normalized = useMemo(
    () => normalizeGameImageRef(value, legacyImagePath),
    [value, legacyImagePath],
  );

  const sourceType = uiSourceType;
  const sheets = useMemo(() => getImageSheetsByCategory(category), [category, sheetsVersion]);
  const activeSheet = useMemo(
    () => getImageSheet(normalized?.type === 'tileset' ? normalized.sheetId : sheets[0]?.id),
    [normalized, sheets],
  );
  const totalFrames = activeSheet ? getImageSheetTotalFrames(activeSheet) : 0;
  const quickFrameLimit = Math.min(480, totalFrames);
  const imageSrc = normalized?.type === 'image' ? toLegacyImagePath(normalized) ?? '' : '';

  useEffect(() => {
    if (normalized?.type === 'tileset') {
      setUiSourceType('tileset');
      return;
    }
    if (normalized?.type === 'image') {
      setUiSourceType('image');
    }
  }, [normalized]);

  const canUpload = showUploadForImage && Boolean(uploadPresetId);

  function isDirectImageSource(valueToCheck: string): boolean {
    return valueToCheck.startsWith('data:') || valueToCheck.startsWith('/') || valueToCheck.startsWith('http://') || valueToCheck.startsWith('https://');
  }

  async function handleUploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !uploadPresetId) {
      return;
    }

    setIsUploading(true);
    try {
      const normalizedValue = imageSrc.trim();
      const fallbackId = String(uploadSuggestedId ?? '').trim();
      let replaceId = '';
      const SYSTEM_PLACEHOLDER_IDS = new Set(['unknown', 'default', 'none', 'placeholder']);

      if (normalizedValue && !SYSTEM_PLACEHOLDER_IDS.has(normalizedValue) && !isDirectImageSource(normalizedValue)) {
        replaceId = normalizedValue;
      } else if (fallbackId) {
        const existing = await imageService.get(fallbackId);
        if (existing) {
          replaceId = fallbackId;
        }
      }

      const uploaded = replaceId
        ? await imageService.replacePreset(replaceId, file, uploadPresetId, {
          name: String(uploadSuggestedName ?? '').trim() || file.name,
        })
        : await imageService.uploadPreset(file, uploadPresetId, {
          id: fallbackId || undefined,
          name: String(uploadSuggestedName ?? '').trim() || file.name,
          folder: uploadFolder,
        });

      onChange({ type: 'image', src: uploaded.id });
      const message = `Image uploaded: ${uploaded.name} (${uploaded.width}x${uploaded.height}).`;
      setInlineStatus(message);
      onStatus?.(message);
    } catch (error) {
      const message = translateAdminErrorMessage((error as Error).message);
      setInlineStatus(message);
      onStatus?.(message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleUploadTileset(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    const frameWidth = Math.max(1, Math.floor(Number(tilesetFrameWidth) || 1));
    const frameHeight = Math.max(1, Math.floor(Number(tilesetFrameHeight) || 1));

    setIsUploadingTileset(true);
    try {
      const uploaded = await imageService.upload(file, {
        name: String(uploadSuggestedName ?? '').trim() || file.name,
        folder: uploadFolder,
      });

      const columns = Math.max(1, Math.floor(uploaded.width / frameWidth));
      const rows = Math.max(1, Math.floor(uploaded.height / frameHeight));
      const frameCount = columns * rows;
      if (frameCount <= 0) {
        throw new Error('Не удалось вычислить кадры tilesheet. Проверьте размер кадра.');
      }

      const baseId = String(uploadSuggestedId ?? uploaded.id).trim() || uploaded.id;
      const sheetId = `sheet_${baseId}`;
      const registeredSheet = registerCustomImageSheet({
        id: sheetId,
        name: String(tilesetName).trim() || `${label} (${uploaded.name})`,
        category: category ?? 'other',
        src: uploaded.dataUrl?.trim() || uploaded.id,
        frameWidth,
        frameHeight,
        columns,
        rows,
      });

      try {
        await imageSheetsService.upsert(registeredSheet);
      } catch {
        // Local sheet registration still allows editing in this session.
      }

      onChange({ type: 'tileset', sheetId: registeredSheet.id, frame: 0 });
      setSheetsVersion((current) => current + 1);
      const message = `Tilesheet uploaded: ${registeredSheet.name} (${columns}x${rows}, ${frameCount} frames).`;
      setInlineStatus(message);
      onStatus?.(message);
    } catch (error) {
      const message = translateAdminErrorMessage((error as Error).message);
      setInlineStatus(message);
      onStatus?.(message);
    } finally {
      setIsUploadingTileset(false);
    }
  }

  const deletableImageId = useMemo(() => {
    if (sourceType === 'image') {
      return imageSrc;
    }
    if (sourceType === 'tileset' && activeSheet) {
      return activeSheet.src;
    }
    return '';
  }, [sourceType, imageSrc, activeSheet]);

  const isDeletable = useMemo(() => {
    if (!deletableImageId) return false;
    return runtimeImages.some((img) => img.id === deletableImageId);
  }, [deletableImageId, runtimeImages]);

  async function handleDeleteImage() {
    if (!deletableImageId) return;
    if (!window.confirm(`Вы уверены, что хотите навсегда удалить изображение '${deletableImageId}' с сервера? Это действие сотрет файл на диске.`)) {
      return;
    }

    try {
      await imageService.delete(deletableImageId);
      onChange(undefined);
      setSheetsVersion((current) => current + 1);
      const message = `Изображение '${deletableImageId}' удалено с сервера.`;
      setInlineStatus(message);
      onStatus?.(message);
    } catch (error) {
      const message = translateAdminErrorMessage((error as Error).message);
      setInlineStatus(message);
      onStatus?.(message);
    }
  }

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: 0 }}>{label}</h4>
          {hint ? <p className="muted" style={{ margin: '6px 0 0' }}>{hint}</p> : null}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isDeletable ? (
            <button
              type="button"
              style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
              onClick={handleDeleteImage}
            >
              Удалить файл
            </button>
          ) : null}
          <button type="button" onClick={() => onChange(undefined)}>Сбросить</button>
        </div>
      </div>

      <div className="admin-form-grid" style={{ marginTop: 12 }}>
        <label>
          <span className="muted">Тип</span>
          <select
            value={sourceType}
            onChange={(event) => {
              const nextType = event.target.value === 'tileset' ? 'tileset' : 'image';
              setUiSourceType(nextType);
              if (event.target.value === 'tileset') {
                const defaultSheet = sheets[0];
                if (!defaultSheet) {
                  return;
                }
                onChange({ type: 'tileset', sheetId: defaultSheet.id, frame: 0 });
                return;
              }
              onChange({ type: 'image', src: imageSrc });
            }}
          >
            <option value="image">Single Image</option>
            <option value="tileset">Tileset / Spritesheet</option>
          </select>
        </label>

        {sourceType === 'image' ? (
          <>
            {canUpload ? (
              <label>
                <span className="muted">Загрузка файла</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadImage}
                  disabled={isUploading}
                />
              </label>
            ) : null}

            {!disableManualImageInput ? (
              <label>
                <span className="muted">Путь / URL / image ID</span>
                <input
                  value={imageSrc}
                  onChange={(event) => onChange({ type: 'image', src: event.target.value })}
                  placeholder="/assets/... or uploaded image id"
                />
              </label>
            ) : (
              <label>
                <span className="muted">Выбранный image ID</span>
                <input value={imageSrc} readOnly placeholder="Сначала загрузите файл" />
              </label>
            )}
          </>
        ) : (
          <>
            <label>
              <span className="muted">Лист</span>
              <select
                value={activeSheet?.id ?? ''}
                disabled={!sheets.length}
                onChange={(event) => {
                  const nextSheet = getImageSheet(event.target.value);
                  if (!nextSheet) {
                    return;
                  }
                  onChange({ type: 'tileset', sheetId: nextSheet.id, frame: 0 });
                }}
              >
                {!sheets.length ? <option value="">Сначала загрузите tilesheet</option> : null}
                {sheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>{sheet.name} ({sheet.id})</option>
                ))}
              </select>
            </label>
            <label>
              <span className="muted">Frame</span>
              <input
                type="number"
                min={0}
                max={Math.max(0, totalFrames - 1)}
                value={normalized?.type === 'tileset' ? normalized.frame : 0}
                onChange={(event) => {
                  const nextFrame = Number(event.target.value);
                  if (!activeSheet || !Number.isInteger(nextFrame) || nextFrame < 0) {
                    return;
                  }
                  onChange({
                    type: 'tileset',
                    sheetId: activeSheet.id,
                    frame: Math.min(nextFrame, Math.max(0, getImageSheetTotalFrames(activeSheet) - 1)),
                  });
                }}
              />
            </label>

            <label>
              <span className="muted">Кадр W</span>
              <input
                type="number"
                min={1}
                value={tilesetFrameWidth}
                onChange={(event) => setTilesetFrameWidth(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
              />
            </label>

            <label>
              <span className="muted">Кадр H</span>
              <input
                type="number"
                min={1}
                value={tilesetFrameHeight}
                onChange={(event) => setTilesetFrameHeight(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
              />
            </label>

            <label>
              <span className="muted">Название tilesheet</span>
              <input
                value={tilesetName}
                onChange={(event) => setTilesetName(event.target.value)}
                placeholder="Например: NPC Mega Sheet"
              />
            </label>

            <label>
              <span className="muted">Загрузить tilesheet</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadTileset}
                disabled={isUploadingTileset}
              />
            </label>
          </>
        )}
      </div>

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
        <GameImageView
          imageRef={normalized}
          runtimeImages={runtimeImages}
          alt="selected image preview"
          size={66}
          fallbackText="N/A"
        />
        <p className="muted" style={{ margin: 0 }}>{formatGameImageRefLabel(normalized)}</p>
      </div>

      {inlineStatus ? <p className="muted" style={{ marginTop: 8 }}>{inlineStatus}</p> : null}

      {sourceType === 'tileset' && activeSheet ? (
        <div style={{ marginTop: 10 }}>
          <p className="muted" style={{ marginTop: 0 }}>
            Выберите frame (всего: {Math.max(0, totalFrames - 1)}, быстрый выбор: {Math.max(0, quickFrameLimit - 1)})
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(38px, 1fr))', gap: 6, maxHeight: 220, overflow: 'auto' }}>
            {Array.from({ length: quickFrameLimit }, (_, index) => {
              const isActive = normalized?.type === 'tileset' && normalized.sheetId === activeSheet.id && normalized.frame === index;
              return (
                <button
                  key={`${activeSheet.id}:${index}`}
                  type="button"
                  style={{
                    ...frameCellStyle,
                    outline: isActive ? '2px solid #5dbbff' : 'none',
                  }}
                  title={`frame ${index}`}
                  onClick={() => onChange({ type: 'tileset', sheetId: activeSheet.id, frame: index })}
                >
                  <GameImageView
                    imageRef={{ type: 'tileset', sheetId: activeSheet.id, frame: index }}
                    runtimeImages={runtimeImages}
                    alt={`frame ${index}`}
                    size={28}
                    fallbackText="?"
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
