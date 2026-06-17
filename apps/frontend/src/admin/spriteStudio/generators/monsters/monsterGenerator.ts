import { FRAME_SIZE, clearCanvas, createCanvas, drawShadow, fillRoundedRect } from '../shared/canvasUtils';

export function generateWolfSprite(frame = 0): HTMLCanvasElement {
  const canvas = createCanvas(FRAME_SIZE, FRAME_SIZE);
  const context = clearCanvas(canvas);
  const bob = frame % 2 === 0 ? 0 : 1;

  drawShadow(context, 60, 110, 24, 7);

  fillRoundedRect(context, 34, 56 + bob, 40, 24, 10, '#6e5b47');
  fillRoundedRect(context, 68, 50 + bob, 20, 16, 8, '#7f6a51');

  context.save();
  context.fillStyle = '#7f6a51';
  context.beginPath();
  context.moveTo(80, 51 + bob);
  context.lineTo(89, 42 + bob);
  context.lineTo(85, 56 + bob);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(68, 52 + bob);
  context.lineTo(74, 41 + bob);
  context.lineTo(74, 57 + bob);
  context.closePath();
  context.fill();
  context.restore();

  context.save();
  context.strokeStyle = '#4b392d';
  context.lineWidth = 6;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(44, 76);
  context.lineTo(40, 104);
  context.moveTo(60, 76);
  context.lineTo(58, 104);
  context.moveTo(74, 64);
  context.lineTo(76, 104);
  context.moveTo(84, 64);
  context.lineTo(88, 104);
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = '#544033';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(34, 60);
  context.quadraticCurveTo(18, 48, 18, 32 + bob);
  context.stroke();
  context.restore();

  context.fillStyle = '#f5f5f4';
  context.fillRect(84, 58 + bob, 2, 2);

  return canvas;
}

export function generateMonsterSprite(frame = 0): HTMLCanvasElement {
  const canvas = createCanvas(FRAME_SIZE, FRAME_SIZE);
  const context = clearCanvas(canvas);
  const pulse = frame % 2 === 0 ? 0 : 2;

  drawShadow(context, 64, 114, 26, 8);
  fillRoundedRect(context, 38, 32 - pulse, 52, 62, 18, '#40634f');
  fillRoundedRect(context, 30, 52, 16, 24, 8, '#7eb06f');
  fillRoundedRect(context, 82, 52, 16, 24, 8, '#7eb06f');

  context.save();
  context.strokeStyle = '#244233';
  context.lineWidth = 8;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(52, 90);
  context.lineTo(46, 108);
  context.moveTo(76, 90);
  context.lineTo(82, 108);
  context.stroke();
  context.restore();

  context.save();
  context.fillStyle = '#f97316';
  context.beginPath();
  context.arc(54, 52 - pulse, 4, 0, Math.PI * 2);
  context.arc(74, 52 - pulse, 4, 0, Math.PI * 2);
  context.fill();
  context.restore();

  return canvas;
}
