/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

function isExplicitResetRequested() {
  const flag = String(process.env.RESET_CHARACTERS_CONFIRM ?? '').trim().toUpperCase();
  return flag === 'YES' || flag === 'TRUE' || flag === '1';
}

async function main() {
  if (!isExplicitResetRequested()) {
    console.log('[reset-all-characters] Skip: reset is disabled by default.');
    console.log('[reset-all-characters] Run with RESET_CHARACTERS_CONFIRM=YES to reset ALL characters.');
    return;
  }

  const prisma = new PrismaClient();
  try {
    const characterCount = await prisma.character.count();
    console.log(`[reset-all-characters] Characters found: ${characterCount}`);

    const ops = [];

    // DB-backed inventory/equipment are always safe to clear when models exist.
    if (prisma.characterInventoryItem?.deleteMany) {
      ops.push(prisma.characterInventoryItem.deleteMany({}));
    }
    if (prisma.characterEquipment?.deleteMany) {
      ops.push(prisma.characterEquipment.deleteMany({}));
    }

    // Skills/loadouts/actionbars are stored in contentStore in some environments (fallback mode).
    if (prisma.contentStore?.deleteMany) {
      ops.push(prisma.contentStore.deleteMany({
        where: {
          key: {
            in: [
              'character-skills-v1',
              'character-skill-loadouts-v1',
              'character-action-slots-v1',
              'character-item-hotbars-v1',
              'character-runtime-resources-v1',
            ],
          },
        },
      }));
    }

    // Core character stats reset.
    ops.push(prisma.character.updateMany({
      data: {
        level: 0,
        exp: 0,
        freePoints: 0,
        gold: 0,
        hpBase: 0,
        mpBase: 0,
        staminaBase: 0,
        strength: 0,
        endurance: 0,
        dexterity: 0,
        intelligence: 0,
        luck: 0,
        speed: 0,
        willpower: 0,
      },
    }));

    await prisma.$transaction(ops);

    console.log('[reset-all-characters] Done: inventory/equipment/skills cleared; stats set to zero.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[reset-all-characters] Failed:', error);
  process.exitCode = 1;
});
