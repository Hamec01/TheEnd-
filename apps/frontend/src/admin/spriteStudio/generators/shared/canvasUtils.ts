export const FRAME_SIZE = 128;
export const SPRITESHEET_COLUMNS = 8;

export interface GeneratedCanvasAsset {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export function createCanvas(width = FRAME_SIZE, height = FRAME_SIZE): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable.');
  }
  return context;
}

export function clearCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = getCanvasContext(canvas);
  context.clearRect(0, 0, canvas.width, canvas.height);
  return context;
}

export function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = createCanvas(source.width, source.height);
  const context = getCanvasContext(canvas);
  context.drawImage(source, 0, 0);
  return canvas;
}

export function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
) {
  context.save();
  context.fillStyle = fillStyle;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fill();
  context.restore();
}

export function drawShadow(context: CanvasRenderingContext2D, x: number, y: number, radiusX: number, radiusY: number) {
  context.save();
  context.fillStyle = 'rgba(12, 10, 8, 0.22)';
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}
