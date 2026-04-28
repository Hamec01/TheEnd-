import { SkillType, type AdminSkillDefinition } from '@theend/rpg-domain';
import { formatEnumLabel, SKILL_TYPES } from './skillAdminUtils';

interface SkillListPageProps {
  skills: AdminSkillDefinition[];
  selectedId: string | null;
  query: string;
  typeFilter: 'all' | SkillType;
  publishFilter: 'all' | 'published' | 'draft';
  hiddenFilter: 'all' | 'hidden' | 'visible';
  onQueryChange: (value: string) => void;
  onTypeFilterChange: (value: 'all' | SkillType) => void;
  onPublishFilterChange: (value: 'all' | 'published' | 'draft') => void;
  onHiddenFilterChange: (value: 'all' | 'hidden' | 'visible') => void;
  onCreateNew: () => void;
  onSelect: (skill: AdminSkillDefinition) => void;
  resolveIcon: (skill: AdminSkillDefinition) => string | undefined;
}

function getAccent(skill: AdminSkillDefinition): string {
  if (skill.type === SkillType.FORBIDDEN_MAGIC || skill.type === SkillType.MIXED) {
    return 'is-crimson';
  }
  if (skill.type === SkillType.ELEMENTAL_MAGIC || skill.type === SkillType.RUNE) {
    return 'is-sky';
  }
  if (skill.type === SkillType.SHAMANISM || skill.type === SkillType.PASSIVE) {
    return 'is-olive';
  }
  return 'is-gold';
}

export function SkillListPage(props: SkillListPageProps) {
  const {
    skills,
    selectedId,
    query,
    typeFilter,
    publishFilter,
    hiddenFilter,
    onQueryChange,
    onTypeFilterChange,
    onPublishFilterChange,
    onHiddenFilterChange,
    onCreateNew,
    onSelect,
    resolveIcon,
  } = props;

  return (
    <section className="admin-items-catalog card">
      <div className="admin-catalog-header">
        <div>
          <p className="admin-catalog-kicker">Combat Content</p>
          <h3>Skills Library</h3>
          <p className="muted">Полноценный каталог навыков в том же стиле, что и предметы: карточки, фильтры, быстрый вход в редактор.</p>
        </div>
        <div className="admin-catalog-metrics">
          <span>{skills.length} всего</span>
          <span>{skills.filter((skill) => skill.isPublished).length} опубликовано</span>
        </div>
      </div>

      <div className="admin-list-tools admin-catalog-toolbar">
        <input placeholder="Поиск по ID, slug или названию" value={query} onChange={(event) => onQueryChange(event.target.value)} />
        <select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value as 'all' | SkillType)}>
          <option value="all">Все типы</option>
          {SKILL_TYPES.map((type) => <option key={type} value={type}>{formatEnumLabel(type)}</option>)}
        </select>
        <select value={publishFilter} onChange={(event) => onPublishFilterChange(event.target.value as 'all' | 'published' | 'draft')}>
          <option value="all">Любой статус</option>
          <option value="published">Опубликованные</option>
          <option value="draft">Черновики</option>
        </select>
        <select value={hiddenFilter} onChange={(event) => onHiddenFilterChange(event.target.value as 'all' | 'hidden' | 'visible')}>
          <option value="all">Скрытые и видимые</option>
          <option value="visible">Только видимые</option>
          <option value="hidden">Только скрытые</option>
        </select>
        <button onClick={onCreateNew}>Новый skill</button>
      </div>

      <div className="admin-items-selected-row">
        <strong>Сейчас редактируется:</strong>
        <span>{selectedId ?? 'новый skill'}</span>
      </div>

      <div className="admin-items-icons-grid">
        {skills.map((skill) => (
          <button
            key={skill.id}
            className={`admin-item-icon-card ${selectedId === skill.id ? 'is-active' : ''}`}
            onClick={() => onSelect(skill)}
          >
            <div className={`admin-catalog-thumb ${getAccent(skill)}`}>
              {resolveIcon(skill) ? <img src={resolveIcon(skill)} alt={skill.name} /> : (skill.name.trim() || skill.type).charAt(0).toUpperCase()}
            </div>
            <strong>{skill.name || '(без названия)'}</strong>
            <span>{skill.id || 'ID появится после сохранения'}</span>
            <span>{formatEnumLabel(skill.type)} | {skill.maxLevel} lvl</span>
          </button>
        ))}
      </div>

      {skills.length === 0 ? (
        <p className="muted">Скиллы не найдены. Проверьте фильтры или создайте новый skill.</p>
      ) : null}
    </section>
  );
}