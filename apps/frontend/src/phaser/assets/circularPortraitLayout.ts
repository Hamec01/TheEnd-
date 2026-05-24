export interface CircularPortraitLayout {
  reuseExisting: boolean;
  maskRadius: number;
  displayWidth: number;
  displayHeight: number;
}

export function resolveCircularPortraitLayout(input: {
  existingTextureKey?: string;
  nextTextureKey: string;
  sourceWidth: number;
  sourceHeight: number;
  size: number;
}): CircularPortraitLayout {
  if (input.existingTextureKey === input.nextTextureKey) {
    return {
      reuseExisting: true,
      maskRadius: Math.max(4, Math.floor((input.size * 0.5) - 3)),
      displayWidth: 0,
      displayHeight: 0,
    };
  }

  const sourceWidth = Math.max(1, input.sourceWidth);
  const sourceHeight = Math.max(1, input.sourceHeight);
  const maskRadius = Math.max(4, Math.floor((input.size * 0.5) - 3));
  const maskDiameter = maskRadius * 2;
  const coverScale = Math.max(maskDiameter / sourceWidth, maskDiameter / sourceHeight);

  return {
    reuseExisting: false,
    maskRadius,
    displayWidth: Math.ceil(sourceWidth * coverScale),
    displayHeight: Math.ceil(sourceHeight * coverScale),
  };
}
