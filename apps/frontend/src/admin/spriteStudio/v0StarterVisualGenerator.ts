import type { ImageSheetDefinition, StoredImage } from '../../services/content/models';
import { replaceContentImage, uploadContentImage } from '../../services/content/contentApi';
import { imageSheetsService } from '../../services/content/imageSheetsService';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import {
  STARTER_V0_ANIMATION_SET_IDS,
  STARTER_V0_BODY_TEMPLATE_IDS,
  STARTER_V0_EQUIPMENT_BINDING_IDS,
  type StarterSpriteStudioVisualAssetRefs,
} from '../../sprite-studio-core';
import type {
  AnimationDefinition,
  CharacterType,
  ElfAnimationType,
  MonsterAnimationType,
  WarriorAnimationType,
  WolfAnimationType,
  WolfConfig,
} from '../../../../../sprite+engine/src/types';
import {
  ELF_ANIMATIONS,
  MONSTER_ANIMATIONS,
  WARRIOR_ANIMATIONS,
  WOLF_ANIMATIONS,
} from '../../../../../sprite+engine/src/types';
import { drawElf } from '../../../../../sprite+engine/src/utils/elfDrawing';
import { drawHumanoid } from '../../../../../sprite+engine/src/utils/humanoidDrawing';
import { drawMonster } from '../../../../../sprite+engine/src/utils/monsterDrawing';
import { drawWarrior } from '../../../../../sprite+engine/src/utils/warriorDrawing';
import { drawWolf } from '../../../../../sprite+engine/src/utils/wolfDrawing';

const FRAME_SIZE = 128;
const SPRITESHEET_COLUMNS = 8;

interface GeneratedImageSpec {
  id: string;
  name: string;
  width: number;
  height: number;
  folder: string;
  dataUrl: string;
}

interface RenderedStarterVisualPack {
  images: GeneratedImageSpec[];
  sheets: ImageSheetDefinition[];
  refs: StarterSpriteStudioVisualAssetRefs;
}

function createBaseConfig(overrides: Partial<WolfConfig>): WolfConfig {
  return {
    characterType: 'humanoid',
    primaryColor: '#7b2230',
    secondaryColor: '#cfb26f',
    accentColor: '#7ea1c8',
    eyeColor: '#38bdf8',
    eyeGlow: false,
    equipHelmet: false,
    equipChestplate: false,
    equipGloves: false,
    equipBoots: false,
    equipBelt: false,
    equipShield: false,
    equipWeapon: 'none',
    equipWeaponLeft: 'none',
    skinColor: '#f2d0b1',
    hairColor: '#6b3b1d',
    underwearColor: '#365f9b',
    humanoidRace: 'human',
    bodyHeight: 1,
    armSize: 1,
    bellySize: 1,
    hairStyle: 'short',
    fxType: 'none',
    fxColor: '#38bdf8',
    fxScale: 1,
    fxFrame: 0,
    tailLength: 1,
    earSize: 1,
    snoutLength: 1,
    bodySize: 1,
    resolution: FRAME_SIZE,
    fps: 8,
    outlineColor: '#111827',
    showOutline: false,
    uploadedBodyPng: undefined,
    uploadedFxPng: undefined,
    uploadedBodyMode: 'static',
    hideBaseBody: false,
    customBodyScale: 1,
    customBodyOffsetX: 0,
    customBodyOffsetY: 0,
    bakeFxInExport: false,
    customFxScale: 1,
    customFxOffsetX: 0,
    customFxOffsetY: 0,
    customFxRotation: 0,
    customFxFrameCount: 1,
    customFxTriggerFrame: 0,
    theendSkillClass: 'custom',
    theendDamageCategory: 'physical',
    theendDamageType: 'slash',
    theendElementType: 'none',
    theendSoundPreset: 'none',
    ...overrides,
  };
}

function createFrameCanvas(size = FRAME_SIZE): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function clearCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable.');
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

