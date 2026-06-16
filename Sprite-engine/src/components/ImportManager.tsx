import React, { useRef, useState, useEffect } from 'react';
import { WolfConfig } from '../types';
import { 
  Upload, FileCode, Sliders, Image as ImageIcon, Play, Pause, 
  RefreshCw, Check, AlertCircle, Database, Trash2, Plus, 
  Download, Copy, X, Sparkles, BookOpen, Search 
} from 'lucide-react';

interface ImportManagerProps {
  onConfigLoaded: (config: WolfConfig) => void;
  currentConfig: WolfConfig;
}

export interface CharacterPreset {
  id: string;
  name: string;
  description: string;
  config: WolfConfig;
  isCustom?: boolean;
  createdAt: string;
}

const BASE_DEFAULT_CONFIG: WolfConfig = {
  characterType: 'humanoid',
  primaryColor: '#c21e1e',
  secondaryColor: '#ecc94b',
  accentColor: '#94a3b8',
  eyeColor: '#38bdf8',
  eyeGlow: true,
  equipHelmet: true,
  equipChestplate: true,
  equipGloves: true,
  equipBoots: true,
  equipBelt: true,
  equipShield: true,
  equipWeapon: 'sword',
  equipWeaponLeft: 'none',
  skinColor: '#ffedd5',
  hairColor: '#eab308',
  underwearColor: '#2563eb',
  humanoidRace: 'human',
  bodyHeight: 1.0,
  armSize: 1.0,
  bellySize: 1.0,
  hairStyle: 'short',
  fxType: 'fire_slash',
  fxColor: '#ef4444',
  fxScale: 1.0,
  fxFrame: 1,
  customAnimations: {},
  tailLength: 1.0,
  earSize: 1.0,
  snoutLength: 1.0,
  bodySize: 1.0,
  resolution: 64,
  fps: 10,
  outlineColor: '#111115',
  showOutline: true,
  uploadedBodyPng: '',
  uploadedFxPng: '',
  uploadedBodyMode: 'static',
  hideBaseBody: false,
  customBodyScale: 1.0,
  customBodyOffsetX: 0,
  customBodyOffsetY: 0,
  bakeFxInExport: false,
  customFxScale: 1.0,
  customFxOffsetX: 0,
  customFxOffsetY: 0,
  customFxRotation: 0,
  customFxFrameCount: 1,
  customFxTriggerFrame: 2,
  theendSkillClass: 'melee_slash',
  theendDamageCategory: 'physical',
  theendDamageType: 'slash',
  theendElementType: 'none',
  theendSoundPreset: 'sword_slash',
  layerOrder: ['cape', 'back_leg', 'torso', 'front_leg', 'back_arm', 'head', 'front_arm'],
};

