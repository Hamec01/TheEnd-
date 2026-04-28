import { getSkillCostSummary, getSkillLevelData, getSkillPowerAtLevel, type AdminSkillDefinition } from '@theend/rpg-domain';
import { formatEnumLabel } from './skillAdminUtils';

interface SkillPreviewProps {
  skill: AdminSkillDefinition;
  level: number;
  iconSrc?: string;
}

export function SkillPreview({ skill, level, iconSrc }: SkillPreviewProps) {
  const levelData = getSkillLevelData(skill, level);
  const resourceSummary = getSkillCostSummary(skill, level);

  return (
    <section className="card admin-preview-card">
      <div className="admin-item-preview-layout">
        <div className="admin-item-preview-icon-shell" aria-hidden="true">
          {iconSrc ? (
            <img className="admin-item-preview-icon" src={iconSrc} alt={skill.name || 'skill preview'} />
          ) : (
            <div className="admin-item-preview-icon admin-item-preview-icon-fallback">
              {(skill.name.trim() || skill.type).charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
      <h4>{skill.name || '(без названия)'}</h4>
      <p className="muted">{skill.id || 'ID ещё не задан'} · {formatEnumLabel(skill.type)} · Level {level}/{skill.maxLevel}</p>
      <p>{levelData.descriptionOverride || skill.gameplayDescription || 'Игровое описание пока не заполнено.'}</p>
      <div className="admin-entity-tags">
        {skill.subtypes.map((subtype) => <span key={subtype}>{formatEnumLabel(subtype)}</span>)}
      </div>
      <p><strong>Power:</strong> {getSkillPowerAtLevel(skill, level)}</p>
      <p><strong>Resources:</strong> {resourceSummary.length > 0 ? resourceSummary.map((entry) => `${entry.type} ${entry.amount}`).join(', ') : (skill.costs.isFree ? 'Free' : 'None')}</p>
      <p><strong>Damage:</strong> {skill.damage.length > 0 ? `${skill.damage.length} components` : 'Нет'}</p>
      <p><strong>Healing:</strong> {skill.healing.length > 0 ? `${skill.healing.length} components` : 'Нет'}</p>
      <p><strong>Effects:</strong> {skill.effects.length > 0 ? `${skill.effects.length} effects` : 'Нет'}</p>
      <p><strong>Target:</strong> {formatEnumLabel(skill.target.targetType)} · Range {skill.target.range}</p>
      <p><strong>Cooldown:</strong> {skill.cooldown.cooldownTurns} turns</p>
      <p><strong>Acquisition:</strong> {skill.acquisition.methods.length > 0 ? skill.acquisition.methods.map((method) => formatEnumLabel(method.type)).join(', ') : 'Admin only'}</p>
      <p><strong>Risks:</strong> {skill.risks.length > 0 ? `${skill.risks.length} risks` : 'Нет'}</p>
      {skill.adminNotes ? <p className="muted">{skill.adminNotes}</p> : null}
    </section>
  );
}