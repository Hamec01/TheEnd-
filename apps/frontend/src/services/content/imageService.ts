import type { StoredImage } from './models';
import { deleteContentEntry, getContentCollection, getContentEntry, replaceContentImage, uploadContentImage } from './contentApi';
import { IMAGE_PRESETS, type ImagePresetId } from './imagePresets';

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image for resize'));
    image.src = dataUrl;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function resizeDataUrl(dataUrl: string, width: number, height: number): Promise<string> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context unavailable');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const srcRatio = image.width / image.height;
  const dstRatio = width / height;

  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (srcRatio > dstRatio) {
    sw = image.height * dstRatio;
    sx = (image.width - sw) / 2;
  } else if (srcRatio < dstRatio) {
    sh = image.width / dstRatio;
    sy = (image.height - sh) / 2;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

export const imageService = {
  async getAll(): Promise<StoredImage[]> {
    return getContentCollection<StoredImage>('images');
  },

  async get(id: string): Promise<StoredImage | null> {
    return getContentEntry<StoredImage>('images', id);
  },

  async upload(file: File, options?: { id?: string; name?: string; folder?: string; replaceIfExists?: boolean }): Promise<StoredImage> {
    const dataUrl = await fileToDataUrl(file);
    const image = await loadImage(dataUrl);
    const normalizedId = options?.id?.trim() || undefined;
    const payload = {
      ...(normalizedId ? { id: normalizedId } : {}),
      name: file.name,
      ...(options?.name?.trim() ? { name: options.name.trim() } : {}),
      ...(options?.folder?.trim() ? { folder: options.folder.trim() } : {}),
      mimeType: file.type || 'image/png',
      width: image.width,
      height: image.height,
      dataUrl,
    };

    try {
      return await uploadContentImage(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const shouldReplace = Boolean(
        options?.replaceIfExists
        && normalizedId
        && message.toLowerCase().includes('duplicate images id'),
      );
      if (!shouldReplace || !normalizedId) {
        throw error;
      }

      return replaceContentImage(normalizedId, {
        name: payload.name,
        mimeType: payload.mimeType,
        width: payload.width,
        height: payload.height,
        dataUrl: payload.dataUrl,
      });
    }
  },

  async uploadResized(file: File, width: number, height: number, options?: { id?: string; name?: string; folder?: string }): Promise<StoredImage> {
    const originalDataUrl = await fileToDataUrl(file);
    const resizedDataUrl = await resizeDataUrl(originalDataUrl, width, height);
    return uploadContentImage({
      ...(options?.id?.trim() ? { id: options.id.trim() } : {}),
      name: options?.name?.trim() || file.name,
      ...(options?.folder?.trim() ? { folder: options.folder.trim() } : {}),
      mimeType: 'image/png',
      width,
      height,
      dataUrl: resizedDataUrl,
    });
  },

  async uploadPreset(file: File, presetId: ImagePresetId, options?: { id?: string; name?: string; folder?: string }): Promise<StoredImage> {
    const preset = IMAGE_PRESETS[presetId];
    return this.uploadResized(file, preset.width, preset.height, options);
  },

  async replaceResized(imageId: string, file: File, width: number, height: number, options?: { name?: string }): Promise<StoredImage> {
    const originalDataUrl = await fileToDataUrl(file);
    const resizedDataUrl = await resizeDataUrl(originalDataUrl, width, height);
    return replaceContentImage(imageId, {
      name: options?.name?.trim() || file.name,
      mimeType: 'image/png',
      dataUrl: resizedDataUrl,
      width,
      height,
    });
  },

  async replacePreset(imageId: string, file: File, presetId: ImagePresetId, options?: { name?: string }): Promise<StoredImage> {
    const preset = IMAGE_PRESETS[presetId];
    return this.replaceResized(imageId, file, preset.width, preset.height, options);
  },

  async resize(imageId: string, width: number, height: number): Promise<StoredImage> {
    const found = await this.get(imageId);
    if (!found) {
      throw new Error(`Image not found: ${imageId}`);
    }
    const dataUrl = await resizeDataUrl(found.dataUrl, width, height);
    return replaceContentImage(imageId, {
      name: found.name,
      mimeType: 'image/png',
      dataUrl,
      width,
      height,
    });
  },

  async delete(imageId: string): Promise<void> {
    await deleteContentEntry('images', imageId);
  },
};
