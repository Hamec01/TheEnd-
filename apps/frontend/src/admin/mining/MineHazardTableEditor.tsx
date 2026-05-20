import React, { useState } from 'react';
import { MineHazardTable } from '../../types/mining';

interface MineHazardTableEditorProps {
  hazards?: Array<{ id: string; name: string }>;
  onSave?: (tables: MineHazardTable[]) => void;
}

export function MineHazardTableEditor({ hazards = [], onSave }: MineHazardTableEditorProps) {
  const [tables, setTables] = useState<MineHazardTable[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MineHazardTable>>({});
  const [newFormOpen, setNewFormOpen] = useState(false);

  const handleEdit = (table: MineHazardTable) => {
    setEditingId(table.id);
    setEditForm({ ...table });
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.id && editForm.name && editForm.entries) {
      setTables(tables.map(t => t.id === editingId ? { ...t, ...editForm } : t));
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить эту таблицу?')) {
      setTables(tables.filter(t => t.id !== id));
    }
  };

  const handleNewTable = () => {
    if (editForm.id && editForm.name) {
      const newTable: MineHazardTable = {
        id: editForm.id,
        name: editForm.name,
        entries: editForm.entries || [],
      };
      setTables([...tables, newTable]);
      setEditForm({});
      setNewFormOpen(false);
    }
  };

  const handleAddEntry = () => {
    const newEntries = [...(editForm.entries || [])];
    newEntries.push({ hazardId: '', weight: 1, minDepth: 1, maxDepth: 10 });
    setEditForm({ ...editForm, entries: newEntries });
  };

  const handleUpdateEntry = (idx: number, field: string, value: unknown) => {
    const newEntries = [...(editForm.entries || [])];
    newEntries[idx] = { ...newEntries[idx], [field]: value };
    setEditForm({ ...editForm, entries: newEntries });
  };

  const handleRemoveEntry = (idx: number) => {
    const newEntries = [...(editForm.entries || [])];
    newEntries.splice(idx, 1);
    setEditForm({ ...editForm, entries: newEntries });
  };

  return (
    <div className="hazard-table-editor">
      <div className="editor-controls">
        <button onClick={() => setNewFormOpen(!newFormOpen)} className="btn-primary">
          {newFormOpen ? 'Отмена' : '⚠️ Добавить таблицу опасностей'}
        </button>
      </div>

      {newFormOpen && (
        <div className="editor-form card">
          <h3>Новая таблица опасностей</h3>
          <input
            type="text"
            placeholder="ID таблицы"
            value={editForm.id || ''}
            onChange={(e) => setEditForm({ ...editForm, id: e.target.value })}
          />
          <input
            type="text"
            placeholder="Название таблицы"
            value={editForm.name || ''}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <button onClick={handleNewTable} className="btn-primary">Сохранить</button>
        </div>
      )}

      <div className="editor-list">
        {tables.map((table) => (
          <div key={table.id} className="editor-item card">
            {editingId === table.id ? (
              <div className="editor-form">
                <h4>Редактирование: {editForm.name}</h4>
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
                
                <div className="entries-section">
                  <h5>Записи</h5>
                  {editForm.entries?.map((entry, idx) => (
                    <div key={idx} className="entry-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <select
                        value={entry.hazardId || ''}
                        onChange={(e) => handleUpdateEntry(idx, 'hazardId', e.target.value)}
                      >
                        <option value="">Выберите опасность</option>
                        {hazards.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                      <input
                        type="number"
                        placeholder="Вес"
                        value={entry.weight || 1}
                        onChange={(e) => handleUpdateEntry(idx, 'weight', parseInt(e.target.value))}
                      />
                      <input
                        type="number"
                        placeholder="Мин глубина"
                        value={entry.minDepth || 1}
                        onChange={(e) => handleUpdateEntry(idx, 'minDepth', parseInt(e.target.value))}
                      />
                      <input
                        type="number"
                        placeholder="Макс глубина"
                        value={entry.maxDepth || 10}
                        onChange={(e) => handleUpdateEntry(idx, 'maxDepth', parseInt(e.target.value))}
                      />
                      <button onClick={() => handleRemoveEntry(idx)} className="btn-danger">❌</button>
                    </div>
                  ))}
                  <button onClick={handleAddEntry} className="btn-secondary">+ Добавить запись</button>
                </div>

                <div className="form-actions">
                  <button onClick={handleSaveEdit} className="btn-primary">Сохранить</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary">Отмена</button>
                </div>
              </div>
            ) : (
              <div className="editor-content">
                <h4>⚠️ {table.name}</h4>
                <p className="muted">{table.id}</p>
                <div className="meta">
                  <span>Записей: {table.entries?.length || 0}</span>
                </div>
                <div className="item-actions">
                  <button onClick={() => handleEdit(table)} className="btn-secondary">✏️</button>
                  <button onClick={() => handleDelete(table.id)} className="btn-danger">🗑️</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .hazard-table-editor {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .editor-controls {
          display: flex;
          gap: 0.5rem;
        }
        .editor-form {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          background: #f5f5f5;
        }
        .editor-form input,
        .editor-form textarea,
        .editor-form select {
          padding: 0.5rem;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .entries-section {
          margin: 1rem 0;
          padding: 1rem;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .entries-section h5 {
          margin: 0 0 0.5rem 0;
        }
        .editor-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .editor-item {
          padding: 1rem;
        }
        .editor-content h4 {
          margin: 0 0 0.5rem 0;
        }
        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-top: 0.5rem;
          font-size: 0.9rem;
          color: #666;
        }
        .item-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }
        .btn-primary, .btn-secondary, .btn-danger {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .btn-primary {
          background: #007bff;
          color: white;
        }
        .btn-secondary {
          background: #6c757d;
          color: white;
        }
        .btn-danger {
          background: #dc3545;
          color: white;
        }
        .form-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }
      `}</style>
    </div>
  );
}
