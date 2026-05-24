import { uploadContentAudioAsset } from './contentApi';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export const audioService = {
  async upload(file: File, options?: { id?: string; name?: string; folder?: string }): Promise<{ assetId: string; publicUrl: string; mimeType: string }> {
    const dataUrl = await fileToDataUrl(file);
    return uploadContentAudioAsset({
      id: options?.id?.trim() || undefined,
      name: options?.name?.trim() || file.name,
      folder: options?.folder?.trim() || undefined,
      mimeType: file.type || 'audio/ogg',
      dataUrl,
    });
  },
};
