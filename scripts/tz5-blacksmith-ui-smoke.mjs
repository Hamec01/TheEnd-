/**
 * TZ5 blacksmith + carpenter component UI smoke run.
 * Usage: node scripts/tz5-blacksmith-ui-smoke.mjs
 */
import { chromium } from 'playwright';

const API = 'http://localhost:3000/api';
const FRONTEND = 'http://localhost:5173';
const CHARACTER_ID = 'cd5dfbed-030c-472e-8dfa-2d5f252cdc6d';
const CHARACTER_NAME = 'godgnom';

const TEST_ITEMS = {
  swordHandleOak: 'tz5_smoke_sword_handle_oak',
  spearShaftOak: 'tz5_smoke_spear_shaft_oak',
  shieldCoreRound: 'tz5_smoke_shield_core_round_oak',
  swordHandleGeneric: 'tz5_smoke_sword_handle_generic',
};

const SHIELD_TEMPLATE_ID = 'blacksmith_template_round_shield';

function nowIso() {
  return new Date().toISOString();
}

function makeComponentSnapshot(kind, opts = {}) {
  const {
    sourceTreeId = 'tree_green_whisper',
    sourceTreeName = 'Зелёный Шёпот',
    sourceLost = false,
    sourceLostReason,
    qualityScore = 72,
    traitRetentionPercent = 58,
  } = opts;
  return {
    sourceTreeId: sourceLost ? undefined : sourceTreeId,
    sourceTreeName: sourceLost ? undefined : sourceTreeName,
    sourceTreeRarity: sourceLost ? undefined : 'uncommon',
    sourceTreeTier: sourceLost ? undefined : 2,
    sourceWoodItemIds: sourceLost ? ['mat_common_wood'] : ['mat_oak_timber'],
    sourceWoodMaterialIds: sourceLost ? ['mat_common_wood'] : ['mat_oak_timber'],
    templateId: `carpenter_template_${kind}`,
    templateName: `Smoke ${kind}`,
    componentKind: kind,
    craftedByProfession: 'carpenter',
    qualityScore,
    traitRetentionPercent,
    inheritedTraitTags: sourceLost ? [] : ['flexible'],
    inheritedEffects: sourceLost ? [] : [{ id: 'smoke_wood_effect', name: 'Smoke inherited', description: 'must stay in snapshot only' }],
    sourceLost,
    sourceLostReason: sourceLost ? (sourceLostReason ?? 'generic stacked itemId cannot preserve source tree') : undefined,
    createdAtIso: nowIso(),
  };
}

