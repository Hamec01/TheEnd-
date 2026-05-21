import React, { useState, useEffect } from 'react';
import { ProfessionDefinition, ProfessionCategory } from '../../types/profession';

interface ProfessionEditorProps {
  onSave?: (professions: ProfessionDefinition[]) => void;
}

import { translateProfessionCategory } from '../../types/profession';

const PROFESSION_CATEGORIES: ProfessionCategory[] = ['gathering', 'crafting', 'survival', 'alchemy', 'other'];

const DEFAULT_PROFESSIONS: ProfessionDefinition[] = [
  { id: 'mining', name: 'Горняк', description: 'Добыча полезных ископаемых', category: 'gathering', maxLevel: 100, isEnabled: true },
  { id: 'blacksmithing', name: 'Кузнец', description: 'Изготовление оружия и доспехов', category: 'crafting', maxLevel: 100, isEnabled: true },
  { id: 'carpentry', name: 'Плотник', description: 'Работа с деревом', category: 'crafting', maxLevel: 100, isEnabled: true },
  { id: 'leatherworking', name: 'Кожевник', description: 'Изготовление кожаных изделий', category: 'crafting', maxLevel: 100, isEnabled: true },
  { id: 'jewelcrafting', name: 'Ювелир', description: 'Изготовление украшений', category: 'crafting', maxLevel: 100, isEnabled: true },
  { id: 'runecrafting', name: 'Рунорез', description: 'Создание магических рун', category: 'crafting', maxLevel: 100, isEnabled: true },
  { id: 'fishing', name: 'Рыбак', description: 'Ловля рыбы', category: 'gathering', maxLevel: 100, isEnabled: true },
  { id: 'cooking', name: 'Повар', description: 'Приготовление еды', category: 'crafting', maxLevel: 100, isEnabled: true },
  { id: 'hunting', name: 'Охотник', description: 'Охота и отслеживание', category: 'gathering', maxLevel: 100, isEnabled: true },
  { id: 'alchemy', name: 'Алхимик', description: 'Создание зелий и элексиров', category: 'alchemy', maxLevel: 100, isEnabled: true },
  { id: 'herbalism', name: 'Травник', description: 'Сбор трав и растений', category: 'gathering', maxLevel: 100, isEnabled: true },
];

export function ProfessionEditor({ onSave }: ProfessionEditorProps) {
  const [professions, setProfessions] = useState<ProfessionDefinition[]>(DEFAULT_PROFESSIONS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProfessionDefinition>>({});
  const [newFormOpen, setNewFormOpen] = useState(false);

  const handleEdit = (profession: ProfessionDefinition) => {
    setEditingId(profession.id);
    setEditForm({ ...profession });
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.id && editForm.name) {
      setProfessions(professions.map(p => p.id === editingId ? { ...p, ...editForm } : p));
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleDelete = (id: string) => {
    if (confirm(`Удалить профессию "${professions.find(p => p.id === id)?.name}"?`)) {
      setProfessions(professions.filter(p => p.id !== id));
    }
  };

  const handleNewProfession = () => {
    if (editForm.id && editForm.name) {
      const newProfession: ProfessionDefinition = {
        id: editForm.id,
        name: editForm.name,
        description: editForm.description || '',
        category: editForm.category || 'other',
        maxLevel: editForm.maxLevel || 100,
        isEnabled: editForm.isEnabled ?? true,
        icon: editForm.icon,
      };
      setProfessions([...professions, newProfession]);
      setEditForm({});
      setNewFormOpen(false);
    }
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(professions, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'professions.json';
    a.click();
  };

  return (
    <div className="profession-editor">
      <div className="editor-controls">
        <button onClick={() => setNewFormOpen(!newFormOpen)} className="btn-primary">
          {newFormOpen ? 'Отмена' : '+ Добавить профессию'}
        </button>
        <button onClick={handleExportJson} className="btn-secondary">
          📥 Экспорт JSON
        </button>
      </div>

      {newFormOpen && (
        <div className="editor-form card">
          <h3>Новая профессия</h3>
          <input
            type="text"
            placeholder="ID (минидающие_версия)"
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
          <select
            value={editForm.category || 'other'}
            onChange={(e) => setEditForm({ ...editForm, category: e.target.value as ProfessionCategory })}
          >
            {PROFESSION_CATEGORIES.map(cat => <option key={cat} value={cat}>{translateProfessionCategory(cat)}</option>)}
          </select>
          <input
            type="number"
            placeholder="Макс уровень"
            value={editForm.maxLevel || 100}
            onChange={(e) => setEditForm({ ...editForm, maxLevel: parseInt(e.target.value) })}
          />
          <input
            type="text"
            placeholder="Иконка (emoji или ID)"
            value={editForm.icon || ''}
            onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
          />
          <label>
            <input
              type="checkbox"
              checked={editForm.isEnabled ?? true}
              onChange={(e) => setEditForm({ ...editForm, isEnabled: e.target.checked })}
            />
            Включена
          </label>
          <button onClick={handleNewProfession} className="btn-primary">Сохранить</button>
        </div>
      )}

      <div className="editor-list">
        {professions.map((profession) => (
          <div key={profession.id} className="editor-item card">
            {editingId === profession.id ? (
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
                <select
                  value={editForm.category || 'other'}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as ProfessionCategory })}
                >
                  {PROFESSION_CATEGORIES.map(cat => <option key={cat} value={cat}>{translateProfessionCategory(cat)}</option>)}
                </select>
                <input
                  type="number"
                  value={editForm.maxLevel || 100}
                  onChange={(e) => setEditForm({ ...editForm, maxLevel: parseInt(e.target.value) })}
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
                  Включена
                </label>
                <div className="form-actions">
                  <button onClick={handleSaveEdit} className="btn-primary">Сохранить</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary">Отмена</button>
                </div>
              </div>
            ) : (
              <div className="editor-content">
                <h4>{profession.icon && `${profession.icon} `}{profession.name}</h4>
                <p className="muted">{profession.id}</p>
                <p>{profession.description}</p>
                <div className="meta">
                  <span>Категория: {profession.category}</span>
                  <span>Макс уровень: {profession.maxLevel}</span>
                  <span>{profession.isEnabled ? '✅ Включена' : '❌ Отключена'}</span>
                </div>
                <div className="item-actions">
                  <button onClick={() => handleEdit(profession)} className="btn-secondary">✏️ Редактировать</button>
                  <button onClick={() => handleDelete(profession.id)} className="btn-danger">🗑️ Удалить</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .profession-editor {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .editor-controls {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .editor-form {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          background: rgba(26, 22, 17, 0.92);
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
