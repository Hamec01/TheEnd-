import { useState } from 'react';
import type { SpriteProfileDefinition } from '@theend/rpg-domain';
import { imageService } from '../../services/content/imageService';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import type { StoredImage } from '../../services/content/models';

interface SpriteStudioExportPanelProps {
  previewCanvas: HTMLCanvasElement | null;
  activeProfile: SpriteProfileDefinition | null;
  onUploaded?: (image: StoredImage) => void;
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [header, payload] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/png';
  const binary = atob(payload || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], fileName, { type: mimeType });
}

export function SpriteStudioExportPanel({ previewCanvas, activeProfile, onUploaded }: SpriteStudioExportPanelProps) {
  const [status, setStatus] = useState('Готово.');
  const [isUploading, setIsUploading] = useState(false);

  function downloadPreview() {
    if (!previewCanvas) {
      setStatus('Нет готового preview canvas для экспорта.');
      return;
    }
    const link = document.createElement('a');
    link.href = previewCanvas.toDataURL('image/png');
    link.download = `${activeProfile?.id || 'sprite_studio_preview'}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus('PNG preview скачан локально.');
  }

  async function uploadPreview() {
    if (!previewCanvas) {
      setStatus('Нет preview canvas для upload.');
      return;
    }
    setIsUploading(true);
    try {
      const dataUrl = previewCanvas.toDataURL('image/png');
      const fileName = `${activeProfile?.id || 'sprite_studio_preview'}.png`;
      const file = dataUrlToFile(dataUrl, fileName);
      const stored = await imageService.upload(file, {
        id: activeProfile?.id ? `${activeProfile.id}_preview` : undefined,
        name: fileName,
        folder: buildUploadFolder('images', 'sprite-studio', activeProfile?.id || 'preview'),
        replaceIfExists: true,
      });
      onUploaded?.(stored);
      setStatus(`Preview загружен через image pipeline: ${stored.id}`);
    } catch (error) {
      setStatus(`Ошибка upload preview: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="admin-form-panel">
      <h4>Art export</h4>
      <p className="muted">
        Контент-база хранит только JSON metadata и refs. PNG export живёт отдельно: локальная загрузка
        или upload через текущий image pipeline проекта.
      </p>
      <div className="admin-actions-row">
        <button type="button" onClick={downloadPreview} disabled={!previewCanvas}>
          Download PNG
        </button>
        <button type="button" onClick={() => { void uploadPreview(); }} disabled={!previewCanvas || isUploading}>
          {isUploading ? 'Uploading...' : 'Upload Preview To Images'}
        </button>
      </div>
      <p className="muted">{status}</p>
    </section>
  );
}

