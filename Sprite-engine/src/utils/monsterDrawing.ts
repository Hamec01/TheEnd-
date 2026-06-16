import { WolfConfig, MonsterAnimationType, MONSTER_ANIMATIONS } from '../types';

/**
 * Draws a Monster frame on a canvas context based on the current configuration and animation state.
 */
export function drawMonster(
  ctx: CanvasRenderingContext2D,
  config: WolfConfig,
  animationType: MonsterAnimationType,
  frame: number,
  cx: number, // Center X
  cy: number, // Center Y
  flipX: boolean = false
) {
  ctx.save();

  // Create clean color palette
  let skinColor = config.primaryColor; // Bulk Chitin/Skin (e.g. crimson claw or toxic green)
  let bellyColor = config.secondaryColor; // Glowing ribs/underbelly energy channels
  let clawColor = config.accentColor; // Bone plates / Horn spikes
  let eyeColor = config.eyeColor; // Glowing demon eye dots

  const totalFrames = MONSTER_ANIMATIONS[animationType]?.frameCount || 6;
  const progress = frame / totalFrames;

  // Handle Petrification Die Monochromatic change
  if (animationType === 'die') {
    const grayRatio = Math.min(frame / 3, 1.0);
    // Turn colors to stone-like gray progressively
    skinColor = interpolateColor(skinColor, '#475569', grayRatio);
    bellyColor = interpolateColor(bellyColor, '#334155', grayRatio);
    clawColor = interpolateColor(clawColor, '#64748b', grayRatio);
    eyeColor = interpolateColor(eyeColor, '#1e293b', grayRatio);
  }

  const shadowSkin = darkenColor(skinColor, 0.3);
  const shadowBelly = darkenColor(bellyColor, 0.3);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.translate(cx, cy);

  if (flipX) {
    ctx.scale(-1, 1);
  }

  // Custom configurations mapped to proportions
  let spikeLength = config.tailLength * 6; // Back spikes size
  let hornWeight = config.earSize * 5.5; // Skull horns / Crown size
  let jawMawScale = config.snoutLength; // Gaping mouth teeth width
  
  let bodyYBob = -15;
  let bodyRotation = 0;
  let torsoXOffset = 0;

  // Arms & Legs positions
  let angle_front_leg = 0;
  let angle_back_leg = 0;
  let angle_front_arm = 0;
  let angle_back_arm = 0;
  let tailSway = 0;
  let roaringMouthY = 0;

  let particles: Array<{ dx: number; dy: number; r: number; color: string; alpha: number }> = [];

  switch (animationType) {
    case 'idle': {
      const breath = Math.sin((frame / 6) * Math.PI * 2);
      bodyYBob = -15 + breath * 1.5;
      bodyRotation = 0.05 * breath;

      angle_front_leg = 0.15;
      angle_back_leg = -0.2;
      angle_front_arm = 0.3 + breath * 0.05;
      angle_back_arm = -0.4;
      tailSway = Math.sin((frame / 6) * Math.PI) * 4;
      break;
    }
    case 'walk': {
      const cycle = (frame / 8) * Math.PI * 2;
      bodyYBob = -15 + Math.abs(Math.sin(cycle * 2)) * -2.5; // heavy heavy thuds
      bodyRotation = Math.cos(cycle) * 0.08;

      angle_front_leg = Math.sin(cycle) * 0.5;
      angle_back_leg = -Math.sin(cycle) * 0.5;
      angle_front_arm = -Math.sin(cycle) * 0.3 + 0.2;
      angle_back_arm = Math.sin(cycle) * 0.3 - 0.2;
      tailSway = Math.sin(cycle) * 6;
      break;
    }
    case 'run': {
      // Beast Charging Rampage on all fours
      const cycle = (frame / 8) * Math.PI * 2;
      bodyYBob = -11 + Math.sin(cycle * 2) * 3.0;
      bodyRotation = 0.35 + Math.cos(cycle * 2) * 0.04; // leaning way forward
      torsoXOffset = 2.0;

      angle_front_leg = Math.sin(cycle) * 0.85;
      angle_back_leg = -Math.sin(cycle) * 0.85;
      angle_front_arm = 0.65 + Math.sin(cycle) * 0.4;
      angle_back_arm = -0.55 + Math.cos(cycle) * 0.4;
      tailSway = Math.sin(cycle * 2) * 9;

      // Dust smoke screen
      particles.push({
        dx: -12,
        dy: 12,
        r: Math.random() * 3.5 + 2,
        color: '#47556944',
        alpha: 0.6
      });
      break;
    }
    case 'claws_slash': {
      // 8 frames attack swipe
      const t = frame;
      bodyYBob = -14;
      bodyRotation = 0.1;
      
      if (t <= 3) {
        // winding up slash hand
        angle_front_arm = -1.6; // hand pulled back high
        angle_back_arm = -0.2;
        tailSway = -3;
      } else if (t === 4) {
        // Release massive claw swipe forward!
        angle_front_arm = 0.95; // swiping down hard
        angle_back_arm = -0.5;
        tailSway = 8;

        // Custom Red Slash FX Arc
        for (let i = 0; i < 8; i++) {
          particles.push({
            dx: 15 + i * 4.5,
            dy: -15 + i * 5,
            r: 5.5 - i * 0.5,
            color: '#ef4444', // violent crimson trail
            alpha: 1.0 - i * 0.12
          });
        }
      } else if (t === 5 || t === 6) {
        // follow through and sparks
        angle_front_arm = 1.3;
        tailSway = 10;
        particles.push(
          { dx: 22, dy: 1, r: 3, color: clawsBloodColor(skinColor), alpha: 0.8 },
          { dx: 25, dy: -4, r: 1.5, color: clawColor, alpha: 0.9 }
        );
      } else {
        // recover
        angle_front_arm = 0.3;
        angle_back_arm = -0.3;
      }
      break;
    }
    case 'roar_buff': {
      // Sonic roar - bends neck and gaps maw open (6 frames)
      const t = frame;
      const pulse = Math.sin((t / 5) * Math.PI);
      
      bodyYBob = -13; // stands firm
      bodyRotation = -0.22; // bending head back upwards
      
      angle_front_leg = 0.3;
      angle_back_leg = -0.45;
      angle_front_arm = -0.55; // raising arms sideways in rage
      angle_back_arm = -0.65;
      
      roaringMouthY = pulse * 4 * jawMawScale; // jaws split wide representation!
      tailSway = Math.sin(t * 1.5) * 8;

      // Sonic circles emitting from jaws
      if (t === 2 || t === 3) {
        particles.push(
          { dx: 12, dy: -14, r: 5 + pulse * 14, color: 'rgba(239, 68, 68, 0.08)', alpha: 0.4 },
          { dx: 14, dy: -14, r: 8 + pulse * 20, color: 'rgba(251, 191, 36, 0.04)', alpha: 0.3 }
        );
      }
      break;
    }
    case 'die': {
      // Petrification/Cracking down with stone elements (6 frames)
      const dieProgress = Math.min(frame / 5, 1.0);
      const easeDie = 1 - Math.pow(1 - dieProgress, 2);

      bodyYBob = -15 + easeDie * 28; // fall to floor
      torsoXOffset = -easeDie * 12;
      bodyRotation = -easeDie * Math.PI * 0.46; // rotate backward

      angle_front_leg = 0.2 * (1 - dieProgress);
      angle_back_leg = -0.2 * (1 - dieProgress);
      angle_front_arm = 0.6 * dieProgress;
      angle_back_arm = 0.6 * dieProgress;

      // Shattered rock dust
      particles.push(
        { dx: torsoXOffset, dy: 12, r: 2.2, color: '#475569', alpha: 0.8 * (1 - dieProgress) },
        { dx: torsoXOffset - 6, dy: 14, r: 3.5, color: '#334155', alpha: 0.7 * (1 - dieProgress) }
      );
      break;
    }
    case 'interact': {
      const cycle = (frame / 8) * Math.PI * 2;
      bodyYBob = -11 + Math.sin(cycle * 3) * 0.8;
      bodyRotation = 0.38; // leaning heavily down
      torsoXOffset = 2;

      angle_front_leg = 0.4;
      angle_back_leg = -0.4;

      // Pawing/Mining claws fast digging
      angle_front_arm = 0.85 + Math.sin(cycle * 3.5) * 0.5;
      angle_back_arm = 0.7 - Math.sin(cycle * 3.5) * 0.4;

      // rock debris thrown backwards
      if (frame % 2 === 0) {
        particles.push({
          dx: -11 - (frame * 2),
          dy: 10 - Math.sin(frame) * 6,
          r: 2.0,
          color: '#64748b',
          alpha: 0.8
        });
      }
      break;
    }
  }

  // Set general body scale
  ctx.scale(config.bodySize, config.bodySize);

  // Apply visual outline
  if (config.showOutline && config.outlineColor) {
    ctx.shadowColor = config.outlineColor;
    ctx.shadowBlur = 2;
  } else {
    ctx.shadowBlur = 0;
  }

  const tx = torsoXOffset;
  const ty = bodyYBob;

  // Render behind particles
  particles.forEach(p => {
    ctx.save();
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    
    // Check if it's sonic wave (large radius alpha circle)
    if (p.r > 10 && animationType === 'roar_buff') {
      ctx.strokeStyle = p.color === 'rgba(239, 68, 68, 0.08)' ? '#ef4444' : '#fbbf24';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(tx + p.dx, 15 + p.dy, p.r, Math.PI * 1.5, Math.PI * 0.5); // half circle outward roar
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(tx + p.dx, 15 + p.dy, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  // 1. BEAST SPIKEY TAIL (connected behind back torso)
  ctx.save();
  ctx.translate(tx - 7, ty + 6);
  ctx.rotate(-0.15 + (tailSway * Math.PI) / 180);
  
  // Outer thick tail chitin
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.quadraticCurveTo(-14 * (1 + spikeLength * 0.1), -10, -22 * (1 + spikeLength * 0.1), -2);
  ctx.quadraticCurveTo(-16 * (1 + spikeLength * 0.1), 5, -1, 3);
  ctx.closePath();
  ctx.fill();

  // Spikes on Tail block
  ctx.fillStyle = clawColor;
  ctx.beginPath();
  ctx.moveTo(-12, -7);
  ctx.lineTo(-13 - spikeLength, -12 - spikeLength);
  ctx.lineTo(-8, -4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // 2. BACK LEG
  drawMonsterLeg(ctx, tx - 5, ty + 10, angle_back_leg, shadowSkin, clawColor);

  // 3. BULKY CHITIN TORSO CHEST
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(bodyRotation);

  // Hulking round shoulder body
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(0, 3, 9, 10.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spikey Back plates (utilising spikeLength)
  ctx.fillStyle = clawColor;
  for (let iv = 0; iv < 3; iv++) {
    const spikeY = -2 + iv * 4;
    ctx.beginPath();
    ctx.moveTo(-9, spikeY);
    ctx.lineTo(-11 - spikeLength, spikeY - 3);
    ctx.lineTo(-8, spikeY + 3.5);
    ctx.closePath();
    ctx.fill();
  }

  // Energy ribs on core chest center (glowing bellyColor ribs)
  ctx.fillStyle = bellyColor;
  ctx.fillRect(-3, -2, 6, 1.8);
  ctx.fillRect(-4, 1.2, 8, 1.8);
  ctx.fillRect(-3, 4.4, 6, 1.8);

  ctx.restore();

  // 4. FRONT LEG
  drawMonsterLeg(ctx, tx + 4, ty + 10, angle_front_leg, skinColor, clawColor);

  // 5. BULKY GORILLA-STYLE ARMS
  // Back arm
  ctx.save();
  ctx.translate(tx - 6, ty + 2);
  ctx.rotate(angle_back_arm);
  ctx.strokeStyle = shadowSkin;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-4, 10);
  ctx.stroke();
  ctx.restore();

  // Front Arm (Bulky, claws at bottom)
  ctx.save();
  ctx.translate(tx + 6, ty + 2);
  ctx.rotate(angle_front_arm);
  
  // Bicep muscles
  ctx.strokeStyle = skinColor;
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(5, 7);
  ctx.stroke();

  // Forearm Greave
  ctx.strokeStyle = shadowSkin;
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(5, 7);
  ctx.lineTo(8, 13);
  ctx.stroke();

  // Razor claws fingers (Bone color / clawColor)
  ctx.fillStyle = clawColor;
  // draw 3 fingers
  ctx.fillRect(5, 13, 1.2, 4);
  ctx.fillRect(7.2, 13, 1.2, 4.5);
  ctx.fillRect(9.4, 13, 1.2, 4);

  ctx.restore(); // Arm done

  // 6. SAVAGE BEAST HEAD (GAPING MAW & HORNS)
  ctx.save();
  ctx.translate(tx + 4, ty - 6);
  ctx.rotate(bodyRotation * 0.95);

  // Skull bulky head
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(1, -3, 6.0, 0, Math.PI * 2);
  ctx.fill();

  // Heavy Horns (utilising hornWeight scale)
  ctx.save();
  ctx.translate(-2, -5.5);
  ctx.rotate(-0.4);
  ctx.fillStyle = clawColor;
  ctx.beginPath();
  ctx.moveTo(-1.5, 0);
  ctx.quadraticCurveTo(-hornWeight, -10, -hornWeight * 1.5, -hornWeight * 1.8);
  ctx.quadraticCurveTo(-4, -1, 1.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Glowing Demon Eye dot
  if (animationType !== 'die') {
    ctx.fillStyle = eyeColor;
    if (config.eyeGlow) {
      ctx.shadowColor = eyeColor;
      ctx.shadowBlur = 3;
    }
    ctx.fillRect(2.5, -4, 2, 2);
    ctx.shadowBlur = 0;
  } else {
    // Stone static slit
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(2.5, -3, 2, 0.8);
  }

  // GAPING MAW / CHOPPER TEETH (Opens wide during roar)
  // Upper Jaw
  ctx.fillStyle = shadowSkin;
  ctx.fillRect(1, -1, 6, 2.5);
  // Lower Jaw (split Y-axis down depending on roaringMouthY offset)
  ctx.save();
  ctx.translate(0, roaringMouthY);
  ctx.fillStyle = shadowSkin;
  ctx.fillRect(1, 1.5, 5, 2.5);

  // Savage white fangs/teeth (utilising jawMawScale ratio)
  ctx.fillStyle = '#ffffff';
  // Upper teeth
  ctx.beginPath();
  ctx.moveTo(1.5, 1.5); ctx.lineTo(2.5, 3.5); ctx.lineTo(3.5, 1.5);
  ctx.moveTo(3.5, 1.5); ctx.lineTo(4.5, 3.5); ctx.lineTo(5.5, 1.5);
  ctx.fill();
  // Lower teeth pointing up
  ctx.beginPath();
  ctx.moveTo(1.5, 1.5); ctx.lineTo(2.5, -0.5); ctx.lineTo(3.5, 1.5);
  ctx.moveTo(3.5, 1.5); ctx.lineTo(4.5, -0.5); ctx.lineTo(5.5, 1.5);
  ctx.fill();

  ctx.restore(); // Lower jaw done

  ctx.restore(); // Head done

  ctx.restore();
}

/**
 * Heavy beast leg segment
 */
function drawMonsterLeg(
  ctx: CanvasRenderingContext2D,
  lx: number,
  ly: number,
  swingAngle: number,
  skinColor: string,
  clawColor: string
) {
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(swingAngle);

  // Thick Thigh bone
  ctx.strokeStyle = skinColor;
  ctx.lineWidth = 5.0;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 6);
  ctx.stroke();

  // Sharp claw foot sabbaton
  ctx.fillStyle = clawColor;
  ctx.beginPath();
  ctx.ellipse(1, 6, 4.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Toe talons claws
  ctx.fillRect(3.2, 5, 2, 2.8);
  ctx.fillRect(1.5, 7.2, 2.2, 2);

  ctx.restore();
}

/**
 * Shading helpers
 */
function clawsBloodColor(skin: string): string {
  if (skin === '#c026d3' || skin.toLowerCase() === '#e11d48') {
    return '#facc15'; // yellow spark
  }
  return '#ef4444'; // default red strike
}

function interpolateColor(color1: string, color2: string, factor: number): string {
  if (!color1.startsWith('#') || !color2.startsWith('#')) return color1;
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.floor(r1 + factor * (r2 - r1));
  const g = Math.floor(g1 + factor * (g2 - g1));
  const b = Math.floor(b1 + factor * (b2 - b1));

  const rs = Math.max(0, Math.min(255, r)).toString(16).padStart(2, '0');
  const gs = Math.max(0, Math.min(255, g)).toString(16).padStart(2, '0');
  const bs = Math.max(0, Math.min(255, b)).toString(16).padStart(2, '0');

  return `#${rs}${gs}${bs}`;
}

function darkenColor(hex: string, percent: number): string {
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
