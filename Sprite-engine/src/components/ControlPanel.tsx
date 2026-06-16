import React, { useState } from 'react';
import { WolfConfig, AnimationDefinition, CharacterType } from '../types';
import { 
  Sparkles, Palette, Sliders, Layers, Monitor, 
  PawPrint, Sword, Wand, Skull, Hammer, Shield, 
  Plus, User, Flame, Settings, Zap, UploadCloud, Compass,
  ArrowUp, ArrowDown, RefreshCw, Library
} from 'lucide-react';

interface ControlPanelProps {
  config: WolfConfig;
  setConfig: React.Dispatch<React.SetStateAction<WolfConfig>>;
}

interface PresetTheme {
  name: string;
  characterType: CharacterType;
  description: string;
  config: Partial<WolfConfig>;
}

// Custom defined presets
const PRESETS: PresetTheme[] = [
  {
    name: 'Timber Wolf',
    characterType: 'wolf',
    description: 'Classic grey wolf with light markings and golden eyes.',
    config: {
      primaryColor: '#7a7f85',
      secondaryColor: '#4f5257',
      accentColor: '#d6dadf',
      eyeColor: '#ffbf00',
      eyeGlow: true,
      snoutLength: 1.1,
      tailLength: 1.0,
      earSize: 1.0,
    },
  },
  {
    name: 'Red Fox',
    characterType: 'wolf',
    description: 'Bright red fox with white accents and a fluffy long tail.',
    config: {
      primaryColor: '#e05a10',
      secondaryColor: '#cc4e0c',
      accentColor: '#f1f5f9',
      eyeColor: '#eab308',
      eyeGlow: true,
      snoutLength: 1.3,
      tailLength: 1.45,
      earSize: 1.15,
    },
  },
  {
    name: 'Forest Bear',
    characterType: 'wolf',
    description: 'Chubby honey bear with a very short tail and rounded small ears.',
    config: {
      primaryColor: '#5c3a21',
      secondaryColor: '#3d2516',
      accentColor: '#8a5a36',
      eyeColor: '#d97706',
      eyeGlow: false,
      snoutLength: 0.65,
      tailLength: 0.35,
      earSize: 0.65,
    },
  },
  {
    name: 'Black Panther',
    characterType: 'wolf',
    description: 'Sleek dark leopard style with luminous green pupils.',
    config: {
      primaryColor: '#1e1e24',
      secondaryColor: '#0f0f12',
      accentColor: '#2b2b35',
      eyeColor: '#22c55e',
      eyeGlow: true,
      snoutLength: 0.75,
      tailLength: 1.3,
      earSize: 0.75,
    },
  },
  {
    name: 'Shadow Stalker',
    characterType: 'wolf',
    description: 'Pitch obsidian fur with ruby lasers glowing in the dusk.',
    config: {
      primaryColor: '#1e1e24',
      secondaryColor: '#0f0f12',
      accentColor: '#3a3a45',
      eyeColor: '#ff0055',
      eyeGlow: true,
      snoutLength: 1.25,
      tailLength: 1.25,
      earSize: 1.15,
    },
  },
  {
    name: 'Crimson Crusader',
    characterType: 'humanoid',
    description: 'Classic knight in scarlet alloy plating, gold ornaments, and cyan visor.',
    config: {
      humanoidRace: 'human',
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
      skinColor: '#ffedd5',
      hairColor: '#eab308',
      bodyHeight: 1.0,
      bellySize: 1.0,
      armSize: 1.0,
    },
  },
  {
    name: 'Elf Ranger Ranger',
    characterType: 'humanoid',
    description: 'Stealthy elven archer in woodland cowl holding recurve composite bow.',
    config: {
      humanoidRace: 'elf',
      primaryColor: '#15803d',
      secondaryColor: '#eab308',
      accentColor: '#78350f',
      eyeColor: '#34d399',
      eyeGlow: true,
      equipHelmet: false,
      equipChestplate: true,
      equipGloves: false,
      equipBoots: true,
      equipBelt: true,
      equipShield: false,
      equipWeapon: 'bow',
      skinColor: '#ffeedd',
      hairColor: '#fbbf24',
      bodyHeight: 1.05,
      bellySize: 0.8,
      armSize: 0.9,
    },
  },
  {
    name: 'Dwarven Barbarian',
    characterType: 'humanoid',
    description: 'Giant-bearded stout mountain defender wielding massive metal battle axe.',
    config: {
      humanoidRace: 'dwarf',
      primaryColor: '#b45309',
      secondaryColor: '#f59e0b',
      accentColor: '#475569',
      eyeColor: '#eab308',
      eyeGlow: false,
      equipHelmet: false,
      equipChestplate: true,
      equipGloves: true,
      equipBoots: true,
      equipBelt: true,
      equipShield: true,
      equipWeapon: 'axe',
      skinColor: '#ffedd5',
      hairColor: '#ea580c',
      bodyHeight: 0.75,
      bellySize: 1.45,
      armSize: 1.15,
    },
  },
  {
    name: 'Orc Overlord',
    characterType: 'humanoid',
    description: 'Feral green-skinned hulk wielding broad steel halberd polearm.',
    config: {
      humanoidRace: 'orc',
      primaryColor: '#1e3a8a',
      secondaryColor: '#ecc94b',
      accentColor: '#64748b',
      eyeColor: '#ef4444',
      eyeGlow: true,
      equipHelmet: true,
      equipChestplate: true,
      equipGloves: true,
      equipBoots: true,
      equipBelt: true,
      equipShield: false,
      equipWeapon: 'halberd',
      skinColor: '#16a34a',
      hairColor: '#111827',
      bodyHeight: 1.25,
      bellySize: 1.35,
      armSize: 1.25,
    },
  },
  {
    name: 'Skeletal Legionary',
    characterType: 'humanoid',
    description: 'Bone ash skeleton equipped with ancient rusty shield and javelin.',
    config: {
      humanoidRace: 'skeleton',
      primaryColor: '#4b5563',
      secondaryColor: '#93c5fd',
      accentColor: '#7c2d12',
      eyeColor: '#60a5fa',
      eyeGlow: true,
      equipHelmet: true,
      equipChestplate: false,
      equipGloves: false,
      equipBoots: false,
      equipBelt: true,
      equipShield: true,
      equipWeapon: 'spear_throw',
      skinColor: '#f8fafc',
      hairColor: '#cbd5e1',
      bodyHeight: 1.0,
      bellySize: 0.65,
      armSize: 0.75,
    },
  },
  {
    name: 'Vampire Noble',
    characterType: 'humanoid',
    description: 'Pale marble vampire casting high arcane mystical staff barriers.',
    config: {
      humanoidRace: 'vampire',
      primaryColor: '#000000',
      secondaryColor: '#dc2626',
      accentColor: '#1e1b4b',
      eyeColor: '#ff0000',
      eyeGlow: true,
      equipHelmet: false,
      equipChestplate: true,
      equipGloves: true,
      equipBoots: true,
      equipBelt: true,
      equipShield: false,
      equipWeapon: 'staff',
      skinColor: '#f1f5f9',
      hairColor: '#1e293b',
      bodyHeight: 1.15,
      bellySize: 0.88,
      armSize: 0.95,
    },
  },
  {
    name: 'Infernal Fiend',
    characterType: 'monster',
    description: 'Volcanic beast body forged of lava rocks holding dark spikes.',
    config: {
      primaryColor: '#3f3f46',
      secondaryColor: '#ea580c',
      accentColor: '#991b1b',
      eyeColor: '#fbbf24',
      eyeGlow: true,
      snoutLength: 1.25,
      tailLength: 1.1,
      earSize: 1.2,
    },
  }
];

export interface PosePreset {
  id: string;
  name: string;
  description: string;
  isCustom?: boolean;
  config: {
    bodyHeight: number;
    armSize: number;
    bellySize: number;
    tailLength: number;
    earSize: number;
    snoutLength: number;
    bodySize: number;
  };
}

