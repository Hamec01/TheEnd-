import { normalizePlayerProfessionsState, type PlayerProfessionsState, type ProfessionId } from '@theend/rpg-domain';

const LEGACY_PROFESSION_ALIASES: Record<ProfessionId, readonly string[]> = {
  mining: ['miner', 'mining'],
  blacksmithing: ['blacksmith'],
  carpenter: ['carpentry'],
  leatherworking: ['leatherworker'],
  jewelcrafting: ['jeweler'],
  runecrafting: ['runecrafter'],
  fishing: ['fisher'],
  cooking: ['cook'],
  hunting: ['hunter'],
  alchemy: ['alchemist'],
  herbalism: ['herbalist'],
};

export interface ProfessionCompatPlayer {
  professionId?: string;
  professions?: PlayerProfessionsState;
}

function normalizeId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function getUnlockedProfessionIds(playerProfessions: PlayerProfessionsState | undefined): ProfessionId[] {
  const normalized = normalizePlayerProfessionsState(playerProfessions);
  const seen = new Set<ProfessionId>();
  const out: ProfessionId[] = [];

  for (const entry of normalized.professions) {
    if (!seen.has(entry.professionId)) {
      seen.add(entry.professionId);
      out.push(entry.professionId);
    }
  }

  return out;
}

function getLegacyAliasesForProfession(professionId: ProfessionId): readonly string[] {
  return LEGACY_PROFESSION_ALIASES[professionId] ?? [];
}

function toProfessionId(value: string): ProfessionId | null {
  const normalized = normalizeId(value);
  if (normalized === 'mining'
    || normalized === 'blacksmithing'
    || normalized === 'carpenter'
    || normalized === 'leatherworking'
    || normalized === 'jewelcrafting'
    || normalized === 'runecrafting'
    || normalized === 'fishing'
    || normalized === 'cooking'
    || normalized === 'hunting'
    || normalized === 'alchemy'
    || normalized === 'herbalism') {
    return normalized;
  }
  return null;
}

export function getLegacyProfessionIdFromProfessions(playerProfessions: PlayerProfessionsState | undefined): string | undefined {
  const unlocked = getUnlockedProfessionIds(playerProfessions);
  for (const professionId of unlocked) {
    const aliases = getLegacyAliasesForProfession(professionId);
    if (aliases.length > 0) {
      return aliases[0];
    }
  }
  return undefined;
}

export function playerHasProfessionCompat(player: ProfessionCompatPlayer, requiredProfessionId: string | undefined): boolean {
  const required = normalizeId(requiredProfessionId);
  if (!required) {
    return false;
  }

  const legacyProfessionId = normalizeId(player.professionId);
  if (legacyProfessionId && legacyProfessionId === required) {
    return true;
  }

  const unlocked = getUnlockedProfessionIds(player.professions);
  for (const professionId of unlocked) {
    if (professionId === required) {
      return true;
    }

    const aliases = getLegacyAliasesForProfession(professionId);
    if (aliases.some((entry) => normalizeId(entry) === required)) {
      return true;
    }
  }

  const legacyAsNew = toProfessionId(legacyProfessionId);
  if (legacyAsNew && legacyAsNew === required) {
    return true;
  }

  if (legacyAsNew) {
    const aliases = getLegacyAliasesForProfession(legacyAsNew);
    if (aliases.some((entry) => normalizeId(entry) === required)) {
      return true;
    }
  }

  return false;
}

export function getAllCompatibleProfessionIds(): string[] {
  const ids = new Set<string>();
  const keys = Object.keys(LEGACY_PROFESSION_ALIASES) as ProfessionId[];
  for (const professionId of keys) {
    ids.add(professionId);
    for (const alias of LEGACY_PROFESSION_ALIASES[professionId]) {
      ids.add(alias);
    }
  }
  return Array.from(ids);
}
