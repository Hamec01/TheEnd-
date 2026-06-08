import type {
  DamageCategory,
  ElementType,
  HandsRequired,
  ItemRarity,
  ItemSlot,
  ItemType,
  LootSourceType,
  MagicSchool,
  MaterialCategory,
  MerchantType,
  PhysicalType,
  StatKey,
} from '../services/content/models';

interface AdminFieldLabelProps {
  label: string;
  hint?: string;
}

export function AdminFieldLabel({ label, hint }: AdminFieldLabelProps) {
  return (
    <span className={`admin-field-label${hint ? ' has-hint' : ''}`} title={hint}>
      {label}
      {hint ? <span className="admin-field-help" aria-hidden="true">?</span> : null}
    </span>
  );
}

export function translateItemType(value: ItemType): string {
  switch (value) {
    case 'weapon':
      return 'Оружие';
    case 'armor':
      return 'Броня';
    case 'potion':
      return 'Зелье';
    case 'material':
      return 'Материал';
    case 'quest':
      return 'Квестовый';
    case 'misc':
      return 'Разное';
    case 'profession_tool':
      return 'Инструменты профессий';
    case 'profession_transport':
      return 'Транспорт профессий';
    default:
      return value;
  }
}

export function translateRarity(value: ItemRarity): string {
  switch (value) {
    case 'common':
      return 'Обычный';
    case 'uncommon':
      return 'Необычный';
    case 'rare':
      return 'Редкий';
    case 'epic':
      return 'Эпический';
    case 'legendary':
      return 'Легендарный';
    case 'mythic':
      return 'Мифический';
    case 'forbidden':
      return 'Запретный';
    default:
      return value;
  }
}

export function translateItemSlot(value: ItemSlot): string {
  switch (value) {
    case 'head':
      return 'Голова';
    case 'necklace':
      return 'Шея';
    case 'chest':
      return 'Торс';
    case 'outerwear':
      return 'Плащ';
    case 'belt':
      return 'Пояс';
    case 'leftHand':
      return 'Левая рука';
    case 'rightHand':
      return 'Правая рука';
    case 'gloves':
      return 'Перчатки';
    case 'legs':
      return 'Ноги';
    case 'boots':
      return 'Обувь';
    case 'ring':
      return 'Кольцо';
    case 'trinket':
      return 'Талисман';
    case 'charm':
      return 'Амулет';
    case 'quick':
      return 'Быстрый слот';
    case 'none':
      return 'Не экипируется';
    default:
      return value;
  }
}

export function translateHandsRequired(value: HandsRequired): string {
  switch (value) {
    case 2:
      return 'Двуручное';
    case 1:
    default:
      return 'Одноручное';
  }
}

export function translateDamageCategory(value: DamageCategory): string {
  switch (value) {
    case 'physical':
      return 'Физический';
    case 'elemental':
      return 'Стихийный';
    case 'magic':
      return 'Магический';
    case 'shamanic':
      return 'Шаманский';
    case 'runic':
      return 'Рунический';
    case 'poison':
      return 'Яд';
    case 'bleed':
      return 'Кровотечение';
    case 'true':
      return 'Чистый';
    default:
      return value;
  }
}

export function translatePhysicalType(value: PhysicalType): string {
  switch (value) {
    case 'slash':
      return 'Режущий';
    case 'pierce':
      return 'Колющий';
    case 'blunt':
      return 'Дробящий';
    case 'cleave':
      return 'Рубящий';
    case 'unarmed':
      return 'Без оружия';
    default:
      return value;
  }
}

export function translateElementType(value: ElementType): string {
  switch (value) {
    case 'fire':
      return 'Огонь';
    case 'water':
      return 'Вода';
    case 'earth':
      return 'Земля';
    case 'air':
      return 'Воздух';
    case 'light':
      return 'Свет';
    case 'dark':
      return 'Тьма';
    default:
      return value;
  }
}

export function translateMagicSchool(value: MagicSchool): string {
  switch (value) {
    case 'blood':
      return 'Кровь';
    case 'death':
      return 'Смерть';
    case 'life':
      return 'Жизнь';
    case 'mind':
      return 'Разум';
    case 'illusion':
      return 'Иллюзии';
    case 'curse':
      return 'Проклятия';
    case 'arcane':
      return 'Тайная магия';
    default:
      return value;
  }
}

export function translateMerchantType(value: MerchantType): string {
  switch (value) {
    case 'blacksmith':
      return 'Кузнец';
    case 'alchemist':
      return 'Алхимик';
    case 'general':
      return 'Универсальный';
    case 'rune_master':
      return 'Мастер рун';
    case 'material_trader':
      return 'Скупщик материалов';
    case 'rare_goods':
      return 'Редкие товары';
    case 'other':
      return 'Другое';
    default:
      return value;
  }
}

