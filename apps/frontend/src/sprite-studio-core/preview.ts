import type { SpriteAnchorKey } from '@theend/rpg-domain';
import type { ImageSheetDefinition, StoredImage } from '../services/content/models';
import type { ResolvedCharacterVisual } from './resolvedModel';

const imageCache = new Map<string, HTMLImageElement>();

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  const normalized = src.trim();
  if (!normalized) {
    return null;
  }
  const cached = imageCache.get(normalized);
  if (cached) {
    return cached;
  }
  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => resolve(null);
    next.src = normalized;
  });
  if (image) {
    imageCache.set(normalized, image);
  }
  return image;
}

function resolveImageSource(layer: ResolvedCharacterVisual['layers'][number], runtimeImages: StoredImage[], imageSheets: ImageSheetDefinition[]) {
  if (layer.imageRef?.type === 'tileset') {
    const tilesetRef = layer.imageRef;
    const sheet = imageSheets.find((entry) => entry.id === tilesetRef.sheetId);
    if (!sheet) {
      return { src: '' };
    }
    const imageEntry = runtimeImages.find((entry) => entry.id === sheet.src);
    const source = imageEntry?.dataUrl ?? sheet.src;
    const col = tilesetRef.frame % sheet.columns;
    const row = Math.floor(tilesetRef.frame / sheet.columns);
    return {
      src: source,
      crop: {
        x: col * sheet.frameWidth,
        y: row * sheet.frameHeight,
        width: sheet.frameWidth,
        height: sheet.frameHeight,
      },
    };
  }

  const probe = layer.imageRef?.type === 'image'
    ? layer.imageRef.src
    : String(layer.imagePath ?? layer.imageId ?? '').trim();
  if (!probe) {
    return { src: '' };
  }
  if (probe.startsWith('/') || probe.startsWith('http') || probe.startsWith('data:')) {
    return { src: probe };
  }
  const imageEntry = runtimeImages.find((entry) => entry.id === probe);
  return { src: imageEntry?.dataUrl ?? probe };
}

function drawFallbackPreview(ctx: CanvasRenderingContext2D, resolved: ResolvedCharacterVisual, viewportSize: number) {
  ctx.fillStyle = '#2b2318';
  ctx.fillRect(0, 0, viewportSize, viewportSize);
  ctx.fillStyle = '#caa46a';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Legacy fallback', viewportSize / 2, viewportSize / 2 - 8);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#f2dfba';
  const fallbackLabel = resolved.surface === 'battle'
    ? (resolved.fallback.combatImageUrl || resolved.fallback.battleSpriteAssetId || 'legacy combat visual')
    : (resolved.fallback.fullImageUrl || resolved.fallback.portraitUrl || resolved.fallback.iconUrl || 'legacy portrait visual');
  ctx.fillText(fallbackLabel, viewportSize / 2, viewportSize / 2 + 14, viewportSize - 24);
}

function drawFxMarker(
  ctx: CanvasRenderingContext2D,
  resolved: ResolvedCharacterVisual,
  layer: ResolvedCharacterVisual['layers'][number],
  originX: number,
  originY: number,
  scale: number,
) {
  const point = layer.anchorName ? resolved.anchors[layer.anchorName] : resolved.anchors.castFxAnchor;
  if (!point) {
    return;
  }
  const x = originX + point.x * scale;
  const y = originY + point.y * scale;
  ctx.beginPath();
  ctx.fillStyle = 'rgba(105, 198, 255, 0.85)';
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5fbff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(layer.notes || 'FX', x + 14, y + 4);
}

function drawAnchors(
  ctx: CanvasRenderingContext2D,
  resolved: ResolvedCharacterVisual,
  originX: number,
  originY: number,
  scale: number,
) {
  const markerColors: Record<SpriteAnchorKey, string> = {
    headAnchor: '#f4c27a',
    chestAnchor: '#dba85a',
    rightHandAnchor: '#87d7ff',
    leftHandAnchor: '#96ffcf',
    offhandAnchor: '#7fffd4',
    shieldAnchor: '#95b7ff',
    backAnchor: '#b992ff',
    weaponTipAnchor: '#ff8f8f',
    projectileSpawnAnchor: '#ffdd7a',
    castFxAnchor: '#8ef8ff',
    hitFxAnchor: '#ffb58f',
    feetAnchor: '#c8ff7f',
    shadowAnchor: '#7f7f7f',
  };

  ctx.font = '10px sans-serif';
  for (const key of Object.keys(markerColors) as SpriteAnchorKey[]) {
    const point = resolved.anchors[key];
    if (!point) {
      continue;
    }
    const x = originX + point.x * scale;
    const y = originY + point.y * scale;
    ctx.beginPath();
    ctx.fillStyle = markerColors[key];
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface SpriteStudioPreviewInput {
  canvas: HTMLCanvasElement;
  resolved: ResolvedCharacterVisual;
  runtimeImages: StoredImage[];
  imageSheets: ImageSheetDefinition[];
  showAnchors?: boolean;
}

export async function drawSpriteStudioPreview(input: SpriteStudioPreviewInput): Promise<void> {
  const { canvas, resolved, runtimeImages, imageSheets, showAnchors = true } = input;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const viewportSize = canvas.width || 256;
  const frameWidth = resolved.frame.width || 128;
  const frameHeight = resolved.frame.height || 128;
  ctx.clearRect(0, 0, viewportSize, viewportSize);
  ctx.fillStyle = 'rgba(14, 10, 6, 0.92)';
  ctx.fillRect(0, 0, viewportSize, viewportSize);

  const scale = Math.min(viewportSize / frameWidth, viewportSize / frameHeight) * 0.82;
  const originX = (viewportSize - frameWidth * scale) / 2;
  const originY = (viewportSize - frameHeight * scale) / 2;

  if (resolved.layers.length === 0 && resolved.fallback.used) {
    drawFallbackPreview(ctx, resolved, viewportSize);
  }

  for (const layer of resolved.layers) {
    if (!layer.visible) {
      continue;
    }
    if (layer.source === 'fx') {
      drawFxMarker(ctx, resolved, layer, originX, originY, scale);
      continue;
    }

    const source = resolveImageSource(layer, runtimeImages, imageSheets);
    const image = await loadImage(source.src);
    const opacity = layer.opacity ?? 1;
    ctx.save();
    ctx.globalAlpha = opacity;
    if (image) {
      if (source.crop) {
        ctx.drawImage(
          image,
          source.crop.x,
          source.crop.y,
          source.crop.width,
          source.crop.height,
          originX,
          originY,
          source.crop.width * scale,
          source.crop.height * scale,
        );
      } else {
        ctx.drawImage(image, originX, originY, frameWidth * scale, frameHeight * scale);
      }
    } else {
      ctx.fillStyle = 'rgba(212, 165, 98, 0.35)';
      ctx.fillRect(originX, originY, frameWidth * scale, frameHeight * scale);
      ctx.fillStyle = '#1c140b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(layer.group, originX + (frameWidth * scale) / 2, originY + (frameHeight * scale) / 2);
    }
    ctx.restore();
  }

  if (showAnchors) {
    drawAnchors(ctx, resolved, originX, originY, scale);
  }

  ctx.fillStyle = '#e8d2a8';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${resolved.surface.toUpperCase()} | ${resolved.resolvedAction ?? 'static'}`, 12, 18);
}
