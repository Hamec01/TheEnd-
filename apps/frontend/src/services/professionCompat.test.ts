import { describe, expect, it } from 'vitest';
import type { PlayerProfessionsState } from '@theend/rpg-domain';
import { getLegacyProfessionIdFromProfessions, playerHasProfessionCompat } from './professionCompat';

function createProfessionsState(ids: Array<'mining' | 'blacksmithing' | 'alchemy' | 'hunting'>): PlayerProfessionsState {
  return {
    professions: ids.map((professionId) => ({
      professionId,
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      skillPoints: 0,
      learnedSkillIds: [],
      selectedBranchIds: [],
      unlockedAt: '2026-05-20T00:00:00.000Z',
    })),
  };
}

describe('profession compatibility helpers', () => {
  it('matches blacksmithing and blacksmith aliases', () => {
    const player = {
      professions: createProfessionsState(['blacksmithing']),
    };

    expect(playerHasProfessionCompat(player, 'blacksmithing')).toBe(true);
    expect(playerHasProfessionCompat(player, 'blacksmith')).toBe(true);
  });

  it('matches mining and miner aliases', () => {
    const player = {
      professions: createProfessionsState(['mining']),
    };

    expect(playerHasProfessionCompat(player, 'mining')).toBe(true);
    expect(playerHasProfessionCompat(player, 'miner')).toBe(true);
  });

  it('keeps legacy professionId compatibility', () => {
    const legacyPlayer = {
      professionId: 'alchemist',
    };

    expect(playerHasProfessionCompat(legacyPlayer, 'alchemist')).toBe(true);
  });

  it('returns a legacy profession id from unlocked professions', () => {
    const legacyId = getLegacyProfessionIdFromProfessions(createProfessionsState(['hunting']));
    expect(legacyId).toBe('hunter');
  });
});
