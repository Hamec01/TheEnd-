export type CharacterType = 'wolf' | 'warrior' | 'elf' | 'mage' | 'monster' | 'dwarf' | 'humanoid';

export type WolfAnimationType = 'idle' | 'run_right' | 'run_left' | 'run_up' | 'run_down' | 'bite' | 'die';

export type WarriorAnimationType = 
  | 'idle' 
  | 'walk' 
  | 'run' 
  | 'jump' 
  | 'sword_strike' 
  | 'shield_block' 
  | 'roll' 
  | 'die' 
  | 'interact';

export type ElfAnimationType =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'shoot_bow'
  | 'die'
  | 'interact';

export type MageAnimationType =
  | 'idle'
  | 'walk'
  | 'run'
  | 'cast_spell'
  | 'shield_barrier'
  | 'die'
  | 'interact';

export type MonsterAnimationType =
  | 'idle'
  | 'walk'
  | 'run'
  | 'claws_slash'
  | 'roar_buff'
  | 'die'
  | 'interact';

export type HumanoidAnimationType =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'roll'
  | 'attack'
  | 'defense'
  | 'work'
  | 'die';

export type AnimationType = 
  | WolfAnimationType 
  | WarriorAnimationType 
  | ElfAnimationType 
  | MageAnimationType 
  | MonsterAnimationType
  | HumanoidAnimationType;

export interface WolfConfig {
  characterType: CharacterType;
  
  // Color configuration
  primaryColor: string;     // fur/plates armor/cloak primary
  secondaryColor: string;   // underbelly trim/secondary accent
  accentColor: string;      // tools/weapons
  eyeColor: string;         // visor/glowing eyes pupil
  eyeGlow: boolean;         // glowing eyes state

  // Equipment slots
  equipHelmet: boolean;      // Toggles helmet/headgear layer
  equipChestplate: boolean;  // Toggles chestplate/arm armor layer
  equipGloves: boolean;      // Toggles gloves/bracers layer
  equipBoots: boolean;       // Toggles boots/greaves layer
  equipBelt: boolean;        // Toggles waist level belt
  equipShield: boolean;      // Toggles hand shield
  equipWeapon: 'none' | 'sword' | 'bow' | 'staff' | 'axe' | 'halberd' | 'spear' | 'spear_throw' | 'shield_bash' | 'hands'; // Selected active weapon
  equipWeaponLeft?: 'none' | 'sword' | 'bow' | 'staff' | 'axe' | 'halberd' | 'spear' | 'shield' | 'dagger' | 'hands'; // Selected active left hand weapon

  // Custom base skin & hair (for "в трусах" model baseline)
  skinColor: string;         // Base skin color (e.g. #ffedd5)
  hairColor: string;         // Hair color (e.g. #facc15)
  underwearColor: string;    // Pants/shorts underwear color (e.g. #3b82f6)
  
  // Humanoid specific customizable variables
  humanoidRace: 'human' | 'elf' | 'dwarf' | 'orc' | 'undead' | 'vampire' | 'skeleton';
  bodyHeight: number;       // Torso offset / scale height
  armSize: number;          // Arm length and depth scale
  bellySize: number;        // Torso width / belly size index (размер живота)
  hairStyle: 'none' | 'short' | 'long' | 'braids' | 'crest';
  
  // Custom procedural FX
  fxType: 'none' | 'fire_slash' | 'magic_burst' | 'lightning_shield' | 'holy_sparkle' | 'frost_spike' | 'shadow_strike';
  fxColor: string;
  fxScale: number;
  fxFrame: number;          // Trigger active frame for FX simulation

  // Custom added animations state
  customAnimations?: Record<string, AnimationDefinition>;

  // Custom proportion fields (shared or adapted dynamically)
  tailLength: number;       // Wolf/Humanoid: Weapon size, Monster: Spike Size
  earSize: number;          // Wolf: Ear, Warrior/Humanoid: Helm plume / Pointed Ear size, Monster: Horns
  snoutLength: number;      // Wolf: Snout, Warrior/Humanoid: Shield / secondary scale, Monster: Maw size
  bodySize: number;         // Overall scale multiplier
  layerOrder?: string[];    // Custom rendering Z-index layer order: e.g. ['cape', 'back_leg', 'torso', 'front_leg', 'back_arm', 'head', 'front_arm']
  
