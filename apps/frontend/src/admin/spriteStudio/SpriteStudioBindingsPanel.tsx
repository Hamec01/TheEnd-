import { useMemo, useState } from 'react';
import type {
  EquipmentVisualBindingDefinition,
  SkillAnimationBindingDefinition,
  SpriteProfileDefinition,
} from '@theend/rpg-domain';
import type { AdminItem, AdminNpc, AdminSkill } from '../../services/content/models';

function formatLegacyVisualValue(value: unknown): string {
  if (!value) {
    return 'none';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value && 'type' in (value as Record<string, unknown>)) {
    return 'imageRef present';
  }
  return 'configured';
}

interface SpriteStudioBindingsPanelProps {
  npcs: AdminNpc[];
  items: AdminItem[];
  skills: AdminSkill[];
  spriteProfiles: SpriteProfileDefinition[];
  equipmentBindings: EquipmentVisualBindingDefinition[];
  skillBindings: SkillAnimationBindingDefinition[];
  onPatchNpc: (id: string, patch: Partial<AdminNpc>) => void;
  onPatchItem: (id: string, patch: Partial<AdminItem>) => void;
  onPatchSkill: (id: string, patch: Partial<AdminSkill>) => void;
}

export function SpriteStudioBindingsPanel({
  npcs,
  items,
  skills,
  spriteProfiles,
  equipmentBindings,
  skillBindings,
  onPatchNpc,
  onPatchItem,
  onPatchSkill,
}: SpriteStudioBindingsPanelProps) {
  const [selectedNpcId, setSelectedNpcId] = useState<string>(npcs[0]?.id ?? '');
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id ?? '');
  const [selectedSkillId, setSelectedSkillId] = useState<string>(skills[0]?.id ?? '');

  const selectedNpc = useMemo(() => npcs.find((entry) => entry.id === selectedNpcId) ?? null, [npcs, selectedNpcId]);
  const selectedItem = useMemo(() => items.find((entry) => entry.id === selectedItemId) ?? null, [items, selectedItemId]);
  const selectedSkill = useMemo(() => skills.find((entry) => entry.id === selectedSkillId) ?? null, [skills, selectedSkillId]);

  const unboundNpcCount = npcs.filter((entry) => !entry.spriteProfileId).length;
  const unboundItemCount = items.filter((entry) => !entry.defaultEquipmentVisualBindingId).length;
  const unboundSkillCount = skills.filter((entry) => !entry.skillAnimationBindingId).length;

  return (
    <div className="admin-editor-page" style={{ display: 'grid', gap: 16 }}>
      <section className="card admin-item-preview">
        <h4>Soft links</h4>
        <p className="muted">
          NPC без `spriteProfileId`, item без `defaultEquipmentVisualBindingId` и skill без `skillAnimationBindingId`
          продолжают жить через legacy fallback. Здесь мы только аккуратно добавляем новые связи.
        </p>
        <p className="muted">
          NPC без sprite profile: {unboundNpcCount} · Items без visual binding: {unboundItemCount} · Skills без animation binding: {unboundSkillCount}
        </p>
      </section>

      <section className="admin-form-panel">
        <h4>NPC → Sprite Profile</h4>
        <div className="admin-form-grid">
          <label>
            <span>NPC</span>
            <select value={selectedNpcId} onChange={(event) => setSelectedNpcId(event.target.value)}>
              {npcs.map((npc) => (
                <option key={npc.id} value={npc.id}>
                  {npc.name} ({npc.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>spriteProfileId</span>
            <select
              value={selectedNpc?.spriteProfileId ?? ''}
              onChange={(event) => selectedNpc && onPatchNpc(selectedNpc.id, { spriteProfileId: event.target.value || undefined })}
            >
              <option value="">Legacy fallback only</option>
              {spriteProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} ({profile.id})
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedNpc ? (
          <p className="muted">
            Current legacy portrait fallback: {formatLegacyVisualValue(
              selectedNpc.portraitImageRef
              || selectedNpc.portraitUrl
              || selectedNpc.combatImageRef
              || selectedNpc.combatImageUrl
              || selectedNpc.iconImageRef
              || selectedNpc.iconUrl,
            )}
          </p>
        ) : null}
      </section>

      <section className="admin-form-panel">
        <h4>Item → Default Equipment Visual Binding</h4>
        <div className="admin-form-grid">
          <label>
            <span>Item</span>
            <select value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)}>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>defaultEquipmentVisualBindingId</span>
            <select
              value={selectedItem?.defaultEquipmentVisualBindingId ?? ''}
              onChange={(event) => selectedItem && onPatchItem(selectedItem.id, { defaultEquipmentVisualBindingId: event.target.value || undefined })}
            >
              <option value="">No default binding</option>
              {equipmentBindings
                .filter((binding) => binding.itemId === selectedItem?.id)
                .map((binding) => (
                  <option key={binding.id} value={binding.id}>
                    {binding.name} ({binding.id})
                  </option>
                ))}
              {selectedItem && !equipmentBindings.some((binding) => binding.itemId === selectedItem.id) ? (
                <option value="" disabled>
                  No bindings for this item yet
                </option>
              ) : null}
            </select>
          </label>
        </div>
        {selectedItem ? (
          <p className="muted">
            Legacy image fallback: {selectedItem.imageRef ? 'imageRef present' : selectedItem.imagePath || 'none'} · Slot: {selectedItem.slot || 'none'}
          </p>
        ) : null}
      </section>

      <section className="admin-form-panel">
        <h4>Skill → Skill Animation Binding</h4>
        <div className="admin-form-grid">
          <label>
            <span>Skill</span>
            <select value={selectedSkillId} onChange={(event) => setSelectedSkillId(event.target.value)}>
              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name} ({skill.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>skillAnimationBindingId</span>
            <select
              value={selectedSkill?.skillAnimationBindingId ?? ''}
              onChange={(event) => selectedSkill && onPatchSkill(selectedSkill.id, { skillAnimationBindingId: event.target.value || undefined })}
            >
              <option value="">Legacy skill visuals only</option>
              {skillBindings
                .filter((binding) => binding.skillId === selectedSkill?.id)
                .map((binding) => (
                  <option key={binding.id} value={binding.id}>
                    {binding.name} ({binding.id})
                  </option>
                ))}
            </select>
          </label>
        </div>
        {selectedSkill ? (
          <p className="muted">
            Legacy icon fallback: {selectedSkill.iconImageRef ? 'imageRef present' : selectedSkill.iconUrl || 'none'}
          </p>
        ) : null}
      </section>
    </div>
  );
}
