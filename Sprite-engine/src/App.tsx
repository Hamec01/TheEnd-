import { useState } from 'react';
import { WolfConfig } from './types';
import { ControlPanel } from './components/ControlPanel';
import { PlaygroundPanel } from './components/PlaygroundPanel';
import { SpritesheetPanel } from './components/SpritesheetPanel';
import { ImportManager } from './components/ImportManager';
import { ItemForge } from './components/ItemForge';
import { IntegrationPanel } from './components/IntegrationPanel';
import { Sparkles, HelpCircle, ShieldAlert, Heart, Info, Sword } from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState<WolfConfig>({
    characterType: 'humanoid', // Default setup showing the newly redesigned customizable humanoid system
    primaryColor: '#c21e1e',  // Main plates red armor
    secondaryColor: '#ecc94b', // Regal gold trim / Capes
    accentColor: '#94a3b8',   // Steel sword & shields
    eyeColor: '#38bdf8',      // Cyan power visor eyes
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
    underwearColor: '#2563eb',
    humanoidRace: 'human',
    bodyHeight: 1.0,          // Torso height slider
    armSize: 1.0,             // Arm thickness slider
    bellySize: 1.0,           // Torso/belly width (размер живота)
    hairStyle: 'short',       // hairstyle selection
    fxType: 'fire_slash',     // default action FX
    fxColor: '#ef4444',       // FX color
    fxScale: 1.0,             // FX size
    fxFrame: 1,               // Active frame binding for FX
    customAnimations: {},
    tailLength: 1.0,         // Weapon length scale
    earSize: 1.0,            // Crest plume sizing
    snoutLength: 1.0,        // Defensive shield size
    bodySize: 1.0,           // Core frame height scale
    resolution: 64,          // Optimized 64px box resolution cells
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
  });

  const [currentAnimation, setCurrentAnimation] = useState<string>('idle');
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  const activeChar = config.characterType || 'wolf';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="app-root">
      
      {/* 1. Header Banner */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50 py-4 px-6 md:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4" id="app-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black bg-gradient-to-r from-red-400 via-indigo-400 to-amber-400 bg-clip-text text-transparent tracking-tight leading-none uppercase" id="app-header-title">
              2D Sprite Master Engine
            </span>
            <span className="text-[10px] bg-red-500/10 text-red-400 font-extrabold border border-red-500/20 py-0.5 px-2 rounded-full uppercase tracking-wider" id="badge-version">
              WARRIOR & ANIMALS v2.0
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1" id="app-header-subtitle">
            Процедурный генератор спрайтов для воинов и животных. Perfect for Unity, Godot, and Roblox.
          </p>
        </div>

        {/* Engine parameter statuses */}
        <div className="flex items-center gap-4 text-xs font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800" id="header-parameters">
          <div className="flex flex-col text-left">
            <span className="text-slate-500 text-[9px] uppercase">Active Style</span>
            <span className="text-amber-450 font-bold uppercase text-indigo-300">{activeChar}</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="flex flex-col text-left">
            <span className="text-slate-500 text-[9px] uppercase">Rendering</span>
            <span className="text-slate-200 font-bold">🎨 Vector 2D</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="flex flex-col text-left">
            <span className="text-slate-500 text-[9px] uppercase">Grid Cell</span>
            <span className="text-indigo-400 font-bold">{config.resolution}x{config.resolution}px</span>
          </div>
        </div>
      </header>

      {/* 2. Main Grid dashboard layout */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-grid">
        
        {/* Left Column: Configurator Form Controls */}
        <section className="lg:col-span-4 flex flex-col gap-6" id="customizer-column">
          <ControlPanel config={config} setConfig={setConfig} />
          
          {/* Bilingual controls and slicing manual guides */}
          <div className="bg-slate-900/40 rounded-2xl border border-slate-800/80 p-5 text-xs text-slate-400 flex flex-col gap-3 animate-fade-in" id="quick-manual">
            <h3 className="font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider text-[10px]" id="tutorial-title">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              Slicing & Control Cheat Sheet
            </h3>
            
            {activeChar === 'warrior' ? (
              <ul className="space-y-2 list-none" id="warrior-rus-keys">
                <li className="flex items-start gap-1">
                  <span className="text-red-400 font-bold mr-1">•</span>
                  <span>Каждый кадр находится внутри квадратной ячейки размером <code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-300 font-mono text-[10px]">{config.resolution}px</code>.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-red-400 font-bold mr-1">•</span>
                  <span><strong className="text-slate-350">Удар мечом (Sword):</strong> Ряд 4 (row 4). Меч удлиняется слайдером "Sword Blade length".</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-red-400 font-bold mr-1">•</span>
                  <span><strong className="text-slate-350">Блок щитом (Shield):</strong> Ряд 5 (row 5). Имитирует прочную защитную стойку с искрами энергии.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-red-400 font-bold mr-1">•</span>
                  <span><strong className="text-slate-350">Кувырок (Roll):</strong> Ряд 6 (row 6) - поворот на 360° со шлейфом пыли.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-red-400 font-bold mr-1">•</span>
                  <span><strong className="text-slate-355">Работа руками (Crafting):</strong> Ряд 8 (row 8) - наклоняется, быстро собирает или разбирает руду/детали.</span>
                </li>
              </ul>
            ) : activeChar === 'elf' ? (
              <ul className="space-y-2 list-none" id="elf-rus-keys">
                <li className="flex items-start gap-1">
                  <span className="text-emerald-400 font-bold mr-1">•</span>
                  <span>Каждый кадр находится внутри квадратной ячейки размером <code className="bg-slate-950 px-1 py-0.5 rounded text-emerald-300 font-mono text-[10px]">{config.resolution}px</code>.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-emerald-400 font-bold mr-1">•</span>
                  <span><strong className="text-slate-350">Стрельба из лука (Shoot Bow):</strong> Ряд 3 (row 3). Натяжение弦 и длина лука масштабируется слайдерами.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-emerald-400 font-bold mr-1">•</span>
                  <span><strong className="text-slate-355">Сбор стрел (Gather arrows):</strong> Ряд 5 (row 5) - грациозно наклоняется для сбора боеприпасов с земли.</span>
                </li>
              </ul>
            ) : activeChar === 'mage' ? (
              <ul className="space-y-2 list-none" id="mage-rus-keys">
                <li className="flex items-start gap-1">
                  <span className="text-purple-400 font-bold mr-1">•</span>
                  <span>Каждый кадр находится внутри квадратной ячейки размером <code className="bg-slate-950 px-1 py-0.5 rounded text-purple-300 font-mono text-[10px]">{config.resolution}px</code>.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-purple-400 font-bold mr-1">•</span>
                  <span><strong className="text-slate-350">Заклинание (Cast Spell):</strong> Ряд 3 (row 3) - концентрирует ману через наконечник кристального посоха.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-purple-400 font-bold mr-1">•</span>
                  <span><strong className="text-slate-350">Барьер воли (Mana Shield):</strong> Ряд 4 (row 4) - призывает сферический рунический купол преломления.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-purple-400 font-bold mr-1">•</span>
                  <span><strong className="text-slate-355">Изучение свитка (Study scroll):</strong> Ряд 6 (row 6) - чтение старинных манускриптов с рунами.</span>
                </li>
              </ul>
            ) : activeChar === 'monster' ? (
              <ul className="space-y-2 list-none" id="monster-rus-keys">
                <li className="flex items-start gap-1">
                  <span className="text-amber-500 font-bold mr-1">•</span>
                  <span>Каждый кадр находится внутри квадратной ячейки размером <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300 font-mono text-[10px]">{config.resolution}px</code>.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-amber-500 font-bold mr-1">•</span>
                  <span><strong className="text-slate-350">Удар когтями (Claws slash):</strong> Ряд 3 (row 3) - яростный взмах с кровавыми разрывами воздуха.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-amber-500 font-bold mr-1">•</span>
                  <span><strong className="text-slate-350">Громогласный рык (Roar):</strong> Ряд 4 (row 4) - раскрывает пасть с высвобождением золотых звуковых волн.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-amber-500 font-bold mr-1">•</span>
                  <span><strong className="text-slate-355">Раскопки угля (Mine dig):</strong> Ряд 6 (row 6) - крушит землю когтями, собирая осколки руды.</span>
                </li>
              </ul>
            ) : (
              <ul className="space-y-2 list-none" id="wolf-rus-keys">
                <li className="flex items-start gap-1">
                  <span className="text-indigo-400 font-bold mr-1">•</span>
                  <span>Процедурное животное поддерживает бег во всех 4 направлениях (Ряды 1-4).</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-indigo-400 font-bold mr-1">•</span>
                  <span><strong className="text-slate-350">Укус / Атака (Bite):</strong> Ряд 5 (row 5) совершает резкий бросок вперед челюстями.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-indigo-400 font-bold mr-1">•</span>
                  <span>Слайдерами можно настроить параметры хвоста, морды и ушей животного.</span>
                </li>
              </ul>
            )}
          </div>
        </section>

        {/* Right Column: Previews and Canvas stages */}
        <section className="lg:col-span-8 flex flex-col gap-6" id="viewports-column">
          
          <PlaygroundPanel
            config={config}
            currentAnimation={currentAnimation}
            setCurrentAnimation={setCurrentAnimation}
            currentFrame={currentFrame}
            setCurrentFrame={setCurrentFrame}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
          />

          <SpritesheetPanel
            config={config}
            currentAnimation={currentAnimation}
            currentFrame={currentFrame}
          />

          <ImportManager
            onConfigLoaded={setConfig}
            currentConfig={config}
          />

          <ItemForge
            config={config}
            setConfig={setConfig}
          />

          <IntegrationPanel
            config={config}
          />

        </section>

      </main>

      {/* 3. Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 px-8 text-center text-xs text-slate-500 mt-auto flex flex-col md:flex-row justify-between items-center gap-4" id="app-footer">
        <div className="flex items-center gap-2" id="footer-logo">
          <Sparkles className="w-4 h-4 text-slate-600" />
          <span>Multipurpose 2D Spritesheet Engine © 2026</span>
        </div>
        
        <div className="flex items-center gap-1 text-slate-600" id="heartcode-credit">
          <span>Wield metal swords or roam forests with</span>
          <Heart className="w-3.5 h-3.5 text-red-500 animate-pulse" />
        </div>

        <div className="flex gap-4 text-slate-500 font-medium" id="footer-links">
          <span className="hover:text-slate-300 transition-colors">MIT Canvas Standard License</span>
          <span>•</span>
          <span className="hover:text-slate-300 transition-colors bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800">100% Client-Side Procedural</span>
        </div>
      </footer>
      
    </div>
  );
}
