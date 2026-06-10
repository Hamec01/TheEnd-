import type { GameImageRef, StoredImage } from './models';
import { imageService } from './imageService';
import type { ImagePresetId } from './imagePresets';
import { getImageSheet } from './gameImageRefs';
import { resolveStoredImageSource } from './runtimeImageService';

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image for crop'));
    image.src = dataUrl;
  });
}

async function fetchToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToFile(dataUrl: string, name: string): File {
  const match = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!match) {
    throw new Error('Invalid data URL');
  }
  const mimeType = match[1] ?? 'image/png';
  const base64 = match[2] ?? '';
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: mimeType });
}

export async function materializeTilesetFrameToPreset(
  ref: GameImageRef | null | undefined,
  options: {
    presetId: ImagePresetId;
    runtimeImages?: StoredImage[];
    folder?: string;
    id?: string;
    name?: string;
  },
): Promise<{ imageId: string; dataUrl?: string; updatedAt?: string } | null> {
  if (!ref || ref.type !== 'tileset') {
    return null;
  }

  const sheet = getImageSheet(ref.sheetId);
  if (!sheet) {
    throw new Error(`Tileset not found: ${ref.sheetId}`);
  }

  const frameWidth = Math.max(1, Math.floor(sheet.frameWidth));
  const frameHeight = Math.max(1, Math.floor(sheet.frameHeight));
  const columns = Math.max(1, Math.floor(sheet.columns));
  const frameIndex = Math.max(0, Math.floor(ref.frame));
  const sx = (frameIndex % columns) * frameWidth;
  const sy = Math.floor(frameIndex / columns) * frameHeight;

  let sheetDataUrl = '';
  const sheetSrc = sheet.src.trim();
  if (!sheetSrc) {
    throw new Error(`Tileset src is empty: ${sheet.id}`);
  }

  const stored = await imageService.get(sheetSrc);
  if (stored?.dataUrl) {
    sheetDataUrl = stored.dataUrl;
  } else if (sheetSrc.startsWith('data:')) {
    sheetDataUrl = sheetSrc;
  } else {
    const resolved = resolveStoredImageSource(sheetSrc, options.runtimeImages ?? []) ?? sheetSrc;
    sheetDataUrl = await fetchToDataUrl(resolved);
  }

  const image = await loadImage(sheetDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context unavailable');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, sx, sy, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
  const croppedDataUrl = canvas.toDataURL('image/png');

  const file = dataUrlToFile(croppedDataUrl, `${options.name ?? options.id ?? 'frame'}.png`);
  const uploaded = await imageService.uploadPreset(file, options.presetId, {
    id: options.id,
    name: options.name,
    folder: options.folder,
    replaceIfExists: Boolean(options.id?.trim()),
  });
  return { imageId: uploaded.id, dataUrl: uploaded.dataUrl, updatedAt: uploaded.updatedAt };
}
