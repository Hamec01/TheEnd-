import { useEffect, useMemo, useState } from 'react';
import { imageService } from '../services/content/imageService';
import { IMAGE_PRESETS, type ImagePresetId } from '../services/content/imagePresets';
import { buildUploadFolder } from '../services/content/uploadFolders';
import type { StoredImage } from '../services/content/models';
import { AdminFieldLabel, translateAdminErrorMessage } from './adminUi';

interface AdminImageFieldProps {
  value?: string;
  onChange: (nextValue: string) => void;
  onUploaded?: (image: StoredImage) => void;
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

function withCacheBuster(url: string, updatedAt?: string): string {
  const stamp = updatedAt?.trim();
  if (!stamp) {
    return url;
  }
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(stamp)}`;
}

export function AdminImageField({
  value,
  onChange,
  onUploaded,
  onStatus,
  presetId,
  suggestedId,
  suggestedName,
  uploadFolder,
  label = 'Quick image upload',
  hint = 'The file will be resized to the required in-game size and saved through content upload.',
}: AdminImageFieldProps) {
  const [storedImage, setStoredImage] = useState<StoredImage | null>(null);
  const [isUploading, setUploading] = useState(false);
  const [inlineStatus, setInlineStatus] = useState('');
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
    }).catch(() => {
      if (!disposed) {
        setStoredImage(null);
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
    if (normalized && isDirectImageSource(normalized)) {
      return normalized;
    }
    return storedImage ? withCacheBuster(storedImage.dataUrl, storedImage.updatedAt) : null;
  }, [storedImage, value]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const normalizedValue = value?.trim() || '';
      const fallbackId = suggestedId?.trim() || '';
      let replaceId = '';

      if (normalizedValue && !isDirectImageSource(normalizedValue)) {
        replaceId = normalizedValue;
      } else if (fallbackId) {
        const existing = await imageService.get(fallbackId);
        if (existing) {
          replaceId = fallbackId;
        }
      }

      const uploaded = replaceId
        ? await imageService.replacePreset(replaceId, file, presetId, {
          name: suggestedName?.trim() || file.name,
        })
        : await imageService.uploadPreset(file, presetId, {
          id: fallbackId || undefined,
          name: suggestedName?.trim() || file.name,
          folder: resolvedUploadFolder,
        });
      setStoredImage(uploaded);
      onChange(uploaded.id);
      onUploaded?.(uploaded);
      const message = `Image uploaded: ${uploaded.name} (${uploaded.width}x${uploaded.height}, preset ${preset.width}x${preset.height}).`;
      setInlineStatus(message);
      onStatus?.(message);
    } catch (error) {
      const message = translateAdminErrorMessage((error as Error).message);
      setInlineStatus(message);
      onStatus?.(message);
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
          <span>{isUploading ? 'Uploading...' : 'Choose file'}</span>
          <input type="file" accept="image/*" onChange={handleUpload} disabled={isUploading} />
        </label>

        <button type="button" disabled={!value} onClick={() => onChange('')}>
          Clear
        </button>
      </div>

      {value ? (
        <p className="muted">
          Current value: <strong>{value}</strong>
        </p>
      ) : (
        <p className="muted">No image selected yet.</p>
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

      {inlineStatus ? (
        <p className="muted">{inlineStatus}</p>
      ) : null}
    </section>
  );
}
