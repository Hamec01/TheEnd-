import Phaser from 'phaser';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  canUseCarpenterTemplateInWorkshop,
  resolveCarpenterStationRequiredToolKinds,
  resolveCarpenterTemplateGroup,
  validateCarpenterMiniGameAccess,
} from '../carpenterTemplateAccess';
import { commitCarpenterWorkshopSuccess, consumeCarpenterWorkshopInputs } from './carpenterWorkshopGameCommit';
import { CARPENTER_WORKSHOP_GAME_HEIGHT, CARPENTER_WORKSHOP_GAME_WIDTH } from './carpenterWorkshopGameAssets';
import { buildCarpenterWorkshopRunConfig } from './carpenterWorkshopGameBalance';
import { CarpenterWorkshopScene } from './CarpenterWorkshopScene';
import type {
  CarpenterWorkshopGameContent,
  CarpenterWorkshopGameLaunchParams,
  CarpenterWorkshopGamePhase,
  CarpenterWorkshopMaterialOption,
  CarpenterWorkshopResolvedSelections,
  CarpenterWorkshopResult,
  CarpenterWorkshopRiskLevel,
  CarpenterWorkshopSceneSnapshot,
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
}

function getFailReasonText(reason?: string): string {
  if (reason === 'integrity') {
    return 'Заготовка не выдержала нагрузки.';
  }
  if (reason === 'mistakes') {
    return 'Слишком много ошибок во время работы.';
  }
  if (reason === 'timeout') {
    return 'Темп был сорван, и работа развалилась.';
  }
  if (reason === 'cancelled') {
    return 'Работа прервана.';
  }
  return 'Работа сорвалась.';
}