  // Exporter specs
  resolution: 32 | 64 | 128 | 256; // Pixel count per frame
  fps: number;              // Target anim frame-rate speed
  outlineColor: string;     // Outer outline style border
  showOutline: boolean;     // Render sprite outlines

  // User uploaded custom PNGs (base64 Data URIs)
  uploadedBodyPng?: string;      // Custom body texture, clothes, or custom sprite overlay
  uploadedFxPng?: string;        // Custom strike/action FX sprite
  uploadedBodyMode?: 'static' | 'spliced' | 'full_sheet'; // How to draw the uploaded body overlay
  hideBaseBody?: boolean;        // Whether to completely hide the procedural base and render only the uploaded PNG
  customBodyScale?: number;      // Manual scaling multiplier for uploaded body
  customBodyOffsetX?: number;    // Manual X offset for custom body
  customBodyOffsetY?: number;    // Manual Y offset for custom body
  bakeFxInExport?: boolean;      // Whether to bake FX inside exported spritesheet sheets
  
  // Custom FX PNG configuration
  customFxScale?: number;        // scale of custom FX image
  customFxOffsetX?: number;      // X offset of custom FX image
  customFxOffsetY?: number;      // Y offset of custom FX image
  customFxRotation?: number;     // Rotation angle of custom FX (degrees)
  customFxFrameCount?: number;   // Frame slice count for custom FX image (1 for static)
  customFxTriggerFrame?: number; // Animation trigger frame

  // THEEND compatibility metadata configs for export
  theendSkillClass?: string;     // e.g. "melee_slash", "magic_blast", "shamanic_call", "bow_shot", "custom"
  theendDamageCategory?: 'physical' | 'elemental' | 'magic' | 'shamanic' | 'runic' | 'bleed' | 'poison' | 'true';
  theendDamageType?: 'slash' | 'pierce' | 'blunt' | 'cleave' | 'unarmed';
  theendElementType?: 'fire' | 'water' | 'earth' | 'air' | 'light' | 'dark' | 'none';
  theendSoundPreset?: 'sword_slash' | 'spell_blast' | 'arrow_shoot' | 'curse_whisper' | 'heavy_roar' | 'none';
}

export interface AnimationDefinition {
  type: AnimationType;
  name: string;
  frameCount: number;
  description: string;
  row: number;
}

export const WOLF_ANIMATIONS: Record<WolfAnimationType, AnimationDefinition> = {
  idle: {
    type: 'idle',
    name: 'Lie Down & Rest',
    frameCount: 6,
    description: 'Wolf rests on the ground, breathing gently with its tail relaxed.',
    row: 0,
  },
  run_right: {
    type: 'run_right',
    name: 'Run Right',
    frameCount: 8,
    description: 'Wolf running right, full leg extension and tail streaming.',
    row: 1,
  },
  run_left: {
    type: 'run_left',
    name: 'Run Left',
    frameCount: 8,
    description: 'Wolf running left, full leg extension and tail streaming.',
    row: 2,
  },
  run_up: {
    type: 'run_up',
    name: 'Run Up / Away',
    frameCount: 8,
    description: 'Wolf running upwards, back-view leg pacing.',
    row: 3,
  },
  run_down: {
    type: 'run_down',
    name: 'Run Down / Forward',
    frameCount: 8,
    description: 'Wolf running downwards, front-view chest and head bobbing.',
    row: 4,
  },
  bite: {
    type: 'bite',
    name: 'Bite / Attack',
    frameCount: 6,
    description: 'Lunge forward with teeth exposed and jaw snapping shut.',
    row: 5,
  },
  die: {
    type: 'die',
    name: 'Die / Collapse',
    frameCount: 6,
    description: 'Wolf falls onto its side, legs going limp, turning eyes to cross markers.',
    row: 6,
  },
};

