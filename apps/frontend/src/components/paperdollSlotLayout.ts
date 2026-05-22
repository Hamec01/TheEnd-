export type PaperDollRace = 'HUMAN' | 'DWARF' | 'HIGH_ELF' | 'WOOD_ELF';

export type EquipmentSlotId =
  | 'helmet'
  | 'necklace'
  | 'armor'
  | 'outerwear'
  | 'belt'
  | 'leftHand'
  | 'gloves'
  | 'rightHand'
  | 'ring1'
  | 'ring2'
  | 'ring3'
  | 'legs'
  | 'boots'
  | 'quick1'
  | 'quick2'
  | 'quick3'
  | 'quick4'
  | 'quick5'
  | 'quick6'
  | 'quick7'
  | 'quick8'
  | 'quick9'
  | 'quick10';

export interface PaperDollAsset {
  image: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface PaperDollSlotLayout {
  id: EquipmentSlotId;
  label: string;
  group: 'equipment' | 'bottom';
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  category?: string;
  placeholder?: string;
}

interface LegacySlotRect {
  id: Exclude<EquipmentSlotId, `quick${number}`>;
  label: string;
  category: string;
  placeholder: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const LEGACY_CANVAS_WIDTH = 1595;
const LEGACY_CANVAS_HEIGHT = 2048;

const LEGACY_EQUIPMENT_SLOT_RECTS: LegacySlotRect[] = [
  { id: 'helmet', label: 'Шлем', category: 'helmet', placeholder: 'Ш', x: 691, y: 68, w: 220, h: 220 },
  { id: 'necklace', label: 'Амулет', category: 'amulet', placeholder: 'Ам', x: 744, y: 307, w: 108, h: 108 },
  { id: 'armor', label: 'Броня', category: 'chest', placeholder: 'Бр', x: 700, y: 471, w: 205, h: 205 },
  { id: 'outerwear', label: 'Плащ', category: 'cloak', placeholder: 'Пл', x: 700, y: 730, w: 205, h: 205 },
  { id: 'belt', label: 'Пояс', category: 'belt', placeholder: 'Пс', x: 658, y: 1010, w: 280, h: 110 },
  { id: 'leftHand', label: 'Левая рука', category: 'shield', placeholder: 'ЛР', x: 168, y: 599, w: 220, h: 220 },
  { id: 'gloves', label: 'Перчатки', category: 'gloves', placeholder: 'Пр', x: 190, y: 872, w: 205, h: 205 },
  { id: 'rightHand', label: 'Правая рука', category: 'weapon', placeholder: 'ПР', x: 1233, y: 609, w: 205, h: 205 },
  { id: 'ring1', label: 'Кольцо 1', category: 'ring', placeholder: 'К1', x: 1233, y: 848, w: 205, h: 205 },
  { id: 'ring2', label: 'Кольцо 2', category: 'ring', placeholder: 'К2', x: 1233, y: 1075, w: 205, h: 205 },
  { id: 'ring3', label: 'Кольцо 3', category: 'ring', placeholder: 'К3', x: 1233, y: 1302, w: 205, h: 205 },
  { id: 'legs', label: 'Поножи', category: 'legs', placeholder: 'Нг', x: 524, y: 1302, w: 185, h: 220 },
  { id: 'boots', label: 'Сапоги', category: 'boots', placeholder: 'Сп', x: 896, y: 1302, w: 185, h: 220 },
];

function toPercentLayout(slot: LegacySlotRect): PaperDollSlotLayout {
  return {
    id: slot.id,
    label: slot.label,
    group: 'equipment',
    category: slot.category,
    placeholder: slot.placeholder,
    xPercent: ((slot.x + (slot.w / 2)) / LEGACY_CANVAS_WIDTH) * 100,
    yPercent: ((slot.y + (slot.h / 2)) / LEGACY_CANVAS_HEIGHT) * 100,
    widthPercent: (slot.w / LEGACY_CANVAS_WIDTH) * 100,
    heightPercent: (slot.h / LEGACY_CANVAS_HEIGHT) * 100,
  };
}

const SHARED_EQUIPMENT_LAYOUT = LEGACY_EQUIPMENT_SLOT_RECTS.map(toPercentLayout);

const BOTTOM_SLOT_LAYOUT: PaperDollSlotLayout[] = Array.from({ length: 10 }, (_, index) => ({
  id: `quick${index + 1}` as EquipmentSlotId,
  label: `Быстрый слот ${index + 1}`,
  group: 'bottom',
  category: 'quick',
  placeholder: String(index + 1),
  xPercent: ((index + 0.5) / 10) * 100,
  yPercent: 50,
  widthPercent: 8.4,
  heightPercent: 78,
}));

export const PAPER_DOLL_ASSETS: Record<PaperDollRace, PaperDollAsset> = {
  HUMAN: {
    image: '/art/races/human.png',
    naturalWidth: 1107,
    naturalHeight: 1421,
  },
  DWARF: {
    image: '/art/races/dwarf.png',
    naturalWidth: 1163,
    naturalHeight: 1353,
  },
  HIGH_ELF: {
    image: '/art/races/elf.png',
    naturalWidth: 1144,
    naturalHeight: 1375,
  },
  WOOD_ELF: {
    image: '/art/races/elf.png',
    naturalWidth: 1144,
    naturalHeight: 1375,
  },
};

export const PAPER_DOLL_SLOT_LAYOUT: Record<PaperDollRace, PaperDollSlotLayout[]> = {
  HUMAN: [...SHARED_EQUIPMENT_LAYOUT, ...BOTTOM_SLOT_LAYOUT],
  DWARF: [...SHARED_EQUIPMENT_LAYOUT, ...BOTTOM_SLOT_LAYOUT],
  HIGH_ELF: [...SHARED_EQUIPMENT_LAYOUT, ...BOTTOM_SLOT_LAYOUT],
  WOOD_ELF: [...SHARED_EQUIPMENT_LAYOUT, ...BOTTOM_SLOT_LAYOUT],
};