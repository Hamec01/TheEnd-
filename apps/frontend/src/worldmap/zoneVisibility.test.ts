import { describe, expect, it } from 'vitest';
import { isWorldMapZoneVisibleForPlayer } from './zoneVisibility';
import type { WorldMapZone } from './zoneEditorTypes';
import type { PlayerQuestState } from '../types/quest';

function createBaseZone(fields?: Partial<WorldMapZone>): WorldMapZone {
  return {
    id: 'test_zone',
    name: 'Test Zone',
    type: 'location',
    shape: 'circle',
    x: 0.5,
    y: 0.5,
    radius: 0.05,
    description: 'A test zone',
    isDiscovered: true,
    isVisibleToPlayer: true,
    dangerLevel: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...fields,
  };
}

describe('zoneVisibility helpers', () => {
  it('zone without visibilityConditions keeps old behavior', () => {
    // visible by default
    const zone = createBaseZone();
    expect(isWorldMapZoneVisibleForPlayer(zone)).toBe(true);

    // hidden if isVisibleToPlayer is false
    const hiddenZone = createBaseZone({ isVisibleToPlayer: false });
    expect(isWorldMapZoneVisibleForPlayer(hiddenZone)).toBe(false);
  });

  it('zone visibleWhenQuestStatus active is hidden when quest not taken', () => {
    const zone = createBaseZone({
      visibilityConditions: {
        visibleWhenQuestId: 'argos_quest_field_of_the_fallen',
        visibleWhenQuestStatus: 'active',
      },
    });

    // quest state: not taken / not_started
    const inactiveState: PlayerQuestState = {
      playerId: 'char_1',
      questId: 'argos_quest_field_of_the_fallen',
      status: 'not_started',
      completedStepIds: [],
      completedObjectiveIds: [],
      flags: {},
    };

    expect(isWorldMapZoneVisibleForPlayer(zone, inactiveState)).toBe(false);
    expect(isWorldMapZoneVisibleForPlayer(zone, undefined)).toBe(false);
  });

  it('zone visibleWhenQuestStatus active is visible when quest active', () => {
    const zone = createBaseZone({
      visibilityConditions: {
        visibleWhenQuestId: 'argos_quest_field_of_the_fallen',
        visibleWhenQuestStatus: 'active',
      },
    });

    // quest state: active
    const activeState: PlayerQuestState = {
      playerId: 'char_1',
      questId: 'argos_quest_field_of_the_fallen',
      status: 'active',
      completedStepIds: [],
      completedObjectiveIds: [],
      flags: {},
    };

    expect(isWorldMapZoneVisibleForPlayer(zone, activeState)).toBe(true);
  });

  it('zone hideAfterQuestCompleted hides after quest completed', () => {
    const zone = createBaseZone({
      visibilityConditions: {
        visibleWhenQuestId: 'argos_quest_field_of_the_fallen',
        visibleWhenQuestStatus: 'active',
        hideAfterQuestCompleted: true,
      },
    });

    const activeState: PlayerQuestState = {
      playerId: 'char_1',
      questId: 'argos_quest_field_of_the_fallen',
      status: 'active',
      completedStepIds: [],
      completedObjectiveIds: [],
      flags: {},
    };

    const completedState: PlayerQuestState = {
      playerId: 'char_1',
      questId: 'argos_quest_field_of_the_fallen',
      status: 'completed',
      completedStepIds: [],
      completedObjectiveIds: [],
      flags: {},
    };

    expect(isWorldMapZoneVisibleForPlayer(zone, activeState)).toBe(true);
    expect(isWorldMapZoneVisibleForPlayer(zone, completedState)).toBe(false);
  });

  it('admin/editor mode still shows the zone', () => {
    const zone = createBaseZone({
      isVisibleToPlayer: false,
      visibilityConditions: {
        visibleWhenQuestId: 'argos_quest_field_of_the_fallen',
        visibleWhenQuestStatus: 'active',
        hideAfterQuestCompleted: true,
      },
    });

    // isAdminMode = true bypasses all hiding logic
    expect(isWorldMapZoneVisibleForPlayer(zone, undefined, true)).toBe(true);
  });

  it('old city/resource/location zones are unaffected', () => {
    const cityZone = createBaseZone({ type: 'city' });
    const resourceZone = createBaseZone({ type: 'resource' });
    const locationZone = createBaseZone({ type: 'location' });

    expect(isWorldMapZoneVisibleForPlayer(cityZone)).toBe(true);
    expect(isWorldMapZoneVisibleForPlayer(resourceZone)).toBe(true);
    expect(isWorldMapZoneVisibleForPlayer(locationZone)).toBe(true);
  });
});
