import { useRef, useState, type ChangeEvent } from 'react';
import { exportFullContent, importFullContent, type ContentSnapshot } from '../../services/content/contentApi';
import { translateAdminErrorMessage } from '../adminUi';

function downloadJson(payload: ContentSnapshot, prefix = 'theend-content-backup') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${prefix}-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function validateImportPayload(value: unknown): Partial<ContentSnapshot> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Backup JSON must be an object.');
  }

  const payload = value as Partial<ContentSnapshot>;
  const requiredArrays = [
    'cities',
    'items',
    'skills',
    'merchants',
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
  ] as const;

  for (const key of requiredArrays) {
    if (payload[key] !== undefined && !Array.isArray(payload[key])) {
      throw new Error(`${key} must be an array.`);
    }
  }

  if (payload.worldMap !== undefined && (typeof payload.worldMap !== 'object' || Array.isArray(payload.worldMap))) {
    throw new Error('worldMap must be an object.');
  }

  return payload;
}

export function BackupPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [lastBackup, setLastBackup] = useState<ContentSnapshot | null>(null);
  const [status, setStatus] = useState('Ready.');

  async function exportBackup() {
    try {
      const snapshot = await exportFullContent();
      setLastBackup(snapshot);
      downloadJson(snapshot);
      setStatus('Full content JSON exported.');
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const payload = validateImportPayload(parsed);
      if (!window.confirm('Import will replace current admin content in the database. Continue?')) {
        return;
      }
      const snapshot = await importFullContent(payload);
      setLastBackup(snapshot);
      setStatus('Full content JSON imported and saved to database.');
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function downloadCurrentBackup() {
    try {
      const snapshot = lastBackup ?? await exportFullContent();
      setLastBackup(snapshot);
      downloadJson(snapshot);
      setStatus('Backup downloaded.');
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  return (
    <div className="admin-backup-page">
      <section className="admin-backup-warning">
        Admin content is stored in database. Export backups regularly.
      </section>
      <section className="admin-backup-actions">
        <button type="button" onClick={exportBackup}>Export Full Content JSON</button>
        <button type="button" onClick={() => inputRef.current?.click()}>Import Full Content JSON</button>
        <button type="button" onClick={downloadCurrentBackup}>Download Backup after save/import</button>
        <input ref={inputRef} type="file" accept="application/json,.json" onChange={importBackup} hidden />
      </section>
      <p className="admin-editor-status">{status}</p>
    </div>
  );
}