async function apiJson(path, init) {
  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status}: ${text}`);
  return body;
}

const SMOKE_MATERIALS = {
  ironIngot: 'tz5_smoke_iron_ingot',
  oakTimber: 'tz5_smoke_oak_timber',
  leather: 'tz5_smoke_tanned_leather',
};

async function ensureContentSetup() {
  // Keep blacksmithItemTemplates empty so frontend uses stable fallback sword/spear/chestplate set.
  await apiJson(`/content/blacksmithItemTemplates/${SHIELD_TEMPLATE_ID}`, { method: 'DELETE' }).catch(() => undefined);
  const smokeMaterialDefs = [
    {
      id: SMOKE_MATERIALS.ironIngot,
      name: 'TZ5 Smoke Iron Ingot',
      category: 'metal',
      rarity: 'common',
      properties: ['ingot'],
      craftingProperties: { roles: ['main_metal', 'ingot'], blacksmith: { canBeMainMaterial: true } },
      isEnabled: true,
      gameplayDescription: 'Smoke iron ingot',
      loreDescription: '',
    },
    {
      id: SMOKE_MATERIALS.oakTimber,
      name: 'TZ5 Smoke Oak',
      category: 'wood',
      rarity: 'common',
      properties: ['wood'],
      craftingProperties: { roles: ['wood', 'handle'] },
      isEnabled: true,
      gameplayDescription: 'Smoke oak timber',
      loreDescription: '',
    },
    {
      id: SMOKE_MATERIALS.leather,
      name: 'TZ5 Smoke Leather',
      category: 'leather',
      rarity: 'common',
      properties: ['leather'],
      craftingProperties: { roles: ['leather'] },
      isEnabled: true,
      gameplayDescription: 'Smoke leather',
      loreDescription: '',
    },
  ];

  for (const material of smokeMaterialDefs) {
    try {
      await apiJson(`/content/materials/${material.id}`, { method: 'GET' });
    } catch {
      await apiJson('/content/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(material),
      });
    }
  }

  const snap = await apiJson('/content/snapshot');
  const snapItemIds = new Set((snap.items ?? []).map((entry) => entry.id));
  const itemDefs = [
    [TEST_ITEMS.swordHandleOak, 'TZ5 Smoke Sword Handle'],
    [TEST_ITEMS.spearShaftOak, 'TZ5 Smoke Spear Shaft'],
    [TEST_ITEMS.shieldCoreRound, 'TZ5 Smoke Shield Core'],
    [TEST_ITEMS.swordHandleGeneric, 'TZ5 Smoke Generic Handle'],
  ];

  let itemsMutated = false;
  for (const [id, name] of itemDefs) {
    if (snapItemIds.has(id)) {
      continue;
    }
    await apiJson('/content/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name,
        type: 'item',
        subtype: 'carpenter_component',
        rarity: 'common',
        price: 1,
        stackable: false,
        isEnabled: true,
        tags: ['carpenter_component', 'runtime_instance'],
      }),
    });
    itemsMutated = true;
  }
  // POSTed items are visible in /content/snapshot immediately; reload-local is optional.

  for (const itemId of Object.values(TEST_ITEMS)) {
    await apiJson(`/characters/${CHARACTER_ID}/inventory/dev`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, quantityDelta: 3 }),
    }).catch(() => undefined);
  }
}

async function seedPlayerMaterials(page) {
  await page.evaluate(({ characterId, materialQty }) => {
    const prefix = `theend.character.${characterId}.player.`;
    const idsKey = `${prefix}materialIds`;
    const qtyKey = `${prefix}materials`;
    const ids = new Set(JSON.parse(window.localStorage.getItem(idsKey) ?? '[]'));
    const qty = JSON.parse(window.localStorage.getItem(qtyKey) ?? '{}');
    for (const [materialId, amount] of Object.entries(materialQty)) {
      ids.add(materialId);
      qty[materialId] = Math.max(Number(qty[materialId] ?? 0), Number(amount));
    }
    window.localStorage.setItem(idsKey, JSON.stringify(Array.from(ids)));
    window.localStorage.setItem(qtyKey, JSON.stringify(qty));
  }, {
    characterId: CHARACTER_ID,
    materialQty: {
      [SMOKE_MATERIALS.ironIngot]: 30,
      [SMOKE_MATERIALS.oakTimber]: 20,
      [SMOKE_MATERIALS.leather]: 20,
    },
  });
}

async function runGodmode(page, command) {
  await page.keyboard.press('`');
  await page.locator('.godmode-console__form input').waitFor({ timeout: 5000 });
  await page.locator('.godmode-console__form input').fill(command);
  await page.locator('.godmode-console__form button[type="submit"]').click();
  await page.waitForTimeout(800);
  await page.keyboard.press('`');
}

async function seedItemInstances(page) {
  const instances = [
    {
      id: `inst_${TEST_ITEMS.swordHandleOak}`,
      itemId: TEST_ITEMS.swordHandleOak,
      carpenterComponent: makeComponentSnapshot('sword_handle'),
    },
    {
      id: `inst_${TEST_ITEMS.spearShaftOak}`,
      itemId: TEST_ITEMS.spearShaftOak,
      carpenterComponent: makeComponentSnapshot('spear_shaft'),
    },
    {
      id: `inst_${TEST_ITEMS.shieldCoreRound}`,
      itemId: TEST_ITEMS.shieldCoreRound,
      carpenterComponent: makeComponentSnapshot('shield_core_round'),
    },
    {
      id: `inst_${TEST_ITEMS.swordHandleGeneric}`,
      itemId: TEST_ITEMS.swordHandleGeneric,
      carpenterComponent: makeComponentSnapshot('sword_handle', { sourceLost: true }),
    },
  ];

  await page.evaluate(({ characterId, instances }) => {
    const key = `theend.character.${characterId}.player.itemInstances`;
    const existingRaw = window.localStorage.getItem(key);
    const existing = existingRaw ? JSON.parse(existingRaw) : [];
    const byItemId = new Map(existing.map((entry) => [entry.itemId, entry]));
    const ts = new Date().toISOString();
    for (const patch of instances) {
      const prev = byItemId.get(patch.itemId);
      byItemId.set(patch.itemId, {
        ...(prev ?? {}),
        ...patch,
        ownerId: characterId,
        craftedByProfession: 'carpenter',
        createdAt: prev?.createdAt ?? ts,
        updatedAt: ts,
      });
    }
    window.localStorage.setItem(key, JSON.stringify(Array.from(byItemId.values())));
  }, { characterId: CHARACTER_ID, instances });
}

