import React, { useState } from 'react';
import { MineDefinition } from '../../types/mining';

interface MineEditorProps {
  onSave?: (mines: MineDefinition[]) => void;
}

type VisualTheme = 'standard' | 'ice' | 'volcanic' | 'crystal' | 'dark';

export function MineEditor({ onSave }: MineEditorProps) {
  const [mines, setMines] = useState<MineDefinition[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MineDefinition>>({});
  const [newFormOpen, setNewFormOpen] = useState(false);

  const handleEdit = (mine: MineDefinition) => {
    setEditingId(mine.id);
    setEditForm({ ...mine });
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.id && editForm.name) {
      setMines(mines.map(m => m.id === editingId ? { ...m, ...editForm } : m));
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleDelete = (id: string) => {
    if (confirm(`Удалить шахту?`)) {
      setMines(mines.filter(m => m.id !== id));
    }
  };

  const handleNewMine = () => {
    if (editForm.id && editForm.name && editForm.locationId) {
      const newMine: MineDefinition = {
        id: editForm.id,
        name: editForm.name,
        description: editForm.description || '',
        locationId: editForm.locationId,
        requiredProfessionId: editForm.requiredProfessionId || 'mining',
        requiredMiningLevel: editForm.requiredMiningLevel || 1,
        depthCount: editForm.depthCount || 1,
        dangerLevel: editForm.dangerLevel || 1,
        visualTheme: editForm.visualTheme || 'standard',
        isEnabled: editForm.isEnabled ?? true,
      };
      setMines([...mines, newMine]);
      setEditForm({});
      setNewFormOpen(false);
    }
  };

  return (
    <div className="mine-editor">
      <div className="editor-controls">
        <button onClick={() => setNewFormOpen(!newFormOpen)} className="btn-primary">
          {newFormOpen ? 'Отмена' : '⛏️ Добавить шахту'}
        </button>
      </div>

      {newFormOpen && (
        <div className="editor-form card">
          <h3>Новая шахта</h3>
          <input
            type="text"
            placeholder="ID шахты (mine_...)"
            value={editForm.id || ''}
            onChange={(e) => setEditForm({ ...editForm, id: e.target.value })}
          />
          <input
            type="text"
            placeholder="Название"
            value={editForm.name || ''}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <textarea
            placeholder="Описание"
            value={editForm.description || ''}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          />
          <input
            type="text"
            placeholder="ID локации"
            value={editForm.locationId || ''}
            onChange={(e) => setEditForm({ ...editForm, locationId: e.target.value })}
          />
          <input
            type="number"
            placeholder="Требуемый уровень майнинга"
            value={editForm.requiredMiningLevel || 1}
            onChange={(e) => setEditForm({ ...editForm, requiredMiningLevel: parseInt(e.target.value) })}
          />
          <input
            type="number"
            placeholder="Количество уровней глубины"
            value={editForm.depthCount || 1}
            onChange={(e) => setEditForm({ ...editForm, depthCount: parseInt(e.target.value) })}
          />
          <input
            type="number"
            placeholder="Уровень опасности (1-10)"
            value={editForm.dangerLevel || 1}
            onChange={(e) => setEditForm({ ...editForm, dangerLevel: parseInt(e.target.value) })}
          />
          <select
            value={editForm.visualTheme || 'standard'}
            onChange={(e) => setEditForm({ ...editForm, visualTheme: e.target.value as VisualTheme })}
          >
            <option value="standard">Обычная</option>
            <option value="ice">Ледяная</option>
            <option value="volcanic">Вулканическая</option>
            <option value="crystal">Кристальная</option>
            <option value="dark">Тёмная</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={editForm.isEnabled ?? true}
              onChange={(e) => setEditForm({ ...editForm, isEnabled: e.target.checked })}
            />
            Открыта для игроков
          </label>
          <button onClick={handleNewMine} className="btn-primary">Сохранить</button>
        </div>
      )}

      <div className="editor-list">
        {mines.map((mine) => (
          <div key={mine.id} className="editor-item card">
            {editingId === mine.id ? (
              <div className="editor-form">
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
                <textarea
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
                <input
                  type="text"
                  value={editForm.locationId || ''}
                  onChange={(e) => setEditForm({ ...editForm, locationId: e.target.value })}
                />
                <input
                  type="number"
                  value={editForm.requiredMiningLevel || 1}
                  onChange={(e) => setEditForm({ ...editForm, requiredMiningLevel: parseInt(e.target.value) })}
                />
                <input
                  type="number"
                  value={editForm.depthCount || 1}
                  onChange={(e) => setEditForm({ ...editForm, depthCount: parseInt(e.target.value) })}
                />
                <input
                  type="number"
                  value={editForm.dangerLevel || 1}
                  onChange={(e) => setEditForm({ ...editForm, dangerLevel: parseInt(e.target.value) })}
                />
                <select
                  value={editForm.visualTheme || 'standard'}
                  onChange={(e) => setEditForm({ ...editForm, visualTheme: e.target.value as VisualTheme })}
                >
                  <option value="standard">Обычная</option>
                  <option value="ice">Ледяная</option>
                  <option value="volcanic">Вулканическая</option>
                  <option value="crystal">Кристальная</option>
                  <option value="dark">Тёмная</option>
                </select>
                <div className="form-actions">
                  <button onClick={handleSaveEdit} className="btn-primary">Сохранить</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary">Отмена</button>
                </div>
              </div>
            ) : (
              <div className="editor-content">
                <h4>⛏️ {mine.name}</h4>
                <p className="muted">{mine.id}</p>
                <p>{mine.description}</p>
                <div className="meta">
                  <span>Локация: {mine.locationId}</span>
                  <span>Уровень: {mine.requiredMiningLevel}+</span>
                  <span>Глубины: {mine.depthCount}</span>
                  <span>Опасность: {mine.dangerLevel}/10</span>
                  <span>Тема: {mine.visualTheme}</span>
                  <span>{mine.isEnabled ? '✅' : '❌'}</span>
                </div>
                <div className="item-actions">
                  <button onClick={() => handleEdit(mine)} className="btn-secondary">✏️</button>
                  <button onClick={() => handleDelete(mine.id)} className="btn-danger">🗑️</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .mine-editor {
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
