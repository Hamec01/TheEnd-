import React, { useState, useEffect, useRef } from 'react';
import { WolfConfig, WOLF_ANIMATIONS, WARRIOR_ANIMATIONS, ELF_ANIMATIONS, MAGE_ANIMATIONS, MONSTER_ANIMATIONS, HUMANOID_ANIMATIONS, AnimationType, AnimationDefinition } from '../types';
import { drawWolf } from '../utils/wolfDrawing';
import { drawWarrior } from '../utils/warriorDrawing';
import { drawElf } from '../utils/elfDrawing';
import { drawMage } from '../utils/mageDrawing';
import { drawMonster } from '../utils/monsterDrawing';
import { drawHumanoid } from '../utils/humanoidDrawing';
import { Play, Pause, SkipForward, SkipBack, Gamepad2, Compass, Move, Flame, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Skull, ShieldAlert, Sparkles, Hammer } from 'lucide-react';

interface PlaygroundPanelProps {
  config: WolfConfig;
  currentAnimation: string;
  setCurrentAnimation: (anim: any) => void;
  currentFrame: number;
  setCurrentFrame: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
}

const BIOMES = [
  { id: 'forest', name: 'Pine Forest (Сосновый Бор)', bg: '#064e3b', floor: '#022c22', accent: '#059669', decoration: '🌲' },
  { id: 'tundra', name: 'Snowy Tundra (Снежная Тундра)', bg: '#0f172a', floor: '#1e293b', accent: '#3b82f6', decoration: '❄️' },
  { id: 'scorched', name: 'Scorched Ruins (Выжженные Руины)', bg: '#1c1917', floor: '#292524', accent: '#ea580c', decoration: '🔥' },
];

