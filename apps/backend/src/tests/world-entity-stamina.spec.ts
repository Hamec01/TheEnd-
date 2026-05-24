import { describe, expect, it } from 'vitest';
import { applyWorldEntityStaminaTick, resolveWorldEntityStaminaDefaults } from '../worldsim/world-entity-stamina';

const defaults = {
  maxStamina: 150,
  regenPerTick: 5,
  moveCostPerWorldUnit: 220,
};

describe('world entity stamina', () => {
  it('uses default max/current stamina 150 when not defined', () => {
    const resolved = resolveWorldEntityStaminaDefaults({}, defaults);
    expect(resolved.maxStamina).toBe(150);
    expect(resolved.currentStamina).toBe(150);
  });

  it('spends stamina while moving and recovers when exhausted', () => {
    const moving = applyWorldEntityStaminaTick(
      {
        state: { currentStamina: 10, maxStamina: 150, staminaRegenPerTick: 5 },
        movementDistance: 0.1,
        regionType: 'swamp',
      },
      defaults,
    );
    expect(moving.currentStamina).toBeLessThanOrEqual(5);

    let state = {
      maxStamina: moving.maxStamina,
      currentStamina: 0,
      staminaRegenPerTick: moving.staminaRegenPerTick,
    };

    let guard = 0;
    while (state.currentStamina < state.maxStamina && guard < 200) {
      const tick = applyWorldEntityStaminaTick(
        {
          state,
          movementDistance: 0,
          regionType: 'walkable',
        },
        defaults,
      );
      state = {
        maxStamina: tick.maxStamina,
        currentStamina: tick.currentStamina,
        staminaRegenPerTick: tick.staminaRegenPerTick,
      };
      guard += 1;
    }

    expect(state.currentStamina).toBe(state.maxStamina);
  });
});
