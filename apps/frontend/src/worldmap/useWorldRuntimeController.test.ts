import { describe, expect, it } from 'vitest';
import { resolveWorldRuntimeReportedState, shouldOpenPendingWorldLocation } from './useWorldRuntimeController';
import type { WorldMapZone } from './zoneEditorTypes';

function createCityZone(): WorldMapZone {
  return {
    id: 'city_arklein',
    name: 'Arklein',
    type: 'city',
    shape: 'circle',
    x: 0.45,
    y: 0.52,
    radius: 0.04,
    editorLayer: 'locations',
    interactionMode: 'enter',
    playerClickable: true,
    blocksClick: true,
    isVisibleToPlayer: true,
    isDiscovered: true,
    createdAt: 1,
    updatedAt: 1,
  } as WorldMapZone;
}

describe('useWorldRuntimeController helpers', () => {
  it('reports in_city for idle city occupancy and moving while travel is active', () => {
    const city = createCityZone();

    expect(resolveWorldRuntimeReportedState('idle', city)).toBe('in_city');
    expect(resolveWorldRuntimeReportedState('moving', city)).toBe('moving');
    expect(resolveWorldRuntimeReportedState('idle', null)).toBe('idle');
  });

  it('opens a pending location only after the player reached the matching zone and stopped moving', () => {
    const city = createCityZone();

    expect(shouldOpenPendingWorldLocation('city_arklein', city, {
      x: 0.45,
      y: 0.52,
      targetX: null,
      targetY: null,
    })).toBe(true);

    expect(shouldOpenPendingWorldLocation('city_arklein', city, {
      x: 0.45,
      y: 0.52,
      targetX: 0.46,
      targetY: 0.53,
    })).toBe(false);

    expect(shouldOpenPendingWorldLocation('other_city', city, {
      x: 0.45,
      y: 0.52,
      targetX: null,
      targetY: null,
    })).toBe(false);
  });
});