async function loginAndPlay(page) {
  await page.goto(FRONTEND, { waitUntil: 'domcontentloaded' });
  const professionsVisible = await page.getByRole('button', { name: 'Профессии' }).isVisible().catch(() => false);
  if (professionsVisible) {
    return;
  }

  const godmodeBtn = page.getByRole('button', { name: 'GODMODE' });
  if (await godmodeBtn.isVisible().catch(() => false)) {
    await godmodeBtn.click();
    await page.waitForTimeout(2000);
  }

  const openList = page.getByRole('button', { name: 'Открыть список персонажей' });
  if (await openList.isVisible().catch(() => false)) {
    await openList.click();
    await page.waitForTimeout(500);
  }

  const playButtons = page.getByRole('button', { name: 'Играть' });
  const count = await playButtons.count();
  for (let index = 0; index < count; index += 1) {
    const card = page.locator('.inner-card.setup-race-note').nth(index);
    const cardText = await card.textContent().catch(() => '');
    if (cardText?.includes(CHARACTER_NAME)) {
      await card.getByRole('button', { name: 'Играть' }).click();
      await page.waitForTimeout(3000);
      return;
    }
  }

  const charCard = page.locator('.inner-card.setup-race-note').filter({ hasText: CHARACTER_NAME });
  await charCard.getByRole('button', { name: 'Играть' }).click();
  await page.waitForTimeout(3000);
}

async function openBlacksmithCustomForge(page) {
  await page.getByRole('button', { name: 'Профессии' }).click();
  await page.getByRole('heading', { name: 'Профессии' }).waitFor();
  await page.locator('.profession-card').filter({ hasText: 'Кузнец' }).first().click();
  await page.getByRole('button', { name: 'Свободная ковка' }).click();
}

async function selectTemplate(page, templateId) {
  const templateSelect = page.locator('.blacksmith-custom-field').first().locator('select');
  const options = await templateSelect.locator('option').evaluateAll((nodes) => nodes.map((node) => ({
    value: node.value,
    text: (node.textContent ?? '').trim(),
  })));
  const match = options.find((entry) => entry.value === templateId || entry.text.includes(templateId));
  if (!match?.value) throw new Error(`Template not found: ${templateId}. Options: ${options.map((entry) => entry.text).join(' | ')}`);
  await templateSelect.selectOption(match.value);
}

async function fillSwordMaterials(page) {
  const slotCards = page.locator('.blacksmith-custom-slot-card');
  const count = await slotCards.count();
  const picks = [
    { slotIndex: 0, materialIncludes: SMOKE_MATERIALS.ironIngot, qty: '3' },
    { slotIndex: 1, materialIncludes: SMOKE_MATERIALS.oakTimber, qty: '1' },
    { slotIndex: 2, materialIncludes: SMOKE_MATERIALS.leather, qty: '1' },
  ];
  for (const pick of picks) {
    if (pick.slotIndex >= count) continue;
    const card = slotCards.nth(pick.slotIndex);
    const select = card.locator('select').first();
    const optionValues = await select.locator('option').evaluateAll((nodes, needle) => (
      nodes.map((node) => ({ value: node.value, text: node.textContent ?? '' }))
        .filter((entry) => entry.value && (entry.value.includes(needle) || entry.text.toLowerCase().includes('iron') || entry.text.toLowerCase().includes('oak') || entry.text.toLowerCase().includes('leather')))
    ), pick.materialIncludes);

    let chosen = optionValues.find((entry) => entry.value.includes(pick.materialIncludes));
    if (!chosen && pick.slotIndex === 0) chosen = optionValues.find((entry) => /iron|желез/i.test(entry.text));
    if (!chosen && pick.slotIndex === 1) chosen = optionValues.find((entry) => /oak|древ/i.test(entry.text));
    if (!chosen && pick.slotIndex === 2) chosen = optionValues.find((entry) => /leather|кож/i.test(entry.text));
    if (!chosen) throw new Error(`No material for slot ${pick.slotIndex}: ${JSON.stringify(optionValues)}`);
    await select.selectOption(chosen.value);
    await card.locator('input[type="number"]').fill(pick.qty);
  }
}

