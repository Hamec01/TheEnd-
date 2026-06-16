import type {
  EquipmentVisualBindingDefinition,
  SpriteActionType,
  SpriteAnimationSetDefinition,
  SpriteBodyTemplateDefinition,
  SpriteProfileDefinition,
} from '@theend/rpg-domain';
import type { AdminItem, ImageSheetDefinition } from '../services/content/models';
import { createDefaultAnchorSet, nowIso } from './defaults';

export const STARTER_V0_BODY_TEMPLATE_IDS = {
  humanMale: 'body_human_male_base',
  elfMale: 'body_elf_male_base',
  dwarf: 'body_dwarf_male_base',
  wolf: 'body_wolf_basic',
  monster: 'body_monster_basic',
} as const;

export const STARTER_V0_ANIMATION_SET_IDS = {
  humanoidPaperdoll: 'animset_humanoid_basic_paperdoll',
  humanoidWorld: 'animset_humanoid_basic_world',
  humanoidBattle: 'animset_humanoid_basic_battle',
  elfBattle: 'animset_elf_basic_battle',
  wolfBattle: 'animset_wolf_basic_battle',
  monsterBattle: 'animset_monster_basic_battle',
} as const;

export const STARTER_V0_EQUIPMENT_BINDING_IDS = {
  starterSword: 'equipment_visual_binding_starter_sword_01',
  starterShield: 'equipment_visual_binding_shield_argos_private_01',
  starterHelmet: 'equipment_visual_binding_helmet_argos_private_01',
  starterChestArmor: 'equipment_visual_binding_starter_leather_armor_01',
} as const;

export const STARTER_V0_PROFILE_IDS = {
  regalPaladin: 'profile_regal_paladin',
} as const;

export interface StarterSpriteStudioVisualAssetRefs {
  bodyImageIds: {
    humanMale: string;
    elfMale: string;
    dwarf: string;
    wolf: string;
    monster: string;
  };
  equipmentImageIds: {
    sword: string;
    shield: string;
    helmet: string;
    chestArmor: string;
  };
  animationSheets: {
    humanoidBattle: ImageSheetDefinition;
    elfBattle: ImageSheetDefinition;
    wolfBattle: ImageSheetDefinition;
    monsterBattle: ImageSheetDefinition;
  };
}

export interface StarterSpriteStudioVisualContentResult {
  bodyTemplates: SpriteBodyTemplateDefinition[];
  animationSets: SpriteAnimationSetDefinition[];
  equipmentBindings: EquipmentVisualBindingDefinition[];
  spriteProfiles: SpriteProfileDefinition[];
  items: AdminItem[];
  touchedBodyTemplateIds: string[];
  touchedAnimationSetIds: string[];
  touchedEquipmentBindingIds: string[];
  touchedSpriteProfileIds: string[];
  touchedItemIds: string[];
}

type EntryWithId = { id: string };

function upsertById<T extends EntryWithId>(entries: T[], nextEntry: T): T[] {
  const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);
  if (existingIndex === -1) {
    return [...entries, nextEntry];
  }
  const nextEntries = [...entries];
  nextEntries[existingIndex] = nextEntry;
  return nextEntries;
}

function cloneItemWithLink(item: AdminItem, bindingId: string): AdminItem {
  return {
    ...item,
    defaultEquipmentVisualBindingId: bindingId,
  };
}

function createSheetLinkedClip(params: {
  action: SpriteActionType;
  row: number;
  frameCount: number;
  fps: number;
  sheetId: string;
  legacyAliases?: string[];
  notes?: string;
}): SpriteAnimationSetDefinition['clips'][number] {
  return {
    action: params.action,
    label: params.action,
    imageRef: {
      type: 'tileset',
      sheetId: params.sheetId,
      frame: params.row * 8,
    },
    frameWidth: 128,
    frameHeight: 128,
    frameCount: params.frameCount,
    fps: params.fps,
    row: params.row,
    loop: params.action !== 'death',
    legacyAliases: params.legacyAliases ?? (params.action === 'death' ? ['die'] : []),
    notes: params.notes,
  };
}