function drawCharacterFrame(params: {
  config: WolfConfig;
  animationType: string;
  frame: number;
  flipX?: boolean;
}): HTMLCanvasElement {
  const canvas = createFrameCanvas();
  const ctx = clearCanvas(canvas);
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 + 15;
  const flipX = params.flipX ?? false;
  const character = params.config.characterType;

  if (character === 'warrior' || character === 'dwarf') {
    drawWarrior(ctx, params.config, params.animationType as WarriorAnimationType, params.frame, centerX, centerY, flipX);
    return canvas;
  }
  if (character === 'elf') {
    drawElf(ctx, params.config, params.animationType as ElfAnimationType, params.frame, centerX, centerY, flipX);
    return canvas;
  }
  if (character === 'monster') {
    drawMonster(ctx, params.config, params.animationType as MonsterAnimationType, params.frame, centerX, centerY);
    return canvas;
  }
  if (character === 'wolf') {
    drawWolf(ctx, params.config, params.animationType as WolfAnimationType, params.frame, centerX, centerY);
    return canvas;
  }
  drawHumanoid(ctx, params.config, params.animationType, params.frame, centerX, centerY, flipX);
  return canvas;
}

function diffOverlayCanvas(baseCanvas: HTMLCanvasElement, equippedCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const next = createFrameCanvas();
  const baseCtx = baseCanvas.getContext('2d');
  const equippedCtx = equippedCanvas.getContext('2d');
  const nextCtx = next.getContext('2d');
  if (!baseCtx || !equippedCtx || !nextCtx) {
    throw new Error('Canvas 2D context is unavailable.');
  }

  const baseData = baseCtx.getImageData(0, 0, baseCanvas.width, baseCanvas.height);
  const equippedData = equippedCtx.getImageData(0, 0, equippedCanvas.width, equippedCanvas.height);
  const result = nextCtx.createImageData(next.width, next.height);

  for (let index = 0; index < equippedData.data.length; index += 4) {
    const same =
      baseData.data[index] === equippedData.data[index]
      && baseData.data[index + 1] === equippedData.data[index + 1]
      && baseData.data[index + 2] === equippedData.data[index + 2]
      && baseData.data[index + 3] === equippedData.data[index + 3];

    if (same) {
      result.data[index] = 0;
      result.data[index + 1] = 0;
      result.data[index + 2] = 0;
      result.data[index + 3] = 0;
      continue;
    }

    result.data[index] = equippedData.data[index];
    result.data[index + 1] = equippedData.data[index + 1];
    result.data[index + 2] = equippedData.data[index + 2];
    result.data[index + 3] = equippedData.data[index + 3];
  }

  nextCtx.putImageData(result, 0, 0);
  return next;
}

function buildImageSpec(params: {
  id: string;
  name: string;
  folder: string;
  canvas: HTMLCanvasElement;
}): GeneratedImageSpec {
  return {
    id: params.id,
    name: params.name,
    folder: params.folder,
    width: params.canvas.width,
    height: params.canvas.height,
    dataUrl: params.canvas.toDataURL('image/png'),
  };
}

function createTransparentCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function buildSpritesheet(params: {
  id: string;
  name: string;
  folder: string;
  config: WolfConfig;
  actions: Array<{
    sourceAction: string;
    frameCount: number;
  }>;
}): GeneratedImageSpec {
  const rows = params.actions.length;
  const canvas = createTransparentCanvas(SPRITESHEET_COLUMNS * FRAME_SIZE, rows * FRAME_SIZE);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable.');
  }

  for (const [rowIndex, action] of params.actions.entries()) {
    for (let frame = 0; frame < action.frameCount; frame += 1) {
      const frameCanvas = drawCharacterFrame({
        config: params.config,
        animationType: action.sourceAction,
        frame,
      });
      ctx.drawImage(frameCanvas, frame * FRAME_SIZE, rowIndex * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE);
    }
  }

  return buildImageSpec({
    id: params.id,
    name: params.name,
    folder: params.folder,
    canvas,
  });
}

function buildSheetDefinition(params: {
  id: string;
  name: string;
  src: string;
  rows: number;
}): ImageSheetDefinition {
  return {
    id: params.id,
    name: params.name,
    category: 'other',
    src: params.src,
    frameWidth: FRAME_SIZE,
    frameHeight: FRAME_SIZE,
    columns: SPRITESHEET_COLUMNS,
    rows: params.rows,
  };
}

function getStarterVisualFolders() {
  return {
    body: buildUploadFolder('images', 'sprite-studio', 'body') ?? 'images/sprite-studio/body',
    equipment: buildUploadFolder('images', 'sprite-studio', 'equipment') ?? 'images/sprite-studio/equipment',
    monsters: buildUploadFolder('images', 'sprite-studio', 'monsters') ?? 'images/sprite-studio/monsters',
    sheets: buildUploadFolder('images', 'sprite-studio', 'sheets') ?? 'images/sprite-studio/sheets',
  };
}

