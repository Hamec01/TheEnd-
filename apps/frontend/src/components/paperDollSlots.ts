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

export interface PaperDollSlotRect {
  id: EquipmentSlotId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PaperDollAsset {
  image: string;
  naturalWidth: number;
  naturalHeight: number;
  slots: PaperDollSlotRect[];
}

const SOURCE_SLOT_RECTS: PaperDollSlotRect[] = [
  { id: 'helmet', x: 691, y: 68, w: 220, h: 220 },
  { id: 'necklace', x: 744, y: 307, w: 108, h: 108 },
  { id: 'armor', x: 700, y: 471, w: 205, h: 205 },
  { id: 'outerwear', x: 700, y: 730, w: 205, h: 205 },
  { id: 'belt', x: 658, y: 1010, w: 280, h: 110 },
  { id: 'leftHand', x: 168, y: 599, w: 220, h: 220 },
  { id: 'gloves', x: 190, y: 872, w: 205, h: 205 },
  { id: 'rightHand', x: 1233, y: 609, w: 205, h: 205 },
  { id: 'ring1', x: 1233, y: 848, w: 205, h: 205 },
  { id: 'ring2', x: 1233, y: 1075, w: 205, h: 205 },
  { id: 'ring3', x: 1233, y: 1302, w: 205, h: 205 },
  { id: 'legs', x: 524, y: 1302, w: 185, h: 220 },
  { id: 'boots', x: 896, y: 1302, w: 185, h: 220 },
  { id: 'quick1', x: 63, y: 1863, w: 137, h: 137 },
  { id: 'quick2', x: 220, y: 1863, w: 137, h: 137 },
  { id: 'quick3', x: 379, y: 1863, w: 137, h: 137 },
  { id: 'quick4', x: 537, y: 1863, w: 137, h: 137 },
  { id: 'quick5', x: 695, y: 1863, w: 137, h: 137 },
  { id: 'quick6', x: 853, y: 1863, w: 137, h: 137 },
  { id: 'quick7', x: 1012, y: 1863, w: 137, h: 137 },
  { id: 'quick8', x: 1169, y: 1863, w: 137, h: 137 },
  { id: 'quick9', x: 1327, y: 1863, w: 137, h: 137 },
  { id: 'quick10', x: 1484, y: 1863, w: 137, h: 137 },
];

function scaleSlotRects(slots: PaperDollSlotRect[], scaleX: number, scaleY: number): PaperDollSlotRect[] {
  return slots.map((slot) => ({
    id: slot.id,
    x: Math.round(slot.x * scaleX),
    y: Math.round(slot.y * scaleY),
    w: Math.round(slot.w * scaleX),
    h: Math.round(slot.h * scaleY),
  }));
}

export const HUMAN_SLOT_RECTS: PaperDollSlotRect[] = scaleSlotRects(SOURCE_SLOT_RECTS, 1107 / 1595, 1421 / 2048);

// Temporary calibration baseline copied from human layout; tune independently per race.
export const DWARF_SLOT_RECTS: PaperDollSlotRect[] = scaleSlotRects(SOURCE_SLOT_RECTS, 1163 / 1595, 1353 / 2048);

// Temporary calibration baseline copied from human layout; tune independently per race.
export const ELF_SLOT_RECTS: PaperDollSlotRect[] = scaleSlotRects(SOURCE_SLOT_RECTS, 1144 / 1595, 1375 / 2048);

export const PAPER_DOLL_ASSETS: Record<PaperDollRace, PaperDollAsset> = {
  HUMAN: {
    image: '/art/races/human.png',
    naturalWidth: 1107,
    naturalHeight: 1421,
    slots: HUMAN_SLOT_RECTS,
  },
  DWARF: {
    image: '/art/races/dwarf.png',
    naturalWidth: 1163,
    naturalHeight: 1353,
    slots: DWARF_SLOT_RECTS,
  },
  HIGH_ELF: {
    image: '/art/races/elf.png',
    naturalWidth: 1144,
    naturalHeight: 1375,
    slots: ELF_SLOT_RECTS,
  },
  WOOD_ELF: {
    image: '/art/races/elf.png',
    naturalWidth: 1144,
    naturalHeight: 1375,
    slots: ELF_SLOT_RECTS,
  },
};
