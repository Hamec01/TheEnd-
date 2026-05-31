import type { GameImageRef, ImageSheetCategory, ImageSheetDefinition, StoredImage } from './models';
import { resolveStoredImageSource } from './runtimeImageService';

export const IMAGE_SHEETS: Record<string, ImageSheetDefinition> = {
  materials_tileset_128: {
    id: 'materials_tileset_128',
    name: 'Materials Tileset 128',
    category: 'materials',
    src: '/assets/tilesets/materials_tileset_128.png',
    frameWidth: 128,
    frameHeight: 128,
    columns: 8,
    rows: 8,
  },
};

const CUSTOM_IMAGE_SHEETS_STORAGE_KEY = 'theend.customImageSheets.v1';

let customImageSheetsCache: Record<string, ImageSheetDefinition> | null = null;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const intValue = Math.floor(parsed);
  return intValue > 0 ? intValue : fallback;
}

function normalizeSheetId(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeSheetName(value: unknown, fallbackId: string): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallbackId;
}

function normalizeSheetCategory(value: unknown): ImageSheetCategory {
  const normalized = String(value ?? '').trim().toLowerCase();
  switch (normalized) {
    case 'materials':
    case 'items':
    case 'npcs':
    case 'quests':
    case 'ui':
      return normalized;
    default:
      return 'other';
  }
}

function normalizeSheetSrc(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeSheetDefinition(input: unknown): ImageSheetDefinition | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const raw = input as Record<string, unknown>;
  const id = normalizeSheetId(raw.id);
  const src = normalizeSheetSrc(raw.src);
  if (!id || !src) {
    return null;
  }

  const frameWidth = normalizePositiveInt(raw.frameWidth, 1);
  const frameHeight = normalizePositiveInt(raw.frameHeight, 1);
  const columns = normalizePositiveInt(raw.columns, 1);
  const rows = normalizePositiveInt(raw.rows, 1);

  return {
    id,
    name: normalizeSheetName(raw.name, id),
    category: normalizeSheetCategory(raw.category),
    src,
    frameWidth,
    frameHeight,
    columns,
    rows,
  };
}

function ensureCustomImageSheetsLoaded(): Record<string, ImageSheetDefinition> {
  if (customImageSheetsCache) {
    return customImageSheetsCache;
  }
  if (typeof window === 'undefined') {
    customImageSheetsCache = {};
    return customImageSheetsCache;
  }

  const raw = safeParse<Record<string, unknown>>(
    window.localStorage.getItem(CUSTOM_IMAGE_SHEETS_STORAGE_KEY),
    {},
  );

  const normalizedEntries = Object.entries(raw)
    .map(([, value]) => normalizeSheetDefinition(value))
    .filter((entry): entry is ImageSheetDefinition => Boolean(entry));

  customImageSheetsCache = Object.fromEntries(normalizedEntries.map((entry) => [entry.id, entry]));
  return customImageSheetsCache;
}

function persistCustomImageSheets(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const cache = ensureCustomImageSheetsLoaded();
  window.localStorage.setItem(CUSTOM_IMAGE_SHEETS_STORAGE_KEY, JSON.stringify(cache));
}

export function registerCustomImageSheet(input: ImageSheetDefinition): ImageSheetDefinition {
  const normalized = normalizeSheetDefinition(input);
  if (!normalized) {
    throw new Error('Invalid image sheet definition.');
  }
  const cache = ensureCustomImageSheetsLoaded();
  cache[normalized.id] = normalized;
  persistCustomImageSheets();
  return normalized;
}

export function removeCustomImageSheet(sheetId: string): void {
  const normalizedId = normalizeSheetId(sheetId);
  if (!normalizedId) {
    return;
  }
  const cache = ensureCustomImageSheetsLoaded();
  if (!cache[normalizedId]) {
    return;
  }
  delete cache[normalizedId];
  persistCustomImageSheets();
}

