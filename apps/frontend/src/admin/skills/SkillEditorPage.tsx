import { useEffect, useMemo, useState } from 'react';
import type { SkillType, AdminSkillDefinition } from '@theend/rpg-domain';
import { getIdQualityWarning, runSaveWithFeedback, useAdminSaveShortcut, type AdminSaveViewModel } from '../adminSaveTools';
import { imageService } from '../../services/content/imageService';
import type { StoredImage } from '../../services/content/models';
import { skillsService, emptySkill, normalizeSkill, validateSkill } from '../../services/content/skillsService';
import { resolveStoredImageSource } from '../../services/content/runtimeImageService';
import { SkillForm } from './SkillForm';
import { SkillListPage } from './SkillListPage';
import { clampLevel, normalizeSkillDraft } from './skillAdminUtils';

type PublishFilter = 'all' | 'published' | 'draft';
type HiddenFilter = 'all' | 'hidden' | 'visible';

export function SkillEditorPage() {
  const [skills, setSkills] = useState<AdminSkillDefinition[]>([]);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminSkillDefinition>(() => normalizeSkillDraft(emptySkill()));
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | SkillType>('all');
  const [publishFilter, setPublishFilter] = useState<PublishFilter>('all');
  const [hiddenFilter, setHiddenFilter] = useState<HiddenFilter>('all');
  const [previewLevel, setPreviewLevel] = useState(1);
  const [status, setStatus] = useState('Ready');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Ready' });
  const [isSaving, setIsSaving] = useState(false);

  async function refresh() {
    try {
      const [nextSkills, nextImages] = await Promise.all([skillsService.getAll(), imageService.getAll()]);
      setSkills(nextSkills);
      setImages(nextImages as StoredImage[]);
      if (selectedId && !nextSkills.some((skill) => skill.id === selectedId)) {
        setSelectedId(null);
        setDraft(normalizeSkillDraft(emptySkill()));
      }
      setStatus('Ready');
    } catch (error) {
      setStatus(`Не удалось загрузить skills: ${(error as Error).message}`);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visibleSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((skill) => {
      if (q && !skill.id.toLowerCase().includes(q) && !skill.slug.toLowerCase().includes(q) && !skill.name.toLowerCase().includes(q)) {
        return false;
      }
      if (typeFilter !== 'all' && skill.type !== typeFilter) {
        return false;
      }
      if (publishFilter === 'published' && !skill.isPublished) {
        return false;
      }
      if (publishFilter === 'draft' && skill.isPublished) {
        return false;
      }
      if (hiddenFilter === 'hidden' && !skill.isHidden) {
        return false;
      }
      if (hiddenFilter === 'visible' && skill.isHidden) {
        return false;
      }
      return true;
    });
  }, [hiddenFilter, publishFilter, query, skills, typeFilter]);

  function select(skill: AdminSkillDefinition) {
    setSelectedId(skill.id);
    setDraft(normalizeSkillDraft(normalizeSkill(skill)));
    setPreviewLevel(1);
  }

  function createNew() {
    setSelectedId(null);
    setDraft(normalizeSkillDraft(emptySkill()));
    setPreviewLevel(1);
  }

  function resolveSkillIcon(skill: AdminSkillDefinition): string | undefined {
    return resolveStoredImageSource(skill.iconUrl?.trim(), images);
  }

  async function saveSkill() {
    if (isSaving) {
      return;
    }

    const normalized = normalizeSkillDraft(normalizeSkill(draft));
    const errors = validateSkill(normalized);
    if (errors.length > 0) {
      setStatus(errors.join(', '));
      return;
    }

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: normalized.id,
      onSave: () => (selectedId
        ? skillsService.update(selectedId, normalized)
        : skillsService.create(normalized)),
      onAfterSave: async (entry) => {
        const verified = await skillsService.getById(entry.id);
        if (!verified) {
          throw new Error('Сохранение не подтверждено: запись не найдена после сохранения.');
        }
      },
      successLabel: (entry) => `Сохранено: ${entry.id}`,
    });

    if (!saved) {
      setIsSaving(false);
      return;
    }

    setSelectedId(saved.id);
    setDraft(normalizeSkillDraft(saved));
    await refresh();

    const warning = getIdQualityWarning(saved.id);
    if (warning) {
      setStatus(`Предупреждение: ${warning}`);
      setSaveState({ state: 'warning', message: warning });
    } else {
      setStatus(selectedId ? `Skill updated: ${saved.id}` : `Skill created: ${saved.id}`);
    }
    setIsSaving(false);
  }

  useAdminSaveShortcut({
    enabled: true,
    isSaving,
    onSave: saveSkill,
  });

  async function duplicateSkill() {
    if (!selectedId) {
      return;
    }

    try {
      const created = await skillsService.create({
        ...draft,
        id: `${draft.id || 'skill'}_copy_${Math.floor(Math.random() * 10000)}`,
        slug: `${draft.slug || 'skill-copy'}-${Math.floor(Math.random() * 10000)}`,
        name: `${draft.name || 'Skill'} Copy`,
        isPublished: false,
      });
      setSelectedId(created.id);
      setDraft(normalizeSkillDraft(created));
      setStatus(`Skill duplicated: ${created.id}`);
      await refresh();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function deleteSkill() {
    if (!selectedId) {
      return;
    }

    try {
      await skillsService.delete(selectedId);
      setStatus(`Skill deleted: ${selectedId}`);
      createNew();
      await refresh();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function togglePublish() {
    if (!selectedId) {
      return;
    }

    try {
      const updated = draft.isPublished
        ? await skillsService.update(selectedId, { isPublished: false })
        : await skillsService.update(selectedId, { isPublished: true });
      setDraft(normalizeSkillDraft(updated));
      setStatus(draft.isPublished ? `Skill unpublished: ${selectedId}` : `Skill published: ${selectedId}`);
      await refresh();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  return (
    <div className="admin-page-grid">
      <SkillForm
        draft={draft}
        selectedId={selectedId}
        previewLevel={clampLevel(previewLevel, draft.maxLevel)}
        iconSrc={resolveSkillIcon(draft)}
        status={status}
        saveState={saveState}
        isSaving={isSaving}
        onChange={(next) => setDraft(normalizeSkillDraft(next))}
        onPreviewLevelChange={setPreviewLevel}
        onSave={() => { void saveSkill(); }}
        onDuplicate={() => { void duplicateSkill(); }}
        onDelete={() => { void deleteSkill(); }}
        onTogglePublish={() => { void togglePublish(); }}
      />

      <SkillListPage
        skills={visibleSkills}
        selectedId={selectedId}
        query={query}
        typeFilter={typeFilter}
        publishFilter={publishFilter}
        hiddenFilter={hiddenFilter}
        onQueryChange={setQuery}
        onTypeFilterChange={setTypeFilter}
        onPublishFilterChange={setPublishFilter}
        onHiddenFilterChange={setHiddenFilter}
        onCreateNew={createNew}
        onSelect={select}
        resolveIcon={resolveSkillIcon}
      />
    </div>
  );
}