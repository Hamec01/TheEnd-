import { describe, expect, it } from 'vitest';
import { resolveCircularPortraitLayout } from './circularPortraitLayout';

describe('resolveCircularPortraitLayout', () => {
  it('reuses existing portrait when texture key did not change', () => {
    const layout = resolveCircularPortraitLayout({
      existingTextureKey: 'actor:/sprites/actor/bandit_01.png',
      nextTextureKey: 'actor:/sprites/actor/bandit_01.png',
      sourceWidth: 64,
      sourceHeight: 64,
      size: 48,
    });

    expect(layout.reuseExisting).toBe(true);
    expect(layout.displayWidth).toBe(0);
    expect(layout.displayHeight).toBe(0);
  });

  it('uses cover strategy inside circular mask bounds', () => {
    const layout = resolveCircularPortraitLayout({
      existingTextureKey: 'actor:/sprites/actor/a.png',
      nextTextureKey: 'actor:/sprites/actor/b.png',
      sourceWidth: 120,
      sourceHeight: 60,
      size: 48,
    });

    expect(layout.reuseExisting).toBe(false);
    expect(layout.displayWidth).toBeGreaterThanOrEqual(layout.maskRadius * 2);
    expect(layout.displayHeight).toBeGreaterThanOrEqual(layout.maskRadius * 2);
  });
});