async function fillShieldMaterials(page) {
  const slotCards = page.locator('.blacksmith-custom-slot-card');
  const picks = [
    { slotIndex: 0, materialIncludes: SMOKE_MATERIALS.ironIngot, qty: '3' },
    { slotIndex: 1, materialIncludes: SMOKE_MATERIALS.oakTimber, qty: '1' },
    { slotIndex: 2, materialIncludes: SMOKE_MATERIALS.leather, qty: '1' },
  ];
  for (const pick of picks) {
    const card = slotCards.nth(pick.slotIndex);
    const select = card.locator('select').first();
    const optionValues = await select.locator('option').evaluateAll((nodes, needle) => (
      nodes.map((node) => ({ value: node.value, text: node.textContent ?? '' }))
        .filter((entry) => entry.value && entry.value.includes(needle))
    ), pick.materialIncludes);
    const chosen = optionValues[0];
    if (!chosen) throw new Error(`Shield material missing for slot ${pick.slotIndex}`);
    await select.selectOption(chosen.value);
    await card.locator('input[type="number"]').fill(pick.qty);
  }
}

async function selectCarpenterComponent(page, itemId) {
  const componentSelect = page.locator('.blacksmith-custom-field').filter({ hasText: 'Компонент плотника' }).locator('select');
  await componentSelect.selectOption(itemId);
}

async function readCarpenterOptions(page) {
  const componentSelect = page.locator('.blacksmith-custom-field').filter({ hasText: 'Компонент плотника' }).locator('select');
  return componentSelect.locator('option').evaluateAll((nodes) => nodes.map((node) => ({
    value: node.value,
    text: (node.textContent ?? '').trim(),
    disabled: node.disabled,
  })));
}

async function prepareCustomForge(page) {
  const btn = page.getByRole('button', { name: /Подготовить свободную ковку|Компонент не подходит|Не хватает материалов|Не заполнен слот/i });
  const label = await btn.textContent();
  if (!/Подготовить свободную ковку/.test(label ?? '')) {
    throw new Error(`Prepare blocked: ${label}`);
  }
  await btn.click();
  await page.getByRole('button', { name: 'Старт сессии' }).waitFor({ timeout: 10000 });
}

async function runForgeMinigame(page) {
  await page.getByRole('button', { name: 'Старт сессии' }).click();
  const sequence = [
    'Подготовка',
    'Поддать жару',
    'Тяжёлый удар',
    'Тяжёлый удар',
    'Тяжёлый удар',
    'Закалка (вода)',
    'Финишная обработка',
  ];
  for (const label of sequence) {
    await page.getByRole('button', { name: label }).click();
    await page.waitForTimeout(120);
  }
  await page.getByRole('button', { name: 'Забрать результат' }).click();
  await page.locator('.profession-reward-modal').waitFor({ timeout: 15000 });
}

async function readRewardModal(page) {
  const modal = page.locator('.profession-reward-modal');
  const previewLines = await modal.locator('.profession-reward-chip-grid span').allTextContents().catch(() => []);
  const properties = await modal.locator('.profession-reward-properties span').allTextContents().catch(() => []);
  const title = await modal.locator('h3').first().textContent();
  return {
    title: (title ?? '').trim(),
    previewMetadata: previewLines.map((s) => s.trim()).filter(Boolean),
    properties: properties.map((s) => s.trim()).filter(Boolean),
  };
}

async function finalizeReward(page) {
  await page.getByRole('button', { name: 'Завершить ковку и забрать предмет' }).click();
  await page.waitForTimeout(2500);
  await page.locator('.profession-reward-modal').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => undefined);
}

