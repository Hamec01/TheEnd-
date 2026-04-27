import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { IMAGE_PRESETS } from './imagePresets';
import { nowIso, uid } from './storage';
function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load image for resize'));
        image.src = dataUrl;
    });
}
function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}
async function resizeDataUrl(dataUrl, width, height) {
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
    }
    else if (srcRatio < dstRatio) {
        sh = image.width / dstRatio;
        sy = (image.height - sh) / 2;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
    return canvas.toDataURL('image/png');
}
async function createStoredImage(fileName, mimeType, dataUrl, width, height) {
    return {
        id: uid('img'),
        name: fileName,
        mimeType,
        width,
        height,
        dataUrl,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };
}
export const imageService = {
    async getAll() {
        return getContentCollection('images');
    },
    async get(id) {
        return getContentEntry('images', id);
    },
    async upload(file) {
        const dataUrl = await fileToDataUrl(file);
        const image = await loadImage(dataUrl);
        const next = await createStoredImage(file.name, file.type || 'image/png', dataUrl, image.width, image.height);
        return createContentEntry('images', next);
    },
    async uploadResized(file, width, height, options) {
        const originalDataUrl = await fileToDataUrl(file);
        const resizedDataUrl = await resizeDataUrl(originalDataUrl, width, height);
        const next = await createStoredImage(options?.name?.trim() || file.name, 'image/png', resizedDataUrl, width, height);
        return createContentEntry('images', next);
    },
    async uploadPreset(file, presetId, options) {
        const preset = IMAGE_PRESETS[presetId];
        return this.uploadResized(file, preset.width, preset.height, options);
    },
    async resize(imageId, width, height) {
        const found = await this.get(imageId);
        if (!found) {
            throw new Error(`Image not found: ${imageId}`);
        }
        const dataUrl = await resizeDataUrl(found.dataUrl, width, height);
        const next = {
            ...found,
            dataUrl,
            width,
            height,
            updatedAt: nowIso(),
        };
        return updateContentEntry('images', imageId, next);
    },
    async delete(imageId) {
        await deleteContentEntry('images', imageId);
    },
};
