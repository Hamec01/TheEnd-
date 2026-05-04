-- AlterTable: add combatMastery to Character
ALTER TABLE "Character" ADD COLUMN "combatMastery" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: CharacterSkill
CREATE TABLE "CharacterSkill" (
    "id"          TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "skillId"     TEXT NOT NULL,
    "level"       INTEGER NOT NULL DEFAULT 1,
    "learnedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType"  TEXT NOT NULL,
    "sourceId"    TEXT,

    CONSTRAINT "CharacterSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CharacterSkillLoadout
CREATE TABLE "CharacterSkillLoadout" (
    "characterId" TEXT NOT NULL,
    "slots"       JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "CharacterSkillLoadout_pkey" PRIMARY KEY ("characterId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CharacterSkill_characterId_skillId_key" ON "CharacterSkill"("characterId", "skillId");
CREATE INDEX "CharacterSkill_characterId_idx" ON "CharacterSkill"("characterId");

-- AddForeignKey
ALTER TABLE "CharacterSkill" ADD CONSTRAINT "CharacterSkill_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CharacterSkillLoadout" ADD CONSTRAINT "CharacterSkillLoadout_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
