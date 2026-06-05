import type { ProfessionDefinition } from '../../types/profession';
import type { ProfessionBranch, ProfessionSkill } from '../../types/profession';
import {
  getMiningContentSnapshot,
  loadMineBlockTablesFromStorage,
  loadMineDepthsFromStorage,
  loadMineHazardTablesFromStorage,
  loadMineHazardsFromStorage,
  loadMineLootTablesFromStorage,
  loadMinesFromStorage,
  loadMiningToolsFromStorage,
  saveMineBlockTablesToStorage,
  saveMineDepthsToStorage,
  saveMineHazardTablesToStorage,
  saveMineHazardsToStorage,
  saveMineLootTablesToStorage,
  saveMinesToStorage,
  saveMiningToolsToStorage,
} from '../../services/miningRepository';
import { loadProfessionBranchesFromStorage, saveProfessionBranchesToStorage } from '../../services/professionBranchRepository';
import { loadProfessionSkillsFromStorage, saveProfessionSkillsToStorage } from '../../services/professionSkillRepository';
import {
  createContentEntry,
  deleteContentEntry,
  getContentCollection,
  updateContentEntry,
  type ContentCollectionName,
} from '../../services/content/contentApi';
import type {
  BlacksmithBalance,
  BlacksmithForgeTier,
  BlacksmithModule,
  BlacksmithQualityTier,
  BlacksmithTool,
  BlacksmithVisualPreset,
} from '../../services/content/models';

export type ProfessionImportMode = 'merge' | 'replace';
export type ProfessionBundleKind = 'mining' | 'blacksmithing';

interface ProfessionTransferBundleBase {
  schemaVersion: 1;
  exportedAt: string;
  professionId: string;
  professionName: string;
  kind: ProfessionBundleKind;
  profession: ProfessionDefinition;
  skills: ProfessionSkill[];
  branches: ProfessionBranch[];
}

export interface MiningProfessionTransferBundle extends ProfessionTransferBundleBase {
  kind: 'mining';
  mining: ReturnType<typeof getMiningContentSnapshot>;
}

export interface BlacksmithTransferCollections {
  forgeTiers: BlacksmithForgeTier[];
  modules: BlacksmithModule[];
  tools: BlacksmithTool[];
  qualityTiers: BlacksmithQualityTier[];
  visualPresets: BlacksmithVisualPreset[];
  balance: BlacksmithBalance[];
}

export interface BlacksmithProfessionTransferBundle extends ProfessionTransferBundleBase {
  kind: 'blacksmithing';
  blacksmith: BlacksmithTransferCollections;
}

export type ProfessionTransferBundle = MiningProfessionTransferBundle | BlacksmithProfessionTransferBundle;

export interface ProfessionImportSummary {
  professionId: string;
  mode: ProfessionImportMode;
  updatedSections: string[];
}

const BLACKSMITH_COLLECTIONS: Array<{
  key: keyof BlacksmithTransferCollections;
  collection: ContentCollectionName;
}> = [
  { key: 'forgeTiers', collection: 'blacksmithForgeTiers' },
  { key: 'modules', collection: 'blacksmithModules' },
  { key: 'tools', collection: 'blacksmithTools' },
  { key: 'qualityTiers', collection: 'blacksmithQualityTiers' },
  { key: 'visualPresets', collection: 'blacksmithVisualPresets' },
  { key: 'balance', collection: 'blacksmithBalance' },
];

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const nextById = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of incoming) {
    nextById.set(entry.id, entry);
  }
  return Array.from(nextById.values());
}

function replaceByProfessionId<T extends { professionId: string }>(current: T[], incoming: T[], professionId: string): T[] {
  const preserved = current.filter((entry) => entry.professionId !== professionId);
  return [...preserved, ...incoming];
}

function mergeByProfessionAndId<T extends { id: string; professionId: string }>(current: T[], incoming: T[], professionId: string): T[] {
  const preserved = current.filter((entry) => entry.professionId !== professionId);
  const scopedCurrent = current.filter((entry) => entry.professionId === professionId);
  return [...preserved, ...mergeById(scopedCurrent, incoming)];
}

async function loadBlacksmithTransferCollections(): Promise<BlacksmithTransferCollections> {
  const results = await Promise.all(BLACKSMITH_COLLECTIONS.map(({ collection }) => getContentCollection(collection)));
  return {
    forgeTiers: results[0] as BlacksmithForgeTier[],
    modules: results[1] as BlacksmithModule[],
    tools: results[2] as BlacksmithTool[],
    qualityTiers: results[3] as BlacksmithQualityTier[],
    visualPresets: results[4] as BlacksmithVisualPreset[],
    balance: results[5] as BlacksmithBalance[],
  };
}

