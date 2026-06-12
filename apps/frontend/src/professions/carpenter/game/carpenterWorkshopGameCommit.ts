import type { InventoryState } from '@theend/rpg-domain';
import { adjustDevInventoryItem, syncArenaItemInstance } from '../../../api';
import type {
  AdminItem,
  CarpenterCraftedComponentSnapshot,
  CarpenterItemTemplate,
  Material,
  TreeDefinition,
} from '../../../services/content/models';
import { itemsService } from '../../../services/content/itemsService';
import {
  PLAYER_HIDDEN_RUNTIME_ITEM_TAG,
  PLAYER_RUNTIME_ITEM_TAG,
  upsertPlayerItemInstance,
} from '../../../services/playerItemInstances';
import {
  mergeInventoryWithRuntimeOverlay,
  PLAYER_INVENTORY_REMOVALS_STORAGE_KEY,
  readStringNumberRecordStorage,
  writeStringNumberRecordStorage,
} from '../../../utils/playerInventory';
import {
  buildCarpenterCraftedComponentSnapshot,
  buildCarpenterInputRemovals,
  createCarpenterComponentItemDefinition,
  createRuntimeCraftItemId,
  getInventoryQuantity,
  removeFromInventoryState,
  resolveCarpenterTemplateOutputKind,
  type CarpenterCraftInputSelection,
} from '../carpenterComponentCrafting';

interface CarpenterWorkshopContent {
  items: AdminItem[];
  materials: Material[];
  trees: TreeDefinition[];
}

export interface ConsumeCarpenterWorkshopInputsResult {
  ok: boolean;
  errors: string[];
  inventory?: InventoryState;
}

export interface CommitCarpenterWorkshopSuccessResult {
  ok: boolean;
  errors: string[];
  inventory?: InventoryState;
  createdItemId?: string;
  createdItemName?: string;
  snapshot?: CarpenterCraftedComponentSnapshot;
}

export async function consumeCarpenterWorkshopInputs(params: {
  characterId: string;
  template: CarpenterItemTemplate;
  inputSelections: CarpenterCraftInputSelection[];
  inventory: InventoryState;
}): Promise<ConsumeCarpenterWorkshopInputsResult> {
  const removals = buildCarpenterInputRemovals(params.template, params.inputSelections);
  for (const removal of removals) {
    const currentQty = getInventoryQuantity(params.inventory, removal.itemId);
    if (currentQty < removal.quantity) {
      return {
        ok: false,
        errors: [`Недостаточно материала ${removeatReadableLabel(removal.itemId, removal.slotLabel)}.`],
      };
    }
  }

  let latestInventory: InventoryState = params.inventory;
  let usedLocalBackendFallback = false;
  try {
    for (const removal of removals) {
      const quantityToRemove = Math.max(0, Math.floor(removal.quantity));
      if (quantityToRemove <= 0) {
        continue;
      }

      try {
        const hub = await adjustDevInventoryItem(params.characterId, {
          itemId: removal.itemId,
          quantityDelta: -quantityToRemove,
        });
        latestInventory = usedLocalBackendFallback ? mergeInventoryWithRuntimeOverlay(hub.inventory) : hub.inventory;
      } catch (error) {
        const persistedRemovals = readStringNumberRecordStorage(PLAYER_INVENTORY_REMOVALS_STORAGE_KEY);
        persistedRemovals[removal.itemId] = Math.max(0, Math.floor(Number(persistedRemovals[removal.itemId]) || 0)) + quantityToRemove;
        writeStringNumberRecordStorage(PLAYER_INVENTORY_REMOVALS_STORAGE_KEY, persistedRemovals);
        latestInventory = removeFromInventoryState(latestInventory, removal.itemId, quantityToRemove);
        usedLocalBackendFallback = true;
        if (!String((error as Error).message ?? '').includes('Item is not in inventory')) {
          console.warn('Carpenter workshop consume fallback applied:', error);
        }
      }
    }
  } catch (error) {
    return {
      ok: false,
      errors: [`Не удалось списать материалы: ${(error as Error).message}`],
    };
  }

  return {
    ok: true,
    errors: [],
    inventory: latestInventory,
  };
}