export const WARRIOR_ANIMATIONS: Record<WarriorAnimationType, AnimationDefinition> = {
  idle: {
    type: 'idle',
    name: 'Idle Breather (Stance)',
    frameCount: 6,
    description: 'Warrior stands alert, armor glistening, red cape rustling in the breeze.',
    row: 0,
  },
  walk: {
    type: 'walk',
    name: 'March Walk',
    frameCount: 8,
    description: 'Rhythmic martial patrol stride, sword moving in rhythm.',
    row: 1,
  },
  run: {
    type: 'run',
    name: 'Charge Sprint',
    frameCount: 8,
    description: 'Leaning forward in aggressive sprint, cape trailing horizontally.',
    row: 2,
  },
  jump: {
    type: 'jump',
    name: 'Agile Jump / Leap',
    frameCount: 6,
    description: 'Bends knees, leaps high, rising arms, before landing back to stance.',
    row: 3,
  },
  sword_strike: {
    type: 'sword_strike',
    name: 'Heavy Sword Slash',
    frameCount: 6,
    description: 'Warrior raises longsword high and brings it down in a powerful arc.',
    row: 4,
  },
  shield_block: {
    type: 'shield_block',
    name: 'Iron Shield Guard',
    frameCount: 6,
    description: 'Hunkers, slides shield forward, defending incoming projectiles.',
    row: 5,
  },
  roll: {
    type: 'roll',
    name: 'Acrobatic Dodge Roll',
    frameCount: 6,
    description: 'Warrior performs a full 360-degree combat roll to evade damage.',
    row: 6,
  },
  die: {
    type: 'die',
    name: 'Vanquished (Death)',
    frameCount: 6,
    description: 'Shield shatters, knees buckle, sword slips, and warrior collapses flat.',
    row: 7,
  },
  interact: {
    type: 'interact',
    name: 'Interact / Assemble / Mine',
    frameCount: 8,
    description: 'Bends over, coordinates arms working, hammering or gathering minerals.',
    row: 8,
  },
};

export const ELF_ANIMATIONS: Record<ElfAnimationType, AnimationDefinition> = {
  idle: {
    type: 'idle',
    name: 'Elegant Idle Standing',
    frameCount: 6,
    description: 'Elf Archer breathes gracefully, adjusting quiver and light bow.',
    row: 0,
  },
  walk: {
    type: 'walk',
    name: 'Stealthy Elven Walk',
    frameCount: 8,
    description: 'Quiet, silent woodland paces keeping balance perfectly.',
    row: 1,
  },
  run: {
    type: 'run',
    name: 'Nimble Swift Run',
    frameCount: 8,
    description: 'Fast, graceful running pacing, holding bow horizontally.',
    row: 2,
  },
  jump: {
    type: 'jump',
    name: 'Acrobatic Flip Jump',
    frameCount: 6,
    description: 'Leaps and does a nimble flip, landing with archer precision.',
    row: 3,
  },
  shoot_bow: {
    type: 'shoot_bow',
    name: 'Bow draw and fire (Shoot)',
    frameCount: 8,
    description: 'Raises bow, pulls the string back, and shoots a fast glowing arrow.',
    row: 4,
  },
  die: {
    type: 'die',
    name: 'Foliage Fall (Death)',
    frameCount: 6,
    description: 'Collapses like leaves, bow dropping as they dissolve slightly.',
    row: 5,
  },
  interact: {
    type: 'interact',
    name: 'Fleshing Arrow Craft',
    frameCount: 8,
    description: 'Carves arrows, inspecting and fletching feathers with diligent hands.',
    row: 6,
  },
};

export const MAGE_ANIMATIONS: Record<MageAnimationType, AnimationDefinition> = {
  idle: {
    type: 'idle',
    name: 'Wizard Breather Stance',
    frameCount: 6,
    description: 'Mage is floating slightly above the floor with an ornate swirling staff.',
    row: 0,
  },
  walk: {
    type: 'walk',
    name: 'Levitating Walk Glide',
    frameCount: 8,
    description: 'Hovering and glide-marching, robes flowing in mystical tides.',
    row: 1,
  },
  run: {
    type: 'run',
    name: 'Teleporting Dash (Sprint)',
    frameCount: 8,
    description: 'Fast magical dash leaving particle traces or energy sparks.',
    row: 2,
  },
  cast_spell: {
    type: 'cast_spell',
    name: 'Elemental Spell Cast',
    frameCount: 8,
    description: 'Staff flashes brightly, launching a flaming magical projectile.',
    row: 3,
  },
  shield_barrier: {
    type: 'shield_barrier',
    name: 'Aegis Runeshield Protection',
    frameCount: 6,
    description: 'Expands a spherical runic shield barrier blocking physical hits.',
    row: 4,
  },
  die: {
    type: 'die',
    name: 'Astral Dispersion (Death)',
    frameCount: 6,
    description: 'Collapses into raw light crystals, robes shrinking empty onto the floor.',
    row: 5,
  },
  interact: {
    type: 'interact',
    name: 'Alchemy Potions / Scrolls',
    frameCount: 8,
    description: 'Combines glowing wizard potions or studies ancient parchment scrolls.',
    row: 6,
  },
};

