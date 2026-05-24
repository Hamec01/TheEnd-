import { useMemo, useState } from 'react';
import { audioService } from '../services/content/audioService';
import { buildUploadFolder } from '../services/content/uploadFolders';
import { AdminFieldLabel, translateAdminErrorMessage } from './adminUi';

interface AdminAudioFieldProps {
  value?: string;
  onChange: (nextValue: string) => void;
  onStatus?: (message: string) => void;
  suggestedAssetId?: string;
  suggestedName?: string;
  uploadFolder?: string;
  label?: string;
  hint?: string;
  mode?: 'url' | 'assetId';
  accept?: string;
}

export function AdminAudioField({
  value,
  onChange,
  onStatus,
  suggestedAssetId,
  suggestedName,
  uploadFolder,
  label = 'Быстрая загрузка аудио',
  hint = 'Загружает аудио-файл и сразу подставляет URL или asset ID в поле.',
  mode = 'url',
  accept = 'audio/*,.ogg,.mp3,.wav,.m4a,.webm',
}: AdminAudioFieldProps) {
  const [isUploading, setUploading] = useState(false);
  const resolvedUploadFolder = uploadFolder?.trim()
    || buildUploadFolder('audio', mode === 'assetId' ? 'assets' : 'urls', suggestedAssetId || suggestedName || undefined);

  const canPreview = useMemo(() => {
    const raw = value?.trim() ?? '';
    return raw.startsWith('/') || raw.startsWith('http://') || raw.startsWith('https://');
  }, [value]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const uploaded = await audioService.upload(file, {
        id: suggestedAssetId,
        name: suggestedName,
        folder: resolvedUploadFolder,
      });
      onChange(mode === 'assetId' ? uploaded.assetId : uploaded.publicUrl);
      onStatus?.(
        mode === 'assetId'
          ? `Аудио загружено: ${uploaded.assetId} (${uploaded.mimeType})`
          : `Аудио загружено: ${uploaded.publicUrl}`,
      );
    } catch (error) {
      onStatus?.(translateAdminErrorMessage((error as Error).message));
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="card admin-inline-audio-field">
      <div className="admin-inline-image-field-head">
        <AdminFieldLabel label={label} hint={hint} />
        <span className="muted">{mode === 'assetId' ? 'Подстановка asset ID' : 'Подстановка URL'}</span>
      </div>

      <div className="admin-inline-image-field-body">
        <label className="admin-inline-image-upload">
          <span>{isUploading ? 'Загрузка...' : 'Выбрать аудио'}</span>
          <input type="file" accept={accept} onChange={handleUpload} disabled={isUploading} />
        </label>

        <button type="button" disabled={!value} onClick={() => onChange('')}>
          Очистить
        </button>
      </div>

      {value ? (
        <p className="muted">Текущее значение: <strong>{value}</strong></p>
      ) : (
        <p className="muted">Аудио пока не выбрано.</p>
      )}

      {canPreview ? (
        <audio controls preload="none" src={value?.trim()} style={{ width: '100%' }} />
      ) : null}
    </section>
  );
}