async function getInventoryQty(page, itemId) {
  const hub = await apiJson(`/arena/hub/${CHARACTER_ID}`).catch(() => null);
  if (hub?.inventory?.items) {
    const row = hub.inventory.items.find((entry) => entry.itemId === itemId);
    return Math.max(0, Number(row?.quantity ?? 0));
  }
  return page.evaluate(({ characterId, itemId }) => {
    const prefixes = [`theend.character.${characterId}.`];
    for (const prefix of prefixes) {
      for (const key of Object.keys(window.localStorage)) {
        if (!key.startsWith(prefix)) continue;
        try {
          const parsed = JSON.parse(window.localStorage.getItem(key) ?? 'null');
          const items = parsed?.items ?? parsed?.inventory?.items;
          if (!Array.isArray(items)) continue;
          const row = items.find((entry) => entry.itemId === itemId);
          if (row) return Math.max(0, Number(row.quantity ?? 0));
        } catch { /* ignore */ }
      }
    }
    return 0;
  }, { characterId: CHARACTER_ID, itemId });
}

async function readItemInstances(page) {
  return page.evaluate((characterId) => {
    const key = `theend.character.${characterId}.player.itemInstances`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }, CHARACTER_ID);
}

async function readRuntimeItems(page) {
  return page.evaluate(() => {
    const keys = Object.keys(window.localStorage).filter((k) => k.includes('player.items') || k.includes('runtimeItems'));
    const all = [];
    for (const key of keys) {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]');
        if (Array.isArray(parsed)) all.push(...parsed);
      } catch { /* ignore */ }
    }
    return all;
  });
}

async function closeProfessionsIfOpen(page) {
  const closeBtn = page.locator('.profession-modal .battle-window-head button').first();
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }
}

async function resetToCustomForge(page) {
  const professionsOpen = await page.getByRole('heading', { name: 'Профессии' }).isVisible().catch(() => false);
  if (!professionsOpen) {
    await page.getByRole('button', { name: 'Профессии' }).click();
    await page.getByRole('heading', { name: 'Профессии' }).waitFor();
    await page.locator('.profession-card').filter({ hasText: 'Кузнец' }).first().click();
  }
  await seedPlayerMaterials(page);
  await seedItemInstances(page);
  await page.getByRole('button', { name: 'Свободная ковка' }).click();
  await page.locator('.blacksmith-custom-layout').waitFor({ timeout: 15000 });
}

function summarizeInstancePayload(instances, forgedItemId) {
  const inst = instances.find((entry) => entry.itemId === forgedItemId);
  if (!inst) return null;
  return {
    itemId: inst.itemId,
    carpenterComponentsUsed: inst.carpenterComponentsUsed ?? null,
    equipmentEffects: inst.itemSnapshot?.equipmentEffects ?? inst.equipmentEffects ?? null,
    bonuses: inst.itemSnapshot?.bonuses ?? inst.bonuses ?? null,
    tags: inst.itemSnapshot?.tags ?? inst.tags ?? null,
    gameplayDescription: inst.itemSnapshot?.gameplayDescription ?? inst.gameplayDescription ?? null,
  };
}

const report = [];