function renderStarterVisualPack(): RenderedStarterVisualPack {
  const folders = getStarterVisualFolders();

  const humanBaseConfig = createBaseConfig({
    characterType: 'humanoid',
    humanoidRace: 'human',
    hairStyle: 'short',
    equipWeapon: 'none',
    equipShield: false,
    equipHelmet: false,
    equipChestplate: false,
    equipBelt: true,
  });
  const humanBodyCanvas = drawCharacterFrame({ config: humanBaseConfig, animationType: 'idle', frame: 0 });
  const humanSwordCanvas = diffOverlayCanvas(
    humanBodyCanvas,
    drawCharacterFrame({
      config: createBaseConfig({ ...humanBaseConfig, equipWeapon: 'sword' }),
      animationType: 'idle',
      frame: 0,
    }),
  );
  const humanShieldCanvas = diffOverlayCanvas(
    humanBodyCanvas,
    drawCharacterFrame({
      config: createBaseConfig({ ...humanBaseConfig, equipShield: true, equipWeaponLeft: 'shield' }),
      animationType: 'idle',
      frame: 0,
    }),
  );
  const humanHelmetCanvas = diffOverlayCanvas(
    humanBodyCanvas,
    drawCharacterFrame({
      config: createBaseConfig({ ...humanBaseConfig, equipHelmet: true }),
      animationType: 'idle',
      frame: 0,
    }),
  );
  const humanChestCanvas = diffOverlayCanvas(
    humanBodyCanvas,
    drawCharacterFrame({
      config: createBaseConfig({ ...humanBaseConfig, equipChestplate: true }),
      animationType: 'idle',
      frame: 0,
    }),
  );

  const elfBodyCanvas = drawCharacterFrame({
    config: createBaseConfig({
      characterType: 'elf',
      equipWeapon: 'none',
      equipChestplate: false,
      equipHelmet: false,
      equipShield: false,
    }),
    animationType: 'idle',
    frame: 0,
  });

  const dwarfBodyCanvas = drawCharacterFrame({
    config: createBaseConfig({
      characterType: 'dwarf',
      equipWeapon: 'none',
      equipChestplate: false,
      equipHelmet: false,
      equipShield: false,
    }),
    animationType: 'idle',
    frame: 0,
  });

  const wolfBodyCanvas = drawCharacterFrame({
    config: createBaseConfig({
      characterType: 'wolf',
      primaryColor: '#6f5b44',
      secondaryColor: '#bca17a',
      accentColor: '#4a4a4a',
      eyeColor: '#f8fafc',
    }),
    animationType: 'idle',
    frame: 0,
  });

  const monsterBodyCanvas = drawCharacterFrame({
    config: createBaseConfig({
      characterType: 'monster',
      primaryColor: '#365c47',
      secondaryColor: '#7ab47e',
      accentColor: '#c3d16b',
      eyeColor: '#f97316',
    }),
    animationType: 'idle',
    frame: 0,
  });

  const images: GeneratedImageSpec[] = [
    buildImageSpec({
      id: 'img_sprite_studio_body_human_male_basic_body',
      name: 'sprite-studio-body-human-male-basic-body',
      folder: folders.body,
      canvas: humanBodyCanvas,
    }),
    buildImageSpec({
      id: 'img_sprite_studio_body_elf_male_basic_body',
      name: 'sprite-studio-body-elf-male-basic-body',
      folder: folders.body,
      canvas: elfBodyCanvas,
    }),
    buildImageSpec({
      id: 'img_sprite_studio_body_dwarf_basic_body',
      name: 'sprite-studio-body-dwarf-basic-body',
      folder: folders.body,
      canvas: dwarfBodyCanvas,
    }),
    buildImageSpec({
      id: 'img_sprite_studio_monster_wolf_basic_sprite',
      name: 'sprite-studio-monster-wolf-basic-sprite',
      folder: folders.monsters,
      canvas: wolfBodyCanvas,
    }),
    buildImageSpec({
      id: 'img_sprite_studio_monster_basic_sprite',
      name: 'sprite-studio-monster-basic-sprite',
      folder: folders.monsters,
      canvas: monsterBodyCanvas,
    }),
    buildImageSpec({
      id: 'img_sprite_studio_equipment_starter_sword_visual',
      name: 'sprite-studio-equipment-starter-sword-visual',
      folder: folders.equipment,
      canvas: humanSwordCanvas,
    }),
    buildImageSpec({
      id: 'img_sprite_studio_equipment_starter_shield_visual',
      name: 'sprite-studio-equipment-starter-shield-visual',
      folder: folders.equipment,
      canvas: humanShieldCanvas,
    }),
    buildImageSpec({
      id: 'img_sprite_studio_equipment_starter_helmet_visual',
      name: 'sprite-studio-equipment-starter-helmet-visual',
      folder: folders.equipment,
      canvas: humanHelmetCanvas,
    }),
    buildImageSpec({
      id: 'img_sprite_studio_equipment_starter_chest_armor_visual',
      name: 'sprite-studio-equipment-starter-chest-armor-visual',
      folder: folders.equipment,
      canvas: humanChestCanvas,
    }),
  ];

  const humanoidSheet = buildSpritesheet({
    id: 'img_sprite_studio_sheet_humanoid_basic_battle',
    name: 'sprite-studio-sheet-humanoid-basic-battle',
    folder: folders.sheets,
    config: humanBaseConfig,
    actions: [
      { sourceAction: 'idle', frameCount: WARRIOR_ANIMATIONS.idle.frameCount },
      { sourceAction: 'walk', frameCount: WARRIOR_ANIMATIONS.walk.frameCount },
      { sourceAction: 'attack', frameCount: 6 },
    ],
  });
  const elfSheet = buildSpritesheet({
    id: 'img_sprite_studio_sheet_elf_basic_battle',
    name: 'sprite-studio-sheet-elf-basic-battle',
    folder: folders.sheets,
    config: createBaseConfig({ characterType: 'elf', equipWeapon: 'bow' }),
    actions: [
      { sourceAction: 'idle', frameCount: ELF_ANIMATIONS.idle.frameCount },
      { sourceAction: 'walk', frameCount: ELF_ANIMATIONS.walk.frameCount },
      { sourceAction: 'shoot_bow', frameCount: ELF_ANIMATIONS.shoot_bow.frameCount },
    ],
  });
  const wolfSheet = buildSpritesheet({
    id: 'img_sprite_studio_sheet_wolf_basic_battle',
    name: 'sprite-studio-sheet-wolf-basic-battle',
    folder: folders.sheets,
    config: createBaseConfig({ characterType: 'wolf', primaryColor: '#6f5b44', secondaryColor: '#bca17a', accentColor: '#4a4a4a' }),
    actions: [
      { sourceAction: 'idle', frameCount: WOLF_ANIMATIONS.idle.frameCount },
      { sourceAction: 'run_right', frameCount: WOLF_ANIMATIONS.run_right.frameCount },
      { sourceAction: 'bite', frameCount: WOLF_ANIMATIONS.bite.frameCount },
    ],
  });
  const monsterSheet = buildSpritesheet({
    id: 'img_sprite_studio_sheet_monster_basic_battle',
    name: 'sprite-studio-sheet-monster-basic-battle',
    folder: folders.sheets,
    config: createBaseConfig({ characterType: 'monster', primaryColor: '#365c47', secondaryColor: '#7ab47e', accentColor: '#c3d16b' }),
    actions: [
      { sourceAction: 'idle', frameCount: MONSTER_ANIMATIONS.idle.frameCount },
      { sourceAction: 'walk', frameCount: MONSTER_ANIMATIONS.walk.frameCount },
      { sourceAction: 'claws_slash', frameCount: MONSTER_ANIMATIONS.claws_slash.frameCount },
    ],
  });

  const sheetImages = [humanoidSheet, elfSheet, wolfSheet, monsterSheet];
  const allImages = [...images, ...sheetImages];

  const humanoidSheetDefinition = buildSheetDefinition({
    id: 'sheet_sprite_studio_humanoid_basic_battle',
    name: 'Sprite Studio Humanoid Basic Battle',
    src: humanoidSheet.id,
    rows: 3,
  });
  const elfSheetDefinition = buildSheetDefinition({
    id: 'sheet_sprite_studio_elf_basic_battle',
    name: 'Sprite Studio Elf Basic Battle',
    src: elfSheet.id,
    rows: 3,
  });
  const wolfSheetDefinition = buildSheetDefinition({
    id: 'sheet_sprite_studio_wolf_basic_battle',
    name: 'Sprite Studio Wolf Basic Battle',
    src: wolfSheet.id,
    rows: 3,
  });
  const monsterSheetDefinition = buildSheetDefinition({
    id: 'sheet_sprite_studio_monster_basic_battle',
    name: 'Sprite Studio Monster Basic Battle',
    src: monsterSheet.id,
    rows: 3,
  });

  return {
    images: allImages,
    sheets: [
      humanoidSheetDefinition,
      elfSheetDefinition,
      wolfSheetDefinition,
      monsterSheetDefinition,
    ],
    refs: {
      bodyImageIds: {
        humanMale: 'img_sprite_studio_body_human_male_basic_body',
        elfMale: 'img_sprite_studio_body_elf_male_basic_body',
        dwarf: 'img_sprite_studio_body_dwarf_basic_body',
        wolf: 'img_sprite_studio_monster_wolf_basic_sprite',
        monster: 'img_sprite_studio_monster_basic_sprite',
      },
      equipmentImageIds: {
        sword: 'img_sprite_studio_equipment_starter_sword_visual',
        shield: 'img_sprite_studio_equipment_starter_shield_visual',
        helmet: 'img_sprite_studio_equipment_starter_helmet_visual',
        chestArmor: 'img_sprite_studio_equipment_starter_chest_armor_visual',
      },
      animationSheets: {
        humanoidBattle: humanoidSheetDefinition,
        elfBattle: elfSheetDefinition,
        wolfBattle: wolfSheetDefinition,
        monsterBattle: monsterSheetDefinition,
      },
    },
  };
}

