import type { ZoneType } from './worldMapNodes';

export type NearbyPlayer = {
  id: string;
  name: string;
  level: number;
  state: 'idle' | 'moving' | 'combat';
};

const nearbyPlayers: NearbyPlayer[] = [
  { id: '1', name: 'DarkWolf', level: 5, state: 'idle' },
  { id: '2', name: 'Eldrin', level: 8, state: 'combat' },
  { id: '3', name: 'NyxRider', level: 6, state: 'moving' },
];

const SAFE_ZONE_TYPES: ZoneType[] = ['safe', 'city', 'settlement', 'rest'];

export function getNearbyPlayers(): NearbyPlayer[] {
  return nearbyPlayers;
}

export function canAttackNearbyPlayer(zoneType: ZoneType | null): boolean {
  if (!zoneType) {
    return false;
  }

  return !SAFE_ZONE_TYPES.includes(zoneType);
}
