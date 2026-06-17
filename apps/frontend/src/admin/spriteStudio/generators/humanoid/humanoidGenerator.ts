import { FRAME_SIZE, clearCanvas, createCanvas, drawShadow, fillRoundedRect, getCanvasContext } from '../shared/canvasUtils';

type HumanoidPose = 'idle' | 'walk' | 'attack';
type HumanoidRace = 'human' | 'elf' | 'dwarf';

export interface HumanoidBodyOptions {
  race: HumanoidRace;
  pose?: HumanoidPose;
  frame?: number;
}

function getRacePalette(race: HumanoidRace) {
  if (race === 'elf') {
    return {
      skin: '#e5c8aa',
      hair: '#c5d88a',
      cloth: '#406a8d',
      boots: '#4b3628',
    };
  }
  if (race === 'dwarf') {
    return {
      skin: '#d3a583',
      hair: '#6f3c1f',
      cloth: '#6f2f36',
      boots: '#3c2b23',
    };
  }
  return {
    skin: '#ddb08f',
    hair: '#3e281f',
    cloth: '#355e8b',
    boots: '#463428',
  };
}

function getPoseOffset(pose: HumanoidPose, frame: number) {
  if (pose === 'walk') {
    const cycle = frame % 8;
    return {
      armSwing: cycle < 4 ? 7 : -7,
      legSwing: cycle < 4 ? -6 : 6,
      bodyBob: cycle % 2 === 0 ? 1 : -1,
    };
  }
  if (pose === 'attack') {
    const strength = Math.min(frame, 5);
    return {
      armSwing: 10 + strength * 3,
      legSwing: -2 + strength,
      bodyBob: -Math.min(strength, 3),
    };
  }
  return { armSwing: 0, legSwing: 0, bodyBob: 0 };
}

export function generateHumanoidBody(options: HumanoidBodyOptions): HTMLCanvasElement {
  const canvas = createCanvas(FRAME_SIZE, FRAME_SIZE);
  const context = clearCanvas(canvas);
  const palette = getRacePalette(options.race);
  const pose = options.pose ?? 'idle';
  const frame = options.frame ?? 0;
  const poseOffset = getPoseOffset(pose, frame);

  const centerX = FRAME_SIZE / 2;
  const headY = options.race === 'dwarf' ? 22 : 18;
  const torsoY = options.race === 'dwarf' ? 42 : 38;
  const torsoHeight = options.race === 'dwarf' ? 38 : 44;
  const legY = torsoY + torsoHeight - 2;
  const armY = torsoY + 8;

  drawShadow(context, centerX, 116, options.race === 'dwarf' ? 20 : 18, 6);

  context.save();
  context.fillStyle = palette.skin;
  context.beginPath();
  context.arc(centerX, headY + 8 + poseOffset.bodyBob, options.race === 'dwarf' ? 12 : 11, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.strokeStyle = palette.hair;
  context.lineWidth = options.race === 'dwarf' ? 6 : 5;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(centerX - 9, headY + 5);
  context.lineTo(centerX + 9, headY + 5);
  context.stroke();
  if (options.race === 'dwarf') {
    context.beginPath();
    context.moveTo(centerX - 4, headY + 16);
    context.lineTo(centerX - 7, headY + 28);
    context.moveTo(centerX + 4, headY + 16);
    context.lineTo(centerX + 7, headY + 28);
    context.stroke();
  }
  context.restore();

  if (options.race === 'elf') {
    context.save();
    context.fillStyle = palette.skin;
    context.beginPath();
    context.moveTo(centerX - 11, headY + 9);
    context.lineTo(centerX - 17, headY + 5);
    context.lineTo(centerX - 11, headY + 3);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(centerX + 11, headY + 9);
    context.lineTo(centerX + 17, headY + 5);
    context.lineTo(centerX + 11, headY + 3);
    context.closePath();
    context.fill();
    context.restore();
  }

  fillRoundedRect(context, centerX - 14, torsoY + poseOffset.bodyBob, 28, torsoHeight, 8, palette.cloth);

  context.save();
  context.strokeStyle = palette.skin;
  context.lineWidth = 8;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(centerX - 14, armY);
  context.lineTo(centerX - 25 - poseOffset.armSwing * 0.5, armY + 20);
  context.moveTo(centerX + 14, armY);
  context.lineTo(centerX + 25 + poseOffset.armSwing, armY + 18 - Math.max(poseOffset.armSwing * 0.3, -4));
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = palette.boots;
  context.lineWidth = 9;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(centerX - 7, legY);
  context.lineTo(centerX - 8 + poseOffset.legSwing, 108);
  context.moveTo(centerX + 7, legY);
  context.lineTo(centerX + 8 - poseOffset.legSwing, 108);
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(27, 20, 16, 0.45)';
  context.lineWidth = 2;
  context.strokeRect(centerX - 14, torsoY + poseOffset.bodyBob, 28, torsoHeight);
  context.restore();

  return canvas;
}

export function generateEquipmentOverlay(kind: 'sword' | 'shield' | 'helmet' | 'chestArmor'): HTMLCanvasElement {
  const canvas = createCanvas(FRAME_SIZE, FRAME_SIZE);
  const context = getCanvasContext(canvas);
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (kind === 'sword') {
    context.save();
    context.translate(92, 62);
    context.rotate(0.55);
    context.fillStyle = '#d8dee8';
    fillRoundedRect(context, -3, -26, 6, 42, 3, '#d8dee8');
    fillRoundedRect(context, -8, 8, 16, 4, 2, '#b68a3b');
    fillRoundedRect(context, -2, 12, 4, 14, 2, '#6c4727');
    context.restore();
  } else if (kind === 'shield') {
    context.save();
    context.fillStyle = '#6d242c';
    context.strokeStyle = '#c9a866';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(28, 48);
    context.lineTo(44, 44);
    context.lineTo(52, 66);
    context.lineTo(40, 86);
    context.lineTo(24, 74);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  } else if (kind === 'helmet') {
    context.save();
    fillRoundedRect(context, 48, 12, 32, 18, 8, '#8f959e');
    fillRoundedRect(context, 54, 27, 20, 8, 3, '#c9a866');
    context.restore();
  } else if (kind === 'chestArmor') {
    context.save();
    fillRoundedRect(context, 48, 40, 32, 36, 6, '#6b717b');
    fillRoundedRect(context, 56, 42, 16, 30, 4, '#b89b5b');
    context.restore();
  }

  return canvas;
}
