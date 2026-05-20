import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { extname, join, resolve } from 'path';

const rootDir = process.cwd();
const defaultContentFile = join(rootDir, 'apps', 'backend', 'data', 'theend_content.local.json');
const contentFile = resolve(process.argv[2] ?? process.env.CONTENT_DATA_FILE ?? defaultContentFile);
const assetsDir = resolve(process.argv[3] ?? process.env.CONTENT_ASSETS_DIR ?? join(rootDir, 'Resurse', 'assets', 'upload'));
const publicPrefix = String(process.env.CONTENT_ASSETS_PUBLIC_PREFIX ?? '/assets/upload').replace(/\/+$/, '') || '/assets/upload';

function isEmbeddedDataUrl(value) {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value ?? '').trim());
}

function slugifyFileName(value) {
  const baseName = String(value ?? 'image')
    .replace(/\.[a-z0-9]+$/i, '')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  return baseName || 'image';
}

function extensionFromMime(mimeType) {
  switch (String(mimeType ?? '').toLowerCase()) {
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

function extensionFromName(name) {
  const ext = extname(String(name ?? '')).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext) ? ext : '';
}

function writeImageAsset(image) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(image.dataUrl ?? '').trim());
  if (!match) {
    return null;
  }

  const mimeType = String(image.mimeType ?? match[1] ?? 'image/png').trim() || 'image/png';
  const safeId = slugifyFileName(image.id);
  const safeName = slugifyFileName(image.name);
  const ext = extensionFromName(image.name) || extensionFromMime(mimeType);
  const fileName = `${safeId}-${safeName}${ext}`;

  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(join(assetsDir, fileName), Buffer.from(match[2] ?? '', 'base64'));

  return {
    ...image,
    mimeType,
    dataUrl: `${publicPrefix}/${fileName}`,
    updatedAt: new Date().toISOString(),
  };
}

if (!existsSync(contentFile)) {
  console.error(`[image-assets] Content JSON not found: ${contentFile}`);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(contentFile, 'utf8').replace(/^\uFEFF/, ''));
const content = raw && typeof raw === 'object' && raw.content && typeof raw.content === 'object'
  ? raw.content
  : raw;

if (!Array.isArray(content.images)) {
  console.log('[image-assets] No images collection found.');
  process.exit(0);
}

let converted = 0;
content.images = content.images.map((image) => {
  if (!image || typeof image !== 'object' || !isEmbeddedDataUrl(image.dataUrl)) {
    return image;
  }
  const next = writeImageAsset(image);
  if (next) {
    converted += 1;
    return next;
  }
  return image;
});

if (converted === 0) {
  console.log('[image-assets] No embedded image data URLs found.');
  process.exit(0);
}

const backupFile = `${contentFile}.before-image-assets-${Date.now()}.bak`;
copyFileSync(contentFile, backupFile);
writeFileSync(contentFile, JSON.stringify(raw, null, 2), 'utf8');

console.log(`[image-assets] Converted ${converted} image(s).`);
console.log(`[image-assets] Assets: ${assetsDir}`);
console.log(`[image-assets] Backup: ${backupFile}`);
