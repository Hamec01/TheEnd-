import { useEffect, useMemo, useState } from 'react';
import type { InventoryState } from '@theend/rpg-domain';
import type {
  BlacksmithCustomForgePlan,
  BlacksmithItemTemplate,
  Material,
  StoredImage,
} from '../../services/content/models';
import { normalizeGameImageRef } from '../../services/content/gameImageRefs';
import { GameImageView } from '../../admin/components/GameImageView';
import { getFallbackBlacksmithItemTemplates } from '../../services/content/runtimeContentService';
import {
  calculateCustomForgeDifficulty,
  normalizeMaterialLikeId,
  readPlayerMaterialQuantities,
} from './blacksmithRecipeMaterials';

interface BlacksmithCustomForgeTabProps {
  templates: BlacksmithItemTemplate[];
  materials: Material[];
  runtimeImages: StoredImage[];
  inventory: InventoryState;
  inventoryRevision: number;
  initialTemplateId?: string | null;
  onPreparePlan: (payload: { template: BlacksmithItemTemplate; plan: BlacksmithCustomForgePlan }) => void;
}

interface MaterialOption {
  id: string;
  name: string;
  quantity: number;
  imageRef?: ReturnType<typeof normalizeGameImageRef>;
  legacyImagePath?: string;
}

