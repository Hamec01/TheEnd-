import { useEffect, useMemo, useState } from 'react';
import type { InventoryState } from '@theend/rpg-domain';
import type {
  BlacksmithCustomForgePlan,
  BlacksmithItemTemplate,
  Material,
  MaterialCraftingRole,
  StoredImage,
} from '../../services/content/models';
import { normalizeGameImageRef } from '../../services/content/gameImageRefs';
import { GameImageView } from '../../admin/components/GameImageView';
import { getFallbackBlacksmithItemTemplates } from '../../services/content/runtimeContentService';
import {
  calculateCustomForgeDifficultyV2,
  normalizeMaterialCraftingRoles,
  normalizeMaterialLikeId,
  readPlayerMaterialQuantities,
} from './blacksmithRecipeMaterials';

interface BlacksmithCustomForgeTabProps {
  templates: BlacksmithItemTemplate[];
  materials: Material[];
  runtimeImages: StoredImage[];
  inventory: InventoryState;
  inventoryRevision: number;
  blacksmithLevel: number;
  initialTemplateId?: string | null;
  onPreparePlan: (payload: { template: BlacksmithItemTemplate; plan: BlacksmithCustomForgePlan }) => void;
}

interface MaterialOption {
  id: string;
  name: string;
  quantity: number;
  roles: MaterialCraftingRole[];
  imageRef?: ReturnType<typeof normalizeGameImageRef>;
  legacyImagePath?: string;
}

interface SlotSelectionRow {
  rowId: string;
  materialId: string;
  quantity: number;
}

const ROLE_GUIDES: Partial<Record<MaterialCraftingRole, { title: string; text: string; tips: string[] }>> = {
  main_metal: {
    title: 'Несущий металл',
    text: 'Даёт основу предмета. Здесь лучше смешивать металлы ради урона, брони и общей массы заготовки.',
    tips: ['Слитки и основной металл сильнее влияют на базовые статы.', 'Смеси повышают потенциал, но заметно поднимают сложность.'],
  },
  ingot: {
    title: 'Слиток для формы',
    text: 'Главный источник корпуса предмета. Чем чище и сильнее слиток, тем лучше база.',
    tips: ['Подходит для чистого урона или брони.', 'Можно класть несколько разных слитков ради сплава.'],
  },
  alloy_component: {
    title: 'Компонент сплава',
    text: 'Добавляет акцент: огонь, магию, прочность, проводимость или гибкость.',
    tips: ['Хорош для редких добавок.', 'Лучше использовать как усилитель, а не как единственную основу.'],
  },
  handle: {
    title: 'Хват и баланс',
    text: 'Влияет на контроль, посадку в руке и комфорт оружия.',
    tips: ['Дерево, кожа и кость помогают балансу.', 'Экзотика возможна, но риск дефектов выше.'],
  },
  wood: {
    title: 'Древесная база',
    text: 'Подходит для древка, рукояти и лёгких несущих частей.',
    tips: ['Дает гибкость и баланс.', 'Слишком тяжёлые добавки утяжеляют вещь.'],
  },
  leather: {
    title: 'Обмотка и подгонка',
    text: 'Смягчает хват, стабилизирует посадку и повышает контроль.',
    tips: ['Хороша для рукоятей и креплений.', 'Можно использовать редкие шкуры для особых свойств.'],
  },
  cloth: {
    title: 'Мягкая фиксация',
    text: 'Даёт лёгкость и аккуратную стяжку.',
    tips: ['Полезна для обмотки и подкладки.', 'Лучше в поддерживающих слотах.'],
  },
  quench_liquid: {
    title: 'Закалка',
    text: 'Финально меняет характер металла: жёсткость, чистоту кромки и устойчивость.',
    tips: ['Вода делает охлаждение резким.', 'Масла и эссенции дают мягче, но тоньше настройку.'],
  },
  oil: {
    title: 'Масляная среда',
    text: 'Подходит для мягкой закалки и деликатной доводки.',
    tips: ['Помогает редким сплавам.', 'Хороша, когда не хочется хрупкой кромки.'],
  },
  essence: {
    title: 'Катализатор',
    text: 'Добавляет редкие свойства: стихии, магию, нестандартные эффекты.',
    tips: ['Лучше в малых дозах.', 'Экзотические смеси резко повышают риск.'],
  },
  crystal: {
    title: 'Кристалл-усилитель',
    text: 'Подходит для магической проводимости и фокусировки свойств.',
    tips: ['Полезен в оружии с магическим акцентом.', 'Слишком много кристаллов усложняет ковку.'],
  },
};

