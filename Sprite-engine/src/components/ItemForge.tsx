import React, { useState, useEffect, useRef } from 'react';
import { WolfConfig } from '../types';
import { 
  Hammer, Sparkles, RefreshCw, Check, AlertCircle, Info, Sword, 
  Trash2, Plus, Download, Upload, Copy, Pencil, Shield, Wand, 
  Wrench, Footprints, Grid, FileCode, CheckSquare, Database
} from 'lucide-react';

interface ItemForgeProps {
  config: WolfConfig;
  setConfig: React.Dispatch<React.SetStateAction<WolfConfig>>;
}

export interface ForgeItem {
  id: string;
  name: string;
  category: 'helmet' | 'chestplate' | 'boots' | 'weapon' | 'shield' | 'gloves' | 'belt';
  weaponSubtype?: 'sword' | 'bow' | 'staff' | 'axe' | 'halberd' | 'spear' | 'spear_throw' | 'shield_bash' | 'hands';
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  stats: {
    damage?: number;
    defense?: number;
    speed?: number;
    magicPower?: number;
    weight?: number;
  };
  // 16x16 pixel grid for item. Store as flat array of numbers (0=transparent, 1=primary, 2=secondary, 3=accent, 4=outline, 5=highlight)
  pixelData: number[]; 
  createdAt: string;
}

// 16x16 Pixel templates for each category
// 0 = empty, 1 = primary, 2 = secondary, 3 = accent (metal/gem), 4 = outline (#1e293b), 5 = highlight (white/light)
const PIXEL_TEMPLATES: Record<string, number[]> = {
  // Diagonal Sword
  sword: [
    0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,0,
    0,0,0,0,0,0,0,0,0,0,0,0,5,3,4,0,
    0,0,0,0,0,0,0,0,0,0,0,5,3,3,4,0,
    0,0,0,0,0,0,0,0,0,0,5,3,3,4,0,0,
    0,0,0,0,0,0,0,0,0,5,3,3,4,0,0,0,
    0,0,0,0,0,0,0,0,5,3,3,4,0,0,0,0,
    0,0,0,0,0,0,0,5,3,3,4,0,0,0,0,0,
    0,0,0,0,0,0,5,3,3,4,0,0,0,0,0,0,
    0,0,0,0,0,5,3,3,4,0,0,0,0,0,0,0,
    0,0,0,0,5,3,3,4,0,0,0,0,0,0,0,0,
    0,0,0,2,2,4,4,0,0,0,0,0,0,0,0,0,
    0,0,2,2,2,2,0,0,0,0,0,0,0,0,0,0,
    0,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,
    0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,
    1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  ],
  // Majestic Shield
  shield: [
    0,0,0,4,4,4,4,4,4,4,4,4,0,0,0,0,
    0,0,4,5,5,1,1,1,1,1,5,5,4,0,0,0,
    0,4,5,1,1,1,3,3,1,1,1,5,4,0,0,0,
    0,4,1,1,1,3,5,5,3,1,1,1,4,0,0,0,
    4,1,1,1,3,5,2,2,5,3,1,1,1,4,0,0,
    4,1,1,3,5,2,2,2,2,5,3,1,1,4,0,0,
    4,1,1,3,2,2,2,2,2,2,3,1,1,4,0,0,
    4,1,1,3,2,2,3,3,2,2,3,1,1,4,0,0,
    4,1,1,1,3,2,2,2,2,3,1,1,1,4,0,0,
    4,1,1,1,1,3,2,2,3,1,1,1,1,4,0,0,
    0,4,1,1,1,1,3,3,1,1,1,1,4,0,0,0,
    0,4,1,1,1,1,1,1,1,1,1,1,4,0,0,0,
    0,0,4,1,1,1,1,1,1,1,1,4,0,0,0,0,
    0,0,0,4,1,1,1,1,1,1,4,0,0,0,0,0,
    0,0,0,0,4,1,1,1,1,4,0,0,0,0,0,0,
    0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0,
  ],
  // Royal Helmet / Hood
  helmet: [
    0,0,0,0,4,4,4,4,4,4,4,0,0,0,0,0,
    0,0,0,4,5,1,1,1,1,1,5,4,0,0,0,0,
    0,0,4,5,1,1,2,2,2,1,1,5,4,0,0,0,
    0,0,4,1,1,2,5,5,5,2,1,1,4,0,0,0,
    0,4,1,1,2,5,3,3,3,5,2,1,1,4,0,0,
    0,4,1,1,2,3,3,4,3,3,2,1,1,4,0,0,
    0,4,1,1,2,3,4,4,4,3,2,1,1,4,0,0,
    0,4,2,2,2,4,4,4,4,4,2,2,2,4,0,0,
    0,4,2,1,1,4,5,4,5,4,1,1,2,4,0,0,
    0,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0,
    0,0,0,4,3,3,4,4,4,3,3,4,0,0,0,0,
    0,0,0,4,3,4,0,0,0,4,3,4,0,0,0,0,
    0,0,0,4,4,0,0,0,0,0,4,4,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  ],
  // Chestplate / Robe Armor
  chestplate: [
    0,0,0,4,4,4,0,0,0,4,4,4,0,0,0,0,
    0,0,4,5,1,5,4,4,4,5,1,5,4,0,0,0,
    0,4,5,1,1,1,1,4,1,1,1,1,5,4,0,0,
    0,4,1,1,1,1,1,1,1,1,1,1,1,4,0,0,
    4,1,1,2,2,1,1,1,1,1,2,2,1,1,4,0,
    4,1,2,5,5,2,1,3,1,2,5,5,2,1,4,0,
    4,1,2,5,2,2,3,5,3,2,2,5,2,1,4,0,
    4,1,1,2,2,1,3,5,3,1,2,2,1,1,4,0,
    4,1,1,1,1,1,1,3,1,1,1,1,1,1,4,0,
    0,4,1,1,1,1,2,2,2,1,1,1,1,4,0,0,
    0,4,1,1,1,2,5,2,5,2,1,1,1,4,0,0,
    0,4,1,1,1,2,2,2,2,2,1,1,1,4,0,0,
    0,0,4,1,1,1,1,1,1,1,1,1,4,0,0,0,
    0,0,4,2,2,2,2,2,2,2,2,2,4,0,0,0,
    0,0,0,4,4,4,4,4,4,4,4,4,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  ],
  // Speed Boots
  boots: [
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,4,4,4,0,0,0,0,0,4,4,4,0,0,0,
    0,4,5,1,5,4,0,0,0,4,5,1,5,4,0,0,
    0,4,1,1,1,4,0,0,0,4,1,1,1,4,0,0,
    0,4,1,1,1,4,0,0,0,4,1,1,1,4,0,0,
    0,4,1,1,1,4,0,0,0,4,1,1,1,4,0,0,
    0,4,2,2,2,4,0,0,0,4,2,2,2,4,0,0,
    0,4,2,1,2,4,0,0,0,4,2,1,2,4,0,0,
    0,4,2,1,2,4,0,0,0,4,2,1,2,4,0,0,
    4,2,2,1,2,2,4,0,4,2,2,1,2,2,4,0,
    4,5,3,3,3,1,4,0,4,5,3,3,3,1,4,0,
    4,1,1,1,1,1,4,0,4,1,1,1,1,1,4,0,
    0,4,4,4,4,4,0,0,0,4,4,4,4,4,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  ],
  // Hunting Bow / Crossbow
  bow: [
    0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,
    0,0,0,0,0,4,4,5,2,4,4,0,0,0,0,0,
    0,0,0,0,4,5,2,2,1,1,5,4,0,0,0,0,
    0,0,0,4,5,2,1,1,4,1,2,5,4,0,0,0,
    0,0,4,5,2,1,4,0,0,4,1,2,5,4,0,0,
    0,4,5,2,1,4,0,5,0,0,4,1,2,5,4,0,
    0,4,2,1,4,0,0,5,0,0,0,4,1,2,4,0,
    4,2,1,4,0,0,0,5,0,0,0,0,4,1,2,4,
    4,3,3,4,4,4,4,5,4,4,4,4,4,3,3,4,
    4,2,1,4,0,0,0,5,0,0,0,0,4,1,2,4,
    0,4,2,1,4,0,0,5,0,0,0,4,1,2,4,0,
    0,4,5,2,1,4,0,5,0,0,4,1,2,5,4,0,
    0,0,4,5,2,1,4,0,0,4,1,2,5,4,0,0,
    0,0,0,4,5,2,1,1,4,1,2,5,4,0,0,0,
    0,0,0,0,4,5,2,2,1,1,5,4,0,0,0,0,
    0,0,0,0,0,4,4,5,2,4,4,0,0,0,0,0,
  ],
  // Spell Staff
  staff: [
    0,0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,
    0,0,0,0,0,4,5,3,3,5,4,0,0,0,0,0,
    0,0,0,0,4,5,3,2,2,3,5,4,0,0,0,0,
    0,0,0,0,4,3,2,5,5,2,3,4,0,0,0,0,
    0,0,0,0,4,3,2,5,5,2,3,4,0,0,0,0,
    0,0,0,0,0,4,3,2,2,3,4,0,0,0,0,0,
    0,0,0,0,0,0,4,5,5,4,0,0,0,0,0,0,
    0,0,0,0,0,0,4,1,1,4,0,0,0,0,0,0,
    0,0,0,0,0,4,1,1,4,0,0,0,0,0,0,0,
    0,0,0,0,0,4,1,1,4,0,0,0,0,0,0,0,
    0,0,0,0,4,1,1,4,0,0,0,0,0,0,0,0,
    0,0,0,4,1,1,4,0,0,0,0,0,0,0,0,0,
    0,0,4,1,1,4,0,0,0,0,0,0,0,0,0,0,
    0,4,1,1,4,0,0,0,0,0,0,0,0,0,0,0,
    4,1,1,4,0,0,0,0,0,0,0,0,0,0,0,0,
    4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,
  ],
};

