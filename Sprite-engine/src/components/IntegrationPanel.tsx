import React, { useState } from 'react';
import { WolfConfig, WOLF_ANIMATIONS, WARRIOR_ANIMATIONS } from '../types';
import { BookOpen, Code2, Copy, Check, Terminal, ExternalLink, HelpCircle } from 'lucide-react';

interface IntegrationPanelProps {
  config: WolfConfig;
}

export const IntegrationPanel: React.FC<IntegrationPanelProps> = ({ config }) => {
  const [activeTab, setActiveTab] = useState<'unity' | 'godot' | 'phaser' | 'pygame' | 'json'>('json');
  const [copiedState, setCopiedState] = useState<boolean>(false);

  const activeChar = config.characterType || 'wolf';
  const animsDict = activeChar === 'warrior' ? WARRIOR_ANIMATIONS : WOLF_ANIMATIONS;
  const resolution = config.resolution;

  const triggerCopy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  // 1. GENERATE PHASER 3 CODE SNIPPET
  const getPhaserCode = () => {
    return `// Phaser 3 Spritesheet Loader & Animation Definition for ${activeChar === 'warrior' ? 'Warrior Knight' : 'Wolf Companion'}
// Place this in the preload() and create() methods of your Game Scene

function preload() {
  // Load spritesheet generated from 2D Sprite Master Engine
  this.load.spritesheet('${activeChar}_sheet', 'assets/sprites/${activeChar}_spritesheet_${resolution}x${resolution}.png', {
    frameWidth: ${resolution},
    frameHeight: ${resolution}
  });
}

function create() {
  const player = this.physics.add.sprite(200, 200, '${activeChar}_sheet');
  player.setScale(${config.bodySize});

  // Dynamic animation mapping generated from configured state
${Object.values(animsDict).map((anim) => {
  const startF = anim.row * 8; // we have 8 columns in current spritesheet export layout
  const endF = startF + anim.frameCount - 1;
  return `  this.anims.create({
    key: '${activeChar}_${anim.type}',
    frames: this.anims.generateFrameNumbers('${activeChar}_sheet', { start: ${startF}, end: ${endF} }),
    frameRate: ${config.fps},
    repeat: ${anim.type === 'die' ? '0' : '-1'}
  });`;
}).join('\n\n')}

  // Start with default idle animation
  player.anims.play('${activeChar}_idle', true);
}`;
  };

  // 2. GENERATE GODOT 4 GDSCRIPT CODE SNIPPET
  const getGodotCode = () => {
    return `# Godot 4.x - GDScript Helper for loading and playing ${activeChar} spritesheet.
# Setup an 'AnimatedSprite2D' or 'Sprite2D' node in your player scene.
# Below is a helper class to map standard Atlas coordinates directly.

extends CharacterBody2D

@onready var sprite = $Sprite2D
const CELL_SIZE = ${resolution}
const SPEED = ${activeChar === 'warrior' ? '180.0' : '230.0'}

# Spritesheet row indices from generated metadata
const ANIMATION_ROW_MAP = {
${Object.values(animsDict).map(anim => `  "${anim.type}": { "row": ${anim.row}, "frames": ${anim.frameCount} }`).join(',\n')}
}

var current_anim = "idle"
var anim_frame = 0.0

func _physics_process(delta):
    # Retrieve movement direction vectors
    var direction = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
    if direction:
        velocity = direction * SPEED
        # Switch movement states depending on direction and character species
        if magnitude(velocity) > 10:
            set_anim("${activeChar === 'warrior' ? 'run' : 'run_right'}")
    else:
        velocity = velocity.move_toward(Vector2.ZERO, SPEED * 0.25)
        set_anim("idle")
        
    move_and_slide()
    update_animation_frame(delta)

func set_anim(new_anim: String):
    if current_anim != new_anim:
        current_anim = new_anim
        anim_frame = 0.0

# Slice the coordinates of the texture manually on top of a single Sprite2D
func update_animation_frame(delta: float):
    var def = ANIMATION_ROW_MAP[current_anim]
    anim_frame += delta * ${config.fps}.0
    
    # Handle single-play limit for death
    if current_anim == "die":
        anim_frame = min(anim_frame, def.frames - 1)
    else:
         anim_frame = fmod(anim_frame, float(def.frames))
         
    var col = int(anim_frame)
    var row = def.row
    
    # Set the region rect of the Atlas
    sprite.region_enabled = true
    sprite.region_rect = Rect2(
        col * CELL_SIZE, 
        row * CELL_SIZE, 
        CELL_SIZE, 
        CELL_SIZE
    )

func magnitude(vec: Vector2) -> float:
    return sqrt(vec.x * vec.x + vec.y * vec.y)
`;
  };

  // 3. GENERATE UNITY C# AUTOMATED IMPORTER SCRIPT
  const getUnityCode = () => {
    return `// Unity C# - Procedural Editor Slicer for Generated Spritesheets
// Save this file inside your Unity asset folder under: Assets/Editor/SpriteSheetSlicer.cs

using UnityEngine;
using UnityEditor;
using System.Collections.Generic;

public class SpriteSheetSlicer : AssetPostprocessor
{
    // Automatically configure settings when any sprite matching our rules is imported
    void OnPreprocessTexture()
    {
        if (assetPath.Contains("spritesheet"))
        {
            TextureImporter textureImporter = (TextureImporter)importer;
            textureImporter.textureType = TextureImporterType.Sprite;
            textureImporter.spriteImportMode = SpriteImportMode.Multiple;
            textureImporter.spritePixelsPerUnit = ${resolution};
            textureImporter.filterMode = FilterMode.Point; // Crisp retro rendering
            textureImporter.textureCompression = TextureImporterCompression.Uncompressed;
        }
    }

    // Slice frames into custom assets based on metadata configuration
    public static void SliceProceduralSheet(Texture2D texture)
    {
        string path = AssetDatabase.GetAssetPath(texture);
        TextureImporter ti = AssetImporter.GetAtPath(path) as TextureImporter;
        
        int cellWidth = ${resolution};
        int cellHeight = ${resolution};
        int cols = 8; // default maximum columns layout
        int rows = ${Object.keys(animsDict).length};

        List<SpriteMetaData> metaDataList = new List<SpriteMetaData>();

        string[] animNames = new string[] {
${Object.values(animsDict).map(anim => `            "${anim.type}"`).join(',\n')}
        };

        int[] frameCounts = new int[] {
${Object.values(animsDict).map(anim => `            ${anim.frameCount}`).join(',\n')}
        };

        for (int r = 0; r < rows; r++)
        {
            for (int c = 0; c < frameCounts[r]; c++)
            {
                SpriteMetaData meta = new SpriteMetaData();
                meta.alignment = (int)SpriteAlignment.BottomCenter;
                meta.border = new Vector4(0, 0, 0, 0);
                
                // Unity builds coordinates starting from Bottom-Left 0,0! Let's invert rows Y index
                int unityY = (rows - 1 - r) * cellHeight;
                meta.rect = new Rect(c * cellWidth, unityY, cellWidth, cellHeight);
                meta.name = animNames[r] + "_" + c;
                
                metaDataList.Add(meta);
            }
        }

        ti.spritesheet = metaDataList.ToArray();
        EditorUtility.SetDirty(ti);
        ti.SaveAndReimport();
        Debug.Log("Successfully sliced spritesheet: " + texture.name);
    }
}`;
  };

  // 4. PYGAME PYTHON SNIPPET
  const getPygameCode = () => {
    return `# Pygame (Python) - Spritesheet Animation Slicer and Runner for ${activeChar}
# Load the spritesheet PNG once and parse individual frames into Pygame surfaces list

import pygame

class ${activeChar.charAt(0).toUpperCase() + activeChar.slice(1)}Sprite(pygame.sprite.Sprite):
    def __init__(self, sheet_path):
        super().__init__()
        # Load sheets on point filtering scaling
        self.sheet = pygame.image.load(sheet_path).convert_alpha()
        self.cell_size = ${resolution}
        self.scale_factor = ${config.bodySize}
        
        # Meta dictionary mapping rows
        self.anims = {
${Object.values(animsDict).map((anim) => `            "${anim.type}": {"row": ${anim.row}, "frames_count": ${anim.frameCount}}`).join(',\n')}
        }
        
        self.current_anim = "idle"
        self.frame_idx = 0.0
        self.frames = self._load_frames(self.current_anim)
        self.image = self.frames[0]
        self.rect = self.image.get_rect()

    def _load_frames(self, anim_name):
        anim_data = self.anims[anim_name]
        row = anim_data["row"]
        count = anim_data["frames_count"]
        
        loaded_frames = []
        for col in range(count):
            rect = pygame.Rect(col * self.cell_size, row * self.cell_size, self.cell_size, self.cell_size)
            # Create a clean surface to copy the pixel grid
            sub_surface = pygame.Surface((self.cell_size, self.cell_size), pygame.SRCALPHA)
            sub_surface.blit(self.sheet, (0, 0), rect)
            
            # Upscale matching configured parameters
            if self.scale_factor != 1.0:
                new_w = int(self.cell_size * self.scale_factor)
                new_h = int(self.cell_size * self.scale_factor)
                sub_surface = pygame.transform.scale(sub_surface, (new_w, new_h))
                
            loaded_frames.append(sub_surface)
        return loaded_frames

    def set_animation(self, anim_name):
        if self.current_anim != anim_name:
            self.current_anim = anim_name
            self.frames = self._load_frames(anim_name)
            self.frame_idx = 0.0

    def update(self, dt):
        # Progress frame index depending on animation speed (config target: ${config.fps} fps)
        self.frame_idx += dt * ${config.fps}
        
        if self.current_anim == "die":
            self.frame_idx = min(self.frame_idx, len(self.frames) - 1)
        else:
            self.frame_idx %= len(self.frames)
            
        self.image = self.frames[int(self.frame_idx)]
`;
  };

  // 5. METADATA JSON SCHEMA
  const getJsonString = () => {
    return JSON.stringify({
      author: "2D Sprite Master Engine",
      character: activeChar,
      config: {
        resolution: config.resolution,
        bodySize: config.bodySize,
        fps: config.fps,
        palette: {
          primary: config.primaryColor,
          secondary: config.secondaryColor,
          accent: config.accentColor,
          glow: config.eyeGlow
        }
      },
      layout: {
        cellSize: resolution,
        colsMax: 8,
        animations: Object.values(animsDict).map(a => ({
          name: a.type,
          label: a.name,
          row_index: a.row,
          frame_count: a.frameCount,
          description: a.description
        }))
      }
    }, null, 2);
  };

  const getCodeSnippet = () => {
    switch (activeTab) {
      case 'unity': return getUnityCode();
      case 'godot': return getGodotCode();
      case 'phaser': return getPhaserCode();
      case 'pygame': return getPygameCode();
      case 'json': return getJsonString();
    }
  };

  return (
    <div id="integration-panel-root" className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 animate-fade-in shadow-lg">
      
      {/* Header element */}
      <div>
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2" id="integration-heading">
          <BookOpen className="w-5 h-5 text-indigo-400" id="icon-book" />
          <span>Game Integration & Scripts (Интеграция в игру "TheEnd-")</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Скрипты привязки для автоматического разделения текстур, нарезки клеток и запуска воспроизведения анимаций.
        </p>
      </div>

      {/* Tabs list to choose targeting SDK frame */}
      <div className="flex flex-col gap-4">
        
        {/* Row of Buttons with Icons */}
        <div className="flex flex-wrap bg-slate-950 p-1.5 rounded-xl border border-slate-800 gap-1" id="sdk-tabs-bar">
          {(['json', 'godot', 'unity', 'phaser', 'pygame'] as const).map((tab) => (
            <button
              key={tab}
              id={`tab-sdk-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              {tab === 'json' ? 'JSON Meta' : tab}
            </button>
          ))}
        </div>

        {/* Code Snippet Window */}
        <div className="relative border border-slate-800 bg-slate-950 rounded-xl overflow-hidden shadow-2xl" id="code-snippet-box">
          <div className="flex justify-between items-center px-4 py-2 bg-slate-900 border-b border-slate-800">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              Source script binds ({activeTab}.{activeTab === 'unity' ? 'cs' : activeTab === 'godot' ? 'gd' : activeTab === 'json' ? 'json' : activeTab === 'pygame' ? 'py' : 'js'})
            </span>
            
            <button
              id="btn-copy-code"
              onClick={() => triggerCopy(getCodeSnippet())}
              className="flex items-center gap-1.5 text-[11px] text-slate-450 hover:text-slate-205 cursor-pointer text-slate-400 hover:text-white transition-all bg-slate-950/60 py-1 px-2.5 rounded border border-slate-800"
            >
              {copiedState ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 overflow-auto max-h-[300px] text-left text-xs font-mono text-indigo-200 leading-relaxed bg-slate-950 select-text" id="raw-code-block">
            <code>{getCodeSnippet()}</code>
          </pre>
        </div>

      </div>

      {/* Guide section focused specifically on Hamec01/TheEnd- */}
      <div className="border border-indigo-500/10 bg-indigo-500/5 rounded-2xl p-5 flex flex-col gap-4" id="the-end-guide-section">
        <h3 className="font-bold text-sm text-indigo-300 flex items-center gap-2" id="hamec-game-header">
          <Code2 className="w-5 h-5 text-indigo-400" />
          <span>Специальные инструкции для игры "TheEnd-" (GitHub Repository)</span>
        </h3>

        <div className="text-xs text-slate-300 leading-relaxed space-y-3" id="hamec-steps">
          
          <p>
            В репозитории <strong className="text-slate-200">Hamec01/TheEnd-</strong>, если вы разрабатываете классический браузерный HTML5, Phaser, JS или Godot проект, интеграция процедурных персонажей дает огромные преимущества в размерах файлов (весь лист генерируется из 1 Кб JSON структуры либо весит всего пару килобайт в формате PNG).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            
            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
              <span className="font-bold text-indigo-400 text-xs block mb-1">Шаг 1: Размещение файла</span>
              <span className="text-slate-400">
                Скачайте спрайт-лист персонажа в формате PNG с помощью кнопки <strong className="text-indigo-300">Download PNG</strong> в панели сетки спрайтшита и скопируйте файл в директорию ресурсов вашей игры: <code className="bg-slate-950 px-1.5 py-0.5 rounded font-mono text-rose-300 text-[10px]">/assets/sprites/</code>.
              </span>
            </div>

            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
              <span className="font-bold text-indigo-400 text-xs block mb-1">Шаг 2: Привязка логики</span>
              <span className="text-slate-400">
                Используйте вкладку <strong className="text-rose-300">JSON Meta</strong> выше. Сетка расположения анимированных кадров строго зафиксирована по строкам (rows) от 0 до {Object.keys(animsDict).length - 1}. Переходы между анимациями привязываются по кодам событий клавиатуры или движения.
              </span>
            </div>

            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
              <span className="font-bold text-indigo-400 text-xs block mb-1">Шаг 3: Веб-Рендеринг</span>
              <span className="text-slate-400">
                Если игра "TheEnd-" написана на чистом JavaScript/HTML Canvas, выделите кадры внутри цикла рендера методом <code className="bg-slate-950 px-1 py-0.5 rounded font-mono text-indigo-300 text-[10px]">ctx.drawImage(sheet, sx, sy, res, res, x, y, size, size)</code>, где индекс строки и колонки соответствуют текущему кадру персонажа!
              </span>
            </div>

          </div>

          <div className="bg-slate-950/30 border border-slate-800 p-4 rounded-xl mt-2 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-indigo-400 flex-none mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-xs text-indigo-300 block mb-1">Как использовать сгенерированный JSON для кастомизации на лету?</span>
              <span className="text-slate-400 text-xs leading-relaxed">
                Вы можете сохранить файл <code className="bg-slate-900 px-1 py-0.5 text-slate-300 rounded font-mono text-[10px]">config.json</code> на стороне сервера вашей игры. При загрузке игрового уровня, вы можете передавать цвета брони (<strong className="text-indigo-400">primaryColor</strong>) животного или рыцаря напрямую в шейдер или перерисовывать палитру пикселей Canvas во время исполнения, позволяя игрокам менять экипировку кастомизатора прямо внутри игры!
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
