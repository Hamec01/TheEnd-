import React, { useState, useEffect } from 'react';
import { ProfessionBranch } from '../../types/profession';
import {
  loadProfessionBranchesFromStorage,
  saveProfessionBranchesToStorage,
} from '../../services/professionBranchRepository';
import { ImageSheetPicker } from '../components/ImageSheetPicker';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import { loadRuntimeImages } from '../../services/content/runtimeImageService';
import type { StoredImage, GameImageRef } from '../../services/content/models';

interface ProfessionBranchEditorProps {
  professions?: Array<{ id: string; name: string }>;
  filterByProfession?: string;
  onSave?: (branches: ProfessionBranch[]) => void;
}

export function ProfessionBranchEditor({ professions = [], filterByProfession, onSave }: ProfessionBranchEditorProps) {
  const [branches, setBranches] = useState<ProfessionBranch[]>(() => loadProfessionBranchesFromStorage());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProfessionBranch>>({});
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [filterProfession, setFilterProfession] = useState<string>(filterByProfession || '');
  const [images, setImages] = useState<StoredImage[]>([]);

  useEffect(() => {
    void loadRuntimeImages().then(setImages).catch(() => setImages([]));
  }, []);

  const filteredBranches = (filterByProfession || filterProfession) ? branches.filter(b => b.professionId === (filterByProfession || filterProfession)) : branches;

  const branchWarnings = filteredBranches
    .filter((branch) => {
      const name = String(branch.name ?? '').toLowerCase();
      const isChoiceLike = name.includes('глубинник')
        || name.includes('старатель')
        || name.includes('искатель')
        || name.includes('покоритель')
        || name.includes('проходчик');
      return isChoiceLike && !String(branch.exclusiveGroupId ?? '').trim();
    })
    .map((branch) => `Ветка ${branch.name} (${branch.id}) выглядит как choice-ветка, но у нее нет exclusiveGroupId.`);

  const persist = (next: ProfessionBranch[]) => {
    const saved = saveProfessionBranchesToStorage(next);
    setBranches(saved);
    onSave?.(saved);
  };

  const handleEdit = (branch: ProfessionBranch) => {
    setEditingId(branch.id);
    setEditForm({ ...branch });
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.id && editForm.name && editForm.professionId) {
      const next = branches.map(b => b.id === editingId ? {
        ...b,
        ...editForm,
        requiredSkillIds: Array.isArray(editForm.requiredSkillIds)
          ? editForm.requiredSkillIds.map((id) => String(id).trim()).filter(Boolean)
          : undefined,
        requiredBranchIds: Array.isArray(editForm.requiredBranchIds)
          ? editForm.requiredBranchIds.map((id) => String(id).trim()).filter(Boolean)
          : undefined,
        locksBranchIds: Array.isArray(editForm.locksBranchIds)
          ? editForm.locksBranchIds.map((id) => String(id).trim()).filter(Boolean)
          : undefined,
      } : b);
      persist(next);
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить эту ветку?')) {
      persist(branches.filter(b => b.id !== id));
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
        requiredBranchIds: editForm.requiredBranchIds || [],
        locksBranchIds: editForm.locksBranchIds || [],
        isFinalBranch: editForm.isFinalBranch ?? false,
        isEnabled: editForm.isEnabled ?? true,
        icon: editForm.icon,
        iconImageRef: editForm.iconImageRef,
      };
      persist([...branches, newBranch]);
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
          <ImageSheetPicker
            label="Иконка ветки"
            hint="Изображение для ветки навыков."
            category="other"
            value={(editForm.iconImageRef as any) ?? null}
            legacyImagePath={editForm.icon}
            runtimeImages={images}
            showUploadForImage
            disableManualImageInput
            defaultTilesetFrameWidth={128}
            defaultTilesetFrameHeight={128}
            uploadPresetId="item-icon"
            uploadSuggestedId={editForm.id || undefined}
            uploadSuggestedName={`${editForm.id || editForm.name || 'profession-branch'}-icon`}
            uploadFolder={buildUploadFolder('images', 'branches', editForm.id || undefined)}
            onStatus={() => {}}
            onChange={(next) => {
              setEditForm((current) => ({
                ...current,
                iconImageRef: next || undefined,
                icon: next?.type === 'image' ? next.src : undefined,
              }));
            }}
          />
          <input
            type="text"
            placeholder="ID группы исключительности (опционально)"
            value={editForm.exclusiveGroupId || ''}
            onChange={(e) => setEditForm({ ...editForm, exclusiveGroupId: e.target.value })}
          />
          <input
            type="text"
            placeholder="Required skill IDs (через запятую)"
            value={(editForm.requiredSkillIds ?? []).join(', ')}
            onChange={(e) => setEditForm({
              ...editForm,
              requiredSkillIds: e.target.value.split(',').map((id) => id.trim()).filter(Boolean),
            })}
          />
          <input
            type="text"
            placeholder="Required branch IDs (через запятую)"
            value={(editForm.requiredBranchIds ?? []).join(', ')}
            onChange={(e) => setEditForm({
              ...editForm,
              requiredBranchIds: e.target.value.split(',').map((id) => id.trim()).filter(Boolean),
            })}
          />
          <input
            type="text"
            placeholder="Locks branch IDs (через запятую)"
            value={(editForm.locksBranchIds ?? []).join(', ')}
            onChange={(e) => setEditForm({
              ...editForm,
              locksBranchIds: e.target.value.split(',').map((id) => id.trim()).filter(Boolean),
            })}
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
        {branchWarnings.length > 0 ? (
          <div className="card" style={{ background: 'rgba(57, 30, 20, 0.72)', border: '1px solid rgba(215, 166, 114, 0.42)' }}>
            <strong>Предупреждения валидации</strong>
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              {branchWarnings.map((warning, index) => <p key={`${warning}-${index}`} className="muted" style={{ margin: 0 }}>{warning}</p>)}
            </div>
          </div>
        ) : null}
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
                <ImageSheetPicker
                  label="Иконка ветки"
                  hint="Изображение для ветки навыков."
                  category="other"
                  value={(editForm.iconImageRef as any) ?? null}
                  legacyImagePath={editForm.icon}
                  runtimeImages={images}
                  showUploadForImage
                  disableManualImageInput
                  defaultTilesetFrameWidth={128}
                  defaultTilesetFrameHeight={128}
                  uploadPresetId="item-icon"
                  uploadSuggestedId={editForm.id || undefined}
                  uploadSuggestedName={`${editForm.id || editForm.name || 'profession-branch'}-icon`}
                  uploadFolder={buildUploadFolder('images', 'branches', editForm.id || undefined)}
                  onStatus={() => {}}
                  onChange={(next) => {
                    setEditForm((current) => ({
                      ...current,
                      iconImageRef: next || undefined,
                      icon: next?.type === 'image' ? next.src : undefined,
                    }));
                  }}
                />
                <input
                  type="text"
                  value={editForm.exclusiveGroupId || ''}
                  onChange={(e) => setEditForm({ ...editForm, exclusiveGroupId: e.target.value })}
                />
                <input
                  type="text"
                  value={(editForm.requiredSkillIds ?? []).join(', ')}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    requiredSkillIds: e.target.value.split(',').map((id) => id.trim()).filter(Boolean),
                  })}
                />
                <input
                  type="text"
                  value={(editForm.requiredBranchIds ?? []).join(', ')}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    requiredBranchIds: e.target.value.split(',').map((id) => id.trim()).filter(Boolean),
                  })}
                />
                <input
                  type="text"
                  value={(editForm.locksBranchIds ?? []).join(', ')}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    locksBranchIds: e.target.value.split(',').map((id) => id.trim()).filter(Boolean),
                  })}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  {branch.iconImageRef?.type === 'image' || branch.icon ? (
                    <img
                      src={branch.iconImageRef?.type === 'image' ? branch.iconImageRef.src : branch.icon}
                      alt={branch.name}
                      style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(139, 102, 56, 0.4)' }}
                    />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(139,102,56,0.3)', fontSize: '20px' }}>⚚</div>
                  )}
                  <div>
                    <h4 style={{ margin: 0 }}>{branch.name}</h4>
                    <p className="muted" style={{ margin: '2px 0 0 0', fontSize: '0.85rem' }}>{branch.id} • {branch.professionId}</p>
                  </div>
                </div>
                <p>{branch.description}</p>
                <div className="meta">
                  {branch.exclusiveGroupId && <span>Группа: {branch.exclusiveGroupId}</span>}
                  {(branch.requiredSkillIds ?? []).length > 0 && <span>Требует: {branch.requiredSkillIds?.join(', ')}</span>}
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
