import { useRef, useState, type ChangeEvent } from 'react';
import {
  exportFullContent,
  importFullContent,
  type ContentBackupEnvelope,
  type ContentImportMode,
  type ContentSnapshot,
} from '../../services/content/contentApi';
import { translateAdminErrorMessage } from '../adminUi';

const CONTENT_KEYS = [
  'items',
  'skills',
  'merchants',
  'cities',
  'materials',
  'lootTables',
  'images',
  'dialogues',
  'npcs',
  'quests',
  'questInteractions',
  'questItems',
  'questMarkers',
  'battleMaps',
  'itemSets',
  'runeComplexes',
] as const;

const ROOT_METADATA_KEYS = new Set(['schemaVersion', 'game', 'exportedAt', 'exportedBy', 'appEnv', 'gitCommit', 'contentCounts', 'content']);

type CountMap = Record<string, number>;

interface PendingImport {
  fileName: string;
  fileSize: number;
  backup: ContentBackupEnvelope;
  backupCounts: CountMap;
  currentCounts: CountMap;
  warnings: string[];
  conflicts: string[];
}

function formatDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function createBackupFileName() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    '-',
    formatDatePart(now.getMonth() + 1),
    '-',
    formatDatePart(now.getDate()),
    '_',
    formatDatePart(now.getHours()),
    '-',
    formatDatePart(now.getMinutes()),
  ].join('');
  const source = String(
    import.meta.env.VITE_CONTENT_BACKUP_SOURCE
      ?? import.meta.env.VITE_APP_ENV
      ?? import.meta.env.MODE
      ?? 'local',
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `theend_content_${stamp}${source ? `_${source}` : ''}.json`;
}

function downloadJson(payload: ContentBackupEnvelope) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = createBackupFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getContent(value: Partial<ContentBackupEnvelope> | Partial<ContentSnapshot>): Partial<ContentSnapshot> {
  if ('content' in value && value.content && typeof value.content === 'object' && !Array.isArray(value.content)) {
    return value.content as Partial<ContentSnapshot>;
  }
  return value as Partial<ContentSnapshot>;
}

function countContent(content: Partial<ContentSnapshot>): CountMap {
  const worldMap = content.worldMap && typeof content.worldMap === 'object' ? content.worldMap : undefined;
  return {
    quests: Array.isArray(content.quests) ? content.quests.length : 0,
    dialogues: Array.isArray(content.dialogues) ? content.dialogues.length : 0,
    npcs: Array.isArray(content.npcs) ? content.npcs.length : 0,
    items: Array.isArray(content.items) ? content.items.length : 0,
    skills: Array.isArray(content.skills) ? content.skills.length : 0,
    cities: Array.isArray(content.cities) ? content.cities.length : 0,
    merchants: Array.isArray(content.merchants) ? content.merchants.length : 0,
    lootTables: Array.isArray(content.lootTables) ? content.lootTables.length : 0,
    images: Array.isArray(content.images) ? content.images.length : 0,
    battleMaps: Array.isArray(content.battleMaps) ? content.battleMaps.length : 0,
    itemSets: Array.isArray(content.itemSets) ? content.itemSets.length : 0,
    runeComplexes: Array.isArray(content.runeComplexes) ? content.runeComplexes.length : 0,
    zones: Array.isArray(worldMap?.zones) ? worldMap.zones.length : 0,
    markers: (Array.isArray(content.questMarkers) ? content.questMarkers.length : 0)
      + (Array.isArray(worldMap?.questMarkers) ? worldMap.questMarkers.length : 0),
  };
}

