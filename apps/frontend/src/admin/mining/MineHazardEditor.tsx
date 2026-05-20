import React, { useState } from 'react';
import { MineHazard } from '../../types/mining';

interface MineHazardEditorProps {
  onSave?: (hazards: MineHazard[]) => void;
}

type HazardType = 'trap' | 'collapse' | 'gas' | 'flood' | 'creature' | 'curse';

const HAZARD_TYPES: HazardType[] = ['trap', 'collapse', 'gas', 'flood', 'creature', 'curse'];
const HAZARD_ICONS: Record<HazardType, string> = {
  'trap': '🪤',
  'collapse': '💥',
  'gas': '☁️',
  'flood': '🌊',
  'creature': '👹',
  'curse': '🔮',
};

export function MineHazardEditor({ onSave }: MineHazardEditorProps) {
  const [hazards, setHazards] = useState<MineHazard[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MineHazard>>({});
  const [newFormOpen, setNewFormOpen] = useState(false);

  const handleEdit = (hazard: MineHazard) => {
    setEditingId(hazard.id);
    setEditForm({ ...hazard });
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.id && editForm.name) {
      setHazards(hazards.map(h => h.id === editingId ? { ...h, ...editForm } : h));
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить эту опасность?')) {
      setHazards(hazards.filter(h => h.id !== id));
    }
  };

  const handleNewHazard = () => {
    if (editForm.id && editForm.name && editForm.type) {
      const newHazard: MineHazard = {
        id: editForm.id,
        name: editForm.name,
        type: editForm.type,
        description: editForm.description || '',
        hpDamageMin: editForm.hpDamageMin || 0,
        hpDamageMax: editForm.hpDamageMax || 10,
        staminaDamageMin: editForm.staminaDamageMin || 0,
        staminaDamageMax: editForm.staminaDamageMax || 5,
        lootLossChance: editForm.lootLossChance || 0,
        statusEffectIds: editForm.statusEffectIds || [],
        canBeReducedBySkill: editForm.canBeReducedBySkill ?? true,
        isDeadly: editForm.isDeadly ?? false,
      };
      setHazards([...hazards, newHazard]);
      setEditForm({});
      setNewFormOpen(false);
    }
  };

  return (
    <div className="hazard-editor">
      <div className="editor-controls">
        <button onClick={() => setNewFormOpen(!newFormOpen)} className="btn-primary">
          {newFormOpen ? 'Отмена' : '⚠️ Добавить опасность'}
        </button>
      </div>

      {newFormOpen && (
        <div className="editor-form card">
          <h3>Новая опасность</h3>
          <input
            type="text"
            placeholder="ID"
            value={editForm.id || ''}
            onChange={(e) => setEditForm({ ...editForm, id: e.target.value })}
          />
          <input
            type="text"
            placeholder="Название"
            value={editForm.name || ''}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <select
            value={editForm.type || ''}
            onChange={(e) => setEditForm({ ...editForm, type: e.target.value as HazardType })}
          >
            <option value="">Выберите тип</option>
            {HAZARD_TYPES.map(t => <option key={t} value={t}>{HAZARD_ICONS[t]} {t}</option>)}
          </select>
          <textarea
            placeholder="Описание"
            value={editForm.description || ''}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <input
              type="number"
              placeholder="Мин урон HP"
              value={editForm.hpDamageMin || 0}
              onChange={(e) => setEditForm({ ...editForm, hpDamageMin: parseInt(e.target.value) })}
            />
            <input
              type="number"
              placeholder="Макс урон HP"
              value={editForm.hpDamageMax || 10}
              onChange={(e) => setEditForm({ ...editForm, hpDamageMax: parseInt(e.target.value) })}
            />
            <input
              type="number"
              placeholder="Мин урон стамина"
              value={editForm.staminaDamageMin || 0}
              onChange={(e) => setEditForm({ ...editForm, staminaDamageMin: parseInt(e.target.value) })}
            />
            <input
              type="number"
              placeholder="Макс урон стамина"
              value={editForm.staminaDamageMax || 5}
              onChange={(e) => setEditForm({ ...editForm, staminaDamageMax: parseInt(e.target.value) })}
            />
          </div>
          <input
            type="number"
            placeholder="Шанс потерь лута (0-100%)"
            value={editForm.lootLossChance || 0}
            onChange={(e) => setEditForm({ ...editForm, lootLossChance: Math.min(100, Math.max(0, parseInt(e.target.value))) })}
          />
          <label>
            <input
              type="checkbox"
              checked={editForm.canBeReducedBySkill ?? true}
              onChange={(e) => setEditForm({ ...editForm, canBeReducedBySkill: e.target.checked })}
            />
            Может быть ослаблена скилом
          </label>
          <label>
            <input
              type="checkbox"
              checked={editForm.isDeadly ?? false}
              onChange={(e) => setEditForm({ ...editForm, isDeadly: e.target.checked })}
            />
            Смертельная
          </label>
          <button onClick={handleNewHazard} className="btn-primary">Сохранить</button>
        </div>
      )}

      <div className="editor-list">
        {hazards.map((hazard) => (
          <div key={hazard.id} className="editor-item card">
            {editingId === hazard.id ? (
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
                  value={editForm.hpDamageMin || 0}
                  onChange={(e) => setEditForm({ ...editForm, hpDamageMin: parseInt(e.target.value) })}
                />
                <input
                  type="number"
                  value={editForm.hpDamageMax || 10}
                  onChange={(e) => setEditForm({ ...editForm, hpDamageMax: parseInt(e.target.value) })}
                />
                <div className="form-actions">
                  <button onClick={handleSaveEdit} className="btn-primary">Сохранить</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary">Отмена</button>
                </div>
              </div>
            ) : (
              <div className="editor-content">
                <h4>{HAZARD_ICONS[hazard.type]} {hazard.name}</h4>
                <p className="muted">{hazard.id}</p>
                <p>{hazard.description}</p>
                <div className="meta">
                  <span>Тип: {hazard.type}</span>
                  <span>HP: {hazard.hpDamageMin}-{hazard.hpDamageMax}</span>
                  <span>Стамина: {hazard.staminaDamageMin}-{hazard.staminaDamageMax}</span>
                  {hazard.lootLossChance > 0 && <span>Потери лута: {hazard.lootLossChance}%</span>}
                  {hazard.canBeReducedBySkill && <span>🎯 Ослабляемо</span>}
                  {hazard.isDeadly && <span>☠️ Смертельно</span>}
                </div>
                <div className="item-actions">
                  <button onClick={() => handleEdit(hazard)} className="btn-secondary">✏️</button>
                  <button onClick={() => handleDelete(hazard.id)} className="btn-danger">🗑️</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .hazard-editor {
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
