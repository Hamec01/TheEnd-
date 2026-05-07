# Copilot Handoff: Universal Item Effects Roadmap

Source plan: "Plan for universal item effects, augments, sockets, blacksmith, sets" (docx in repo root).

## Current status

Completed:
- C0. Data contracts in `apps/backend/src/content/content.types.ts`.
- C1. Normalization/import/export support in `apps/backend/src/content/content.service.ts`.

Not started:
- R0, R1, I0, I1, I2, B0, B1, S0, S1, U0, Q0.

## What was implemented (C0 + C1)

1. Added new content contracts and optional item fields:
- `ItemEffect`, `ItemAugment`, `ItemSocket`, `SlotUpgradeRules`.
- `ItemSet`, `ItemSetBonus`, `RuneComplex`.
- New optional `AdminItem` fields: `equipmentEffects`, `useEffects`, `augment`, `augmentSlots`, `slotUpgradeRules`, `setId`, `tags`, etc.
- New optional collections on content DB: `itemSets`, `runeComplexes`.

2. Extended content service processing:
- Added `itemSets` and `runeComplexes` to `CONTENT_COLLECTIONS`.
- Updated `countContent`, `createSeedDatabase`, `normalizeDatabase`, `mergeDatabasesById`, `extractExtraContent` behavior (via collection list), `createCollectionEntry`, `updateCollectionEntry`, `importLegacy`, `collectImportWarnings`, and `normalizeItemInput`.
- Added normalizers for new entities and item effect payloads.

3. Added integrity checks for new data:
- Duplicate IDs in `itemSets` and `runeComplexes`.
- Missing `pieceItemIds` references in item sets.
- Missing rune item IDs in rune complexes.
- `socketedAugmentItemId` must reference an item with non-null `augment`.

## Important compatibility constraints (already respected)

- Legacy fields must remain untouched and compatible:
  - `bonuses`, `damageMin`, `damageMax`, `armorValue`, `effects`, `combatEffects`, `useEffect`.
- New fields are optional and normalize safely when absent.
- Old JSON backups/import payloads should still load.

## Files changed so far

- `apps/backend/src/content/content.types.ts`
- `apps/backend/src/content/content.service.ts`

## Notes for next Copilot session

1. Keep C0/C1 behavior backward-compatible.
2. Do not remove or rename legacy fields.
3. Next recommended task: R0 (`item-effects.formatter.ts`) unless priority is changed.
4. Runtime/build in this repo can show unrelated baseline TypeScript errors in other modules; validate changed files first.
