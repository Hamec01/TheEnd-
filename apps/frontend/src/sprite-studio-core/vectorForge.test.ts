import { describe, expect, it } from 'vitest';
import type { EquipmentVisualBindingDefinition } from '@theend/rpg-domain';
import {
  buildBodyVectorDocument,
  buildEquipmentVectorDocument,
  createDefaultBodyAuthoring,
  createEmptyBodyTemplate,
  createEmptyEquipmentBinding,
  createEmptyVisualAsset,
  normalizeBindingFitting,
  normalizeBodyAuthoring,
  normalizeEquipmentVisualAuthoring,
} from './index';

describe('vectorForge', () => {
  it('normalizes body authoring inputs with safe defaults and clamps', () => {
    const normalized = normalizeBodyAuthoring({
      raceId: ' elf ',
      skinColor: 'bad-color',
      bodyHeight: 99,
      bellySize: -10,
      neckLength: 0,
    });

    expect(normalized.raceId).toBe('elf');
    expect(normalized.skinColor).toBe(createDefaultBodyAuthoring().skinColor);
    expect(normalized.bodyHeight).toBe(1.4);
    expect(normalized.bellySize).toBe(0);
    expect(normalized.neckLength).toBe(0.1);
  });

  it('builds a body vector document with parameterized layers and anchors', () => {
    const template = createEmptyBodyTemplate(101);
    template.authoring = normalizeBodyAuthoring({
      ...template.authoring,
      bodyHeight: 1.2,
      headSize: 1.1,
    });

    const document = buildBodyVectorDocument(template);

    expect(document.kind).toBe('body');
    expect(document.layers.map((layer) => layer.id)).toEqual(['legs', 'torso', 'belly', 'arms', 'underwear', 'head']);
    expect(document.anchors?.headAnchor?.y ?? 0).toBeGreaterThan(0);
    expect(document.parameterValues).toMatchObject({
      bodyHeight: 1.2,
      headSize: 1.1,
    });
  });

  it('normalizes equipment forge params and builds a visual document', () => {
    const asset = createEmptyVisualAsset({ id: 'visual_bow', name: 'Bow', kind: 'equipment' });
    asset.equipmentAuthoring = normalizeEquipmentVisualAuthoring({
      category: 'bow',
      width: 9,
      scale: 0.1,
      primaryColor: '#123456',
    });

    const document = buildEquipmentVectorDocument(asset);

    expect(document.kind).toBe('equipment');
    expect(document.layers.length).toBeGreaterThan(0);
    expect(document.parameterValues).toMatchObject({
      category: 'bow',
      width: 2,
      scale: 0.4,
      primaryColor: '#123456',
    });
  });

  it('fills new fitting defaults without breaking legacy bindings', () => {
    const legacyBinding: EquipmentVisualBindingDefinition = {
      ...createEmptyEquipmentBinding(202),
      supportedActions: undefined,
      preferredAnchor: undefined,
      secondaryAnchor: undefined,
      twoHanded: undefined,
      bodyRelativeScale: undefined,
      bodyRelativeWidth: undefined,
      bodyRelativeHeight: undefined,
    };

    const normalized = normalizeBindingFitting(legacyBinding);

    expect(normalized.supportedActions).toEqual(['idle', 'walk', 'attack_melee', 'attack_ranged']);
    expect(normalized.preferredAnchor).toBe('right_hand');
    expect(normalized.secondaryAnchor).toBeUndefined();
    expect(normalized.twoHanded).toBe(false);
    expect(normalized.bodyRelativeScale).toBe(1);
    expect(normalized.bodyRelativeWidth).toBe(1);
    expect(normalized.bodyRelativeHeight).toBe(1);
  });

  it('marks bow bindings as two-anchor/two-handed fitting', () => {
    const bowBinding = normalizeBindingFitting({
      ...createEmptyEquipmentBinding(303),
      weaponGripType: 'bow',
      preferredAnchor: 'right_hand',
      secondaryAnchor: 'left_hand',
    });

    expect(bowBinding.twoHanded).toBe(true);
    expect(bowBinding.secondaryAnchor).toBe('left_hand');
  });
});
