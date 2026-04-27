const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'data', 'content-db.json');

function hasMojibakeQuestionMarks(value) {
  return typeof value === 'string' && /\?{3,}/.test(value);
}

function findDuplicateIds(entries) {
  const seen = new Set();
  const duplicates = new Set();

  for (const entry of entries || []) {
    const id = String((entry && entry.id) || '').trim();
    if (!id) continue;
    if (seen.has(id)) {
      duplicates.add(id);
      continue;
    }
    seen.add(id);
  }

  return [...duplicates];
}

function validate(db) {
  const errors = [];

  const duplicateItems = findDuplicateIds(db.items);
  if (duplicateItems.length) errors.push(`Duplicate item ids: ${duplicateItems.join(', ')}`);

  const duplicateMerchants = findDuplicateIds(db.merchants);
  if (duplicateMerchants.length) errors.push(`Duplicate merchant ids: ${duplicateMerchants.join(', ')}`);

  const duplicateImages = findDuplicateIds(db.images);
  if (duplicateImages.length) errors.push(`Duplicate image ids: ${duplicateImages.join(', ')}`);

  const itemIds = new Set((db.items || []).map((item) => item.id));
  const imageIds = new Set((db.images || []).map((img) => String((img && img.id) || '').trim()).filter(Boolean));

  for (const item of db.items || []) {
    if (item.imagePath && !imageIds.has(item.imagePath)) {
      errors.push(`Item '${item.id}' references missing image '${item.imagePath}'.`);
    }
    if (
      hasMojibakeQuestionMarks(item.name) ||
      hasMojibakeQuestionMarks(item.subtype) ||
      hasMojibakeQuestionMarks(item.gameplayDescription) ||
      hasMojibakeQuestionMarks(item.loreDescription)
    ) {
      errors.push(`Item '${item.id}' contains suspicious mojibake text ('???').`);
    }
  }

  for (const merchant of db.merchants || []) {
    if (merchant.portraitPath && !imageIds.has(merchant.portraitPath)) {
      errors.push(`Merchant '${merchant.id}' references missing portrait image '${merchant.portraitPath}'.`);
    }

    if (
      hasMojibakeQuestionMarks(merchant.name) ||
      hasMojibakeQuestionMarks(merchant.city) ||
      hasMojibakeQuestionMarks(merchant.location) ||
      hasMojibakeQuestionMarks(merchant.description)
    ) {
      errors.push(`Merchant '${merchant.id}' contains suspicious mojibake text ('???').`);
    }

    for (const entry of merchant.items || []) {
      if (!itemIds.has(entry.itemId)) {
        errors.push(`Merchant '${merchant.id}' references missing item '${entry.itemId}'.`);
      }
    }
  }

  const worldMap = db.worldMap || {};
  for (const zone of worldMap.zones || []) {
    if (hasMojibakeQuestionMarks(zone.name) || hasMojibakeQuestionMarks(zone.description)) {
      errors.push(`World zone '${zone.id}' contains suspicious mojibake text ('???').`);
    }
  }

  for (const region of worldMap.regions || []) {
    if (hasMojibakeQuestionMarks(region.name) || hasMojibakeQuestionMarks(region.description)) {
      errors.push(`World region '${region.id}' contains suspicious mojibake text ('???').`);
    }
  }

  return errors;
}

function main() {
  if (!fs.existsSync(dbPath)) {
    console.error(`[content:validate] Missing file: ${dbPath}`);
    process.exit(1);
  }

  let db;
  try {
    db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (error) {
    console.error('[content:validate] Invalid JSON:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const errors = validate(db);
  if (errors.length > 0) {
    console.error('[content:validate] FAILED');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('[content:validate] OK');
}

main();
