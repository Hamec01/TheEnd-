import React, { useState } from 'react';
import { MineDepth } from '../../types/mining';

interface MineDepthEditorProps {
  mines?: Array<{ id: string; name: string }>;
  onSave?: (depths: MineDepth[]) => void;
}

export function MineDepthEditor({ mines = [], onSave }: MineDepthEditorProps) {
  const [depths, setDepths] = useState<MineDepth[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MineDepth>>({});
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [filterMine, setFilterMine] = useState<string>('');

  const filteredDepths = filterMine ? depths.filter(d => d.mineId === filterMine) : depths;

  const handleEdit = (depth: MineDepth) => {
    setEditingId(depth.id);
    setEditForm({ ...depth });
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.id && editForm.mineId && editForm.lootTableId && editForm.hazardTableId) {
      setDepths(depths.map(d => d.id === editingId ? { ...d, ...editForm } : d));
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить эту глубину?')) {
      setDepths(depths.filter(d => d.id !== id));
    }
  };

  const handleNewDepth = () => {
    if (editForm.id && editForm.mineId && editForm.lootTableId && editForm.hazardTableId) {
      const newDepth: MineDepth = {
        id: editForm.id,
        mineId: editForm.mineId,
        depthLevel: editForm.depthLevel || 1,
        rows: editForm.rows || 4,
        columns: editForm.columns || 6,
        baseHits: editForm.baseHits || 12,
        staminaCostPerHit: editForm.staminaCostPerHit || 5,
        lootTableId: editForm.lootTableId,
        hazardTableId: editForm.hazardTableId,
        canSpawnExit: editForm.canSpawnExit ?? true,
        canSpawnPassage: editForm.canSpawnPassage ?? true,
        isFinalDepth: editForm.isFinalDepth ?? false,
      };
      setDepths([...depths, newDepth]);
      setEditForm({});
      setNewFormOpen(false);
    }
  };

  return (
    <div className="depth-editor">
      <div className="editor-controls">
        <button onClick={() => setNewFormOpen(!newFormOpen)} className="btn-primary">
          {newFormOpen ? 'Отмена' : '📍 Добавить уровень'}
        </button>
        
        <select value={filterMine} onChange={(e) => setFilterMine(e.target.value)} className="filter-select">
          <option value="">Все шахты</option>
          {mines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {newFormOpen && (
        <div className="editor-form card">
          <h3>Новый уровень глубины</h3>
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
          <input
            type="number"
            placeholder="Строк (rows)"
            value={editForm.rows || 4}
            onChange={(e) => setEditForm({ ...editForm, rows: parseInt(e.target.value) })}
          />
          <input
            type="number"
            placeholder="Столбцов (columns)"
            value={editForm.columns || 6}
            onChange={(e) => setEditForm({ ...editForm, columns: parseInt(e.target.value) })}
          />
          <input
            type="number"
            placeholder="Базовое количество ударов"
            value={editForm.baseHits || 12}
            onChange={(e) => setEditForm({ ...editForm, baseHits: parseInt(e.target.value) })}
          />
          <input
            type="number"
            placeholder="Стамина за удар"
            value={editForm.staminaCostPerHit || 5}
            onChange={(e) => setEditForm({ ...editForm, staminaCostPerHit: parseInt(e.target.value) })}
          />
          <input
            type="text"
            placeholder="ID таблицы добычи (лут-табле)"
            value={editForm.lootTableId || ''}
            onChange={(e) => setEditForm({ ...editForm, lootTableId: e.target.value })}
          />
          <input
            type="text"
            placeholder="ID таблицы опасностей"
            value={editForm.hazardTableId || ''}
            onChange={(e) => setEditForm({ ...editForm, hazardTableId: e.target.value })}
          />
          <label>
            <input
              type="checkbox"
              checked={editForm.canSpawnExit ?? true}
              onChange={(e) => setEditForm({ ...editForm, canSpawnExit: e.target.checked })}
            />
            Может спавниться выход
          </label>
          <label>
            <input
              type="checkbox"
              checked={editForm.canSpawnPassage ?? true}
              onChange={(e) => setEditForm({ ...editForm, canSpawnPassage: e.target.checked })}
            />
            Может спавниться переход
          </label>
          <label>
            <input
              type="checkbox"
              checked={editForm.isFinalDepth ?? false}
              onChange={(e) => setEditForm({ ...editForm, isFinalDepth: e.target.checked })}
            />
            Финальная глубина
          </label>
          <button onClick={handleNewDepth} className="btn-primary">Сохранить</button>
        </div>
      )}

      <div className="editor-list">
        {filteredDepths.map((depth) => (
          <div key={depth.id} className="editor-item card">
            {editingId === depth.id ? (
              <div className="editor-form">
                <input
                  type="number"
                  value={editForm.depthLevel || 1}
                  onChange={(e) => setEditForm({ ...editForm, depthLevel: parseInt(e.target.value) })}
                />
                <input
                  type="number"
                  value={editForm.rows || 4}
                  onChange={(e) => setEditForm({ ...editForm, rows: parseInt(e.target.value) })}
                />
                <input
                  type="number"
                  value={editForm.columns || 6}
                  onChange={(e) => setEditForm({ ...editForm, columns: parseInt(e.target.value) })}
                />
                <input
                  type="number"
                  value={editForm.baseHits || 12}
                  onChange={(e) => setEditForm({ ...editForm, baseHits: parseInt(e.target.value) })}
                />
                <input
                  type="number"
                  value={editForm.staminaCostPerHit || 5}
                  onChange={(e) => setEditForm({ ...editForm, staminaCostPerHit: parseInt(e.target.value) })}
                />
                <div className="form-actions">
                  <button onClick={handleSaveEdit} className="btn-primary">Сохранить</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary">Отмена</button>
                </div>
              </div>
            ) : (
              <div className="editor-content">
                <h4>Уровень {depth.depthLevel}</h4>
                <p className="muted">{depth.id}</p>
                <div className="meta">
                  <span>Сетка: {depth.rows}×{depth.columns}</span>
                  <span>Ударов: {depth.baseHits}</span>
                  <span>Стамина/удар: {depth.staminaCostPerHit}</span>
                  <span>Лут: {depth.lootTableId}</span>
                  <span>Опасности: {depth.hazardTableId}</span>
                  {depth.isFinalDepth && <span>🎯 Финальная</span>}
                </div>
                <div className="item-actions">
                  <button onClick={() => handleEdit(depth)} className="btn-secondary">✏️</button>
                  <button onClick={() => handleDelete(depth.id)} className="btn-danger">🗑️</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .depth-editor {
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