function validateImportPayload(value: unknown): ContentBackupEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Backup JSON must be an object.');
  }

  const raw = value as Partial<ContentBackupEnvelope> & Partial<ContentSnapshot>;
  const content = getContent(raw);

  for (const key of CONTENT_KEYS) {
    if (content[key] !== undefined && !Array.isArray(content[key])) {
      throw new Error(`${key} must be an array.`);
    }
  }

  if (content.worldMap !== undefined && (typeof content.worldMap !== 'object' || Array.isArray(content.worldMap))) {
    throw new Error('worldMap must be an object.');
  }

  const exportedAt = typeof raw.exportedAt === 'string' ? raw.exportedAt : 'Legacy backup';
  const schemaVersion = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1;
  return {
    schemaVersion,
    game: raw.game === 'TheEnd' ? 'TheEnd' : 'TheEnd',
    exportedAt,
    exportedBy: raw.exportedBy === 'admin' ? 'admin' : 'admin',
    appEnv: typeof raw.appEnv === 'string' ? raw.appEnv : undefined,
    gitCommit: typeof raw.gitCommit === 'string' ? raw.gitCommit : undefined,
    contentCounts: raw.contentCounts && typeof raw.contentCounts === 'object'
      ? raw.contentCounts as Record<string, number>
      : countContent(content),
    content: content as ContentSnapshot,
  };
}

function findUnknownCollections(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return [];
  }
  const source = raw as Record<string, unknown>;
  const content = source.content && typeof source.content === 'object' && !Array.isArray(source.content)
    ? source.content as Record<string, unknown>
    : source;
  const allowed = new Set([...CONTENT_KEYS, 'worldMap', 'version']);
  const rootUnknown = Object.keys(source).filter((key) => !ROOT_METADATA_KEYS.has(key) && !allowed.has(key));
  const contentUnknown = Object.keys(content).filter((key) => !allowed.has(key));
  return Array.from(new Set([...rootUnknown, ...contentUnknown]));
}

function collectDuplicateIds(content: Partial<ContentSnapshot>): string[] {
  const messages: string[] = [];
  for (const key of CONTENT_KEYS) {
    const entries = content[key] as Array<{ id?: string }> | undefined;
    if (!Array.isArray(entries)) {
      continue;
    }
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const entry of entries) {
      const id = String(entry?.id ?? '').trim();
      if (!id) {
        continue;
      }
      if (seen.has(id)) {
        duplicates.add(id);
      }
      seen.add(id);
    }
    if (duplicates.size > 0) {
      messages.push(`${key}: duplicate IDs ${Array.from(duplicates).join(', ')}`);
    }
  }
  return messages;
}

function collectChangedSameIds(current: Partial<ContentSnapshot>, incoming: Partial<ContentSnapshot>): string[] {
  const messages: string[] = [];
  for (const key of CONTENT_KEYS) {
    const currentEntries = current[key] as Array<{ id?: string }> | undefined;
    const incomingEntries = incoming[key] as Array<{ id?: string }> | undefined;
    if (!Array.isArray(currentEntries) || !Array.isArray(incomingEntries)) {
      continue;
    }
    const currentById = new Map(currentEntries.map((entry) => [String(entry.id ?? ''), entry]));
    const changed = incomingEntries
      .filter((entry) => {
        const id = String(entry.id ?? '');
        const existing = currentById.get(id);
        return id && existing && JSON.stringify(existing) !== JSON.stringify(entry);
      })
      .map((entry) => String(entry.id));
    if (changed.length > 0) {
      messages.push(`${key}: changed same ID ${changed.slice(0, 8).join(', ')}${changed.length > 8 ? '...' : ''}`);
    }
  }
  return messages;
}