export const PlaygroundPanel: React.FC<PlaygroundPanelProps> = ({
  config,
  currentAnimation,
  setCurrentAnimation,
  currentFrame,
  setCurrentFrame,
  isPlaying,
  setIsPlaying,
}) => {
  const [panelMode, setPanelMode] = useState<'studio' | 'sandbox'>('studio');
  const [activeBiome, setActiveBiome] = useState<string>('forest');
  const studioCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Custom uploaded PNG image caching
  const uploadedBodyImageRef = useRef<HTMLImageElement | null>(null);
  const uploadedFxImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (config.uploadedBodyPng) {
      const img = new Image();
      img.src = config.uploadedBodyPng;
      img.onload = () => {
        uploadedBodyImageRef.current = img;
      };
    } else {
      uploadedBodyImageRef.current = null;
    }
  }, [config.uploadedBodyPng]);

  useEffect(() => {
    if (config.uploadedFxPng) {
      const img = new Image();
      img.src = config.uploadedFxPng;
      img.onload = () => {
        uploadedFxImageRef.current = img;
      };
    } else {
      uploadedFxImageRef.current = null;
    }
  }, [config.uploadedFxPng]);

  // Sandbox Game State
  const sandboxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState<number>(0);
  const [health, setHealth] = useState<number>(100);
  const [gameState, setGameState] = useState<'ready' | 'alive' | 'dead'>('alive');
  const [inputDir, setInputDir] = useState({ up: false, down: false, left: false, right: false });

  // Mobile/Joystick state
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Get active character specifications
  const activeChar = config.characterType || 'wolf';
  const animsDict: Record<string, AnimationDefinition> = 
    activeChar === 'humanoid' ? { ...HUMANOID_ANIMATIONS, ...(config.customAnimations || {}) } :
    (activeChar === 'warrior' || activeChar === 'dwarf') ? (WARRIOR_ANIMATIONS as any) :
    activeChar === 'elf' ? (ELF_ANIMATIONS as any) :
    activeChar === 'mage' ? (MAGE_ANIMATIONS as any) :
    activeChar === 'monster' ? (MONSTER_ANIMATIONS as any) :
    (WOLF_ANIMATIONS as any);

  // Safe getter for animations to prevent out-of-bounds state during transition
  const getActiveAnimDef = (): { type: string; name: string; frameCount: number; description: string } => {
    const defined = animsDict[currentAnimation as any];
    if (defined) return defined;
    // Fallback: return the first available animation definition keys
    const firstVal = Object.values(animsDict)[0] as any;
    return firstVal || { type: 'idle', name: 'Idle', frameCount: 6, description: 'Standing still' };
  };

  const activeAnimDef = getActiveAnimDef();

  // Position & Velocity in Sandbox Simulator
  const playerRef = useRef({
    x: 200,
    y: 180,
    vx: 0,
    vy: 0,
    facing: 'right' as 'left' | 'right' | 'up' | 'down',
    isActionActive: false, // blocking, strike, or mining action
    actionCooldown: 0,
    deathTimer: 0,
  });

  // Collectibles/wisps array
  const collectiblesRef = useRef<Array<{ x: number; y: number; size: number; color: string; scoreVal: number; label: string; offset: number }>>([]);

  // Detecting web environment mobile support
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Safe animation cleaner: If currentAnimation doesn't fit the current character, nudge to Idle
  useEffect(() => {
    if (!animsDict[currentAnimation as any]) {
      setCurrentAnimation('idle');
      setCurrentFrame(0);
    }
  }, [activeChar, currentAnimation]);

  // --- STUDIO PREVIEW RENDERING ---
  useEffect(() => {
    if (panelMode !== 'studio') return;
    const canvas = studioCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;

    // Draw coordinate alignment lines
    ctx.strokeStyle = '#33415535';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 80, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 100, canvas.height / 2);
    ctx.lineTo(canvas.width / 2 + 100, canvas.height / 2);
    ctx.moveTo(canvas.width / 2, canvas.height / 2 - 100);
    ctx.lineTo(canvas.width / 2, canvas.height / 2 + 100);
    ctx.stroke();

    // Render corresponding species
    const safeFrame = currentFrame % activeAnimDef.frameCount;

    if (!config.hideBaseBody) {
      if (activeChar === 'humanoid') {
        drawHumanoid(
          ctx,
          config,
          activeAnimDef.type as any,
          safeFrame,
          canvas.width / 2,
          canvas.height / 2 + 15,
          false
        );
      } else if (activeChar === 'warrior' || activeChar === 'dwarf') {
        drawWarrior(
          ctx,
          config,
          activeAnimDef.type as any,
          safeFrame,
          canvas.width / 2,
          canvas.height / 2 + 15,
          false // default face right in studio sheet
        );
      } else if (activeChar === 'elf') {
        drawElf(
          ctx,
          config,
          activeAnimDef.type as any,
          safeFrame,
          canvas.width / 2,
          canvas.height / 2 + 15,
          false
        );
      } else if (activeChar === 'mage') {
        drawMage(
          ctx,
          config,
          activeAnimDef.type as any,
          safeFrame,
          canvas.width / 2,
          canvas.height / 2 + 15,
          false
        );
      } else if (activeChar === 'monster') {
        drawMonster(
          ctx,
          config,
          activeAnimDef.type as any,
          safeFrame,
          canvas.width / 2,
          canvas.height / 2 + 15,
          false
        );
      } else {
        drawWolf(
          ctx,
          config,
          activeAnimDef.type as any,
          safeFrame,
          canvas.width / 2,
          canvas.height / 2 + 15
        );
      }
    }

    // --- DRAW CUSTOM UPLOADED BODY/SKIN PNG OVERLAY (STUDIO MODE) ---
    if (uploadedBodyImageRef.current) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2 + 15);
      
      const bScale = config.bodySize * (config.customBodyScale || 1.0);
      ctx.scale(bScale, bScale);
      
      const offX = config.customBodyOffsetX || 0;
      const offY = config.customBodyOffsetY || 0;
      ctx.translate(offX, offY);

      const img = uploadedBodyImageRef.current;
      if (config.uploadedBodyMode === 'spliced' || config.uploadedBodyMode === 'full_sheet') {
        // Horizontal cell frame count slicing
        const totalFramesInCustom = activeAnimDef.frameCount;
        const frameWidth = img.width / totalFramesInCustom;
        const frameHeight = img.height;
        ctx.drawImage(
          img,
          (safeFrame % totalFramesInCustom) * frameWidth, 0, frameWidth, frameHeight,
          -frameWidth / 2, -frameHeight + 10, frameWidth, frameHeight
        );
      } else {
        // Centered static asset mode
        ctx.drawImage(img, -img.width / 2, -img.height + 10, img.width, img.height);
      }
      ctx.restore();
    }

    // --- DRAW CUSTOM UPLOADED ACTIVE STRIKE/ACTION FX OVERLAY ---
    if (uploadedFxImageRef.current && safeFrame >= (config.customFxTriggerFrame || 0)) {
      const fxFrameIdx = safeFrame - (config.customFxTriggerFrame || 0);
      const maxF = config.customFxFrameCount || 1;
      if (fxFrameIdx < maxF) {
        ctx.save();
        // Centered around biped tool/impact height
        ctx.translate(canvas.width / 2 + 15, canvas.height / 2 - 10);
        
        const scaleVal = config.customFxScale || 1.0;
        ctx.scale(scaleVal, scaleVal);
        ctx.translate(config.customFxOffsetX || 0, config.customFxOffsetY || 0);
        ctx.rotate(((config.customFxRotation || 0) * Math.PI) / 180);
        
        const img = uploadedFxImageRef.current;
        const frameWidth = img.width / maxF;
        const frameHeight = img.height;
        ctx.drawImage(
          img,
          fxFrameIdx * frameWidth, 0, frameWidth, frameHeight,
          -frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight
        );
        ctx.restore();
      }
    }

  }, [config, currentAnimation, currentFrame, panelMode, activeChar]);

  // --- TIMELINE PLAY SCHEDULER ---
  useEffect(() => {
    if (!isPlaying || panelMode !== 'studio') return;

    const interval = 1000 / config.fps;
    const timer = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % activeAnimDef.frameCount);
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, config.fps, currentAnimation, panelMode, activeAnimDef.frameCount]);

  // --- SANDBOX PHYSICAL CONTROLS KEYBOARD ---
  useEffect(() => {
    if (panelMode !== 'sandbox') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'arrowup'].includes(key)) setInputDir((prev) => ({ ...prev, up: true }));
      if (['s', 'arrowdown'].includes(key)) setInputDir((prev) => ({ ...prev, down: true }));
      if (['a', 'arrowleft'].includes(key)) setInputDir((prev) => ({ ...prev, left: true }));
      if (['d', 'arrowright'].includes(key)) setInputDir((prev) => ({ ...prev, right: true }));

      // SPACE: Sword slash, bow shot, spell cast or bite
      if (e.code === 'Space') {
        e.preventDefault();
        triggerCoreAction();
      }
      // B: Block shield/barrier/roar
      if (key === 'b') {
        triggerDefenseBlock();
      }
      // L: rest / sleep / study
      if (key === 'l') {
        triggerRestOrInteract();
      }
      // O: Roll roll (Warrior / Dwarf)
      if (key === 'o' || key === 'e' && (activeChar === 'warrior' || activeChar === 'dwarf')) {
        triggerRollEvade();
      }
      // K: kill self
      if (key === 'k') {
        triggerSuicideCollapse();
      }
      // R: Respawn
      if (key === 'r') {
        triggerRespawn();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'arrowup'].includes(key)) setInputDir((prev) => ({ ...prev, up: false }));
      if (['s', 'arrowdown'].includes(key)) setInputDir((prev) => ({ ...prev, down: false }));
      if (['a', 'arrowleft'].includes(key)) setInputDir((prev) => ({ ...prev, left: false }));
      if (['d', 'arrowright'].includes(key)) setInputDir((prev) => ({ ...prev, right: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [panelMode, gameState, activeChar]);

  // Reset collectibles on biome switch or mode switch
  useEffect(() => {
    if (panelMode !== 'sandbox') return;

    const biomeColors = BIOMES.find((b) => b.id === activeBiome);
    const icons = activeChar === 'wolf'
      ? ['🥩', '🍗', '🍖', '🥚']
      : activeChar === 'elf'
      ? ['🎯', '🪵', '🍃', '🦌']
      : activeChar === 'mage'
      ? ['🔮', '📜', '✨', '💎']
      : activeChar === 'monster'
      ? ['🦴', '🥩', '🛡️', '💀']
      : ['💎', '🪙', '🪵', '🧱', '🔮'];

    collectiblesRef.current = Array.from({ length: 5 }).map((_, i) => ({
      ...collectiblesRef.current?.[i],
      x: 80 + Math.random() * 340,
      y: 90 + Math.random() * 210,
      size: 16,
      color: biomeColors?.accent || '#facc15',
      scoreVal: activeChar === 'wolf' ? 12 : activeChar === 'monster' ? 20 : 15,
      label: icons[i % icons.length],
      offset: Math.random() * Math.PI * 2,
    }));
  }, [panelMode, activeBiome, activeChar]);

  // GAME TRIGGERS
  const triggerCoreAction = () => {
    const player = playerRef.current;
    if (gameState !== 'alive') return;
    if (player.isActionActive) return;

    player.isActionActive = true;
    player.actionCooldown = 
      activeChar === 'humanoid' ? 6 :
      (activeChar === 'warrior' || activeChar === 'dwarf') ? 6 :
      activeChar === 'elf' ? 8 :
      activeChar === 'mage' ? 7 :
      activeChar === 'monster' ? 8 :
      5;
    
    const nextAnim = 
      activeChar === 'humanoid' ? 'attack' :
      (activeChar === 'warrior' || activeChar === 'dwarf') ? 'sword_strike' : 
      activeChar === 'elf' ? 'shoot_bow' :
      activeChar === 'mage' ? 'cast_spell' :
      activeChar === 'monster' ? 'claws_slash' :
      'bite';
    setCurrentAnimation(nextAnim);
    setCurrentFrame(0);

    // Collision check inside active striking sweep
    setTimeout(() => {
      const currentBiomeDetails = BIOMES.find((b) => b.id === activeBiome);
      const remainingCollectibles = collectiblesRef.current.filter((item) => {
        const dx = item.x - player.x;
        const dy = item.y - player.y;
        const dist = Math.hypot(dx, dy);

        // Striking sword/spell/shoot projectile range helper
        const strikeRange = 
          (activeChar === 'warrior' || activeChar === 'dwarf') ? 48 : 
          activeChar === 'elf' ? 58 : 
          activeChar === 'mage' ? 64 : 
          activeChar === 'monster' ? 44 : 
          42;
        const insideStrikeRange = dist < strikeRange;
        if (insideStrikeRange) {
          setScore((s) => s + item.scoreVal);
          setHealth((h) => Math.min(100, h + (activeChar === 'wolf' ? 10 : 4))); // food heals more
        }
        return !insideStrikeRange;
      });

      // Spawn replacement collectibles instantly
      const icons = activeChar === 'wolf'
        ? ['🥩', '🍗', '🍖', '🥚']
        : activeChar === 'elf'
        ? ['🎯', '🪵', '🍃', '🦌']
        : activeChar === 'mage'
        ? ['🔮', '📜', '✨', '💎']
        : activeChar === 'monster'
        ? ['🦴', '🥩', '🛡️', '💀']
        : ['💎', '🪙', '🪵', '🧱', '🔮'];

      while (remainingCollectibles.length < 5) {
        remainingCollectibles.push({
          x: 40 + Math.random() * 420,
          y: 60 + Math.random() * 230,
          size: 16,
          color: currentBiomeDetails?.accent || '#ffffff',
          scoreVal: activeChar === 'wolf' ? 12 : activeChar === 'monster' ? 20 : 15,
          label: icons[Math.floor(Math.random() * icons.length)],
          offset: Math.random() * Math.PI * 2,
        });
      }
      collectiblesRef.current = remainingCollectibles;
    }, 120);
  };

  const triggerDefenseBlock = () => {
    const player = playerRef.current;
    if (gameState !== 'alive') return;
    if (player.isActionActive) return;

    if (activeChar === 'humanoid') {
      player.isActionActive = true;
      player.actionCooldown = 6;
      setCurrentAnimation('defense');
      setCurrentFrame(0);
    } else if (activeChar === 'warrior' || activeChar === 'dwarf') {
      player.isActionActive = true;
      player.actionCooldown = 6;
      setCurrentAnimation('shield_block');
      setCurrentFrame(0);
    } else if (activeChar === 'mage') {
      player.isActionActive = true;
      player.actionCooldown = 6;
      setCurrentAnimation('shield_barrier');
      setCurrentFrame(0);
    } else if (activeChar === 'monster') {
      player.isActionActive = true;
      player.actionCooldown = 6;
      setCurrentAnimation('roar_buff');
      setCurrentFrame(0);
    }
  };

  const triggerRollEvade = () => {
    const player = playerRef.current;
    if (gameState !== 'alive') return;
    if (activeChar !== 'humanoid' && activeChar !== 'warrior' && activeChar !== 'dwarf') return;
    if (player.isActionActive) return;

    player.isActionActive = true;
    player.actionCooldown = 6;
    setCurrentAnimation('roll');
    setCurrentFrame(0);
    
    // Add forward sliding momentum
    const pushVel = player.facing === 'left' ? -9 : 9;
    player.vx = pushVel;
  };

  const triggerJumpLeap = () => {
    const player = playerRef.current;
    if (gameState !== 'alive') return;
    if (player.isActionActive) return;

    player.isActionActive = true;
    player.actionCooldown = 6;
    setCurrentAnimation('jump');
    setCurrentFrame(0);
    
    // Vertical leap momentum
    player.vy = -6;
  };

  const triggerRestOrInteract = () => {
    const player = playerRef.current;
    if (gameState !== 'alive') return;
    
    player.isActionActive = !player.isActionActive;
    if (player.isActionActive) {
      const nextAnim = 
        activeChar === 'humanoid'
          ? 'work'
          : activeChar === 'warrior' || activeChar === 'dwarf' || activeChar === 'elf' || activeChar === 'mage' || activeChar === 'monster'
          ? 'interact'
          : 'idle';
      setCurrentAnimation(nextAnim);
      setCurrentFrame(0);
    }
  };

  const triggerSuicideCollapse = () => {
    if (gameState !== 'alive') return;
    setGameState('dead');
    setHealth(0);
    setCurrentAnimation('die');
    setCurrentFrame(0);
  };

  const triggerRespawn = () => {
    const player = playerRef.current;
    player.x = 200;
    player.y = 180;
    player.vx = 0;
    player.vy = 0;
    player.isActionActive = false;
    setGameState('alive');
    setHealth(100);
    setScore(0);
    setCurrentAnimation('idle');
    setCurrentFrame(0);
  };

  // --- REFS MIRRORING STATES (FOR 60 FPS ZERO-LAG SANDBOX TICKER) ---
  const currentAnimationRef = useRef(currentAnimation);
  currentAnimationRef.current = currentAnimation;

  const currentFrameRef = useRef(currentFrame);
  currentFrameRef.current = currentFrame;

  const configRef = useRef(config);
  configRef.current = config;

  const activeCharRef = useRef(activeChar);
  activeCharRef.current = activeChar;

  const activeBiomeRef = useRef(activeBiome);
  activeBiomeRef.current = activeBiome;

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const inputDirRef = useRef(inputDir);
  inputDirRef.current = inputDir;

  const scoreRef = useRef(score);
  scoreRef.current = score;

  const healthRef = useRef(health);
  healthRef.current = health;

  // --- MAIN SANDBOX GAMELOOP (60 FPS tick) ---
  useEffect(() => {
    if (panelMode !== 'sandbox') return;
    const canvas = sandboxCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let tickCount = 0;

    const loop = () => {
      tickCount++;
      const player = playerRef.current;
      
      // Shadow variables representing state mapped to the current Ref values for flawless, lag-free draw checks:
      const currentAnimation = currentAnimationRef.current;
      const currentFrame = currentFrameRef.current;
      const config = configRef.current;
      const activeChar = activeCharRef.current;
      const activeBiome = activeBiomeRef.current;
      const gameState = gameStateRef.current;
      const score = scoreRef.current;
      const health = healthRef.current;
      const inputDir = inputDirRef.current;

      const biome = BIOMES.find((b) => b.id === activeBiome) || BIOMES[0];

      // 1. INPUT PROCESSING
      if (gameState === 'alive') {
        const speedMultiplier = 
          activeChar === 'warrior' ? 3.0 : 
          activeChar === 'elf' ? 3.5 :
          activeChar === 'mage' ? 4.0 :
          activeChar === 'monster' ? 2.8 : 
          3.8;
        let moving = false;

        let dx = 0;
        let dy = 0;

        if (inputDir.up) { dy = -1; player.facing = 'up'; }
        if (inputDir.down) { dy = 1; player.facing = 'down'; }
        if (inputDir.left) { dx = -1; player.facing = 'left'; }
        if (inputDir.right) { dx = 1; player.facing = 'right'; }

        if (dx !== 0 || dy !== 0) {
          const len = Math.hypot(dx, dy);
          player.vx = (dx / len) * speedMultiplier;
          player.vy = (dy / len) * speedMultiplier;
          moving = true;
          player.isActionActive = false; // wakes up/cancels crafting
        } else {
          // friction slide dampener
          player.vx *= 0.65;
          player.vy *= 0.65;
        }

        // Apply position translation if not locked in heavy action
        const activeAnim = currentAnimation;
        const isLockingAction = activeAnim === 'attack' || activeAnim === 'defense' || activeAnim === 'work' || activeAnim === 'sword_strike' || activeAnim === 'shoot_bow' || activeAnim === 'cast_spell' || activeAnim === 'claws_slash' || activeAnim === 'shield_block' || activeAnim === 'shield_barrier' || activeAnim === 'roar_buff' || activeAnim === 'interact';
        
        if (!isLockingAction || activeAnim === 'roll') {
          player.x += player.vx;
          player.y += player.vy;
        }

        // Boundaries matching canvas dimensions
        player.x = Math.max(25, Math.min(475, player.x));
        player.y = Math.max(80, Math.min(290, player.y));

        // State Machine sync
        if (player.isActionActive) {
          player.actionCooldown -= 0.16; // gradual decrease
          if (player.actionCooldown <= 0) {
            player.isActionActive = false;
            setCurrentAnimation('idle');
          }
        } else if (moving) {
          // Play walk or run animations
          if (activeChar === 'warrior' || activeChar === 'elf' || activeChar === 'mage' || activeChar === 'monster') {
            const nextWalkOrRun = Math.hypot(player.vx, player.vy) > 3.2 ? 'run' : 'walk';
            if (currentAnimation !== nextWalkOrRun) setCurrentAnimation(nextWalkOrRun);
          } else {
            if (player.facing === 'left') {
              if (currentAnimation !== 'run_left') setCurrentAnimation('run_left');
            } else if (player.facing === 'right') {
              if (currentAnimation !== 'run_right') setCurrentAnimation('run_right');
            } else if (player.facing === 'up') {
              if (currentAnimation !== 'run_up') setCurrentAnimation('run_up');
            } else if (player.facing === 'down') {
              if (currentAnimation !== 'run_down') setCurrentAnimation('run_down');
            }
          }
        } else {
          // Default idle breathing stance
          if (activeChar === 'warrior' || activeChar === 'elf' || activeChar === 'mage' || activeChar === 'monster') {
            if (currentAnimation !== 'idle') setCurrentAnimation('idle');
          } else {
            if (currentAnimation !== 'run_right' && currentAnimation !== 'run_left') {
              setCurrentAnimation(player.facing === 'left' ? 'run_left' : 'run_right');
            }
          }
        }

        // Heal when gathering/resting, slowly drain in heat maps
        if (currentAnimation === 'interact' && tickCount % 40 === 0) {
          setHealth((h) => Math.min(100, h + 2)); // work health regen
        } else if (activeBiome === 'scorched' && tickCount % 45 === 0) {
          setHealth((h) => {
            const nextH = Math.max(0, h - 1);
            if (nextH <= 0) {
              setGameState('dead');
              setCurrentAnimation('die');
              setCurrentFrame(0);
            }
            return nextH;
          });
        }
      } else {
        // Dead frame iteration stop at floor level
        const limitFrames = animsDict.die?.frameCount || 6;
        if (currentFrame < limitFrames - 1) {
          if (tickCount % 7 === 0) {
            setCurrentFrame((f) => Math.min(limitFrames - 1, f + 1));
          }
        }
      }

      // Frame progression scheduler inside active gameplay ticks
      if (gameState === 'alive') {
        const speedTicks = currentAnimation === 'run' ? 5 : 6;
        if (tickCount % speedTicks === 0) {
          const limits = animsDict[currentAnimation as any]?.frameCount || 6;
          setCurrentFrame((f) => (f + 1) % limits);
        }
      }

      // --- RENDERING CANVAS DRAW PIPELINE ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;

      // Draw Biome Arena
      ctx.fillStyle = biome.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = biome.floor;
      ctx.fillRect(0, canvas.height - 90, canvas.width, 90);

      ctx.strokeStyle = biome.accent + '3c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - 90);
      ctx.lineTo(canvas.width, canvas.height - 90);
      ctx.stroke();

      // Ambient Biome Particles Floating
      const timeVal = Date.now() * 0.001;
      ctx.fillStyle = biome.accent + '25';
      for (let i = 0; i < 7; i++) {
        const px = ((i * 90 + timeVal * 15) % (canvas.width + 30)) - 15;
        const py = 60 + Math.sin(timeVal * 1.5 + i) * 15 + (i * 35) % 130;
        ctx.beginPath();
        ctx.arc(px, py, 5 + (i % 3) * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff12';
        ctx.font = '14px serif';
        ctx.fillText(biome.decoration, px + 40, py + 15);
      }

      // Render Resource Nodes
      collectiblesRef.current.forEach((item) => {
        const bounce = Math.sin(timeVal * 3.5 + item.offset) * 3.5;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.ellipse(item.x, item.y + 11 + bounce, 9, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw node icon
        ctx.font = '18px serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, item.x, item.y + bounce);

        // Faint glowing ring
        ctx.strokeStyle = item.color + '4d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(item.x, item.y + bounce, 13 + Math.sin(timeVal * 5) * 2, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Render Character Player
      ctx.save();
      
      const limits = animsDict[currentAnimation as any]?.frameCount || 6;
      const safeFrameNum = currentFrame % limits;

      // Draw shadow
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      const isLying = currentAnimation === 'idle' && activeChar === 'wolf';
      ctx.ellipse(player.x, player.y + (isLying ? 12 : 11), isLying ? 22 : 15, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Horizontal flip condition
      const charFlip = (activeChar === 'humanoid' || activeChar === 'warrior' || activeChar === 'dwarf' || activeChar === 'elf' || activeChar === 'mage' || activeChar === 'monster') && player.facing === 'left';

      if (!config.hideBaseBody) {
        if (activeChar === 'humanoid') {
          drawHumanoid(
            ctx,
            config,
            currentAnimation as any,
            safeFrameNum,
            player.x,
            player.y,
            charFlip
          );
        } else if (activeChar === 'warrior' || activeChar === 'dwarf') {
          drawWarrior(
            ctx,
            config,
            currentAnimation as any,
            safeFrameNum,
            player.x,
            player.y,
            charFlip
          );
        } else if (activeChar === 'elf') {
          drawElf(
            ctx,
            config,
            currentAnimation as any,
            safeFrameNum,
            player.x,
            player.y,
            charFlip
          );
        } else if (activeChar === 'mage') {
          drawMage(
            ctx,
            config,
            currentAnimation as any,
            safeFrameNum,
            player.x,
            player.y,
            charFlip
          );
        } else if (activeChar === 'monster') {
          drawMonster(
            ctx,
            config,
            currentAnimation as any,
            safeFrameNum,
            player.x,
            player.y,
            charFlip
          );
        } else {
          drawWolf(
            ctx,
            config,
            currentAnimation as any,
            safeFrameNum,
            player.x,
            player.y
          );
        }
      }

      // --- DRAW CUSTOM UPLOADED BODY/SKIN ON SANDBOX CHARACTER ---
      if (uploadedBodyImageRef.current) {
        ctx.save();
        ctx.translate(player.x, player.y);
        if (charFlip) {
          ctx.scale(-1, 1);
        }
        const bScale = config.bodySize * (config.customBodyScale || 1.0);
        ctx.scale(bScale, bScale);
        
        const offX = config.customBodyOffsetX || 0;
        const offY = config.customBodyOffsetY || 0;
        ctx.translate(offX, offY);

        const img = uploadedBodyImageRef.current;
        if (config.uploadedBodyMode === 'spliced' || config.uploadedBodyMode === 'full_sheet') {
          const totalFramesInCustom = limits;
          const frameWidth = img.width / totalFramesInCustom;
          const frameHeight = img.height;
          ctx.drawImage(
            img,
            (safeFrameNum % totalFramesInCustom) * frameWidth, 0, frameWidth, frameHeight,
            -frameWidth / 2, -frameHeight + 10, frameWidth, frameHeight
          );
        } else {
          ctx.drawImage(img, -img.width / 2, -img.height + 10, img.width, img.height);
        }
        ctx.restore();
      }

      // --- DRAW CUSTOM UPLOADED ACTION STRIKE FX (SANDBOX MODE) ---
      if (uploadedFxImageRef.current && safeFrameNum >= (config.customFxTriggerFrame || 0)) {
        const fxFrameIdx = safeFrameNum - (config.customFxTriggerFrame || 0);
        const maxF = config.customFxFrameCount || 1;
        if (fxFrameIdx < maxF) {
          ctx.save();
          // Offset strike front-faced or back-faced
          ctx.translate(player.x + (charFlip ? -16 : 16), player.y - 12);
          if (charFlip) {
            ctx.scale(-1, 1);
          }
          
          const scaleVal = config.customFxScale || 1.0;
          ctx.scale(scaleVal, scaleVal);
          ctx.translate(config.customFxOffsetX || 0, config.customFxOffsetY || 0);
          ctx.rotate(((config.customFxRotation || 0) * Math.PI) / 180);
          
          const img = uploadedFxImageRef.current;
          const frameWidth = img.width / maxF;
          const frameHeight = img.height;
          ctx.drawImage(
            img,
            fxFrameIdx * frameWidth, 0, frameWidth, frameHeight,
            -frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight
          );
          ctx.restore();
        }
      }

      ctx.restore();

      // UI HUD Overlay
      ctx.fillStyle = 'rgba(10,15,30,0.85)';
      ctx.fillRect(0, 0, canvas.width, 36);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      
      let scoreLabel = `🥩 MEAT CAUGHT: ${score}`;
      if (activeChar === 'warrior' || activeChar === 'dwarf') scoreLabel = `💎 RESOURCE ORES: ${score}`;
      else if (activeChar === 'elf') scoreLabel = `🏹 TARGETS SHOT: ${score}`;
      else if (activeChar === 'mage') scoreLabel = `🔮 MANA ENERGY: ${score}`;
      else if (activeChar === 'monster') scoreLabel = `🦴 BONES GATHERED: ${score}`;
      ctx.fillText(scoreLabel, 16, 22);

      const healthColor = health > 55 ? '#10b981' : health > 22 ? '#fbbf24' : '#ef4444';
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(170, 14, 80, 8);
      ctx.fillStyle = healthColor;
      ctx.fillRect(170, 14, (health / 100) * 80, 8);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`HEALTH: ${health}%`, 260, 21);

      ctx.textAlign = 'right';
      ctx.fillText(`BIOME: ${biome.name}`, canvas.width - 16, 22);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);

  }, [panelMode]);

  return (
    <div id="playground-panel-root" className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
      
      {/* Playground Tabs header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3 items-center bg-slate-950/60 p-1.5 rounded-xl border border-slate-800 animate-fade-in" id="sandbox-tab-header">
        <div className="flex gap-1">
          <button
            id="tab-studio"
            onClick={() => {
              setPanelMode('studio');
              setCurrentAnimation('idle');
              setCurrentFrame(0);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              panelMode === 'studio'
                ? 'bg-indigo-650 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Studio Mode (Демо-Студия)</span>
          </button>
          <button
            id="tab-sandbox"
            onClick={() => {
              setPanelMode('sandbox');
              setCurrentAnimation('idle');
              setCurrentFrame(0);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              panelMode === 'sandbox'
                ? 'bg-rose-650 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Sandbox Game (Игровая Зона)</span>
          </button>
        </div>

        {panelMode === 'sandbox' && (
          <div className="flex gap-1 overflow-x-auto self-stretch sm:self-auto px-1 py-0.5" id="biomes-badges">
            {BIOMES.map((b) => (
              <button
                key={b.id}
                id={`btn-biome-${b.id}`}
                onClick={() => setActiveBiome(b.id)}
                className={`py-1.5 px-2.5 rounded-md text-[10px] whitespace-nowrap font-bold cursor-pointer transition-all ${
                  activeBiome === b.id
                    ? 'bg-slate-100 text-slate-950 font-extrabold'
                    : 'text-slate-450 hover:text-slate-350 bg-slate-900/30'
                }`}
              >
                {b.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {panelMode === 'studio' ? (
        /* --- DEMO PANEL STUDIO VIEW --- */
        <div className="flex flex-col lg:flex-row gap-6" id="studio-view-container">
          
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-950/80 rounded-xl border border-slate-800 relative p-6 min-h-[300px]" id="studio-canvas-stage">
            
            <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur px-2.5 py-1.5 rounded border border-slate-700 flex items-center gap-1.5 text-[9px] font-mono text-indigo-400 select-none uppercase">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>LIVE RENDER INTERPLAY</span>
            </div>

            <canvas
              ref={studioCanvasRef}
              id="studio-viewport"
              width={260}
              height={220}
              className="block"
              style={{
                imageRendering: 'auto',
              }}
            />

            <div className="mt-4 text-center select-none" id="studio-subtitle-text">
              <span className="text-sm font-bold text-slate-100 uppercase tracking-wider">{activeAnimDef.name}</span>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">{activeAnimDef.description}</p>
            </div>
          </div>

          {/* Left panel: Active Animation selection trigger list */}
          <div className="w-full lg:w-72 flex flex-col gap-3" id="active-animation-selector-group">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Select Play Action</span>
            
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 max-h-[290px] overflow-y-auto pr-1" id="grid-studio-animation-triggers">
              {(Object.values(animsDict) as AnimationDefinition[]).map((anim) => (
                <button
                  key={anim.type}
                  id={`btn-anim-${anim.type}`}
                  onClick={() => {
                    setCurrentAnimation(anim.type);
                    setCurrentFrame(0);
                  }}
                  className={`flex flex-col items-start p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    currentAnimation === anim.type
                      ? 'bg-slate-100 hover:bg-slate-200 border-white text-slate-950 shadow-md transform -translate-y-0.5'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full justify-between">
                    <span className="font-bold text-xs truncate">{anim.name}</span>
                    <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded flex-none ${
                      currentAnimation === anim.type ? 'bg-indigo-650 text-white' : 'bg-slate-850 text-slate-450'
                    }`}>
                      {anim.frameCount} f
                    </span>
                  </div>
                  <span className={`text-[10px] mt-0.5 line-clamp-1 opacity-75 ${
                    currentAnimation === anim.type ? 'text-slate-800 font-medium' : 'text-slate-400'
                  }`}>
                    {anim.description}
                  </span>
                </button>
              ))}
            </div>

            {/* Play controls */}
            <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-xl flex flex-col gap-3 mt-1" id="studio-timeline-controls">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Player Controls</span>
              
              <div className="flex items-center justify-between gap-1.5" id="scrubber-timeline">
                <button
                  id="btn-scrub-prev"
                  onClick={() => setCurrentFrame((f) => (f - 1 + activeAnimDef.frameCount) % activeAnimDef.frameCount)}
                  className="p-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-slate-100 cursor-pointer"
                  title="Prev Frame"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>

                <button
                  id="btn-play-toggle"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    isPlaying ? 'bg-indigo-650/30 text-indigo-300 border border-indigo-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow'
                  }`}
                >
                  {isPlaying ? (
                    <span className="flex items-center gap-1.5"><Pause className="w-3.5 h-3.5" /> Pause</span>
                  ) : (
                    <span className="flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> Resume</span>
                  )}
                </button>

                <button
                  id="btn-scrub-next"
                  onClick={() => setCurrentFrame((f) => (f + 1) % activeAnimDef.frameCount)}
                  className="p-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-slate-100 cursor-pointer"
                  title="Next Frame"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Scrubber slider line */}
              <div className="flex flex-col gap-1" id="slider-scrub-component">
                <div className="flex justify-between text-[9px] font-mono text-slate-500">
                  <span>Manual Scrub</span>
                  <span>Frame {currentFrame % activeAnimDef.frameCount + 1} / {activeAnimDef.frameCount}</span>
                </div>
                <input
                  type="range"
                  id="range-timeline-scrub"
                  min="0"
                  max={activeAnimDef.frameCount - 1}
                  step="1"
                  value={currentFrame % activeAnimDef.frameCount}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentFrame(parseInt(e.target.value));
                  }}
                  className="w-full accent-indigo-500 bg-slate-950 h-1 rounded cursor-pointer"
                />
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* --- MODE 2: COMBAT GATHERING ARENA GRAPHICS --- */
        <div className="flex flex-col gap-4 animate-fade-in" id="sandbox-view-container">
          
          <div className="relative border border-slate-800 bg-slate-950 rounded-xl overflow-hidden shadow-inner flex items-center justify-center min-h-[340px]" id="sandbox-stage">
            <canvas
              ref={sandboxCanvasRef}
              id="sandbox-game-canvas"
              width={500}
              height={320}
              className="max-w-full block"
              style={{
                imageRendering: 'auto',
              }}
            />

            {/* Suicide collapse override display */}
            {gameState === 'dead' && (
              <div className="absolute inset-0 bg-slate-950/93 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 animate-fade-in" id="death-overlay">
                <Skull className="w-12 h-12 text-red-500 mb-2 animate-bounce" />
                <span className="text-base font-bold text-slate-200">
                  {activeChar === 'warrior' ? 'WARRIOR HAS FALLEN (РЫЦАРЬ ПОГИБ)' :
                   activeChar === 'dwarf' ? 'DWARF COMRADE FALLEN (ГНОМ ПАЛ В БОЮ)' :
                   activeChar === 'elf' ? 'ELF ARCHER SLAIN (ЭЛЬФ ПАЛ)' :
                   activeChar === 'mage' ? 'MAGE DISINTEGRATED (МАГ УГАС)' :
                   activeChar === 'monster' ? 'MONSTER CRUMBLED (МОНСТР РАССЫПАЛСЯ)' :
                   'ANIMAL IS DEFEATED (ЖИВОТНОЕ ОТСТУПИЛО)'}
                </span>
                <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                  {activeChar === 'warrior' ? 'The dragon or cold forces vanquished your knight. Revive him now to mine ores and wield the grand sword!' :
                   activeChar === 'dwarf' ? 'The mine shafts collapsed or heavy trolls struck him. Revive your master blacksmith now!' :
                   activeChar === 'elf' ? 'Out of arrows in battle, the graceful elf retreated.' :
                   activeChar === 'mage' ? 'Spell shield collapsed. The wizard has dissolved back into celestial starlight.' :
                   activeChar === 'monster' ? 'The beast took too much fire and hardened into cracked stone ruins.' :
                   'The harsh environmental ruins overcame the wild companion.'}
                </p>
                <button
                  id="btn-respawn-action"
                  onClick={triggerRespawn}
                  className="mt-4 px-6 py-2 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-white text-xs cursor-pointer shadow-md active:scale-95 transition-all"
                >
                  Revive & Respawn (R Key)
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="sandbox-guidance">
            
            {/* Keyboard bindings */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keyboard Bindings</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 font-mono text-xs text-slate-300" id="controls-keys-list">
                <div className="flex items-center gap-1.5">
                  <span className="min-w-12 text-center py-0.5 px-1.5 rounded bg-slate-900 border border-slate-800 font-bold text-indigo-400">WASD</span>
                  <span>Move Around</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="min-w-12 text-center py-0.5 px-1.5 rounded bg-slate-900 border border-slate-800 font-bold text-yellow-400">SPACE</span>
                  <span>
                    {activeChar === 'warrior' || activeChar === 'dwarf' ? 'Sword Slash' :
                     activeChar === 'elf' ? 'Shoot Arrow' :
                     activeChar === 'mage' ? 'Cast Magic Spell' :
                     activeChar === 'monster' ? 'Razor Claws' :
                     'Bite Node'}
                  </span>
                </div>
                {activeChar === 'warrior' || activeChar === 'dwarf' || activeChar === 'mage' || activeChar === 'monster' ? (
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-12 text-center py-0.5 px-1.5 rounded bg-slate-900 border border-slate-800 font-bold text-blue-400">B key</span>
                    <span>
                      {activeChar === 'warrior' || activeChar === 'dwarf' ? 'Shield Wall' :
                       activeChar === 'mage' ? 'Runic Barrier' :
                       'Sonic Roar'}
                    </span>
                  </div>
                ) : null}
                {activeChar === 'warrior' || activeChar === 'dwarf' ? (
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-12 text-center py-0.5 px-1.5 rounded bg-slate-900 border border-slate-800 font-bold text-orange-400">O key</span>
                    <span>Combat Roll</span>
                  </div>
                ) : null}
                <div className="flex items-center gap-1.5">
                  <span className="min-w-12 text-center py-0.5 px-1.5 rounded bg-slate-900 border border-slate-800 font-bold text-emerald-400">L key</span>
                  <span>
                    {activeChar === 'wolf' ? 'Sleep Red' :
                     activeChar === 'dwarf' ? 'Forge Ingot' :
                     activeChar === 'elf' ? 'Gather Arrow' :
                     activeChar === 'mage' ? 'Consult Tome' :
                     activeChar === 'monster' ? 'Dig Floor' :
                     'Work/Assemble'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="min-w-12 text-center py-0.5 px-1.5 rounded bg-slate-900 border border-slate-800 font-bold text-red-500">K key</span>
                  <span>Collapse Flat</span>
                </div>
              </div>
            </div>

            {/* Clickable Action Controllers */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mouse Controls</span>
              
              <div className="flex flex-wrap gap-1.5 mt-1" id="onscreen-action-buttons">
                {activeChar === 'humanoid' ? (
                  <>
                    <button
                      id="btn-trigger-strike-humanoid"
                      disabled={gameState !== 'alive'}
                      onClick={triggerCoreAction}
                      className="px-3 py-2 bg-red-650 hover:bg-red-550 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5 border border-red-500"
                    >
                      <Flame className="w-3.5 h-3.5 text-yellow-300" />
                      👊 Убор / Атака (Attack)
                    </button>
                    <button
                      id="btn-trigger-shield-humanoid"
                      disabled={gameState !== 'alive'}
                      onClick={triggerDefenseBlock}
                      className="px-3 py-2 bg-blue-650 hover:bg-blue-550 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5 border border-blue-500"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-blue-200" />
                      🛡️ Блокировать (Block)
                    </button>
                    <button
                      id="btn-trigger-jump-humanoid"
                      disabled={gameState !== 'alive'}
                      onClick={triggerJumpLeap}
                      className="px-3 py-2 bg-indigo-650 hover:bg-indigo-555 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5 border border-indigo-500"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      🦘 Прыгать (Jump)
                    </button>
                    <button
                      id="btn-trigger-roll-humanoid"
                      disabled={gameState !== 'alive'}
                      onClick={triggerRollEvade}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5 border border-amber-500"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                      🔄 Перекатиться (Roll)
                    </button>
                    <button
                      id="btn-trigger-craft-humanoid"
                      disabled={gameState !== 'alive'}
                      onClick={triggerRestOrInteract}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5 border border-emerald-500"
                    >
                      <Hammer className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
                      🛠️ Имитация работы (Work)
                    </button>
                  </>
                ) : activeChar === 'warrior' || activeChar === 'dwarf' ? (
                  <>
                    <button
                      id="btn-trigger-strike"
                      disabled={gameState !== 'alive'}
                      onClick={triggerCoreAction}
                      className="px-3 py-2 bg-red-650 hover:bg-red-550 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <Flame className="w-3.5 h-3.5 text-yellow-300" />
                      Wield Sword
                    </button>
                    <button
                      id="btn-trigger-shield"
                      disabled={gameState !== 'alive'}
                      onClick={triggerDefenseBlock}
                      className="px-3 py-2 bg-blue-650 hover:bg-blue-550 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Shield Wall
                    </button>
                    <button
                      id="btn-trigger-roll"
                      disabled={gameState !== 'alive'}
                      onClick={triggerRollEvade}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Dodge Roll
                    </button>
                    <button
                      id="btn-trigger-craft"
                      disabled={gameState !== 'alive'}
                      onClick={triggerRestOrInteract}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <Hammer className="w-3.5 h-3.5 text-yellow-300" />
                      Work/Assemble
                    </button>
                  </>
                ) : activeChar === 'elf' ? (
                  <>
                    <button
                      id="btn-trigger-shoot"
                      disabled={gameState !== 'alive'}
                      onClick={triggerCoreAction}
                      className="px-3 py-2 bg-green-650 hover:bg-green-555 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      🎯 Release Arrow
                    </button>
                    <button
                      id="btn-trigger-gather"
                      disabled={gameState !== 'alive'}
                      onClick={triggerRestOrInteract}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      🎒 Gather Arrow
                    </button>
                  </>
                ) : activeChar === 'mage' ? (
                  <>
                    <button
                      id="btn-trigger-spell"
                      disabled={gameState !== 'alive'}
                      onClick={triggerCoreAction}
                      className="px-3 py-2 bg-purple-650 hover:bg-purple-555 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      ✨ Cast Magic Spell
                    </button>
                    <button
                      id="btn-trigger-shield-mage"
                      disabled={gameState !== 'alive'}
                      onClick={triggerDefenseBlock}
                      className="px-3 py-2 bg-cyan-650 hover:bg-cyan-555 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      🌌 Energy Barrier
                    </button>
                    <button
                      id="btn-trigger-tome"
                      disabled={gameState !== 'alive'}
                      onClick={triggerRestOrInteract}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      📜 Study Tome Scroll
                    </button>
                  </>
                ) : activeChar === 'monster' ? (
                  <>
                    <button
                      id="btn-trigger-strike-monster"
                      disabled={gameState !== 'alive'}
                      onClick={triggerCoreAction}
                      className="px-3 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      🐺 Razor Claw Swipe
                    </button>
                    <button
                      id="btn-trigger-roar"
                      disabled={gameState !== 'alive'}
                      onClick={triggerDefenseBlock}
                      className="px-3 py-2 bg-amber-650 hover:bg-amber-555 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      🦁 Savage Roar Buff
                    </button>
                    <button
                      id="btn-trigger-dig"
                      disabled={gameState !== 'alive'}
                      onClick={triggerRestOrInteract}
                      className="px-3 py-2 bg-stone-600 hover:bg-stone-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      ⛏️ Dig/Mine Dirt
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      id="btn-trigger-bite"
                      disabled={gameState !== 'alive'}
                      onClick={triggerCoreAction}
                      className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all"
                    >
                      🦷 Snap Jaws (Bite)
                    </button>
                    <button
                      id="btn-trigger-rest"
                      disabled={gameState !== 'alive'}
                      onClick={triggerRestOrInteract}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all"
                    >
                      🛌 Lie Down & Sleep
                    </button>
                  </>
                )}
                <button
                  id="btn-trigger-collapse"
                  disabled={gameState !== 'alive'}
                  onClick={triggerSuicideCollapse}
                  className="px-3 py-2 bg-slate-840 hover:bg-red-800 disabled:opacity-40 text-slate-300 hover:text-white font-semibold rounded-lg text-xs cursor-pointer shadow active:scale-95 transition-all"
                >
                  💀 Collapse
                </button>
              </div>

              {/* D-Pad controls */}
              <div className="grid grid-cols-3 gap-1.5 w-28 mx-auto mt-2 select-none" id="joystick-pad">
                <div />
                <button
                  id="joy-up"
                  onMouseDown={() => setInputDir((prev) => ({ ...prev, up: true }))}
                  onMouseUp={() => setInputDir((prev) => ({ ...prev, up: false }))}
                  onTouchStart={() => setInputDir((prev) => ({ ...prev, up: true }))}
                  onTouchEnd={() => setInputDir((prev) => ({ ...prev, up: false }))}
                  className="p-1 rounded bg-slate-800 text-slate-200 active:bg-indigo-650 cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5 mx-auto" />
                </button>
                <div />
                <button
                  id="joy-left"
                  onMouseDown={() => setInputDir((prev) => ({ ...prev, left: true }))}
                  onMouseUp={() => setInputDir((prev) => ({ ...prev, left: false }))}
                  onTouchStart={() => setInputDir((prev) => ({ ...prev, left: true }))}
                  onTouchEnd={() => setInputDir((prev) => ({ ...prev, left: false }))}
                  className="p-1 rounded bg-slate-800 text-slate-205 active:bg-indigo-650 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mx-auto" />
                </button>
                <div className="flex items-center justify-center font-mono text-[9px] text-slate-500 font-bold">PAD</div>
                <button
                  id="joy-right"
                  onMouseDown={() => setInputDir((prev) => ({ ...prev, right: true }))}
                  onMouseUp={() => setInputDir((prev) => ({ ...prev, right: false }))}
                  onTouchStart={() => setInputDir((prev) => ({ ...prev, right: true }))}
                  onTouchEnd={() => setInputDir((prev) => ({ ...prev, right: false }))}
                  className="p-1 rounded bg-slate-800 text-slate-205 active:bg-indigo-650 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                </button>
                <div />
                <button
                  id="joy-down"
                  onMouseDown={() => setInputDir((prev) => ({ ...prev, down: true }))}
                  onMouseUp={() => setInputDir((prev) => ({ ...prev, down: false }))}
                  onTouchStart={() => setInputDir((prev) => ({ ...prev, down: true }))}
                  onTouchEnd={() => setInputDir((prev) => ({ ...prev, down: false }))}
                  className="p-1 rounded bg-slate-800 text-slate-205 active:bg-indigo-650 cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5 mx-auto" />
                </button>
                <div />
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
