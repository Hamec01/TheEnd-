import type {
  EquipmentVisualBindingDefinition,
  SpriteActionType,
  SpriteAnchorSet,
  SpriteBodyAuthoringDefinition,
  SpriteBodyTemplateDefinition,
  SpriteEquipmentVisualAuthoringDefinition,
  SpriteVectorDocument,
  SpriteVectorLayer,
  SpriteVisualAssetDefinition,
  SpriteVisualFittingAnchor,
} from '@theend/rpg-domain';
import { createDefaultAnchorSet, createDefaultBodyAuthoring, createDefaultEquipmentVisualAuthoring, nowIso } from './defaults';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function sanitizeColor(value: string | undefined, fallback: string): string {
  const normalized = String(value ?? '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized) ? normalized : fallback;
}

function normalizeSlider(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return round(clamp(numeric, min, max));
}

export function normalizeBodyAuthoring(input: Partial<SpriteBodyAuthoringDefinition> | undefined): SpriteBodyAuthoringDefinition {
  const defaults = createDefaultBodyAuthoring();
  return {
    raceId: String(input?.raceId ?? defaults.raceId ?? '').trim() || defaults.raceId,
    bodyPresentation: input?.bodyPresentation === 'female' ? 'female' : 'male',
    skinColor: sanitizeColor(input?.skinColor, defaults.skinColor),
    underwearColor: sanitizeColor(input?.underwearColor, defaults.underwearColor),
    bodyHeight: normalizeSlider(input?.bodyHeight, defaults.bodyHeight, 0.7, 1.4),
    shoulderWidth: normalizeSlider(input?.shoulderWidth, defaults.shoulderWidth, 0.7, 1.5),
    torsoWidth: normalizeSlider(input?.torsoWidth, defaults.torsoWidth, 0.7, 1.4),
    bellySize: normalizeSlider(input?.bellySize, defaults.bellySize, 0, 1.2),
    armSize: normalizeSlider(input?.armSize, defaults.armSize, 0.6, 1.5),
    legSize: normalizeSlider(input?.legSize, defaults.legSize, 0.6, 1.5),
    headSize: normalizeSlider(input?.headSize, defaults.headSize, 0.7, 1.4),
    neckLength: normalizeSlider(input?.neckLength, defaults.neckLength, 0.1, 1.2),
  };
}

export function normalizeEquipmentVisualAuthoring(input: Partial<SpriteEquipmentVisualAuthoringDefinition> | undefined): SpriteEquipmentVisualAuthoringDefinition {
  const defaults = createDefaultEquipmentVisualAuthoring(input?.category);
  return {
    category: input?.category ?? defaults.category,
    primaryColor: sanitizeColor(input?.primaryColor, defaults.primaryColor),
    secondaryColor: sanitizeColor(input?.secondaryColor, defaults.secondaryColor),
    accentColor: sanitizeColor(input?.accentColor, defaults.accentColor),
    outlineColor: sanitizeColor(input?.outlineColor, defaults.outlineColor),
    outlineEnabled: input?.outlineEnabled !== false,
    width: normalizeSlider(input?.width, defaults.width, 0.3, 2),
    height: normalizeSlider(input?.height, defaults.height, 0.3, 2),
    length: normalizeSlider(input?.length, defaults.length, 0.3, 2.2),
    thickness: normalizeSlider(input?.thickness, defaults.thickness, 0.1, 1.5),
    shapePreset: String(input?.shapePreset ?? defaults.shapePreset).trim() || defaults.shapePreset,
    materialPreset: String(input?.materialPreset ?? defaults.materialPreset).trim() || defaults.materialPreset,
    rotation: normalizeSlider(input?.rotation, defaults.rotation, -180, 180),
    scale: normalizeSlider(input?.scale, defaults.scale, 0.4, 2),
  };
}

function createLayer(id: string, name: string, shape: SpriteVectorLayer['shape'], fill: string, transform: SpriteVectorLayer['transform'], extra?: Partial<SpriteVectorLayer>): SpriteVectorLayer {
  return {
    id,
    name,
    shape,
    fill,
    transform,
    opacity: 1,
    visible: true,
    zIndex: 0,
    ...extra,
  };
}

export function buildBodyAnchors(authoring: SpriteBodyAuthoringDefinition): SpriteAnchorSet {
  const bodyHeightPx = 54 * authoring.bodyHeight;
  const headSizePx = 20 * authoring.headSize;
  const shoulderWidthPx = 18 * authoring.shoulderWidth;
  const torsoWidthPx = 20 * authoring.torsoWidth;
  const armOffset = shoulderWidthPx + 6;
  const hipY = 42 + bodyHeightPx * 0.16;
  const headCenterY = 18 + headSizePx * 0.15;

  return {
    headAnchor: { x: 64, y: round(headCenterY) },
    chestAnchor: { x: 64, y: round(44 + bodyHeightPx * 0.08) },
    rightHandAnchor: { x: round(64 + armOffset), y: round(70 + bodyHeightPx * 0.04) },
    leftHandAnchor: { x: round(64 - armOffset), y: round(70 + bodyHeightPx * 0.04) },
    offhandAnchor: { x: round(64 - armOffset - 4), y: round(68 + bodyHeightPx * 0.04) },
    shieldAnchor: { x: round(64 - armOffset - 8), y: round(66 + bodyHeightPx * 0.04) },
    backAnchor: { x: round(64 - torsoWidthPx * 0.3), y: round(50 + bodyHeightPx * 0.06) },
    weaponTipAnchor: { x: round(64 + armOffset + 22), y: round(50 + bodyHeightPx * 0.02) },
    projectileSpawnAnchor: { x: round(64 + armOffset + 10), y: round(48 + bodyHeightPx * 0.02) },
    castFxAnchor: { x: round(64 + shoulderWidthPx * 0.25), y: round(36 + bodyHeightPx * 0.02) },
    hitFxAnchor: { x: 64, y: round(44 + bodyHeightPx * 0.04) },
    feetAnchor: { x: 64, y: round(84 + bodyHeightPx * 0.45) },
    shadowAnchor: { x: 64, y: round(92 + bodyHeightPx * 0.45) },
  };
}

export function buildBodyVectorDocument(template: SpriteBodyTemplateDefinition): SpriteVectorDocument {
  const authoring = normalizeBodyAuthoring(template.authoring);
  const now = nowIso();
  const headSize = 22 * authoring.headSize;
  const torsoWidth = 26 * authoring.torsoWidth;
  const bodyHeight = 34 * authoring.bodyHeight;
  const bellyWidth = torsoWidth * (0.78 + authoring.bellySize * 0.42);
  const shoulderWidth = torsoWidth * (1 + (authoring.shoulderWidth - 1) * 0.5);
  const armWidth = 10 * authoring.armSize;
  const legWidth = 12 * authoring.legSize;
  const neckHeight = 6 + authoring.neckLength * 8;
  const anchors = buildBodyAnchors(authoring);

  return {
    id: template.vectorDocumentId || `${template.id}_vector`,
    schemaVersion: 1,
    name: `${template.name} vector`,
    kind: 'body',
    width: 128,
    height: 128,
    anchors,
    parameterValues: {
      ...authoring,
    },
    layers: [
      createLayer('legs', 'Legs', 'rounded_rect', authoring.skinColor, {
        x: 64 - legWidth,
        y: 58,
        width: legWidth * 2,
        height: 30 + bodyHeight * 0.46,
      }, { zIndex: 1 }),
      createLayer('torso', 'Torso', 'rounded_rect', authoring.skinColor, {
        x: 64 - torsoWidth / 2,
        y: 34 + neckHeight,
        width: torsoWidth,
        height: bodyHeight,
      }, { zIndex: 2 }),
      createLayer('belly', 'Belly', 'ellipse', authoring.skinColor, {
        x: 64 - bellyWidth / 2,
        y: 46 + neckHeight,
        width: bellyWidth,
        height: 18 + authoring.bellySize * 12,
      }, { opacity: 0.92, zIndex: 3 }),
      createLayer('arms', 'Arms', 'rounded_rect', authoring.skinColor, {
        x: 64 - shoulderWidth / 2 - armWidth * 0.15,
        y: 40 + neckHeight,
        width: shoulderWidth + armWidth * 0.3,
        height: 12 + bodyHeight * 0.64,
      }, { zIndex: 4 }),
      createLayer('underwear', 'Underwear', 'rounded_rect', authoring.underwearColor, {
        x: 64 - torsoWidth * 0.4,
        y: 60 + neckHeight,
        width: torsoWidth * 0.8,
        height: 14,
      }, { zIndex: 5 }),
      createLayer('head', 'Head', 'ellipse', authoring.skinColor, {
        x: 64 - headSize / 2,
        y: 14,
        width: headSize,
        height: headSize * 1.06,
      }, { zIndex: 6 }),
    ],
    createdAt: template.createdAt || now,
    updatedAt: now,
  };
}

export function buildEquipmentVectorDocument(asset: SpriteVisualAssetDefinition): SpriteVectorDocument {
  const authoring = normalizeEquipmentVisualAuthoring(asset.equipmentAuthoring);
  const now = nowIso();
  const baseWidth = 24 * authoring.width * authoring.scale;
  const baseHeight = 24 * authoring.height * authoring.scale;
  const baseLength = 44 * authoring.length * authoring.scale;
  const stroke = authoring.outlineEnabled
    ? { color: authoring.outlineColor, width: 2, enabled: true }
    : undefined;
  const layers: SpriteVectorLayer[] = [];

  if (authoring.category === 'sword' || authoring.category === 'dagger' || authoring.category === 'axe' || authoring.category === 'spear' || authoring.category === 'staff') {
    layers.push(
      createLayer('haft', 'Haft', 'rect', authoring.secondaryColor, {
        x: 57,
        y: 58,
        width: 14 * authoring.thickness,
        height: 28,
        rotation: authoring.rotation,
      }, { stroke, zIndex: 2 }),
    );
    layers.push(
      createLayer('blade', 'Blade', authoring.category === 'axe' ? 'polygon' : 'rect', authoring.primaryColor, {
        x: 64 - baseWidth / 4,
        y: authoring.category === 'dagger' ? 24 : 12,
        width: Math.max(8, baseWidth * 0.5),
        height: authoring.category === 'staff' ? baseLength * 0.9 : baseLength,
        rotation: authoring.rotation,
        points: authoring.category === 'axe'
          ? [{ x: 72, y: 18 }, { x: 96, y: 22 }, { x: 90, y: 48 }, { x: 72, y: 42 }]
          : undefined,
      }, { stroke, zIndex: 3 }),
    );
    layers.push(
      createLayer('accent', 'Accent', 'rect', authoring.accentColor, {
        x: 59,
        y: 48,
        width: 10,
        height: 8,
        rotation: authoring.rotation,
      }, { stroke, zIndex: 4 }),
    );
  } else if (authoring.category === 'bow') {
    layers.push(
      createLayer('bow_arc', 'Bow Arc', 'polygon', authoring.secondaryColor, {
        points: [{ x: 42, y: 20 }, { x: 78, y: 42 }, { x: 42, y: 94 }, { x: 52, y: 94 }, { x: 88, y: 42 }, { x: 52, y: 20 }],
        rotation: authoring.rotation,
      }, { stroke, zIndex: 2 }),
    );
    layers.push(
      createLayer('bow_string', 'Bow String', 'line', authoring.primaryColor, {
        points: [{ x: 44, y: 22 }, { x: 82, y: 42 }, { x: 44, y: 92 }],
        rotation: authoring.rotation,
      }, { stroke: { color: authoring.primaryColor, width: 2, enabled: true }, zIndex: 3 }),
    );
  } else if (authoring.category === 'shield' || authoring.category === 'helmet' || authoring.category === 'chest_armor' || authoring.category === 'gloves' || authoring.category === 'boots') {
    layers.push(
      createLayer('shell', 'Shell', authoring.category === 'helmet' ? 'ellipse' : 'rounded_rect', authoring.primaryColor, {
        x: 64 - baseWidth / 2,
        y: 64 - baseHeight / 2,
        width: baseWidth,
        height: authoring.category === 'chest_armor' ? baseHeight * 1.2 : baseHeight,
        rotation: authoring.rotation,
      }, { stroke, zIndex: 2 }),
    );
    layers.push(
      createLayer('detail', 'Detail', 'rounded_rect', authoring.secondaryColor, {
        x: 64 - baseWidth * 0.28,
        y: 64 - baseHeight * 0.12,
        width: baseWidth * 0.56,
        height: baseHeight * 0.24,
        rotation: authoring.rotation,
      }, { stroke, zIndex: 3 }),
    );
    layers.push(
      createLayer('accent', 'Accent', 'ellipse', authoring.accentColor, {
        x: 64 - 8,
        y: 64 - 8,
        width: 16,
        height: 16,
        rotation: authoring.rotation,
      }, { stroke, zIndex: 4 }),
    );
  }

  return {
    id: asset.vectorDocumentId || `${asset.id}_vector`,
    schemaVersion: 1,
    name: `${asset.name} vector`,
    kind: 'equipment',
    width: 128,
    height: 128,
    layers,
    anchors: undefined,
    parameterValues: {
      ...authoring,
    },
    createdAt: asset.createdAt || now,
    updatedAt: now,
  };
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawVectorLayer(ctx: CanvasRenderingContext2D, layer: SpriteVectorLayer) {
  if (layer.visible === false) {
    return;
  }
  const opacity = layer.opacity ?? 1;
  const rotation = ((layer.transform.rotation ?? 0) * Math.PI) / 180;
  const x = layer.transform.x ?? 0;
  const y = layer.transform.y ?? 0;
  const width = layer.transform.width ?? 0;
  const height = layer.transform.height ?? 0;
  const points = layer.transform.points ?? [];

  ctx.save();
  ctx.globalAlpha = opacity;
  if (rotation) {
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(rotation);
    ctx.translate(-(x + width / 2), -(y + height / 2));
  }
  ctx.fillStyle = layer.fill;
  if (layer.shape === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (layer.shape === 'rect') {
    ctx.fillRect(x, y, width, height);
  } else if (layer.shape === 'rounded_rect') {
    drawRoundedRect(ctx, x, y, width, height, Math.min(12, width / 4, height / 4));
    ctx.fill();
  } else if (layer.shape === 'line' && points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (const point of points.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.strokeStyle = layer.fill;
    ctx.lineWidth = layer.stroke?.width ?? 2;
    ctx.stroke();
  } else if (layer.shape === 'polygon' && points.length > 2) {
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (const point of points.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  if (layer.stroke?.enabled !== false && layer.stroke?.color) {
    ctx.strokeStyle = layer.stroke.color;
    ctx.lineWidth = layer.stroke.width;
    if (layer.shape === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (layer.shape === 'rect') {
      ctx.strokeRect(x, y, width, height);
    } else if (layer.shape === 'rounded_rect') {
      drawRoundedRect(ctx, x, y, width, height, Math.min(12, width / 4, height / 4));
      ctx.stroke();
    } else if (layer.shape === 'polygon' && points.length > 2) {
      ctx.beginPath();
      ctx.moveTo(points[0]!.x, points[0]!.y);
      for (const point of points.slice(1)) {
        ctx.lineTo(point.x, point.y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export async function renderVectorDocumentToDataUrl(vectorDocument: SpriteVectorDocument, size = 128): Promise<string> {
  if (typeof vectorDocument === 'undefined') {
    return '';
  }
  const canvas = window.document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return '';
  }
  ctx.clearRect(0, 0, size, size);
  const scaleX = size / Math.max(1, vectorDocument.width);
  const scaleY = size / Math.max(1, vectorDocument.height);
  ctx.save();
  ctx.scale(scaleX, scaleY);
  for (const layer of [...vectorDocument.layers].sort((left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0))) {
    drawVectorLayer(ctx, layer);
  }
  ctx.restore();
  return canvas.toDataURL('image/png');
}

export function fittingAnchorToSpriteAnchor(anchor: SpriteVisualFittingAnchor | undefined): keyof SpriteAnchorSet | undefined {
  switch (anchor) {
    case 'head':
      return 'headAnchor';
    case 'torso':
      return 'chestAnchor';
    case 'back':
      return 'backAnchor';
    case 'left_hand':
      return 'leftHandAnchor';
    case 'right_hand':
      return 'rightHandAnchor';
    case 'left_forearm':
      return 'offhandAnchor';
    case 'right_forearm':
      return 'weaponTipAnchor';
    case 'left_foot':
    case 'right_foot':
      return 'feetAnchor';
    default:
      return undefined;
  }
}

export function normalizeBindingFitting(binding: EquipmentVisualBindingDefinition): EquipmentVisualBindingDefinition {
  const supportedActions = Array.isArray(binding.supportedActions) && binding.supportedActions.length > 0
    ? Array.from(new Set(binding.supportedActions.filter(Boolean))) as SpriteActionType[]
    : ['idle', 'walk', 'attack_melee', 'attack_ranged'] as SpriteActionType[];
  return {
    ...binding,
    supportedActions,
    preferredAnchor: binding.preferredAnchor ?? 'right_hand',
    secondaryAnchor: binding.secondaryAnchor,
    twoHanded: binding.twoHanded === true || binding.weaponGripType === 'bow' || binding.weaponGripType === 'two_handed',
    bodyRelativeScale: typeof binding.bodyRelativeScale === 'number' ? binding.bodyRelativeScale : 1,
    bodyRelativeWidth: typeof binding.bodyRelativeWidth === 'number' ? binding.bodyRelativeWidth : 1,
    bodyRelativeHeight: typeof binding.bodyRelativeHeight === 'number' ? binding.bodyRelativeHeight : 1,
  };
}