function collectReferenceWarnings(content: Partial<ContentSnapshot>): string[] {
  const messages: string[] = [];
  const itemIds = new Set((content.items ?? []).map((entry) => entry.id));
  const dialogueIds = new Set((content.dialogues ?? []).map((entry) => entry.id));
  const npcIds = new Set((content.npcs ?? []).map((entry) => entry.id));
  const imageIds = new Set((content.images ?? []).map((entry) => entry.id));

  for (const merchant of content.merchants ?? []) {
    for (const item of merchant.items ?? []) {
      if (item.itemId && !itemIds.has(item.itemId)) {
        messages.push(`Merchant ${merchant.id} references missing item ${item.itemId}`);
      }
    }
  }
  for (const quest of content.quests ?? []) {
    if (quest.npcId && !npcIds.has(quest.npcId)) {
      messages.push(`Quest ${quest.id} references missing NPC ${quest.npcId}`);
    }
  }
  for (const dialogue of content.dialogues ?? []) {
    if (dialogue.npcId && !npcIds.has(dialogue.npcId)) {
      messages.push(`Dialogue ${dialogue.id} references missing NPC ${dialogue.npcId}`);
    }
  }
  for (const npc of content.npcs ?? []) {
    for (const binding of npc.dialogues ?? []) {
      const dialogueId = typeof binding === 'string' ? binding : String((binding as { dialogueId?: string })?.dialogueId ?? '');
      if (dialogueId && !dialogueIds.has(dialogueId)) {
        messages.push(`NPC ${npc.id} references missing dialogue ${dialogueId}`);
      }
    }
  }
  for (const item of content.items ?? []) {
    if (item.imagePath && !imageIds.has(item.imagePath) && item.imagePath !== 'unknown') {
      messages.push(`Item ${item.id} references missing image ${item.imagePath}`);
    }
  }

  if ((content.images ?? []).length === 0) {
    messages.push('This backup contains image references only. Make sure the assets folder/zip is also copied.');
  }

  return messages;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function CountList({ counts }: { counts: CountMap }) {
  return (
    <dl className="admin-backup-counts">
      <div><dt>quests</dt><dd>{counts.quests}</dd></div>
      <div><dt>dialogues</dt><dd>{counts.dialogues}</dd></div>
      <div><dt>npcs</dt><dd>{counts.npcs}</dd></div>
      <div><dt>items</dt><dd>{counts.items}</dd></div>
      <div><dt>skills</dt><dd>{counts.skills}</dd></div>
      <div><dt>cities</dt><dd>{counts.cities}</dd></div>
      <div><dt>maps / zones / markers</dt><dd>{counts.battleMaps} / {counts.zones} / {counts.markers}</dd></div>
    </dl>
  );
}

export function BackupPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [lastBackup, setLastBackup] = useState<ContentBackupEnvelope | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [importMode, setImportMode] = useState<ContentImportMode>('dryRun');
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState('Ready.');

  async function exportBackup() {
    setIsBusy(true);
    try {
      const snapshot = await exportFullContent();
      setLastBackup(snapshot);
      downloadJson(snapshot);
      setStatus(`Full content JSON exported with metadata (${formatBytes(JSON.stringify(snapshot).length)}).`);
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    } finally {
      setIsBusy(false);
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setIsBusy(true);
    setStatus('Reading backup and running dry run...');
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text()) as unknown;
      } catch {
        throw new Error('Invalid JSON. Check that the downloaded backup file is complete and not edited incorrectly.');
      }

      const backup = validateImportPayload(parsed);
      const current = await exportFullContent();
      const backupCounts = countContent(backup.content);
      const currentCounts = countContent(current.content);
      const warnings = [
        ...findUnknownCollections(parsed).map((key) => `Unknown collection '${key}' will be ignored by current import code.`),
        ...collectReferenceWarnings(backup.content),
        `Backup file size: ${formatBytes(file.size)}.`,
      ];
      const conflicts = [
        ...collectDuplicateIds(backup.content),
        ...collectChangedSameIds(current.content, backup.content),
      ];
      const dryRun = await importFullContent(backup, 'dryRun');
      setPendingImport({
        fileName: file.name,
        fileSize: file.size,
        backup,
        backupCounts,
        currentCounts,
        warnings: [...warnings, ...dryRun.warnings],
        conflicts,
      });
      setImportMode('dryRun');
      setStatus('Dry run complete. Review preview, then choose Replace all or Merge by ID.');
    } catch (error) {
      setPendingImport(null);
      setStatus(translateAdminErrorMessage((error as Error).message));
    } finally {
      setIsBusy(false);
    }
  }

  async function runImport(mode: ContentImportMode) {
    if (!pendingImport) {
      return;
    }

    if (mode === 'replace' && !window.confirm('Replace all local admin content with this backup? Make sure you exported a local backup first.')) {
      return;
    }

    setIsBusy(true);
    setStatus(mode === 'dryRun' ? 'Validating backup...' : 'Importing backup...');
    try {
      const result = await importFullContent(pendingImport.backup, mode);
      setLastBackup({
        ...pendingImport.backup,
        content: result.snapshot,
        contentCounts: countContent(result.snapshot),
      });
      setStatus(result.dryRun
        ? `Dry run passed with ${result.warnings.length} warning(s).`
        : `Import complete in ${mode} mode with ${result.warnings.length} warning(s).`);
      if (!result.dryRun) {
        setPendingImport(null);
      }
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    } finally {
      setIsBusy(false);
    }
  }

  async function downloadCurrentBackup() {
    setIsBusy(true);
    try {
      const snapshot = lastBackup ?? await exportFullContent();
      setLastBackup(snapshot);
      downloadJson(snapshot);
      setStatus('Backup downloaded.');
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="admin-backup-page">
      <section className="admin-backup-warning">
        <strong>GitHub saves code. This JSON saves game content.</strong>
        <ol>
          <li>Before switching PC: Export backup.</li>
          <li>Upload JSON to Google Drive.</li>
          <li>On another PC: download JSON.</li>
          <li>Import using Replace all.</li>
          <li>Then continue development.</li>
        </ol>
      </section>

      <section className="admin-backup-actions">
        <button type="button" onClick={exportBackup} disabled={isBusy}>Export Full Content JSON</button>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={isBusy}>Choose JSON for Import Preview</button>
        <button type="button" onClick={downloadCurrentBackup} disabled={isBusy}>Download Backup after save/import</button>
        <input ref={inputRef} type="file" accept="application/json,.json" onChange={importBackup} hidden />
      </section>

      {pendingImport && (
        <section className="admin-backup-preview">
          <h2>Import preview</h2>
          <p><strong>Backup file:</strong> {pendingImport.fileName} ({formatBytes(pendingImport.fileSize)})</p>
          <p><strong>exportedAt:</strong> {pendingImport.backup.exportedAt}</p>
          <p><strong>schemaVersion:</strong> {pendingImport.backup.schemaVersion}</p>

          <div className="admin-backup-preview-grid">
            <div>
              <h3>Backup counts</h3>
              <CountList counts={pendingImport.backupCounts} />
            </div>
            <div>
              <h3>Current local content</h3>
              <CountList counts={pendingImport.currentCounts} />
            </div>
          </div>

          <p className="admin-backup-import-warning">
            Import will replace or merge content depending on selected mode. Make a backup before importing.
          </p>

          <label className="admin-backup-mode">
            Import mode
            <select value={importMode} onChange={(event) => setImportMode(event.target.value as ContentImportMode)} disabled={isBusy}>
              <option value="dryRun">Dry run / validate only</option>
              <option value="replace">Replace all content</option>
              <option value="merge">Merge by ID</option>
            </select>
          </label>

          <div className="admin-backup-actions">
            <button type="button" onClick={() => runImport('dryRun')} disabled={isBusy}>Run Dry Run</button>
            <button type="button" onClick={() => runImport(importMode)} disabled={isBusy || importMode === 'dryRun'}>
              Apply Selected Mode
            </button>
          </div>

          {(pendingImport.conflicts.length > 0 || pendingImport.warnings.length > 0) && (
            <div className="admin-backup-report">
              {pendingImport.conflicts.length > 0 && (
                <>
                  <h3>Conflict report</h3>
                  <ul>{pendingImport.conflicts.map((entry) => <li key={entry}>{entry}</li>)}</ul>
                </>
              )}
              {pendingImport.warnings.length > 0 && (
                <>
                  <h3>Warnings</h3>
                  <ul>{Array.from(new Set(pendingImport.warnings)).map((entry) => <li key={entry}>{entry}</li>)}</ul>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <p className="admin-editor-status" aria-live="polite">{isBusy ? 'Working... ' : ''}{status}</p>
    </div>
  );
}
