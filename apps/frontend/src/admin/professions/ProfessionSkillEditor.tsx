import React, { useState } from 'react';
import { ProfessionSkill } from '../../types/profession';

interface ProfessionSkillEditorProps {
  professions?: Array<{ id: string; name: string }>;
  filterByProfession?: string;
  onSave?: (skills: ProfessionSkill[]) => void;
}

export function ProfessionSkillEditor({ professions = [], filterByProfession, onSave }: ProfessionSkillEditorProps) {
  const [skills, setSkills] = useState<ProfessionSkill[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProfessionSkill>>({});
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [filterProfession, setFilterProfession] = useState<string>(filterByProfession || '');

  const filteredSkills = (filterByProfession || filterProfession) ? skills.filter(s => s.professionId === (filterByProfession || filterProfession)) : skills;

  const handleEdit = (skill: ProfessionSkill) => {
    setEditingId(skill.id);
    setEditForm({ ...skill });
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.id && editForm.name && editForm.professionId) {
      setSkills(skills.map(s => s.id === editingId ? { ...s, ...editForm } : s));
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить этот скил?')) {
      setSkills(skills.filter(s => s.id !== id));
    }
  };

  const handleNewSkill = () => {
    const profId = filterByProfession || editForm.professionId;
    if (editForm.id && editForm.name && profId) {
      const newSkill: ProfessionSkill = {
        id: editForm.id,
        professionId: profId,
        name: editForm.name,
        description: editForm.description || '',
        requiredLevel: editForm.requiredLevel || 1,
        requiredSkillIds: editForm.requiredSkillIds || [],
        branchId: editForm.branchId,
        skillPointCost: editForm.skillPointCost || 1,
        effects: editForm.effects || {},
        icon: editForm.icon,
        positionX: editForm.positionX || 0,
        positionY: editForm.positionY || 0,
        isEnabled: editForm.isEnabled ?? true,
      };
      setSkills([...skills, newSkill]);
      setEditForm({});
      setNewFormOpen(false);
    }
  };

  return (
    <div className="skill-editor">
      <div className="editor-controls">
        <button onClick={() => setNewFormOpen(!newFormOpen)} className="btn-primary">
          {newFormOpen ? 'Отмена' : '+ Добавить скил'}
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
          <h3>Новый скил</h3>
          <input
            type="text"
            placeholder="ID скила"
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
            type="number"
            placeholder="Требуемый уровень"
            value={editForm.requiredLevel || 1}
            onChange={(e) => setEditForm({ ...editForm, requiredLevel: parseInt(e.target.value) })}
          />
          <input
            type="number"
            placeholder="Стоимость очков навыков"
            value={editForm.skillPointCost || 1}
            onChange={(e) => setEditForm({ ...editForm, skillPointCost: parseInt(e.target.value) })}
          />
          <input
            type="text"
            placeholder="ID ветки (опционально)"
            value={editForm.branchId || ''}
            onChange={(e) => setEditForm({ ...editForm, branchId: e.target.value })}
          />
          <input
            type="text"
            placeholder="Иконка"
            value={editForm.icon || ''}
            onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
          />
          <label>
            <input
              type="checkbox"
              checked={editForm.isEnabled ?? true}
              onChange={(e) => setEditForm({ ...editForm, isEnabled: e.target.checked })}
            />
            Включен
          </label>
          <button onClick={handleNewSkill} className="btn-primary">Сохранить</button>
        </div>
      )}

      <div className="editor-list">
        {filteredSkills.map((skill) => (
          <div key={skill.id} className="editor-item card">
            {editingId === skill.id ? (
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
                  type="number"
                  value={editForm.requiredLevel || 1}
                  onChange={(e) => setEditForm({ ...editForm, requiredLevel: parseInt(e.target.value) })}
                />
                <input
                  type="number"
                  value={editForm.skillPointCost || 1}
                  onChange={(e) => setEditForm({ ...editForm, skillPointCost: parseInt(e.target.value) })}
                />
                <div className="form-actions">
                  <button onClick={handleSaveEdit} className="btn-primary">Сохранить</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary">Отмена</button>
                </div>
              </div>
            ) : (
              <div className="editor-content">
                <h4>{skill.icon && `${skill.icon} `}{skill.name}</h4>
                <p className="muted">{skill.id} • {skill.professionId}</p>
                <p>{skill.description}</p>
                <div className="meta">
                  <span>Требуемый уровень: {skill.requiredLevel}</span>
                  <span>Стоимость: {skill.skillPointCost}</span>
                  {skill.branchId && <span>Ветка: {skill.branchId}</span>}
                  <span>{skill.isEnabled ? '✅' : '❌'}</span>
                </div>
                <div className="item-actions">
                  <button onClick={() => handleEdit(skill)} className="btn-secondary">✏️</button>
                  <button onClick={() => handleDelete(skill.id)} className="btn-danger">🗑️</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .skill-editor {
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
