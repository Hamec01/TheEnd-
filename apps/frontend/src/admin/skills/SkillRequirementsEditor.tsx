import type { SkillRequirementConfig } from '@theend/rpg-domain';
import { AdminFieldLabel } from '../adminUi';
import { SkillJsonField } from './SkillJsonField';
import { formatCommaList, parseCommaList } from './skillAdminUtils';

interface SkillRequirementsEditorProps {
  value: SkillRequirementConfig;
  onChange: (next: SkillRequirementConfig) => void;
  onStatus: (message: string) => void;
}

export function SkillRequirementsEditor({ value, onChange, onStatus }: SkillRequirementsEditorProps) {
  function patch(patchValue: Partial<SkillRequirementConfig>) {
    onChange({ ...value, ...patchValue });
  }

  return (
    <div className="admin-page-grid">
      <div className="admin-form-grid">
        <label>
          <AdminFieldLabel label="Min Character Level" hint="Минимальный уровень персонажа для изучения навыка." />
          <input type="number" value={value.minCharacterLevel ?? ''} onChange={(event) => patch({ minCharacterLevel: event.target.value === '' ? undefined : Number(event.target.value) })} />
        </label>
        <label>
          <AdminFieldLabel label="Required Skills" hint="Через запятую: prerequisite skill ids." />
          <input value={formatCommaList(value.requiredSkills)} onChange={(event) => patch({ requiredSkills: parseCommaList(event.target.value) })} />
        </label>
        <label>
          <AdminFieldLabel label="Required Items" hint="Через запятую: item ids, если навык требует артефакт, книгу или инструмент." />
          <input value={formatCommaList(value.requiredItems)} onChange={(event) => patch({ requiredItems: parseCommaList(event.target.value) })} />
        </label>
        <label>
          <AdminFieldLabel label="Allowed Classes" hint="Через запятую: class ids, которым навык разрешён." />
          <input value={formatCommaList(value.allowedClasses)} onChange={(event) => patch({ allowedClasses: parseCommaList(event.target.value) })} />
        </label>
        <label>
          <AdminFieldLabel label="Forbidden Classes" hint="Через запятую: class ids, которым навык запрещён." />
          <input value={formatCommaList(value.forbiddenClasses)} onChange={(event) => patch({ forbiddenClasses: parseCommaList(event.target.value) })} />
        </label>
        <label>
          <AdminFieldLabel label="Allowed Races" hint="Через запятую: race ids, которым навык явно разрешён." />
          <input value={formatCommaList(value.allowedRaces)} onChange={(event) => patch({ allowedRaces: parseCommaList(event.target.value) })} />
        </label>
        <label>
          <AdminFieldLabel label="Forbidden Races" hint="Через запятую: race ids, которым навык запрещён." />
          <input value={formatCommaList(value.forbiddenRaces)} onChange={(event) => patch({ forbiddenRaces: parseCommaList(event.target.value) })} />
        </label>
        <label>
          <AdminFieldLabel label="Required Runes" hint="Через запятую: ids обязательных рун." />
          <input value={formatCommaList(value.requiredRuneIds)} onChange={(event) => patch({ requiredRuneIds: parseCommaList(event.target.value) })} />
        </label>
      </div>

      <SkillJsonField label="Required Stats JSON" hint="Partial<Record<StatType, number>> для точных статовых требований." value={value.requiredStats ?? {}} onChange={(next) => patch({ requiredStats: next })} onStatus={onStatus} rows={8} />
      <SkillJsonField label="Advanced Requirement JSON" hint="Тут же можно настроить reputation, quests, factions, magic schools и другие редкие требования." value={value} onChange={onChange} onStatus={onStatus} rows={14} />
    </div>
  );
}