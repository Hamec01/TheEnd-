import { type KingdomId, Race, getCityAccessOutcome } from '@theend/rpg-domain';
import type { NpcDefinition, NpcDispositionMode } from '../types/npc';
import type { WorldMapZone } from '../worldmap/zoneEditorTypes';
import { readPlayerCitizenshipKingdomId, readPlayerCitizenshipState } from './playerCivicRuntime';

export interface ReputationStanding {
  value: number;
  label: string;
  tone: 'excellent' | 'good' | 'neutral' | 'bad' | 'hostile';
}

export interface RuntimeNpcReaction {
  disposition: NpcDispositionMode;
  standing: ReputationStanding | null;
  canTalk: boolean;
  canTrade: boolean;
  canTrain: boolean;
  autoHostile: boolean;
  summary: string | null;
}

export interface RuntimeZoneReaction {
  kingdomId: KingdomId | null;
  allowed: boolean;
  hostile: boolean;
  summary: string | null;
  standing: ReputationStanding | null;
}

const RACE_BANNER_BY_RACE: Partial<Record<Race, { label: string; imageUrl: string }>> = {
  [Race.Dwarf]: { label: 'Кланы гномов', imageUrl: '/assets/banners/dwarf.png' },
  [Race.WoodElf]: { label: 'Лесные эльфы', imageUrl: '/assets/banners/forest_elfs.png' },
  [Race.HighElf]: { label: 'Высшие эльфы', imageUrl: '/assets/banners/hight_elfs.png' },
};

const KINGDOM_BANNERS: Record<KingdomId, { label: string; imageUrl: string }> = {
  luminor: { label: 'Луминор', imageUrl: '/assets/banners/luminor.png' },
  artalon: { label: 'Арталон', imageUrl: '/assets/banners/atalion.png' },
  kriantar: { label: 'Криантар', imageUrl: '/assets/banners/kriatar.png' },
  terimia: { label: 'Теримия', imageUrl: '/assets/banners/terimia.png' },
  argos: { label: 'Аргос', imageUrl: '/assets/banners/argos.png' },
};

export function getReputationStanding(value: number): ReputationStanding {
  if (value >= 80) {
    return { value, label: 'Почетный союзник', tone: 'excellent' };
  }
  if (value >= 50) {
    return { value, label: 'Друг государства', tone: 'good' };
  }
  if (value >= 20) {
    return { value, label: 'Свой человек', tone: 'good' };
  }
  if (value <= -90) {
    return { value, label: 'Изгнанник', tone: 'hostile' };
  }
  if (value <= -50) {
    return { value, label: 'Опасный враг', tone: 'hostile' };
  }
  if (value <= -20) {
    return { value, label: 'Под подозрением', tone: 'bad' };
  }
  return { value, label: 'Нейтрально', tone: 'neutral' };
}

export function getKingdomBanner(kingdomId: KingdomId | null | undefined): { label: string; imageUrl: string } | null {
  return kingdomId ? KINGDOM_BANNERS[kingdomId] ?? null : null;
}

export function getCitizenshipBanner(race: Race, citizenshipKingdomId?: KingdomId | null): { label: string; imageUrl: string } | null {
  if (race === Race.Human) {
    return getKingdomBanner(citizenshipKingdomId ?? null);
  }
  return RACE_BANNER_BY_RACE[race] ?? null;
}

export function resolveZoneReaction(zone: Pick<WorldMapZone, 'kingdomId' | 'type' | 'name'>): RuntimeZoneReaction {
  const kingdomId = typeof zone.kingdomId === 'string' && zone.kingdomId.trim()
    ? zone.kingdomId.trim() as KingdomId
    : null;
  if (!kingdomId) {
    return { kingdomId: null, allowed: true, hostile: false, summary: null, standing: null };
  }

  const state = readPlayerCitizenshipState();
  const reputation = state.kingdomReputation[kingdomId] ?? 0;
  const standing = getReputationStanding(reputation);
  const access = getCityAccessOutcome(reputation);
  const summary = access.message ?? (
    standing.tone === 'good'
      ? `${zone.name}: к вам относятся благосклонно.`
      : standing.tone === 'bad' || standing.tone === 'hostile'
        ? `${zone.name}: вас встречают с недоверием.`
        : null
  );

  return {
    kingdomId,
    allowed: access.allowed,
    hostile: access.hostile,
    summary,
    standing,
  };
}

function hostileByReputation(npc: NpcDefinition, standing: ReputationStanding | null): boolean {
  if (!standing) {
    return npc.defaultDisposition === 'hostile' || npc.defaultDisposition === 'aggressive_on_sight';
  }
  if (standing.tone === 'hostile' && (npc.kind === 'guard' || npc.canFight)) {
    return true;
  }
  return npc.defaultDisposition === 'hostile' || npc.defaultDisposition === 'aggressive_on_sight';
}

export function resolveNpcReaction(npc: NpcDefinition): RuntimeNpcReaction {
  const kingdomId = typeof npc.kingdomId === 'string' && npc.kingdomId.trim()
    ? npc.kingdomId.trim() as KingdomId
    : null;
  const state = readPlayerCitizenshipState();
  const reputation = kingdomId ? (state.kingdomReputation[kingdomId] ?? 0) : 0;
  const standing = kingdomId ? getReputationStanding(reputation) : null;

  const autoHostile = hostileByReputation(npc, standing);
  const canUseServices = !standing || standing.value > -50;
  const canTalk = npc.canTalk && !autoHostile;
  const canTrade = npc.canTrade && canUseServices && (!standing || standing.value > -90);
  const canTrain = npc.canTrain && canUseServices;
  const disposition: NpcDispositionMode = autoHostile
    ? 'hostile'
    : npc.defaultDisposition === 'friendly' || standing?.tone === 'good' || standing?.tone === 'excellent'
      ? 'friendly'
      : npc.defaultDisposition;

  const summary = kingdomId && standing
    ? `${KINGDOM_BANNERS[kingdomId]?.label ?? kingdomId}: ${standing.label.toLowerCase()}.`
    : null;

  return {
    disposition,
    standing,
    canTalk,
    canTrade,
    canTrain,
    autoHostile,
    summary,
  };
}

export function buildProfileStandings(race: Race): Array<{ id: string; label: string; standing: ReputationStanding; isCitizen: boolean }> {
  const state = readPlayerCitizenshipState();
  const citizenshipKingdomId = readPlayerCitizenshipKingdomId();
  if (race !== Race.Human) {
    return [];
  }

  return (Object.keys(state.kingdomReputation) as KingdomId[]).map((kingdomId) => ({
    id: kingdomId,
    label: KINGDOM_BANNERS[kingdomId].label,
    standing: getReputationStanding(state.kingdomReputation[kingdomId] ?? 0),
    isCitizen: citizenshipKingdomId === kingdomId,
  }));
}
