import React, { useState } from 'react';
import { ProfessionBranch } from '../../types/profession';

interface ProfessionBranchEditorProps {
  professions?: Array<{ id: string; name: string }>;
  filterByProfession?: string;
  onSave?: (branches: ProfessionBranch[]) => void;
}

export function ProfessionBranchEditor({ professions = [], filterByProfession, onSave }: ProfessionBranchEditorProps) {
  const [branches, setBranches] = useState<ProfessionBranch[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProfessionBranch>>({});
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [filterProfession, setFilterProfession] = useState<string>(filterByProfession || '');

  const filteredBranches = (filterByProfession || filterProfession) ? branches.filter(b => b.professionId === (filterByProfession || filterProfession)) : branches;

  const handleEdit = (branch: ProfessionBranch) => {
    setEditingId(branch.id);
    setEditForm({ ...branch });
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.id && editForm.name && editForm.professionId) {
      setBranches(branches.map(b => b.id === editingId ? { ...b, ...editForm } : b));
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить эту ветку?')) {
      setBranches(branches.filter(b => b.id !== id));
    }
  };

  const handleNewBranch = () => {
    const profId = filterByProfession || editForm.professionId;
    if (editForm.id && editForm.name && profId) {
      const newBranch: ProfessionBranch = {
        id: editForm.id,
        professionId: profId,
        name: editForm.name,
        description: editForm.description || '',
        exclusiveGroupId: editForm.exclusiveGroupId,
        requiredSkillIds: editForm.requiredSkillIds || [],
        isFinalBranch: editForm.isFinalBranch ?? false,
        isEnabled: editForm.isEnabled ?? true,
      };
      setBranches([...branches, newBranch]);
      setEditForm({});
      setNewFormOpen(false);
    }
  };

  return (
    <div className="branch-editor">
      <div className="editor-controls">
        <button onClick={() => setNewFormOpen(!newFormOpen)} className="btn-primary">
          {newFormOpen ? 'Отмена' : '+ Добавить ветку'}
        </button>
        
        {!filterByProfession && (
          <select value={filterProfession} onChange={(e) => setFilterProfession(e.target.value)} className="filter-select">
            <option value="">Все профессии</option>
            {professions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {newFormOpen && (
        <div className="editor-form card">
          <h3>Новая ветка профессии</h3>
          <input
            type="text"
            placeholder="ID ветки"
            value={editForm.id || ''}
            onChange={(e) => setEditForm({ ...editForm, id: e.target.value })}
          />
          {!filterByProfession ? (
            <select
              value={editForm.professionId || ''}
              onChange={(e) => setEditForm({ ...editForm, professionId: e.target.value })}
            >
              <option value="">Выберите профессию</option>
              {professions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <input
              type="hidden"
              value={filterByProfession}
              onChange={(e) => setEditForm({ ...editForm, professionId: e.target.value })}
            />
          )}
          <input
            type="text"
            placeholder="Название ветки"
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
            placeholder="ID группы исключительности (опционально)"
            value={editForm.exclusiveGroupId || ''}
            onChange={(e) => setEditForm({ ...editForm, exclusiveGroupId: e.target.value })}
          />
          <label>
            <input
              type="checkbox"
              checked={editForm.isFinalBranch ?? false}
              onChange={(e) => setEditForm({ ...editForm, isFinalBranch: e.target.checked })}
            />
            Финальная ветка
          </label>
          <label>
            <input
              type="checkbox"
              checked={editForm.isEnabled ?? true}
              onChange={(e) => setEditForm({ ...editForm, isEnabled: e.target.checked })}
            />
            Включена
          </label>
          <button onClick={handleNewBranch} className="btn-primary">Сохранить</button>
        </div>
      )}

      <div className="editor-list">
        {filteredBranches.map((branch) => (
          <div key={branch.id} className="editor-item card">
            {editingId === branch.id ? (
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
                  value={editForm.exclusiveGroupId || ''}
                  onChange={(e) => setEditForm({ ...editForm, exclusiveGroupId: e.target.value })}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={editForm.isFinalBranch ?? false}
                    onChange={(e) => setEditForm({ ...editForm, isFinalBranch: e.target.checked })}
                  />
                  Финальная ветка
                </label>
                <div className="form-actions">
                  <button onClick={handleSaveEdit} className="btn-primary">Сохранить</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary">Отмена</button>
                </div>
              </div>
            ) : (
              <div className="editor-content">
                <h4>{branch.name}</h4>
                <p className="muted">{branch.id} • {branch.professionId}</p>
                <p>{branch.description}</p>
                <div className="meta">
                  {branch.exclusiveGroupId && <span>Группа: {branch.exclusiveGroupId}</span>}
                  {branch.isFinalBranch && <span>🎯 Финальная</span>}
                  <span>{branch.isEnabled ? '✅' : '❌'}</span>
                </div>
                <div className="item-actions">
                  <button onClick={() => handleEdit(branch)} className="btn-secondary">✏️</button>
                  <button onClick={() => handleDelete(branch.id)} className="btn-danger">🗑️</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .branch-editor {
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