async function upsertStoredImage(existingImages: StoredImage[], spec: GeneratedImageSpec): Promise<StoredImage> {
  const existing = existingImages.find((entry) => entry.id === spec.id);
  if (existing) {
    return replaceContentImage(spec.id, {
      id: spec.id,
      name: spec.name,
      mimeType: 'image/png',
      dataUrl: spec.dataUrl,
      width: spec.width,
      height: spec.height,
    });
  }
  return uploadContentImage({
    id: spec.id,
    name: spec.name,
    mimeType: 'image/png',
    width: spec.width,
    height: spec.height,
    folder: spec.folder,
    dataUrl: spec.dataUrl,
  });
}

export interface MaterializedStarterVisualAssetsResult {
  refs: StarterSpriteStudioVisualAssetRefs;
  uploadedImageIds: string[];
  imageSheetIds: string[];
  generatedImageIds: string[];
}

export async function materializeStarterSpriteStudioVisualAssets(params: {
  existingImages: StoredImage[];
}): Promise<MaterializedStarterVisualAssetsResult> {
  const rendered = renderStarterVisualPack();
  const uploadedImages: StoredImage[] = [];

  for (const image of rendered.images) {
    uploadedImages.push(await upsertStoredImage(params.existingImages, image));
  }

  for (const sheet of rendered.sheets) {
    await imageSheetsService.upsert(sheet);
  }

  return {
    refs: rendered.refs,
    uploadedImageIds: uploadedImages.map((entry) => entry.id),
    imageSheetIds: rendered.sheets.map((entry) => entry.id),
    generatedImageIds: rendered.images.map((entry) => entry.id),
  };
}

export function describeMaterializedStarterVisuals(result: MaterializedStarterVisualAssetsResult): string {
  return [
    `Generated V0 starter visuals: ${result.generatedImageIds.length} images`,
    `stored ids: ${result.uploadedImageIds.join(', ')}`,
    `sheets: ${result.imageSheetIds.join(', ')}`,
    `demo body: ${STARTER_V0_BODY_TEMPLATE_IDS.humanMale}`,
    `demo bindings: ${STARTER_V0_EQUIPMENT_BINDING_IDS.starterSword}, ${STARTER_V0_EQUIPMENT_BINDING_IDS.starterShield}, ${STARTER_V0_EQUIPMENT_BINDING_IDS.starterHelmet}, ${STARTER_V0_EQUIPMENT_BINDING_IDS.starterChestArmor}`,
    `demo animation set: ${STARTER_V0_ANIMATION_SET_IDS.humanoidBattle}`,
  ].join(' | ');
}
