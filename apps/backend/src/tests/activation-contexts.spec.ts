import { describe, expect, it } from 'vitest';
import { matchActivationContexts, normalizeActivationContextList } from '../content/activation-contexts';

describe('activation context helpers', () => {
  it('normalizes contexts to lowercase unique values', () => {
    expect(normalizeActivationContextList([' Weapon ', 'weapon', 'Combat', '', 'combat'])).toEqual([
      'weapon',
      'combat',
    ]);
  });

  it('matches when at least one required context is present', () => {
    expect(matchActivationContexts(['weapon', 'armor'], ['combat', 'weapon'])).toEqual({
      ok: true,
      matched: ['weapon'],
    });
  });

  it('returns reason when no required contexts match', () => {
    const result = matchActivationContexts(['armor'], ['weapon']);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('armor');
  });
});
