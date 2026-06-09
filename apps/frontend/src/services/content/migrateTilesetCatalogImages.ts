import type { AdminItem, Material, StoredImage } from './models';
import { ensureItemImagePersisted } from './ensureItemImagePersisted';
import { itemsService } from './itemsService';
import { materialsService } from './materialsService';

const MIGRATION_STORAGE_KEY = 'theend.tilesetIconMigration.v1';

function hasTilesetImage(entry: { imageRef?: { type?: string } | null }): boolean {
  return entry.imageRef?.type === 'tileset';
}

export async function migrateTilesetCatalogImages(input: {
  materials: Material[];
  items: AdminItem[];
  runtimeImages: StoredImage[];
}): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  const pendingMaterials = input.materials.filter(hasTilesetImage);
  const pendingItems = input.items.filter(hasTilesetImage);
  if (pendingMaterials.length === 0 && pendingItems.length === 0) {
    window.localStorage.setItem(MIGRATION_STORAGE_KEY, 'done');
    return false;
  }

  const migrationStamp = window.localStorage.getItem(MIGRATION_STORAGE_KEY) ?? '';
  const signature = [
    pendingMaterials.map((entry) => entry.id).sort().join(','),
    pendingItems.map((entry) => entry.id).sort().join(','),
  ].join('|');
  if (migrationStamp === signature) {
    return false;
  }

  let changed = false;

  for (const material of pendingMaterials) {
    try {
      const persisted = await ensureItemImagePersisted(material.imageRef, material.imagePath, {
        entityId: material.id,
        entityKind: 'materials',
        runtimeImages: input.runtimeImages,
      });
      if (!persisted.imageRef || persisted.imageRef.type === 'tileset') {
        continue;
      }
      await materialsService.update(material.id, {
        ...material,
        imageRef: persisted.imageRef,
        imagePath: persisted.imagePath,
        updatedAt: new Date().toISOString(),
      });
      changed = true;
    } catch {
      // Keep going — missing sheet definitions may still block some entries.
    }
  }

  for (const item of pendingItems) {
    try {
      const persisted = await ensureItemImagePersisted(item.imageRef, item.imagePath, {
        entityId: item.id,
        entityKind: 'items',
        runtimeImages: input.runtimeImages,
      });
      if (!persisted.imageRef || persisted.imageRef.type === 'tileset') {
        continue;
      }
      await itemsService.update(item.id, {
        ...item,
        imageRef: persisted.imageRef,
        imagePath: persisted.imagePath,
        updatedAt: new Date().toISOString(),
      });
      changed = true;
    } catch {
      // Keep going.
    }
  }

  window.localStorage.setItem(MIGRATION_STORAGE_KEY, signature);
  return changed;
}
