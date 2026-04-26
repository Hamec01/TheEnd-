import { imageService } from './imageService';
function isDirectImageSource(value) {
    return value.startsWith('data:') || value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://');
}
export async function loadRuntimeImages() {
    return imageService.getAll();
}
export function resolveStoredImageSource(imageKey, images) {
    const normalized = imageKey?.trim();
    if (!normalized) {
        return undefined;
    }
    if (isDirectImageSource(normalized)) {
        return normalized;
    }
    const stored = images.find((image) => image.id === normalized);
    return stored?.dataUrl;
}
export function resolveItemImageSource(item, images) {
    if (!item) {
        return undefined;
    }
    return resolveStoredImageSource(item.icon, images);
}
export function resolveMerchantImageSource(merchant, images) {
    if (!merchant) {
        return undefined;
    }
    return resolveStoredImageSource(merchant.portraitPath, images);
}
