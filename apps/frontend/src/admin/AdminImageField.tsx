import { useEffect, useMemo, useState } from 'react';
import { imageService } from '../services/content/imageService';
import { IMAGE_PRESETS, type ImagePresetId } from '../services/content/imagePresets';
import { buildUploadFolder } from '../services/content/uploadFolders';
import type { StoredImage } from '../services/content/models';
import { AdminFieldLabel, translateAdminErrorMessage } from './adminUi';

interface AdminImageFieldProps {
  value?: string;
  onChange: (nextValue: string) => void;
  onStatus?: (message: string) => void;
  presetId: ImagePresetId;
  suggestedId?: string;
  suggestedName?: string;
  uploadFolder?: string;
  label?: string;
  hint?: string;
}

function isDirectImageSource(value: string): boolean {
  return value.startsWith('data:') || value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://');
}

export function AdminImageField({
  value,
  onChange,
  onStatus,
  presetId,
  suggestedId,
  suggestedName,
  uploadFolder,
  label = 'Быстрая загрузка картинки',
  hint = 'Загружает файл и сразу ужимает его под нужный размер для игрового интерфейса.',
}: AdminImageFieldProps) {
  const [storedImage, setStoredImage] = useState<StoredImage | null>(null);
  const [isUploading, setUploading] = useState(false);
  const preset = IMAGE_PRESETS[presetId];
  const resolvedUploadFolder = uploadFolder?.trim()
    || buildUploadFolder('images', presetId, suggestedId || suggestedName || undefined);

  useEffect(() => {
    const normalized = value?.trim();
    if (!normalized || isDirectImageSource(normalized)) {
      setStoredImage(null);
      return;
    }

    let disposed = false;
    void imageService.get(normalized).then((image) => {
      if (!disposed) {
        setStoredImage(image);
      }
    });

    return () => {
      disposed = true;
    };
  }, [value]);

  const previewSrc = useMemo(() => {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }
    if (isDirectImageSource(normalized)) {
      return normalized;
    }
    return storedImage?.dataUrl ?? null;
  }, [storedImage, value]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const uploaded = await imageService.uploadPreset(file, presetId, {
        id: suggestedId?.trim() || undefined,
        name: suggestedName?.trim() || file.name,
        folder: resolvedUploadFolder,
      });
      setStoredImage(uploaded);
      onChange(uploaded.id);
      onStatus?.(`Картинка загружена и приведена к размеру ${uploaded.width}x${uploaded.height}: ${uploaded.name}`);
    } catch (error) {
      onStatus?.(translateAdminErrorMessage((error as Error).message));
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="card admin-inline-image-field">
      <div className="admin-inline-image-field-head">
        <AdminFieldLabel label={label} hint={`${hint} Пресет: ${preset.label}, размер ${preset.width}x${preset.height}px.`} />
        <span className="muted">{preset.width}x{preset.height}px</span>
      </div>

      <div className="admin-inline-image-field-body">
        <label className="admin-inline-image-upload">
          <span>{isUploading ? 'Загрузка...' : 'Выбрать файл'}</span>
          <input type="file" accept="image/*" onChange={handleUpload} disabled={isUploading} />
        </label>

        <button type="button" disabled={!value} onClick={() => onChange('')}>
          Очистить
        </button>
      </div>

      {value ? (
        <p className="muted">
          Текущее значение: <strong>{value}</strong>
        </p>
      ) : (
        <p className="muted">Картинка пока не выбрана.</p>
      )}

      {previewSrc ? (
        <div className="admin-inline-image-preview">
          <img src={previewSrc} alt={suggestedName || 'preview'} />
          {storedImage ? (
            <p className="muted">
              ID: {storedImage.id} · {storedImage.width}x{storedImage.height}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
