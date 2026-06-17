import { FRAME_SIZE, SPRITESHEET_COLUMNS, createCanvas, getCanvasContext } from './canvasUtils';

export interface SpriteSheetActionSpec {
  key: string;
  frameCount: number;
  renderFrame: (frame: number) => HTMLCanvasElement;
}

export function buildSpritesheet(actions: SpriteSheetActionSpec[]): HTMLCanvasElement {
  const canvas = createCanvas(SPRITESHEET_COLUMNS * FRAME_SIZE, actions.length * FRAME_SIZE);
  const context = getCanvasContext(canvas);

  actions.forEach((action, rowIndex) => {
    for (let frame = 0; frame < action.frameCount; frame += 1) {
      const frameCanvas = action.renderFrame(frame);
      context.drawImage(frameCanvas, frame * FRAME_SIZE, rowIndex * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE);
    }
  });

  return canvas;
}