export const MONSTER_ANIMATIONS: Record<MonsterAnimationType, AnimationDefinition> = {
  idle: {
    type: 'idle',
    name: 'Savage Alert Idle',
    frameCount: 6,
    description: 'Monster growls, spike plates rising and chest breathing heavily.',
    row: 0,
  },
  walk: {
    type: 'walk',
    name: 'Heavy Ground Walk',
    frameCount: 8,
    description: 'Lumbering heavy stomp, shaking the floor terrain with each step.',
    row: 1,
  },
  run: {
    type: 'run',
    name: 'Terrifying Rampage Swift',
    frameCount: 8,
    description: 'Rushes forward on all fours, slamming head and snout aggressively.',
    row: 2,
  },
  claws_slash: {
    type: 'claws_slash',
    name: 'Double Spike Claws Swipe',
    frameCount: 8,
    description: 'Slashes with massive dynamic claw spikes, leaving blood-red arcs.',
    row: 3,
  },
  roar_buff: {
    type: 'roar_buff',
    name: 'Apocalyptic Sound Roar',
    frameCount: 6,
    description: 'Roars loudly into the air, generating screen-shake sonic waves.',
    row: 4,
  },
  die: {
    type: 'die',
    name: 'Earthen Collapse (Death)',
    frameCount: 6,
    description: 'Petrifies, breaking into shattered stone fragments or molten lava.',
    row: 5,
  },
  interact: {
    type: 'interact',
    name: 'Devouring Ores / Mining',
    frameCount: 8,
    description: 'Bites into minerals and ores directly, tearing ground with heavy claws.',
    row: 6,
  },
};

export const HUMANOID_ANIMATIONS: Record<HumanoidAnimationType, AnimationDefinition> = {
  idle: {
    type: 'idle',
    name: 'Idle Breather (Stance)',
    frameCount: 6,
    description: 'Humanoid stands breathing gently in ready stance.',
    row: 0,
  },
  walk: {
    type: 'walk',
    name: 'March Walk',
    frameCount: 8,
    description: 'Steadied, rhythmic ground stepping march cycle.',
    row: 1,
  },
  run: {
    type: 'run',
    name: 'Charge Sprint',
    frameCount: 8,
    description: 'Aggressive forward speed dash showing cape flapping.',
    row: 2,
  },
  jump: {
    type: 'jump',
    name: 'Agile Jump & Leap',
    frameCount: 6,
    description: 'Bends knees, rises to peak height, then recovers gracefully.',
    row: 3,
  },
  roll: {
    type: 'roll',
    name: 'Combat Dodge Roll',
    frameCount: 6,
    description: 'Quick tumble roll spinning 360 degrees on the ground.',
    row: 4,
  },
  attack: {
    type: 'attack',
    name: 'Combat Strike (Attack)',
    frameCount: 6,
    description: 'Strikes with equipped weapon/hands, emitting sparks or customized FX.',
    row: 5,
  },
  defense: {
    type: 'defense',
    name: 'Guarded Stance (Block)',
    frameCount: 6,
    description: 'Protective shield block position creating sparks or barriers.',
    row: 6,
  },
  work: {
    type: 'work',
    name: 'Worker Task (Blacksmith/Dig)',
    frameCount: 8,
    description: 'Works with precision tools, hammering materials or reading scrolls.',
    row: 7,
  },
  die: {
    type: 'die',
    name: 'Vanquished (Death)',
    frameCount: 6,
    description: 'Character takes final damage, slips weapon, and collapses flat.',
    row: 8,
  },
};

