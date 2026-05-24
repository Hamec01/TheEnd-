import { describe, expect, it } from 'vitest';
import {
  normalizeActorVisualSource,
  pickDeterministicBanditPortrait,
  resolveActorPortraitWithFallback,
} from './actorVisualResolver';

describe('actorVisualResolver', () => {
  it('normalizes bandit_1 and bandit_01 aliases', () => {
    expect(normalizeActorVisualSource('bandit_1')).toBe('/sprites/actor/bandit_01.png');
    expect(normalizeActorVisualSource('bandit_01')).toBe('/sprites/actor/bandit_01.png');
  });

  it('treats unknown and placeholders as invalid', () => {
    expect(normalizeActorVisualSource('unknown')).toBeUndefined();
    expect(normalizeActorVisualSource('/assets/placeholders/x.png')).toBeUndefined();
  });

  it('resolves img_* via content raw endpoint', () => {
    expect(normalizeActorVisualSource('img_1777195049617_3fhz5nd6'))
      .toBe('/api/content/images/img_1777195049617_3fhz5nd6/raw');
  });

  it('picks deterministic bandit fallback by id', () => {
    const first = pickDeterministicBanditPortrait('entity_bandit_alpha');
    const second = pickDeterministicBanditPortrait('entity_bandit_alpha');
    const other = pickDeterministicBanditPortrait('entity_bandit_beta');

    expect(first).toBe(second);
    expect(first).toMatch(/^\/sprites\/actor\/bandit_0[1-6]\.png$/);
    expect(other).toMatch(/^\/sprites\/actor\/bandit_0[1-6]\.png$/);
  });

  it('uses deterministic bandit fallback when primary is invalid', () => {
    const resolved = resolveActorPortraitWithFallback('none', {
      entityId: 'bandit-x',
      isBanditLike: true,
    });

    expect(resolved).toMatch(/^\/sprites\/actor\/bandit_0[1-6]\.png$/);
  });
});
