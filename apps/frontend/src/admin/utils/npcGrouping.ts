import type { NpcDefinition } from '../../types/npc';

export type GroupingKey = 'kingdom' | 'faction' | 'city' | 'kind' | 'type' | 'status' | 'race';

export interface GroupedNpcs {
  [groupName: string]: NpcDefinition[];
}

export function groupNpcsByKey(npcs: NpcDefinition[], key: GroupingKey): GroupedNpcs {
  const grouped: GroupedNpcs = {};

  for (const npc of npcs) {
    let groupName = 'Неизвестно';

    switch (key) {
      case 'kingdom':
        groupName = npc.kingdomId ? `Королевство: ${npc.kingdomId}` : 'Без королевства';
        break;
      case 'faction':
        groupName = npc.factionId ? `Фракция: ${npc.factionId}` : 'Без фракции';
        break;
      case 'city':
        groupName = npc.cityId ? `Город: ${npc.cityId}` : 'Без города';
        break;
      case 'kind':
        groupName = `Тип: ${npc.kind}`;
        break;
      case 'type':
        // Группируем по capability (quest_giver, trader, guard и т.д.)
        const typeGroups: string[] = [];
        if (npc.canGiveQuests) typeGroups.push('Выдает квесты');
        if (npc.canTrade) typeGroups.push('Торгует');
        if (npc.canTrain) typeGroups.push('Тренирует');
        if (npc.canFight) typeGroups.push('Боец');
        groupName = typeGroups.length > 0 ? typeGroups[0]! : 'Обычный NPC';
        break;
      case 'status':
        groupName = `Статус: ${npc.status}`;
        break;
      case 'race':
        groupName = `Раса: ${npc.race}`;
        break;
    }

    if (!grouped[groupName]) {
      grouped[groupName] = [];
    }
    grouped[groupName]!.push(npc);
  }

  // Сортируем группы по количеству NPC (больше вверху) и названию
  const sorted: GroupedNpcs = {};
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const countDiff = grouped[b]!.length - grouped[a]!.length;
    if (countDiff !== 0) return countDiff;
    return a.localeCompare(b);
  });

  for (const key of sortedKeys) {
    sorted[key] = grouped[key]!.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  }

  return sorted;
}

export function getGroupingLabel(key: GroupingKey): string {
  const labels: Record<GroupingKey, string> = {
    kingdom: 'По королевствам',
    faction: 'По фракциям',
    city: 'По городам',
    kind: 'По типам NPC',
    type: 'По умениям',
    status: 'По статусу',
    race: 'По расам',
  };
  return labels[key];
}
