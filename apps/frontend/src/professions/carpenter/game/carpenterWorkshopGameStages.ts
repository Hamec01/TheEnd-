import type { CarpenterStationType } from '../../../services/content/models';

export interface CarpenterWorkshopStageDefinition {
  stationType: CarpenterStationType | string;
  title: string;
  instruction: string;
  laneCount: number;
  totalSteps: number;
  stepDurationMs: number;
  cursorSpeed: number;
  targetWidth: number;
  maxMistakes: number;
  integrityStart: number;
}

const DEFAULT_STAGE: CarpenterWorkshopStageDefinition = {
  stationType: 'workbench',
  title: 'Грубая обработка',
  instruction: 'Стрелками выбери линию работы и жми пробел в зелёное окно.',
  laneCount: 3,
  totalSteps: 7,
  stepDurationMs: 2200,
  cursorSpeed: 0.52,
  targetWidth: 0.2,
  maxMistakes: 4,
  integrityStart: 100,
};

const STAGE_BY_STATION: Record<string, CarpenterWorkshopStageDefinition> = {
  sawmill: {
    stationType: 'sawmill',
    title: 'Распил',
    instruction: 'Держи линию реза и бей вовремя, чтобы доску не увело.',
    laneCount: 3,
    totalSteps: 8,
    stepDurationMs: 2100,
    cursorSpeed: 0.62,
    targetWidth: 0.18,
    maxMistakes: 4,
    integrityStart: 100,
  },
  workbench: DEFAULT_STAGE,
  drying_rack: {
    stationType: 'drying_rack',
    title: 'Сушка',
    instruction: 'Следи за трещинами: мягко выравнивай темп и не промахивайся.',
    laneCount: 2,
    totalSteps: 6,
    stepDurationMs: 2500,
    cursorSpeed: 0.44,
    targetWidth: 0.24,
    maxMistakes: 3,
    integrityStart: 95,
  },
  carving_bench: {
    stationType: 'carving_bench',
    title: 'Резьба',
    instruction: 'Точная резьба любит узкое окно: стрелками держи линию, пробелом режь.',
    laneCount: 3,
    totalSteps: 8,
    stepDurationMs: 1900,
    cursorSpeed: 0.68,
    targetWidth: 0.14,
    maxMistakes: 3,
    integrityStart: 92,
  },
  carving_table: {
    stationType: 'carving_table',
    title: 'Резьба',
    instruction: 'Точная резьба любит узкое окно: стрелками держи линию, пробелом режь.',
    laneCount: 3,
    totalSteps: 8,
    stepDurationMs: 1900,
    cursorSpeed: 0.68,
    targetWidth: 0.14,
    maxMistakes: 3,
    integrityStart: 92,
  },
  assembly_table: {
    stationType: 'assembly_table',
    title: 'Сборка',
    instruction: 'Совмещай детали в правильной линии и держи ритм сборки.',
    laneCount: 3,
    totalSteps: 9,
    stepDurationMs: 2000,
    cursorSpeed: 0.58,
    targetWidth: 0.16,
    maxMistakes: 4,
    integrityStart: 96,
  },
  finishing_table: {
    stationType: 'finishing_table',
    title: 'Полировка',
    instruction: 'Не перегрей поверхность: лучше серия точных лёгких движений.',
    laneCount: 2,
    totalSteps: 7,
    stepDurationMs: 1800,
    cursorSpeed: 0.74,
    targetWidth: 0.18,
    maxMistakes: 3,
    integrityStart: 90,
  },
  bowyer_bench: {
    stationType: 'bowyer_bench',
    title: 'Изгиб лука',
    instruction: 'Удерживай напряжение ровно: промахи дают трещины по всей заготовке.',
    laneCount: 3,
    totalSteps: 8,
    stepDurationMs: 1850,
    cursorSpeed: 0.72,
    targetWidth: 0.15,
    maxMistakes: 3,
    integrityStart: 88,
  },
  rune_carving_table: {
    stationType: 'rune_carving_table',
    title: 'Рунная резьба',
    instruction: 'Ритм важнее силы: метки узкие, ошибки быстро рвут заготовку.',
    laneCount: 3,
    totalSteps: 10,
    stepDurationMs: 1700,
    cursorSpeed: 0.82,
    targetWidth: 0.12,
    maxMistakes: 3,
    integrityStart: 84,
  },
};

export function getCarpenterWorkshopStageDefinition(stationType: string | null | undefined): CarpenterWorkshopStageDefinition {
  const normalizedStationType = String(stationType ?? '').trim();
  return STAGE_BY_STATION[normalizedStationType] ?? DEFAULT_STAGE;
}
