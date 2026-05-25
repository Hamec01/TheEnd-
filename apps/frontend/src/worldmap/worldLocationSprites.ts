import { getZoneCenter } from './zoneGeometry';
import type { LocationSpriteConfig, WorldMapZone } from './zoneEditorTypes';

export interface WorldSpriteCamera {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface WorldSpriteViewport {
  width: number;
  height: number;
}

export interface ResolvedLocationSprite {
  zone: WorldMapZone;
  imageSrc: string;
  capturedBannerSrc?: string;
  config: LocationSpriteConfig;
  screenX: number;
  screenY: number;
  displayWidth: number;
  displayHeight: number;
  originX: number;
  originY: number;
  zIndex: number;
}

const STATE_KEYS = new Set(['active', 'hidden', 'destroyed', 'locked']);
const KINGDOM_BANNER_SOURCES: Record<string, string> = {
  luminor: '/assets/banners/luminor.png',
  artalon: '/assets/banners/atalion.png',
  atalion: '/assets/banners/atalion.png',
  kriantar: '/assets/banners/kriatar.png',
  kriatar: '/assets/banners/kriatar.png',
  terimia: '/assets/banners/terimia.png',
  teremia: '/assets/banners/terimia.png',
  argos: '/assets/banners/argos.png',
  feralas: '/assets/banners/feralas.png',
  dwarf: '/assets/banners/dwarf.png',
  dwarves: '/assets/banners/dwarf.png',
  forest_elfs: '/assets/banners/forest_elfs.png',
  forest_elves: '/assets/banners/forest_elfs.png',
  high_elfs: '/assets/banners/hight_elfs.png',
  high_elves: '/assets/banners/hight_elfs.png',
};

export function isDirectImageSource(value: string): boolean {
  return value.startsWith('/')
    || value.startsWith('data:')
    || value.startsWith('http://')
    || value.startsWith('https://');
}

export function resolveWorldImageSource(imageRef: string): string {
  const normalized = imageRef.trim();
  if (!normalized || isDirectImageSource(normalized)) {
    return normalized;
  }
  return `/api/content/images/${encodeURIComponent(normalized)}/raw`;
}

export function getZoneCurrentState(zone: WorldMapZone): string {
  const raw = String(zone.currentState ?? 'active').trim();
  return raw || 'active';
}

function normalizeBannerKey(value: string | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^origin_/, '')
    .replace(/[^a-z0-9_ -]+/g, '')
    .replace(/[\s-]+/g, '_');
}

export function resolveCapturedBannerSource(zone: WorldMapZone): string | undefined {
  if (getZoneCurrentState(zone) !== 'captured') {
    return undefined;
  }

  const kingdomKey = normalizeBannerKey(zone.kingdomId);
  if (kingdomKey && KINGDOM_BANNER_SOURCES[kingdomKey]) {
    return KINGDOM_BANNER_SOURCES[kingdomKey];
  }

  const factionKey = normalizeBannerKey(zone.faction);
  return factionKey ? KINGDOM_BANNER_SOURCES[factionKey] : undefined;
}

export function resolveZoneSpriteImageRef(zone: WorldMapZone): string {
  const currentState = getZoneCurrentState(zone);
  const stateSprite = STATE_KEYS.has(currentState)
    ? zone.stateSprites?.[currentState as keyof NonNullable<WorldMapZone['stateSprites']>]
    : undefined;
  return String(stateSprite || zone.locationSprite?.imageUrl || zone.locationSprite?.assetKey || '').trim();
}

export function isZoneSpriteVisible(zone: WorldMapZone, discoveredLocationIds?: Set<string>, discoveredZoneIds?: Set<string>): boolean {
  const sprite = zone.locationSprite;
  if (!sprite || sprite.visibleOnWorldMap !== true) {
    return false;
  }
  if (zone.isVisibleToPlayer === false || zone.hidden === true) {
    return false;
  }

  const locationId = zone.linkedLocationId ?? zone.linkedLocation ?? zone.id;
  const discovered = zone.isDiscovered === true
    || discoveredZoneIds?.has(zone.id) === true
    || discoveredLocationIds?.has(locationId) === true;
  if (zone.requiresDiscovery === true && !discovered) {
    return false;
  }

  return Boolean(resolveZoneSpriteImageRef(zone));
}

export function resolveLocationSpritesForViewport(
  zones: WorldMapZone[],
  camera: WorldSpriteCamera,
  viewport: WorldSpriteViewport,
  imageSizes: Map<string, { width: number; height: number }>,
  discoveredLocationIds?: Set<string>,
  discoveredZoneIds?: Set<string>,
): ResolvedLocationSprite[] {
  const sprites: ResolvedLocationSprite[] = [];
  for (const zone of zones) {
    if (!isZoneSpriteVisible(zone, discoveredLocationIds, discoveredZoneIds) || !zone.locationSprite) {
      continue;
    }

    const imageRef = resolveZoneSpriteImageRef(zone);
    const imageSrc = resolveWorldImageSource(imageRef);
    const capturedBannerSrc = resolveCapturedBannerSource(zone);
    const imageSize = imageSizes.get(imageSrc) ?? { width: 48, height: 48 };
    const [worldX, worldY] = getZoneCenter(zone);
    const screenX = ((worldX - camera.left) / camera.width) * viewport.width + zone.locationSprite.offsetX;
    const screenY = ((worldY - camera.top) / camera.height) * viewport.height + zone.locationSprite.offsetY;
    const scale = Math.max(0.01, zone.locationSprite.scale);
    const displayWidth = Math.max(1, imageSize.width * scale);
    const displayHeight = Math.max(1, imageSize.height * scale);
    const originX = 0.5;
    const originY = zone.locationSprite.anchor === 'center' ? 0.5 : 1;

    if (
      screenX + displayWidth < 0
      || screenY + displayHeight < 0
      || screenX - displayWidth > viewport.width
      || screenY - displayHeight > viewport.height
    ) {
      continue;
    }

    sprites.push({
      zone,
      imageSrc,
      capturedBannerSrc,
      config: zone.locationSprite,
      screenX,
      screenY,
      displayWidth,
      displayHeight,
      originX,
      originY,
      zIndex: zone.locationSprite.zIndex,
    });
  }

  return sprites.sort((left, right) => left.zIndex - right.zIndex);
}

export function findClickedLocationSprite(
  zones: WorldMapZone[],
  screenPointPx: { x: number; y: number },
  camera: WorldSpriteCamera,
  viewport: WorldSpriteViewport,
  imageSizes: Map<string, { width: number; height: number }>,
  discoveredLocationIds?: Set<string>,
  discoveredZoneIds?: Set<string>,
): WorldMapZone | null {
  const sprites = resolveLocationSpritesForViewport(zones, camera, viewport, imageSizes, discoveredLocationIds, discoveredZoneIds);
  for (const sprite of [...sprites].sort((left, right) => right.zIndex - left.zIndex)) {
    const left = sprite.screenX - sprite.displayWidth * sprite.originX;
    const top = sprite.screenY - sprite.displayHeight * sprite.originY;
    if (
      screenPointPx.x >= left
      && screenPointPx.x <= left + sprite.displayWidth
      && screenPointPx.y >= top
      && screenPointPx.y <= top + sprite.displayHeight
    ) {
      return sprite.zone;
    }
  }
  return null;
}
