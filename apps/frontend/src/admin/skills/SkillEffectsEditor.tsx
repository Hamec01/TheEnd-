import type {
  SkillDamageComponent,
  SkillEffectComponent,
  SkillHealingComponent,
  SkillSummonComponent,
  SkillTransformationComponent,
} from '@theend/rpg-domain';
import { SkillJsonField } from './SkillJsonField';

interface SkillEffectsEditorProps {
  damage: SkillDamageComponent[];
  healing: SkillHealingComponent[];
  effects: SkillEffectComponent[];
  summons: SkillSummonComponent[];
  transformations: SkillTransformationComponent[];
  onDamageChange: (next: SkillDamageComponent[]) => void;
  onHealingChange: (next: SkillHealingComponent[]) => void;
  onEffectsChange: (next: SkillEffectComponent[]) => void;
  onSummonsChange: (next: SkillSummonComponent[]) => void;
  onTransformationsChange: (next: SkillTransformationComponent[]) => void;
  onStatus: (message: string) => void;
}

export function SkillEffectsEditor(props: SkillEffectsEditorProps) {
  const {
    damage,
    healing,
    effects,
    summons,
    transformations,
    onDamageChange,
    onHealingChange,
    onEffectsChange,
    onSummonsChange,
    onTransformationsChange,
    onStatus,
  } = props;

  return (
    <div className="admin-page-grid">
      <SkillJsonField label="Damage Components" hint="Массив SkillDamageComponent. Можно комбинировать физический, стихийный, магический, рунный и true damage." value={damage} onChange={onDamageChange} onStatus={onStatus} />
      <SkillJsonField label="Healing Components" hint="Массив SkillHealingComponent для лечения, щитов, cleanse и life steal." value={healing} onChange={onHealingChange} onStatus={onStatus} />
      <SkillJsonField label="Effect Components" hint="Массив SkillEffectComponent для баффов, дебаффов, контроля и периодических эффектов." value={effects} onChange={onEffectsChange} onStatus={onStatus} />
      <SkillJsonField label="Summons" hint="Массив SkillSummonComponent для призыва существ и духов." value={summons} onChange={onSummonsChange} onStatus={onStatus} rows={8} />
      <SkillJsonField label="Transformations" hint="Массив SkillTransformationComponent для форм, превращений и боевых обликов." value={transformations} onChange={onTransformationsChange} onStatus={onStatus} rows={8} />
    </div>
  );
}