const DEFAULT_PRESETS: CharacterPreset[] = [
  {
    id: 'regal_paladin',
    name: '🛡️ Королевский Паладин (Regal Paladin)',
    description: 'Благородный рыцарь в сияющих синих доспехах с золотой отделкой. Вооружен длинным стальным мечом.',
    createdAt: '2026-06-15T12:00:00.000Z',
    config: {
      ...BASE_DEFAULT_CONFIG,
      characterType: 'humanoid',
      humanoidRace: 'human',
      primaryColor: '#2563eb',
      secondaryColor: '#facc15',
      accentColor: '#cbd5e1',
      eyeColor: '#67e8f9',
      equipWeapon: 'sword',
      fxType: 'holy_sparkle',
      fxColor: '#fef08a',
    }
  },
  {
    id: 'emerald_ranger',
    name: '🏹 Лесной Рейнджер (Emerald Ranger)',
    description: 'Ловкий лесной эльф в зеленых маскировочных одеждах с позолоченными элементами, готовый выпустить стрелу.',
    createdAt: '2026-06-15T12:01:00.000Z',
    config: {
      ...BASE_DEFAULT_CONFIG,
      characterType: 'elf',
      humanoidRace: 'elf',
      primaryColor: '#059669',
      secondaryColor: '#ea580c',
      accentColor: '#78350f',
      eyeColor: '#a7f3d0',
      equipWeapon: 'bow',
      hairColor: '#fef08a',
      hairStyle: 'long',
      fxType: 'holy_sparkle',
      fxColor: '#10b981',
    }
  },
  {
    id: 'dark_necromancer',
    name: '💀 Чумной Некромант (Plague Necromancer)',
    description: 'Восставший из мертвых чернокнижник в темно-фиолетовой мантии со смертоносным чумным посохом.',
    createdAt: '2026-06-15T12:02:00.000Z',
    config: {
      ...BASE_DEFAULT_CONFIG,
      characterType: 'mage',
      humanoidRace: 'undead',
      primaryColor: '#4a044e',
      secondaryColor: '#06b6d4',
      accentColor: '#1e293b',
      eyeColor: '#22c55e',
      skinColor: '#cbd5e1',
      hairStyle: 'none',
      equipWeapon: 'staff',
      fxType: 'magic_burst',
      fxColor: '#8b5cf6',
    }
  },
  {
    id: 'volcanic_berserker',
    name: '🔥 Вулканический Берсерк (Volcanic Berserker)',
    description: 'Разъяренный лавовый монстр с огромными огненными когтями и закаленной каменной броней.',
    createdAt: '2026-06-15T12:03:00.000Z',
    config: {
      ...BASE_DEFAULT_CONFIG,
      characterType: 'monster',
      primaryColor: '#f97316',
      secondaryColor: '#ef4444',
      accentColor: '#451a03',
      eyeColor: '#fde047',
      equipWeapon: 'hands',
      fxType: 'fire_slash',
      fxColor: '#f97316',
      bodySize: 1.25,
      armSize: 1.3,
      bodyHeight: 1.2,
    }
  },
  {
    id: 'dwarven_blacksmith',
    name: '🪓 Гном-Кузнец (Dwarven Blacksmith)',
    description: 'Коренастый и выносливый гном с густой каменной бородой, сжимающий тяжелый боевой топор.',
    createdAt: '2026-06-15T12:04:00.000Z',
    config: {
      ...BASE_DEFAULT_CONFIG,
      characterType: 'dwarf',
      humanoidRace: 'dwarf',
      bodyHeight: 0.75,
      bellySize: 1.45,
      armSize: 1.15,
      bodySize: 0.9,
      primaryColor: '#d97706',
      secondaryColor: '#7c2d12',
      accentColor: '#4b5563',
      eyeColor: '#ea580c',
      hairColor: '#b45309',
      hairStyle: 'braids',
      equipWeapon: 'axe',
      fxType: 'lightning_shield',
      fxColor: '#fbbf24',
    }
  },
  {
    id: 'shadow_vampire',
    name: '🧛 Теневой Вампир (Shadow Vampire)',
    description: 'Аристократичный лорд-вампир в бархатном черно-красном плаще, управляющий запретной кровавой магией.',
    createdAt: '2026-06-15T12:05:00.000Z',
    config: {
      ...BASE_DEFAULT_CONFIG,
      characterType: 'humanoid',
      humanoidRace: 'vampire',
      primaryColor: '#1e1b4b',
      secondaryColor: '#991b1b',
      accentColor: '#f3f4f6',
      eyeColor: '#ef4444',
      skinColor: '#f8fafc',
      hairColor: '#0f172a',
      hairStyle: 'crest',
      equipWeapon: 'hands',
      fxType: 'shadow_strike',
      fxColor: '#e11d48',
    }
  }
];

