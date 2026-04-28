import type { SkillLevelData } from '@theend/rpg-domain';
import { AdminFieldLabel } from '../adminUi';
import { SkillJsonField } from './SkillJsonField';

interface SkillLevelEditorProps {
  maxLevel: number;
  levels: SkillLevelData[];
  onChange: (next: SkillLevelData[]) => void;
  onStatus: (message: string) => void;
}

export function SkillLevelEditor({ maxLevel, levels, onChange, onStatus }: SkillLevelEditorProps) {
  function patchLevel(index: number, patch: Partial<SkillLevelData>) {
    const next = levels.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry));
    onChange(next);
  }

  return (
    <div className="admin-page-grid">
      <div className="admin-card-grid admin-card-grid-tight">
        {levels.slice(0, maxLevel).map((level, index) => (
          <section className="card admin-subcard" key={level.level}>
            <h4>Уровень {level.level}</h4>
            <label>
              <AdminFieldLabel label="Base Power" hint="Базовая сила навыка на этом уровне." />
              <input type="number" value={level.basePower} onChange={(event) => patchLevel(index, { basePower: Number(event.target.value) || 0 })} />
            </label>
            <label>
              <AdminFieldLabel label="Scaling Power" hint="Дополнительный скейл на уровень, если нужен поверх базовой силы." />
              <input type="number" value={level.scalingPower ?? ''} onChange={(event) => patchLevel(index, { scalingPower: event.target.value === '' ? undefined : Number(event.target.value) })} />
            </label>
            <label>
              <AdminFieldLabel label="Override Description" hint="Короткий текст только для этого уровня навыка." />
              <textarea rows={3} value={level.descriptionOverride ?? ''} onChange={(event) => patchLevel(index, { descriptionOverride: event.target.value || undefined })} />
            </label>
          </section>
        ))}
      </div>

      <SkillJsonField
        label="Advanced Level JSON"
        hint="Полный JSON для levels: overrides costs, cooldown, damage и effects по уровням. Изменения применяются при потере фокуса." 
        value={levels}
        onChange={onChange}
        onStatus={onStatus}
        rows={18}
      />
    </div>
  );
}