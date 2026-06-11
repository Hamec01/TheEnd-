import type { ItemInstance } from '../../services/content/models';

const CARPENTER_COMPONENT_KIND_LABELS: Record<string, string> = {
  raw_log: 'Сырое бревно',
  clean_log: 'Чистое бревно',
  split_log: 'Расколотое бревно',
  plank: 'Доска',
  thin_plank: 'Тонкая доска',
  planed_plank: 'Строганая доска',
  polished_plank: 'Полированная доска',
  beam: 'Балка',
  support_beam: 'Опорная балка',
  wood_panel: 'Деревянная панель',
  wood_strip: 'Деревянная рейка',
  wooden_pin: 'Деревянный штифт',
  wooden_rivet: 'Деревянная заклёпка',
  wooden_wedge: 'Деревянный клин',
  charcoal: 'Древесный уголь',
  bark_strip: 'Полоса коры',
  treated_bark: 'Обработанная кора',
  resin: 'Смола',
  wood_glue: 'Столярная смола',
  generic_handle: 'Простая рукоять',
  sword_handle: 'Рукоять меча',
  dagger_handle: 'Рукоять кинжала',
  axe_haft: 'Топорище',
  hammer_handle: 'Рукоять молота',
  mace_handle: 'Рукоять булавы',
  spear_shaft: 'Древко копья',
  javelin_shaft: 'Древко метательного копья',
  polearm_shaft: 'Древко древкового оружия',
  halberd_shaft: 'Древко алебарды',
  staff_core: 'Основа посоха',
  wand_core: 'Основа жезла',
  ritual_staff_core: 'Ритуальная основа посоха',
  rune_staff_core: 'Основа посоха под руны',
  bow_stave: 'Заготовка лука',
  bow_limb: 'Плечо лука',
  bow_grip: 'Рукоять лука',
  simple_bow_body: 'Основа простого лука',
  hunting_bow_body: 'Основа охотничьего лука',
  war_bow_body: 'Основа боевого лука',
  longbow_body: 'Основа длинного лука',
  composite_bow_core: 'Основа составного лука',
  crossbow_stock: 'Ложе арбалета',
  crossbow_body: 'Корпус арбалета',
  crossbow_channel: 'Направляющая арбалета',
  crossbow_grip: 'Рукоять арбалета',
  crossbow_reinforced_stock: 'Усиленное ложе арбалета',
  arrow_shaft: 'Древко стрелы',
  arrow_shaft_bundle: 'Древки стрел',
  bolt_shaft: 'Древко болта',
  bolt_shaft_bundle: 'Древки болтов',
  training_arrow: 'Учебная стрела',
  hunting_arrow: 'Охотничья стрела',
  war_arrow: 'Боевая стрела',
  training_bolt: 'Учебный болт',
  war_bolt: 'Боевой болт',
  shield_core_round: 'Круглая щитовая основа',
  shield_core_kite: 'Каплевидная щитовая основа',
  shield_core_tower: 'Основа башенного щита',
  shield_board: 'Щитовая доска',
  shield_frame: 'Каркас щита',
  shield_grip: 'Рукоять щита',
  chair_frame: 'Каркас стула',
  table_frame: 'Каркас стола',
  bed_frame: 'Каркас кровати',
  shelf_frame: 'Каркас полки',
  chest_body: 'Корпус сундука',
  wardrobe_body: 'Корпус шкафа',
  weapon_rack: 'Стойка для оружия',
  armor_stand: 'Стойка для брони',
  training_dummy: 'Тренировочный манекен',
  door_panel: 'Дверная панель',
  ladder_part: 'Часть лестницы',
  cart_wheel: 'Колесо телеги',
  barrel_body: 'Корпус бочки',
  ship_plank: 'Корабельная доска',
  rune_wood_plate: 'Деревянная пластина под руны',
  ritual_board: 'Ритуальная доска',
  alchemy_shelf: 'Алхимическая полка',
  enchanting_frame: 'Рама для зачарования',
  magic_focus_frame: 'Рама магического фокуса',
  totem_core: 'Основа тотема',
  shamanic_frame: 'Шаманский каркас',
};

