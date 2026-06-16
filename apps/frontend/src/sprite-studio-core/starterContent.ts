import type { SpriteActionType, SpriteAnimationSetDefinition, SpriteBodyTemplateDefinition } from '@theend/rpg-domain';
import { createDefaultAnchorSet, nowIso } from './defaults';

const STARTER_BODY_TEMPLATE_DEFS: Array<{
  id: string;
  name: string;
  raceIds: string[];
  notes: string;
}> = [
  { id: 'body_human_male_base', name: 'Human Male Base', raceIds: ['human', 'HUMAN'], notes: 'Starter humanoid body for human male characters.' },
  { id: 'body_human_female_base', name: 'Human Female Base', raceIds: ['human', 'HUMAN'], notes: 'Starter humanoid body for human female characters.' },
  { id: 'body_elf_male_base', name: 'Elf Male Base', raceIds: ['high_elf', 'forest_elf', 'elf', 'HIGH_ELF', 'WOOD_ELF'], notes: 'Starter humanoid body for elf characters.' },
  { id: 'body_dwarf_male_base', name: 'Dwarf Male Base', raceIds: ['dwarf', 'DWARF'], notes: 'Starter humanoid body for dwarf characters.' },
  { id: 'body_orc_male_base', name: 'Orc Male Base', raceIds: ['orc'], notes: 'Starter humanoid body for orc characters.' },
  { id: 'body_wolf_basic', name: 'Wolf Basic Sprite', raceIds: ['wolf', 'beast'], notes: 'Starter quadruped body for wolf previews.' },
  { id: 'body_monster_basic', name: 'Monster Basic Sprite', raceIds: ['monster'], notes: 'Starter monster body for creature previews.' },
];

const STARTER_ANIMATION_SET_DEFS: Array<{
  id: string;
  name: string;
  surface: 'paperdoll' | 'world' | 'battle';
}> = [
  { id: 'animset_humanoid_basic_paperdoll', name: 'Humanoid Basic Paperdoll', surface: 'paperdoll' },
  { id: 'animset_humanoid_basic_world', name: 'Humanoid Basic World', surface: 'world' },
  { id: 'animset_humanoid_basic_battle', name: 'Humanoid Basic Battle', surface: 'battle' },
];

const STARTER_ACTIONS: SpriteActionType[] = ['idle', 'walk', 'attack_melee', 'hit', 'death'];

function createStarterBodyTemplate(definition: (typeof STARTER_BODY_TEMPLATE_DEFS)[number]): SpriteBodyTemplateDefinition {
  const now = nowIso();
  return {
    id: definition.id,
    schemaVersion: 1,
    name: definition.name,
    description: definition.notes,
    bodyType: definition.id === 'body_wolf_basic'
      ? 'quadruped'
      : definition.id === 'body_monster_basic'
        ? 'monster'
        : 'humanoid',
    compatibleRaceIds: [...definition.raceIds],
    compatibleBodyTypes: definition.id === 'body_wolf_basic'
      ? ['quadruped', 'beast']
      : definition.id === 'body_monster_basic'
        ? ['monster']
        : ['humanoid'],
    supportedSurfaces: ['paperdoll', 'world', 'battle'],
    paperdoll: { scale: 1, offsetX: 0, offsetY: 0 },
    world: { scale: 1, offsetX: 0, offsetY: 0 },
    battle: { scale: 1, offsetX: 0, offsetY: 0 },
    anchors: createDefaultAnchorSet(),
    tags: ['starter'],
    notes: definition.notes,
    createdAt: now,
    updatedAt: now,
  };
}

function createStarterAnimationSet(definition: (typeof STARTER_ANIMATION_SET_DEFS)[number]): SpriteAnimationSetDefinition {
  const now = nowIso();
  return {
    id: definition.id,
    schemaVersion: 1,
    name: definition.name,
    description: `Starter ${definition.surface} animation set for humanoid previews.`,
    compatibleBodyTemplateIds: [],
    compatibleRaceIds: [],
    compatibleBodyTypes: ['humanoid'],
    compatibleSurfaces: [definition.surface],
    clips: STARTER_ACTIONS.map((action, index) => ({
      action,
      label: action,
      frameWidth: 128,
      frameHeight: 128,
      frameCount: 1,
      fps: action === 'walk' ? 10 : 8,
      row: index,
      loop: action !== 'death',
      legacyAliases: action === 'death' ? ['die'] : [],
      notes: 'Starter placeholder clip.',
    })),
    notes: 'Starter animation set. Replace image refs with project art.',
    createdAt: now,
    updatedAt: now,
  };
}

export interface StarterSpriteStudioContentResult {
  bodyTemplates: SpriteBodyTemplateDefinition[];
  animationSets: SpriteAnimationSetDefinition[];
  createdBodyTemplateIds: string[];
  createdAnimationSetIds: string[];
}

export function createStarterSpriteStudioContentIfMissing(params: {
  bodyTemplates: SpriteBodyTemplateDefinition[];
  animationSets: SpriteAnimationSetDefinition[];
}): StarterSpriteStudioContentResult {
  const bodyTemplateIds = new Set(params.bodyTemplates.map((entry) => entry.id));
  const animationSetIds = new Set(params.animationSets.map((entry) => entry.id));

  const createdBodyTemplates = STARTER_BODY_TEMPLATE_DEFS
    .filter((entry) => !bodyTemplateIds.has(entry.id))
    .map(createStarterBodyTemplate);

  const createdAnimationSets = STARTER_ANIMATION_SET_DEFS
    .filter((entry) => !animationSetIds.has(entry.id))
    .map(createStarterAnimationSet);

  return {
    bodyTemplates: [...params.bodyTemplates, ...createdBodyTemplates],
    animationSets: [...params.animationSets, ...createdAnimationSets],
    createdBodyTemplateIds: createdBodyTemplates.map((entry) => entry.id),
    createdAnimationSetIds: createdAnimationSets.map((entry) => entry.id),
  };
}
