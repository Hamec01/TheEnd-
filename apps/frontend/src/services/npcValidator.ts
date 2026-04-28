import type { NpcDefinition, NpcValidationWorldData } from '../types/npc';

function hasId(list: string[], id: string | undefined): boolean {
  if (!id) {
    return true;
  }
  return list.includes(id);
}

export function validateNpc(npc: NpcDefinition, worldData: NpcValidationWorldData): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (npc.status === 'active' && !npc.name.trim()) {
    errors.push('Active NPC must have a name.');
  }

  if (npc.status === 'active' && !npc.kind) {
    errors.push('Active NPC must have a kind.');
  }

  if (npc.canTrade && !npc.traderId) {
    errors.push('canTrade is true but traderId is missing.');
  }

  if (npc.canFight && !npc.combat) {
    errors.push('canFight is true but combat data is missing.');
  }

  if ((npc.defaultDisposition === 'hostile' || npc.defaultDisposition === 'aggressive_on_sight') && !npc.combat) {
    errors.push('Hostile NPC requires combat data.');
  }

  if (npc.canTalk && npc.dialogues.length === 0 && !npc.description.trim()) {
    errors.push('canTalk is true but there is no dialogue and no fallback description.');
  }

  if (!hasId(worldData.traderIds, npc.traderId)) {
    errors.push(`Broken trader reference: ${npc.traderId}.`);
  }

  for (const binding of npc.questBindings) {
    if (!hasId(worldData.questIds, binding.questId)) {
      errors.push(`Broken quest reference: ${binding.questId}.`);
    }
  }

  for (const dialogueBinding of npc.dialogues) {
    if (!hasId(worldData.dialogueIds, dialogueBinding.dialogueId)) {
      errors.push(`Broken dialogue reference: ${dialogueBinding.dialogueId}.`);
    }
  }

  for (const mapBinding of npc.mapBindings) {
    if (!hasId(worldData.mapIds, mapBinding.mapId)) {
      errors.push(`Broken map reference: ${mapBinding.mapId}.`);
    }
    if (!hasId(worldData.zoneIds, mapBinding.zoneId)) {
      errors.push(`Broken zone reference: ${mapBinding.zoneId}.`);
    }
    if (!hasId(worldData.markerIds, mapBinding.markerId)) {
      errors.push(`Broken marker reference: ${mapBinding.markerId}.`);
    }
  }

  if (npc.combat) {
    if (!hasId(worldData.itemIds, npc.combat.weaponItemId)) {
      errors.push(`Broken weapon item reference: ${npc.combat.weaponItemId}.`);
    }

    for (const armorId of npc.combat.armorItemIds ?? []) {
      if (!hasId(worldData.itemIds, armorId)) {
        errors.push(`Broken armor item reference: ${armorId}.`);
      }
    }

    for (const skillId of npc.combat.skillIds) {
      if (!hasId(worldData.skillIds, skillId)) {
        errors.push(`Broken combat skill reference: ${skillId}.`);
      }
    }
  }

  if (npc.inventory) {
    for (const itemId of npc.inventory.itemIds) {
      if (!hasId(worldData.itemIds, itemId)) {
        errors.push(`Broken inventory item reference: ${itemId}.`);
      }
    }

    for (const questItemId of npc.inventory.questItemIds) {
      if (!hasId(worldData.questItemIds, questItemId)) {
        errors.push(`Broken quest item reference: ${questItemId}.`);
      }
    }
  }

  if (npc.trainer) {
    for (const skillId of npc.trainer.skillIds ?? []) {
      if (!hasId(worldData.skillIds, skillId)) {
        errors.push(`Broken trainer skill reference: ${skillId}.`);
      }
    }

    for (const questId of npc.trainer.requiresQuestIds ?? []) {
      if (!hasId(worldData.questIds, questId)) {
        errors.push(`Broken trainer quest reference: ${questId}.`);
      }
    }
  }

  if (!npc.portraitUrl) {
    warnings.push('NPC has no portrait.');
  }
  if (npc.mapBindings.length === 0) {
    warnings.push('NPC has no map bindings.');
  }
  if (npc.isUnique && npc.canRespawn) {
    warnings.push('Unique NPC has respawn enabled.');
  }
  if (npc.canGiveQuests && npc.questBindings.length === 0) {
    warnings.push('canGiveQuests is true but quest bindings are empty.');
  }
  if (npc.canTrain && !npc.trainer) {
    warnings.push('canTrain is true but trainer data is missing.');
  }
  if (npc.kind === 'boss' && !npc.combat?.lootTableId) {
    warnings.push('Boss NPC has no loot table.');
  }
  if (npc.factionId && !npc.kingdomId && !npc.cityId) {
    warnings.push('NPC has faction but no kingdom/city context.');
  }

  return { errors, warnings };
}
