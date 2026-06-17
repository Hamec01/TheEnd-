import { describe, expect, it } from 'vitest';
import type {
  EquipmentVisualBindingDefinition,
  SpriteAnimationSetDefinition,
  SpriteBodyTemplateDefinition,
  SpriteProfileDefinition,
} from '@theend/rpg-domain';
import type {
  AdminItem,
  AdminNpc,
  AdminSkill,
  AdminVisualFx,
  ImageSheetDefinition,
  RuntimeAssemblyRuleDefinition,
  SkillAnimationBindingDefinition,
  StoredImage,
} from '../services/content/models';
import {
  createStarterSpriteStudioContentIfMissing,
  createStarterSpriteStudioVisualContentIfMissing,
  resolveCharacterVisual,
  validateSpriteStudioState,
} from './index';

function createBodyTemplate(overrides: Partial<SpriteBodyTemplateDefinition> = {}): SpriteBodyTemplateDefinition {
  return {
    id: 'body_human_male_base',
    schemaVersion: 1,
    name: 'Human Male Base',
    description: '',
    bodyType: 'humanoid',
    compatibleRaceIds: ['human'],
    compatibleBodyTypes: ['humanoid'],
    supportedSurfaces: ['paperdoll', 'world', 'battle'],
    paperdoll: { imageRef: { type: 'image', src: 'img_body' }, scale: 1, offsetX: 0, offsetY: 0 },
    world: { imageRef: { type: 'image', src: 'img_body' }, scale: 1, offsetX: 0, offsetY: 0 },
    battle: { imageRef: { type: 'image', src: 'img_body' }, scale: 1, offsetX: 0, offsetY: 0 },
    anchors: {
      headAnchor: { x: 64, y: 20 },
      chestAnchor: { x: 64, y: 50 },
      rightHandAnchor: { x: 90, y: 68 },
      leftHandAnchor: { x: 38, y: 68 },
      offhandAnchor: { x: 34, y: 66 },
      shieldAnchor: { x: 28, y: 64 },
      backAnchor: { x: 52, y: 54 },
      weaponTipAnchor: { x: 106, y: 42 },
      projectileSpawnAnchor: { x: 96, y: 42 },
      castFxAnchor: { x: 80, y: 34 },
      hitFxAnchor: { x: 64, y: 42 },
      feetAnchor: { x: 64, y: 110 },
      shadowAnchor: { x: 64, y: 118 },
    },
    tags: [],
    notes: '',
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

function createAnimationSet(overrides: Partial<SpriteAnimationSetDefinition> = {}): SpriteAnimationSetDefinition {
  return {
    id: 'animset_humanoid_basic_battle',
    schemaVersion: 1,
    name: 'Humanoid Battle',
    description: '',
    compatibleBodyTemplateIds: ['body_human_male_base'],
    compatibleRaceIds: ['human'],
    compatibleBodyTypes: ['humanoid'],
    compatibleSurfaces: ['battle', 'paperdoll', 'world'],
    clips: [
      { action: 'idle', frameWidth: 128, frameHeight: 128, frameCount: 1, fps: 8, row: 0, loop: true },
      { action: 'walk', frameWidth: 128, frameHeight: 128, frameCount: 1, fps: 8, row: 1, loop: true },
      { action: 'attack_melee', frameWidth: 128, frameHeight: 128, frameCount: 1, fps: 8, row: 2, loop: false },
      { action: 'hit', frameWidth: 128, frameHeight: 128, frameCount: 1, fps: 8, row: 3, loop: false },
      { action: 'death', frameWidth: 128, frameHeight: 128, frameCount: 1, fps: 8, row: 4, loop: false, legacyAliases: ['die'] },
    ],
    notes: '',
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

function createSwordBinding(overrides: Partial<EquipmentVisualBindingDefinition> = {}): EquipmentVisualBindingDefinition {
  return {
    id: 'binding_sword_battle',
    schemaVersion: 1,
    name: 'Sword Battle Binding',
    itemId: 'iron_sword',
    defaultForItem: true,
    compatibleBodyTemplateIds: ['body_human_male_base'],
    compatibleRaceIds: ['human'],
    compatibleBodyTypes: ['humanoid'],
    compatibleSurfaces: ['battle'],
    equipmentSlot: 'rightHand',
    weaponGripType: 'one_handed',
    battle: { imageRef: { type: 'image', src: 'img_sword' }, scale: 1, offsetX: 0, offsetY: 0 },
    world: { imageRef: { type: 'image', src: 'img_sword' }, scale: 1, offsetX: 0, offsetY: 0 },
    paperdoll: { imageRef: { type: 'image', src: 'img_sword' }, scale: 1, offsetX: 0, offsetY: 0 },
    anchorOverrides: {},
    notes: '',
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

function createShieldBinding(overrides: Partial<EquipmentVisualBindingDefinition> = {}): EquipmentVisualBindingDefinition {
  return {
    id: 'binding_shield_battle',
    schemaVersion: 1,
    name: 'Shield Battle Binding',
    itemId: 'wooden_shield',
    defaultForItem: true,
    compatibleBodyTemplateIds: ['body_human_male_base'],
    compatibleRaceIds: ['human'],
    compatibleBodyTypes: ['humanoid'],
    compatibleSurfaces: ['battle'],
    equipmentSlot: 'leftHand',
    weaponGripType: 'shield',
    battle: { imageRef: { type: 'image', src: 'img_shield' }, scale: 1, offsetX: 0, offsetY: 0 },
    world: { imageRef: { type: 'image', src: 'img_shield' }, scale: 1, offsetX: 0, offsetY: 0 },
    paperdoll: { imageRef: { type: 'image', src: 'img_shield' }, scale: 1, offsetX: 0, offsetY: 0 },
    anchorOverrides: {},
    notes: '',
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

function createProfile(overrides: Partial<SpriteProfileDefinition> = {}): SpriteProfileDefinition {
  return {
    id: 'profile_human_guard',
    schemaVersion: 1,
    name: 'Human Guard',
    npcId: 'npc_guard',
    bodyTemplateId: 'body_human_male_base',
    animationSetId: 'animset_humanoid_basic_battle',
    defaultSurface: 'battle',
    defaultEquipmentItemIds: ['iron_sword'],
    previewSkillIds: [],
    previewFxIds: [],
    tags: [],
    notes: '',
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

function createItem(overrides: Partial<AdminItem>): AdminItem {
  return {
    id: 'item',
    name: 'Item',
    type: 'weapon',
    slot: 'rightHand',
    rarity: 'common',
    price: 1,
    stackable: false,
    gameplayDescription: 'test',
    loreDescription: 'test',
    isEnabled: true,
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  } as AdminItem;
}

function createNpc(overrides: Partial<AdminNpc> = {}): AdminNpc {
  return {
    id: 'npc_guard',
    name: 'Guard',
    status: 'active',
    kind: 'guard',
    race: 'human',
    description: 'Guard',
    mapBindings: [],
    defaultDisposition: 'friendly',
    isUnique: true,
    canRespawn: false,
    canFight: true,
    canTalk: true,
    canTrade: false,
    canTrain: false,
    canGiveQuests: false,
    canBeKilled: true,
    dialogues: [],
    questBindings: [],
    createdAt: 'now',
    updatedAt: 'now',
    portraitUrl: '/npc/guard_portrait.png',
    fullImageUrl: '/npc/guard_full.png',
    combatImageUrl: '/npc/guard_combat.png',
    battleSpriteAssetId: 'legacy_guard_battle',
    ...overrides,
  } as AdminNpc;
}

function createResolverContent(overrides: Partial<{
  bodyTemplates: SpriteBodyTemplateDefinition[];
  animationSets: SpriteAnimationSetDefinition[];
  bindings: EquipmentVisualBindingDefinition[];
  profiles: SpriteProfileDefinition[];
  items: AdminItem[];
  npcs: AdminNpc[];
  images: StoredImage[];
  imageSheets: ImageSheetDefinition[];
  skillBindings: SkillAnimationBindingDefinition[];
  runtimeRules: RuntimeAssemblyRuleDefinition[];
  skills: AdminSkill[];
  visualFx: AdminVisualFx[];
}> = {}) {
  const bodyTemplates = overrides.bodyTemplates ?? [createBodyTemplate()];
  const animationSets = overrides.animationSets ?? [createAnimationSet()];
  const bindings = overrides.bindings ?? [createSwordBinding(), createShieldBinding()];
  const profiles = overrides.profiles ?? [createProfile()];
  const items = overrides.items ?? [
    createItem({ id: 'iron_sword', name: 'Iron Sword', type: 'weapon', slot: 'rightHand' }),
    createItem({ id: 'wooden_shield', name: 'Wooden Shield', type: 'armor', slot: 'leftHand' }),
  ];
  return {
    spriteProfiles: profiles,
    spriteBodyTemplates: bodyTemplates,
    spriteAnimationSets: animationSets,
    equipmentVisualBindings: bindings,
    skillAnimationBindings: overrides.skillBindings ?? [],
    runtimeAssemblyRules: overrides.runtimeRules ?? [],
    items,
    skills: overrides.skills ?? [],
    visualFx: overrides.visualFx ?? [],
    images: overrides.images ?? [
      { id: 'img_body', name: 'Body', mimeType: 'image/png', width: 128, height: 128, dataUrl: 'data:image/png;base64,body', createdAt: 'now', updatedAt: 'now' },
      { id: 'img_sword', name: 'Sword', mimeType: 'image/png', width: 64, height: 64, dataUrl: 'data:image/png;base64,sword', createdAt: 'now', updatedAt: 'now' },
      { id: 'img_shield', name: 'Shield', mimeType: 'image/png', width: 64, height: 64, dataUrl: 'data:image/png;base64,shield', createdAt: 'now', updatedAt: 'now' },
    ],
    imageSheets: overrides.imageSheets ?? [],
  };
}

describe('resolveCharacterVisual', () => {
  it('resolves legacy NPC fallback without spriteProfileId', () => {
    const content = createResolverContent({ profiles: [] });
    const npc = createNpc({ spriteProfileId: undefined });

    const resolved = resolveCharacterVisual({
      surface: 'battle',
      entityType: 'npc',
      npc,
      preferredAction: 'idle',
      content,
    });

    expect(resolved.fallback.used).toBe(true);
    expect(resolved.debug.profileSource).toBe('fallback');
    expect(resolved.warnings.some((issue) => issue.code === 'legacy_npc_fallback')).toBe(true);
  });

  it('resolves npc with spriteProfileId into body and animation layers', () => {
    const content = createResolverContent();
    const npc = createNpc({ spriteProfileId: 'profile_human_guard' });

    const resolved = resolveCharacterVisual({
      surface: 'battle',
      entityType: 'npc',
      npc,
      preferredAction: 'attack_melee',
      content,
    });

    expect(resolved.spriteProfileId).toBe('profile_human_guard');
    expect(resolved.bodyTemplateId).toBe('body_human_male_base');
    expect(resolved.animationSetId).toBe('animset_humanoid_basic_battle');
    expect(resolved.layers.map((entry) => entry.group)).toContain('body_torso');
    expect(resolved.availableActions).toContain('attack_melee');
  });

  it('resolves player-like sword and shield with stable layer ordering', () => {
    const content = createResolverContent();

    const resolved = resolveCharacterVisual({
      surface: 'battle',
      entityType: 'player',
      spriteProfileId: 'profile_human_guard',
      preferredAction: 'attack_melee',
      player: {
        id: 'player_1',
        race: 'human',
        bodyType: 'humanoid',
        spriteProfileId: 'profile_human_guard',
        equippedItemIds: {
          mainHand: 'iron_sword',
          offHand: 'wooden_shield',
        },
      },
      content,
    });

    expect(resolved.layers.map((entry) => entry.group)).toEqual(['body_torso', 'main_hand_weapon', 'offhand_shield']);
    expect(resolved.debug.equipment.map((entry) => entry.chosenBindingId)).toEqual(['binding_sword_battle', 'binding_shield_battle']);
  });

  it('creates structured warning when a binding is missing', () => {
    const content = createResolverContent({
      items: [
        createItem({ id: 'iron_sword', name: 'Iron Sword', type: 'weapon', slot: 'rightHand' }),
        createItem({ id: 'mystery_ring', name: 'Mystery Ring', type: 'armor', slot: 'ring' }),
      ],
    });

    const resolved = resolveCharacterVisual({
      surface: 'battle',
      entityType: 'player',
      spriteProfileId: 'profile_human_guard',
      player: {
        id: 'player_2',
        race: 'human',
        bodyType: 'humanoid',
        equippedItemIds: {
          mainHand: 'mystery_ring',
        },
      },
      content,
    });

    expect(resolved.warnings).toContainEqual(expect.objectContaining({
      code: 'missing_equipment_binding',
      severity: 'warning',
    }));
  });

  it('records binding scoring and rejected candidates in debug metadata', () => {
    const content = createResolverContent({
      bindings: [
        createSwordBinding(),
        createSwordBinding({
          id: 'binding_sword_paperdoll',
          name: 'Sword Paperdoll Binding',
          compatibleSurfaces: ['paperdoll'],
        }),
      ],
    });

    const resolved = resolveCharacterVisual({
      surface: 'battle',
      entityType: 'player',
      player: {
        id: 'player_3',
        race: 'human',
        bodyType: 'humanoid',
        equippedItemIds: {
          mainHand: 'iron_sword',
        },
      },
      spriteProfileId: 'profile_human_guard',
      content,
    });

    const debugEntry = resolved.debug.equipment[0];
    expect(debugEntry.chosenBindingId).toBe('binding_sword_battle');
    expect(debugEntry.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ bindingId: 'binding_sword_battle', accepted: true }),
      expect.objectContaining({ bindingId: 'binding_sword_paperdoll', accepted: false }),
    ]));
  });

  it('emits warning for missing layer image refs', () => {
    const content = createResolverContent({
      bodyTemplates: [
        createBodyTemplate({
          battle: { imageRef: { type: 'image', src: 'missing_body_art' }, scale: 1, offsetX: 0, offsetY: 0 },
        }),
      ],
    });

    const resolved = resolveCharacterVisual({
      surface: 'battle',
      entityType: 'npc',
      npc: createNpc({ spriteProfileId: 'profile_human_guard' }),
      content,
    });

    expect(resolved.warnings.some((issue) => issue.code === 'missing_layer_image')).toBe(true);
  });

  it('does not mutate resolver inputs', () => {
    const content = createResolverContent();
    const npc = createNpc({ spriteProfileId: 'profile_human_guard' });
    const player = {
      id: 'player_immutability',
      race: 'human',
      bodyType: 'humanoid',
      spriteProfileId: 'profile_human_guard',
      equippedItemIds: {
        mainHand: 'iron_sword',
        offHand: 'wooden_shield',
      },
    };
    const before = JSON.stringify({ content, npc, player });

    resolveCharacterVisual({
      surface: 'battle',
      entityType: 'player',
      npc,
      player,
      spriteProfileId: 'profile_human_guard',
      content,
    });

    expect(JSON.stringify({ content, npc, player })).toBe(before);
  });
});

describe('createStarterSpriteStudioContentIfMissing', () => {
  it('adds starter templates idempotently without touching user content', () => {
    const originalBodyTemplates = [createBodyTemplate({ id: 'custom_template', name: 'Custom Template' })];
    const originalAnimationSets = [createAnimationSet({ id: 'custom_animset', name: 'Custom Animation Set' })];

    const first = createStarterSpriteStudioContentIfMissing({
      bodyTemplates: originalBodyTemplates,
      animationSets: originalAnimationSets,
    });
    const second = createStarterSpriteStudioContentIfMissing({
      bodyTemplates: first.bodyTemplates,
      animationSets: first.animationSets,
    });

    expect(first.bodyTemplates.some((entry) => entry.id === 'custom_template')).toBe(true);
    expect(first.animationSets.some((entry) => entry.id === 'custom_animset')).toBe(true);
    expect(second.createdBodyTemplateIds).toHaveLength(0);
    expect(second.createdAnimationSetIds).toHaveLength(0);
    expect(new Set(second.bodyTemplates.map((entry) => entry.id)).size).toBe(second.bodyTemplates.length);
    expect(new Set(second.animationSets.map((entry) => entry.id)).size).toBe(second.animationSets.length);
  });
});

describe('createStarterSpriteStudioVisualContentIfMissing', () => {
  it('upserts starter visual content idempotently without duplicating ids', () => {
    const refs = {
      bodyImageIds: {
        humanMale: 'img_sprite_studio_body_human_male_basic_body',
        elfMale: 'img_sprite_studio_body_elf_male_basic_body',
        dwarf: 'img_sprite_studio_body_dwarf_basic_body',
        wolf: 'img_sprite_studio_monster_wolf_basic_sprite',
        monster: 'img_sprite_studio_monster_basic_sprite',
      },
      equipmentImageIds: {
        sword: 'img_sprite_studio_equipment_starter_sword_visual',
        shield: 'img_sprite_studio_equipment_starter_shield_visual',
        helmet: 'img_sprite_studio_equipment_starter_helmet_visual',
        chestArmor: 'img_sprite_studio_equipment_starter_chest_armor_visual',
      },
      animationSheets: {
        humanoidBattle: { id: 'sheet_sprite_studio_humanoid_basic_battle', name: 'Humanoid', category: 'other', src: 'img_sheet_humanoid', frameWidth: 128, frameHeight: 128, columns: 8, rows: 3 },
        elfBattle: { id: 'sheet_sprite_studio_elf_basic_battle', name: 'Elf', category: 'other', src: 'img_sheet_elf', frameWidth: 128, frameHeight: 128, columns: 8, rows: 3 },
        wolfBattle: { id: 'sheet_sprite_studio_wolf_basic_battle', name: 'Wolf', category: 'other', src: 'img_sheet_wolf', frameWidth: 128, frameHeight: 128, columns: 8, rows: 3 },
        monsterBattle: { id: 'sheet_sprite_studio_monster_basic_battle', name: 'Monster', category: 'other', src: 'img_sheet_monster', frameWidth: 128, frameHeight: 128, columns: 8, rows: 3 },
      },
    } as const;

    const first = createStarterSpriteStudioVisualContentIfMissing({
      bodyTemplates: [],
      animationSets: [],
      equipmentBindings: [],
      spriteProfiles: [],
      items: [
        createItem({ id: 'starter_sword_01', name: 'Starter Sword', type: 'weapon', slot: 'rightHand' }),
        createItem({ id: 'starter_leather_armor_01', name: 'Starter Leather Armor', type: 'armor', slot: 'chest' }),
        createItem({ id: 'shield_argos_private_01', name: 'Argos Shield', type: 'armor', slot: 'leftHand' }),
        createItem({ id: 'helmet_argos_private_01', name: 'Argos Helmet', type: 'armor', slot: 'head' }),
      ],
      assets: refs,
    });
    const second = createStarterSpriteStudioVisualContentIfMissing({
      bodyTemplates: first.bodyTemplates,
      animationSets: first.animationSets,
      equipmentBindings: first.equipmentBindings,
      spriteProfiles: first.spriteProfiles,
      items: first.items,
      assets: refs,
    });

    expect(new Set(second.bodyTemplates.map((entry) => entry.id)).size).toBe(second.bodyTemplates.length);
    expect(new Set(second.animationSets.map((entry) => entry.id)).size).toBe(second.animationSets.length);
    expect(new Set(second.equipmentBindings.map((entry) => entry.id)).size).toBe(second.equipmentBindings.length);
    expect(second.spriteProfiles.find((entry) => entry.id === 'profile_regal_paladin')?.bodyTemplateId).toBe('body_human_male_base');
    expect(second.items.find((entry) => entry.id === 'starter_sword_01')?.defaultEquipmentVisualBindingId).toBe('equipment_visual_binding_starter_sword_01');
  });

  it('upgrades stale starter animation sets to multi-frame generated clips', () => {
    const refs = {
      bodyImageIds: {
        humanMale: 'img_sprite_studio_body_human_male_basic_body',
        elfMale: 'img_sprite_studio_body_elf_male_basic_body',
        dwarf: 'img_sprite_studio_body_dwarf_basic_body',
        wolf: 'img_sprite_studio_monster_wolf_basic_sprite',
        monster: 'img_sprite_studio_monster_basic_sprite',
      },
      equipmentImageIds: {
        sword: 'img_sprite_studio_equipment_starter_sword_visual',
        shield: 'img_sprite_studio_equipment_starter_shield_visual',
        helmet: 'img_sprite_studio_equipment_starter_helmet_visual',
        chestArmor: 'img_sprite_studio_equipment_starter_chest_armor_visual',
      },
      animationSheets: {
        humanoidBattle: { id: 'sheet_sprite_studio_humanoid_basic_battle', name: 'Humanoid', category: 'other', src: 'img_sheet_humanoid', frameWidth: 128, frameHeight: 128, columns: 8, rows: 3 },
        elfBattle: { id: 'sheet_sprite_studio_elf_basic_battle', name: 'Elf', category: 'other', src: 'img_sheet_elf', frameWidth: 128, frameHeight: 128, columns: 8, rows: 3 },
        wolfBattle: { id: 'sheet_sprite_studio_wolf_basic_battle', name: 'Wolf', category: 'other', src: 'img_sheet_wolf', frameWidth: 128, frameHeight: 128, columns: 8, rows: 3 },
        monsterBattle: { id: 'sheet_sprite_studio_monster_basic_battle', name: 'Monster', category: 'other', src: 'img_sheet_monster', frameWidth: 128, frameHeight: 128, columns: 8, rows: 3 },
      },
    } as const;

    const stale = createAnimationSet({
      id: 'animset_humanoid_basic_battle',
      name: 'Humanoid Basic Battle',
      clips: [
        { action: 'idle', frameWidth: 128, frameHeight: 128, frameCount: 1, fps: 8, row: 0, loop: true },
        { action: 'walk', frameWidth: 128, frameHeight: 128, frameCount: 1, fps: 8, row: 1, loop: true },
        { action: 'attack_melee', frameWidth: 128, frameHeight: 128, frameCount: 1, fps: 8, row: 2, loop: false },
      ],
    });

    const result = createStarterSpriteStudioVisualContentIfMissing({
      bodyTemplates: [],
      animationSets: [stale],
      equipmentBindings: [],
      spriteProfiles: [],
      items: [
        createItem({ id: 'starter_sword_01', name: 'Starter Sword', type: 'weapon', slot: 'rightHand' }),
        createItem({ id: 'starter_leather_armor_01', name: 'Starter Leather Armor', type: 'armor', slot: 'chest' }),
        createItem({ id: 'shield_argos_private_01', name: 'Argos Shield', type: 'armor', slot: 'leftHand' }),
        createItem({ id: 'helmet_argos_private_01', name: 'Argos Helmet', type: 'armor', slot: 'head' }),
      ],
      assets: refs,
    });

    const updated = result.animationSets.find((entry) => entry.id === 'animset_humanoid_basic_battle');
    expect(updated).toBeDefined();
    expect(updated?.clips.find((entry) => entry.action === 'idle')?.frameCount).toBe(6);
    expect(updated?.clips.find((entry) => entry.action === 'walk')?.frameCount).toBe(8);
    expect(updated?.clips.find((entry) => entry.action === 'attack_melee')?.frameCount).toBe(6);
    expect(updated?.clips.find((entry) => entry.action === 'idle')?.imageRef).toEqual({
      type: 'tileset',
      sheetId: 'sheet_sprite_studio_humanoid_basic_battle',
      frame: 0,
    });
    expect(result.touchedAnimationSetIds).toContain('animset_humanoid_basic_battle');
  });

  it('resolves starter demo profile with body and equipment overlays', () => {
    const refs = {
      bodyImageIds: {
        humanMale: 'img_sprite_studio_body_human_male_basic_body',
        elfMale: 'img_sprite_studio_body_elf_male_basic_body',
        dwarf: 'img_sprite_studio_body_dwarf_basic_body',
        wolf: 'img_sprite_studio_monster_wolf_basic_sprite',
        monster: 'img_sprite_studio_monster_basic_sprite',
      },
      equipmentImageIds: {
        sword: 'img_sprite_studio_equipment_starter_sword_visual',
        shield: 'img_sprite_studio_equipment_starter_shield_visual',
        helmet: 'img_sprite_studio_equipment_starter_helmet_visual',
        chestArmor: 'img_sprite_studio_equipment_starter_chest_armor_visual',
      },
      animationSheets: {
        humanoidBattle: { id: 'sheet_sprite_studio_humanoid_basic_battle', name: 'Humanoid', category: 'other', src: 'img_sheet_humanoid', frameWidth: 128, frameHeight: 128, columns: 8, rows: 3 },
        elfBattle: { id: 'sheet_sprite_studio_elf_basic_battle', name: 'Elf', category: 'other', src: 'img_sheet_elf', frameWidth: 128, frameHeight: 128, columns: 8, rows: 3 },
        wolfBattle: { id: 'sheet_sprite_studio_wolf_basic_battle', name: 'Wolf', category: 'other', src: 'img_sheet_wolf', frameWidth: 128, frameHeight: 128, columns: 8, rows: 3 },
        monsterBattle: { id: 'sheet_sprite_studio_monster_basic_battle', name: 'Monster', category: 'other', src: 'img_sheet_monster', frameWidth: 128, frameHeight: 128, columns: 8, rows: 3 },
      },
    } as const;

    const starter = createStarterSpriteStudioVisualContentIfMissing({
      bodyTemplates: [],
      animationSets: [],
      equipmentBindings: [],
      spriteProfiles: [],
      items: [
        createItem({ id: 'starter_sword_01', name: 'Starter Sword', type: 'weapon', slot: 'rightHand' }),
        createItem({ id: 'starter_leather_armor_01', name: 'Starter Leather Armor', type: 'armor', slot: 'chest' }),
        createItem({ id: 'shield_argos_private_01', name: 'Argos Shield', type: 'armor', slot: 'leftHand' }),
        createItem({ id: 'helmet_argos_private_01', name: 'Argos Helmet', type: 'armor', slot: 'head' }),
      ],
      assets: refs,
    });

    const resolved = resolveCharacterVisual({
      surface: 'battle',
      entityType: 'npc',
      spriteProfileId: 'profile_regal_paladin',
      preferredAction: 'walk',
      content: {
        spriteProfiles: starter.spriteProfiles,
        spriteBodyTemplates: starter.bodyTemplates,
        spriteAnimationSets: starter.animationSets,
        equipmentVisualBindings: starter.equipmentBindings,
        skillAnimationBindings: [],
        runtimeAssemblyRules: [],
        items: starter.items,
        skills: [],
        visualFx: [],
        images: [
          { id: 'img_sprite_studio_body_human_male_basic_body', name: 'sprite-studio-body-human-male-basic-body', mimeType: 'image/png', width: 128, height: 128, dataUrl: 'data:image/png;base64,body', createdAt: 'now', updatedAt: 'now' },
          { id: 'img_sprite_studio_equipment_starter_sword_visual', name: 'sprite-studio-equipment-starter-sword-visual', mimeType: 'image/png', width: 128, height: 128, dataUrl: 'data:image/png;base64,sword', createdAt: 'now', updatedAt: 'now' },
          { id: 'img_sprite_studio_equipment_starter_shield_visual', name: 'sprite-studio-equipment-starter-shield-visual', mimeType: 'image/png', width: 128, height: 128, dataUrl: 'data:image/png;base64,shield', createdAt: 'now', updatedAt: 'now' },
          { id: 'img_sprite_studio_equipment_starter_helmet_visual', name: 'sprite-studio-equipment-starter-helmet-visual', mimeType: 'image/png', width: 128, height: 128, dataUrl: 'data:image/png;base64,helmet', createdAt: 'now', updatedAt: 'now' },
          { id: 'img_sprite_studio_equipment_starter_chest_armor_visual', name: 'sprite-studio-equipment-starter-chest-armor-visual', mimeType: 'image/png', width: 128, height: 128, dataUrl: 'data:image/png;base64,chest', createdAt: 'now', updatedAt: 'now' },
          { id: 'img_sheet_humanoid', name: 'sheet-humanoid', mimeType: 'image/png', width: 1024, height: 384, dataUrl: 'data:image/png;base64,sheet', createdAt: 'now', updatedAt: 'now' },
          { id: 'img_sheet_elf', name: 'sheet-elf', mimeType: 'image/png', width: 1024, height: 384, dataUrl: 'data:image/png;base64,sheet', createdAt: 'now', updatedAt: 'now' },
          { id: 'img_sheet_wolf', name: 'sheet-wolf', mimeType: 'image/png', width: 1024, height: 384, dataUrl: 'data:image/png;base64,sheet', createdAt: 'now', updatedAt: 'now' },
          { id: 'img_sheet_monster', name: 'sheet-monster', mimeType: 'image/png', width: 1024, height: 384, dataUrl: 'data:image/png;base64,sheet', createdAt: 'now', updatedAt: 'now' },
        ],
        imageSheets: Object.values(refs.animationSheets),
      },
    });

    expect(resolved.layers.map((entry) => entry.group)).toEqual([
      'body_torso',
      'chest_armor',
      'helmet',
      'main_hand_weapon',
      'offhand_shield',
    ]);
  });
});

describe('validateSpriteStudioState', () => {
  it('rejects persisted base64 in sprite collections', () => {
    const validation = validateSpriteStudioState({
      bodyTemplates: [
        createBodyTemplate({
          battle: { imagePath: 'data:image/png;base64,abc', scale: 1, offsetX: 0, offsetY: 0 },
        }),
      ],
      animationSets: [createAnimationSet()],
      equipmentBindings: [createSwordBinding()],
      spriteProfiles: [createProfile()],
      skillBindings: [],
      runtimeRules: [],
      npcs: [createNpc({ spriteProfileId: 'profile_human_guard' })],
      items: [
        createItem({ id: 'iron_sword', name: 'Iron Sword', type: 'weapon', slot: 'rightHand' }),
        createItem({ id: 'wooden_shield', name: 'Wooden Shield', type: 'armor', slot: 'leftHand' }),
      ],
      skills: [],
      visualFx: [],
      images: [],
      imageSheets: [],
    });

    expect(validation.errors.some((entry) => entry.includes('base64/data URL detected'))).toBe(true);
  });
});