function createPlanId(templateId: string): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
    : `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  return `custom_plan_${templateId}_${suffix}`;
}

export function BlacksmithCustomForgeTab({
  templates,
  materials,
  runtimeImages,
  inventory,
  inventoryRevision,
  initialTemplateId,
  onPreparePlan,
}: BlacksmithCustomForgeTabProps) {
  const effectiveTemplates = useMemo(
    () => (templates.length > 0 ? templates : getFallbackBlacksmithItemTemplates()),
    [templates],
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(initialTemplateId ?? effectiveTemplates[0]?.id ?? null);
  const [selectedBySlotId, setSelectedBySlotId] = useState<Record<string, string>>({});
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (!selectedTemplateId && effectiveTemplates[0]?.id) {
      setSelectedTemplateId(effectiveTemplates[0].id);
    }
  }, [effectiveTemplates, selectedTemplateId]);

  const availableMaterials = useMemo<MaterialOption[]>(() => {
    const quantities = readPlayerMaterialQuantities(inventory);
    const next: MaterialOption[] = [];
    for (const entry of materials) {
        const quantity = normalizeMaterialLikeId(entry.id).reduce((max, candidate) => Math.max(max, quantities.get(candidate) ?? 0), 0);
        if (quantity <= 0) {
          continue;
        }
        next.push({
          id: entry.id,
          name: entry.name,
          quantity,
          imageRef: normalizeGameImageRef(entry.imageRef, entry.imagePath ?? entry.id) ?? undefined,
          legacyImagePath: entry.imagePath ?? entry.id,
        });
    }
    return next.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'ru'));
  }, [inventory, inventoryRevision, materials]);

  const templateById = useMemo(() => new Map(effectiveTemplates.map((entry) => [entry.id, entry])), [effectiveTemplates]);
  const selectedTemplate = selectedTemplateId ? templateById.get(selectedTemplateId) ?? null : null;

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }
    const next: Record<string, string> = {};
    const allSlots = [...(selectedTemplate.requiredRoles ?? []), ...(selectedTemplate.optionalRoles ?? [])];
    for (const slot of allSlots) {
      const current = selectedBySlotId[slot.id];
      if (current) {
        next[slot.id] = current;
      }
    }
    setSelectedBySlotId(next);
  }, [selectedTemplateId]);

  const currentPlan = useMemo<BlacksmithCustomForgePlan | null>(() => {
    if (!selectedTemplate) {
      return null;
    }
    const allSlots = [...(selectedTemplate.requiredRoles ?? []), ...(selectedTemplate.optionalRoles ?? [])];
    const selectedMaterials = allSlots
      .map((slot) => {
        const materialId = selectedBySlotId[slot.id];
        if (!materialId) {
          return null;
        }
        return {
          slotId: slot.id,
          materialId,
          quantity: slot.quantity,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const difficulty = calculateCustomForgeDifficulty(
      {
        id: createPlanId(selectedTemplate.id),
        mode: 'custom_forge',
        templateId: selectedTemplate.id,
        selectedMaterials,
        predictedDifficulty: 0,
        predictedRisk: 0,
        predictedPower: 0,
      },
      materials,
      selectedTemplate,
    );

    return {
      id: createPlanId(selectedTemplate.id),
      mode: 'custom_forge',
      templateId: selectedTemplate.id,
      customName: customName.trim() || undefined,
      selectedMaterials,
      predictedDifficulty: difficulty.baseDifficulty,
      predictedRisk: difficulty.risk,
      predictedPower: difficulty.power,
    };
  }, [customName, materials, selectedBySlotId, selectedTemplate]);

  const difficulty = useMemo(
    () => (selectedTemplate && currentPlan ? calculateCustomForgeDifficulty(currentPlan, materials, selectedTemplate) : null),
    [currentPlan, materials, selectedTemplate],
  );

  const missingRequiredSlot = useMemo(() => {
    if (!selectedTemplate) {
      return null;
    }
    return (selectedTemplate.requiredRoles ?? []).find((slot) => !selectedBySlotId[slot.id]) ?? null;
  }, [selectedBySlotId, selectedTemplate]);

  return (
    <div className="blacksmith-custom-layout">
      <section className="blacksmith-custom-column">
        <label className="blacksmith-custom-field">
          <span>Шаблон предмета</span>
          <select
            value={selectedTemplateId ?? ''}
            onChange={(event) => setSelectedTemplateId(event.target.value || null)}
          >
            {effectiveTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · ур. {template.requiredBlacksmithLevel ?? 1}
              </option>
            ))}
          </select>
        </label>

        {selectedTemplate ? (
          <article className="blacksmith-custom-template-card">
            <div className="blacksmith-custom-template-head">
              <div>
                <strong>{selectedTemplate.name}</strong>
                <p className="wm-stat-hint" style={{ margin: 0 }}>
                  {selectedTemplate.itemType === 'weapon' ? 'Оружие' : 'Броня'} · {selectedTemplate.subtype ?? 'универсально'}
                </p>
              </div>
              <GameImageView
                imageRef={selectedTemplate.imageRef}
                runtimeImages={runtimeImages}
                alt={selectedTemplate.name}
                size={72}
                fit="contain"
                fallbackText={(selectedTemplate.name.trim().charAt(0) || 'К').toUpperCase()}
              />
            </div>
            <p className="wm-stat-hint" style={{ margin: 0 }}>
              {selectedTemplate.description || 'Свободная кузнечная форма без привязки к готовому рецепту.'}
            </p>
          </article>
        ) : null}
        <label className="blacksmith-custom-field">
          <span>Имя предмета</span>
          <input
            value={customName}
            maxLength={64}
            placeholder={selectedTemplate ? `Например: ${selectedTemplate.name} Бульвард` : 'Название будущего предмета'}
            onChange={(event) => setCustomName(event.target.value)}
          />
        </label>
      </section>

      <section className="blacksmith-custom-column">
        {selectedTemplate ? (
          <div className="blacksmith-custom-slots">
            {[...(selectedTemplate.requiredRoles ?? []), ...(selectedTemplate.optionalRoles ?? [])].map((slot) => (
              <label key={slot.id} className="blacksmith-custom-field">
                <span>
                  {slot.label} {slot.required ? '*' : '(опционально)'}
                </span>
                <select
                  value={selectedBySlotId[slot.id] ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedBySlotId((current) => ({
                      ...current,
                      [slot.id]: value,
                    }));
                  }}
                >
                  <option value="">Не выбрано</option>
                  {availableMaterials.map((material) => (
                    <option key={`${slot.id}:${material.id}`} value={material.id}>
                      {material.name} ×{material.quantity}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : null}
      </section>

      <section className="blacksmith-custom-column">
        <article className="blacksmith-custom-summary-card">
          <strong>Прогноз ковки</strong>
          {difficulty ? (
            <div className="blacksmith-custom-summary-grid">
              <div><span>Сложность</span><strong>{difficulty.baseDifficulty}</strong></div>
              <div><span>Риск дефекта</span><strong>{difficulty.risk}</strong></div>
              <div><span>Потенциал силы</span><strong>{difficulty.power}</strong></div>
              <div><span>Тир материала</span><strong>{difficulty.materialTier}</strong></div>
            </div>
          ) : (
            <p className="wm-stat-hint">Выберите шаблон и материалы.</p>
          )}

          {difficulty?.warnings?.length ? (
            <div className="blacksmith-custom-warnings">
              {difficulty.warnings.map((warning, index) => (
                <p key={`${warning}-${index}`} className="wm-stat-hint" style={{ margin: 0 }}>
                  {warning}
                </p>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            disabled={!selectedTemplate || !currentPlan || Boolean(missingRequiredSlot)}
            onClick={() => {
              if (!selectedTemplate || !currentPlan) {
                return;
              }
              onPreparePlan({ template: selectedTemplate, plan: currentPlan });
            }}
          >
            {missingRequiredSlot ? `Не заполнен слот: ${missingRequiredSlot.label}` : 'Подготовить свободную ковку'}
          </button>
        </article>
      </section>

      <style>{`
        .blacksmith-custom-layout {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          align-items: start;
        }
        .blacksmith-custom-column {
          display: grid;
          gap: 10px;
          min-width: 0;
        }
        .blacksmith-custom-field {
          display: grid;
          gap: 6px;
        }
        .blacksmith-custom-field span {
          font-size: 0.82rem;
          color: #d7c3a2;
        }
        .blacksmith-custom-field select {
          width: 100%;
        }
        .blacksmith-custom-template-card,
        .blacksmith-custom-summary-card {
          border: 1px solid rgba(164, 141, 110, 0.24);
          border-radius: 10px;
          background: rgba(24, 20, 15, 0.84);
          padding: 10px;
          display: grid;
          gap: 10px;
        }
        .blacksmith-custom-template-head {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }
        .blacksmith-custom-slots {
          display: grid;
          gap: 8px;
        }
        .blacksmith-custom-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .blacksmith-custom-summary-grid > div {
          border: 1px solid rgba(164, 141, 110, 0.18);
          border-radius: 8px;
          padding: 8px;
          display: grid;
          gap: 4px;
        }
        .blacksmith-custom-summary-grid span {
          font-size: 0.74rem;
          color: #bda685;
        }
        .blacksmith-custom-warnings {
          display: grid;
          gap: 4px;
        }
        @media (max-width: 1180px) {
          .blacksmith-custom-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