// Resizes / resamples flat pixel array between sizes using nearest neighbor mapping
const resizePixelData = (oldPixels: number[], oldSize: number, newSize: number): number[] => {
  const newPixels: number[] = new Array(newSize * newSize).fill(0);
  for (let r = 0; r < newSize; r++) {
    for (let c = 0; c < newSize; c++) {
      const oldR = Math.floor((r / newSize) * oldSize);
      const oldC = Math.floor((c / newSize) * oldSize);
      const oldIdx = oldR * oldSize + oldC;
      const newIdx = r * newSize + c;
      newPixels[newIdx] = oldPixels[oldIdx] || 0;
    }
  }
  return newPixels;
};

export const ItemForge: React.FC<ItemForgeProps> = ({ config, setConfig }) => {
  const [inputText, setInputText] = useState<string>('');
  
  // Forge active item state
  const [activeItem, setActiveItem] = useState<ForgeItem>(() => {
    return generateRandomItem('Огненный Клинок Бездны', 'weapon', 'sword');
  });

  // Editor states
  const [activeTool, setActiveTool] = useState<'pencil' | 'eraser'>('pencil');
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(3); // default to Accent (3)
  const [isEquippedSuccess, setIsEquippedSuccess] = useState<boolean>(false);
  const [inventory, setInventory] = useState<ForgeItem[]>(() => {
    try {
      const stored = localStorage.getItem('humanoid_crafted_items');
      return stored ? JSON.parse(stored) : getFallbackInventory();
    } catch {
      return getFallbackInventory();
    }
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef<boolean>(false);

  // Auto-initialize canvas redraw on grid changes
  useEffect(() => {
    drawItemPixelArt();
  }, [activeItem, selectedColorIndex]);

  function getFallbackInventory(): ForgeItem[] {
    return [
      generateRandomItem('Венец Просветления', 'helmet', undefined, 'epic'),
      generateRandomItem('Сапоги Духа Грома', 'boots', undefined, 'rare'),
      generateRandomItem('Эгида Титана', 'shield', undefined, 'legendary'),
    ];
  }

  // Exports the current pixel state as a pixel-perfect unscaled PNG data URL
  const exportGridToDataUrl = (): string | null => {
    const gridSize = Math.sqrt(activeItem.pixelData.length || 256);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = gridSize;
    tempCanvas.height = gridSize;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;

    const colorPalette: Record<number, string> = {
      1: activeItem.primaryColor,
      2: activeItem.secondaryColor,
      3: activeItem.accentColor,
      4: '#18181b', // dark outline
      5: '#ffffff', // white highlight
    };

    activeItem.pixelData.forEach((val, idx) => {
      if (val === 0) return; // transparent
      const r = Math.floor(idx / gridSize);
      const c = idx % gridSize;
      tempCtx.fillStyle = colorPalette[val] || '#94a3b8';
      tempCtx.fillRect(c, r, 1, 1);
    });

    return tempCanvas.toDataURL('image/png');
  };

  // Draw pixel-art on interactive canvas with dynamic resolution support
  const drawItemPixelArt = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gridSize = Math.sqrt(activeItem.pixelData.length || 256);
    const cellSize = canvas.width / gridSize;

    // Background checkerboard
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(30, 41, 59, 0.15)' : 'rgba(15, 23, 42, 0.25)';
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }

    const colorPalette: Record<number, string> = {
      1: activeItem.primaryColor,
      2: activeItem.secondaryColor,
      3: activeItem.accentColor,
      4: '#18181b', // dark border/shadow
      5: '#ffffff', // dynamic shine Highlight
    };

    activeItem.pixelData.forEach((val, idx) => {
      if (val === 0) return; // transparent
      const r = Math.floor(idx / gridSize);
      const c = idx % gridSize;
      ctx.fillStyle = colorPalette[val] || '#94a3b8';
      ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);

      // Cute inner border for modern voxel look
      if (val !== 4) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(c * cellSize + 0.5, r * cellSize + 0.5, cellSize - 1, cellSize/2.5);
      }
    });
  };

  const saveInventory = (updated: ForgeItem[]) => {
    setInventory(updated);
    try {
      localStorage.setItem('humanoid_crafted_items', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Humanoid equipment slot mapper helper
  const handleEquipItem = (itemToEquip: ForgeItem) => {
    setConfig((prevConfig) => {
      const updated = { ...prevConfig };
      
      // Merge palette modifications
      updated.primaryColor = itemToEquip.primaryColor;
      updated.secondaryColor = itemToEquip.secondaryColor;
      updated.accentColor = itemToEquip.accentColor;

      // Turn on active slot and turn off logically conflicting pieces if necessary,
      // or simply enable the newly loaded equipment piece
      if (itemToEquip.category === 'helmet') {
        updated.equipHelmet = true;
      } else if (itemToEquip.category === 'chestplate') {
        updated.equipChestplate = true;
        // Heavy armor makes torso slightly broader
        if (itemToEquip.rarity === 'legendary' || itemToEquip.rarity === 'mythic') {
          updated.bellySize = 1.15;
          updated.bodySize = 1.05;
        } else {
          updated.bellySize = 1.0;
        }
      } else if (itemToEquip.category === 'boots') {
        updated.equipBoots = true;
      } else if (itemToEquip.category === 'shield') {
        updated.equipShield = true;
        // Scale shield visual size according to its defensive weight stats.
        const shieldWeight = itemToEquip.stats.weight || 10;
        updated.snoutLength = Math.max(0.8, Math.min(1.4, 0.6 + (shieldWeight / 20)));
      } else if (itemToEquip.category === 'gloves') {
        updated.equipGloves = true;
      } else if (itemToEquip.category === 'belt') {
        updated.equipBelt = true;
      } else if (itemToEquip.category === 'weapon') {
        const subtype = itemToEquip.weaponSubtype || 'sword';
        updated.equipWeapon = subtype;
        
        // Weapon physical size scales with damage output
        const damageVal = itemToEquip.stats.damage || 15;
        updated.tailLength = Math.max(0.7, Math.min(1.6, 0.5 + (damageVal / 50)));

        // Preset proper skill FX to fit weapon types automatically
        if (subtype === 'staff') {
          updated.fxType = 'magic_burst';
          updated.fxColor = itemToEquip.primaryColor;
        } else if (subtype === 'bow') {
          updated.fxType = 'holy_sparkle';
          updated.fxColor = '#facc15';
        } else if (subtype === 'sword' || subtype === 'spear') {
          updated.fxType = 'fire_slash';
          updated.fxColor = '#ef4444';
        } else if (subtype === 'axe' || subtype === 'halberd') {
          updated.fxType = 'shadow_strike';
          updated.fxColor = '#818cf8';
        }
      }

      return updated;
    });

    setIsEquippedSuccess(true);
    setTimeout(() => setIsEquippedSuccess(false), 2500);
  };

  const handleAddFieldToInventory = () => {
    const updated = [activeItem, ...inventory];
    saveInventory(updated);
  };

  const handleDeleteFromInventory = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = inventory.filter(i => i.id !== idToDelete);
    saveInventory(updated);
  };

  // INTELLECTUAL NLP KEYWORD ANALYZER
  // Parses item descriptors in Russian & English, extracting types, subtypes, colors, stats, and templates!
  function generateRandomItem(
    nameInput: string, 
    forcedCategory?: ForgeItem['category'],
    forcedSubtype?: ForgeItem['weaponSubtype'],
    forcedRarity?: ForgeItem['rarity'],
    targetResolution: number = 16
  ): ForgeItem {
    const text = nameInput.toLowerCase().trim();
    
    // 1. Detect Category & Weapon Subtype
    let category: ForgeItem['category'] = 'weapon'; // default fallback
    let weaponSubtype: ForgeItem['weaponSubtype'] = undefined;

    // Category patterns
    const helmetKeys = ['шлем', 'шляпа', 'корона', 'капюшон', 'маска', 'диадема', 'коронет', 'бандана', 'helm', 'helmet', 'hat', 'crown', 'hood', 'mask', 'visor', 'crest', 'венец'];
    const armorKeys = ['броня', 'доспех', 'кираса', 'роба', 'нагрудник', 'кольчуга', 'туника', 'кафтан', 'жилет', 'плащ', 'накидка', 'armor', 'chestplate', 'cuirass', 'robe', 'tunic', 'hauberk', 'breastplate', 'jacket', 'plate'];
    const bootsKeys = ['сапоги', 'ботинки', 'обувь', 'сандалии', 'поножи', 'тапки', 'кеды', 'greaves', 'boots', 'shoes', 'sandals', 'footwear', 'slippers', 'sabaton'];
    const glovesKeys = ['перчатки', 'наручи', 'рукавицы', 'краги', 'gloves', 'gauntlets', 'bracers'];
    const beltKeys = ['пояс', 'ремень', 'кушак', 'портупея', 'belt', 'sash', 'girdle'];
    const shieldKeys = ['щит', 'бакли', 'эгида', 'shield', 'buckler', 'aegis'];

    // Weapon Subtype patterns
    const bowKeys = ['лук', 'арбалет', 'самострел', 'рогатка', 'bow', 'crossbow', 'ballista'];
    const staffKeys = ['посох', 'жезл', 'канал', 'скипетр', 'палочка', 'гримуар', 'staff', 'wand', 'scepter', 'caduceus'];
    const axeKeys = ['топор', 'секира', 'чекан', 'бердыш', 'axe', 'battleaxe', 'cleaver', 'hatchet'];
    const halberdKeys = ['алебарда', 'коса', 'глефа', 'двуручник', 'halberd', 'glaive', 'scythe'];
    const spearKeys = ['копьё', 'копье', 'пика', 'трезубец', 'гарпун', 'spear', 'pike', 'trident', 'harpoon'];
    const fistKeys = ['кулак', 'когти', 'кастет', 'fist', 'claws', 'hands', 'knuckles'];

    // Logical type check
    if (forcedCategory) {
      category = forcedCategory;
      if (category === 'weapon' && forcedSubtype) {
        weaponSubtype = forcedSubtype;
      }
    } else {
      if (helmetKeys.some(k => text.includes(k))) {
        category = 'helmet';
      } else if (armorKeys.some(k => text.includes(k))) {
        category = 'chestplate';
      } else if (bootsKeys.some(k => text.includes(k))) {
        category = 'boots';
      } else if (glovesKeys.some(k => text.includes(k))) {
        category = 'gloves';
      } else if (beltKeys.some(k => text.includes(k))) {
        category = 'belt';
      } else if (shieldKeys.some(k => text.includes(k))) {
        category = 'shield';
      } else {
        category = 'weapon';
        // Subtype detection
        if (bowKeys.some(k => text.includes(k))) weaponSubtype = 'bow';
        else if (staffKeys.some(k => text.includes(k))) weaponSubtype = 'staff';
        else if (axeKeys.some(k => text.includes(k))) weaponSubtype = 'axe';
        else if (halberdKeys.some(k => text.includes(k))) weaponSubtype = 'halberd';
        else if (spearKeys.some(k => text.includes(k))) weaponSubtype = 'spear';
        else if (fistKeys.some(k => text.includes(k))) weaponSubtype = 'hands';
        else weaponSubtype = 'sword'; // default weapon subtype
      }
    }

    // 2. Color Theme mapping matching semantic keywords
    let primaryColor = '#475569'; // steel default
    let secondaryColor = '#94a3b8';
    let accentColor = '#3b82f6'; // sapphire glow default

    const fireKeys = ['огнен', 'плам', 'красн', 'вулкан', 'пепел', 'адск', 'fire', 'flame', 'red', 'magma', 'pyro', 'ash', 'vulcan', 'sun', 'солн'];
    const iceKeys = ['лед', 'мороз', 'голуб', 'син', 'метел', 'студ', 'ice', 'frost', 'blue', 'cryo', 'crystal', 'frozen', 'blizzard', 'сирен', 'siren'];
    const goldKeys = ['золот', 'желт', 'свет', 'солнеч', 'сияющ', 'gold', 'sun', 'light', 'solar', 'aurora', 'golden', 'gilded', 'shining'];
    const toxicKeys = ['ядовит', 'кисл', 'зелен', 'болот', 'лес', 'изумруд', 'poison', 'venom', 'acid', 'green', 'emerald', 'forest', 'toxic', 'jade'];
    const shadowKeys = ['тень', 'тьм', 'астрал', 'фиолет', 'черн', 'обсиди', 'ноч', 'shadow', 'dark', 'void', 'purple', 'obsidian', 'night', 'abyss', 'бездна', 'демон'];
    const holyKeys = ['свящ', 'ангел', 'бел', 'чист', 'небес', 'holy', 'white', 'sacred', 'angel', 'pure', 'heaven', 'crystal'];

    if (fireKeys.some(k => text.includes(k))) {
      primaryColor = '#ef4444'; // Red
      secondaryColor = '#f97316'; // Orange
      accentColor = '#facc15'; // Yellow
    } else if (iceKeys.some(k => text.includes(k))) {
      primaryColor = '#3b82f6'; // Blue
      secondaryColor = '#60a5fa'; // Light Blue
      accentColor = '#22d3ee'; // Cyan glow
    } else if (goldKeys.some(k => text.includes(k))) {
      primaryColor = '#eab308'; // Gold
      secondaryColor = '#fef08a'; // Bright Yellow
      accentColor = '#f43f5e'; // Ruby ruby gem top
    } else if (toxicKeys.some(k => text.includes(k))) {
      primaryColor = '#10b981'; // Emerald
      secondaryColor = '#059669'; // Dark green
      accentColor = '#a7f3d0'; // Jade mint
    } else if (shadowKeys.some(k => text.includes(k))) {
      primaryColor = '#1e1b4b'; // Deep violet
      secondaryColor = '#4f46e5'; // Indigo
      accentColor = '#818cf8'; // Mystic light purple
    } else if (holyKeys.some(k => text.includes(k))) {
      primaryColor = '#f8fafc'; // Clean White
      secondaryColor = '#cbd5e1'; // Platinum silver
      accentColor = '#fef08a'; // Amber aura
    }

    // 3. Rarity mapping
    let rarity: ForgeItem['rarity'] = forcedRarity || 'common';
    if (!forcedRarity) {
      const epicKeys = ['эпич', 'дух', 'мистич', 'velvet', 'epic', 'spirit', 'mystic'];
      const legendaryKeys = ['легенд', 'титан', 'абсолют', 'дракон', 'legend', 'titan', 'dragon', 'omega'];
      const mythicKeys = ['мифич', 'бездн', 'божеств', 'mythic', 'abyss', 'godly', 'celestial', 'бессмерт', 'death'];

      if (mythicKeys.some(k => text.includes(k))) rarity = 'mythic';
      else if (legendaryKeys.some(k => text.includes(k))) rarity = 'legendary';
      else if (epicKeys.some(k => text.includes(k))) rarity = 'epic';
      else if (Math.random() > 0.6) rarity = 'rare';
    }

    // 4. Description generation helper in full-flavored Russian RPG style
    let description = 'Загадочный артефакт, выкованный из редких металлов в пламени Кузни.';
    if (category === 'helmet') {
      description = `Прочный головной убор, защищающий разум носителя от ментальных атак. Имеет ауру цвета ${primaryColor}.`;
    } else if (category === 'chestplate') {
      description = `Тяжелое снаряжение, дарующее колоссальную стойкость в бою. Изделие покрыто руническими гравировками.`;
    } else if (category === 'boots') {
      description = `Зачарованная обувь, значительно увеличивающая ловкость, скорость марша и защищенность стопы.`;
    } else if (category === 'shield') {
      description = `Прочнейшая базовая плита щита, способная отражать физические лезвия и поглощать магические снаряды.`;
    } else if (category === 'weapon') {
      description = `Эпическое оружие (${weaponSubtype || 'клинок'}), созданное великими мастерами. Оснащено встроенными руническими ядрами.`;
    }

    // RPG Stats based on rarity rating
    const scale = rarity === 'mythic' ? 5 : rarity === 'legendary' ? 4 : rarity === 'epic' ? 3 : rarity === 'rare' ? 2 : 1;
    const stats: ForgeItem['stats'] = {};
    if (category === 'weapon') {
      stats.damage = 10 + scale * 8 + Math.floor(Math.random() * 6);
      stats.magicPower = scale * 5 + Math.floor(Math.random() * 4);
    } else if (category === 'shield' || category === 'chestplate') {
      stats.defense = 8 + scale * 6 + Math.floor(Math.random() * 5);
      stats.weight = 12 + Math.floor(Math.random() * 15) - scale * 2;
    } else if (category === 'boots') {
      stats.speed = 5 + scale * 4;
      stats.defense = 2 + scale * 3;
    } else {
      stats.defense = 4 + scale * 2;
      stats.magicPower = scale * 2;
    }

    // 5. Populate templates
    let chosenTemplateKey = 'sword'; // default fallback
    if (category === 'helmet') chosenTemplateKey = 'helmet';
    else if (category === 'chestplate') chosenTemplateKey = 'chestplate';
    else if (category === 'boots') chosenTemplateKey = 'boots';
    else if (category === 'shield') chosenTemplateKey = 'shield';
    else if (category === 'weapon') {
      if (weaponSubtype === 'bow') chosenTemplateKey = 'bow';
      else if (weaponSubtype === 'staff') chosenTemplateKey = 'staff';
      else chosenTemplateKey = 'sword'; // Covers axe, halberd, spear layout as base
    }

    const baseTemplate = PIXEL_TEMPLATES[chosenTemplateKey] || PIXEL_TEMPLATES.sword;
    
    // Scale template dynamically according to targetResolution
    const pixelData = targetResolution !== 16 
      ? resizePixelData(baseTemplate, 16, targetResolution) 
      : [...baseTemplate];

    return {
      id: 'item_' + Date.now() + '_' + Math.floor(Math.random()*1000),
      name: nameInput,
      category,
      weaponSubtype,
      rarity,
      description,
      primaryColor,
      secondaryColor,
      accentColor,
      stats,
      pixelData,
      createdAt: new Date().toISOString()
    };
  }

  const handleForgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const currentRes = Math.sqrt(activeItem ? activeItem.pixelData.length : 256);
    const crafted = generateRandomItem(inputText.trim(), undefined, undefined, undefined, currentRes);
    setActiveItem(crafted);
    setInputText('');
  };

  const handleQuickPresetForge = (presetName: string) => {
    const currentRes = Math.sqrt(activeItem ? activeItem.pixelData.length : 256);
    const crafted = generateRandomItem(presetName, undefined, undefined, undefined, currentRes);
    setActiveItem(crafted);
  };

  // Click & Drag Pixel Editing handling on canvas
  const handleCanvasInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const gridSize = Math.sqrt(activeItem.pixelData.length || 256);
    const cellSize = rect.width / gridSize;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    if (col >= 0 && col < gridSize && row >= 0 && row < gridSize) {
      const idx = row * gridSize + col;
      const updatedPixels = [...activeItem.pixelData];

      // Paint index based on tool
      const value = activeTool === 'eraser' ? 0 : selectedColorIndex;
      updatedPixels[idx] = value;

      setActiveItem({
        ...activeItem,
        pixelData: updatedPixels
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    handleCanvasInteraction(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawingRef.current) {
      handleCanvasInteraction(e);
    }
  };

  const handleMouseUpOrLeave = () => {
    isDrawingRef.current = false;
  };

  const rarityColorClass = (rarity: ForgeItem['rarity']) => {
    switch(rarity) {
      case 'common': return 'text-slate-400 border-slate-750 bg-slate-900/40';
      case 'rare': return 'text-sky-400 border-sky-900/40 bg-sky-950/20';
      case 'epic': return 'text-indigo-400 border-indigo-900/40 bg-indigo-950/20';
      case 'legendary': return 'text-amber-500 border-amber-900/40 bg-amber-950/20';
      case 'mythic': return 'text-rose-500 border-rose-900/40 bg-rose-950/20 animate-pulse';
    }
  };

  const rarityText = (rarity: ForgeItem['rarity']) => {
    switch(rarity) {
      case 'common': return 'Обычный (Common)';
      case 'rare': return 'Редкий (Rare)';
      case 'epic': return 'Эпический (Epic)';
      case 'legendary': return 'Легендарный (Legendary)';
      case 'mythic': return 'Мифический (Mythic)';
    }
  };

  const itemTypeLabel = (item: ForgeItem) => {
    if (item.category === 'helmet') return 'Шлем / Шляпа 🪖';
    if (item.category === 'chestplate') return 'Нагрудный Доспех 🛡️';
    if (item.category === 'boots') return 'Сапоги / Обувь 🥾';
    if (item.category === 'shield') return 'Щит 🛡️';
    if (item.category === 'gloves') return 'Перчатки / Наручи 🧤';
    if (item.category === 'belt') return 'Воинский Пояс 🎗️';
    
    // Weapon sublabels
    const sub = item.weaponSubtype || 'sword';
    if (sub === 'bow') return 'Стрелковый Лук 🏹';
    if (sub === 'staff') return 'Магический Посох 🔮';
    if (sub === 'axe') return 'Боевой Топор 🪓';
    if (sub === 'halberd') return 'Двуручная Алебарда 🔱';
    if (sub === 'spear') return 'Метательное Копьё 🗡️';
    if (sub === 'hands') return 'Рукопашное Оружие 👊';
    return 'Стальной Меч ⚔️';
  };

  // Export / Import items JSON
  const handleExportItemsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(inventory, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'crafted_item_inventory.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportItemsJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          const merged = [...parsed, ...inventory];
          saveInventory(merged);
        }
      } catch (err) {
        alert('Ошибка при чтении файла JSON');
      }
    };
    reader.readAsText(file);
  };

  const handlePngUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const currentRes = Math.sqrt(activeItem.pixelData.length || 256);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = currentRes;
        tempCanvas.height = currentRes;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        tempCtx.drawImage(img, 0, 0, currentRes, currentRes);
        const imgData = tempCtx.getImageData(0, 0, currentRes, currentRes);
        const data = imgData.data;

        // Gather colors to find dominant values
        const colors: { r: number; g: number; b: number; count: number }[] = [];
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 127) continue;

          // Skip white/near-white or black/near-black for dominant detectors
          const lux = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lux < 35 || lux > 225) continue;

          let found = false;
          for (const c of colors) {
            const dist = Math.hypot(c.r - r, c.g - g, c.b - b);
            if (dist < 45) {
              c.r = Math.round((c.r * c.count + r) / (c.count + 1));
              c.g = Math.round((c.g * c.count + g) / (c.count + 1));
              c.b = Math.round((c.b * c.count + b) / (c.count + 1));
              c.count++;
              found = true;
              break;
            }
          }
          if (!found) {
            colors.push({ r, g, b, count: 1 });
          }
        }

        colors.sort((a, b) => b.count - a.count);

        const rgbToHex = (r: number, g: number, b: number) => {
          return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        };

        const primaryColStr = colors[0] ? rgbToHex(colors[0].r, colors[0].g, colors[0].b) : '#475569';
        const secondaryColStr = colors[1] ? rgbToHex(colors[1].r, colors[1].g, colors[1].b) : '#94a3b8';
        const accentColStr = colors[2] ? rgbToHex(colors[2].r, colors[2].g, colors[2].b) : '#3b82f6';

        // Map every pixel to indexed values
        const newPixelData: number[] = [];
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 120) {
            newPixelData.push(0); // transparent cell
            continue;
          }

          const lux = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lux < 40) {
            newPixelData.push(4); // outline
          } else if (lux > 220) {
            newPixelData.push(5); // highlight
          } else {
            let closestIdx = 1;
            let minDistance = Infinity;

            const candidates = [
              { idx: 1, col: colors[0] },
              { idx: 2, col: colors[1] },
              { idx: 3, col: colors[2] },
            ].filter(cand => cand.col !== undefined);

            if (candidates.length === 0) {
              newPixelData.push(1);
              continue;
            }

            candidates.forEach(cand => {
              const d = Math.hypot(cand.col!.r - r, cand.col!.g - g, cand.col!.b - b);
              if (d < minDistance) {
                minDistance = d;
                closestIdx = cand.idx;
              }
            });
            newPixelData.push(closestIdx);
          }
        }

        const rawName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        const capitalizedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

        const generatedBase = generateRandomItem(capitalizedName, undefined, undefined, undefined, currentRes);

        const parsedItem: ForgeItem = {
          ...generatedBase,
          primaryColor: primaryColStr,
          secondaryColor: secondaryColStr,
          accentColor: accentColStr,
          pixelData: newPixelData,
        };

        setActiveItem(parsedItem);
      };
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 animate-fade-in shadow-xl" id="item-forge-card">
      
      {/* 1. Header block */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Hammer className="w-5 h-5 text-amber-500 animate-pulse" />
            <span>🔨 Пиксельное Ателье & Кузница Предметов (Artifact Forge)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Назовите предмет (плащ огня, шляпа архимага, ледяной арбалет...) — ИИ-кузница автоматически определит его класс, тип снаряжения, цвета и позволит отредактировать пиксели!
          </p>
        </div>
      </div>

      {/* 2. Generation Form & Quick Presets */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* Left: Input for words */}
        <div className="md:col-span-7 flex flex-col gap-3">
          <form onSubmit={handleForgeSubmit} className="flex gap-2">
            <input 
              type="text"
              required
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Введите имя (напр. 'Огненный Арбалет', 'Шляпа Тени'...)"
              className="flex-1 text-xs px-3.5 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-medium"
            />
            <button 
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase cursor-pointer transition-all flex items-center gap-1.5 shrink-0 shadow shadow-indigo-950/40"
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>Выковать</span>
            </button>
          </form>

          {/* PNG Uploader Row */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide shrink-0">Или:</span>
            <label className="flex-1 py-1.5 px-3 rounded-lg border border-dashed border-slate-700 bg-slate-950/45 hover:border-indigo-500 hover:bg-slate-950 text-[11px] text-slate-400 font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center">
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Импорт PNG и пикселизация</span>
              <input
                type="file"
                accept="image/png"
                onChange={handlePngUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Prompt Presets Bubbles */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wide">Быстрые рецепты кузнеца:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: 'Ледяной Кинжал Смерти ❄️', desc: 'Ice Dagger' },
                { name: 'Вулканический Щит Дракона 🔥', desc: 'Lava Shield' },
                { name: 'Шляпа Колдуна Пустоты 🧙', desc: 'Mage Hat' },
                { name: 'Золотые Сапоги Гермеса ⚡', desc: 'Boots' },
                { name: 'Рунический Доспех Титана 🛡️', desc: 'Chestplate' },
              ].map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleQuickPresetForge(preset.name)}
                  className="py-1 px-2 rounded-md bg-slate-950 border border-slate-800 text-[10px] text-slate-350 hover:border-slate-650 hover:text-indigo-300 transition-all cursor-pointer text-left"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Analyzer Diagnostics */}
        <div className="md:col-span-5 bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-2.5" id="analyzer-diagnostics">
          <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase text-indigo-400 tracking-wider">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Спектральный анализатор ИИ</span>
          </div>

          <div className="flex flex-col gap-2 text-xs">
            <div className="flex justify-between items-center bg-slate-900/40 p-1.5 rounded border border-slate-800/40">
              <span className="text-slate-500 text-[10px] uppercase">Авто-Класс:</span>
              <span className="font-bold text-indigo-300">{itemTypeLabel(activeItem)}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900/40 p-1.5 rounded border border-slate-800/40">
              <span className="text-slate-500 text-[10px] uppercase">Категория:</span>
              <span className="font-mono text-[10px] font-bold text-amber-500 uppercase">{activeItem.category}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900/40 p-1.5 rounded border border-slate-800/40">
              <span className="text-slate-500 text-[10px] uppercase">Палитра:</span>
              <div className="flex gap-1 items-center">
                <span className="w-2.5 h-2.5 rounded-full border border-slate-950" style={{ backgroundColor: activeItem.primaryColor }} title="Primary" />
                <span className="w-2.5 h-2.5 rounded-full border border-slate-950" style={{ backgroundColor: activeItem.secondaryColor }} title="Secondary" />
                <span className="w-2.5 h-2.5 rounded-full border border-slate-950" style={{ backgroundColor: activeItem.accentColor }} title="Accent" />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Main Workspace: Canvas and Specs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-950/20 border border-slate-850 p-5 rounded-xl">
        
        {/* Row 1: The Interactive Pixel Grid Editor */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest text-center self-start flex items-center gap-1">
            <Grid className="w-3.5 h-3.5 text-indigo-400" />
            <span>Пиксельная матрица ({Math.sqrt(activeItem.pixelData.length || 256)}x{Math.sqrt(activeItem.pixelData.length || 256)})</span>
          </span>

          <div className="relative border-4 border-slate-800 rounded-lg overflow-hidden bg-slate-950 inline-block shadow-lg shadow-black/40">
            <canvas
              ref={canvasRef}
              width={192}
              height={192}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className="cursor-crosshair block"
            />
          </div>

          <div className="text-[9px] text-slate-500 italic text-center leading-normal">
            Рисуйте зажатой кнопкой мыши по сетке!
          </div>

          {/* Grid Resolution selection segment */}
          <div className="flex flex-col gap-1.5 w-full mt-1.5 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40">
            <span className="text-[9px] text-slate-400 uppercase font-extrabold self-start block mb-1">Разрешение сетки (Ресайз):</span>
            <div className="grid grid-cols-4 gap-1 w-full text-center">
              {[16, 24, 32, 64].map((sz) => {
                const currentRes = Math.sqrt(activeItem.pixelData.length || 256);
                const isActive = currentRes === sz;
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      const resized = resizePixelData(activeItem.pixelData, currentRes, sz);
                      setActiveItem({
                        ...activeItem,
                        pixelData: resized
                      });
                    }}
                    className={`py-1 text-[9px] font-bold rounded border transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {sz}x{sz}
                  </button>
                );
              })}
            </div>
            <p className="text-[8px] text-slate-500 italic leading-snug mt-1">
              * Переключение разрешения плавно масштабирует весь ваш рисунок!
            </p>
          </div>
        </div>

        {/* Row 2: Pixel Painting Tools */}
        <div className="flex flex-col gap-4">
          <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Инструменты кисти</span>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTool('pencil')}
              className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'pencil' 
                  ? 'bg-indigo-600/20 border-indigo-505 text-indigo-300' 
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Карандаш</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTool('eraser')}
              className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'eraser' 
                  ? 'bg-rose-600/20 border-rose-505 text-rose-450 text-rose-350 text-rose-300' 
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Ластик</span>
            </button>
          </div>

          {/* Color Palette Binding Index for drawing */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-slate-500 uppercase font-extrabold">Красить цветом:</span>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { idx: 1, label: 'Осн', color: activeItem.primaryColor, title: 'Primary Color' },
                { idx: 2, label: 'Втор', color: activeItem.secondaryColor, title: 'Secondary Color' },
                { idx: 3, label: 'Акц', color: activeItem.accentColor, title: 'Accent/Jewel Color' },
                { idx: 4, label: 'Конт', color: '#18181b', title: 'Dark Outline Color' },
              ].map((pal, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setActiveTool('pencil');
                    setSelectedColorIndex(pal.idx);
                  }}
                  className={`p-1 rounded-md border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    selectedColorIndex === pal.idx && activeTool === 'pencil'
                      ? 'border-indigo-500 bg-slate-900 shadow font-extrabold' 
                      : 'border-slate-800 bg-slate-950 hover:bg-slate-900'
                  }`}
                  title={pal.title}
                >
                  <span className="w-4 h-4 rounded-full border border-slate-955 block shadow-inner" style={{ backgroundColor: pal.color }} />
                  <span className="text-[8px] text-slate-400">{pal.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1 text-[11px] leading-relaxed text-slate-400 bg-slate-900/40 p-2.5 rounded border border-slate-800/40">
            <span className="text-[9px] text-slate-500 uppercase font-extrabold block">Помощник палитры:</span>
            <span>Изменяйте цвета предмета выше в секции Текста или во вкладке "⚔️ Снаряжение", цвета на сетке обновятся налету!</span>
          </div>
        </div>

        {/* Row 3: Active Item Stats, Rarity & Action */}
        <div className="flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Атрибуты артефакта</span>
              
              <span className={`text-[9px] font-bold py-0.5 px-2 border rounded-full uppercase leading-none ${rarityColorClass(activeItem.rarity)}`}>
                {rarityText(activeItem.rarity)}
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-200 mt-1">
              {activeItem.name}
            </h3>

            <p className="text-[11px] text-slate-400 leading-relaxed italic">
              « {activeItem.description} »
            </p>

            {/* Render random RPG stats parsed dynamically */}
            <div className="grid grid-cols-2 gap-2 mt-2" id="forge-stats-box">
              {activeItem.stats.damage && (
                <div className="bg-slate-950 p-2 rounded border border-slate-800 text-xs">
                  <span className="text-red-400 font-bold block">🗡️ Урон (Damage):</span>
                  <span className="font-mono text-sm font-extrabold text-slate-200">+{activeItem.stats.damage} ед.</span>
                </div>
              )}
              {activeItem.stats.defense && (
                <div className="bg-slate-950 p-2 rounded border border-slate-800 text-xs">
                  <span className="text-indigo-400 font-bold block">🛡️ Защита (Def):</span>
                  <span className="font-mono text-sm font-extrabold text-slate-200">+{activeItem.stats.defense} ед.</span>
                </div>
              )}
              {activeItem.stats.speed && (
                <div className="bg-slate-950 p-2 rounded border border-slate-800 text-xs">
                  <span className="text-emerald-400 font-bold block">⚡ Скор (Speed):</span>
                  <span className="font-mono text-sm font-extrabold text-slate-200">+{activeItem.stats.speed}% скор.</span>
                </div>
              )}
              {activeItem.stats.magicPower && (
                <div className="bg-slate-950 p-2 rounded border border-slate-800 text-xs">
                  <span className="text-purple-400 font-bold block">🔮 Сила Магии (AP):</span>
                  <span className="font-mono text-sm font-extrabold text-slate-200">+{activeItem.stats.magicPower} силы</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Equip buttons */}
          <div className="flex flex-col gap-2 mt-2">
            <button
              onClick={() => handleEquipItem(activeItem)}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-red-650 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-amber-500/20 transition-all"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Одеть предмет на персонажа</span>
            </button>

            {/* Advanced design baking buttons */}
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => {
                  const png = exportGridToDataUrl();
                  if (!png) return;
                  setConfig((prev) => ({
                    ...prev,
                    uploadedBodyPng: png,
                    uploadedBodyMode: 'static',
                    hideBaseBody: false,
                    customBodyScale: 1.15,
                    customBodyOffsetX: 8,
                    customBodyOffsetY: -3
                  }));
                  setIsEquippedSuccess(true);
                  setTimeout(() => setIsEquippedSuccess(false), 2500);
                }}
                className="py-1.5 px-2 text-[10px] rounded-lg bg-indigo-950/40 border border-indigo-900 text-indigo-300 hover:bg-indigo-900 hover:text-white font-bold cursor-pointer transition-all uppercase text-center"
                title="Накладывает ваш рисунок как накидку/броню поверх персонажа"
              >
                👕 Кожа/Накидка
              </button>
              <button
                type="button"
                onClick={() => {
                  const png = exportGridToDataUrl();
                  if (!png) return;
                  setConfig((prev) => ({
                    ...prev,
                    uploadedFxPng: png,
                    customFxScale: 1.3,
                    customFxOffsetX: 4,
                    customFxOffsetY: -4,
                    customFxFrameCount: 1,
                    customFxRotation: 0,
                    customFxTriggerFrame: 2
                  }));
                  setIsEquippedSuccess(true);
                  setTimeout(() => setIsEquippedSuccess(false), 2500);
                }}
                className="py-1.5 px-2 text-[10px] rounded-lg bg-pink-950/40 border border-pink-905 text-pink-300 hover:bg-pink-900 hover:text-white font-bold cursor-pointer transition-all uppercase text-center"
                title="Использует ваш рисунок как спецэффект атаки (FX)"
              >
                ✨ Кастомный FX
              </button>
            </div>

            <button
              onClick={handleAddFieldToInventory}
              className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold text-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Добавить в коллекцию сундука</span>
            </button>

            {isEquippedSuccess && (
              <span className="text-[11px] text-emerald-400 font-bold text-center flex items-center justify-center gap-1 animate-pulse" id="equip-or-bake-success-badge">
                <Check className="w-3.5 h-3.5" />
                <span>Одежда или Текстура запечена на персонажа!</span>
              </span>
            )}
          </div>

        </div>

      </div>

      {/* 4. Suitzase Inventory Collection display */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center bg-slate-950/20 p-2.5 rounded-xl border border-slate-850 px-4">
          <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
            <Database className="w-4 h-4" />
            <span>Сундук Артефактов (Ваша Коллекция: {inventory.length})</span>
          </span>

          <div className="flex items-center gap-2">
            {/* Import / Export JSON Buttons */}
            <button
              type="button"
              onClick={handleExportItemsJson}
              className="p-1 px-3 text-[10px] font-bold border border-slate-800 hover:bg-slate-800 hover:text-white transition-all rounded bg-slate-950 flex items-center gap-1 text-slate-400 cursor-pointer"
              title="Скачать всю коллекцию предметов как один JSON-пакет"
            >
              <Download className="w-3 h-3" />
              <span>Экспорт .json</span>
            </button>

            <label className="p-1 px-3 text-[10px] font-bold border border-slate-800 hover:bg-slate-800 hover:text-white transition-all rounded bg-slate-950 flex items-center gap-1 text-slate-400 cursor-pointer">
              <Upload className="w-3 h-3" />
              <span>Импорт .json</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportItemsJson}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Display grid */}
        {inventory.length === 0 ? (
          <div className="py-6 border border-dashed border-slate-800 bg-slate-955/20 text-center rounded-xl flex flex-col items-center justify-center gap-1 text-slate-500 italic text-xs">
            <AlertCircle className="w-6 h-6 text-slate-700 animate-bounce" />
            <span>Сундук пуст. Выкуйте предмет выше и нажмите «Добавить в коллекцию»!</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
            {inventory.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setActiveItem(item);
                  handleEquipItem(item);
                }}
                className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/40 hover:bg-indigo-950/10 hover:border-indigo-850 cursor-pointer transition-all flex justify-between items-start gap-2 relative group"
              >
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-200 line-clamp-1 group-hover:text-indigo-300">
                      {item.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteFromInventory(item.id, e)}
                      className="text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-900 shrink-0 cursor-pointer transition-all"
                      title="Удалить из коллекции"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-[9px] text-slate-500">
                    {itemTypeLabel(item)}
                  </span>

                  {/* Little colors overlapping circles */}
                  <div className="flex gap-1.5 items-center mt-1">
                    <div className="flex -space-x-1 items-center shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full border border-slate-900 block" style={{ backgroundColor: item.primaryColor }} />
                      <span className="w-2.5 h-2.5 rounded-full border border-slate-900 block" style={{ backgroundColor: item.secondaryColor }} />
                      <span className="w-2.5 h-2.5 rounded-full border border-slate-900 block" style={{ backgroundColor: item.accentColor }} />
                    </div>
                    
                    <span className={`text-[8px] font-extrabold uppercase leading-none border rounded border-slate-800 px-1 py-0.5 ${rarityColorClass(item.rarity)}`}>
                      {item.rarity}
                    </span>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