function createBodyTemplateFromAsset(params: {
  id: string;
  name: string;
  description: string;
  bodyType: SpriteBodyTemplateDefinition['bodyType'];
  raceIds: string[];
  compatibleBodyTypes: string[];
  imageId: string;
}): SpriteBodyTemplateDefinition {
  const now = nowIso();
  return {
    id: params.id,
    schemaVersion: 1,
    name: params.name,
    description: params.description,
    bodyType: params.bodyType,
    compatibleRaceIds: [...params.raceIds],
    compatibleBodyTypes: [...params.compatibleBodyTypes],
    supportedSurfaces: ['paperdoll', 'world', 'battle'],
    paperdoll: { imageRef: { type: 'image', src: params.imageId }, scale: 1, offsetX: 0, offsetY: 0 },
    world: { imageRef: { type: 'image', src: params.imageId }, scale: 1, offsetX: 0, offsetY: 0 },
    battle: { imageRef: { type: 'image', src: params.imageId }, scale: 1, offsetX: 0, offsetY: 0 },
    anchors: createDefaultAnchorSet(),
    tags: ['starter', 'sprite-studio', 'generated'],
    notes: 'Starter Sprite Studio V0 visual asset.',
    createdAt: now,
    updatedAt: now,
  };
}

function createEquipmentBinding(params: {
  id: string;
  name: string;
  itemId: string;
  equipmentSlot: string;
  weaponGripType: EquipmentVisualBindingDefinition['weaponGripType'];
  imageId: string;
  compatibleBodyTypes?: string[];
}): EquipmentVisualBindingDefinition {
  const now = nowIso();
  return {
    id: params.id,
    schemaVersion: 1,
    name: params.name,
    itemId: params.itemId,
    defaultForItem: true,
    compatibleBodyTemplateIds: [],
    compatibleRaceIds: [],
    compatibleBodyTypes: params.compatibleBodyTypes ?? ['humanoid'],
    compatibleSurfaces: ['paperdoll', 'world', 'battle'],
    equipmentSlot: params.equipmentSlot,
    weaponGripType: params.weaponGripType,
    paperdoll: { imageRef: { type: 'image', src: params.imageId }, scale: 1, offsetX: 0, offsetY: 0 },
    world: { imageRef: { type: 'image', src: params.imageId }, scale: 1, offsetX: 0, offsetY: 0 },
    battle: { imageRef: { type: 'image', src: params.imageId }, scale: 1, offsetX: 0, offsetY: 0 },
    anchorOverrides: {},
    notes: 'Starter Sprite Studio V0 equipment visual asset.',
    createdAt: now,
    updatedAt: now,
  };
}

function createAnimationSet(params: {
  id: string;
  name: string;
  compatibleBodyTemplateIds: string[];
  compatibleBodyTypes: string[];
  compatibleSurfaces: SpriteAnimationSetDefinition['compatibleSurfaces'];
  sheetId: string;
  actionMap: Array<{
    action: SpriteActionType;
    row: number;
    frameCount: number;
    fps: number;
    notes?: string;
    legacyAliases?: string[];
  }>;
  description: string;
  notes: string;
}): SpriteAnimationSetDefinition {
  const now = nowIso();
  return {
    id: params.id,
    schemaVersion: 1,
    name: params.name,
    description: params.description,
    compatibleBodyTemplateIds: [...params.compatibleBodyTemplateIds],
    compatibleRaceIds: [],
    compatibleBodyTypes: [...params.compatibleBodyTypes],
    compatibleSurfaces: [...params.compatibleSurfaces],
    clips: params.actionMap.map((entry) => createSheetLinkedClip({
      action: entry.action,
      row: entry.row,
      frameCount: entry.frameCount,
      fps: entry.fps,
      sheetId: params.sheetId,
      notes: entry.notes,
      legacyAliases: entry.legacyAliases,
    })),
    notes: params.notes,
    createdAt: now,
    updatedAt: now,
  };
}