const WOOD_TRAIT_TAG_LABELS: Record<string, string> = {
  hard: 'твёрдая',
  dense: 'плотная',
  flexible: 'гибкая',
  lightweight: 'лёгкая',
  brittle: 'хрупкая',
  elastic: 'упругая',
  cold_resistant: 'холодостойкая',
  heat_resistant: 'жаростойкая',
  fire_affinity: 'огненная связь',
  water_affinity: 'водная связь',
  earth_affinity: 'земляная связь',
  air_affinity: 'воздушная связь',
  light_affinity: 'светлая связь',
  dark_affinity: 'тёмная связь',
  life_affinity: 'связь с жизнью',
  nature_affinity: 'природная связь',
  mana_conductive: 'проводит ману',
  rune_friendly: 'пригодна для рун',
  ritual_wood: 'ритуальная древесина',
  forbidden_wood: 'запретная древесина',
  volatile: 'нестабильная',
  resinous: 'смолистая',
  dry: 'сухая',
  wet: 'влажная',
  luxury: 'роскошная',
  building_grade: 'строительная',
  weapon_grade: 'оружейная',
  bow_grade: 'лучная',
  staff_grade: 'посоховая',
  shield_grade: 'щитовая',
  furniture_grade: 'мебельная',
};

function toFallbackLabel(value?: string | null): string {
  return String(value ?? '').trim().replace(/_/g, ' ');
}

export function formatCarpenterComponentKind(kind?: string): string {
  const normalized = String(kind ?? '').trim();
  if (!normalized) {
    return '—';
  }
  return CARPENTER_COMPONENT_KIND_LABELS[normalized] ?? toFallbackLabel(normalized);
}

export function formatSourceTreeLabel(params: {
  sourceTreeId?: string | null;
  sourceTreeName?: string | null;
  sourceLost?: boolean | null;
  sourceLostReason?: string | null;
}): {
  label: string;
  warning?: string;
  isLost: boolean;
} {
  if (params.sourceLost) {
    return {
      label: 'Обычная древесина / происхождение потеряно',
      warning: params.sourceLostReason?.trim() || 'Происхождение древесины потеряно.',
      isLost: true,
    };
  }

  const treeName = String(params.sourceTreeName ?? '').trim();
  if (treeName) {
    return { label: treeName, isLost: false };
  }

  const treeId = String(params.sourceTreeId ?? '').trim();
  if (treeId) {
    return { label: treeId, isLost: false };
  }

  return { label: 'Источник неизвестен', isLost: false };
}

export function formatQualityBand(score?: number | null): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return '—';
  }
  if (score <= 24) return 'Грубое';
  if (score <= 49) return 'Обычное';
  if (score <= 74) return 'Хорошее';
  if (score <= 89) return 'Отличное';
  return 'Мастерское';
}

export function formatWoodTraitTag(tag?: string | null): string {
  const normalized = String(tag ?? '').trim();
  if (!normalized) {
    return '—';
  }
  return WOOD_TRAIT_TAG_LABELS[normalized] ?? toFallbackLabel(normalized);
}

type CarpenterMetadataSource = Pick<ItemInstance, 'carpenterComponent' | 'carpenterComponentsUsed'>;

export function hasCarpenterMetadata(instance?: CarpenterMetadataSource | null): boolean {
  return Boolean(instance?.carpenterComponent || (instance?.carpenterComponentsUsed?.length ?? 0) > 0);
}

export function getInventoryCardCarpenterBadge(instance?: ItemInstance | CarpenterMetadataSource | null): string | null {
  if (!instance) {
    return null;
  }

  if (instance.carpenterComponent) {
    const source = formatSourceTreeLabel(instance.carpenterComponent);
    return source.isLost ? 'Компонент плотника' : `Компонент плотника · ${source.label}`;
  }

  const used = instance.carpenterComponentsUsed?.[0];
  if (used) {
    const source = formatSourceTreeLabel(used);
    return source.isLost ? 'Компоненты плотника в составе' : `Дерево: ${source.label}`;
  }

  return null;
}