export function getCustomImageSheets(): ImageSheetDefinition[] {
  return Object.values(ensureCustomImageSheetsLoaded());
}

export function getImageSheet(sheetId: string | null | undefined): ImageSheetDefinition | undefined {
  const normalized = sheetId?.trim();
  if (!normalized) {
    return undefined;
  }
  return IMAGE_SHEETS[normalized] ?? ensureCustomImageSheetsLoaded()[normalized];
}

export function getImageSheetsByCategory(category?: ImageSheetCategory): ImageSheetDefinition[] {
  const all = [...Object.values(IMAGE_SHEETS), ...getCustomImageSheets()];
  if (!category) {
    return all;
  }
  return all.filter((sheet) => sheet.category === category);
}

export function getImageSheetTotalFrames(sheet: ImageSheetDefinition): number {
  return Math.max(1, sheet.columns * sheet.rows);
}

export function getTilesetFrameRect(sheet: ImageSheetDefinition, frame: number): { x: number; y: number; width: number; height: number } {
  const safeFrame = Math.max(0, Math.floor(frame));
  const col = safeFrame % sheet.columns;
  const row = Math.floor(safeFrame / sheet.columns);
  return {
    x: col * sheet.frameWidth,
    y: row * sheet.frameHeight,
    width: sheet.frameWidth,
    height: sheet.frameHeight,
  };
}

export function validateGameImageRef(ref: GameImageRef | null | undefined): string[] {
  if (!ref) {
    return [];
  }

  if (ref.type === 'image') {
    return ref.src.trim() ? [] : ['image src is required'];
  }

  if (ref.type === 'tileset') {
    const sheet = getImageSheet(ref.sheetId);
    if (!sheet) {
      return [`tileset sheet not found: ${ref.sheetId}`];
    }
    if (!Number.isInteger(ref.frame) || ref.frame < 0 || ref.frame >= getImageSheetTotalFrames(sheet)) {
      return [`tileset frame out of range: ${ref.frame}`];
    }
    return [];
  }

  return ['unsupported image ref type'];
}

export function normalizeGameImageRef(
  ref: unknown,
  legacyImagePath?: string | null,
): GameImageRef | undefined {
  if (ref && typeof ref === 'object' && !Array.isArray(ref)) {
    const input = ref as Record<string, unknown>;
    const type = String(input.type ?? '').trim();

    if (type === 'image') {
      const src = String(input.src ?? '').trim();
      if (src) {
        return { type: 'image', src };
      }
    }

    if (type === 'tileset') {
      const sheetId = String(input.sheetId ?? '').trim();
      const frame = Number(input.frame);
      if (sheetId && Number.isInteger(frame)) {
        const candidate: GameImageRef = { type: 'tileset', sheetId, frame };
        if (validateGameImageRef(candidate).length === 0) {
          return candidate;
        }
      }
    }
  }

  const fallback = String(legacyImagePath ?? '').trim();
  if (fallback) {
    return { type: 'image', src: fallback };
  }

  return undefined;
}

export function toLegacyImagePath(ref: GameImageRef | null | undefined): string | undefined {
  if (!ref) {
    return undefined;
  }
  return ref.type === 'image' ? ref.src.trim() || undefined : undefined;
}

export function resolveGameImageRefSource(
  ref: GameImageRef | null | undefined,
  runtimeImages: StoredImage[],
): string | undefined {
  if (!ref) {
    return undefined;
  }

  if (ref.type === 'image') {
    return resolveStoredImageSource(ref.src, runtimeImages);
  }

  const sheet = getImageSheet(ref.sheetId);
  if (!sheet) {
    return undefined;
  }
  return resolveStoredImageSource(sheet.src, runtimeImages) ?? sheet.src;
}

export function formatGameImageRefLabel(ref: GameImageRef | null | undefined): string {
  if (!ref) {
    return 'none';
  }
  if (ref.type === 'image') {
    return `image:${ref.src}`;
  }
  return `tileset:${ref.sheetId}#${ref.frame}`;
}