export const DEFAULT_POSES: PosePreset[] = [
  {
    id: 'default',
    name: '🚶 Пропорциональная (Standard)',
    description: 'Идеально сбалансированные пропорции по умолчанию.',
    config: {
      bodyHeight: 1.0,
      armSize: 1.0,
      bellySize: 1.0,
      tailLength: 1.0,
      earSize: 1.0,
      snoutLength: 1.0,
      bodySize: 1.0,
    }
  },
  {
    id: 'chibi',
    name: '👶 Чиби / Карлик (Chibi / Mini)',
    description: 'Крупная голова, уплотненный торс и короткие лапки.',
    config: {
      bodyHeight: 0.65,
      armSize: 0.7,
      bellySize: 1.25,
      tailLength: 0.65,
      earSize: 1.35,
      snoutLength: 0.75,
      bodySize: 0.75,
    }
  },
  {
    id: 'giant',
    name: '👹 Гигант / Зверь (Giant / Beast)',
    description: 'Мощная спина, длинные накачанные руки и крупный силуэт.',
    config: {
      bodyHeight: 1.35,
      armSize: 1.3,
      bellySize: 1.4,
      tailLength: 1.25,
      earSize: 1.15,
      snoutLength: 1.25,
      bodySize: 1.3,
    }
  },
  {
    id: 'lank',
    name: '🕴️ Вытянутая / Худая (Lanky / Slender)',
    description: 'Стройное узкое телосложение и удлиненный грациозный рост.',
    config: {
      bodyHeight: 1.4,
      armSize: 1.05,
      bellySize: 0.6,
      tailLength: 1.1,
      earSize: 1.2,
      snoutLength: 1.0,
      bodySize: 1.15,
    }
  },
  {
    id: 'combat',
    name: '⚔️ Атлетичный Боец (Athletic / Fighter)',
    description: 'Оптимизирован для боевых выпадов, широкого размаха рук и крепкой стопы.',
    config: {
      bodyHeight: 1.1,
      armSize: 1.15,
      bellySize: 0.85,
      tailLength: 1.2,
      earSize: 1.0,
      snoutLength: 1.0,
      bodySize: 1.1,
    }
  },
  {
    id: 'dwarf',
    name: '🍺 Коренастая / Дварф (Heavy / Dwarf)',
    description: 'Плотный круглый живот, короткие конечности и максимальная устойчивость.',
    config: {
      bodyHeight: 0.75,
      armSize: 1.1,
      bellySize: 1.5,
      tailLength: 0.8,
      earSize: 0.9,
      snoutLength: 0.9,
      bodySize: 0.9,
    }
  }
];

