import { describe, expect, it } from 'vitest';
import { normalizeVisualFx } from './visualFxService';

describe('normalizeVisualFx', () => {
  it('fills required defaults while preserving the stable id', () => {
    const fx = normalizeVisualFx({
      id: 'fx_fire_circle',
      name: '',
      asset: {
        url: '/assets/fx/fire/fire_circle.png',
        frameWidth: 512,
        frameHeight: 512,
        frameCount: 6,
      },
      render: {
        alpha: 2,
        scale: 0,
      },
    });

    expect(fx.id).toBe('fx_fire_circle');
    expect(fx.name).toBe('fx_fire_circle');
    expect(fx.asset.key).toBe('fx_fire_circle');
    expect(fx.asset.frameWidth).toBe(512);
    expect(fx.asset.frameHeight).toBe(512);
    expect(fx.asset.frameCount).toBe(6);
    expect(fx.render.alpha).toBe(1);
    expect(fx.render.scale).toBe(0.01);
    expect(fx.placement.defaultPlayOn).toBe('target');
  });
});