export async function commitCarpenterWorkshopSuccess(params: {
  characterId: string;
  template: CarpenterItemTemplate;
  inputSelections: CarpenterCraftInputSelection[];
  inventoryAfterConsume: InventoryState;
  content: CarpenterWorkshopContent;
  carpenterLevel?: number;
  inheritedFromComponent?: Map<string, CarpenterCraftedComponentSnapshot>;
  qualityScore: number;
}): Promise<CommitCarpenterWorkshopSuccessResult> {
  const snapshot = buildCarpenterCraftedComponentSnapshot({
    template: params.template,
    inputSelections: params.inputSelections,
    content: params.content,
    carpenterLevel: params.carpenterLevel,
    qualityScore: params.qualityScore,
    craftedByCharacterId: params.characterId,
    inheritedFromComponent: params.inheritedFromComponent,
  });

  const outputComponentKind = resolveCarpenterTemplateOutputKind(params.template);
  const outputItemId = createRuntimeCraftItemId(outputComponentKind, snapshot.sourceTreeId);
  const outputDraft = createCarpenterComponentItemDefinition({
    template: params.template,
    snapshot,
    outputItemId,
    ownerCharacterId: params.characterId,
  });

  let created: AdminItem;
  try {
    created = await itemsService.create(outputDraft);
  } catch (error) {
    return {
      ok: false,
      errors: [`Не удалось создать результат мастерской: ${(error as Error).message}`],
      inventory: params.inventoryAfterConsume,
    };
  }

  const instance = upsertPlayerItemInstance({
    itemId: created.id,
    ownerId: params.characterId,
    itemSnapshot: created,
    customName: created.name,
    craftedFromTemplateId: params.template.id,
    craftedMaterialIds: params.inputSelections.map((entry) => entry.itemId),
    craftedByProfession: 'carpenter',
    carpenterComponent: snapshot,
    tags: created.tags ?? [PLAYER_RUNTIME_ITEM_TAG, PLAYER_HIDDEN_RUNTIME_ITEM_TAG],
    notes: 'carpenter_workshop_game',
  });
  await syncArenaItemInstance(params.characterId, created.id, {
    version: 1,
    itemSnapshot: created,
    customName: created.name,
    ownerTag: params.characterId,
    craftedFromTemplateId: params.template.id,
    craftedMaterialIds: params.inputSelections.map((entry) => entry.itemId),
    craftedByProfession: 'carpenter',
    carpenterComponent: snapshot,
    tags: created.tags,
    notes: 'carpenter_workshop_game',
    forgedAtIso: instance.updatedAt,
  }, instance.id).catch(() => undefined);

  let latestInventory = params.inventoryAfterConsume;
  let usedLocalBackendFallback = false;
  try {
    const addHub = await adjustDevInventoryItem(params.characterId, { itemId: created.id, quantityDelta: 1 });
    latestInventory = usedLocalBackendFallback ? mergeInventoryWithRuntimeOverlay(addHub.inventory) : addHub.inventory;
  } catch (error) {
    const persistedRemovals = readStringNumberRecordStorage(PLAYER_INVENTORY_REMOVALS_STORAGE_KEY);
    persistedRemovals[created.id] = Math.max(0, Math.floor(Number(persistedRemovals[created.id]) || 0)) - 1;
    writeStringNumberRecordStorage(PLAYER_INVENTORY_REMOVALS_STORAGE_KEY, persistedRemovals);
    latestInventory = {
      ...latestInventory,
      items: [
        ...latestInventory.items.filter((entry) => entry.itemId !== created.id),
        {
          itemId: created.id,
          quantity: (latestInventory.items.find((entry) => entry.itemId === created.id)?.quantity ?? 0) + 1,
        },
      ],
    };
    usedLocalBackendFallback = true;
    console.warn('Carpenter workshop add fallback applied:', error);
  }

  return {
    ok: true,
    errors: [],
    inventory: latestInventory,
    createdItemId: created.id,
    createdItemName: created.name,
    snapshot,
  };
}

function removeatReadableLabel(itemId: string, slotLabel: string): string {
  return slotLabel ? `${itemId} (${slotLabel})` : itemId;
}
