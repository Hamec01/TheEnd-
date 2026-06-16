import { useMemo, useState } from 'react';
import type {
  EquipmentVisualBindingDefinition,
  SkillAnimationBindingDefinition,
  SpriteProfileDefinition,
} from '@theend/rpg-domain';
import type { AdminItem, AdminNpc, AdminSkill } from '../../services/content/models';
import { GameImageView } from '../components/GameImageView';
import {
  buildSpriteStudioSelectionWarning,
  classifySpriteStudioAsset,
  describeSpriteStudioAssetKind,
} from './spriteStudioAssetKinds';

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
  const selectedNpcReferenceKind = useMemo(
    () => classifySpriteStudioAsset({
      imageRef: selectedNpc?.portraitImageRef ?? selectedNpc?.combatImageRef ?? selectedNpc?.iconImageRef,
      legacyImagePath: selectedNpc?.portraitUrl ?? selectedNpc?.combatImageUrl ?? selectedNpc?.iconUrl,
      label: selectedNpc?.name,
    }),
    [selectedNpc],
  );
  const selectedItemReferenceKind = useMemo(
    () => classifySpriteStudioAsset({
      imageRef: selectedItem?.imageRef,
      legacyImagePath: selectedItem?.imagePath,
      label: selectedItem?.name,
    }),
    [selectedItem],
  );

  const unboundNpcCount = npcs.filter((entry) => !entry.spriteProfileId).length;
  const unboundItemCount = items.filter((entry) => !entry.defaultEquipmentVisualBindingId).length;
  const unboundSkillCount = skills.filter((entry) => !entry.skillAnimationBindingId).length;

  return (
    <div className="admin-editor-page" style={{ display: 'grid', gap: 16 }}>
      <section className="card admin-item-preview">
        <h4>Soft links</h4>
        <p className="muted">
          NPC without `spriteProfileId`, item without `defaultEquipmentVisualBindingId`, and skill without
          `skillAnimationBindingId` still keep their legacy fallback behavior. This panel only adds the new links safely.
        </p>
        <p className="muted">
          NPCs without sprite profile: {unboundNpcCount} · Items without visual binding: {unboundItemCount} · Skills without animation binding: {unboundSkillCount}
        </p>
      </section>

      <section className="admin-form-panel">
        <h4>NPC {'->'} Sprite Profile</h4>
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
          <div style={{ display: 'grid', gap: 10 }}>
            <p className="muted" style={{ margin: 0 }}>
              Current legacy portrait fallback: {formatLegacyVisualValue(
                selectedNpc.portraitImageRef
                || selectedNpc.portraitUrl
                || selectedNpc.combatImageRef
                || selectedNpc.combatImageUrl
                || selectedNpc.iconImageRef
                || selectedNpc.iconUrl,
              )}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <GameImageView
                imageRef={selectedNpc.portraitImageRef ?? selectedNpc.combatImageRef ?? selectedNpc.iconImageRef}
                legacyImagePath={selectedNpc.portraitUrl ?? selectedNpc.combatImageUrl ?? selectedNpc.iconUrl}
                alt={`${selectedNpc.name} reference`}
                size={64}
                fallbackText="N/A"
              />
              <div style={{ display: 'grid', gap: 6 }}>
                <strong>Game reference image</strong>
                <span className="muted">{describeSpriteStudioAssetKind(selectedNpcReferenceKind)}</span>
                <span style={{ color: '#f0d6a4' }}>Reference only</span>
              </div>
            </div>
            {!selectedNpc.spriteProfileId && (selectedNpc.portraitImageRef || selectedNpc.portraitUrl || selectedNpc.combatImageRef || selectedNpc.combatImageUrl) ? (
              <p style={{ margin: 0, color: '#ffb6b6' }}>
                This NPC has a portrait, but no Sprite Studio visual profile yet. Create or link sprite profile.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="admin-form-panel">
        <h4>Item {'->'} Default Equipment Visual Binding</h4>
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
          <div style={{ display: 'grid', gap: 10 }}>
            <p className="muted" style={{ margin: 0 }}>
              Legacy image fallback: {selectedItem.imageRef ? 'imageRef present' : selectedItem.imagePath || 'none'} · Slot: {selectedItem.slot || 'none'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <GameImageView
                imageRef={selectedItem.imageRef}
                legacyImagePath={selectedItem.imagePath}
                alt={`${selectedItem.name} icon`}
                size={64}
                fallbackText="N/A"
              />
              <div style={{ display: 'grid', gap: 6 }}>
                <strong>Item UI icon</strong>
                <span className="muted">{describeSpriteStudioAssetKind(selectedItemReferenceKind)}</span>
                <span style={{ color: '#f0d6a4' }}>Reference only</span>
              </div>
            </div>
            {!selectedItem.defaultEquipmentVisualBindingId && (selectedItem.imageRef || selectedItem.imagePath) ? (
              <p style={{ margin: 0, color: '#ffb6b6' }}>
                This item has an inventory icon, but no equipped visual sprite binding.
              </p>
            ) : null}
            {buildSpriteStudioSelectionWarning(selectedItemReferenceKind) ? (
              <p className="muted" style={{ margin: 0 }}>
                Equipped appearance should come from `defaultEquipmentVisualBindingId`, not from the item icon itself.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="admin-form-panel">
        <h4>Skill {'->'} Skill Animation Binding</h4>
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
