import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveVisibleWorldOverlayZones } from './worldOverlayVisibility';
import type { WorldMapZone } from './zoneEditorTypes';

function createZone(overrides: Partial<WorldMapZone> & Pick<WorldMapZone, 'id' | 'name' | 'type'>): WorldMapZone {
  return {
    id: overrides.id,
    name: overrides.name,
    type: overrides.type,
    shape: overrides.shape ?? 'circle',
    x: overrides.x ?? 0.4,
    y: overrides.y ?? 0.5,
    radius: overrides.radius ?? 0.05,
    editorLayer: overrides.editorLayer ?? 'areas',
    interactionMode: overrides.interactionMode,
    playerClickable: overrides.playerClickable,
    blocksClick: overrides.blocksClick,
    passiveEffects: overrides.passiveEffects,
    isVisibleToPlayer: overrides.isVisibleToPlayer ?? true,
    isDiscovered: overrides.isDiscovered ?? true,
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
  } as WorldMapZone;
}

describe('world renderer regressions', () => {
  it('excludes hidden and undiscovered kingdom overlays from the Phaser render layer input', () => {
    const zones = [
      createZone({ id: 'visible_kingdom', name: 'Visible Kingdom', type: 'kingdom_area' }),
      createZone({ id: 'hidden_kingdom', name: 'Hidden Kingdom', type: 'kingdom_area', isVisibleToPlayer: false }),
      createZone({ id: 'undiscovered_kingdom', name: 'Undiscovered Kingdom', type: 'kingdom_area', isDiscovered: false }),
    ];

    expect(resolveVisibleWorldOverlayZones(zones, 'kingdom_area').map((zone) => zone.id)).toEqual(['visible_kingdom']);
  });

  it('wires the shared screen-space entity hit-test path into both renderers', () => {
    const canvasSource = readFileSync(new URL('./WorldMapCanvas.tsx', import.meta.url), 'utf8');
    const phaserSource = readFileSync(new URL('./PhaserWorldMapCanvas.tsx', import.meta.url), 'utf8');

    expect(canvasSource).toContain('screenPointPx');
    expect(canvasSource).toContain('renderedEntities: sceneSnapshot?.renderedActiveEntities ?? []');
    expect(phaserSource).toContain('screenPointPx');
    expect(phaserSource).toContain('renderedEntities: sceneSnapshot?.renderedActiveEntities ?? []');
  });
});