export interface TutorialStepDefinition {
  id: string;
  title: string;
  text: string;
  targetSelector?: string;
}

export interface TutorialDefinition {
  id: string;
  title: string;
  steps: TutorialStepDefinition[];
}

export const TUTORIAL_ARGOS_INTRO_ID = "tutorial_argos_intro";

export const TUTORIAL_DEFINITIONS: Record<string, TutorialDefinition> = {
  [TUTORIAL_ARGOS_INTRO_ID]: {
    id: TUTORIAL_ARGOS_INTRO_ID,
    title: "Первые шаги в Аргосе",
    steps: [
      {
        id: "movement",
        title: "Передвижение",
        text: "Ты находишься в локации. Осматривай доступные места, выбирай персонажей и переходы. На карте мира можно выбирать зоны, города и важные точки.",
        targetSelector: '[data-tutorial="world-surface"]',
      },
      {
        id: "dialogues",
        title: "Диалоги",
        text: "Персонажи могут давать сведения, задания, обучение, торговлю или новые пути. Варианты ответа иногда открывают квесты, меняют отношение NPC или запускают события.",
        targetSelector: '[data-tutorial="world-context-actions"]',
      },
      {
        id: "quest-journal",
        title: "Журнал квестов",
        text: "В журнале хранятся активные, выполненные и проваленные задания. Если у задания есть цель на карте, его можно отслеживать.",
        targetSelector: '[data-tutorial="quest-journal-button"]',
      },
      {
        id: "map-markers",
        title: "Карта и маркеры",
        text: "Маркеры показывают важные цели: города, локации, NPC, зоны осмотра и квестовые места. Если квест отслеживается, игра подскажет направление.",
        targetSelector: '[data-tutorial="mini-map-panel"]',
      },
      {
        id: "character",
        title: "Персонаж",
        text: "Здесь находятся здоровье, мана, выносливость, характеристики, уровень и сведения о твоём происхождении. Королевство влияет на отношение мира к тебе.",
        targetSelector: '[data-tutorial="character-button"]',
      },
      {
        id: "inventory",
        title: "Инвентарь и снаряжение",
        text: "Предметы можно хранить, использовать и надевать в слоты. Оружие, броня и аксессуары меняют боевые параметры. Зелья и расходники помогают выжить.",
        targetSelector: '[data-tutorial="inventory-button"]',
      },
      {
        id: "skills",
        title: "Навыки",
        text: "Навыки можно получить через учителей, квесты, книги или события. Боевые и магические умения можно использовать в бою, если они изучены и готовы.",
        targetSelector: '[data-tutorial="skills-button"]',
      },
      {
        id: "reputation",
        title: "Королевства и репутация",
        text: "Ты начал путь как человек Аргоса. Королевства, фракции и отдельные NPC запоминают поступки. Высокая репутация открывает возможности, низкая — закрывает ворота и может привести к нападению.",
        targetSelector: '[data-tutorial="player-quick-panel"]',
      },
      {
        id: "next-quest",
        title: "Начало пути",
        text: "Бран сказал, что тебя нашли солдаты, похожие на патруль из Ом’тары. Это первый след. Открой журнал квестов и выбери, какое задание отслеживать.",
        targetSelector: '[data-tutorial="quest-journal-button"]',
      },
    ],
  },
};

export function getTutorialDefinition(tutorialId: string | null | undefined): TutorialDefinition | null {
  if (!tutorialId) {
    return null;
  }
  return TUTORIAL_DEFINITIONS[tutorialId] ?? null;
}
