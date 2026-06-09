import type { Zone } from './worldMapNodes';
import { getZoneCenter, isPointInZone } from './zoneGeometry';
import {
  getDefaultBlocksClick,
  getDefaultInteractionMode,
  getDefaultPassiveEffects,
  getDefaultPlayerClickable,
  type ZoneInteractionMode,
} from './zoneTaxonomy';

function getZoneInteractionPadding(zone: Zone): number {
  switch (zone.type) {
    case 'city':
      return 0.035;
    case 'settlement':
      return 0.025;
    case 'profession':
    case 'resource':
      return 0.015;
    default:
      return 0;
  }
}

function resolveZoneInteractionMode(zone: Zone): ZoneInteractionMode {
  return zone.interactionMode ?? getDefaultInteractionMode(zone.type);
}

function resolveZonePlayerClickable(zone: Zone): boolean {
  return typeof zone.playerClickable === 'boolean'
    ? zone.playerClickable
    : getDefaultPlayerClickable(zone.type);
}

function resolveZoneBlocksClick(zone: Zone): boolean {
  return typeof zone.blocksClick === 'boolean'
    ? zone.blocksClick
    : getDefaultBlocksClick(zone.type);
}

function resolveZonePassiveEffects(zone: Zone): boolean {
  if (typeof zone.passiveEffects === 'boolean') {
    return zone.passiveEffects;
  }
  if (Array.isArray(zone.passiveEffects)) {
    return zone.passiveEffects.length > 0;
  }
  const defaults = getDefaultPassiveEffects(zone.type);
  if (typeof defaults === 'boolean') {
    return defaults;
  }
  return defaults.length > 0;
}

function isHiddenAndNotVisible(zone: Zone): boolean {
  return zone.type === 'hidden_area' && zone.isVisibleToPlayer === false;
}

function getRuntimePriorityGroup(zone: Zone): number {
  const interactionMode = resolveZoneInteractionMode(zone);

  if (zone.editorLayer === 'locations' || zone.type === 'city' || zone.type === 'settlement' || zone.type === 'dungeon' || zone.type === 'landmark' || zone.type === 'transition') {
    return 0;
  }
  if (zone.editorLayer === 'quests' || interactionMode === 'quest' || zone.type === 'quest' || zone.type === 'quest_area' || zone.type === 'story' || zone.type === 'event') {
    return 1;
  }
  if (zone.editorLayer === 'resources' || zone.type === 'resource' || zone.type === 'resource_area' || zone.type === 'profession') {
    return 2;
  }
  if (zone.editorLayer === 'zones' || interactionMode === 'battle' || interactionMode === 'transition' || interactionMode === 'fast_travel' || interactionMode === 'rest' || interactionMode === 'locked') {
    return 3;
  }
  return 4;
}

function isPassiveOverlayZone(zone: Zone): boolean {
  if (isHiddenAndNotVisible(zone)) {
    return true;
  }

  if (resolveZonePassiveEffects(zone)) {
    return true;
  }

  const interactionMode = resolveZoneInteractionMode(zone);
  if ((interactionMode === 'none' || interactionMode === 'random_event' || interactionMode === 'danger' || interactionMode === 'resource') && !resolveZonePlayerClickable(zone)) {
    return true;
  }

  return ['kingdom_area', 'faction_area', 'city_area', 'danger_area', 'random_event_area', 'resource_area'].includes(zone.type);
}

export function getZonesAtPoint(zones: Zone[], x: number, y: number): Zone[] {
  const matches = zones.filter((zone) => isInsideZone(zone, x, y, 0));
  return matches.sort((left, right) => {
    const groupOrder = getRuntimePriorityGroup(left) - getRuntimePriorityGroup(right);
    if (groupOrder !== 0) {
      return groupOrder;
    }
    const clickableOrder = Number(resolveZonePlayerClickable(right)) - Number(resolveZonePlayerClickable(left));
    if (clickableOrder !== 0) {
      return clickableOrder;
    }
    const blocksOrder = Number(resolveZoneBlocksClick(right)) - Number(resolveZoneBlocksClick(left));
    if (blocksOrder !== 0) {
      return blocksOrder;
    }
    return getDistanceToZoneCenter(left, x, y) - getDistanceToZoneCenter(right, x, y);
  });
}

export function getPassiveZonesAtPoint(zones: Zone[], x: number, y: number): Zone[] {
  return getZonesAtPoint(zones, x, y).filter((zone) => isPassiveOverlayZone(zone));
}

export function pickRuntimeClickTarget(zones: Zone[], x: number, y: number): Zone | null {
  const matches = getZonesAtPoint(zones, x, y);
  for (const zone of matches) {
    if (isHiddenAndNotVisible(zone)) {
      continue;
    }

    if (!resolveZonePlayerClickable(zone)) {
      continue;
    }

    const interactionMode = resolveZoneInteractionMode(zone);
    if (interactionMode === 'none') {
      continue;
    }
    if (interactionMode === 'random_event' || interactionMode === 'danger') {
      continue;
    }
    if (zone.type === 'resource_area') {
      continue;
    }
    return zone;
  }
  return null;
}

export function getDistanceToZoneCenter(zone: Zone, x: number, y: number): number {
  const [centerX, centerY] = getZoneCenter(zone);
  return Math.hypot(centerX - x, centerY - y);
}

export function isInsideZone(zone: Zone, x: number, y: number, extraRadius = 0): boolean {
  if (zone.shape === 'circle' && zone.x !== undefined && zone.y !== undefined) {
    const baseRadius = Number.isFinite(zone.radius) && (zone.radius ?? 0) > 0
      ? (zone.radius as number)
      : 0.03;
    const radius = Math.max(0.001, baseRadius + extraRadius);
    return Math.hypot(zone.x - x, zone.y - y) <= radius;
  }

  return isPointInZone([x, y], zone);
}

export function detectCurrentZone(zones: Zone[], x: number, y: number): Zone | null {
  const ordered = getZonesAtPoint(zones, x, y);
  for (const zone of ordered) {
    if (isPassiveOverlayZone(zone)) {
      continue;
    }
    return zone;
  }

  return null;
}

export function detectHoverZone(zones: Zone[], x: number, y: number): Zone | null {
  let nearest: Zone | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const zone of zones) {
    if (isHiddenAndNotVisible(zone)) {
      continue;
    }

    const extraRadius = zone.type === 'city' ? 0.002 : 0.01 + getZoneInteractionPadding(zone);
    if (!isInsideZone(zone, x, y, extraRadius)) {
      continue;
    }

    if (!resolveZonePlayerClickable(zone) && !isPassiveOverlayZone(zone)) {
      continue;
    }

    const distance = getDistanceToZoneCenter(zone, x, y);
    if (distance < nearestDistance) {
      nearest = zone;
      nearestDistance = distance;
    }
  }

  return nearest;
}