export const ImportManager: React.FC<ImportManagerProps> = ({
  onConfigLoaded,
  currentConfig,
}) => {
  // Config JSON states
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonSuccess, setJsonSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Presets Library states
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState<boolean>(false);
  const [savedPresets, setSavedPresets] = useState<CharacterPreset[]>(() => {
    try {
      const stored = localStorage.getItem('humanoid_character_presets');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [newPresetDesc, setNewPresetDesc] = useState<string>('');
  const [copiedPresetId, setCopiedPresetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const savePresets = (updated: CharacterPreset[]) => {
    setSavedPresets(updated);
    try {
      localStorage.setItem('humanoid_character_presets', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to write presets to LocalStorage:', e);
    }
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    const newPreset: CharacterPreset = {
      id: 'preset_' + Date.now(),
      name: newPresetName.trim(),
      description: newPresetDesc.trim() || 'Пользовательский пресет персонажа',
      isCustom: true,
      createdAt: new Date().toISOString(),
      config: { ...currentConfig }
    };

    const updated = [newPreset, ...savedPresets];
    savePresets(updated);
    setNewPresetName('');
    setNewPresetDesc('');
    
    // Auto feedback
    setJsonSuccess(true);
    setJsonError(null);
    setTimeout(() => setJsonSuccess(false), 3000);
  };

  const handleLoadPreset = (preset: CharacterPreset) => {
    onConfigLoaded(preset.config);
    setJsonSuccess(true);
    setJsonError(null);
    setTimeout(() => setJsonSuccess(false), 3000);
    setIsPresetsModalOpen(false);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить этот сохраненный пресет?')) return;
    const updated = savedPresets.filter(p => p.id !== id);
    savePresets(updated);
  };

  const handleCopyPresetJson = (preset: CharacterPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(JSON.stringify(preset.config, null, 2));
      setCopiedPresetId(preset.id);
      setTimeout(() => setCopiedPresetId(null), 2005);
    } catch {
      const txt = document.createElement('textarea');
      txt.value = JSON.stringify(preset.config, null, 2);
      document.body.appendChild(txt);
      txt.select();
      document.execCommand('copy');
      document.body.removeChild(txt);
      setCopiedPresetId(preset.id);
      setTimeout(() => setCopiedPresetId(null), 2005);
    }
  };

  const handleExportPresetJson = (preset: CharacterPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(preset.config, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${preset.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_preset.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Spritesheet Import states
  const [importedImage, setImportedImage] = useState<HTMLImageElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);
  
  // Slicing parameters
  const [cols, setCols] = useState<number>(8);
  const [rows, setRows] = useState<number>(4);
  const [activePlayRow, setActivePlayRow] = useState<number>(0);
  const [fps, setFps] = useState<number>(10);
  const [playFrame, setPlayFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  
  const spritePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const sheetGridCanvasRef = useRef<HTMLCanvasElement>(null);

  // Handling JSON Config Import
  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Validation check
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Некорректный формат файла. Ожидался JSON объект.');
        }

        // Validate crucial parameters of WolfConfig
        const requiredKeys: (keyof WolfConfig)[] = ['primaryColor', 'secondaryColor', 'resolution', 'fps'];
        const hasKeys = requiredKeys.every(k => k in parsed);
        
        if (!hasKeys) {
          throw new Error('Файл JSON не содержит необходимых параметров конфигурации спрайта.');
        }

        onConfigLoaded(parsed as WolfConfig);
        setJsonSuccess(true);
        setJsonError(null);
        setTimeout(() => setJsonSuccess(false), 3000);
      } catch (err: any) {
        setJsonError(err.message || 'Ошибка чтения JSON файла.');
        setJsonSuccess(false);
      }
    };
    reader.readAsText(file);
  };

  // Export current config helper
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${currentConfig.characterType || 'character'}_config.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Handle Spritesheet Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      setImageSrc(src);
      
      const img = new Image();
      img.onload = () => {
        setImportedImage(img);
        setPlayFrame(0);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // Auto-detect slicing based on popular sizes if desired
  const applyPresetSlicing = (presetCols: number, presetRows: number) => {
    setCols(presetCols);
    setRows(presetRows);
    setPlayFrame(0);
  };

  // Animation cycle loop for imported customs
  useEffect(() => {
    if (!isPlaying || !importedImage) return;
    
    const interval = 1000 / fps;
    const timer = setInterval(() => {
      setPlayFrame((prev) => (prev + 1) % cols);
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, fps, cols, importedImage]);

  // Draw Grid preview and Sliced active frame on changes
  useEffect(() => {
    if (!importedImage) return;

    const w = importedImage.naturalWidth;
    const h = importedImage.naturalHeight;

    const cellW = w / cols;
    const cellH = h / rows;

    // 1. Draw entire sheet with highlighted grids on Grid Canvas
    const gridCanvas = sheetGridCanvasRef.current;
    if (gridCanvas) {
      gridCanvas.width = w;
      gridCanvas.height = h;
      const ctx = gridCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(importedImage, 0, 0);

        // draw grid grid lines
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)'; // light red grids
        ctx.lineWidth = Math.max(1, w / 400);
        
        for (let r = 0; r <= rows; r++) {
          const ry = r * cellH;
          ctx.beginPath();
          ctx.moveTo(0, ry);
          ctx.lineTo(w, ry);
          ctx.stroke();
        }

        for (let c = 0; c <= cols; c++) {
          const cx = c * cellW;
          ctx.beginPath();
          ctx.moveTo(cx, 0);
          ctx.lineTo(cx, h);
          ctx.stroke();
        }

        // Highlight currently played row
        ctx.fillStyle = 'rgba(99, 102, 241, 0.22)';
        ctx.fillRect(0, activePlayRow * cellH, w, cellH);

        // Highlight active playing frames
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = Math.max(2, w / 200);
        const activeColIdx = playFrame % cols;
        ctx.strokeRect(activeColIdx * cellW, activePlayRow * cellH, cellW, cellH);
      }
    }

    // 2. Draw currently sliced playFrame on Sprite Canvas
    const spriteCanvas = spritePreviewCanvasRef.current;
    if (spriteCanvas) {
      spriteCanvas.width = 120;
      spriteCanvas.height = 120;
      const ctx = spriteCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 120, 120);
        ctx.imageSmoothingEnabled = false;

        // Draw an alpha grid background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 120, 120);
        ctx.fillStyle = '#334155';
        const square = 10;
        for (let y = 0; y < 120; y += square) {
          for (let x = 0; x < 120; x += square) {
            if (((x / square) + (y / square)) % 2 === 0) {
              ctx.fillRect(x, y, square, square);
            }
          }
        }

        const sourceX = (playFrame % cols) * cellW;
        const sourceY = Math.min(activePlayRow, rows - 1) * cellH;

        ctx.drawImage(
          importedImage,
          sourceX,
          sourceY,
          cellW,
          cellH,
          10,
          10,
          100,
          100
        );
      }
    }
  }, [importedImage, cols, rows, playFrame, activePlayRow]);

  return (
    <div id="import-exporter-manager" className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6">
      
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2" id="importer-title">
          <Upload className="w-5 h-5 text-indigo-400" id="icon-upload" />
          <span>Spritesheet & Config Importer (Загрузка Спрайтов и Конфигов)</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Загружайте ваши сохраненные конфигурации игры или импортируйте сторонние спрайт-листы для нарезки и анимационного теста.
        </p>
      </div>

      {/* Two cards: Left - JSON Config. Right - Image Spritesheet Slicer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Configuration Management */}
        <div className="bg-slate-950/50 border border-slate-800/80 p-5 rounded-xl flex flex-col gap-4">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <FileCode className="w-4 h-4" />
            <span>JSON Editor State Management</span>
          </div>
          
          <p className="text-xs text-slate-400 leading-relaxed">
            Вы можете экспортировать текущую палитру, размеры и параметры анимации в файл <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300 font-mono text-[10px]">.json</code>, чтобы позже загрузить его обратно и быстро продолжить работу над персонажами игры.
          </p>

          <div className="flex flex-col gap-3 mt-2">
            <div className="flex flex-wrap gap-2">
              {/* Load input */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Загрузить JSON</span>
              </button>
              
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleJsonUpload}
                className="hidden"
              />

              {/* Save Button */}
              <button
                onClick={handleExportJson}
                className="px-3.5 py-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer transition-all"
              >
                Экспортировать JSON
              </button>

              {/* Presets Library Button */}
              <button
                onClick={() => setIsPresetsModalOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-950/20"
                id="open-presets-btn"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Библиотека пресетов ({savedPresets.length + DEFAULT_PRESETS.length})</span>
              </button>
            </div>

            {/* Notification messages */}
            {jsonSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20">
                <Check className="w-4 h-4" />
                <span>Конфигурация успешно импортирована в редактор!</span>
              </div>
            )}

            {jsonError && (
              <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 p-2.5 rounded border border-red-500/20">
                <AlertCircle className="w-4 h-4" />
                <span>{jsonError}</span>
              </div>
            )}
          </div>
          
          {/* Metadata view info */}
          <div className="mt-2 pt-3 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex flex-col gap-1">
            <span>👤 Active Species: {currentConfig.characterType}</span>
            <span>🌈 Primary Palette: {currentConfig.primaryColor}</span>
            <span>📦 Sizing Multiplier: {currentConfig.bodySize}</span>
          </div>
        </div>

        {/* Card 2: Interactive Slicer */}
        <div className="bg-slate-950/50 border border-slate-800/80 p-5 rounded-xl flex flex-col gap-4">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
            <ImageIcon className="w-4 h-4" />
            <span>External Image Slicer / Animator</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Перетащите сюда или загрузите любой собственный файл спрайтов формата PNG/JPG (например, кадры вашей игры <code className="text-slate-200">TheEnd-</code>). Настройте сетку строк/колонок для тестирования анимации.
          </p>

          <div>
            <button
              onClick={() => sheetInputRef.current?.click()}
              className="w-full py-4 rounded-lg border-2 border-dashed border-slate-800 hover:border-indigo-500 bg-slate-900/35 hover:bg-slate-900/60 transition-all flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 cursor-pointer text-xs"
            >
              <Upload className="w-5 h-5 text-slate-500" />
              <span>Выберите изображение спрайт-листа</span>
              <span className="text-[10px] text-slate-600 font-mono">PNG, JPG или WEBP</span>
            </button>
            <input
              type="file"
              ref={sheetInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </div>

      </div>

      {/* Expandable Workspace section for uploaded spritesheets */}
      {importedImage && (
        <div className="border border-slate-800 bg-slate-950/60 p-5 rounded-xl flex flex-col gap-6 animate-fade-in" id="slicer-workspace">
          
          <div className="flex flex-wrap justify-between items-center pb-3 border-b border-slate-800 gap-4">
            <div>
              <span className="text-xs font-black text-indigo-400 uppercase tracking-widest block font-mono">Slicing Studio Workspace</span>
              <span className="text-xs text-slate-400 font-medium">Спрайт-лист: {importedImage.naturalWidth}x{importedImage.naturalHeight}px</span>
            </div>

            <div className="flex gap-1.5 flex-wrap" id="presets-container">
              <span className="text-[10px] font-mono text-slate-500 flex items-center mr-1">Presets:</span>
              <button onClick={() => applyPresetSlicing(8, 4)} className="py-1 px-2 rounded bg-slate-900 text-[10px] text-slate-300 hover:bg-slate-800 cursor-pointer">8x4 (Classic)</button>
              <button onClick={() => applyPresetSlicing(6, 6)} className="py-1 px-2 rounded bg-slate-900 text-[10px] text-slate-300 hover:bg-slate-800 cursor-pointer">6x6 Grid</button>
              <button onClick={() => applyPresetSlicing(8, 8)} className="py-1 px-2 rounded bg-slate-900 text-[10px] text-slate-300 hover:bg-slate-800 cursor-pointer">8x8 Grid</button>
              <button onClick={() => applyPresetSlicing(4, 4)} className="py-1 px-2 rounded bg-slate-900 text-[10px] text-slate-300 hover:bg-slate-800 cursor-pointer">4x4 Grid</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left sliders */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              
              {/* Cols */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5 text-indigo-400" /> Columns (Колонки/Кадры)</span>
                  <span className="text-indigo-400 font-mono">{cols}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="24"
                  value={cols}
                  onChange={(e) => {
                    setCols(parseInt(e.target.value));
                    setPlayFrame(0);
                  }}
                  className="w-full accent-indigo-500 h-1 rounded bg-slate-950 cursor-pointer"
                />
              </div>

              {/* Rows */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5 text-indigo-400" /> Rows (Строки анимации)</span>
                  <span className="text-indigo-400 font-mono">{rows}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="24"
                  value={rows}
                  onChange={(e) => {
                    setRows(parseInt(e.target.value));
                    setActivePlayRow(Math.min(activePlayRow, parseInt(e.target.value) - 1));
                    setPlayFrame(0);
                  }}
                  className="w-full accent-indigo-500 h-1 rounded bg-slate-950 cursor-pointer"
                />
              </div>

              {/* Choose row to animate */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-300">Select Row to Play (Текущая строка анимации):</span>
                <div className="flex flex-wrap gap-1 leading-none max-h-[85px] overflow-y-auto bg-slate-950 p-2 rounded-lg border border-slate-900">
                  {Array.from({ length: rows }).map((_, rIdx) => (
                    <button
                      key={rIdx}
                      onClick={() => {
                        setActivePlayRow(rIdx);
                        setPlayFrame(0);
                      }}
                      className={`py-1 px-3.5 text-xs rounded font-mono font-bold transition-all cursor-pointer ${
                        activePlayRow === rIdx
                          ? 'bg-indigo-600 text-white font-extrabold'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      Row {rIdx}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fps slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-300">
                  <span>Playback Speed (Скорость прокрутки)</span>
                  <span className="text-rose-455 font-mono text-rose-400">{fps} FPS</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="30"
                  value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value))}
                  className="w-full accent-rose-500 h-1 rounded bg-slate-950 cursor-pointer"
                />
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                    isPlaying 
                      ? 'bg-rose-600/20 text-rose-305 border border-rose-500/20' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Пауза</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Воспроизведение</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setPlayFrame(0)}
                  className="flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white cursor-pointer hover:bg-slate-800 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Перезапустить фрейм</span>
                </button>
              </div>

            </div>

            {/* Middle: Grid preview mapping */}
            <div className="lg:col-span-4 flex flex-col gap-2 items-center justify-center">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider self-start">Grid Sheet Map</span>
              <div className="w-full h-48 border border-slate-800 bg-slate-950 rounded-xl overflow-auto flex items-center justify-center p-3 relative shadow-inner">
                <canvas
                  ref={sheetGridCanvasRef}
                  className="block max-w-full max-h-full"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            </div>

            {/* Right: Sliced cell dynamic viewport */}
            <div className="lg:col-span-3 flex flex-col gap-2 items-center justify-center">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider self-start">Active Animation Preview</span>
              <div className="w-full h-48 border border-indigo-900/35 bg-slate-950 rounded-xl flex flex-col items-center justify-center p-4 shadow-xl">
                <canvas
                  ref={spritePreviewCanvasRef}
                  className="block rounded-lg shadow-xl"
                  style={{ width: 100, height: 100, imageRendering: 'pixelated' }}
                />
                <span className="text-[10px] font-mono text-slate-400 mt-2">
                  Frame #{playFrame % cols} of Row #{activePlayRow}
                </span>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Close presets library on escape key */}
      {(() => {
        useEffect(() => {
          if (!isPresetsModalOpen) return;
          const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
              setIsPresetsModalOpen(false);
            }
          };
          window.addEventListener('keydown', handleEscape);
          return () => window.removeEventListener('keydown', handleEscape);
        }, [isPresetsModalOpen]);
        return null;
      })()}

      {/* PRESETS LIBRARY MODAL */}
      {isPresetsModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          id="presets-modal-overlay"
          onClick={() => setIsPresetsModalOpen(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl relative animate-scale-in"
            id="presets-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 animate-pulse">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    Библиотека пресетов персонажа (Character Presets Library)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Загружайте готовые шаблоны или храните свои уникальные билды в памяти браузера
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsPresetsModalOpen(false)}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-950/20 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all cursor-pointer"
                title="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-thin">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Save current config form */}
                <form 
                  onSubmit={handleSavePreset} 
                  className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex flex-col gap-3"
                  id="save-preset-form"
                >
                  <div className="flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300">Сохранить текущую заготовку</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Зафиксируйте палитру, экипировку, расу и пропорции активного персонажа, чтобы в один клик возвращаться к этому билду.
                  </p>

                  <div className="flex flex-col gap-2">
                    <input 
                      type="text"
                      required
                      placeholder="Имя заготовки (напр. Паладин Бездны, Ледяная Сирена...)"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      className="w-full text-xs font-medium px-3 py-2 rounded border border-slate-800 bg-slate-100/5 text-slate-200 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                    <input 
                      type="text"
                      placeholder="Краткое описание / особенности заготовки (необязательно)"
                      value={newPresetDesc}
                      onChange={(e) => setNewPresetDesc(e.target.value)}
                      className="w-full text-xs font-medium px-3 py-2 rounded border border-slate-800 bg-slate-100/5 text-slate-200 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2 px-3 rounded bg-emerald-600 hover:bg-emerald-505 text-white font-bold text-xs transition-all uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-emerald-900/30"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Добавить в библиотеку</span>
                  </button>
                </form>

                {/* Search & Description Info */}
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex flex-col justify-between gap-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-indigo-400">
                      <Search className="w-4 h-4" />
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300">Поиск пресетов и фильтрация</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Используйте быстрый поиск по классам, типам встроенного оружия, классу персонажа или конкретной расе.
                    </p>
                  </div>

                  {/* Search box */}
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input 
                      type="text"
                      placeholder="Введите класс (elf, mage, dwarf...), цвет или имя..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs font-medium pl-9 pr-3 py-2 rounded border border-slate-800 bg-slate-100/5 text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-2 flex items-center justify-center p-0.5 rounded-full hover:bg-slate-800 font-bold hover:text-white text-slate-400 cursor-pointer"
                        title="Очистить"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="text-[10px] text-indigo-400/80 font-mono flex items-center gap-1.5 bg-indigo-950/20 p-2 rounded border border-indigo-900/30">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Шаблоны сохраняются в Вашем LocalStorage. Экспортируйте в .json, если хотите перенести их на новое устройство!</span>
                  </div>
                </div>

              </div>

              {/* Presets List Block */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Доступные заготовки и пресеты</span>
                  </span>
                  
                  <span className="text-[10px] font-mono text-slate-500">
                    Найдено: {
                      [...DEFAULT_PRESETS, ...savedPresets].filter(preset => {
                        const query = searchQuery.toLowerCase().trim();
                        if (!query) return true;
                        return (
                          preset.name.toLowerCase().includes(query) ||
                          preset.description.toLowerCase().includes(query) ||
                          preset.config.characterType.toLowerCase().includes(query) ||
                          (preset.config.humanoidRace && preset.config.humanoidRace.toLowerCase().includes(query))
                        );
                      }).length
                    }
                  </span>
                </div>

                {/* Presets Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[38vh] overflow-y-auto pr-1 scrollbar-thin">
                  {[...DEFAULT_PRESETS, ...savedPresets]
                    .filter(preset => {
                      const query = searchQuery.toLowerCase().trim();
                      if (!query) return true;
                      return (
                        preset.name.toLowerCase().includes(query) ||
                        preset.description.toLowerCase().includes(query) ||
                        preset.config.characterType.toLowerCase().includes(query) ||
                        (preset.config.humanoidRace && preset.config.humanoidRace.toLowerCase().includes(query))
                      );
                    })
                    .map((preset) => {
                      const isActive = 
                        currentConfig.characterType === preset.config.characterType &&
                        currentConfig.primaryColor === preset.config.primaryColor &&
                        currentConfig.secondaryColor === preset.config.secondaryColor &&
                        currentConfig.equipWeapon === preset.config.equipWeapon;

                      return (
                        <div 
                          key={preset.id}
                          onClick={() => handleLoadPreset(preset)}
                          className={`flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-indigo-600/10 border-indigo-500 shadow-md shadow-indigo-950/20' 
                              : 'bg-slate-950/30 border-slate-800 hover:border-slate-700 hover:bg-slate-950/50'
                          }`}
                        >
                          {/* Upper content */}
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-start gap-1">
                              <span className={`text-xs font-bold leading-snug ${isActive ? 'text-indigo-400' : 'text-slate-200'}`}>
                                {preset.name}
                              </span>
                              
                              {preset.isCustom && (
                                <button 
                                  type="button"
                                  onClick={(e) => handleDeletePreset(preset.id, e)}
                                  className="text-slate-500 hover:text-rose-450 hover:text-rose-400 p-1 rounded hover:bg-slate-800 shrink-0 cursor-pointer transition-all"
                                  title="Удалить пресет"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-400 leading-normal line-clamp-2 hover:line-clamp-none transition-all">
                              {preset.description}
                            </p>

                            {/* Tags and circles */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {/* Character type tag */}
                              <span className="bg-indigo-950/50 border border-indigo-800/30 text-indigo-400 font-mono text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tight">
                                {preset.config.characterType}
                              </span>

                              {/* Race tag */}
                              {preset.config.humanoidRace && (
                                <span className="bg-emerald-950/50 border border-emerald-805 text-emerald-400 font-mono text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tight">
                                  {preset.config.humanoidRace}
                                </span>
                              )}

                              {/* Weapon tag */}
                              <span className="bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[9px] px-1.5 py-0.5 rounded uppercase tracking-tight">
                                {preset.config.equipWeapon || 'none'}
                              </span>

                              {/* Overlapping colors */}
                              <div className="flex -space-x-1 items-center ml-auto shrink-0" title="Палитра">
                                <span className="w-3 h-3 rounded-full border border-slate-900 shadow-inner block" style={{ backgroundColor: preset.config.primaryColor }} />
                                <span className="w-3 h-3 rounded-full border border-slate-900 shadow-inner block" style={{ backgroundColor: preset.config.secondaryColor }} />
                                <span className="w-3 h-3 rounded-full border border-slate-900 shadow-inner block" style={{ backgroundColor: preset.config.accentColor }} />
                              </div>
                            </div>
                          </div>

                          {/* Lower Actions */}
                          <div className="flex gap-1.5 mt-4">
                            <span 
                              className={`flex-1 py-1.5 px-3 rounded text-[11px] font-bold text-center transition-all ${
                                isActive 
                                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-indigo-600/20 hover:bg-indigo-600 text-indigo-305 text-indigo-200 border border-indigo-500/10'
                              }`}
                            >
                              {isActive ? 'Применено ✓' : 'Нажмите, чтобы применить'}
                            </span>

                            <button 
                              type="button"
                              onClick={(e) => handleCopyPresetJson(preset, e)}
                              className="p-1.5 rounded border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all text-xs cursor-pointer inline-flex items-center justify-center shrink-0"
                              title="Скопировать JSON конфигурацию пресета"
                            >
                              {copiedPresetId === preset.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button 
                              type="button"
                              onClick={(e) => handleExportPresetJson(preset, e)}
                              className="p-1.5 rounded border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all text-xs cursor-pointer inline-flex items-center justify-center shrink-0"
                              title="Скачать JSON пресета в файл"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>

                        </div>
                      );
                    })}

                  {[...DEFAULT_PRESETS, ...savedPresets].filter(preset => {
                    const query = searchQuery.toLowerCase().trim();
                    if (!query) return true;
                    return (
                      preset.name.toLowerCase().includes(query) ||
                      preset.description.toLowerCase().includes(query) ||
                      preset.config.characterType.toLowerCase().includes(query) ||
                      (preset.config.humanoidRace && preset.config.humanoidRace.toLowerCase().includes(query))
                    );
                  }).length === 0 && (
                    <div className="col-span-full py-12 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/10 text-center flex flex-col justify-center items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-600 animate-bounce" />
                      <span className="text-xs text-slate-500 italic font-mono">Ничего не найдено по запросу "{searchQuery}"</span>
                      <button 
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="py-1 px-2.5 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[10px] font-bold text-slate-400 cursor-pointer"
                      >
                        Сбросить фильтр
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-800 flex justify-between items-center bg-slate-950/20 rounded-b-2xl">
              <span className="text-[10px] font-mono text-slate-500">
                AI Studio Presets Hub • Версия 1.1
              </span>
              <button 
                onClick={() => setIsPresetsModalOpen(false)}
                className="py-1 px-4 rounded border border-slate-800 bg-slate-950/40 hover:bg-slate-850 hover:text-white transition-all text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Закрыть окно
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
