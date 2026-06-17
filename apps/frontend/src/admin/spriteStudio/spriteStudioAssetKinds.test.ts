import { describe, expect, it } from 'vitest';
import { classifySpriteStudioAsset, getEquipmentOverlayEligibility } from './spriteStudioAssetKinds';

describe('spriteStudioAssetKinds', () => {
  it('classifies sprite-studio equipment visuals as drawable overlays', () => {
    const kind = classifySpriteStudioAsset({
      imageRef: { type: 'image', src: 'img_sprite_studio_equipment_starter_sword_visual' },
      legacyImagePath: 'img_sprite_studio_equipment_starter_sword_visual',
      runtimeImages: [
        {
          id: 'img_sprite_studio_equipment_starter_sword_visual',
          name: 'sprite-studio-equipment-starter-sword-visual',
          mimeType: 'image/png',
          width: 128,
          height: 128,
          dataUrl: '/assets/upload/images/sprite-studio/equipment/img_sprite_studio_equipment_starter_sword_visual-sprite-studio-equipment-starter-sword-visual.png',
          createdAt: 'now',
          updatedAt: 'now',
        },
      ],
      label: 'Starter Sword Binding battle',
    });

    expect(kind).toBe('sprite_equipment_weapon');
    expect(getEquipmentOverlayEligibility(kind)).toBe('ok');
  });

  it('keeps gameplay item icons reference-only', () => {
    const kind = classifySpriteStudioAsset({
      imageRef: { type: 'image', src: 'starter_sword_01' },
      legacyImagePath: '/assets/upload/images/items/weapon/starter_sword_01-icon.png',
      runtimeImages: [
        {
          id: 'starter_sword_01',
          name: 'starter_sword_01-icon',
          mimeType: 'image/png',
          width: 64,
          height: 64,
          dataUrl: '/assets/upload/images/items/weapon/starter_sword_01-icon.png',
          createdAt: 'now',
          updatedAt: 'now',
        },
      ],
      label: 'Inventory icon',
    });

    expect(kind).toBe('game_item_icon');
    expect(getEquipmentOverlayEligibility(kind)).toBe('blocked');
  });
});
