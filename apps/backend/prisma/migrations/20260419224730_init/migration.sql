-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "race" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "freePoints" INTEGER NOT NULL DEFAULT 5,
    "gold" INTEGER NOT NULL DEFAULT 500,
    "hpBase" INTEGER NOT NULL,
    "mpBase" INTEGER NOT NULL,
    "staminaBase" INTEGER NOT NULL,
    "strength" INTEGER NOT NULL,
    "endurance" INTEGER NOT NULL,
    "dexterity" INTEGER NOT NULL,
    "intelligence" INTEGER NOT NULL,
    "luck" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "willpower" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Character_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterInventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CharacterInventoryItem_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterEquipment" (
    "characterId" TEXT NOT NULL PRIMARY KEY,
    "weapon" TEXT,
    "helmet" TEXT,
    "armor" TEXT,
    "boots" TEXT,
    "gloves" TEXT,
    "shield" TEXT,
    CONSTRAINT "CharacterEquipment_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_login_key" ON "Account"("login");

-- CreateIndex
CREATE INDEX "Character_accountId_idx" ON "Character"("accountId");

-- CreateIndex
CREATE INDEX "CharacterInventoryItem_characterId_idx" ON "CharacterInventoryItem"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterInventoryItem_characterId_itemId_key" ON "CharacterInventoryItem"("characterId", "itemId");
