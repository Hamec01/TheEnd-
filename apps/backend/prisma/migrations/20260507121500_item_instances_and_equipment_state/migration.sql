-- Add optional per-character equipment state JSON.
-- This keeps legacy slot->itemId columns untouched and backward compatible.
ALTER TABLE "CharacterEquipment"
ADD COLUMN IF NOT EXISTS "equipmentState" JSONB;

-- Add instance-aware storage for non-stackable items.
-- Legacy CharacterInventoryItem(quantity) remains the source of truth for stackables.
CREATE TABLE IF NOT EXISTS "CharacterItemInstance" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "state" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterItemInstance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CharacterItemInstance_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "Character" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CharacterItemInstance_characterId_idx"
  ON "CharacterItemInstance"("characterId");

CREATE INDEX IF NOT EXISTS "CharacterItemInstance_characterId_itemId_idx"
  ON "CharacterItemInstance"("characterId", "itemId");