async function recordCase(id, payload) {
  report.push({ id, ...payload });
  console.log('\n===', id, payload.status?.toUpperCase() ?? 'INFO', '===');
  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  await ensureContentSetup();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginAndPlay(page);
    await seedPlayerMaterials(page);
    await seedItemInstances(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await loginAndPlay(page);
    await seedPlayerMaterials(page);
    await seedItemInstances(page);
    await page.getByRole('button', { name: 'Профессии' }).waitFor({ timeout: 30000 });

    // Case 1: old flow without carpenter component
    try {
      await openBlacksmithCustomForge(page);
      await selectTemplate(page, 'blacksmith_template_one_hand_sword');
      await fillSwordMaterials(page);
      const qtyBefore = {
        swordHandle: await getInventoryQty(page, TEST_ITEMS.swordHandleOak),
      };
      await prepareCustomForge(page);
      await runForgeMinigame(page);
      const reward1 = await readRewardModal(page);
      await finalizeReward(page);
      const instancesAfter = await readItemInstances(page);
      const forged = instancesAfter
        .filter((entry) => entry.craftedFromTemplateId === 'blacksmith_template_one_hand_sword')
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
      const qtyAfter = {
        swordHandle: await getInventoryQty(page, TEST_ITEMS.swordHandleOak),
      };
      await recordCase('case1_old_flow_no_component', {
        status: forged && !forged.carpenterComponentsUsed?.length ? 'passed' : 'failed',
        selected: {
          template: 'blacksmith_template_one_hand_sword',
          carpenterComponent: null,
          materials: `${SMOKE_MATERIALS.ironIngot} x3, ${SMOKE_MATERIALS.oakTimber} x1, ${SMOKE_MATERIALS.leather} x1`,
        },
        createdItem: forged ? { id: forged.itemId, name: forged.itemSnapshot?.name ?? forged.customName } : null,
        consumed: {
          swordHandleDelta: qtyAfter.swordHandle - qtyBefore.swordHandle,
        },
        rewardPreview: reward1,
        payloadAfterForge: summarizeInstancePayload(instancesAfter, forged?.itemId),
        checks: {
          noCarpenterComponentsUsed: !forged?.carpenterComponentsUsed?.length,
          noInheritedInEquipmentEffects: !(JSON.stringify(forged?.itemSnapshot?.equipmentEffects ?? []).includes('smoke_wood_effect')),
        },
      });
    } catch (error) {
      await recordCase('case1_old_flow_no_component', { status: 'failed', error: error.message });
    }

    // Case 2: sword + sword_handle
    try {
      await resetToCustomForge(page);
      await selectTemplate(page, 'blacksmith_template_one_hand_sword');
      await fillSwordMaterials(page);
      await selectCarpenterComponent(page, TEST_ITEMS.swordHandleOak);
      const qtyBefore = await getInventoryQty(page, TEST_ITEMS.swordHandleOak);
      await prepareCustomForge(page);
      await runForgeMinigame(page);
      const reward2 = await readRewardModal(page);
      await finalizeReward(page);
      const instancesAfter = await readItemInstances(page);
      const forged = instancesAfter
        .filter((entry) => entry.carpenterComponentsUsed?.length)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
      const qtyAfter = await getInventoryQty(page, TEST_ITEMS.swordHandleOak);
      const used = forged?.carpenterComponentsUsed?.[0];
      await recordCase('case2_sword_plus_sword_handle', {
        status: forged && used?.componentKind === 'sword_handle' && qtyAfter === qtyBefore - 1 ? 'passed' : 'failed',
        selected: {
          template: 'blacksmith_template_one_hand_sword',
          carpenterComponent: TEST_ITEMS.swordHandleOak,
        },
        createdItem: forged ? { id: forged.itemId, name: forged.itemSnapshot?.name } : null,
        consumed: { [TEST_ITEMS.swordHandleOak]: `${qtyBefore} -> ${qtyAfter}` },
        rewardPreview: reward2,
        payloadAfterForge: summarizeInstancePayload(instancesAfter, forged?.itemId),
        carpenterComponentsUsed: used ?? null,
      });
    } catch (error) {
      await recordCase('case2_sword_plus_sword_handle', { status: 'failed', error: error.message });
    }

    // Case 3: sword + spear_shaft rejected
    try {
      await closeProfessionsIfOpen(page);
      await runGodmode(page, `item add ${TEST_ITEMS.spearShaftOak} 1`);
      await resetToCustomForge(page);
      await seedItemInstances(page);
      await selectTemplate(page, 'blacksmith_template_one_hand_sword');
      const options = await readCarpenterOptions(page);
      const spearOption = options.find((entry) => entry.value === TEST_ITEMS.spearShaftOak);
      let prepareBlocked = Boolean(spearOption?.disabled);
      let prepareButtonLabel = null;
      if (spearOption && !spearOption.disabled) {
        await selectCarpenterComponent(page, TEST_ITEMS.spearShaftOak);
        await fillSwordMaterials(page);
        const prepareBtn = page.getByRole('button', { name: /Подготовить свободную ковку|Компонент не подходит/i });
        prepareButtonLabel = await prepareBtn.textContent();
        prepareBlocked = /Компонент не подходит/.test(prepareButtonLabel ?? '');
      }
      await recordCase('case3_sword_plus_spear_shaft_rejected', {
        status: spearOption?.disabled && prepareBlocked ? 'passed' : 'failed',
        selected: { template: 'blacksmith_template_one_hand_sword', attemptedComponent: TEST_ITEMS.spearShaftOak },
        carpenterOptions: options.filter((entry) => entry.value),
        spearShaftOption: spearOption,
        prepareButtonLabel,
        createdItem: null,
        consumed: null,
        payloadAfterForge: null,
      });
    } catch (error) {
      await recordCase('case3_sword_plus_spear_shaft_rejected', { status: 'failed', error: error.message });
    }

    // Case 5: sourceLost propagation (before shield template injection)
    try {
      await resetToCustomForge(page);
      await runGodmode(page, `item add ${TEST_ITEMS.swordHandleGeneric} 1`);
      await seedItemInstances(page);
      await selectTemplate(page, 'blacksmith_template_one_hand_sword');
      await fillSwordMaterials(page);
      await selectCarpenterComponent(page, TEST_ITEMS.swordHandleGeneric);
      const qtyBefore = await getInventoryQty(page, TEST_ITEMS.swordHandleGeneric);
      await prepareCustomForge(page);
      await runForgeMinigame(page);
      await finalizeReward(page);
      const instancesAfter = await readItemInstances(page);
      const forged = instancesAfter
        .filter((entry) => entry.carpenterComponentsUsed?.some((used) => used.sourceLost === true))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
      const used = forged?.carpenterComponentsUsed?.[0];
      const inventedTree = used?.sourceLost && Boolean(used?.sourceTreeId);
      await recordCase('case5_source_lost_propagation', {
        status: used?.sourceLost === true && used?.sourceLostReason && !inventedTree ? 'passed' : 'failed',
        selected: { template: 'blacksmith_template_one_hand_sword', carpenterComponent: TEST_ITEMS.swordHandleGeneric },
        createdItem: forged ? { id: forged.itemId } : null,
        consumed: { [TEST_ITEMS.swordHandleGeneric]: `${qtyBefore} -> ${await getInventoryQty(page, TEST_ITEMS.swordHandleGeneric)}` },
        payloadAfterForge: summarizeInstancePayload(instancesAfter, forged?.itemId),
        sourceLostFields: {
          sourceLost: used?.sourceLost,
          sourceLostReason: used?.sourceLostReason,
          sourceTreeId: used?.sourceTreeId ?? null,
        },
      });
    } catch (error) {
      await recordCase('case5_source_lost_propagation', { status: 'failed', error: error.message });
    }

    // Case 4: shield + shield_core (inject shield template into content for this case only)
    try {
      const shieldTemplate = {
        id: SHIELD_TEMPLATE_ID,
        name: 'Круглый щит (smoke)',
        description: 'Smoke shield template for TZ5.',
        itemType: 'armor',
        subtype: 'shield',
        slot: 'leftHand',
        baseArmorValue: 4,
        requiredRoles: [
          { id: 'main_metal', label: 'Основной металл', role: 'main_metal', required: true, quantity: 3 },
          { id: 'core', label: 'Основа', role: 'wood', required: true, quantity: 1 },
          { id: 'binding', label: 'Обмотка', role: 'leather', required: true, quantity: 1 },
        ],
        optionalRoles: [],
        allowedMainMaterialRoles: ['main_metal', 'ingot'],
        allowedMaterialTiers: ['common', 'uncommon', 'rare', 'epic'],
        baseMaxAugmentSlots: 2,
        canAddAugmentSlots: true,
        canHaveRuneComplex: true,
        requiredBlacksmithLevel: 1,
        requiredSkillIds: [],
        tags: ['blacksmith_template', 'armor', 'shield'],
        isEnabled: true,
      };
      try {
        await apiJson('/content/blacksmithItemTemplates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shieldTemplate),
        });
      } catch (error) {
        if (!/409|already exists|duplicate/i.test(String(error.message))) {
          throw error;
        }
      }
      const snapBeforeReload = await apiJson('/content/snapshot');
      const snapTemplateIds = (snapBeforeReload.blacksmithItemTemplates ?? []).map((entry) => entry.id);
      await closeProfessionsIfOpen(page);
      await page.goto(`${FRONTEND}?tz5shield=${Date.now()}`, { waitUntil: 'networkidle' });
      await loginAndPlay(page);
      await seedPlayerMaterials(page);
      await seedItemInstances(page);
      const snapInBrowser = await page.evaluate(async () => {
        const res = await fetch('http://localhost:3000/api/content/snapshot');
        const snap = await res.json();
        return (snap.blacksmithItemTemplates ?? []).map((entry) => entry.id);
      });
      if (!snapInBrowser.includes(SHIELD_TEMPLATE_ID)) {
        throw new Error(`Shield template missing in browser snapshot. server=${snapTemplateIds.join(',')} browser=${snapInBrowser.join(',')}`);
      }
      await openBlacksmithCustomForge(page);
      await selectTemplate(page, SHIELD_TEMPLATE_ID);
      await fillShieldMaterials(page);
      await selectCarpenterComponent(page, TEST_ITEMS.shieldCoreRound);
      const qtyBefore = await getInventoryQty(page, TEST_ITEMS.shieldCoreRound);
      await prepareCustomForge(page);
      await runForgeMinigame(page);
      const reward4 = await readRewardModal(page);
      await finalizeReward(page);
      const instancesAfter = await readItemInstances(page);
      const forged = instancesAfter
        .filter((entry) => entry.craftedFromTemplateId === SHIELD_TEMPLATE_ID)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
      const qtyAfter = await getInventoryQty(page, TEST_ITEMS.shieldCoreRound);
      await recordCase('case4_shield_plus_shield_core', {
        status: forged?.carpenterComponentsUsed?.[0]?.componentKind === 'shield_core_round' && qtyAfter === qtyBefore - 1 ? 'passed' : 'failed',
        selected: { template: SHIELD_TEMPLATE_ID, carpenterComponent: TEST_ITEMS.shieldCoreRound },
        createdItem: forged ? { id: forged.itemId } : null,
        consumed: { [TEST_ITEMS.shieldCoreRound]: `${qtyBefore} -> ${qtyAfter}` },
        rewardPreview: reward4,
        payloadAfterForge: summarizeInstancePayload(instancesAfter, forged?.itemId),
      });
      await apiJson(`/content/blacksmithItemTemplates/${SHIELD_TEMPLATE_ID}`, { method: 'DELETE' }).catch(() => undefined);
    } catch (error) {
      await recordCase('case4_shield_plus_shield_core', { status: 'failed', error: error.message });
      await apiJson(`/content/blacksmithItemTemplates/${SHIELD_TEMPLATE_ID}`, { method: 'DELETE' }).catch(() => undefined);
    }

    // Case 6: reload persistence (use latest forged item with carpenterComponentsUsed)
    try {
      const beforeReload = await readItemInstances(page);
      const target = beforeReload
        .filter((entry) => Array.isArray(entry.carpenterComponentsUsed) && entry.carpenterComponentsUsed.length > 0)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await loginAndPlay(page);
      const afterReload = await readItemInstances(page);
      const persisted = afterReload.find((entry) => entry.itemId === target?.itemId);
      await recordCase('case6_reload_persistence', {
        status: persisted?.carpenterComponentsUsed?.length ? 'passed' : 'failed',
        selected: { forgedItemId: target?.itemId },
        createdItem: target ? { id: target.itemId } : null,
        consumed: null,
        payloadAfterReload: summarizeInstancePayload(afterReload, target?.itemId),
      });
    } catch (error) {
      await recordCase('case6_reload_persistence', { status: 'failed', error: error.message });
    }

    // Extra checks aggregate
    const allInstances = await readItemInstances(page);
    const forgedWithCarpenter = allInstances.filter((entry) => entry.carpenterComponentsUsed?.length);
    const inheritedLeaked = forgedWithCarpenter.some((entry) => {
      const effects = JSON.stringify(entry.itemSnapshot?.equipmentEffects ?? []);
      const bonuses = JSON.stringify(entry.itemSnapshot?.bonuses ?? {});
      return effects.includes('smoke_wood_effect') || bonuses.includes('smoke_wood_effect');
    });
    await recordCase('extra_checks', {
      status: !inheritedLeaked ? 'passed' : 'failed',
      inheritedEffectsInEquipmentEffects: inheritedLeaked,
      forgedWithCarpenterCount: forgedWithCarpenter.length,
      oldFlowIntact: report.find((entry) => entry.id === 'case1_old_flow_no_component')?.status === 'passed',
    });

    console.log('\n\n===== TZ5 SMOKE SUMMARY =====');
    for (const entry of report) {
      console.log(`${entry.id}: ${entry.status}${entry.error ? ` (${entry.error})` : ''}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Smoke run crashed:', error);
  process.exit(1);
});
