import { WolfConfig, WolfAnimationType, WOLF_ANIMATIONS } from '../types';

/**
 * Draws a wolf frame on a canvas context based on the current configuration and animation state.
 * All positions are drawn relative to a local origin (usually translated to frame center).
 */
export function drawWolf(
  ctx: CanvasRenderingContext2D,
  config: WolfConfig,
  animationType: WolfAnimationType,
  frame: number,
  cx: number, // Center X
  cy: number  // Center Y (ground offset)
) {
  ctx.save();

  // Create clean color palette
  const primary = config.primaryColor;
  const secondary = config.secondaryColor;
  const accent = config.accentColor;
  const eyes = config.eyeColor;
  
  // Calculate shadow colors for back limbs to create depth
  const shadowPrimary = darkenColor(primary, 0.25);
  const shadowSecondary = darkenColor(secondary, 0.25);
  const shadowAccent = darkenColor(accent, 0.25);

  // Set line styling
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Apply general scale and translation
  ctx.translate(cx, cy);

  // Normal scale adjustment for the whole wolf
  const animFps = config.fps;
  const totalFrames = WOLF_ANIMATIONS[animationType].frameCount;
  const progress = frame / totalFrames; // 0 to 1

  // Handle Death Rotation / Translate
  let deathAngle = 0;
  let deathYOffset = 0;
  let isDead = false;

  if (animationType === 'die') {
    isDead = true;
    // Rotate from 0 to 90 degrees as frame progresses
    const deathProgress = Math.min(frame / (totalFrames - 1), 1.0);
    // Easing out
    const easeProgress = 1 - Math.pow(1 - deathProgress, 2);
    deathAngle = easeProgress * Math.PI * 0.45; // Turn 80 degrees
    deathYOffset = easeProgress * 15; // sink to floor
  }

  ctx.translate(0, deathYOffset);
  ctx.rotate(deathAngle);

  // Set scale based on user config
  ctx.scale(config.bodySize, config.bodySize);

  // Prepare custom drawing tools for crisp retro outlines if configured
  if (config.showOutline && config.outlineColor) {
    ctx.shadowColor = config.outlineColor;
    ctx.shadowBlur = 2;
  } else {
    ctx.shadowBlur = 0;
  }

  // --- RENDERING VIEWS CORRESPONDING TO ANIMATION TYPE ---
  if (animationType === 'run_down') {
    drawFrontView(ctx, config, frame, primary, secondary, accent, eyes, shadowPrimary);
  } else if (animationType === 'run_up') {
    drawBackView(ctx, config, frame, primary, secondary, accent, eyes, shadowPrimary);
  } else {
    // Side views: idle, run_right, run_left, bite, die
    // For run_left, we simply flip the horizontal scale
    if (animationType === 'run_left') {
      ctx.scale(-1, 1);
    }
    drawSideView(ctx, config, animationType, frame, progress, primary, secondary, accent, eyes, shadowPrimary, shadowSecondary, shadowAccent, isDead);
  }

  ctx.restore();
}

/**
 * Side View Drawing (Walk, Lying Down, Bite, Idle)
 */
