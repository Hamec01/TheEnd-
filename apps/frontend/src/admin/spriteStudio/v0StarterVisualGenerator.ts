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
import { generateEquipmentOverlay, generateHumanoidBody } from './generators/humanoid/humanoidGenerator';
import { generateMonsterSprite, generateWolfSprite } from './generators/monsters/monsterGenerator';
import { FRAME_SIZE, SPRITESHEET_COLUMNS } from './generators/shared/canvasUtils';
import { buildSpritesheet } from './generators/shared/spritesheetGenerator';

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

export interface MaterializedStarterVisualAssetsResult {
  refs: StarterSpriteStudioVisualAssetRefs;
  uploadedImageIds: string[];
  imageSheetIds: string[];
  generatedImageIds: string[];
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

  const humanBodyCanvas = generateHumanoidBody({ race: 'human', pose: 'idle', frame: 0 });
  const elfBodyCanvas = generateHumanoidBody({ race: 'elf', pose: 'idle', frame: 0 });
  const dwarfBodyCanvas = generateHumanoidBody({ race: 'dwarf', pose: 'idle', frame: 0 });
  const wolfBodyCanvas = generateWolfSprite(0);
  const monsterBodyCanvas = generateMonsterSprite(0);

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
      canvas: generateEquipmentOverlay('sword'),
    }),
    buildImageSpec({
      id: 'img_sprite_studio_equipment_starter_shield_visual',
      name: 'sprite-studio-equipment-starter-shield-visual',
      folder: folders.equipment,
      canvas: generateEquipmentOverlay('shield'),
    }),
    buildImageSpec({
      id: 'img_sprite_studio_equipment_starter_helmet_visual',
      name: 'sprite-studio-equipment-starter-helmet-visual',
      folder: folders.equipment,
      canvas: generateEquipmentOverlay('helmet'),
    }),
    buildImageSpec({
      id: 'img_sprite_studio_equipment_starter_chest_armor_visual',
      name: 'sprite-studio-equipment-starter-chest-armor-visual',
      folder: folders.equipment,
      canvas: generateEquipmentOverlay('chestArmor'),
    }),
  ];

  const humanoidSheetImage = buildImageSpec({
    id: 'img_sprite_studio_sheet_humanoid_basic_battle',
    name: 'sprite-studio-sheet-humanoid-basic-battle',
    folder: folders.sheets,
    canvas: buildSpritesheet([
      { key: 'idle', frameCount: 6, renderFrame: (frame) => generateHumanoidBody({ race: 'human', pose: 'idle', frame }) },
      { key: 'walk', frameCount: 8, renderFrame: (frame) => generateHumanoidBody({ race: 'human', pose: 'walk', frame }) },
      { key: 'attack', frameCount: 6, renderFrame: (frame) => generateHumanoidBody({ race: 'human', pose: 'attack', frame }) },
    ]),
  });
  const elfSheetImage = buildImageSpec({
    id: 'img_sprite_studio_sheet_elf_basic_battle',
    name: 'sprite-studio-sheet-elf-basic-battle',
    folder: folders.sheets,
    canvas: buildSpritesheet([
      { key: 'idle', frameCount: 6, renderFrame: (frame) => generateHumanoidBody({ race: 'elf', pose: 'idle', frame }) },
      { key: 'walk', frameCount: 8, renderFrame: (frame) => generateHumanoidBody({ race: 'elf', pose: 'walk', frame }) },
      { key: 'attack_ranged', frameCount: 6, renderFrame: (frame) => generateHumanoidBody({ race: 'elf', pose: 'attack', frame }) },
    ]),
  });
  const wolfSheetImage = buildImageSpec({
    id: 'img_sprite_studio_sheet_wolf_basic_battle',
    name: 'sprite-studio-sheet-wolf-basic-battle',
    folder: folders.sheets,
    canvas: buildSpritesheet([
      { key: 'idle', frameCount: 6, renderFrame: (frame) => generateWolfSprite(frame) },
      { key: 'walk', frameCount: 8, renderFrame: (frame) => generateWolfSprite(frame) },
      { key: 'attack', frameCount: 6, renderFrame: (frame) => generateWolfSprite(frame) },
    ]),
  });
  const monsterSheetImage = buildImageSpec({
    id: 'img_sprite_studio_sheet_monster_basic_battle',
    name: 'sprite-studio-sheet-monster-basic-battle',
    folder: folders.sheets,
    canvas: buildSpritesheet([
      { key: 'idle', frameCount: 6, renderFrame: (frame) => generateMonsterSprite(frame) },
      { key: 'walk', frameCount: 8, renderFrame: (frame) => generateMonsterSprite(frame) },
      { key: 'attack', frameCount: 6, renderFrame: (frame) => generateMonsterSprite(frame) },
    ]),
  });

  const sheetImages = [humanoidSheetImage, elfSheetImage, wolfSheetImage, monsterSheetImage];
  const humanoidSheet = buildSheetDefinition({
    id: 'sheet_sprite_studio_humanoid_basic_battle',
    name: 'Sprite Studio Humanoid Basic Battle',
    src: humanoidSheetImage.id,
    rows: 3,
  });
  const elfSheet = buildSheetDefinition({
    id: 'sheet_sprite_studio_elf_basic_battle',
    name: 'Sprite Studio Elf Basic Battle',
    src: elfSheetImage.id,
    rows: 3,
  });
  const wolfSheet = buildSheetDefinition({
    id: 'sheet_sprite_studio_wolf_basic_battle',
    name: 'Sprite Studio Wolf Basic Battle',
    src: wolfSheetImage.id,
    rows: 3,
  });
  const monsterSheet = buildSheetDefinition({
    id: 'sheet_sprite_studio_monster_basic_battle',
    name: 'Sprite Studio Monster Basic Battle',
    src: monsterSheetImage.id,
    rows: 3,
  });

  return {
    images: [...images, ...sheetImages],
    sheets: [humanoidSheet, elfSheet, wolfSheet, monsterSheet],
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
        humanoidBattle: humanoidSheet,
        elfBattle: elfSheet,
        wolfBattle: wolfSheet,
        monsterBattle: monsterSheet,
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
    `stored ids: ${result.uploadedImageIds.join(', ') || 'none'}`,
    `sheets: ${result.imageSheetIds.join(', ') || 'none'}`,
    `demo body: ${STARTER_V0_BODY_TEMPLATE_IDS.humanMale}`,
    `demo bindings: ${STARTER_V0_EQUIPMENT_BINDING_IDS.starterSword}, ${STARTER_V0_EQUIPMENT_BINDING_IDS.starterShield}, ${STARTER_V0_EQUIPMENT_BINDING_IDS.starterHelmet}, ${STARTER_V0_EQUIPMENT_BINDING_IDS.starterChestArmor}`,
    `demo animation set: ${STARTER_V0_ANIMATION_SET_IDS.humanoidBattle}`,
  ].join(' | ');
}