export function CarpenterWorkshopGame(props: CarpenterWorkshopGameProps) {
  const { launch, onClose, onInventoryChange, onStatus } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<CarpenterWorkshopScene | null>(null);

  const [content, setContent] = useState<CarpenterWorkshopGameContent | null>(null);
  const [phase, setPhase] = useState<CarpenterWorkshopGamePhase>('prep');
  const [localInventory, setLocalInventory] = useState<InventoryState>(launch.inventory);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(launch.initialTemplateId ?? null);
  const [selectedToolItemId, setSelectedToolItemId] = useState<string | null>(null);
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<CarpenterWorkshopRiskLevel>('balanced');
  const [selectedMaterialsBySlotId, setSelectedMaterialsBySlotId] = useState<Record<string, string>>({});
  const [uiStatusText, setUiStatusText] = useState<string>('Загружается мастерская плотника...');
  const [result, setResult] = useState<CarpenterWorkshopResult | null>(null);
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

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const scene = new CarpenterWorkshopScene();
    sceneRef.current = scene;
    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: CARPENTER_WORKSHOP_GAME_WIDTH,
      height: CARPENTER_WORKSHOP_GAME_HEIGHT,
      parent: hostRef.current,
      scene: [scene],
      backgroundColor: '#17110d',
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
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
        durability: getCarpenterToolDurability(inventoryEntry.itemId, launch.characterId, Math.max(1, Math.floor(Number(stats.maxDurability ?? stats.durability ?? 1) || 1))),
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

  const sceneSnapshot = useMemo<CarpenterWorkshopSceneSnapshot>(() => {
    if (phase === 'result' && result) {
      return {
        phase: 'result',
        statusText: uiStatusText,
        result,
      };
    }
    if (phase === 'work' && activeAttempt && resolvedSelections) {
      const runConfig = buildCarpenterWorkshopRunConfig({
        template: resolvedSelections.template,
        riskLevel: selectedRiskLevel,
        carpenterLevel: launch.carpenterLevel,
        tool: resolvedSelections.tool,
      });
      runConfig.workshopId = launch.workshop.id;
      return {
        phase: 'work',
        statusText: uiStatusText,
        config: runConfig,
      };
    }

    return {
      phase: 'prep',
      statusText: uiStatusText,
      workshopName: launch.workshop.name,
      stationLabel: launch.activeStationType ?? 'общий вход',
      templateOptions,
      selectedTemplateId,
      selectedTemplateDescription: selectedTemplate?.description ?? '',
      selectedTemplateGroup: selectedTemplate ? resolveCarpenterTemplateGroup(selectedTemplate) : '',
      selectedTemplateStation: selectedTemplate?.stationType ?? '',
      materialSlots: (selectedTemplate?.inputSlots ?? []).map((slot) => ({
        slotId: slot.id,
        label: slot.label,
        quantity: slot.quantity,
        options: materialOptionsBySlotId.get(slot.id) ?? [],
        selectedItemId: selectedMaterialsBySlotId[slot.id],
      })),
      toolOptions,
      selectedToolItemId,
      selectedRiskLevel,
      previewText: preview ? `${preview.outputName} · качество ${preview.qualityScore}/100 · сохранение свойств ${preview.traitRetentionPercent}%` : undefined,
      accessReason: strictAccess && !strictAccess.allowed ? strictAccess.reason : selectedTemplate ? undefined : 'Нет шаблонов для текущего станка.',
    };
  }, [
    activeAttempt,
    launch.activeStationType,
    launch.carpenterLevel,
    launch.workshop.id,
    launch.workshop.name,
    materialOptionsBySlotId,
    phase,
    preview,
    resolvedSelections,
    result,
    selectedMaterialsBySlotId,
    selectedRiskLevel,
    selectedTemplate,
    selectedTemplateId,
    selectedToolItemId,
    strictAccess,
    templateOptions,
    toolOptions,
    uiStatusText,
  ]);

  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }
    sceneRef.current.setSnapshot(sceneSnapshot, {
      onPrevTemplate: () => {
        if (templateOptions.length <= 1) {
          return;
        }
        const currentIndex = Math.max(0, templateOptions.findIndex((entry) => entry.template.id === selectedTemplateId));
        const nextIndex = currentIndex <= 0 ? templateOptions.length - 1 : currentIndex - 1;
        setSelectedTemplateId(templateOptions[nextIndex]?.template.id ?? null);
        setUiStatusText('');
      },
      onNextTemplate: () => {
        if (templateOptions.length <= 1) {
          return;
        }
        const currentIndex = Math.max(0, templateOptions.findIndex((entry) => entry.template.id === selectedTemplateId));
        const nextIndex = currentIndex >= templateOptions.length - 1 ? 0 : currentIndex + 1;
        setSelectedTemplateId(templateOptions[nextIndex]?.template.id ?? null);
        setUiStatusText('');
      },
      onCycleMaterial: (slotId, direction) => {
        const options = materialOptionsBySlotId.get(slotId) ?? [];
        if (options.length === 0) {
          return;
        }
        setSelectedMaterialsBySlotId((current) => {
          const currentIndex = Math.max(0, options.findIndex((entry) => entry.itemId === current[slotId]));
          const nextIndex = (currentIndex + direction + options.length) % options.length;
          return {
            ...current,
            [slotId]: options[nextIndex]!.itemId,
          };
        });
        setUiStatusText('');
      },
      onCycleTool: (direction) => {
        if (toolOptions.length === 0) {
          return;
        }
        const currentIndex = Math.max(0, toolOptions.findIndex((entry) => entry.inventoryItemId === selectedToolItemId));
        const nextIndex = (currentIndex + direction + toolOptions.length) % toolOptions.length;
        setSelectedToolItemId(toolOptions[nextIndex]!.inventoryItemId);
        setUiStatusText('');
      },
      onSelectRisk: (risk) => {
        setSelectedRiskLevel(risk);
        setUiStatusText('');
      },
      onStartWork: () => {
        void handleStartWork();
      },
      onClose: () => {
        handleClose();
      },
      onRetry: () => {
        setPhase('prep');
        setResult(null);
        setActiveAttempt(null);
        setUiStatusText('');
      },
      onWorkFinished: (workResult) => {
        void handleWorkFinished(workResult);
      },
    });
  }, [handleClose, materialOptionsBySlotId, sceneSnapshot, selectedTemplateId, selectedToolItemId, templateOptions, toolOptions]);

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
    });
    setPhase('work');
    setUiStatusText('Материал закреплён. Работа началась.');
    onStatus(`Материал списан для ${resolvedSelections.template.name}. Начинаем обработку.`);
  }

  async function handleWorkFinished(workResult: { success: boolean; qualityScore: number; mistakes: number; completedSteps: number; totalSteps: number; maxCombo: number; integrityLeft: number; reason?: 'cancelled' | 'mistakes' | 'integrity' | 'timeout' }) {
    if (!content || !activeAttempt) {
      return;
    }
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
      inventoryAfterConsume: localInventory,
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

  function handleClose() {
    if (phase === 'work' && activeAttempt) {
      const text = 'Работа прервана. Материал уже потерян.';
      setUiStatusText(text);
      onStatus(text);
    }
    onClose();
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
          maxWidth: 980,
          width: 'min(980px, 96vw)',
          padding: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div className="battle-window-head">
          <h2>Carpenter Workshop Game</h2>
          <button type="button" onClick={handleClose}>×</button>
        </div>
        <div
          ref={hostRef}
          style={{
            width: CARPENTER_WORKSHOP_GAME_WIDTH,
            maxWidth: '100%',
            minHeight: CARPENTER_WORKSHOP_GAME_HEIGHT,
            margin: '0 auto',
          }}
        />
      </section>
    </div>
  );
}
