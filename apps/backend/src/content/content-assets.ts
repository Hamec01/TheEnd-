import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, isAbsolute, join, resolve } from 'path';

const DEFAULT_PUBLIC_PREFIX = '/assets/upload';

export interface StoredImageAssetInput {
  id?: string;
  name?: string;
  mimeType?: string;
  folder?: string;
  dataUrl: string;
}

export interface StoredImageAssetResult {
  publicUrl: string;
  mimeType: string;
}

export interface StoredAudioAssetInput {
  id?: string;
  name?: string;
  mimeType?: string;
  folder?: string;
  dataUrl: string;
}

export interface StoredAudioAssetResult {
  publicUrl: string;
  mimeType: string;
}

function normalizeEnvPath(value: string | undefined): string {
  return String(value ?? '').trim();
}

function resolveWorkspaceRoot(): string {
  const cwd = process.cwd();
  const candidates = [
    resolve(cwd, '..', '..'),
    resolve(cwd, '..'),
    cwd,
  ];

  return candidates.find((candidate) =>
    existsSync(join(candidate, 'package.json')) && existsSync(join(candidate, 'Resurse')),
  ) ?? cwd;
}

export function getContentAssetsPublicPrefix(): string {
  const configured = normalizeEnvPath(process.env.CONTENT_ASSETS_PUBLIC_PREFIX);
  if (!configured) {
    return DEFAULT_PUBLIC_PREFIX;
  }
  return configured.startsWith('/') ? configured : `/${configured}`;
}

export function resolveContentAssetsDir(): string {
  const configured = normalizeEnvPath(process.env.CONTENT_ASSETS_DIR);
  const workspaceRoot = resolveWorkspaceRoot();
  const fallback = join(workspaceRoot, 'Resurse', 'assets', 'upload');
  if (!configured) {
    return fallback;
  }
  return isAbsolute(configured) ? configured : join(workspaceRoot, configured);
}

export function ensureContentAssetsDir(): string {
  const dir = resolveContentAssetsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function slugifyFileName(value: string | undefined): string {
  const baseName = String(value ?? 'image')
    .replace(/\.[a-z0-9]+$/i, '')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  return baseName || 'image';
}

function sanitizeFolderPath(value: string | undefined): string[] {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return [];
  }

  return raw
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '.' && part !== '..')
    .map((part) => slugifyFileName(part))
    .filter(Boolean)
    .slice(0, 10);
}

function extensionFromMime(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/svg+xml':
      return '.svg';
    case 'image/png':
    default:
      return '.png';
  }
}

function extensionFromName(name: string | undefined): string {
  const ext = extname(String(name ?? '')).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext) ? ext : '';
}

function extensionFromAudioMime(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'audio/mpeg':
    case 'audio/mp3':
      return '.mp3';
    case 'audio/wav':
    case 'audio/x-wav':
      return '.wav';
    case 'audio/mp4':
    case 'audio/x-m4a':
      return '.m4a';
    case 'audio/webm':
      return '.webm';
    case 'audio/ogg':
    default:
      return '.ogg';
  }
}

function extensionFromAudioName(name: string | undefined): string {
  const ext = extname(String(name ?? '')).toLowerCase();
  return ['.ogg', '.mp3', '.wav', '.m4a', '.webm'].includes(ext) ? ext : '';
}

export function isEmbeddedDataUrl(value: string | undefined): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value ?? '').trim());
}

export function isEmbeddedAudioDataUrl(value: string | undefined): boolean {
  return /^data:audio\/[a-z0-9.+-]+;base64,/i.test(String(value ?? '').trim());
}

export function writeStoredImageAsset(input: StoredImageAssetInput): StoredImageAssetResult {
  const dataUrl = input.dataUrl.trim();
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error('Expected image data URL.');
  }

  const mimeType = input.mimeType?.trim() || match[1] || 'image/png';
  const rawId = input.id?.trim() || `img_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const id = slugifyFileName(rawId);
  const ext = extensionFromName(input.name) || extensionFromMime(mimeType);
  const fileName = `${id}-${slugifyFileName(input.name)}${ext}`;
  const dir = ensureContentAssetsDir();
  const folderSegments = sanitizeFolderPath(input.folder);
  const targetDir = folderSegments.length > 0 ? join(dir, ...folderSegments) : dir;
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  const bytes = Buffer.from(match[2] ?? '', 'base64');

  writeFileSync(join(targetDir, fileName), bytes);

  const publicPath = folderSegments.length > 0
    ? `${getContentAssetsPublicPrefix()}/${folderSegments.join('/')}/${fileName}`
    : `${getContentAssetsPublicPrefix()}/${fileName}`;

  return {
    publicUrl: publicPath,
    mimeType,
  };
}

export function writeStoredAudioAsset(input: StoredAudioAssetInput): StoredAudioAssetResult {
  const dataUrl = input.dataUrl.trim();
  const match = /^data:(audio\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error('Expected audio data URL.');
  }

  const mimeType = input.mimeType?.trim() || match[1] || 'audio/ogg';
  const rawId = input.id?.trim() || `aud_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const id = slugifyFileName(rawId);
  const ext = extensionFromAudioName(input.name) || extensionFromAudioMime(mimeType);
  const fileName = `${id}-${slugifyFileName(input.name ?? 'audio')}${ext}`;
  const dir = ensureContentAssetsDir();
  const folderSegments = sanitizeFolderPath(input.folder);
  const targetDir = folderSegments.length > 0 ? join(dir, ...folderSegments) : dir;
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  const bytes = Buffer.from(match[2] ?? '', 'base64');

  writeFileSync(join(targetDir, fileName), bytes);

  const publicPath = folderSegments.length > 0
    ? `${getContentAssetsPublicPrefix()}/${folderSegments.join('/')}/${fileName}`
    : `${getContentAssetsPublicPrefix()}/${fileName}`;

  return {
    publicUrl: publicPath,
    mimeType,
  };
}