function createPlanId(templateId: string): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
    : `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  return `custom_plan_${templateId}_${suffix}`;
}

function createSelectionRow(quantity = 1): SlotSelectionRow {
  const rowId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  return { rowId, materialId: '', quantity: Math.max(1, Math.floor(quantity || 1)) };
}

function describeRole(role: MaterialCraftingRole): { title: string; text: string; tips: string[] } {
  return ROLE_GUIDES[role] ?? {
    title: 'Свободный материал',
    text: 'Этот слот можно использовать для экспериментов, но лучше подбирать материалы по их ремесленной роли.',
    tips: ['Смотрите на свойства материала и на предупреждения ниже.', 'Чем экзотичнее смесь, тем выше риск брака.'],
  };
}

function formatRoleLabel(role: MaterialCraftingRole): string {
  return role.replace(/_/g, ' ');
}

export function BlacksmithCustomForgeTab({
  templates,
  materials,
  runtimeImages,
  inventory,
  inventoryRevision,
  blacksmithLevel,
  initialTemplateId,
  onPreparePlan,
}: BlacksmithCustomForgeTabProps) {
  const effectiveTemplates = useMemo(
    () => (templates.length > 0 ? templates : getFallbackBlacksmithItemTemplates()),
    [templates],
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(initialTemplateId ?? effectiveTemplates[0]?.id ?? null);
  const [selectedRowsBySlotId, setSelectedRowsBySlotId] = useState<Record<string, SlotSelectionRow[]>>({});
  const [customName, setCustomName] = useState('');
  const [openHelpSlotId, setOpenHelpSlotId] = useState<string | null>(null);

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
        roles: normalizeMaterialCraftingRoles(entry),
        imageRef: normalizeGameImageRef(entry.imageRef, entry.imagePath ?? entry.id) ?? undefined,
        legacyImagePath: entry.imagePath ?? entry.id,
      });
    }
    return next.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'ru'));
  }, [inventory, inventoryRevision, materials]);

  const materialById = useMemo(() => new Map(availableMaterials.map((entry) => [entry.id, entry])), [availableMaterials]);
  const templateById = useMemo(() => new Map(effectiveTemplates.map((entry) => [entry.id, entry])), [effectiveTemplates]);
  const selectedTemplate = selectedTemplateId ? templateById.get(selectedTemplateId) ?? null : null;
  const allSlots = useMemo(
    () => (selectedTemplate ? [...(selectedTemplate.requiredRoles ?? []), ...(selectedTemplate.optionalRoles ?? [])] : []),
    [selectedTemplate],
  );

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }
    const next: Record<string, SlotSelectionRow[]> = {};
    for (const slot of allSlots) {
      const currentRows = selectedRowsBySlotId[slot.id]?.filter(Boolean) ?? [];
      if (currentRows.length > 0) {
        next[slot.id] = currentRows.map((row) => ({
          ...row,
          quantity: Math.max(1, Math.floor(row.quantity || slot.quantity || 1)),
        }));
      } else if (slot.required) {
        next[slot.id] = [createSelectionRow(slot.quantity)];
      }
    }
    setSelectedRowsBySlotId(next);
    setOpenHelpSlotId((current) => (current && next[current] ? current : null));
  }, [selectedTemplateId]);

  const flattenedSelections = useMemo(
    () => allSlots.flatMap((slot) => (selectedRowsBySlotId[slot.id] ?? []).map((row) => ({ slotId: slot.id, ...row }))),
    [allSlots, selectedRowsBySlotId],
  );

  const selectedQuantityByMaterialId = useMemo(() => {
    const next = new Map<string, number>();
    for (const row of flattenedSelections) {
      if (!row.materialId) {
        continue;
      }
      next.set(row.materialId, (next.get(row.materialId) ?? 0) + Math.max(1, Math.floor(row.quantity || 1)));
    }
    return next;
  }, [flattenedSelections]);

  const overAllocatedMaterials = useMemo(
    () => availableMaterials.filter((material) => (selectedQuantityByMaterialId.get(material.id) ?? 0) > material.quantity),
    [availableMaterials, selectedQuantityByMaterialId],
  );

  const currentPlan = useMemo<BlacksmithCustomForgePlan | null>(() => {
    if (!selectedTemplate) {
      return null;
    }
    const selectedMaterials = flattenedSelections
      .filter((row) => row.materialId)
      .map((row) => ({
        slotId: row.slotId,
        materialId: row.materialId,
        quantity: Math.max(1, Math.floor(row.quantity || 1)),
      }));

    const difficulty = calculateCustomForgeDifficultyV2(
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
  }, [customName, flattenedSelections, materials, selectedTemplate]);

  const difficulty = useMemo(
    () => (selectedTemplate && currentPlan ? calculateCustomForgeDifficultyV2(currentPlan, materials, selectedTemplate) : null),
    [currentPlan, materials, selectedTemplate],
  );

  const missingRequiredSlot = useMemo(() => {
    if (!selectedTemplate) {
      return null;
    }
    return (selectedTemplate.requiredRoles ?? []).find((slot) => {
      const rows = selectedRowsBySlotId[slot.id] ?? [];
      return !rows.some((row) => row.materialId);
    }) ?? null;
  }, [selectedRowsBySlotId, selectedTemplate]);

  const levelGap = selectedTemplate ? Math.max(0, (selectedTemplate.requiredBlacksmithLevel ?? 1) - blacksmithLevel) : 0;

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
            <div className="blacksmith-custom-template-meta">
              <div>
                <span>Уровень кузнеца</span>
                <strong>{blacksmithLevel}</strong>
              </div>
              <div>
                <span>Порог шаблона</span>
                <strong>{selectedTemplate.requiredBlacksmithLevel ?? 1}</strong>
              </div>
              <div>
                <span>Бонус мастера</span>
                <strong>{selectedTemplate.itemType === 'weapon' ? `+${Math.floor(blacksmithLevel / 3)} урона` : `+${Math.floor(blacksmithLevel / 2)} защиты`}</strong>
              </div>
            </div>
            {levelGap > 0 ? (
              <p className="blacksmith-custom-inline-warning">
                До комфортной ковки не хватает {levelGap} ур. кузнеца. Ковать можно, но риск и брак будут ощущаться сильнее.
              </p>
            ) : null}
          </article>
        ) : null}

        <label className="blacksmith-custom-field">
          <span>Имя предмета</span>
          <input
            value={customName}
            maxLength={64}
            placeholder={selectedTemplate ? `Например: ${selectedTemplate.name} Буревал` : 'Название будущего предмета'}
            onChange={(event) => setCustomName(event.target.value)}
          />
        </label>
      </section>

      <section className="blacksmith-custom-column blacksmith-custom-column-slots">
        {selectedTemplate ? (
          <div className="blacksmith-custom-slots">
            {allSlots.map((slot) => {
              const guide = describeRole(slot.role);
              const rows = selectedRowsBySlotId[slot.id] ?? [];
              const recommendedMaterials = availableMaterials.filter((material) => material.roles.includes(slot.role)).slice(0, 4);
              return (
                <article key={slot.id} className="blacksmith-custom-slot-card">
                  <div className="blacksmith-custom-slot-head">
                    <div>
                      <strong>{slot.label}</strong>
                      <p className="wm-stat-hint" style={{ margin: 0 }}>
                        {slot.required ? 'обязательный слот' : 'опциональный слот'} · базовый объём {slot.quantity}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="blacksmith-custom-help-button"
                      onClick={() => setOpenHelpSlotId((current) => (current === slot.id ? null : slot.id))}
                      aria-label={`Подсказка для слота ${slot.label}`}
                    >
                      [?]
                    </button>
                  </div>

                  <div className="blacksmith-custom-slot-badges">
                    <span className="blacksmith-custom-slot-role">{guide.title}</span>
                    <span className="blacksmith-custom-slot-role-muted">{formatRoleLabel(slot.role)}</span>
                  </div>

                  {openHelpSlotId === slot.id ? (
                    <div className="blacksmith-custom-slot-help">
                      <p>{guide.text}</p>
                      <div className="blacksmith-custom-help-tips">
                        {guide.tips.map((tip) => (
                          <span key={tip}>{tip}</span>
                        ))}
                      </div>
                      {recommendedMaterials.length > 0 ? (
                        <div className="blacksmith-custom-help-recommended">
                          <strong>Под рукой сейчас подходят:</strong>
                          <div className="blacksmith-custom-help-materials">
                            {recommendedMaterials.map((material) => (
                              <span key={`${slot.id}:${material.id}`}>{material.name} x{material.quantity}</span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="wm-stat-hint" style={{ margin: 0 }}>
                          В инвентаре пока нет идеального материала под эту роль. Можно экспериментировать с любым доступным.
                        </p>
                      )}
                    </div>
                  ) : null}

                  <div className="blacksmith-custom-slot-rows">
                    {rows.length === 0 ? (
                      <div className="blacksmith-custom-empty-slot">Слот пуст. Добавьте материал или соберите рискованную смесь.</div>
                    ) : rows.map((row) => {
                      const selectedMaterial = row.materialId ? materialById.get(row.materialId) ?? null : null;
                      const isRecommended = Boolean(selectedMaterial?.roles.includes(slot.role));
                      return (
                        <div key={row.rowId} className="blacksmith-custom-slot-row">
                          <select
                            value={row.materialId}
                            onChange={(event) => {
                              const value = event.target.value;
                              setSelectedRowsBySlotId((current) => ({
                                ...current,
                                [slot.id]: (current[slot.id] ?? []).map((entry) => (
                                  entry.rowId === row.rowId ? { ...entry, materialId: value } : entry
                                )),
                              }));
                            }}
                          >
                            <option value="">Не выбрано</option>
                            {availableMaterials.map((material) => (
                              <option key={`${slot.id}:${row.rowId}:${material.id}`} value={material.id}>
                                {material.name} x{material.quantity}
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={row.quantity}
                            onChange={(event) => {
                              const nextQuantity = Math.max(1, Math.floor(Number(event.target.value) || 1));
                              setSelectedRowsBySlotId((current) => ({
                                ...current,
                                [slot.id]: (current[slot.id] ?? []).map((entry) => (
                                  entry.rowId === row.rowId ? { ...entry, quantity: nextQuantity } : entry
                                )),
                              }));
                            }}
                          />

                          <button
                            type="button"
                            className="blacksmith-custom-remove-button"
                            onClick={() => {
                              setSelectedRowsBySlotId((current) => ({
                                ...current,
                                [slot.id]: (current[slot.id] ?? []).filter((entry) => entry.rowId !== row.rowId),
                              }));
                            }}
                            aria-label={`Убрать материал из слота ${slot.label}`}
                          >
                            ×
                          </button>

                          {selectedMaterial ? (
                            <div className={`blacksmith-custom-row-fit ${isRecommended ? 'is-good' : 'is-risky'}`}>
                              {isRecommended ? 'Подходит по роли' : 'Экспериментальная подача'}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="blacksmith-custom-slot-actions">
                    <button
                      type="button"
                      className="blacksmith-custom-add-button"
                      onClick={() => {
                        setSelectedRowsBySlotId((current) => ({
                          ...current,
                          [slot.id]: [...(current[slot.id] ?? []), createSelectionRow(slot.quantity)],
                        }));
                      }}
                    >
                      + Добавить материал
                    </button>
                    <span className="wm-stat-hint">
                      Можно смешивать сколько угодно компонентов. Чем больше слоёв, тем тяжелее ковка.
                    </span>
                  </div>
                </article>
              );
            })}
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
              <div><span>Тир смеси</span><strong>{difficulty.materialTier}</strong></div>
            </div>
          ) : (
            <p className="wm-stat-hint">Выберите шаблон и материалы.</p>
          )}

          <div className="blacksmith-custom-stock-grid">
            <div>
              <span>Материалов в схеме</span>
              <strong>{flattenedSelections.filter((row) => row.materialId).length}</strong>
            </div>
            <div>
              <span>Всего единиц</span>
              <strong>{Array.from(selectedQuantityByMaterialId.values()).reduce((sum, value) => sum + value, 0)}</strong>
            </div>
          </div>

          {overAllocatedMaterials.length > 0 ? (
            <div className="blacksmith-custom-overdraft">
              <strong>Не хватает в инвентаре</strong>
              {overAllocatedMaterials.map((material) => (
                <p key={material.id} className="wm-stat-hint" style={{ margin: 0 }}>
                  {material.name}: нужно {selectedQuantityByMaterialId.get(material.id)}, есть {material.quantity}
                </p>
              ))}
            </div>
          ) : null}

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
            disabled={!selectedTemplate || !currentPlan || Boolean(missingRequiredSlot) || overAllocatedMaterials.length > 0}
            onClick={() => {
              if (!selectedTemplate || !currentPlan) {
                return;
              }
              onPreparePlan({ template: selectedTemplate, plan: currentPlan });
            }}
          >
            {missingRequiredSlot
              ? `Не заполнен слот: ${missingRequiredSlot.label}`
              : overAllocatedMaterials.length > 0
                ? 'Не хватает материалов'
                : 'Подготовить свободную ковку'}
          </button>
        </article>
      </section>

      <style>{`
        .blacksmith-custom-layout {
          display: grid;
          grid-template-columns: minmax(280px, 0.95fr) minmax(420px, 1.6fr) minmax(250px, 0.95fr);
          gap: 14px;
          align-items: start;
        }
        .blacksmith-custom-column {
          display: grid;
          gap: 12px;
          min-width: 0;
        }
        .blacksmith-custom-column-slots {
          align-self: stretch;
        }
        .blacksmith-custom-field {
          display: grid;
          gap: 6px;
        }
        .blacksmith-custom-field span {
          font-size: 0.82rem;
          color: #d7c3a2;
        }
        .blacksmith-custom-field select,
        .blacksmith-custom-field input {
          width: 100%;
        }
        .blacksmith-custom-template-card,
        .blacksmith-custom-summary-card,
        .blacksmith-custom-slot-card {
          border: 1px solid rgba(177, 142, 88, 0.28);
          border-radius: 14px;
          background:
            radial-gradient(circle at top, rgba(104, 62, 28, 0.24), transparent 56%),
            linear-gradient(180deg, rgba(31, 22, 16, 0.96), rgba(19, 14, 11, 0.94));
          box-shadow: inset 0 1px 0 rgba(255, 224, 168, 0.05), 0 14px 28px rgba(0, 0, 0, 0.22);
          padding: 12px;
          display: grid;
          gap: 10px;
        }
        .blacksmith-custom-template-head,
        .blacksmith-custom-slot-head {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
        }
        .blacksmith-custom-template-meta,
        .blacksmith-custom-stock-grid,
        .blacksmith-custom-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .blacksmith-custom-template-meta > div,
        .blacksmith-custom-stock-grid > div,
        .blacksmith-custom-summary-grid > div {
          border: 1px solid rgba(179, 145, 95, 0.16);
          border-radius: 10px;
          padding: 8px 10px;
          display: grid;
          gap: 4px;
          background: rgba(255, 237, 214, 0.02);
        }
        .blacksmith-custom-template-meta span,
        .blacksmith-custom-stock-grid span,
        .blacksmith-custom-summary-grid span {
          font-size: 0.73rem;
          color: #bda685;
        }
        .blacksmith-custom-inline-warning,
        .blacksmith-custom-overdraft {
          border: 1px solid rgba(196, 124, 89, 0.34);
          border-radius: 10px;
          background: rgba(89, 38, 22, 0.36);
          color: #f0d0bb;
          padding: 9px 10px;
          margin: 0;
        }
        .blacksmith-custom-slots {
          display: grid;
          gap: 10px;
        }
        .blacksmith-custom-slot-badges,
        .blacksmith-custom-help-tips,
        .blacksmith-custom-help-materials {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .blacksmith-custom-slot-role,
        .blacksmith-custom-slot-role-muted,
        .blacksmith-custom-help-tips span,
        .blacksmith-custom-help-materials span {
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 0.72rem;
          line-height: 1.2;
        }
        .blacksmith-custom-slot-role {
          background: rgba(176, 128, 61, 0.2);
          color: #f4d8ab;
          border: 1px solid rgba(199, 159, 92, 0.28);
        }
        .blacksmith-custom-slot-role-muted,
        .blacksmith-custom-help-tips span,
        .blacksmith-custom-help-materials span {
          background: rgba(255, 240, 220, 0.04);
          color: #c9b498;
          border: 1px solid rgba(179, 145, 95, 0.16);
        }
        .blacksmith-custom-help-button,
        .blacksmith-custom-remove-button,
        .blacksmith-custom-add-button {
          appearance: none;
          border: 1px solid rgba(191, 154, 101, 0.28);
          border-radius: 10px;
          background: rgba(255, 241, 220, 0.04);
          color: #f0dbc0;
          cursor: pointer;
        }
        .blacksmith-custom-help-button {
          min-width: 40px;
          padding: 6px 8px;
          font-weight: 700;
        }
        .blacksmith-custom-add-button {
          padding: 8px 12px;
          font-weight: 600;
        }
        .blacksmith-custom-remove-button {
          width: 38px;
          height: 38px;
          font-size: 1.1rem;
        }
        .blacksmith-custom-slot-help {
          display: grid;
          gap: 8px;
          border: 1px solid rgba(179, 145, 95, 0.18);
          border-radius: 12px;
          padding: 10px;
          background: rgba(255, 245, 232, 0.03);
        }
        .blacksmith-custom-slot-help p {
          margin: 0;
          color: #d8c1a0;
          font-size: 0.82rem;
        }
        .blacksmith-custom-help-recommended {
          display: grid;
          gap: 6px;
        }
        .blacksmith-custom-help-recommended strong {
          font-size: 0.76rem;
          color: #f1d8b0;
        }
        .blacksmith-custom-slot-rows {
          display: grid;
          gap: 8px;
        }
        .blacksmith-custom-slot-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 88px 40px;
          gap: 8px;
          align-items: center;
        }
        .blacksmith-custom-slot-row select,
        .blacksmith-custom-slot-row input {
          width: 100%;
        }
        .blacksmith-custom-row-fit {
          grid-column: 1 / -1;
          font-size: 0.75rem;
          border-radius: 10px;
          padding: 6px 8px;
        }
        .blacksmith-custom-row-fit.is-good {
          background: rgba(58, 97, 58, 0.22);
          color: #cfe8c7;
          border: 1px solid rgba(103, 163, 102, 0.25);
        }
        .blacksmith-custom-row-fit.is-risky {
          background: rgba(103, 55, 38, 0.26);
          color: #f0c6b4;
          border: 1px solid rgba(184, 106, 76, 0.22);
        }
        .blacksmith-custom-slot-actions {
          display: grid;
          gap: 8px;
        }
        .blacksmith-custom-empty-slot {
          border: 1px dashed rgba(179, 145, 95, 0.2);
          border-radius: 10px;
          padding: 10px;
          color: #b79e7b;
          font-size: 0.8rem;
        }
        .blacksmith-custom-warnings {
          display: grid;
          gap: 6px;
          border-top: 1px solid rgba(179, 145, 95, 0.12);
          padding-top: 8px;
        }
        @media (max-width: 1320px) {
          .blacksmith-custom-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