function createOrUpdateRegalPaladinProfile(
  existing: SpriteProfileDefinition | undefined,
): SpriteProfileDefinition {
  const now = nowIso();
  return {
    id: STARTER_V0_PROFILE_IDS.regalPaladin,
    schemaVersion: 1,
    name: existing?.name ?? 'Regal Paladin',
    npcId: existing?.npcId,
    bodyTemplateId: STARTER_V0_BODY_TEMPLATE_IDS.humanMale,
    animationSetId: STARTER_V0_ANIMATION_SET_IDS.humanoidBattle,
    defaultSurface: 'battle',
    defaultEquipmentItemIds: [
      'starter_sword_01',
      'starter_leather_armor_01',
      'shield_argos_private_01',
      'helmet_argos_private_01',
    ],
    previewSkillIds: existing?.previewSkillIds ?? [],
    previewFxIds: existing?.previewFxIds ?? [],
    tags: Array.from(new Set([...(existing?.tags ?? []), 'starter', 'sprite-studio', 'generated'])),
    notes: 'Starter Sprite Studio V0 demo profile backed by generated visual assets.',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function createStarterSpriteStudioVisualContentIfMissing(params: {
  bodyTemplates: SpriteBodyTemplateDefinition[];
  animationSets: SpriteAnimationSetDefinition[];
  equipmentBindings: EquipmentVisualBindingDefinition[];
  spriteProfiles: SpriteProfileDefinition[];
  items: AdminItem[];
  assets: StarterSpriteStudioVisualAssetRefs;
}): StarterSpriteStudioVisualContentResult {
  let bodyTemplates = [...params.bodyTemplates];
  let animationSets = [...params.animationSets];
  let equipmentBindings = [...params.equipmentBindings];
  let spriteProfiles = [...params.spriteProfiles];
  let items = [...params.items];

  const touchedBodyTemplateIds = new Set<string>();
  const touchedAnimationSetIds = new Set<string>();
  const touchedEquipmentBindingIds = new Set<string>();
  const touchedSpriteProfileIds = new Set<string>();
  const touchedItemIds = new Set<string>();

  const bodyTemplateSpecs: Array<Parameters<typeof createBodyTemplateFromAsset>[0]> = [
    {
      id: STARTER_V0_BODY_TEMPLATE_IDS.humanMale,
      name: 'Human Male Base',
      description: 'Generated starter humanoid body visual for Sprite Studio.',
      bodyType: 'humanoid',
      raceIds: ['human', 'HUMAN'],
      compatibleBodyTypes: ['humanoid'],
      imageId: params.assets.bodyImageIds.humanMale,
    },
    {
      id: STARTER_V0_BODY_TEMPLATE_IDS.elfMale,
      name: 'Elf Male Base',
      description: 'Generated starter elf body visual for Sprite Studio.',
      bodyType: 'humanoid',
      raceIds: ['elf', 'high_elf', 'forest_elf', 'HIGH_ELF', 'WOOD_ELF'],
      compatibleBodyTypes: ['humanoid'],
      imageId: params.assets.bodyImageIds.elfMale,
    },
    {
      id: STARTER_V0_BODY_TEMPLATE_IDS.dwarf,
      name: 'Dwarf Base',
      description: 'Generated starter dwarf body visual for Sprite Studio.',
      bodyType: 'humanoid',
      raceIds: ['dwarf', 'DWARF'],
      compatibleBodyTypes: ['humanoid'],
      imageId: params.assets.bodyImageIds.dwarf,
    },
    {
      id: STARTER_V0_BODY_TEMPLATE_IDS.wolf,
      name: 'Wolf Basic Sprite',
      description: 'Generated starter wolf body visual for Sprite Studio.',
      bodyType: 'quadruped',
      raceIds: ['wolf', 'beast'],
      compatibleBodyTypes: ['quadruped', 'beast'],
      imageId: params.assets.bodyImageIds.wolf,
    },
    {
      id: STARTER_V0_BODY_TEMPLATE_IDS.monster,
      name: 'Monster Basic Sprite',
      description: 'Generated starter monster body visual for Sprite Studio.',
      bodyType: 'monster',
      raceIds: ['monster'],
      compatibleBodyTypes: ['monster'],
      imageId: params.assets.bodyImageIds.monster,
    },
  ];

  for (const spec of bodyTemplateSpecs) {
    bodyTemplates = upsertById(bodyTemplates, createBodyTemplateFromAsset(spec));
    touchedBodyTemplateIds.add(spec.id);
  }

  const animationSetSpecs: Array<Parameters<typeof createAnimationSet>[0]> = [
    {
      id: STARTER_V0_ANIMATION_SET_IDS.humanoidPaperdoll,
      name: 'Humanoid Basic Paperdoll',
      compatibleBodyTemplateIds: [
        STARTER_V0_BODY_TEMPLATE_IDS.humanMale,
        STARTER_V0_BODY_TEMPLATE_IDS.elfMale,
        STARTER_V0_BODY_TEMPLATE_IDS.dwarf,
      ],
      compatibleBodyTypes: ['humanoid'],
      compatibleSurfaces: ['paperdoll'],
      sheetId: params.assets.animationSheets.humanoidBattle.id,
      description: 'Generated starter paperdoll animation set for humanoid previews.',
      notes: 'Source sheet generated from legacy humanoid drawing module.',
      actionMap: [
        { action: 'idle', row: 0, frameCount: 6, fps: 8, notes: 'Source action: idle' },
        { action: 'walk', row: 1, frameCount: 8, fps: 10, notes: 'Source action: walk' },
        { action: 'attack_melee', row: 2, frameCount: 6, fps: 10, notes: 'Source action: attack', legacyAliases: ['sword_strike'] },
      ],
    },
    {
      id: STARTER_V0_ANIMATION_SET_IDS.humanoidWorld,
      name: 'Humanoid Basic World',
      compatibleBodyTemplateIds: [
        STARTER_V0_BODY_TEMPLATE_IDS.humanMale,
        STARTER_V0_BODY_TEMPLATE_IDS.elfMale,
        STARTER_V0_BODY_TEMPLATE_IDS.dwarf,
      ],
      compatibleBodyTypes: ['humanoid'],
      compatibleSurfaces: ['world'],
      sheetId: params.assets.animationSheets.humanoidBattle.id,
      description: 'Generated starter world animation set for humanoid previews.',
      notes: 'Source sheet generated from legacy humanoid drawing module.',
      actionMap: [
        { action: 'idle', row: 0, frameCount: 6, fps: 8, notes: 'Source action: idle' },
        { action: 'walk', row: 1, frameCount: 8, fps: 10, notes: 'Source action: walk' },
        { action: 'attack_melee', row: 2, frameCount: 6, fps: 10, notes: 'Source action: attack', legacyAliases: ['sword_strike'] },
      ],
    },
    {
      id: STARTER_V0_ANIMATION_SET_IDS.humanoidBattle,
      name: 'Humanoid Basic Battle',
      compatibleBodyTemplateIds: [
        STARTER_V0_BODY_TEMPLATE_IDS.humanMale,
        STARTER_V0_BODY_TEMPLATE_IDS.elfMale,
        STARTER_V0_BODY_TEMPLATE_IDS.dwarf,
      ],
      compatibleBodyTypes: ['humanoid'],
      compatibleSurfaces: ['battle'],
      sheetId: params.assets.animationSheets.humanoidBattle.id,
      description: 'Generated starter battle animation set for humanoid previews.',
      notes: 'Source sheet generated from legacy humanoid drawing module.',
      actionMap: [
        { action: 'idle', row: 0, frameCount: 6, fps: 8, notes: 'Source action: idle' },
        { action: 'walk', row: 1, frameCount: 8, fps: 10, notes: 'Source action: walk' },
        { action: 'attack_melee', row: 2, frameCount: 6, fps: 10, notes: 'Source action: attack', legacyAliases: ['sword_strike'] },
      ],
    },
    {
      id: STARTER_V0_ANIMATION_SET_IDS.elfBattle,
      name: 'Elf Basic Battle',
      compatibleBodyTemplateIds: [STARTER_V0_BODY_TEMPLATE_IDS.elfMale],
      compatibleBodyTypes: ['humanoid'],
      compatibleSurfaces: ['battle'],
      sheetId: params.assets.animationSheets.elfBattle.id,
      description: 'Generated starter battle animation set for elf previews.',
      notes: 'Source sheet generated from legacy elf drawing module.',
      actionMap: [
        { action: 'idle', row: 0, frameCount: 6, fps: 8, notes: 'Source action: idle' },
        { action: 'walk', row: 1, frameCount: 8, fps: 10, notes: 'Source action: walk' },
        { action: 'attack_ranged', row: 2, frameCount: 6, fps: 10, notes: 'Source action: shoot_bow', legacyAliases: ['shoot_bow'] },
      ],
    },
    {
      id: STARTER_V0_ANIMATION_SET_IDS.wolfBattle,
      name: 'Wolf Basic Battle',
      compatibleBodyTemplateIds: [STARTER_V0_BODY_TEMPLATE_IDS.wolf],
      compatibleBodyTypes: ['quadruped', 'beast'],
      compatibleSurfaces: ['battle'],
      sheetId: params.assets.animationSheets.wolfBattle.id,
      description: 'Generated starter battle animation set for wolf previews.',
      notes: 'Source sheet generated from legacy wolf drawing module.',
      actionMap: [
        { action: 'idle', row: 0, frameCount: 6, fps: 8, notes: 'Source action: idle' },
        { action: 'walk', row: 1, frameCount: 8, fps: 10, notes: 'Source action: run_right' },
        { action: 'attack_melee', row: 2, frameCount: 6, fps: 10, notes: 'Source action: bite', legacyAliases: ['bite'] },
      ],
    },
    {
      id: STARTER_V0_ANIMATION_SET_IDS.monsterBattle,
      name: 'Monster Basic Battle',
      compatibleBodyTemplateIds: [STARTER_V0_BODY_TEMPLATE_IDS.monster],
      compatibleBodyTypes: ['monster'],
      compatibleSurfaces: ['battle'],
      sheetId: params.assets.animationSheets.monsterBattle.id,
      description: 'Generated starter battle animation set for monster previews.',
      notes: 'Source sheet generated from legacy monster drawing module.',
      actionMap: [
        { action: 'idle', row: 0, frameCount: 6, fps: 8, notes: 'Source action: idle' },
        { action: 'walk', row: 1, frameCount: 8, fps: 10, notes: 'Source action: walk' },
        { action: 'attack_melee', row: 2, frameCount: 6, fps: 10, notes: 'Source action: claws_slash', legacyAliases: ['claws_slash'] },
      ],
    },
  ];

  for (const spec of animationSetSpecs) {
    animationSets = upsertById(animationSets, createAnimationSet(spec));
    touchedAnimationSetIds.add(spec.id);
  }

  const bindingSpecs: Array<Parameters<typeof createEquipmentBinding>[0]> = [
    {
      id: STARTER_V0_EQUIPMENT_BINDING_IDS.starterSword,
      name: 'Starter Sword Binding',
      itemId: 'starter_sword_01',
      equipmentSlot: 'rightHand',
      weaponGripType: 'one_handed',
      imageId: params.assets.equipmentImageIds.sword,
    },
    {
      id: STARTER_V0_EQUIPMENT_BINDING_IDS.starterShield,
      name: 'Argos Shield Binding',
      itemId: 'shield_argos_private_01',
      equipmentSlot: 'offHand',
      weaponGripType: 'shield',
      imageId: params.assets.equipmentImageIds.shield,
    },
    {
      id: STARTER_V0_EQUIPMENT_BINDING_IDS.starterHelmet,
      name: 'Argos Helmet Binding',
      itemId: 'helmet_argos_private_01',
      equipmentSlot: 'head',
      weaponGripType: 'none',
      imageId: params.assets.equipmentImageIds.helmet,
    },
    {
      id: STARTER_V0_EQUIPMENT_BINDING_IDS.starterChestArmor,
      name: 'Starter Leather Armor Binding',
      itemId: 'starter_leather_armor_01',
      equipmentSlot: 'chest',
      weaponGripType: 'none',
      imageId: params.assets.equipmentImageIds.chestArmor,
    },
  ];

  for (const spec of bindingSpecs) {
    equipmentBindings = upsertById(equipmentBindings, createEquipmentBinding(spec));
    touchedEquipmentBindingIds.add(spec.id);
  }

  for (const [itemId, bindingId] of [
    ['starter_sword_01', STARTER_V0_EQUIPMENT_BINDING_IDS.starterSword],
    ['starter_leather_armor_01', STARTER_V0_EQUIPMENT_BINDING_IDS.starterChestArmor],
    ['shield_argos_private_01', STARTER_V0_EQUIPMENT_BINDING_IDS.starterShield],
    ['helmet_argos_private_01', STARTER_V0_EQUIPMENT_BINDING_IDS.starterHelmet],
  ] as const) {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) {
      continue;
    }
    items = upsertById(items, cloneItemWithLink(item, bindingId));
    touchedItemIds.add(itemId);
  }

  const regalPaladin = createOrUpdateRegalPaladinProfile(
    spriteProfiles.find((entry) => entry.id === STARTER_V0_PROFILE_IDS.regalPaladin),
  );
  spriteProfiles = upsertById(spriteProfiles, regalPaladin);
  touchedSpriteProfileIds.add(regalPaladin.id);

  return {
    bodyTemplates,
    animationSets,
    equipmentBindings,
    spriteProfiles,
    items,
    touchedBodyTemplateIds: Array.from(touchedBodyTemplateIds),
    touchedAnimationSetIds: Array.from(touchedAnimationSetIds),
    touchedEquipmentBindingIds: Array.from(touchedEquipmentBindingIds),
    touchedSpriteProfileIds: Array.from(touchedSpriteProfileIds),
    touchedItemIds: Array.from(touchedItemIds),
  };
}
