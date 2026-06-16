import { WolfConfig, ElfAnimationType, ELF_ANIMATIONS } from '../types';

/**
 * Draws an Elf Archer frame on a canvas context based on the current configuration and animation state.
 */
export function drawElf(
  ctx: CanvasRenderingContext2D,
  config: WolfConfig,
  animationType: ElfAnimationType,
  frame: number,
  cx: number, // Center X
  cy: number, // Center Y
  flipX: boolean = false
) {
  ctx.save();

  // Create clean color palette
  const tunicColor = config.primaryColor; // Green/Custom Tunic
  const trimColor = config.secondaryColor; // Golden hair or Trim
  const woodColor = config.accentColor; // Bow wood / Leather
  const eyeColor = config.eyeColor; // Glowing hunter eyes

  // Shading colors
  const shadowTunic = darkenColor(tunicColor, 0.25);
  const shadowTrim = darkenColor(trimColor, 0.25);
  const shadowWood = darkenColor(woodColor, 0.25);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.translate(cx, cy);

  if (flipX) {
    ctx.scale(-1, 1);
  }

  const totalFrames = ELF_ANIMATIONS[animationType]?.frameCount || 6;
  const progress = frame / totalFrames;

  // Animation states variables
  let bodyYBob = -16;
  let bodyRotation = 0;
  let torsoXOffset = 0;
  
  let angle_front_leg = 0;
  let angle_back_leg = 0;
  let angle_front_arm = 0;
  let angle_back_arm = 0;

  let bowScale = config.tailLength; // Bow length modifier
  let bowDrawX = 0; // Bowstring tension offset during shoot
  let earLength = config.earSize * 6; // Long elf ears
  let quiverArrowCount = Math.floor(config.snoutLength * 4); // Arrows in quiver representation
  
  let particles: Array<{ dx: number; dy: number; r: number; color: string; alpha: number }> = [];

  switch (animationType) {
    case 'idle': {
      const breath = Math.sin((frame / 6) * Math.PI * 2);
      bodyYBob = -16 + breath * 0.8;
      bodyRotation = 0.01 * breath;

      angle_front_leg = 0.05;
      angle_back_leg = -0.05;
      angle_front_arm = 0.3 + breath * 0.03; // holding bow
      angle_back_arm = -0.3; // holding arrow or rest
      break;
    }
    case 'walk': {
      const cycle = (frame / 8) * Math.PI * 2;
      bodyYBob = -16 + Math.sin(cycle * 2) * 0.8;
      bodyRotation = Math.cos(cycle) * 0.02;

      angle_front_leg = Math.sin(cycle) * 0.45;
      angle_back_leg = -Math.sin(cycle) * 0.45;
      angle_front_arm = 0.2 - Math.cos(cycle) * 0.15;
      angle_back_arm = -0.2 + Math.cos(cycle) * 0.15;
      break;
    }
    case 'run': {
      const cycle = (frame / 8) * Math.PI * 2;
      bodyYBob = -16 + Math.sin(cycle * 2) * 2.0;
      bodyRotation = 0.12 + Math.cos(cycle * 2) * 0.02;
      torsoXOffset = 1.5;

      angle_front_leg = Math.sin(cycle) * 0.75;
      angle_back_leg = -Math.sin(cycle) * 0.75;
      angle_front_arm = 0.5 + Math.sin(cycle) * 0.2;
      angle_back_arm = -0.4;
      break;
    }
    case 'jump': {
      const t = frame;
      const rollAngle = (t / 5) * Math.PI * 2;
      
      bodyYBob = -12 - Math.sin((t / 5) * Math.PI) * 14; 
      torsoXOffset = (t / 5) * 8;
      bodyRotation = rollAngle; // Agile elven flip

      angle_front_leg = 0.5;
      angle_back_leg = -0.5;
      angle_front_arm = -0.8;
      angle_back_arm = -0.8;
      break;
    }
    case 'shoot_bow': {
      // 8 frames for shooting loop
      const t = frame;
      bodyYBob = -15;
      
      if (t <= 3) {
        // Drawing bow back
        bowDrawX = t * 1.5;
        angle_front_arm = -0.2; // lifting bow
        angle_back_arm = 0.6; // hand pulling string back
        
        // arrow magic charging particles
        particles.push({
          dx: -2 - t,
          dy: -10,
          r: 1.5,
          color: eyeColor,
          alpha: 0.5 + t * 0.1
        });
      } else if (t === 4) {
        // Fire release!
        bowDrawX = 0;
        angle_front_arm = -0.4;
        angle_back_arm = -0.8; // arm released back
        
        // Glow arrow muzzle burst
        for (let i = 0; i < 8; i++) {
          particles.push({
            dx: 12 + i * 4,
            dy: -10 + (Math.random() - 0.5) * 4,
            r: 3.5 - i * 0.4,
            color: eyeColor,
            alpha: 1.0 - i * 0.12
          });
        }
      } else {
        // Recovery
        bowDrawX = 0;
        angle_front_arm = 0.1;
        angle_back_arm = -0.4;
      }
      break;
    }
    case 'die': {
      const dieProgress = Math.min(frame / 5, 1.0);
      const easeDie = 1 - Math.pow(1 - dieProgress, 2);

      bodyYBob = -16 + easeDie * 28;
      torsoXOffset = -easeDie * 10;
      bodyRotation = -easeDie * Math.PI * 0.42;

      angle_front_leg = -0.2 * (1 - dieProgress);
      angle_back_leg = 0.2 * (1 - dieProgress);
      angle_front_arm = -0.8 * dieProgress;
      angle_back_arm = 0.8 * dieProgress;

      // Forest leaf falling particles dissolving
      particles.push(
        { dx: torsoXOffset, dy: 10, r: 2.0, color: '#10b981', alpha: 0.6 },
        { dx: torsoXOffset - 5, dy: 12, r: 1.5, color: '#047857', alpha: 0.5 }
      );
      break;
    }
    case 'interact': {
      const cycle = (frame / 8) * Math.PI * 2;
      bodyYBob = -13;
      bodyRotation = 0.2;
      
      angle_front_leg = 0.2;
      angle_back_leg = -0.2;
      
      // Carving arrow movements
      angle_front_arm = 0.8 + Math.sin(cycle * 2) * 0.3;
      angle_back_arm = 0.6;
      break;
    }
  }

  // Set general body scaling
  ctx.scale(config.bodySize, config.bodySize);

  // Apply outline
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
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(tx + p.dx, 15 + p.dy, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  });

  // 1. QUIVER (on back)
  ctx.save();
  ctx.translate(tx - 3, ty + 5);
  ctx.rotate(-0.4);
  
  // Leathery quiver tube
  ctx.fillStyle = '#78350f'; // Brown leather quiver
  ctx.fillRect(-2.5, -7, 4, 11);
  ctx.fillStyle = trimColor; // Gold details
  ctx.fillRect(-2.5, -7, 4, 1.5);

  // Arrows representation based on configured snoutLength (quiver size)
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1;
  for (let i = 0; i < quiverArrowCount; i++) {
    const arrX = -2 + i * 1.2;
    ctx.beginPath();
    ctx.moveTo(arrX, -7);
    ctx.lineTo(arrX, -11);
    ctx.stroke();

    // drawing green/feather fletching
    ctx.fillStyle = tunicColor;
    ctx.fillRect(arrX - 0.8, -12, 1.6, 1.5);
  }
  ctx.restore();

  // 2. BACK LEG
  drawElfLeg(ctx, tx - 3, ty + 12, angle_back_leg, config, true);

  // 3. CAPE & ROBES (Only draw if chestplate armor is equipped)
  if (config.equipChestplate) {
    ctx.save();
    ctx.translate(tx - 5, ty + 2);
    let capeWave2 = Math.sin((frame / 8) * Math.PI * 2);
    if (animationType === 'run') capeWave2 = 1.8 + Math.sin(frame * 0.4) * 0.2;
    ctx.rotate(0.1 + capeWave2 * 0.1);
    ctx.fillStyle = shadowTunic;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-10, -2, -14, 16, -8, 22);
    ctx.lineTo(-2, 19);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 4. TORSO (GREEN FOREST TUNIC / SKIN BASE UNDERGARMENT)
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(bodyRotation);
  
  // Base Skin Face & Torso
  const skin = config.skinColor || '#ffedd5';
  const underwear = config.underwearColor || '#3b82f6';

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, 4, 4.6, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = underwear;
  ctx.beginPath();
  ctx.ellipse(0, 8, 4.0, 3.0, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw equipped green tunic / plates over base body
  if (config.equipChestplate) {
    ctx.fillStyle = tunicColor;
    ctx.beginPath();
    ctx.ellipse(0, 4, 5.2, 7.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gold harness belt sash
    ctx.strokeStyle = trimColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-4.5, 2);
    ctx.lineTo(4.5, 5);
    ctx.stroke();
  }

  // Equipped belt
  if (config.equipBelt) {
    ctx.fillStyle = '#451a03'; // Brown leather belt
    ctx.fillRect(-5, 6.5, 10, 2);
    ctx.fillStyle = '#ecc94b'; // buckle
    ctx.fillRect(-1.2, 5.5, 2.4, 4);
  }

  ctx.restore();

  // 5. FRONT LEG
  drawElfLeg(ctx, tx + 2, ty + 12, angle_front_leg, config, false);

  // 6. HELMET / ELF HAIR & LONG EARS
  ctx.save();
  ctx.translate(tx, ty - 6);
  ctx.rotate(bodyRotation * 0.85);

  // Hair always drawn underneath helmet/hood edges slightly
  ctx.fillStyle = config.hairColor || '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, -3.5, 5.0, 0, Math.PI * 2);
  ctx.fill();

  // Long side strands of hair
  ctx.fillRect(-4.5, -2, 2.5, 5);

  // Long slender pointy Elf Ears (Bare skin ear)
  ctx.save();
  ctx.translate(-3.5, -3);
  ctx.rotate(-0.35);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-earLength, -3);
  ctx.lineTo(-1.5, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Hood/Crown item drawn if helmet is equipped
  if (config.equipHelmet) {
    ctx.fillStyle = tunicColor;
    ctx.beginPath();
    ctx.arc(0, -4.5, 4.2, Math.PI, 0); // half circle ranger hood
    ctx.fill();

    // Crown / helm dynamic trim line
    ctx.strokeStyle = trimColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -4.5, 4.2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }

  // Eye Visor/Hunter glow
  if (animationType !== 'die') {
    ctx.fillStyle = eyeColor;
    if (config.eyeGlow) {
      ctx.shadowColor = eyeColor;
      ctx.shadowBlur = 3;
    }
    // Glowing hunter eye dot
    ctx.fillRect(1.5, -3, 1.5, 1.5);
    ctx.shadowBlur = 0;
  } else {
    // Cross knockout eye
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(1, -3.5); ctx.lineTo(3, -1.5);
    ctx.moveTo(3, -3.5); ctx.lineTo(1, -1.5);
    ctx.stroke();
  }

  ctx.restore();

  // 7. FRONT BOW & AMMO ARM
  ctx.save();
  ctx.translate(tx + 3.5, ty + 3);
  ctx.rotate(angle_front_arm);

  // Forearm holding bow (Skin vs armor sleeves)
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(6, 3);
  ctx.stroke();

  ctx.strokeStyle = config.equipChestplate ? tunicColor : skin;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(6, 3);
  ctx.stroke();

  // Gloves/ gauntlet overlay
  if (config.equipGloves) {
    ctx.fillStyle = trimColor; // Gold leather stitching glove
    ctx.beginPath();
    ctx.arc(6, 3, 2.0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(6, 3, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Active Bow assembly (Renders only if bow selected OR fallback if bow is drawn)
  ctx.save();
  ctx.translate(6, 3);
  
  if (config.equipWeapon === 'bow') {
    // Bow limb drawing
    ctx.strokeStyle = woodColor;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, 11 * bowScale, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();

    // Bow tips gold finish
    ctx.fillStyle = trimColor;
    ctx.beginPath();
    ctx.arc(-2 * bowScale, -10 * bowScale, 1.5, 0, Math.PI * 2);
    ctx.arc(-2 * bowScale, 10 * bowScale, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Bowstring line
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-1.6 * bowScale, -9.5 * bowScale);
    if (bowDrawX > 0) {
      ctx.lineTo(-bowDrawX, 0);
      ctx.lineTo(-1.6 * bowScale, 9.5 * bowScale);
    } else {
      ctx.lineTo(-1.6 * bowScale, 9.5 * bowScale);
    }
    ctx.stroke();

    // Show charged glowing magic arrow during shoot frame
    if (animationType === 'shoot_bow' && frame <= 4) {
      ctx.strokeStyle = eyeColor;
      ctx.lineWidth = 1.2;
      // Magic Glowing arrow
      ctx.beginPath();
      ctx.moveTo(-bowDrawX - 2, 0);
      ctx.lineTo(12, 0);
      ctx.stroke();

      // Arrow arrowhead
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(12, -2);
      ctx.lineTo(15, 0);
      ctx.lineTo(12, 2);
      ctx.closePath();
      ctx.fill();
    }
  } else if (config.equipWeapon === 'sword') {
    // Elf wields a small elegant short sword
    ctx.rotate(1.2);
    ctx.fillStyle = '#f59e0b'; // Gold guard
    ctx.fillRect(-1.5, -3, 3, 6);
    ctx.fillStyle = '#b45309'; // wood grip
    ctx.fillRect(-2.5, -0.8, 2.5, 1.6);
    ctx.fillStyle = '#e2e8f0'; // pure steel
    ctx.beginPath();
    ctx.moveTo(1.5, -1.2);
    ctx.lineTo(14 * config.tailLength, -0.6);
    ctx.lineTo(16 * config.tailLength, 0);
    ctx.lineTo(14 * config.tailLength, 0.6);
    ctx.lineTo(1.5, 1.2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore(); // Bow done
  ctx.restore(); // Arm done

  ctx.restore();
}

function drawElfLeg(
  ctx: CanvasRenderingContext2D,
  lx: number,
  ly: number,
  swingAngle: number,
  config: WolfConfig,
  isBackLeg: boolean = false
) {
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(swingAngle);

  const skin = config.skinColor || '#ffedd5';
  const underwear = config.underwearColor || '#3b82f6';
  const greenTunic = isBackLeg ? darkenColor(config.primaryColor, 0.25) : config.primaryColor;

  // Thigh (Skin + underwear trim)
  ctx.strokeStyle = skin;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 6);
  ctx.stroke();

  ctx.strokeStyle = underwear;
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 2.5);
  ctx.stroke();

  if (config.equipChestplate) {
    ctx.strokeStyle = greenTunic;
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 5);
    ctx.stroke();
  }

  // Greaves / boots light leather vs bare skin
  if (config.equipBoots) {
    ctx.strokeStyle = config.accentColor || '#b45309';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(0, 11);
    ctx.stroke();

    // Small boot foot
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-1.5, 11, 4, 2);
  } else {
    ctx.strokeStyle = skin;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(0, 11);
    ctx.stroke();

    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0.5, 11, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function darkenColor(hex: string, percent: number): string {
  if (!hex || !hex.startsWith('#')) return hex || '#000000';
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
