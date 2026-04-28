import type { SkillAcquisitionConfig } from '@theend/rpg-domain';
import { AdminFieldLabel } from '../adminUi';
import { SkillJsonField } from './SkillJsonField';

interface SkillAcquisitionEditorProps {
  value: SkillAcquisitionConfig;
  onChange: (next: SkillAcquisitionConfig) => void;
  onStatus: (message: string) => void;
}

export function SkillAcquisitionEditor({ value, onChange, onStatus }: SkillAcquisitionEditorProps) {
  function patch(patchValue: Partial<SkillAcquisitionConfig>) {
    onChange({ ...value, ...patchValue });
  }

  return (
    <div className="admin-page-grid">
      <div className="admin-form-grid">
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={value.isStarterSkill} onChange={(event) => patch({ isStarterSkill: event.target.checked })} />
          <AdminFieldLabel label="Starter Skill" hint="Навык доступен на старте персонажа или класса." />
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={value.isQuestReward} onChange={(event) => patch({ isQuestReward: event.target.checked })} />
          <AdminFieldLabel label="Quest Reward" hint="Навык выдаётся как награда за квест." />
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={value.isBuyable} onChange={(event) => patch({ isBuyable: event.target.checked })} />
          <AdminFieldLabel label="Buyable" hint="Навык можно купить у торговца, учителя или через витрину знаний." />
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={value.isDiscoverable} onChange={(event) => patch({ isDiscoverable: event.target.checked })} />
          <AdminFieldLabel label="Discoverable" hint="Навык можно найти в мире через исследования, события и hidden discovery." />
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={value.isAdminOnly} onChange={(event) => patch({ isAdminOnly: event.target.checked })} />
          <AdminFieldLabel label="Admin Only" hint="Навык доступен только через админские инструменты или GM flow." />
        </label>
      </div>

      <SkillJsonField label="Acquisition Methods" hint="Массив SkillAcquisitionMethod: учителя, книги, предметы, квесты, духи, руны и админская выдача." value={value.methods} onChange={(next) => patch({ methods: next })} onStatus={onStatus} rows={14} />
    </div>
  );
}