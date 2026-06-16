import type {
  EquipmentVisualBindingDefinition,
  SkillAnimationBindingDefinition,
  SpriteAnchorKey,
  SpriteAnimationSetDefinition,
  SpriteBodyTemplateDefinition,
  SpriteProfileDefinition,
  SpriteSurface,
} from '@theend/rpg-domain';
import type { AdminVisualFx, GameImageRef, ImageSheetDefinition, StoredImage } from '../services/content/models';

const imageCache = new Map<string, HTMLImageElement>();

function spriteRefToGameImageRef(ref: unknown): GameImageRef | undefined {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    return undefined;
  }
  const input = ref as Record<string, unknown>;
  const type = String(input.type ?? '').trim();
  if (type === 'image') {
    const src = String(input.src ?? '').trim();
    return src ? { type: 'image', src } : undefined;
  }
  if (type === 'tileset') {
    const sheetId = String(input.sheetId ?? '').trim();
    const frame = Number(input.frame);
    if (!sheetId || !Number.isFinite(frame)) {
      return undefined;
    }
    return { type: 'tileset', sheetId, frame: Math.max(0, Math.floor(frame)) };
  }
  return undefined;
}

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

function resolveImageSource(ref: GameImageRef | undefined, legacyImagePath: string | undefined, runtimeImages: StoredImage[], imageSheets: ImageSheetDefinition[]): {
  src: string;
  crop?: { x: number; y: number; width: number; height: number };
} {
  if (ref?.type === 'tileset') {
    const sheet = imageSheets.find((entry) => entry.id === ref.sheetId);
    if (!sheet) {
      return { src: '' };
    }
    const imageEntry = runtimeImages.find((entry) => entry.id === sheet.src);
    const source = imageEntry?.dataUrl ?? sheet.src;
    const col = ref.frame % sheet.columns;
    const row = Math.floor(ref.frame / sheet.columns);
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

  const probe = ref?.type === 'image' ? ref.src : String(legacyImagePath ?? '').trim();
  if (!probe) {
    return { src: '' };
  }
  if (probe.startsWith('/') || probe.startsWith('http') || probe.startsWith('data:')) {
    return { src: probe };
  }
  const imageEntry = runtimeImages.find((entry) => entry.id === probe);
  return { src: imageEntry?.dataUrl ?? probe };
}

export interface SpriteStudioPreviewInput {
  canvas: HTMLCanvasElement;
  profile: SpriteProfileDefinition | null;
  bodyTemplate: SpriteBodyTemplateDefinition | null;
  animationSet: SpriteAnimationSetDefinition | null;
  equipmentBindings: EquipmentVisualBindingDefinition[];
  skillBinding: SkillAnimationBindingDefinition | null;
  visualFx: AdminVisualFx | null;
  surface: SpriteSurface;
  runtimeImages: StoredImage[];
  imageSheets: ImageSheetDefinition[];
  selectedAction: string;
}

function getSurfaceAsset(entry: {
  paperdoll?: { imageRef?: unknown; imagePath?: string; scale?: number; offsetX?: number; offsetY?: number };
  world?: { imageRef?: unknown; imagePath?: string; scale?: number; offsetX?: number; offsetY?: number };
  battle?: { imageRef?: unknown; imagePath?: string; scale?: number; offsetX?: number; offsetY?: number };
}, surface: SpriteSurface) {
  if (surface === 'paperdoll') {
    return entry.paperdoll;
  }
  if (surface === 'world') {
    return entry.world;
  }
  return entry.battle;
}

function clipFrameSize(animationSet: SpriteAnimationSetDefinition | null, selectedAction: string): { width: number; height: number } {
  const clip = animationSet?.clips.find((entry) => entry.action === selectedAction) ?? animationSet?.clips[0];
  return {
    width: clip?.frameWidth ?? 128,
    height: clip?.frameHeight ?? 128,
  };
}

function anchorPoint(template: SpriteBodyTemplateDefinition | null, key: SpriteAnchorKey, frameWidth: number, frameHeight: number): { x: number; y: number } {
  const point = template?.anchors?.[key];
  if (!point) {
    return { x: frameWidth / 2, y: frameHeight / 2 };
  }
  return { x: point.x, y: point.y };
}

export async function drawSpriteStudioPreview(input: SpriteStudioPreviewInput): Promise<void> {
  const { canvas, profile, bodyTemplate, animationSet, equipmentBindings, skillBinding, visualFx, surface, runtimeImages, imageSheets, selectedAction } = input;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  const { width: frameWidth, height: frameHeight } = clipFrameSize(animationSet, selectedAction);
  const viewportSize = 256;
  canvas.width = viewportSize;
  canvas.height = viewportSize;
  ctx.clearRect(0, 0, viewportSize, viewportSize);
  ctx.fillStyle = 'rgba(14, 10, 6, 0.92)';
  ctx.fillRect(0, 0, viewportSize, viewportSize);

  const scale = Math.min(viewportSize / frameWidth, viewportSize / frameHeight) * 0.82;
  const originX = (viewportSize - frameWidth * scale) / 2;
  const originY = (viewportSize - frameHeight * scale) / 2;

  const bodySurface = getSurfaceAsset(bodyTemplate ?? {}, surface);
  const bodySource = resolveImageSource(spriteRefToGameImageRef(bodySurface?.imageRef), bodySurface?.imagePath, runtimeImages, imageSheets);
  const bodyImage = await loadImage(bodySource.src);
  if (bodyImage) {
    if (bodySource.crop) {
      ctx.drawImage(bodyImage, bodySource.crop.x, bodySource.crop.y, bodySource.crop.width, bodySource.crop.height, originX + (bodySurface?.offsetX ?? 0), originY + (bodySurface?.offsetY ?? 0), bodySource.crop.width * scale * (bodySurface?.scale ?? 1), bodySource.crop.height * scale * (bodySurface?.scale ?? 1));
    } else {
      ctx.drawImage(bodyImage, originX + (bodySurface?.offsetX ?? 0), originY + (bodySurface?.offsetY ?? 0), frameWidth * scale * (bodySurface?.scale ?? 1), frameHeight * scale * (bodySurface?.scale ?? 1));
    }
  } else {
    ctx.fillStyle = '#2b2318';
    ctx.fillRect(originX, originY, frameWidth * scale, frameHeight * scale);
    ctx.fillStyle = '#caa46a';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(profile?.name || bodyTemplate?.name || 'No body art', viewportSize / 2, viewportSize / 2);
  }

  for (const binding of equipmentBindings) {
    const bindingSurface = getSurfaceAsset(binding, surface);
    const bindingSource = resolveImageSource(spriteRefToGameImageRef(bindingSurface?.imageRef), bindingSurface?.imagePath, runtimeImages, imageSheets);
    const bindingImage = await loadImage(bindingSource.src);
    const preferredAnchor: SpriteAnchorKey =
      binding.weaponGripType === 'shield' ? 'shieldAnchor'
        : binding.weaponGripType === 'off_hand' ? 'offhandAnchor'
          : binding.equipmentSlot === 'head' ? 'headAnchor'
            : binding.equipmentSlot === 'chest' || binding.equipmentSlot === 'outerwear' ? 'chestAnchor'
              : binding.equipmentSlot === 'belt' ? 'backAnchor'
                : 'rightHandAnchor';
    const point = anchorPoint(bodyTemplate, preferredAnchor, frameWidth, frameHeight);
    const drawX = originX + point.x * scale - 28 + (bindingSurface?.offsetX ?? 0);
    const drawY = originY + point.y * scale - 28 + (bindingSurface?.offsetY ?? 0);
    const drawSize = 56 * (bindingSurface?.scale ?? 1);
    if (bindingImage) {
      if (bindingSource.crop) {
        ctx.drawImage(bindingImage, bindingSource.crop.x, bindingSource.crop.y, bindingSource.crop.width, bindingSource.crop.height, drawX, drawY, drawSize, drawSize);
      } else {
        ctx.drawImage(bindingImage, drawX, drawY, drawSize, drawSize);
      }
    } else {
      ctx.fillStyle = 'rgba(212, 165, 98, 0.85)';
      ctx.fillRect(drawX, drawY, drawSize, drawSize);
      ctx.fillStyle = '#1c140b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(binding.equipmentSlot, drawX + drawSize / 2, drawY + drawSize / 2);
    }
  }

  if (skillBinding || visualFx) {
    const fxPoint = anchorPoint(bodyTemplate, skillBinding?.sourceAnchor ?? 'castFxAnchor', frameWidth, frameHeight);
    ctx.beginPath();
    ctx.fillStyle = 'rgba(105, 198, 255, 0.85)';
    ctx.arc(originX + fxPoint.x * scale, originY + fxPoint.y * scale, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5fbff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(skillBinding?.name || visualFx?.name || 'FX', originX + fxPoint.x * scale + 14, originY + fxPoint.y * scale + 4);
  }

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

  if (bodyTemplate) {
    ctx.font = '10px sans-serif';
    for (const key of Object.keys(markerColors) as SpriteAnchorKey[]) {
      const point = anchorPoint(bodyTemplate, key, frameWidth, frameHeight);
      const x = originX + point.x * scale;
      const y = originY + point.y * scale;
      ctx.beginPath();
      ctx.fillStyle = markerColors[key];
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = '#e8d2a8';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${surface.toUpperCase()} • ${selectedAction}`, 12, 18);
}

