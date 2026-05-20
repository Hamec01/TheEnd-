import React, { useState } from 'react';
import { MineBlockTable, BlockType } from '../../types/mining';

type BlockType_t = BlockType;

const BLOCK_TYPES: BlockType_t[] = ['empty', 'stone', 'ore', 'rich_ore', 'gold', 'gem', 'crystal', 'hazard', 'passage', 'exit', 'event'];
const BLOCK_ICONS: Record<BlockType_t, string> = {
  'empty': '⬜',
  'stone': '🪨',
  'ore': '⛏️',
  'rich_ore': '💎',
  'gold': '🟨',
  'gem': '💠',
  'crystal': '🔷',
  'hazard': '⚠️',
  'passage': '🚪',
  'exit': '🚪',
  'event': '⭐',
};

interface MineBlockTableEditorProps {
  mines?: Array<{ id: string; name: string }>;
  onSave?: (tables: MineBlockTable[]) => void;
}

export function MineBlockTableEditor({ mines = [], onSave }: MineBlockTableEditorProps) {
  const [tables, setTables] = useState<MineBlockTable[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MineBlockTable>>({});
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [filterMine, setFilterMine] = useState<string>('');

  const filteredTables = filterMine ? tables.filter(t => t.mineId === filterMine) : tables;

  const handleEdit = (table: MineBlockTable) => {
    setEditingId(table.id);
    setEditForm({ ...table });
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.id && editForm.mineId && editForm.entries) {
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
    if (editForm.id && editForm.mineId) {
      const newTable: MineBlockTable = {
        id: editForm.id,
        mineId: editForm.mineId,
        depthLevel: editForm.depthLevel || 1,
        entries: editForm.entries || [
          { blockType: 'empty', weight: 40 },
          { blockType: 'stone', weight: 30 },
          { blockType: 'ore', weight: 20 },
          { blockType: 'hazard', weight: 10 },
        ],
      };
      setTables([...tables, newTable]);
      setEditForm({});
      setNewFormOpen(false);
    }
  };

  return (
    <div className="block-table-editor">
      <div className="editor-controls">
        <button onClick={() => setNewFormOpen(!newFormOpen)} className="btn-primary">
          {newFormOpen ? 'Отмена' : '🧱 Добавить таблицу блоков'}
        </button>
        
        <select value={filterMine} onChange={(e) => setFilterMine(e.target.value)} className="filter-select">
          <option value="">Все шахты</option>
          {mines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {newFormOpen && (
        <div className="editor-form card">
          <h3>Новая таблица блоков</h3>
          <input
            type="text"
            placeholder="ID"
            value={editForm.id || ''}
            onChange={(e) => setEditForm({ ...editForm, id: e.target.value })}
          />
          <select
            value={editForm.mineId || ''}
            onChange={(e) => setEditForm({ ...editForm, mineId: e.target.value })}
          >
            <option value="">Выберите шахту</option>
            {mines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input
            type="number"
            placeholder="Уровень глубины"
            value={editForm.depthLevel || 1}
            onChange={(e) => setEditForm({ ...editForm, depthLevel: parseInt(e.target.value) })}
          />
          <p style={{ marginBottom: '0.5rem' }}>Стандартные веса блоков:</p>
          <div className="block-weights">
            {BLOCK_TYPES.map(blockType => (
              <label key={blockType} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {BLOCK_ICONS[blockType]} {blockType}
              </label>
            ))}
          </div>
          <button onClick={handleNewTable} className="btn-primary">Сохранить</button>
        </div>
      )}

      <div className="editor-list">
        {filteredTables.map((table) => (
          <div key={table.id} className="editor-item card">
            {editingId === table.id ? (
              <div className="editor-form">
                <h4>Редактирование таблицы</h4>
                <div className="block-table-preview">
                  {table.entries?.map((entry, idx) => (
                    <div key={idx} className="block-entry" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span>{BLOCK_ICONS[entry.blockType]}</span>
                      <span>{entry.blockType}</span>
                      <input
                        type="number"
                        value={entry.weight}
                        onChange={(e) => {
                          const newEntries = [...(editForm.entries || [])];
                          newEntries[idx] = { ...entry, weight: parseInt(e.target.value) };
                          setEditForm({ ...editForm, entries: newEntries });
                        }}
                        style={{ width: '80px' }}
                      />
                    </div>
                  ))}
                </div>
                <div className="form-actions">
                  <button onClick={handleSaveEdit} className="btn-primary">Сохранить</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary">Отмена</button>
                </div>
              </div>
            ) : (
              <div className="editor-content">
                <h4>Таблица глубины {table.depthLevel}</h4>
                <p className="muted">{table.id}</p>
                <div className="block-preview" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {table.entries?.map((entry, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem' }}>
                      <span>{BLOCK_ICONS[entry.blockType]}</span>
                      <span>{entry.weight}</span>
                    </div>
                  ))}
                </div>
                <div className="item-actions" style={{ marginTop: '1rem' }}>
                  <button onClick={() => handleEdit(table)} className="btn-secondary">✏️</button>
                  <button onClick={() => handleDelete(table.id)} className="btn-danger">🗑️</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .block-table-editor {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .editor-controls {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .filter-select {
          padding: 0.5rem;
          border: 1px solid #ccc;
          border-radius: 4px;
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
        .block-weights {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin: 1rem 0;
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
        .block-preview {
          padding: 0.5rem;
          background: #f0f0f0;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        .item-actions {
          display: flex;
          gap: 0.5rem;
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