export function translateMaterialCategory(value: MaterialCategory): string {
  switch (value) {
    case 'metal':
      return 'Металл';
    case 'wood':
      return 'Дерево';
    case 'leather':
      return 'Кожа';
    case 'cloth':
      return 'Ткань';
    case 'herb':
      return 'Трава';
    case 'stone':
      return 'Камень';
    case 'crystal':
      return 'Кристалл';
    case 'bone':
      return 'Кость';
    case 'other':
      return 'Другое';
    default:
      return value;
  }
}

export function translateLootSourceType(value: LootSourceType): string {
  switch (value) {
    case 'npc':
      return 'NPC';
    case 'monster':
      return 'Монстр';
    case 'chest':
      return 'Сундук';
    case 'region':
      return 'Регион';
    case 'quest':
      return 'Квест';
    case 'merchant_special':
      return 'Особый торговец';
    case 'tree':
      return 'Дерево';
    case 'plant':
      return 'Растение';
    case 'beast':
      return 'Животное';
    case 'fish':
      return 'Рыба';
    case 'event':
      return 'Событие';
    case 'resource_node':
      return 'Ресурсная нода';
    default:
      return value;
  }
}

export function translateStatKey(value: StatKey): string {
  switch (value) {
    case 'hp':
      return 'HP';
    case 'mp':
      return 'MP';
    case 'stamina':
      return 'Выносливость';
    case 'strength':
      return 'Сила';
    case 'constitution':
      return 'Телосложение';
    case 'dexterity':
      return 'Ловкость';
    case 'intelligence':
      return 'Интеллект';
    case 'luck':
      return 'Удача';
    case 'perception':
      return 'Восприятие';
    case 'willpower':
      return 'Сила воли';
    default:
      return value;
  }
}

export function translateEnabledState(value: boolean): string {
  return value ? 'включено' : 'выключено';
}

export function translateAdminErrorMessage(message: string): string {
  const normalized = message.trim();

  const exactMap: Record<string, string> = {
    Ready: 'Готово',
    'Invalid password': 'Неверный пароль',
    'Content already exists, seed skipped.': 'Контент уже существует, импорт пропущен.',
    'Material name is required to create linked item.': 'Чтобы создать связанный предмет, сначала заполните название материала.',
  };

  if (exactMap[normalized]) {
    return exactMap[normalized];
  }

  const seededMatch = normalized.match(/^Seeded (\d+) items and (\d+) merchants at (.+)$/);
  if (seededMatch) {
    return `Импортировано ${seededMatch[1]} предметов и ${seededMatch[2]} торговцев (${seededMatch[3]}).`;
  }

  const duplicateItemMatch = normalized.match(/^Duplicate item id: (.+)$/);
  if (duplicateItemMatch) {
    return `Предмет с таким ID уже существует: ${duplicateItemMatch[1]}`;
  }

  const duplicateMerchantMatch = normalized.match(/^Duplicate merchant id: (.+)$/);
  if (duplicateMerchantMatch) {
    return `Торговец с таким ID уже существует: ${duplicateMerchantMatch[1]}`;
  }

  const notFoundMatch = normalized.match(/^(Item|Merchant|Material|Loot table) not found: (.+)$/);
  if (notFoundMatch) {
    const entityLabel = {
      Item: 'Предмет',
      Merchant: 'Торговец',
      Material: 'Материал',
      'Loot table': 'Таблица добычи',
    }[notFoundMatch[1]];
    return `${entityLabel} не найден: ${notFoundMatch[2]}`;
  }

  const chanceMatch = normalized.match(/^entry (.+): chance must be between 0 and 1$/);
  if (chanceMatch) {
    return `Запись ${chanceMatch[1]}: шанс должен быть в диапазоне от 0 до 1.`;
  }

  const minQtyMatch = normalized.match(/^entry (.+): minQuantity must be >= 1$/);
  if (minQtyMatch) {
    return `Запись ${minQtyMatch[1]}: минимальное количество должно быть не меньше 1.`;
  }

  const maxQtyMatch = normalized.match(/^entry (.+): maxQuantity must be >= minQuantity$/);
  if (maxQtyMatch) {
    return `Запись ${maxQtyMatch[1]}: максимальное количество должно быть не меньше минимального.`;
  }

  return normalized
    .replaceAll('id is required', 'нужно заполнить ID')
    .replaceAll('id required', 'нужно заполнить ID')
    .replaceAll('name is required', 'нужно заполнить название')
    .replaceAll('name required', 'нужно заполнить название')
    .replaceAll('type required', 'нужно выбрать тип')
    .replaceAll('rarity required', 'нужно выбрать редкость')
    .replaceAll('city required', 'нужно заполнить город')
    .replaceAll('region is required', 'нужно указать регион')
    .replaceAll('price must be >= 0', 'цена не может быть меньше 0')
    .replaceAll('priceMultiplier must be > 0', 'множитель цены должен быть больше 0')
    .replaceAll('damageMin must be <= damageMax', 'минимальный урон не может быть больше максимального')
    .replaceAll('stackable item must have maxStack > 1', 'для складываемого предмета максимум в стопке должен быть больше 1')
    .replaceAll('non-stackable item maxStack must be 1', 'у нескладываемого предмета максимум в стопке должен быть равен 1');
}
