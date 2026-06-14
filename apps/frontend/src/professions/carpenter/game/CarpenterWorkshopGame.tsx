import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { InventoryState } from '@theend/rpg-domain';
import { getContentSnapshot } from '../../../services/content/contentApi';
import type { AdminItem, CarpenterCraftedComponentSnapshot } from '../../../services/content/models';
import { getCarpenterToolDurability, resolveProfessionToolTemplateId } from '../../../services/carpenterToolInstances';
import { getPlayerItemInstanceByItemId } from '../../../services/playerItemInstances';
import { getProfessionId, getProfessionItemKind, getProfessionStats, getToolKind } from '../../../services/professionItemModule';
import {
  buildCarpenterComponentPreview,
  getEligibleInventoryItemsForCarpenterSlot,
  type CarpenterCraftInputSelection,
} from '../carpenterComponentCrafting';
import {
  resolveCarpenterStationRequiredToolKinds,
  resolveCarpenterTemplateGroup,
  validateCarpenterMiniGameAccess,
} from '../carpenterTemplateAccess';
import { commitCarpenterWorkshopSuccess, consumeCarpenterWorkshopInputs } from './carpenterWorkshopGameCommit';
import { buildCarpenterCraftGameInput, mapCarpenterCraftGameResult } from './carpenterCraftMiniGameAdapter';
import { buildCarpenterWorkshopRunConfig } from './carpenterWorkshopGameBalance';
import { CarpenterCraftGame } from './craftMiniGame/CarpenterCraftGame';
import type { CarpenterGameInput, CarpenterGameResult } from './craftMiniGame/carpenterGameTypes';
import type {
  CarpenterWorkshopGameContent,
  CarpenterWorkshopGameLaunchParams,
  CarpenterWorkshopGamePhase,
  CarpenterWorkshopMaterialOption,
  CarpenterWorkshopResolvedSelections,
  CarpenterWorkshopResult,
  CarpenterWorkshopRiskLevel,
  CarpenterWorkshopRunConfig,
  CarpenterWorkshopStageResult,
  CarpenterWorkshopToolOption,
} from './carpenterWorkshopGame.types';

interface CarpenterWorkshopGameProps {
  launch: CarpenterWorkshopGameLaunchParams;
  onClose: () => void;
  onInventoryChange: (next: InventoryState) => void;
  onStatus: (text: string) => void;
}

interface ActiveAttemptState {
  templateId: string;
  inputSelections: CarpenterCraftInputSelection[];
  toolInventoryItemId?: string | null;
  inventoryAfterConsume: InventoryState;
  runConfig: CarpenterWorkshopRunConfig;
  craftGameInput: CarpenterGameInput;
}

function getFailReasonText(reason?: string): string {
  if (reason === 'integrity') return 'Заготовка не выдержала нагрузки.';
  if (reason === 'mistakes') return 'Слишком много ошибок во время работы.';
  if (reason === 'timeout') return 'Темп был сорван, и работа развалилась.';
  if (reason === 'cancelled') return 'Работа прервана.';
  if (reason === 'material_broken') return 'Материал сломан во время работы.';
  if (reason === 'too_many_mistakes') return 'Слишком много ошибок: материал потерян.';
  return 'Работа сорвалась.';
}

function getReadableItemName(item: AdminItem | undefined, fallbackId: string): string {
  return item?.name?.trim() || fallbackId;
}

function getRiskLabel(risk: CarpenterWorkshopRiskLevel): string {
  if (risk === 'steady') return 'Осторожно';
  if (risk === 'reckless') return 'Рискованно';
  return 'Сбалансировано';
}

function getResultGradeLabel(grade?: CarpenterWorkshopStageResult['resultGrade']): string {
  if (!grade) return 'Без ранга';
  if (grade === 'broken') return 'Сломано';
  if (grade === 'poor') return 'Плохо';
  if (grade === 'common') return 'Обычно';
  if (grade === 'good') return 'Хорошо';
  if (grade === 'excellent') return 'Отлично';
  if (grade === 'masterwork') return 'Мастерски';
  if (grade === 'masterpiece') return 'Шедевр';
  return grade;
}

const baseCardStyle: CSSProperties = {
  padding: 12,
  display: 'grid',
  gap: 10,
  background: 'rgba(27, 18, 11, 0.82)',
  border: '1px solid rgba(181, 132, 72, 0.38)',
  borderRadius: 10,
};

const selectStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  background: '#140d07',
  color: '#f0e0c0',
  border: '1px solid #5a4630',
};

export function CarpenterWorkshopGame(props: CarpenterWorkshopGameProps) {
  const { launch, onClose, onInventoryChange, onStatus } = props;

  const [content, setContent] = useState<CarpenterWorkshopGameContent | null>(null);
  const [phase, setPhase] = useState<CarpenterWorkshopGamePhase>('prep');
  const [localInventory, setLocalInventory] = useState<InventoryState>(launch.inventory);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(launch.initialTemplateId ?? null);
  const [selectedToolItemId, setSelectedToolItemId] = useState<string | null>(null);
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<CarpenterWorkshopRiskLevel>('balanced');
  const [selectedMaterialsBySlotId, setSelectedMaterialsBySlotId] = useState<Record<string, string>>({});
  const [uiStatusText, setUiStatusText] = useState<string>('Загружается мастерская плотника...');
  const [result, setResult] = useState<CarpenterWorkshopResult | null>(null);
  const [lastStageResult, setLastStageResult] = useState<CarpenterWorkshopStageResult | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<ActiveAttemptState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getContentSnapshot()
      .then((snapshot) => {
        if (cancelled) {
          return;
        }
        setContent({
          items: snapshot.items ?? [],
          materials: snapshot.materials ?? [],
          trees: snapshot.trees ?? [],
          templates: (snapshot.carpenterItemTemplates ?? []).filter((entry) => entry.isEnabled !== false),
        });
        setUiStatusText('');
      })
      .catch((error) => {
        console.error(error);
        setUiStatusText(`Не удалось загрузить workshop content: ${(error as Error).message}`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const inheritedByItemId = useMemo(() => {
    const map = new Map<string, CarpenterCraftedComponentSnapshot>();
    for (const entry of localInventory.items) {
      const instance = getPlayerItemInstanceByItemId(entry.itemId);
      if (instance?.carpenterComponent) {
        map.set(entry.itemId, instance.carpenterComponent);
      }
    }
    return map;
  }, [localInventory.items]);

  const candidateTemplates = useMemo(() => {
    if (!content) {
      return [];
    }
    const allowedStations = new Set((launch.workshop.stationTypes ?? []).map((entry) => String(entry).trim()).filter(Boolean));
    const activeStation = String(launch.activeStationType ?? '').trim();
    return content.templates.filter((template) => {
      if (activeStation) {
        return template.stationType === activeStation;
      }
      return allowedStations.size === 0 || allowedStations.has(String(template.stationType ?? '').trim());
    });
  }, [content, launch.activeStationType, launch.workshop.stationTypes]);

  useEffect(() => {
    if (!selectedTemplateId && candidateTemplates[0]) {
      setSelectedTemplateId(candidateTemplates[0].id);
      return;
    }
    if (selectedTemplateId && !candidateTemplates.some((entry) => entry.id === selectedTemplateId)) {
      setSelectedTemplateId(candidateTemplates[0]?.id ?? null);
    }
  }, [candidateTemplates, selectedTemplateId]);

  const templateOptions = useMemo(() => {
    return candidateTemplates.map((template) => {
      const access = validateCarpenterMiniGameAccess({
        characterId: launch.characterId,
        template,
        activeWorkshop: launch.workshop,
        activeStationType: launch.activeStationType,
        learnedSkillIds: launch.learnedSkillIds,
        skillNameById: launch.skillNameById,
        skipMaterialCheck: true,
        skipToolCheck: true,
      });
      return {
        template,
        lockedReason: access.allowed ? undefined : access.reason,
      };
    });
  }, [candidateTemplates, launch.activeStationType, launch.characterId, launch.learnedSkillIds, launch.skillNameById, launch.workshop]);

  const selectedTemplate = useMemo(
    () => candidateTemplates.find((entry) => entry.id === selectedTemplateId) ?? null,
    [candidateTemplates, selectedTemplateId],
  );

  const materialOptionsBySlotId = useMemo(() => {
    if (!content || !selectedTemplate) {
      return new Map<string, CarpenterWorkshopMaterialOption[]>();
    }
    return new Map(
      selectedTemplate.inputSlots.map((slot) => {
        const options = getEligibleInventoryItemsForCarpenterSlot({
          slot,
          inventoryItems: localInventory.items,
          contentItems: content.items,
          inheritedFromComponent: inheritedByItemId,
        }).map((entry) => ({
          itemId: entry.itemId,
          label: entry.itemName,
          quantity: entry.quantity,
          componentKind: entry.componentKind,
        }));
        return [slot.id, options];
      }),
    );
  }, [content, inheritedByItemId, localInventory.items, selectedTemplate]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }
    setSelectedMaterialsBySlotId((current) => {
      const next = { ...current };
      let changed = false;
      for (const slot of selectedTemplate.inputSlots) {
        const options = materialOptionsBySlotId.get(slot.id) ?? [];
        const currentValue = String(current[slot.id] ?? '').trim();
        if (options.some((entry) => entry.itemId === currentValue)) {
          continue;
        }
        const replacement = options[0]?.itemId ?? '';
        if (replacement) {
          next[slot.id] = replacement;
        } else {
          delete next[slot.id];
        }
        changed = true;
      }
      return changed ? next : current;
    });
  }, [materialOptionsBySlotId, selectedTemplate]);

  const toolOptions = useMemo(() => {
    if (!content || !selectedTemplate) {
      return [] as CarpenterWorkshopToolOption[];
    }
    const requiredToolKinds = new Set(resolveCarpenterStationRequiredToolKinds(selectedTemplate.stationType));
    const options: CarpenterWorkshopToolOption[] = [];
    for (const inventoryEntry of localInventory.items) {
      if (inventoryEntry.quantity <= 0) {
        continue;
      }
      const templateItemId = resolveProfessionToolTemplateId(inventoryEntry.itemId, launch.characterId);
      const adminItem = content.items.find((entry) => entry.id === templateItemId);
      if (!adminItem) {
        continue;
      }
      if (getProfessionId(adminItem) !== 'carpenter' || getProfessionItemKind(adminItem) !== 'tool') {
        continue;
      }
      const toolKind = String(getToolKind(adminItem) ?? '').trim();
      const stats = getProfessionStats(adminItem);
      options.push({
        inventoryItemId: inventoryEntry.itemId,
        templateItemId,
        item: adminItem,
        name: adminItem.name?.trim() || templateItemId,
        toolKind,
        tier: Math.max(1, Math.floor(Number(stats.tier ?? 1) || 1)),
        efficiency: Number.isFinite(Number(stats.efficiency)) ? Number(stats.efficiency) : 1,
        durability: getCarpenterToolDurability(
          inventoryEntry.itemId,
          launch.characterId,
          Math.max(1, Math.floor(Number(stats.maxDurability ?? stats.durability ?? 1) || 1)),
        ),
        maxDurability: Math.max(1, Math.floor(Number(stats.maxDurability ?? stats.durability ?? 1) || 1)),
      });
    }
    return options.sort((left, right) => {
      const leftPriority = requiredToolKinds.has(left.toolKind) ? 0 : 1;
      const rightPriority = requiredToolKinds.has(right.toolKind) ? 0 : 1;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return left.name.localeCompare(right.name, 'ru');
    });
  }, [content, launch.characterId, localInventory.items, selectedTemplate]);

  useEffect(() => {
    if (!toolOptions.some((entry) => entry.inventoryItemId === selectedToolItemId)) {
      setSelectedToolItemId(toolOptions[0]?.inventoryItemId ?? null);
    }
  }, [selectedToolItemId, toolOptions]);

  const selectedTool = useMemo(
    () => toolOptions.find((entry) => entry.inventoryItemId === selectedToolItemId) ?? null,
    [selectedToolItemId, toolOptions],
  );

  const inputSelections = useMemo(() => {
    if (!selectedTemplate) {
      return [] as CarpenterCraftInputSelection[];
    }
    return selectedTemplate.inputSlots
      .map((slot) => ({
        slotId: slot.id,
        itemId: selectedMaterialsBySlotId[slot.id] ?? '',
        quantity: Math.max(1, slot.quantity ?? 1),
      }))
      .filter((entry) => Boolean(entry.itemId));
  }, [selectedMaterialsBySlotId, selectedTemplate]);

  const strictAccess = useMemo(() => {
    if (!selectedTemplate) {
      return null;
    }
    return validateCarpenterMiniGameAccess({
      characterId: launch.characterId,
      template: selectedTemplate,
      activeWorkshop: launch.workshop,
      activeStationType: launch.activeStationType,
      learnedSkillIds: launch.learnedSkillIds,
      skillNameById: launch.skillNameById,
      selectedMaterialItemIds: inputSelections.map((entry) => entry.itemId),
      selectedTool: selectedTool?.item ?? null,
      selectedToolDurability: selectedTool?.durability ?? null,
    });
  }, [inputSelections, launch.activeStationType, launch.characterId, launch.learnedSkillIds, launch.skillNameById, launch.workshop, selectedTemplate, selectedTool]);

  const preview = useMemo(() => {
    if (!content || !selectedTemplate) {
      return null;
    }
    return buildCarpenterComponentPreview({
      template: selectedTemplate,
      inputSelections,
      inventoryItems: localInventory,
      content: {
        items: content.items,
        materials: content.materials,
        trees: content.trees,
      },
      carpenterLevel: launch.carpenterLevel,
      inheritedFromComponent: inheritedByItemId,
      learnedSkillIds: launch.learnedSkillIds,
      skillNameById: launch.skillNameById,
      activeWorkshop: launch.workshop,
      activeStationType: launch.activeStationType,
    });
  }, [content, inheritedByItemId, inputSelections, launch.activeStationType, launch.carpenterLevel, launch.learnedSkillIds, launch.skillNameById, launch.workshop, localInventory, selectedTemplate]);

  const resolvedSelections = useMemo<CarpenterWorkshopResolvedSelections | null>(() => {
    if (!selectedTemplate) {
      return null;
    }
    return {
      template: selectedTemplate,
      inputSelections,
      tool: selectedTool,
    };
  }, [inputSelections, selectedTemplate, selectedTool]);

  async function handleStartWork() {
    if (!content || !resolvedSelections) {
      setUiStatusText('Workshop content ещё загружается.');
      return;
    }
    const access = strictAccess;
    if (!access?.allowed) {
      const reason = access?.reason ?? 'Mini-game пока недоступна.';
      setUiStatusText(reason);
      onStatus(reason);
      return;
    }

    const runConfig = buildCarpenterWorkshopRunConfig({
      template: resolvedSelections.template,
      riskLevel: selectedRiskLevel,
      carpenterLevel: launch.carpenterLevel,
      tool: resolvedSelections.tool,
    });
    runConfig.workshopId = launch.workshop.id;

    const selectedMaterialNames = resolvedSelections.inputSelections.map((selection) => {
      const slot = resolvedSelections.template.inputSlots.find((entry) => entry.id === selection.slotId);
      const option = materialOptionsBySlotId.get(selection.slotId)?.find((entry) => entry.itemId === selection.itemId);
      const contentItem = content.items.find((entry) => entry.id === selection.itemId);
      const label = option?.label?.trim() || getReadableItemName(contentItem, selection.itemId);
      return `${slot?.label ? `${slot.label}: ` : ''}${label} x${selection.quantity}`;
    });
    const primaryMaterialId = resolvedSelections.inputSelections[0]?.itemId ?? resolvedSelections.template.id;
    const primaryToolId = resolvedSelections.tool?.inventoryItemId ?? resolvedSelections.tool?.templateItemId ?? 'carpenter_hands';
    const craftGameInput = buildCarpenterCraftGameInput({
      config: runConfig,
      materialId: primaryMaterialId,
      materialName: selectedMaterialNames.join(', ') || primaryMaterialId,
      toolId: primaryToolId,
      toolName: resolvedSelections.tool?.name ?? 'Руки мастера',
      workshop: launch.workshop,
    });

    const consumed = await consumeCarpenterWorkshopInputs({
      characterId: launch.characterId,
      template: resolvedSelections.template,
      inputSelections: resolvedSelections.inputSelections,
      inventory: localInventory,
    });
    if (!consumed.ok || !consumed.inventory) {
      const text = consumed.errors.join(' ') || 'Не удалось списать материалы.';
      setUiStatusText(text);
      onStatus(text);
      return;
    }

    setLocalInventory(consumed.inventory);
    onInventoryChange(consumed.inventory);
    setActiveAttempt({
      templateId: resolvedSelections.template.id,
      inputSelections: resolvedSelections.inputSelections,
      toolInventoryItemId: resolvedSelections.tool?.inventoryItemId ?? null,
      inventoryAfterConsume: consumed.inventory,
      runConfig,
      craftGameInput,
    });
    setLastStageResult(null);
    setPhase('work');
    setUiStatusText('Материал закреплён. Работа началась.');
    onStatus(`Материал списан для ${resolvedSelections.template.name}. Начинаем обработку.`);
  }

  async function handleWorkFinished(workResult: CarpenterWorkshopStageResult) {
    if (!content || !activeAttempt) {
      return;
    }
    setLastStageResult(workResult);
    const template = content.templates.find((entry) => entry.id === activeAttempt.templateId) ?? selectedTemplate;
    if (!template) {
      return;
    }

    if (!workResult.success) {
      const failText = getFailReasonText(workResult.reason);
      const failedResult: CarpenterWorkshopResult = {
        success: false,
        templateId: template.id,
        templateName: template.name,
        workshopId: launch.workshop.id,
        stationType: template.stationType,
        qualityScore: workResult.qualityScore,
        lostMaterials: true,
        reason: failText,
      };
      setResult(failedResult);
      setPhase('result');
      setUiStatusText(failText);
      onStatus(`${failText} Материал потерян.`);
      return;
    }

    const tool = toolOptions.find((entry) => entry.inventoryItemId === activeAttempt.toolInventoryItemId) ?? selectedTool;
    const access = validateCarpenterMiniGameAccess({
      characterId: launch.characterId,
      template,
      activeWorkshop: launch.workshop,
      activeStationType: launch.activeStationType,
      learnedSkillIds: launch.learnedSkillIds,
      skillNameById: launch.skillNameById,
      selectedMaterialItemIds: activeAttempt.inputSelections.map((entry) => entry.itemId),
      selectedTool: tool?.item ?? null,
      selectedToolDurability: tool?.durability ?? null,
    });
    if (!access.allowed) {
      const failedResult: CarpenterWorkshopResult = {
        success: false,
        templateId: template.id,
        templateName: template.name,
        workshopId: launch.workshop.id,
        stationType: template.stationType,
        qualityScore: workResult.qualityScore,
        lostMaterials: true,
        reason: access.reason ?? 'Доступ к мастерской был потерян.',
      };
      setResult(failedResult);
      setPhase('result');
      setUiStatusText(failedResult.reason ?? '');
      onStatus(failedResult.reason ?? 'Доступ к мастерской был потерян.');
      return;
    }

    const committed = await commitCarpenterWorkshopSuccess({
      characterId: launch.characterId,
      template,
      inputSelections: activeAttempt.inputSelections,
      inventoryAfterConsume: activeAttempt.inventoryAfterConsume,
      content: {
        items: content.items,
        materials: content.materials,
        trees: content.trees,
      },
      carpenterLevel: launch.carpenterLevel,
      inheritedFromComponent: inheritedByItemId,
      qualityScore: workResult.qualityScore,
    });

    if (!committed.ok || !committed.inventory) {
      const text = committed.errors.join(' ') || 'Не удалось завершить работу в мастерской.';
      const failedResult: CarpenterWorkshopResult = {
        success: false,
        templateId: template.id,
        templateName: template.name,
        workshopId: launch.workshop.id,
        stationType: template.stationType,
        qualityScore: workResult.qualityScore,
        lostMaterials: true,
        reason: text,
      };
      setResult(failedResult);
      setPhase('result');
      setUiStatusText(text);
      onStatus(text);
      return;
    }

    setLocalInventory(committed.inventory);
    onInventoryChange(committed.inventory);
    const successResult: CarpenterWorkshopResult = {
      success: true,
      templateId: template.id,
      templateName: template.name,
      workshopId: launch.workshop.id,
      stationType: template.stationType,
      qualityScore: workResult.qualityScore,
      lostMaterials: true,
      createdItemId: committed.createdItemId,
      createdItemName: committed.createdItemName,
      snapshot: committed.snapshot,
    };
    setResult(successResult);
    setPhase('result');
    setUiStatusText(`Создано: ${committed.createdItemName}. Качество ${workResult.qualityScore}/100.`);
    onStatus(`Мастерская плотника: создано ${committed.createdItemName} (${workResult.qualityScore}/100).`);
  }

  function handleCraftGameComplete(craftResult: CarpenterGameResult) {
    void handleWorkFinished(mapCarpenterCraftGameResult(craftResult));
  }

  function handleCraftGameCancel(craftResult: CarpenterGameResult) {
    void handleWorkFinished(mapCarpenterCraftGameResult({
      ...craftResult,
      success: false,
      reason: 'cancelled',
    }));
  }

  function handleClose() {
    if (phase === 'work' && activeAttempt) {
      const text = 'Работа прервана. Материал уже потерян.';
      setUiStatusText(text);
      onStatus(text);
    }
    onClose();
  }

  function handleRetry() {
    setPhase('prep');
    setResult(null);
    setLastStageResult(null);
    setActiveAttempt(null);
    setUiStatusText('');
  }

  return (
    <div
      className="battle-overlay"
      role="dialog"
      aria-modal="true"
      style={{ zIndex: 10020 }}
    >
      <section
        className="card battle-window wm-modal"
        style={{
          maxWidth: phase === 'work' ? 1320 : 1100,
          width: phase === 'work' ? 'min(1320px, 96vw)' : 'min(1100px, 96vw)',
          padding: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div className="battle-window-head">
          <h2>Мастерская плотника</h2>
          <button type="button" onClick={handleClose}>Г—</button>
        </div>

        {phase === 'work' && activeAttempt ? (
          <CarpenterCraftGame
            key={`${activeAttempt.templateId}:${activeAttempt.craftGameInput.materialId}:${activeAttempt.craftGameInput.toolId}`}
            config={activeAttempt.craftGameInput}
            onComplete={handleCraftGameComplete}
            onCancel={handleCraftGameCancel}
          />
        ) : null}

        {phase === 'prep' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)', gap: 16 }}>
            <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <div style={baseCardStyle}>
                <strong>{launch.workshop.name}</strong>
                <div style={{ color: '#c9b38c' }}>{launch.workshop.description?.trim() || 'Рабочая мастерская без описания.'}</div>
                <div>Станок: {launch.activeStationType?.trim() || 'Общий вход'}</div>
                <div>Tier мастерской: {launch.workshop.tier ?? 1}</div>
                <div>Доступных шаблонов: {templateOptions.length}</div>
              </div>

              <div style={baseCardStyle}>
                <strong>Шаблоны</strong>
                <div style={{ display: 'grid', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
                  {templateOptions.map(({ template, lockedReason }) => {
                    const isSelected = template.id === selectedTemplateId;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setUiStatusText('');
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: isSelected ? '1px solid #c58b3a' : '1px solid #5a4630',
                          background: isSelected ? 'rgba(197,139,58,0.14)' : 'rgba(30,20,12,0.65)',
                          color: '#f0e0c0',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{template.name}</div>
                        <div style={{ fontSize: 12, color: '#c9b38c' }}>
                          {resolveCarpenterTemplateGroup(template) || 'Без группы'} · {template.stationType || 'station?'}
                        </div>
                        {lockedReason ? <div style={{ marginTop: 4, fontSize: 12, color: '#ff9b7a' }}>{lockedReason}</div> : null}
                      </button>
                    );
                  })}
                  {templateOptions.length === 0 ? (
                    <div style={{ color: '#ffb08c' }}>Нет шаблонов для текущей мастерской или станка.</div>
                  ) : null}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <div style={baseCardStyle}>
                <strong>{selectedTemplate?.name || 'Шаблон не выбран'}</strong>
                <div style={{ color: '#c9b38c' }}>{selectedTemplate?.description?.trim() || 'Выберите шаблон для начала работы.'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                  <div>Группа: {selectedTemplate ? resolveCarpenterTemplateGroup(selectedTemplate) || 'Без группы' : '—'}</div>
                  <div>Станция: {selectedTemplate?.stationType || '—'}</div>
                  <div>Сложность: {selectedTemplate?.difficulty ?? '—'}</div>
                  <div>Треб. tier мастерской: {selectedTemplate?.requiredWorkshopTier ?? 1}</div>
                </div>
                {strictAccess && !strictAccess.allowed ? <div style={{ color: '#ff9b7a' }}>{strictAccess.reason}</div> : null}
              </div>

              <div style={baseCardStyle}>
                <strong>Материалы</strong>
                {(selectedTemplate?.inputSlots ?? []).map((slot) => {
                  const options = materialOptionsBySlotId.get(slot.id) ?? [];
                  return (
                    <label key={slot.id} style={{ display: 'grid', gap: 6 }}>
                      <span>{slot.label} x{Math.max(1, slot.quantity ?? 1)}</span>
                      <select
                        value={selectedMaterialsBySlotId[slot.id] ?? ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSelectedMaterialsBySlotId((current) => ({ ...current, [slot.id]: value }));
                          setUiStatusText('');
                        }}
                        style={selectStyle}
                      >
                        {options.map((option) => (
                          <option key={option.itemId} value={option.itemId}>
                            {option.label} x{option.quantity}
                          </option>
                        ))}
                        {options.length === 0 ? <option value="">Нет подходящих материалов</option> : null}
                      </select>
                    </label>
                  );
                })}
              </div>

              <div style={baseCardStyle}>
                <strong>Инструмент и риск</strong>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Инструмент</span>
                  <select
                    value={selectedToolItemId ?? ''}
                    onChange={(event) => {
                      setSelectedToolItemId(event.target.value || null);
                      setUiStatusText('');
                    }}
                    style={selectStyle}
                  >
                    {toolOptions.map((tool) => (
                      <option key={tool.inventoryItemId} value={tool.inventoryItemId}>
                        {tool.name} · {tool.toolKind || 'tool'} · tier {tool.tier} · прочность {tool.durability}/{tool.maxDurability}
                      </option>
                    ))}
                    {toolOptions.length === 0 ? <option value="">Нет подходящего инструмента</option> : null}
                  </select>
                </label>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(['steady', 'balanced', 'reckless'] as CarpenterWorkshopRiskLevel[]).map((risk) => (
                    <button
                      key={risk}
                      type="button"
                      onClick={() => {
                        setSelectedRiskLevel(risk);
                        setUiStatusText('');
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: selectedRiskLevel === risk ? '1px solid #c58b3a' : '1px solid #5a4630',
                        background: selectedRiskLevel === risk ? 'rgba(197,139,58,0.14)' : 'rgba(30,20,12,0.65)',
                        color: '#f0e0c0',
                        cursor: 'pointer',
                      }}
                    >
                      {getRiskLabel(risk)}
                    </button>
                  ))}
                </div>

                {preview ? (
                  <div style={{ color: '#c9b38c' }}>
                    Превью: {preview.outputName} · качество {preview.qualityScore}/100 · сохранение свойств {preview.traitRetentionPercent}%
                  </div>
                ) : null}

                {uiStatusText ? <div style={{ color: '#ffcf92' }}>{uiStatusText}</div> : null}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => void handleStartWork()}>
                    Начать работу
                  </button>
                  <button type="button" onClick={handleClose}>
                    Выйти
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {phase === 'result' && result ? (
          <div style={baseCardStyle}>
            <strong>{result.success ? 'Работа завершена' : 'Работа сорвалась'}</strong>
            <div>Шаблон: {result.templateName}</div>
            <div>Станция: {result.stationType}</div>
            <div>Качество: {result.qualityScore}/100</div>
            <div>Материал: {result.lostMaterials ? 'потрачен' : 'сохранён'}</div>
            {activeAttempt ? <div>Риск: {getRiskLabel(activeAttempt.runConfig.riskLevel)}</div> : null}
            {lastStageResult ? (
              <div>
                Ранг: {getResultGradeLabel(lastStageResult.resultGrade)} · ошибок: {lastStageResult.mistakes} · прогресс: {lastStageResult.completedSteps}/{lastStageResult.totalSteps}
              </div>
            ) : null}
            {result.success ? (
              <div>Создано: {result.createdItemName || result.createdItemId || 'предмет'}</div>
            ) : (
              <div style={{ color: '#ff9b7a' }}>{result.reason || 'Работа завершилась неудачей.'}</div>
            )}
            {activeAttempt ? (
              <div style={{ color: '#c9b38c' }}>
                Базовая сложность: {activeAttempt.runConfig.baseDifficulty} · базовый риск: {activeAttempt.runConfig.baseRisk}
              </div>
            ) : null}
            {uiStatusText ? <div style={{ color: '#ffcf92' }}>{uiStatusText}</div> : null}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={handleRetry}>
                Повторить
              </button>
              <button type="button" onClick={handleClose}>
                Закрыть
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
