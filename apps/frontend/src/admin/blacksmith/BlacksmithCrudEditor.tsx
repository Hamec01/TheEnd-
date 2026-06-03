import { useEffect, useMemo, useState } from 'react';
import type { ContentCollectionName } from '../../services/content/contentApi';
import { createContentEntry, deleteContentEntry, getContentCollection, updateContentEntry } from '../../services/content/contentApi';

interface NamedEntity {
  id: string;
  name?: string;
}

interface BlacksmithCrudEditorProps<T extends NamedEntity> {
  title: string;
  collection: ContentCollectionName;
  createDraft: () => T;
  renderDraft: (draft: T, setDraft: (next: T) => void) => JSX.Element;
}

export function BlacksmithCrudEditor<T extends NamedEntity>({
  title,
  collection,
  createDraft,
  renderDraft,
}: BlacksmithCrudEditorProps<T>) {
  const [entries, setEntries] = useState<T[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<T>(createDraft());
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    let isDisposed = false;
    setIsLoading(true);
    setStatus('');
    void getContentCollection<T>(collection)
      .then((loaded) => {
        if (isDisposed) {
          return;
        }
        setEntries(loaded);
        const first = loaded[0];
        if (first) {
          setSelectedId(first.id);
          setDraft(first);
        } else {
          setSelectedId('');
          setDraft(createDraft());
        }
      })
      .catch((error) => {
        if (!isDisposed) {
          setStatus(error instanceof Error ? error.message : 'Failed to load collection');
        }
      })
      .finally(() => {
        if (!isDisposed) {
          setIsLoading(false);
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [collection, createDraft]);

  const selectedEntry = useMemo(() => entries.find((entry) => entry.id === selectedId) ?? null, [entries, selectedId]);

  function selectEntry(id: string) {
    const next = entries.find((entry) => entry.id === id);
    if (!next) {
      return;
    }
    setSelectedId(id);
    setDraft(next);
  }

  async function saveDraft() {
    if (!draft.id.trim()) {
      setStatus('ID обязателен.');
      return;
    }
    setIsSaving(true);
    setStatus('');
    try {
      if (selectedEntry) {
        const updated = await updateContentEntry<T>(collection, selectedEntry.id, draft);
        setEntries((prev) => prev.map((entry) => (entry.id === selectedEntry.id ? updated : entry)));
        setSelectedId(updated.id);
        setDraft(updated);
        setStatus('Изменения сохранены.');
      } else {
        const created = await createContentEntry<T>(collection, draft);
        setEntries((prev) => [...prev, created]);
        setSelectedId(created.id);
        setDraft(created);
        setStatus('Запись создана.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSelected() {
    if (!selectedEntry) {
      return;
    }
    setIsSaving(true);
    setStatus('');
    try {
      await deleteContentEntry(collection, selectedEntry.id);
      const nextEntries = entries.filter((entry) => entry.id !== selectedEntry.id);
      setEntries(nextEntries);
      const first = nextEntries[0];
      if (first) {
        setSelectedId(first.id);
        setDraft(first);
      } else {
        setSelectedId('');
        setDraft(createDraft());
      }
      setStatus('Запись удалена.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="blacksmith-editor-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) 1fr', gap: 16 }}>
      <section className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button
            type="button"
            onClick={() => {
              setSelectedId('');
              setDraft(createDraft());
            }}
          >
            + Новая
          </button>
        </div>
        {isLoading ? <p className="muted">Загрузка...</p> : null}
        <div style={{ display: 'grid', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={selectedId === entry.id ? 'is-active' : ''}
              onClick={() => selectEntry(entry.id)}
              style={{
                textAlign: 'left',
                border: '1px solid var(--panel-border)',
                background: selectedId === entry.id ? 'rgba(255, 193, 97, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                color: 'var(--text-main)',
                borderRadius: 8,
                padding: '8px 10px',
              }}
            >
              <strong>{entry.name || entry.id}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{entry.id}</div>
            </button>
          ))}
          {!isLoading && entries.length === 0 ? <p className="muted">Нет записей.</p> : null}
        </div>
      </section>

      <section className="card" style={{ padding: 14 }}>
        <div className="admin-form-grid">
          {renderDraft(draft, setDraft)}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => void saveDraft()} disabled={isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button type="button" onClick={() => void removeSelected()} disabled={isSaving || !selectedEntry}>
            Удалить
          </button>
        </div>
        {status ? <p className="muted" style={{ marginTop: 10 }}>{status}</p> : null}
      </section>
    </div>
  );
}
