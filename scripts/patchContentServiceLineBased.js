const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../apps/backend/src/content/content.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Determine line ending
const isCRLF = content.includes('\r\n');
const eol = isCRLF ? '\r\n' : '\n';

let lines = content.split(/\r?\n/);

// 1. Patch imports
let soundImportIdx = lines.findIndex(l => l.trim() === 'SoundDefinition,');
if (soundImportIdx !== -1 && !lines.some(l => l.trim() === 'TreeDefinition,')) {
  lines.splice(soundImportIdx + 1, 0, '  TreeDefinition,', '  BiomeDefinition,');
  console.log('1. Imports patched.');
} else {
  console.log('1. Warning or already done: imports.');
}

// 2. Patch CONTENT_COLLECTIONS
let collectionsIdx = lines.findIndex(l => l.includes('const CONTENT_COLLECTIONS: ContentCollectionName[] = ['));
if (collectionsIdx !== -1 && !lines.some(l => l.includes("'trees'"))) {
  // Find the closing ]; after collectionsIdx
  let closingIdx = -1;
  for (let i = collectionsIdx; i < lines.length; i++) {
    if (lines[i].trim() === '];') {
      closingIdx = i;
      break;
    }
  }
  if (closingIdx !== -1) {
    lines.splice(closingIdx, 0, "  'trees',", "  'biomes',");
    console.log('2. CONTENT_COLLECTIONS patched.');
  } else {
    console.log('2. Error: closing ]; for collections not found.');
  }
} else {
  console.log('2. Warning or already done: CONTENT_COLLECTIONS.');
}

// 3. Patch createEmptyDatabase
let emptyDbIdx = lines.findIndex(l => l.includes('function createEmptyDatabase(): ContentDatabase {'));
if (emptyDbIdx !== -1 && !lines.slice(emptyDbIdx, emptyDbIdx + 50).some(l => l.includes('trees: [],'))) {
  let soundsIdx = lines.findIndex((l, idx) => idx > emptyDbIdx && l.includes('sounds: [],'));
  if (soundsIdx !== -1) {
    lines.splice(soundsIdx + 1, 0, '    trees: [],', '    biomes: [],');
    console.log('3. createEmptyDatabase patched.');
  } else {
    console.log('3. Error: sounds: [], in createEmptyDatabase not found.');
  }
} else {
  console.log('3. Warning or already done: createEmptyDatabase.');
}

// Note: Normalizers (Step 4) and normalizeDatabase (Step 5) were successfully applied by the previous script. Let's make sure they are in.
if (!lines.some(l => l.includes('function normalizeTreeInput'))) {
  console.log('Error: normalizeTreeInput function is missing in lines. Make sure it is there.');
}

// 6. Patch createCollectionEntry
let createColIdx = lines.findIndex(l => l.includes('async createCollectionEntry<K extends ContentCollectionName>'));
if (createColIdx !== -1) {
  let actionsIdx = lines.findIndex((l, idx) => idx > createColIdx && l.includes("collectionName === 'blacksmithItemWorkActions'"));
  if (actionsIdx !== -1 && !lines.slice(actionsIdx, actionsIdx + 10).some(l => l.includes(`collectionName === 'trees'`))) {
    // We insert after the nextEntry assignment and before the next '}'
    // Let's find where the next '}' is
    let nextBraceIdx = lines.findIndex((l, idx) => idx > actionsIdx && l.trim().startsWith('} else'));
    if (nextBraceIdx !== -1) {
      lines.splice(nextBraceIdx, 0, 
        "    } else if (collectionName === 'trees') {",
        "      nextEntry = normalizeTreeInput(payload as unknown as TreeDefinition) as unknown as ContentCollectionMap[K];",
        "    } else if (collectionName === 'biomes') {",
        "      nextEntry = normalizeBiomeInput(payload as unknown as BiomeDefinition) as unknown as ContentCollectionMap[K];"
      );
      console.log('6. createCollectionEntry patched.');
    } else {
      console.log('6. Error: close brace in createCollectionEntry not found.');
    }
  } else {
    console.log('6. Warning or already done: createCollectionEntry.');
  }
}

// 7. Patch updateCollectionEntry
let updateColIdx = lines.findIndex(l => l.includes('async updateCollectionEntry<K extends ContentCollectionName>'));
if (updateColIdx !== -1) {
  let actionsIdx = lines.findIndex((l, idx) => idx > updateColIdx && l.includes("collectionName === 'blacksmithItemWorkActions'"));
  if (actionsIdx !== -1 && !lines.slice(actionsIdx, actionsIdx + 10).some(l => l.includes(`collectionName === 'trees'`))) {
    let nextBraceIdx = lines.findIndex((l, idx) => idx > actionsIdx && l.trim().startsWith('} else'));
    if (nextBraceIdx !== -1) {
      lines.splice(nextBraceIdx, 0, 
        "    } else if (collectionName === 'trees') {",
        "      merged = normalizeTreeInput(mergedBase as unknown as TreeDefinition) as unknown as ContentCollectionMap[K];",
        "    } else if (collectionName === 'biomes') {",
        "      merged = normalizeBiomeInput(mergedBase as unknown as BiomeDefinition) as unknown as ContentCollectionMap[K];"
      );
      console.log('7. updateCollectionEntry patched.');
    } else {
      console.log('7. Error: close brace in updateCollectionEntry not found.');
    }
  } else {
    console.log('7. Warning or already done: updateCollectionEntry.');
  }
}

// 8. Patch importLegacy
let importIdx = lines.findIndex(l => l.includes('async importLegacy(payload: Partial<ContentDatabase>)'));
if (importIdx !== -1) {
  let persistIdx = lines.findIndex((l, idx) => idx > importIdx && l.includes('return this.persist(db);'));
  if (persistIdx !== -1 && !lines.slice(persistIdx - 15, persistIdx).some(l => l.includes('db.trees = mergeById'))) {
    lines.splice(persistIdx, 0,
      "    if (Array.isArray(payload.trees) && payload.trees.length > 0) {",
      "      const normalized = payload.trees.map((entry) => normalizeTreeInput(entry as TreeDefinition));",
      "      db.trees = mergeById(db.trees ?? [], normalized);",
      "    }",
      "    if (Array.isArray(payload.biomes) && payload.biomes.length > 0) {",
      "      const normalized = payload.biomes.map((entry) => normalizeBiomeInput(entry as BiomeDefinition));",
      "      db.biomes = mergeById(db.biomes ?? [], normalized);",
      "    }"
    );
    console.log('8. importLegacy patched.');
  } else {
    console.log('8. Warning or already done: importLegacy.');
  }
}

// Write the lines back using original line ending
fs.writeFileSync(filePath, lines.join(eol), 'utf8');
console.log('Patched file written successfully.');