async function saveBlacksmithCollection<T extends { id: string }>(
  collection: ContentCollectionName,
  incoming: T[],
  mode: ProfessionImportMode,
): Promise<void> {
  const current = await getContentCollection<T>(collection);
  const currentById = new Map(current.map((entry) => [entry.id, entry]));
  const incomingById = new Map(incoming.map((entry) => [entry.id, entry]));

  if (mode === 'replace') {
    for (const entry of current) {
      if (!incomingById.has(entry.id)) {
        await deleteContentEntry(collection, entry.id);
      }
    }
  }

  for (const entry of incoming) {
    if (currentById.has(entry.id)) {
      await updateContentEntry(collection, entry.id, entry);
    } else {
      await createContentEntry(collection, entry);
    }
  }
}

export async function exportProfessionBundle(profession: ProfessionDefinition): Promise<ProfessionTransferBundle> {
  const skills = loadProfessionSkillsFromStorage().filter((entry) => entry.professionId === profession.id);
  const branches = loadProfessionBranchesFromStorage().filter((entry) => entry.professionId === profession.id);

  if (profession.id === 'mining') {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      professionId: profession.id,
      professionName: profession.name,
      kind: 'mining',
      profession,
      skills,
      branches,
      mining: getMiningContentSnapshot(),
    };
  }

  if (profession.id === 'blacksmithing') {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      professionId: profession.id,
      professionName: profession.name,
      kind: 'blacksmithing',
      profession,
      skills,
      branches,
      blacksmith: await loadBlacksmithTransferCollections(),
    };
  }

  throw new Error(`Экспорт для профессии ${profession.id} пока не поддерживается.`);
}

export async function importProfessionBundle(
  bundle: ProfessionTransferBundle,
  mode: ProfessionImportMode,
): Promise<ProfessionImportSummary> {
  const professionId = bundle.professionId;
  const currentSkills = loadProfessionSkillsFromStorage();
  const currentBranches = loadProfessionBranchesFromStorage();

  saveProfessionSkillsToStorage(
    mode === 'replace'
      ? replaceByProfessionId(currentSkills, bundle.skills, professionId)
      : mergeByProfessionAndId(currentSkills, bundle.skills, professionId),
  );
  saveProfessionBranchesToStorage(
    mode === 'replace'
      ? replaceByProfessionId(currentBranches, bundle.branches, professionId)
      : mergeByProfessionAndId(currentBranches, bundle.branches, professionId),
  );

  const updatedSections = ['skills', 'branches'];

  if (bundle.kind === 'mining') {
    const mining = bundle.mining;
    saveMinesToStorage(mode === 'replace' ? mining.mines : mergeById(loadMinesFromStorage(), mining.mines));
    saveMineDepthsToStorage(mode === 'replace' ? mining.depths : mergeById(loadMineDepthsFromStorage(), mining.depths));
    saveMineBlockTablesToStorage(mode === 'replace' ? mining.blockTables : mergeById(loadMineBlockTablesFromStorage(), mining.blockTables));
    saveMineHazardsToStorage(mode === 'replace' ? mining.hazards : mergeById(loadMineHazardsFromStorage(), mining.hazards));
    saveMineHazardTablesToStorage(mode === 'replace' ? mining.hazardTables : mergeById(loadMineHazardTablesFromStorage(), mining.hazardTables));
    saveMineLootTablesToStorage(mode === 'replace' ? mining.lootTables : mergeById(loadMineLootTablesFromStorage(), mining.lootTables));
    const miningTools = mining.tools ?? [];
    saveMiningToolsToStorage(mode === 'replace' ? miningTools : mergeById(loadMiningToolsFromStorage(), miningTools));
    updatedSections.push('mines', 'depths', 'blocks', 'hazards', 'hazardTables', 'loot', 'tools');
  }

  if (bundle.kind === 'blacksmithing') {
    await saveBlacksmithCollection('blacksmithForgeTiers', bundle.blacksmith.forgeTiers, mode);
    await saveBlacksmithCollection('blacksmithModules', bundle.blacksmith.modules, mode);
    await saveBlacksmithCollection('blacksmithTools', bundle.blacksmith.tools, mode);
    await saveBlacksmithCollection('blacksmithQualityTiers', bundle.blacksmith.qualityTiers, mode);
    await saveBlacksmithCollection('blacksmithVisualPresets', bundle.blacksmith.visualPresets, mode);
    await saveBlacksmithCollection('blacksmithBalance', bundle.blacksmith.balance, mode);
    updatedSections.push('forgeTiers', 'modules', 'tools', 'quality', 'visual', 'balance');
  }

  return {
    professionId,
    mode,
    updatedSections,
  };
}

export function downloadProfessionBundle(bundle: ProfessionTransferBundle): void {
  const payload = JSON.stringify(bundle, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${bundle.professionId}-profession-bundle.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readProfessionBundleFromFile(file: File): Promise<ProfessionTransferBundle> {
  const raw = await file.text();
  const parsed = JSON.parse(raw) as ProfessionTransferBundle;
  if (!parsed || parsed.schemaVersion !== 1 || !parsed.professionId || !parsed.kind) {
    throw new Error('Файл импорта не похож на пакет профессии The End.');
  }
  return parsed;
}