function drawSideView(
  ctx: CanvasRenderingContext2D,
  config: WolfConfig,
  animationType: WolfAnimationType,
  frame: number,
  progress: number,
  primary: string,
  secondary: string,
  accent: string,
  eyes: string,
  shadowPrimary: string,
  shadowSecondary: string,
  shadowAccent: string,
  isDead: boolean
) {
  // Let's compute cycle angles
  let bodyBob = 0;
  let headBob = 0;
  let tailAngle = 0.2; // Rads
  
  // Leg rotation angles (thigh and calf)
  let angleFR_t = 0, angleFR_c = 0;
  let angleFL_t = 0, angleFL_c = 0;
  let angleBR_t = 0, angleBR_c = 0;
  let angleBL_t = 0, angleBL_c = 0;

  let isLyingDown = animationType === 'idle';
  let isBiting = animationType === 'bite';
  let jawOpenAngle = 0;

  // 1. RUN CYCLE MATH
  if (animationType === 'run_right' || animationType === 'run_left') {
    const cycle = (frame / 8) * Math.PI * 2; // running frames = 8
    
    // Body and head bob
    bodyBob = Math.sin(cycle * 2) * 2 - 1;
    headBob = Math.cos(cycle * 2) * 1;
    
    // Tail streaming and wagging
    tailAngle = -0.3 + Math.sin(cycle * 2) * 0.15;

    // Front limbs cycle out of phase (FL is back-layer of FR)
    const frPhase = cycle;
    const flPhase = cycle + Math.PI;
    
    // Back limbs cycle
    const brPhase = cycle - Math.PI * 0.35;
    const blPhase = brPhase + Math.PI;

    // Thigh and calf motions
    angleFR_t = Math.sin(frPhase) * 0.6;
    angleFR_c = Math.cos(frPhase - 0.5) * 0.4 + 0.3; // bend forward

    angleFL_t = Math.sin(flPhase) * 0.6;
    angleFL_c = Math.cos(flPhase - 0.5) * 0.4 + 0.3;

    angleBR_t = Math.cos(brPhase) * 0.6;
    angleBR_c = Math.sin(brPhase + 0.2) * 0.4 + 0.25;

    angleBL_t = Math.cos(blPhase) * 0.6;
    angleBL_c = Math.sin(blPhase + 0.2) * 0.4 + 0.25;

  } else if (isLyingDown) {
    // 2. IDLE / BREATHING MATH
    const breath = Math.sin((frame / 6) * Math.PI * 2) * 0.8;
    bodyBob = 7 + breath * 0.3; // lowered torso
    headBob = 5 + breath * 0.15;
    tailAngle = 0.75 + Math.sin(frame * 0.3) * 0.08; // drooping tail

    // Legs tucked
    angleFR_t = -1.3; angleFR_c = 1.3;
    angleFL_t = -1.3; angleFL_c = 1.3;
    angleBR_t = 1.2;  angleBR_c = -1.2;
    angleBL_t = 1.2;  angleBL_c = -1.2;

  } else if (isBiting) {
    // 3. BITE MECHANICAL ANIMATION
    // Frame count for bite is 6
    // Frame 0-1: Lunge back and wind up
    // Frame 2-3: Frame snaps open and lunges forward!
    // Frame 4-5: Pulling back, returning
    const t = frame;
    if (t <= 1) {
      bodyBob = 1;
      headBob = 1;
      jawOpenAngle = 0.1;
      tailAngle = 0.1;
      angleFR_t = -0.2; angleBR_t = -0.1;
    } else if (t === 2) {
      // Mouth wide open
      bodyBob = -2;
      headBob = -3;
      jawOpenAngle = 0.6; // wide snap
      tailAngle = -0.5; // tail whips up
      angleFR_t = 0.5; angleBR_t = 0.3;
    } else if (t === 3) {
      // Snapping shut
      bodyBob = -1;
      headBob = -2;
      jawOpenAngle = 0.0; // snap
      tailAngle = -0.4;
      angleFR_t = 0.4; angleBR_t = 0.2;
    } else {
      // Recovery
      bodyBob = 0;
      headBob = 0;
      jawOpenAngle = 0.0;
      tailAngle = 0.1;
    }
  } else if (isDead) {
    // 4. DEATH POSES
    const deathProgress = Math.min(frame / 5, 1.0);
    bodyBob = 4 * deathProgress;
    headBob = 6 * deathProgress;
    tailAngle = 0.9; // totally limp

    // Legs stretch and then curl slightly as death settles
    angleFR_t = 0.4 * deathProgress; angleFR_c = -0.3 * deathProgress;
    angleFL_t = 0.2 * deathProgress; angleFL_c = -0.1 * deathProgress;
    angleBR_t = -0.3 * deathProgress; angleBR_c = -0.2 * deathProgress;
    angleBL_t = -0.1 * deathProgress; angleBL_c = -0.1 * deathProgress;
  }

  // --- RENDER WOLF PIECES BACK-TO-FRONT ---

  // Offset positions
  const bx = 0; // Torso X
  let by = -8 + bodyBob; // Torso Y

  const neckX = bx + 12;
  const neckY = by - 3;
  
  const headX = neckX + 6;
  const headY = neckY - 9 + headBob;

  // Let's draw:
  // 1. BACK LIMBS & LEGS (slightly darkened)
  if (!isLyingDown) {
    drawLeg(ctx, bx - 10, by + 3, angleBL_t, angleBL_c, shadowPrimary, shadowSecondary, 12); // BL
    drawLeg(ctx, bx + 10, by + 3, angleFL_t, angleFL_c, shadowPrimary, shadowAccent, 10); // FL
  }

  // 2. TAIL
  drawTail(ctx, bx - 14, by - 2, tailAngle, config.tailLength, primary, secondary);

  // 3. TORSO (BODY)
  ctx.fillStyle = primary;
  ctx.beginPath();
  if (isLyingDown) {
    // Flatter resting body
    ctx.ellipse(bx, by + 4, 18, 10, 0, 0, Math.PI * 2);
  } else {
    // Athletic active body
    ctx.ellipse(bx, by, 16, 11, -0.05, 0, Math.PI * 2);
  }
  ctx.fill();

  // Fluffy underbelly chest accent/markings
  ctx.fillStyle = accent;
  ctx.beginPath();
  if (isLyingDown) {
    ctx.ellipse(bx + 4, by + 7, 10, 5, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(bx + 5, by + 4, 10, 6, -0.1, 0, Math.PI * 2);
  }
  ctx.fill();

  // Back fluff/markings
  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.ellipse(bx - 3, by - 6, 11, 4, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // 4. FRONT FORWARD LIMBS (Bright / Fore Layer)
  if (isLyingDown) {
    // Draw tucked-in resting paws
    // Back paw
    ctx.fillStyle = shadowSecondary;
    ctx.beginPath();
    ctx.ellipse(bx - 12, by + 12, 8, 4, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Front paw
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.ellipse(bx + 12, by + 11, 8, 4, -0.1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    drawLeg(ctx, bx - 10, by + 3, angleBR_t, angleBR_c, primary, secondary, 12); // BR
    drawLeg(ctx, bx + 10, by + 3, angleFR_t, angleFR_c, primary, accent, 10); // FR
  }

  // 5. NECK
  ctx.strokeStyle = primary;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(neckX - 4, neckY + 4);
  ctx.lineTo(headX - 1, headY + 3);
  ctx.stroke();

  // Neck Mane Accent
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(neckX - 3, neckY + 6);
  ctx.lineTo(headX - 3, headY + 5);
  ctx.stroke();

  // 6. HEAD & SNOUT
  // Main Cranium
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.arc(headX, headY, 6, 0, Math.PI * 2);
  ctx.fill();

  // Cheek Fluff
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(headX - 2, headY + 3, 4, 3, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Snout Upper
  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(-jawOpenAngle * 0.4);
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.lineTo(11 * config.snoutLength, 1);
  ctx.lineTo(10 * config.snoutLength, 4);
  ctx.lineTo(0, 4);
  ctx.closePath();
  ctx.fill();
  
  // Nose tip
  ctx.fillStyle = '#1e1e24';
  ctx.beginPath();
  ctx.ellipse(10.5 * config.snoutLength, 2, 2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Snout Lower (Jaw)
  ctx.save();
  ctx.translate(headX, headY + 2);
  ctx.rotate(jawOpenAngle * 0.85); // rotates down heavily
  ctx.fillStyle = shadowSecondary;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(9.5 * config.snoutLength, 0);
  ctx.lineTo(8.5 * config.snoutLength, 2.5);
  ctx.lineTo(0, 2);
  ctx.closePath();
  ctx.fill();

  // Bite Teeth (during bite animation)
  if (isBiting && jawOpenAngle > 0.3) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    // Upper teeth
    ctx.beginPath();
    ctx.moveTo(4 * config.snoutLength, 1);
    ctx.lineTo(6 * config.snoutLength, 3);
    ctx.lineTo(8 * config.snoutLength, 1);
    ctx.stroke();
    // Lower teeth
    ctx.beginPath();
    ctx.moveTo(4 * config.snoutLength, 5);
    ctx.lineTo(6 * config.snoutLength, 3);
    ctx.lineTo(7 * config.snoutLength, 5);
    ctx.stroke();
  }
  ctx.restore();

  // 7. EARS
  ctx.save();
  ctx.translate(headX - 2, headY - 3);
  // Flatten ears when lying down or biting
  let earAngle = -0.15;
  if (isLyingDown) earAngle = 0.5;
  if (isBiting) earAngle = 0.35;
  if (isDead) earAngle = 0.6;
  ctx.rotate(earAngle);
  
  // Outer Ear
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(-1 * config.earSize, -7 * config.earSize);
  ctx.lineTo(2, 0);
  ctx.closePath();
  ctx.fill();

  // Inner Ear
  ctx.fillStyle = '#ffb3c1'; // pinkish inner ear
  ctx.beginPath();
  ctx.moveTo(-1.5, -1);
  ctx.lineTo(-0.5 * config.earSize, -5 * config.earSize);
  ctx.lineTo(1, -1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 8. EYE & GLOW
  ctx.save();
  ctx.translate(headX + 2, headY - 1);
  if (isDead) {
    // Draw cross X for dead eye
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.lineTo(2, 2);
    ctx.moveTo(2, -2);
    ctx.lineTo(-2, 2);
    ctx.stroke();
  } else if (isLyingDown && frame % 4 !== 0) {
    // Slit-like sleeping eye
    ctx.strokeStyle = shadowPrimary;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(2, 0);
    ctx.stroke();
  } else {
    // Regular shining eye
    if (config.eyeGlow) {
      const gradient = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 4);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.3, eyes);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Solid Eye pupil
    ctx.fillStyle = eyes;
    ctx.beginPath();
    ctx.ellipse(0, 0.2, 1.5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Catchlight highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0.4, -0.4, 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Leg segment rendering helper
 */
function drawLeg(
  ctx: CanvasRenderingContext2D,
  lx: number,
  ly: number,
  thighAngle: number,
  calfAngle: number,
  thighColor: string,
  pawColor: string,
  legLength: number
) {
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(thighAngle);

  // Thigh
  ctx.strokeStyle = thighColor;
  ctx.lineWidth = 4.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, legLength * 0.55);
  ctx.stroke();

  // Lower knee / calf joint
  ctx.translate(0, legLength * 0.55);
  ctx.rotate(calfAngle);

  // Calf
  ctx.strokeStyle = thighColor;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, legLength * 0.45);
  ctx.stroke();

  // Paw
  ctx.translate(0, legLength * 0.45);
  ctx.fillStyle = pawColor;
  ctx.beginPath();
  ctx.ellipse(1, 0, 3, 1.8, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Tail rendering helper
 */
function drawTail(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  angle: number,
  tailLength: number,
  color: string,
  tipColor: string
) {
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(angle);

  // Tail segments
  const baseLen = 14 * tailLength;
  
  // Outer layer
  ctx.strokeStyle = color;
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.bezierCurveTo(-baseLen * 0.3, 0, -baseLen * 0.7, -1, -baseLen, 4);
  ctx.stroke();

  // Secondary layer / fluff
  ctx.strokeStyle = tipColor;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-baseLen * 0.4, 0);
  ctx.bezierCurveTo(-baseLen * 0.7, -0.5, -baseLen * 0.9, 1.5, -baseLen - 1, 4.5);
  ctx.stroke();

  ctx.restore();
}

/**
 * Front view run (Run Down)
 */
function drawFrontView(
  ctx: CanvasRenderingContext2D,
  config: WolfConfig,
  frame: number,
  primary: string,
  secondary: string,
  accent: string,
  eyes: string,
  shadowPrimary: string
) {
  // Compute front view bobbing
  const cycle = (frame / 8) * Math.PI * 2;
  const bobY = Math.sin(cycle * 2) * 1.5;
  const chestBobX = Math.cos(cycle) * 0.8;

  const leftLegOffset = Math.sin(cycle) * 3;
  const rightLegOffset = -Math.sin(cycle) * 3;
  const backLegsOffset = Math.cos(cycle) * 2.5;

  // 1. BACK LEGS (further, darker shadow)
  ctx.fillStyle = shadowPrimary;
  // Left post
  ctx.beginPath();
  ctx.ellipse(-7, 3 + backLegsOffset, 2.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Right post
  ctx.beginPath();
  ctx.ellipse(7, 3 - backLegsOffset, 2.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. MAIN COAT BODY
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.ellipse(0, -6 + bobY, 11, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fluffy light chest shield
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(chestBobX, -3 + bobY, 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mane highlights
  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.ellipse(0, -11 + bobY, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3. FRONT LEGS (foreground)
  ctx.fillStyle = primary;
  // Front Left leg (moves outwards/inwards)
  ctx.beginPath();
  ctx.ellipse(-4.5 + leftLegOffset * 0.3, 4 + leftLegOffset, 2.8, 8, leftLegOffset * 0.05, 0, Math.PI * 2);
  ctx.fill();
  // Front Right leg
  ctx.beginPath();
  ctx.ellipse(4.5 + rightLegOffset * 0.3, 4 + rightLegOffset, 2.8, 8, rightLegOffset * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Paws
  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.ellipse(-4.5 + leftLegOffset * 0.3, 11 + leftLegOffset, 3.5, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(4.5 + rightLegOffset * 0.3, 11 + rightLegOffset, 3.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4. MAIN CRANIUM (HEAD)
  const headY = -16 + bobY;
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.arc(0, headY, 6.5, 0, Math.PI * 2);
  ctx.fill();

  // Cute lower white snout mask
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(0, headY + 3.5, 4.5 * config.snoutLength, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dark muzzle snout nose
  ctx.fillStyle = '#1e1e24';
  ctx.beginPath();
  ctx.ellipse(0, headY + 4, 2 * config.snoutLength, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 5. EARS
  // Left Ear
  ctx.save();
  ctx.translate(-4, headY - 4);
  ctx.rotate(-0.25 + Math.sin(cycle) * 0.04);
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.moveTo(-2.5, 0);
  ctx.lineTo(-4 * config.earSize, -8 * config.earSize);
  ctx.lineTo(1.5, 0);
  ctx.closePath();
  ctx.fill();
  // Inner
  ctx.fillStyle = '#ffb3c1';
  ctx.beginPath();
  ctx.moveTo(-1, 0);
  ctx.lineTo(-2.5 * config.earSize, -6 * config.earSize);
  ctx.lineTo(0.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Right Ear
  ctx.save();
  ctx.translate(4, headY - 4);
  ctx.rotate(0.25 - Math.sin(cycle) * 0.04);
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.moveTo(-1.5, 0);
  ctx.lineTo(4 * config.earSize, -8 * config.earSize);
  ctx.lineTo(2.5, 0);
  ctx.closePath();
  ctx.fill();
  // Inner
  ctx.fillStyle = '#ffb3c1';
  ctx.beginPath();
  ctx.moveTo(-0.5, 0);
  ctx.lineTo(2.5 * config.earSize, -6 * config.earSize);
  ctx.lineTo(1, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 6. GLOWING EYES
  ctx.fillStyle = eyes;
  // Left eye
  ctx.beginPath();
  ctx.arc(-2.5, headY + 0.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
  // Right eye
  ctx.beginPath();
  ctx.arc(2.5, headY + 0.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  if (config.eyeGlow) {
    ctx.strokeStyle = eyes;
    ctx.lineWidth = 0.6;
    ctx.shadowColor = eyes;
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.arc(-2.5, headY + 0.5, 2.5, 0, Math.PI * 2);
    ctx.arc(2.5, headY + 0.5, 2.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Back view run (Run Up)
 */
function drawBackView(
  ctx: CanvasRenderingContext2D,
  config: WolfConfig,
  frame: number,
  primary: string,
  secondary: string,
  accent: string,
  eyes: string,
  shadowPrimary: string
) {
  // Bobbing
  const cycle = (frame / 8) * Math.PI * 2;
  const bobY = Math.sin(cycle * 2) * 1.5;
  const tailSway = Math.sin(cycle * 1.5) * 4 * config.tailLength;

  const leftLegOffset = Math.sin(cycle) * 3;
  const rightLegOffset = -Math.sin(cycle) * 3;

  // 1. FRONT LIMBS (further in back view, darker)
  ctx.fillStyle = shadowPrimary;
  ctx.beginPath();
  ctx.ellipse(-3.5, 2 + rightLegOffset, 2.2, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(3.5, 2 + leftLegOffset, 2.2, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. MAIN BULK FORWARD TORSO
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.ellipse(0, -6 + bobY, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Darker spine stripe viewed from behind
  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.ellipse(0, -6 + bobY, 3, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3. BACK LEGS (foreground, active, bigger hips)
  ctx.fillStyle = primary;
  // Hip L
  ctx.beginPath();
  ctx.ellipse(-6, -4 + leftLegOffset * 0.1, 4.5, 5.5, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // Lower leg L
  ctx.beginPath();
  ctx.ellipse(-5.5, 4 + leftLegOffset, 2.8, 8, 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Hip R
  ctx.beginPath();
  ctx.ellipse(6, -4 + rightLegOffset * 0.1, 4.5, 5.5, 0.1, 0, Math.PI * 2);
  ctx.fill();
  // Lower leg R
  ctx.beginPath();
  ctx.ellipse(5.5, 4 + rightLegOffset, 2.8, 8, -0.05, 0, Math.PI * 2);
  ctx.fill();

  // Paws
  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.ellipse(-5.5, 12 + leftLegOffset, 3.5, 1.8, 0, 0, Math.PI * 2);
  ctx.ellipse(5.5, 12 + rightLegOffset, 3.5, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4. TAIL (Very prominent from the back, swinging)
  ctx.save();
  ctx.translate(0, 0 + bobY);
  ctx.rotate(Math.sin(cycle * 1.5) * 0.3);
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.ellipse(tailSway * 0.2, 2, 4.5, 13 * config.tailLength, tailSway * 0.04, 0, Math.PI * 2);
  ctx.fill();
  // Accent tip
  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.ellipse(tailSway * 0.23, 10 * config.tailLength, 3.2, 4 * config.tailLength, tailSway * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 5. CRANIUM / BACK OF HEAD (Bobbing, eyes obscured)
  const headY = -15 + bobY;
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.arc(0, headY, 5.5, 0, Math.PI * 2);
  ctx.fill();

  // Ears (pointing up and out)
  ctx.save();
  ctx.translate(-3, headY - 3);
  ctx.fillStyle = shadowPrimary;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(-3 * config.earSize, -7 * config.earSize);
  ctx.lineTo(1, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(3, headY - 3);
  ctx.fillStyle = shadowPrimary;
  ctx.beginPath();
  ctx.moveTo(-1, 0);
  ctx.lineTo(3 * config.earSize, -7 * config.earSize);
  ctx.lineTo(2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Helper to programmatically darken a hex color for smooth retro shading.
 */
function darkenColor(hex: string, percent: number): string {
  // Simple check for hex
  if (!hex.startsWith('#')) return hex;
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  r = Math.floor(r * (1 - percent));
  g = Math.floor(g * (1 - percent));
  b = Math.floor(b * (1 - percent));

  const rs = Math.max(0, Math.min(255, r)).toString(16).padStart(2, '0');
  const gs = Math.max(0, Math.min(255, g)).toString(16).padStart(2, '0');
  const bs = Math.max(0, Math.min(255, b)).toString(16).padStart(2, '0');

  return `#${rs}${gs}${bs}`;
}