export const ControlPanel: React.FC<ControlPanelProps> = ({ config, setConfig }) => {
  const [activeTab, setActiveTab] = useState<'species' | 'anatomy' | 'wardrobe' | 'fx' | 'rendering' | 'poses'>('species');

  // Custom animation maker inputs
  const [customAnimName, setCustomAnimName] = useState<string>('');
  const [customAnimFrames, setCustomAnimFrames] = useState<number>(6);
  const [customAnimBase, setCustomAnimBase] = useState<'idle' | 'walk' | 'run' | 'attack' | 'defense'>('attack');

  // Pose Library States & Helpers
  const [customPoses, setCustomPoses] = useState<PosePreset[]>(() => {
    try {
      const saved = localStorage.getItem('humanoid_custom_poses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newPoseName, setNewPoseName] = useState<string>('');
  const [newPoseDesc, setNewPoseDesc] = useState<string>('');
  const [jsonPasteValue, setJsonPasteValue] = useState<string>('');
  const [importError, setImportError] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const saveCustomPoses = (newPoses: PosePreset[]) => {
    setCustomPoses(newPoses);
    try {
      localStorage.setItem('humanoid_custom_poses', JSON.stringify(newPoses));
    } catch (e) {
      console.error('LocalStorage write failed:', e);
    }
  };

  const applyPoseConfig = (parsedData: any) => {
    let targetConfig: any = {};
    const source = parsedData.config && typeof parsedData.config === 'object' ? parsedData.config : parsedData;
    const fieldsToImport = ['bodyHeight', 'armSize', 'bellySize', 'tailLength', 'earSize', 'snoutLength', 'bodySize'];
    
    fieldsToImport.forEach(field => {
      const val = source[field];
      if (typeof val === 'number' && !isNaN(val)) {
        targetConfig[field] = val;
      } else {
        targetConfig[field] = config[field as keyof WolfConfig] !== undefined ? config[field as keyof WolfConfig] : 1.0;
      }
    });

    setConfig((prev) => ({
      ...prev,
      ...targetConfig
    }));
  };

  const handleSaveCurrentPose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoseName.trim()) return;

    const newPose: PosePreset = {
      id: 'custom_' + Date.now(),
      name: '⭐ ' + newPoseName.trim(),
      description: newPoseDesc.trim() || 'Пользовательская конфигурация пропорций тела.',
      isCustom: true,
      config: {
        bodyHeight: config.bodyHeight !== undefined ? config.bodyHeight : 1.0,
        armSize: config.armSize !== undefined ? config.armSize : 1.0,
        bellySize: config.bellySize !== undefined ? config.bellySize : 1.0,
        tailLength: config.tailLength !== undefined ? config.tailLength : 1.0,
        earSize: config.earSize !== undefined ? config.earSize : 1.0,
        snoutLength: config.snoutLength !== undefined ? config.snoutLength : 1.0,
        bodySize: config.bodySize !== undefined ? config.bodySize : 1.0,
      }
    };

    const updated = [...customPoses, newPose];
    saveCustomPoses(updated);
    setNewPoseName('');
    setNewPoseDesc('');
    alert(`Поза "${newPose.name}" успешно сохранена в вашей личной библиотеке!`);
  };

  const handleDeletePose = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить эту позу?')) return;
    const updated = customPoses.filter(p => p.id !== id);
    saveCustomPoses(updated);
  };

  const downloadPoseJson = (pose: PosePreset, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanConfig = {
      bodyHeight: pose.config.bodyHeight,
      armSize: pose.config.armSize,
      bellySize: pose.config.bellySize,
      tailLength: pose.config.tailLength,
      earSize: pose.config.earSize,
      snoutLength: pose.config.snoutLength,
      bodySize: pose.config.bodySize
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      name: pose.name,
      description: pose.description,
      config: cleanConfig
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${pose.name.replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, '_')}_pose.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const copyPoseToClipboard = (pose: PosePreset, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanConfig = {
      bodyHeight: pose.config.bodyHeight,
      armSize: pose.config.armSize,
      bellySize: pose.config.bellySize,
      tailLength: pose.config.tailLength,
      earSize: pose.config.earSize,
      snoutLength: pose.config.snoutLength,
      bodySize: pose.config.bodySize
    };
    const jsonStr = JSON.stringify(cleanConfig, null, 2);
    try {
      navigator.clipboard.writeText(jsonStr);
      setCopiedId(pose.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = jsonStr;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedId(pose.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const updateField = <K extends keyof WolfConfig>(key: K, value: WolfConfig[K]) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const moveLayer = (index: number, direction: 'up' | 'down') => {
    const currentOrder = [...(config.layerOrder || ['cape', 'back_leg', 'torso', 'front_leg', 'back_arm', 'head', 'front_arm'])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < currentOrder.length) {
      const temp = currentOrder[index];
      currentOrder[index] = currentOrder[targetIndex];
      currentOrder[targetIndex] = temp;
      updateField('layerOrder', currentOrder);
    }
  };

  const applyPreset = (preset: PresetTheme) => {
    setConfig((prev) => ({
      ...prev,
      ...preset.config,
      characterType: preset.characterType
    }));
  };

  const setSubRacePresetColors = (race: 'human' | 'elf' | 'dwarf' | 'orc' | 'undead' | 'vampire' | 'skeleton') => {
    let skin = '#ffedd5';
    let hair = '#eab308';
    let underwear = '#2563eb';
    let hStyle = config.hairStyle;

    if (race === 'orc') {
      skin = '#16a34a';
      hair = '#111827';
      hStyle = 'crest';
    } else if (race === 'undead') {
      skin = '#64748b';
      hair = '#475569';
      hStyle = 'long';
    } else if (race === 'vampire') {
      skin = '#f1f5f9';
      underwear = '#7f1d1d';
      hair = '#020617';
      hStyle = 'long';
    } else if (race === 'skeleton') {
      skin = '#f8fafc';
      underwear = '#1e293b';
      hair = '#f8fafc';
      hStyle = 'none';
    } else if (race === 'elf') {
      skin = '#fae8ff';
      hair = '#facc15';
      hStyle = 'long';
    } else if (race === 'dwarf') {
      skin = '#fef3c7';
      hair = '#ea580c';
      hStyle = 'braids';
    }

    setConfig((prev) => ({
      ...prev,
      humanoidRace: race,
      skinColor: skin,
      hairColor: hair,
      underwearColor: underwear,
      hairStyle: hStyle,
    }));
  };

  const handleAddCustomAnimation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAnimName.trim()) return;

    const key = customAnimName.toLowerCase().replace(/\s+/g, '_');
    const newDef: AnimationDefinition = {
      type: key as any,
      name: customAnimName,
      frameCount: customAnimFrames,
      description: `Custom biped pose of template '${customAnimBase}' created by user.`,
      row: Object.keys(config.customAnimations || {}).length + 10, // offsets rows safely
    };

    setConfig((prev) => {
      const updatedAnims = { ...(prev.customAnimations || {}), [key]: newDef };
      return {
        ...prev,
        customAnimations: updatedAnims
      };
    });

    setCustomAnimName('');
    alert(`Анимация '${customAnimName}' успешно сохранена в IDE! Она добавлена на лист спрайтов.`);
  };

  const activeChar = config.characterType || 'wolf';
  const filteredPresets = PRESETS.filter(p => p.characterType === activeChar);

  return (
    <div id="control-panel-root" className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col gap-5 text-slate-200">
      
      {/* TIDY COHESIVE CATEGORY TABS */}
      <div className="flex border-b border-slate-800/80 -mx-5 px-5 pb-0.5 overflow-x-auto scrollbar-none gap-2" id="category-tabs-row">
        {[
          { id: 'species', label: '🧬 Раса', icon: User },
          { id: 'anatomy', label: '📐 Анатомия', icon: Sliders },
          { id: 'wardrobe', label: '⚔️ Снаряжение', icon: Shield },
          { id: 'poses', label: '🥋 Позы / Рост', icon: Library },
          { id: 'fx', label: '✨ Эффекты', icon: Flame },
          { id: 'rendering', label: '⚙️ Настройки', icon: Monitor },
        ].map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 pb-2.5 px-1 bg-transparent border-b-2 font-bold text-xs whitespace-nowrap cursor-pointer transition-all ${
                isActive 
                  ? 'border-indigo-500 text-indigo-400 font-extrabold shadow-sm' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <IconComp className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* --- TAB CONTENT: SPECIES & PRESETS --- */}
      {activeTab === 'species' && (
        <div className="flex flex-col gap-4 animate-fade-in" id="panel-tab-species">
          {/* Active species base selector */}
          <div>
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-2">Основной тип модели</span>
            <div className="grid grid-cols-3 gap-2" id="main-character-type-selector">
              {[
                { id: 'humanoid', label: '👥 Гуманоид', color: 'bg-indigo-500/15 border-indigo-500 text-slate-200' },
                { id: 'monster', label: '👺 Монстр', color: 'bg-yellow-500/15 border-yellow-500 text-slate-200' },
                { id: 'wolf', label: '🐺 Животное', color: 'bg-rose-500/15 border-rose-500 text-slate-200' },
              ].map((char) => {
                const isSel = activeChar === char.id;
                return (
                  <button
                    key={char.id}
                    onClick={() => {
                      updateField('characterType', char.id as any);
                      const matched = PRESETS.find(p => p.characterType === char.id);
                      if (matched) applyPreset(matched);
                    }}
                    className={`py-2 px-1 rounded-xl border text-[11px] font-bold text-center cursor-pointer transition-all ${
                      isSel 
                        ? char.color 
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800/20'
                    }`}
                  >
                    {char.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub-race subselector for biped model */}
          {activeChar === 'humanoid' && (
            <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl flex flex-col gap-2.5 animate-fade-in" id="humanoid-subraces">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">🧬 Подраса Гуманоида</span>
              <div className="grid grid-cols-4 sm:grid-cols-4 gap-1.5" id="race-preset-selectors">
                {[
                  { id: 'human', label: 'Человек' },
                  { id: 'elf', label: 'Эльф' },
                  { id: 'dwarf', label: 'Гном' },
                  { id: 'orc', label: 'Орк' },
                  { id: 'undead', label: 'Нечисть' },
                  { id: 'vampire', label: 'Вампир' },
                  { id: 'skeleton', label: 'Скелет' },
                ].map((race) => {
                  const isSel = config.humanoidRace === race.id;
                  return (
                    <button
                      key={race.id}
                      onClick={() => setSubRacePresetColors(race.id as any)}
                      className={`py-1 hover:border-slate-600 rounded text-[10px] text-center font-bold transition-all border ${
                        isSel 
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200' 
                          : 'bg-slate-900 border-slate-850 text-slate-400 hover:bg-slate-850'
                      }`}
                    >
                      {race.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Prebuilt color schemes */}
          <div>
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-2">Готовые Схемы Пресетов</span>
            <div className="grid grid-cols-2 gap-2" id="presets-grid">
              {filteredPresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="flex flex-col text-left p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/30 hover:bg-slate-850 transition-all cursor-pointer hover:border-slate-700"
                >
                  <span className="font-bold text-xs text-indigo-300">{preset.name}</span>
                  <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 leading-tight">{preset.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: ANATOMY & WORKSPACE BODY SLIDERS --- */}
      {activeTab === 'anatomy' && (
        <div className="flex flex-col gap-4.5 animate-fade-in" id="panel-tab-anatomy">
          {activeChar === 'wolf' ? (
            <div className="flex flex-col gap-4 p-3.5 bg-slate-950/20 rounded-xl border border-slate-800/60" id="animal-anatomy-sliders">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-1">Пропорции Тела Животного</span>
              
              {/* 1. Tail Length */}
              <div className="flex flex-col gap-1.5" id="slider-animal-tail">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-300">Длина Хвоста (Tail Length)</span>
                  <span className="font-mono text-indigo-400">{config.tailLength.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1.7"
                  step="0.05"
                  value={config.tailLength}
                  onChange={(e) => updateField('tailLength', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* 2. Ear Size */}
              <div className="flex flex-col gap-1.5" id="slider-animal-ears">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-300">Размер Ушей (Ear Size)</span>
                  <span className="font-mono text-indigo-400">{config.earSize.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1.7"
                  step="0.05"
                  value={config.earSize}
                  onChange={(e) => updateField('earSize', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* 3. Snout Length */}
              <div className="flex flex-col gap-1.5" id="slider-animal-snout">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-300">Длина Морды (Snout/Muzzle)</span>
                  <span className="font-mono text-indigo-400">{config.snoutLength.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.7"
                  step="0.05"
                  value={config.snoutLength}
                  onChange={(e) => updateField('snoutLength', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* 4. Overall Scale */}
              <div className="flex flex-col gap-1.5" id="slider-animal-scale">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-300">Общий Масштаб Спрайта</span>
                  <span className="font-mono text-indigo-400">{config.bodySize.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.4"
                  step="0.05"
                  value={config.bodySize}
                  onChange={(e) => updateField('bodySize', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <>
              {/* ANATOMY SLIDERS */}
              <div className="flex flex-col gap-4 p-3.5 bg-slate-950/20 rounded-xl border border-slate-800/60" id="anatomy-sliders">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-1">Пропорции Тела & Камера</span>
                
                {/* 1. Body Height Slider */}
                <div className="flex flex-col gap-1.5" id="slider-body-height">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">Высота Торса (Рост)</span>
                    <span className="font-mono text-indigo-400">{(config.bodyHeight !== undefined ? config.bodyHeight : 1.0).toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.4"
                    step="0.05"
                    value={config.bodyHeight !== undefined ? config.bodyHeight : 1.0}
                    onChange={(e) => updateField('bodyHeight', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer animate-pulse-faint"
                  />
                </div>

                {/* 2. Belly size slider ("размер живота" / stockiness) */}
                <div className="flex flex-col gap-1.5" id="slider-belly-size">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">Размер Живота / Ширина</span>
                    <span className="font-mono text-indigo-400">{(config.bellySize !== undefined ? config.bellySize : 1.0).toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.6"
                    step="0.05"
                    value={config.bellySize !== undefined ? config.bellySize : 1.0}
                    onChange={(e) => updateField('bellySize', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>

                {/* 3. Arm size slider */}
                <div className="flex flex-col gap-1.5" id="slider-arm-size">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">Толщина и Размер рук</span>
                    <span className="font-mono text-indigo-400">{(config.armSize !== undefined ? config.armSize : 1.0).toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.5"
                    step="0.05"
                    value={config.armSize !== undefined ? config.armSize : 1.0}
                    onChange={(e) => updateField('armSize', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>

                {/* 4. Ear plume slider */}
                <div className="flex flex-col gap-1.5" id="slider-ears-horns">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">Уши / Перья Шлема / Рога</span>
                    <span className="font-mono text-indigo-400">{config.earSize.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.6"
                    step="0.05"
                    value={config.earSize}
                    onChange={(e) => updateField('earSize', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>

                {/* 5. Overall model scale size */}
                <div className="flex flex-col gap-1.5" id="slider-master-scale">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">Общий Масштаб Спрайта</span>
                    <span className="font-mono text-indigo-400">{config.bodySize.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.4"
                    step="0.05"
                    value={config.bodySize}
                    onChange={(e) => updateField('bodySize', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* HAIR STYLE CHOICE */}
              <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">💇 Стиль Волос / Прическа</span>
                <div className="grid grid-cols-5 gap-1" id="hairstyles-grid-picker">
                  {[
                    { id: 'none', label: 'Лысый' },
                    { id: 'short', label: 'Короткие' },
                    { id: 'long', label: 'Длинные' },
                    { id: 'braids', label: 'Косички' },
                    { id: 'crest', label: 'Ирокез' },
                  ].map((style) => {
                    const isSel = config.hairStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        onClick={() => updateField('hairStyle', style.id as any)}
                        className={`py-1.5 rounded text-[10px] text-center font-semibold transition-all border ${
                          isSel 
                            ? 'bg-indigo-650/30 border-indigo-500 text-indigo-200' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {style.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* COLOR OVERRIDES (SKIN, HAIR, TRUNKS) */}
              <div>
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-2">Настройка Цветов Тела и Кожи</span>
                <div className="grid grid-cols-3 gap-3">
                  {/* Skin */}
                  <div className="flex flex-col gap-1 text-center bg-slate-950/20 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[9px] text-slate-400 uppercase font-bold">Кожа</span>
                    <input
                      type="color"
                      value={config.skinColor || '#ffedd5'}
                      onChange={(e) => updateField('skinColor', e.target.value)}
                      className="w-full h-8 cursor-pointer rounded bg-transparent"
                    />
                  </div>
                  {/* Hair */}
                  <div className="flex flex-col gap-1 text-center bg-slate-950/20 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[9px] text-slate-400 uppercase font-bold">Волосы</span>
                    <input
                      type="color"
                      value={config.hairColor || '#eab308'}
                      onChange={(e) => updateField('hairColor', e.target.value)}
                      className="w-full h-8 cursor-pointer rounded bg-transparent"
                    />
                  </div>
                  {/* Underwear */}
                  <div className="flex flex-col gap-1 text-center bg-slate-950/20 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[9px] text-slate-400 uppercase font-bold">Трусы (Shorts)</span>
                    <input
                      type="color"
                      value={config.underwearColor || '#3b82f6'}
                      onChange={(e) => updateField('underwearColor', e.target.value)}
                      className="w-full h-8 cursor-pointer rounded bg-transparent"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* --- TAB CONTENT: WARDROBED ARMOR & WEAPONS --- */}
      {activeTab === 'wardrobe' && (
        <div className="flex flex-col gap-4 animate-fade-in" id="panel-tab-wardrobe">
          {activeChar === 'wolf' ? (
            <div className="text-xs text-slate-400 py-4 text-center">
              Выберите "Гуманоид" в первой вкладке, чтобы одевать кольчугу, шлемы и менять мечи/луки/копья.
            </div>
          ) : (
            <>
              {/* ARMOR PIECES ROW */}
              <div>
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-2">Одежда и Слои Брони</span>
                <div className="grid grid-cols-2 gap-2 bg-slate-950/30 p-3 rounded-xl border border-slate-850" id="armor-piece-grid">
                  {[
                    { id: 'equipHelmet', label: 'Helmet (Шлем)' },
                    { id: 'equipChestplate', label: 'Chestplate (Доспех)' },
                    { id: 'equipGloves', label: 'Gloves (Перчатки)' },
                    { id: 'equipBoots', label: 'Boots (Сапоги)' },
                    { id: 'equipBelt', label: 'Belt (Пояс)' },
                    { id: 'equipShield', label: 'Shield (Щит на плече)' },
                  ].map((arm) => {
                    const isEquipped = config[arm.id as keyof WolfConfig] as boolean;
                    return (
                      <label key={arm.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/50 cursor-pointer hover:bg-slate-800/40">
                        <input
                          type="checkbox"
                          checked={isEquipped}
                          onChange={(e) => updateField(arm.id as any, e.target.checked)}
                          className="accent-indigo-500 w-3.5 h-3.5 rounded"
                        />
                        <span className="text-[11px] text-slate-200">{arm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* SHADER COLOR PICKER FOR PLATES & CLOAK */}
              <div>
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-2">Цветовая палитра снаряжения</span>
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/20 rounded-xl border border-slate-800/60" id="armor-colors-block">
                  <div className="flex flex-col gap-1 align-center text-center">
                    <span className="text-[8px] text-slate-400 uppercase font-bold">Окрас Брони</span>
                    <input
                      type="color"
                      value={config.primaryColor}
                      onChange={(e) => updateField('primaryColor', e.target.value)}
                      className="w-full h-8 cursor-pointer bg-transparent rounded"
                    />
                  </div>
                  <div className="flex flex-col gap-1 align-center text-center">
                    <span className="text-[8px] text-slate-400 uppercase font-bold">Плащ/Украсы</span>
                    <input
                      type="color"
                      value={config.secondaryColor}
                      onChange={(e) => updateField('secondaryColor', e.target.value)}
                      className="w-full h-8 cursor-pointer bg-transparent rounded"
                    />
                  </div>
                  <div className="flex flex-col gap-1 align-center text-center">
                    <span className="text-[8px] text-slate-400 uppercase font-bold">Рукояти/Железо</span>
                    <input
                      type="color"
                      value={config.accentColor}
                      onChange={(e) => updateField('accentColor', e.target.value)}
                      className="w-full h-8 cursor-pointer bg-transparent rounded"
                    />
                  </div>
                </div>
              </div>

              {/* WEAPON SLOTS CHANGER - 9 STYLES! */}
              <div>
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-2">Оружие в Основной Руке</span>
                <div className="grid grid-cols-3 gap-1.5" id="weapoins-selection-block">
                  {[
                    { id: 'hands', label: '👊 Кулаки' },
                    { id: 'sword', label: '⚔️ Меч' },
                    { id: 'axe', label: '🪓 Топор' },
                    { id: 'halberd', label: '🔱 Алебарда' },
                    { id: 'spear', label: '🗡️ Копьё' },
                    { id: 'spear_throw', label: '🎯 Метательное' },
                    { id: 'bow', label: '🏹 Лук' },
                    { id: 'staff', label: '🔮 Посох' },
                    { id: 'shield_bash', label: '🛡️ Удар щитом' },
                  ].map((wep) => {
                    const isArmed = config.equipWeapon === wep.id;
                    return (
                      <button
                        key={wep.id}
                        type="button"
                        onClick={() => updateField('equipWeapon', wep.id as any)}
                        className={`py-1.5 rounded transition-all border text-[10px] font-bold uppercase ${
                          isArmed 
                            ? 'bg-rose-750/30 border-rose-500 text-rose-100 shadow' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {wep.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* WEAPON SLOTS CHANGER - OFF HAND */}
              <div>
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-2">Оружие во Второй Руке (Off Hand)</span>
                <div className="grid grid-cols-3 gap-1.5" id="offhand-weapons-selection-block">
                  {[
                    { id: 'none', label: '🚫 Пусто' },
                    { id: 'hands', label: '👊 Кулаки' },
                    { id: 'sword', label: '⚔️ Меч' },
                    { id: 'dagger', label: '🗡️ Кинжал' },
                    { id: 'axe', label: '🪓 Топор' },
                    { id: 'spear', label: '🔱 Копьё' },
                    { id: 'bow', label: '🏹 Лук' },
                    { id: 'staff', label: '🔮 Посох' },
                    { id: 'shield', label: '🛡️ Щит' },
                  ].map((wep) => {
                    const isArmed = (config.equipWeaponLeft || 'none') === wep.id;
                    return (
                      <button
                        key={wep.id}
                        type="button"
                        onClick={() => {
                          updateField('equipWeaponLeft', wep.id as any);
                          if (wep.id === 'shield') {
                            updateField('equipShield', true);
                          } else if (wep.id !== 'none') {
                            updateField('equipShield', false);
                          }
                        }}
                        className={`py-1.5 rounded transition-all border text-[10px] font-bold uppercase ${
                          isArmed 
                            ? 'bg-indigo-750/30 border-indigo-500 text-indigo-100 shadow' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {wep.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* EXTRAS SLIDERS SPECIFIC TO ATTACKS */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950/20 p-3 rounded-lg border border-slate-850" id="weapon-dimension-sliders">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Длина Оружия</span>
                    <span className="font-mono text-indigo-400">{config.tailLength.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.7"
                    step="0.05"
                    value={config.tailLength}
                    onChange={(e) => updateField('tailLength', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Размер Щита</span>
                    <span className="font-mono text-indigo-400">{config.snoutLength.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.5"
                    step="0.05"
                    value={config.snoutLength}
                    onChange={(e) => updateField('snoutLength', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded"
                  />
                </div>
              </div>

              {/* LAYER MANAGER SECTION */}
              <div className="mt-2 bg-slate-950/20 p-3 rounded-lg border border-slate-850" id="z-index-layer-manager">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-widest">
                      Z-Index Менеджер Слоев
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateField('layerOrder', ['cape', 'back_leg', 'torso', 'front_leg', 'back_arm', 'head', 'front_arm'])}
                    className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-white uppercase transition-all bg-slate-900 border border-slate-800 hover:border-slate-700 px-2 py-1 rounded"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Сбросить
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
                  Поменяйте порядок отображения деталей снаряжения (от заднего плана к переднему), чтобы исправить наложения слоев.
                </p>

                <div className="flex flex-col gap-1">
                  {(config.layerOrder || ['cape', 'back_leg', 'torso', 'front_leg', 'back_arm', 'head', 'front_arm']).map((layerKey, idx, arr) => {
                    const layerNamesMap: Record<string, string> = {
                      cape: '🧥 Наспинный Плащ (Cape)',
                      back_leg: '🦵 Задняя Нога (Back Leg)',
                      torso: '👕 Основной Торс (Torso / Chestplate)',
                      front_leg: '🦵 Передняя Нога (Front Leg)',
                      back_arm: '🛡️ Задняя Рука / Щит (Back Arm)',
                      head: '🧑 Голова и Шлем (Head / Helmet)',
                      front_arm: '⚔️ Передняя Рука / Оружие (Front Arm)',
                    };

                    return (
                      <div
                        key={layerKey}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/40 border border-slate-850 hover:border-slate-800 transition-all text-[11px] text-slate-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-slate-500 w-3">{arr.length - idx}</span>
                          <span>{layerNamesMap[layerKey] || layerKey}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveLayer(idx, 'up')}
                            className="p-1 disabled:opacity-20 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-white disabled:pointer-events-none transition-all"
                            title="Сдвинуть назад"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === arr.length - 1}
                            onClick={() => moveLayer(idx, 'down')}
                            className="p-1 disabled:opacity-20 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-white disabled:pointer-events-none transition-all"
                            title="Сдвинуть вперёд"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* --- TAB CONTENT: POSE & PROPORTIONS LIBRARY PRESETS --- */}
      {activeTab === 'poses' && (
        <div className="flex flex-col gap-4 animate-fade-in" id="panel-tab-poses">
          
          {/* LIBRARY LISTING BLOCK */}
          <div className="flex flex-col gap-3 p-3.5 bg-slate-950/20 rounded-xl border border-slate-800/60 shadow-inner">
            <div className="flex items-center gap-1.5 justify-between">
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest animate-pulse">Библиотека пропорций</span>
              <span className="font-mono text-[9px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800/80">
                {DEFAULT_POSES.length + customPoses.length} вариантов
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal">
              Выберите позу для мгновенной перестройки скелета персонажа (рост, толщина рук, длина ушей/хвоста):
            </p>

            <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin" id="poses-presets-list">
              {/* Default Presets */}
              <div className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider mb-1 mt-0.5">Встроенные шаблоны:</div>
              {DEFAULT_POSES.map((pose) => {
                const active = 
                  Math.abs((config.bodyHeight !== undefined ? config.bodyHeight : 1.0) - pose.config.bodyHeight) < 0.02 &&
                  Math.abs((config.armSize !== undefined ? config.armSize : 1.0) - pose.config.armSize) < 0.02 &&
                  Math.abs((config.bellySize !== undefined ? config.bellySize : 1.0) - pose.config.bellySize) < 0.02 &&
                  Math.abs((config.tailLength !== undefined ? config.tailLength : 1.0) - pose.config.tailLength) < 0.02 &&
                  Math.abs((config.earSize !== undefined ? config.earSize : 1.0) - pose.config.earSize) < 0.02 &&
                  Math.abs((config.snoutLength !== undefined ? config.snoutLength : 1.0) - pose.config.snoutLength) < 0.02 &&
                  Math.abs((config.bodySize !== undefined ? config.bodySize : 1.0) - pose.config.bodySize) < 0.02;

                return (
                  <div
                    key={pose.id}
                    onClick={() => applyPoseConfig(pose)}
                    className={`group flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      active 
                        ? 'bg-indigo-600/20 border-indigo-500 shadow-sm' 
                        : 'bg-slate-950/60 border-slate-850 hover:border-slate-800 hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-2">
                      <span className={`text-xs font-bold leading-tight ${active ? 'text-indigo-400' : 'text-slate-200'}`}>
                        {pose.name}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate group-hover:whitespace-normal">
                        {pose.description}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-all shrink-0">
                      <button
                        type="button"
                        onClick={(e) => copyPoseToClipboard(pose, e)}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all text-[9px] font-medium cursor-pointer"
                        title="Скопировать JSON в буфер"
                      >
                        {copiedId === pose.id ? 'ОК' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => downloadPoseJson(pose, e)}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all text-[9.5px]/none font-medium cursor-pointer"
                        title="Скачать файл пресета .json"
                      >
                        Файл
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Custom Presets */}
              <div className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider mb-1 mt-3">Пользовательские пресеты:</div>
              {customPoses.length === 0 ? (
                <div className="text-center py-5 px-3 rounded-xl bg-slate-950/10 border border-dashed border-slate-850 text-slate-500 text-[11px] italic">
                  Нет сохраненных поз. Создайте или импортируйте позы ниже!
                </div>
              ) : (
                customPoses.map((pose) => {
                  const active = 
                    Math.abs((config.bodyHeight !== undefined ? config.bodyHeight : 1.0) - pose.config.bodyHeight) < 0.02 &&
                    Math.abs((config.armSize !== undefined ? config.armSize : 1.0) - pose.config.armSize) < 0.02 &&
                    Math.abs((config.bellySize !== undefined ? config.bellySize : 1.0) - pose.config.bellySize) < 0.02 &&
                    Math.abs((config.tailLength !== undefined ? config.tailLength : 1.0) - pose.config.tailLength) < 0.02 &&
                    Math.abs((config.earSize !== undefined ? config.earSize : 1.0) - pose.config.earSize) < 0.02 &&
                    Math.abs((config.snoutLength !== undefined ? config.snoutLength : 1.0) - pose.config.snoutLength) < 0.02 &&
                    Math.abs((config.bodySize !== undefined ? config.bodySize : 1.0) - pose.config.bodySize) < 0.02;

                  return (
                    <div
                      key={pose.id}
                      onClick={() => applyPoseConfig(pose)}
                      className={`group flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        active 
                          ? 'bg-indigo-600/20 border-indigo-500 shadow-sm' 
                          : 'bg-slate-950/60 border-slate-850 hover:border-slate-800 hover:bg-slate-900/40'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-2">
                        <span className={`text-xs font-bold leading-tight ${active ? 'text-indigo-400' : 'text-slate-200'}`}>
                          {pose.name}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate group-hover:whitespace-normal">
                          {pose.description}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-all shrink-0">
                        <button
                          type="button"
                          onClick={(e) => copyPoseToClipboard(pose, e)}
                          className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all text-[9.5px]/none font-medium cursor-pointer"
                          title="Скопировать"
                        >
                          {copiedId === pose.id ? 'ОК' : 'Copy'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => downloadPoseJson(pose, e)}
                          className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all text-[9.5px]/none font-medium cursor-pointer"
                          title="Скачать"
                        >
                          Файл
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeletePose(pose.id, e)}
                          className="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-900/50 hover:border-rose-750 text-rose-300 hover:text-rose-100 transition-all text-[9.5px]/none font-medium cursor-pointer"
                          title="Удалить позу из памяти"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SAVE CURRENT POSE BLOCK */}
          <form onSubmit={handleSaveCurrentPose} className="p-3.5 bg-slate-950/20 border border-slate-800/60 rounded-xl flex flex-col gap-3">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block font-sans">Сохранить текущие пропорции</span>
            
            <p className="text-[11px] text-slate-400 leading-normal">
              Зафиксируйте текущую конфигурацию ползунков «Анатомия» в качестве шаблона быстрого доступа.
            </p>

            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Пример: Худой Эльф, Массивный Орк..."
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                value={newPoseName}
                onChange={(e) => setNewPoseName(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Описание позы (необязательно)"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                value={newPoseDesc}
                onChange={(e) => setNewPoseDesc(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition-all uppercase"
            >
              <Plus className="w-3.5 h-3.5" /> Сохранить в библиотеку
            </button>
          </form>

          {/* IMPORT/EXPORT JSON FILE OR TEXT BLOCK */}
          <div className="p-3.5 bg-slate-950/20 border border-slate-800/60 rounded-xl flex flex-col gap-3">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Обмен и Импорт JSON</span>
            
            <p className="text-[11px] text-slate-400 leading-normal">
              Импортируйте JSON-конфигурации или скачайте текущий макет для передачи.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-bold text-xs cursor-pointer transition-all text-center">
                <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
                <span>Загрузить .json</span>
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const text = event.target?.result as string;
                        const parsed = JSON.parse(text);
                        applyPoseConfig(parsed);
                        setImportError('');
                        alert('Конфигурация позы успешно загружена!');
                      } catch (err) {
                        setImportError('Ошибка разбора JSON файла');
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = ''; // Reset input
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  const cleanConfig = {
                    bodyHeight: config.bodyHeight !== undefined ? config.bodyHeight : 1.0,
                    armSize: config.armSize !== undefined ? config.armSize : 1.0,
                    bellySize: config.bellySize !== undefined ? config.bellySize : 1.0,
                    tailLength: config.tailLength !== undefined ? config.tailLength : 1.0,
                    earSize: config.earSize !== undefined ? config.earSize : 1.0,
                    snoutLength: config.snoutLength !== undefined ? config.snoutLength : 1.0,
                    bodySize: config.bodySize !== undefined ? config.bodySize : 1.0
                  };
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                    name: "Экспортированная поза",
                    description: "Конфигурация пропорций тела в формате JSON",
                    config: cleanConfig
                  }, null, 2));
                  const downloadAnchor = document.createElement('a');
                  downloadAnchor.setAttribute("href", dataStr);
                  downloadAnchor.setAttribute("download", `humanoid_pose_${Date.now()}.json`);
                  document.body.appendChild(downloadAnchor);
                  downloadAnchor.click();
                  downloadAnchor.remove();
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-bold text-xs cursor-pointer transition-all text-center"
              >
                Скачать текущую
              </button>
            </div>

            {/* Paste JSON form */}
            <div className="flex flex-col gap-2 mt-1">
              <textarea
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
                placeholder='Пример: {"bodyHeight": 1.25, "bodySize": 1.2, "armSize": 0.8}'
                value={jsonPasteValue}
                onChange={(e) => setJsonPasteValue(e.target.value)}
              />
              {importError && (
                <span className="text-[10px] text-rose-400 font-semibold">{importError}</span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!jsonPasteValue.trim()) return;
                  try {
                    const parsed = JSON.parse(jsonPasteValue);
                    applyPoseConfig(parsed);
                    setJsonPasteValue('');
                    setImportError('');
                    alert('Поза импортирована из JSON!');
                  } catch (e) {
                    setImportError('Некорректный JSON-код');
                  }
                }}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-[11px] rounded transition-all cursor-pointer text-center"
              >
                Применить из текста (Paste JSON)
              </button>
            </div>
          </div>

        </div>
      )}

      {/* --- TAB CONTENT: ACTIVE ACTION FX & CUSTOM ANIMATION TIMELINE --- */}
      {activeTab === 'fx' && (
        <div className="flex flex-col gap-4 animate-fade-in" id="panel-tab-fx">
          
          {/* ACTION FX PRESETS SELECTOR */}
          <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl flex flex-col gap-3">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-0.5 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-yellow-450 animate-pulse" />
              Привязка FX Спрайтов Действия
            </span>

            <div className="grid grid-cols-2 gap-2" id="fx-selector-grid">
              {[
                { id: 'none', label: '❌ Без Эффекта' },
                { id: 'fire_slash', label: '🔥 Огненная дуга' },
                { id: 'magic_burst', label: '🔮 Аркан взрыв' },
                { id: 'lightning_shield', label: '⚡ Грозовой Щит' },
                { id: 'holy_sparkle', label: '✨ Звездный сияние' },
                { id: 'frost_spike', label: '❄️ Ледяное шипы' },
                { id: 'shadow_strike', label: '🌑 Теневой удар' },
              ].map((fx) => {
                const isActive = config.fxType === fx.id;
                return (
                  <button
                    key={fx.id}
                    onClick={() => updateField('fxType', fx.id as any)}
                    className={`py-2 px-1 rounded-lg border text-[10px] font-bold text-center transition-all ${
                      isActive 
                        ? 'bg-amber-500/10 border-amber-500 text-amber-200' 
                        : 'bg-slate-900 border-slate-850 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {fx.label}
                  </button>
                );
              })}
            </div>

            {config.fxType !== 'none' && (
              <div className="flex flex-col gap-3 border-t border-slate-800/60 pt-3 animate-fade-in text-xs" id="fx-properties">
                {/* 1. FX color override */}
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400">Цвет Спрайта FX</span>
                  <div className="flex items-center gap-1 bg-slate-950/40 py-1 px-2 rounded-lg border border-slate-800">
                    <input
                      type="color"
                      value={config.fxColor}
                      onChange={(e) => updateField('fxColor', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer bg-transparent"
                    />
                    <span className="font-mono text-[9px] text-indigo-300">{config.fxColor}</span>
                  </div>
                </div>

                {/* 2. FX size scale */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Размер FX Дуги</span>
                    <span className="font-mono text-indigo-300">{config.fxScale.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.8"
                    step="0.05"
                    value={config.fxScale}
                    onChange={(e) => updateField('fxScale', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded"
                  />
                </div>

                {/* 3. Bind to target Frame of active animation */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Привязать к Кадру Анимации</span>
                    <span className="font-mono text-indigo-300">Кадр #{config.fxFrame}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="7"
                    step="1"
                    value={config.fxFrame}
                    onChange={(e) => updateField('fxFrame', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded"
                  />
                </div>
              </div>
            )}
          </div>

          {/* CUSTOM ANIMATION MANAGER FORM */}
          <div className="p-3.5 bg-indigo-950/20 border border-indigo-900/30 rounded-xl flex flex-col gap-2.5" id="custom-anims-builder">
            <span className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest block mb-0.5 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              Добавить Свою Анимацию (Custom Anim)
            </span>
            
            <form onSubmit={handleAddCustomAnimation} className="flex flex-col gap-3">
              {/* Anim name input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Название Действия</label>
                <input
                  type="text"
                  placeholder="Напр. СверхТяжёлый Удар"
                  value={customAnimName}
                  onChange={(e) => setCustomAnimName(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs py-1.5 px-2.5 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Stance template skeleton */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400">Базовая Осанка</label>
                  <select
                    value={customAnimBase}
                    onChange={(e: any) => setCustomAnimBase(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-[10px] py-1.5 px-2 rounded-lg text-slate-300 focus:outline-none"
                  >
                    <option value="attack">Атакующая (Attack)</option>
                    <option value="defense">Защитная (Block)</option>
                    <option value="idle">В покое (Rest)</option>
                    <option value="walk">Шагающая (Walk)</option>
                    <option value="run">Бег спринт (Run)</option>
                  </select>
                </div>

                {/* Frames Count */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400">Число кадров: {customAnimFrames}</label>
                  <input
                    type="range"
                    min="4"
                    max="12"
                    step="1"
                    value={customAnimFrames}
                    onChange={(e) => setCustomAnimFrames(parseInt(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-950 h-1 mt-3"
                  />
                </div>
              </div>

              {/* Submit btn */}
              <button
                type="submit"
                className="w-full mt-1 bg-indigo-600 hover:bg-indigo-500 select-none py-2 text-xs font-bold text-center text-white rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 border border-indigo-500"
              >
                <Plus className="w-4 h-4 text-white" />
                Создать & Запечь в Спрайт-Лист
              </button>
            </form>
          </div>

          {/* UPLOAD CUSTOM PNG TEXTURES & SPRITES MODULE */}
          <div className="p-3.5 bg-slate-950/45 border border-slate-800/80 rounded-xl flex flex-col gap-3.5" id="custom-pngs-module">
            <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block mb-0.5 flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4 text-indigo-400" />
              Загрузка Собственных PNG Текстур & FX
            </span>

            {/* Custom Character Overlay File Chooser */}
            <div className="flex flex-col gap-2 bg-slate-900/60 p-3 rounded-lg border border-slate-850">
              <label className="text-[11px] font-bold text-slate-300 flex justify-between items-center">
                <span>1. PNG Облик / Скин Персонажа (Body Overlay)</span>
                {config.uploadedBodyPng && (
                  <button 
                    onClick={() => updateField('uploadedBodyPng', '')}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-all font-semibold cursor-pointer"
                  >
                    Сбросить
                  </button>
                )}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      updateField('uploadedBodyPng', event.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer"
              />

              {config.uploadedBodyPng && (
                <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-805 mt-1 text-xs animate-fade-in text-slate-300">
                  <div className="flex items-center justify-between gap-1">
                    <span>Скрыть базового моба (Hide procedural template):</span>
                    <input
                      type="checkbox"
                      checked={config.hideBaseBody || false}
                      onChange={(e) => updateField('hideBaseBody', e.target.checked)}
                      className="accent-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 flex justify-between font-mono">
                      <span>Режим Наложения:</span>
                      <span className="text-indigo-400 font-bold">{config.uploadedBodyMode || 'static'}</span>
                    </span>
                    <select
                      value={config.uploadedBodyMode || 'static'}
                      onChange={(e) => updateField('uploadedBodyMode', e.target.value as any)}
                      className="bg-slate-950 border border-slate-800 text-[11px] py-1 px-1.5 rounded text-slate-300 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="static">Статичный спрайт (Full Center)</option>
                      <option value="spliced">Покадровая нарезка (Strip Slicing)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex flex-col gap-1">
                      <span>Масштаб: {((config.customBodyScale || 1.0)).toFixed(2)}x</span>
                      <input
                        type="range"
                        min="0.1"
                        max="2.5"
                        step="0.05"
                        value={config.customBodyScale || 1.0}
                        onChange={(e) => updateField('customBodyScale', parseFloat(e.target.value))}
                        className="accent-indigo-550 bg-slate-950 h-1 rounded"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span>Смещение X: {config.customBodyOffsetX || 0}px</span>
                      <input
                        type="range"
                        min="-150"
                        max="150"
                        step="1"
                        value={config.customBodyOffsetX || 0}
                        onChange={(e) => updateField('customBodyOffsetX', parseInt(e.target.value))}
                        className="accent-indigo-550 bg-slate-950 h-1 rounded"
                      />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <span>Смещение Y: {config.customBodyOffsetY || 0}px</span>
                      <input
                        type="range"
                        min="-150"
                        max="150"
                        step="1"
                        value={config.customBodyOffsetY || 0}
                        onChange={(e) => updateField('customBodyOffsetY', parseInt(e.target.value))}
                        className="accent-indigo-550 bg-slate-950 h-1 rounded"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Custom FX Slashes File Chooser */}
            <div className="flex flex-col gap-2 bg-slate-900/60 p-3 rounded-lg border border-slate-850">
              <label className="text-[11px] font-bold text-slate-300 flex justify-between items-center">
                <span>2. PNG Спрайт-Лента Эффекта (Slashes FX Overlay)</span>
                {config.uploadedFxPng && (
                  <button 
                    onClick={() => updateField('uploadedFxPng', '')}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-all font-semibold cursor-pointer"
                  >
                    Сбросить
                  </button>
                )}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      updateField('uploadedFxPng', event.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-650 file:text-white hover:file:bg-indigo-550 file:cursor-pointer"
              />

              {config.uploadedFxPng && (
                <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-800 mt-1 text-xs animate-fade-in text-slate-300">
                  
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="text-slate-400">Запекать FX в Экспорт (Bake FX on Sheet):</span>
                    <input
                      type="checkbox"
                      checked={config.bakeFxInExport || false}
                      onChange={(e) => updateField('bakeFxInExport', e.target.checked)}
                      className="accent-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex flex-col gap-1 text-[11px] col-span-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Кадров в Спрайт-Ленте FX:</span>
                        <span className="text-indigo-400 font-bold">{config.customFxFrameCount || 1} шт.</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        step="1"
                        value={config.customFxFrameCount || 1}
                        onChange={(e) => updateField('customFxFrameCount', parseInt(e.target.value))}
                        className="accent-indigo-500 bg-slate-950 h-1 rounded"
                      />
                    </div>

                    <div className="flex flex-col gap-1 text-[11px] col-span-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Кадр активации вспышки:</span>
                        <span className="text-yellow-400 font-bold">Кадр #{config.customFxTriggerFrame || 0}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="7"
                        step="1"
                        value={config.customFxTriggerFrame || 0}
                        onChange={(e) => updateField('customFxTriggerFrame', parseInt(e.target.value))}
                        className="accent-indigo-500 bg-slate-950 h-1 rounded"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span>Масштаб FX: {((config.customFxScale || 1.0)).toFixed(2)}x</span>
                      <input
                        type="range"
                        min="0.1"
                        max="2.5"
                        step="0.05"
                        value={config.customFxScale || 1.0}
                        onChange={(e) => updateField('customFxScale', parseFloat(e.target.value))}
                        className="accent-indigo-500 bg-slate-950 h-1.5 rounded"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span>Поворот: {config.customFxRotation || 0}°</span>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={config.customFxRotation || 0}
                        onChange={(e) => updateField('customFxRotation', parseInt(e.target.value))}
                        className="accent-indigo-500 bg-slate-950 h-1.5 rounded"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span>Смещение X: {config.customFxOffsetX || 0}px</span>
                      <input
                        type="range"
                        min="-150"
                        max="150"
                        value={config.customFxOffsetX || 0}
                        onChange={(e) => updateField('customFxOffsetX', parseInt(e.target.value))}
                        className="accent-indigo-500 bg-slate-950 h-1.5 rounded"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span>Смещение Y: {config.customFxOffsetY || 0}px</span>
                      <input
                        type="range"
                        min="-150"
                        max="150"
                        value={config.customFxOffsetY || 0}
                        onChange={(e) => updateField('customFxOffsetY', parseInt(e.target.value))}
                        className="accent-indigo-500 bg-slate-950 h-1.5 rounded"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* THEEND ENGINE COMPATIBILITY METADATA SCHEMAS */}
          <div className="p-3.5 bg-indigo-950/20 border border-indigo-900/35 rounded-xl flex flex-col gap-3" id="theend-engine-compatibility">
            <span className="text-[10px] text-amber-300 font-extrabold uppercase tracking-widest block mb-0.5 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              THEEND RPG Engine Integration Rules
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Категория Урона (Damage Category)</label>
                <select
                  value={config.theendDamageCategory || 'physical'}
                  onChange={(e) => updateField('theendDamageCategory', e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-[10px] py-1 px-1.5 rounded-lg text-slate-300 focus:outline-none"
                >
                  <option value="physical">⚔️ Physical (Физический)</option>
                  <option value="elemental">🔥 Elemental (Стихийный)</option>
                  <option value="magic">🔮 Magic (Магический)</option>
                  <option value="shamanic">🌀 Shamanic (Шаманство)</option>
                  <option value="runic">🪨 Runic (Рунический)</option>
                  <option value="bleed">🩸 Bleeding (Кровотечение)</option>
                  <option value="poison">☠️ Poison (Ядовитый)</option>
                  <option value="true">💎 True Damage (Чистый)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Тип Физики (Damage Type Override)</label>
                <select
                  value={config.theendDamageType || 'slash'}
                  onChange={(e) => updateField('theendDamageType', e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-[10px] py-1 px-1.5 rounded-lg text-slate-300 focus:outline-none"
                >
                  <option value="slash">Slash (Режущий взмах)</option>
                  <option value="pierce">Pierce (Колющий выстрел)</option>
                  <option value="blunt">Blunt (Дробящий удар)</option>
                  <option value="cleave">Cleave (Рассекающие топоры)</option>
                  <option value="unarmed">Unarmed (Дикие лапы)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Стихия Навыка (Element Power)</label>
                <select
                  value={config.theendElementType || 'none'}
                  onChange={(e) => updateField('theendElementType', e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-[10px] py-1 px-1.5 rounded-lg text-slate-300 focus:outline-none"
                >
                  <option value="none">None (Без Стихии)</option>
                  <option value="fire">Fire (Огненная)</option>
                  <option value="water">Water (Водная глубина)</option>
                  <option value="earth">Earth (Земли и горы)</option>
                  <option value="air">Air (Ветряные вихри)</option>
                  <option value="light">Light (Святой дух)</option>
                  <option value="dark">Dark (Тёмный хаос)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Класс Атаки (Skill Target Class)</label>
                <select
                  value={config.theendSkillClass || 'melee_slash'}
                  onChange={(e) => updateField('theendSkillClass', e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-[10px] py-1 px-1.5 rounded-lg text-slate-300 focus:outline-none"
                >
                  <option value="melee_slash">melee_slash (Ближний Бой Меч)</option>
                  <option value="magic_blast">magic_blast (Каст Волшебства)</option>
                  <option value="shamanic_call">shamanic_call (Призыв Духов)</option>
                  <option value="bow_shot">bow_shot (Стрельба из лука)</option>
                  <option value="custom">custom_rpg_strike (Другое/Особое)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[10px] text-slate-400">Аудио Пресет Взрыва И Атаки (Sound Preset)</label>
                <select
                  value={config.theendSoundPreset || 'sword_slash'}
                  onChange={(e) => updateField('theendSoundPreset', e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-[10px] py-1 px-1.5 rounded-lg text-slate-300 focus:outline-none"
                >
                  <option value="sword_slash">🔊 Sword slash wave (Взмах стального меча)</option>
                  <option value="spell_blast">🔊 Spell splash fireball (Гул огненного каста)</option>
                  <option value="arrow_shoot">🔊 Bow trigger shoot (Спуск натянутой тетивы)</option>
                  <option value="curse_whisper">🔊 Shaman curse whisper (Шепот духов природы)</option>
                  <option value="heavy_roar">🔊 Beast heavy roar (Ярость дикого зверя/волка)</option>
                  <option value="none">🔇 Без Звука</option>
                </select>
              </div>
            </div>

            {/* LIVE EXPORT SPREADSHEET CODE BLOCK */}
            <div className="bg-slate-950 text-[10.5px] p-2.5 rounded-lg border border-slate-850 font-mono mt-2" id="theend-metadata-json-container">
              <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1 pb-1 border-b border-slate-900 flex justify-between items-center">
                <span>THEEND RPG Action Bound Profile (JSON)</span>
                <span className="text-indigo-400 font-bold uppercase text-[8px]">Compiled OK</span>
              </div>
              <pre className="text-indigo-300 max-h-[140px] overflow-y-auto whitespace-pre-wrap select-all">
{JSON.stringify({
  characterClass: config.characterType,
  resolution: `${config.resolution}x${config.resolution}`,
  skills: [
    {
      skillCode: config.theendSkillClass,
      animationRow: config.customFxTriggerFrame !== undefined ? 1 : 0,
      fxTriggerFrame: config.customFxTriggerFrame || 2,
      damageCategory: config.theendDamageCategory,
      damageType: config.theendDamageType,
      elementType: config.theendElementType,
      soundBinding: config.theendSoundPreset,
      customPngLoaded: !!config.uploadedBodyPng,
      customFxBake: config.bakeFxInExport
    }
  ]
}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: SPRITESHEET RENDER EXPORTER & GRID CONFIGS --- */}
      {activeTab === 'rendering' && (
        <div className="flex flex-col gap-4 animate-fade-in" id="panel-tab-rendering">
          
          <div className="flex flex-col gap-4 p-3.5 bg-slate-950/20 rounded-xl border border-slate-800/60" id="exporter-options">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-1">Разрешение Текстуры и Ячейки</span>

            {/* Grid dimension buttons selection */}
            <div className="flex flex-col gap-1.5" id="grid">
              <span className="text-[11px] text-slate-400">Размер квадратной ячейки Сетки (Crops px)</span>
              <div className="grid grid-cols-4 gap-1.5" id="resolution-presets-row">
                {[32, 64, 128, 256].map((res) => {
                  const isSel = config.resolution === res;
                  return (
                    <button
                      key={res}
                      onClick={() => updateField('resolution', res as any)}
                      className={`py-1.5 rounded-lg border font-mono text-xs cursor-pointer text-center transition-all ${
                        isSel 
                          ? 'bg-slate-150 text-slate-950 border-white font-extrabold' 
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {res}x{res}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Simulation speed (FPS) */}
            <div className="flex flex-col gap-1.5 mt-1" id="speed-fps">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Частота Кадров (Simulation FPS)</span>
                <span className="font-mono text-indigo-400">{config.fps} FPS</span>
              </div>
              <input
                type="range"
                min="4"
                max="24"
                step="2"
                value={config.fps}
                onChange={(e) => updateField('fps', parseInt(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* OUTLINES CONTROL BLOCK */}
          <div className="p-3.5 bg-slate-950/20 border border-slate-800/60 rounded-xl flex flex-col gap-3">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-0.5">Черная обводка Спрайта (Sprite Outline)</span>

            <div className="flex items-center gap-3" id="outlines-toggle-row">
              <label className="flex flex-1 items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showOutline}
                  onChange={(e) => updateField('showOutline', e.target.checked)}
                  className="accent-indigo-500 w-3.5 h-3.5 rounded"
                />
                <span className="text-xs text-slate-300">Включить черную обводку</span>
              </label>
            </div>

            {config.showOutline && (
              <div className="flex items-center justify-between gap-2 bg-slate-950/50 py-1.5 px-3 rounded-lg border border-slate-850 text-xs animate-fade-in" id="outline-color-picker">
                <span className="text-slate-400">Цвет границ обводки</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={config.outlineColor}
                    onChange={(e) => updateField('outlineColor', e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-[10px] text-indigo-300">{config.outlineColor}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER BANNER LOGS */}
      <div className="flex justify-between items-center bg-slate-950/50 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl border-t border-slate-850/70 text-[9px] font-mono text-slate-500">
        <span>IDE HUMANOID SYSTEM STABLE</span>
        <span className="text-emerald-500 underline decoration-dotted">100% VECTOR procedural</span>
      </div>

    </div>
  );
};
