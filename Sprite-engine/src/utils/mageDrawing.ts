import { WolfConfig, MageAnimationType, MAGE_ANIMATIONS } from '../types';

/**
 * Draws a Human Mage frame on a canvas context based on the current configuration and animation state.
 */
export function drawMage(
  ctx: CanvasRenderingContext2D,
  config: WolfConfig,
  animationType: MageAnimationType,
  frame: number,
  cx: number, // Center X
  cy: number, // Center Y
  flipX: boolean = false
) {
  ctx.save();

  const robeColor = config.primaryColor; // Celestial Robes (e.g. Purple)
  const goldTrim = config.secondaryColor; // Wizard trims, gold accessories
  const staffColor = config.accentColor; // Staff core or timber wood
  const manaColor = config.eyeColor; // Mana / Crystal Glow

  const shadowRobe = darkenColor(robeColor, 0.25);
  const shadowTrim = darkenColor(goldTrim, 0.25);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.translate(cx, cy);

  if (flipX) {
    ctx.scale(-1, 1);
  }

  const totalFrames = MAGE_ANIMATIONS[animationType]?.frameCount || 6;
  const progress = frame / totalFrames;

  let bodyYBob = -16;
  let bodyRotation = 0;
  let torsoXOffset = 0;

  // Floating magic levitatation cycle
  const hoverCycle = (frame / totalFrames) * Math.PI * 2;
  let hoverOffset = Math.sin(hoverCycle) * 2.2; // Hover height
  if (animationType === 'die') hoverOffset = 0; // fall to ground

  let angle_front_arm = 0;
  let angle_back_arm = 0;
  let robeFlop = 0;

  let staffHeight = config.tailLength * 22; // staff height scale
  let hatTallness = config.earSize; // Wizard tall hat scale
  let shieldRadius = config.snoutLength * 22; // Runic shield width
  
  let particles: Array<{ dx: number; dy: number; r: number; color: string; alpha: number }> = [];

  switch (animationType) {
    case 'idle': {
      bodyYBob = -16 + hoverOffset;
      bodyRotation = 0.04 * Math.cos(hoverCycle);
      angle_front_arm = 0.15 + Math.sin(hoverCycle) * 0.05; // holds staff steady
      angle_back_arm = -0.3;
      robeFlop = Math.sin(hoverCycle) * 0.3;
      
      // Floating static mana particles around crystal
      if (frame % 2 === 0) {
        particles.push({
          dx: 11,
          dy: -18 + Math.sin(frame) * 4,
          r: 1.5,
          color: manaColor,
          alpha: 0.6
        });
      }
      break;
    }
    case 'walk': {
      // Levitating swift glide walk
      bodyYBob = -15 + hoverOffset;
      bodyRotation = 0.04;
      angle_front_arm = 0.35 + Math.sin(hoverCycle * 2) * 0.1;
      angle_back_arm = -0.4;
      robeFlop = 0.5 + Math.cos(hoverCycle) * 0.4;
      break;
    }
    case 'run': {
      // Magic dash sprint
      bodyYBob = -14 + hoverOffset;
      bodyRotation = 0.15;
      torsoXOffset = 1.0;
      angle_front_arm = 0.6;
      angle_back_arm = -0.7;
      robeFlop = 1.0 + Math.sin(hoverCycle) * 0.3;

      // Sparkly magic trailing particles behind Mage
      particles.push(
        { dx: -12, dy: 6 + hoverOffset, r: 2.2, color: manaColor, alpha: 0.7 },
        { dx: -8, dy: 10 + hoverOffset, r: 1.2, color: '#ffffff', alpha: 0.5 }
      );
      break;
    }
    case 'cast_spell': {
      // Spell casting, raises staff high
      const t = frame;
      bodyYBob = -16 + hoverOffset * 0.5;
      
      if (t <= 3) {
        // Gathering mana power
        angle_front_arm = -1.5; // raise staff vertically high
        angle_back_arm = -0.5;
        
        // Swirling magical charge dots
        particles.push({
          dx: 6 + (3 - t) * 3,
          dy: -14 - staffHeight + (3 - t) * 3,
          r: 2.0,
          color: manaColor,
          alpha: 0.8
        });
      } else if (t === 4 || t === 5) {
        // Fire release forward!
        angle_front_arm = 0.5; // swing staff forward towards target
        angle_back_arm = -1.2;
        
        // Muzzle ray casting light elements
        for (let i = 0; i < 9; i++) {
          particles.push({
            dx: 15 + i * 5,
            dy: -10 + (Math.random() - 0.5) * 5,
            r: 4.5 - i * 0.5,
            color: manaColor,
            alpha: 1.0 - i * 0.1
          });
        }
      } else {
        // Recovery frame
        angle_front_arm = 0.2;
        angle_back_arm = -0.3;
      }
      break;
    }
    case 'shield_barrier': {
      // Energy spherical shield (6 frames)
      const t = frame;
      bodyYBob = -13; // hover lower as defensive ground lock
      angle_front_arm = 0.2;
      angle_back_arm = 0.6;
      
      const pulseRatio = Math.sin((t / 5) * Math.PI);
      
      // Draw shield runic circular barrier elements
      particles.push(
        { dx: 0, dy: -5, r: shieldRadius * (0.8 + pulseRatio * 0.25), color: `${manaColor}33`, alpha: 0.4 }, // Translucent filled circle
        { dx: 0, dy: -5, r: shieldRadius * 1.0, color: manaColor, alpha: 0.8 } // Outer stroke outline
      );
      break;
    }
    case 'die': {
      // Disintegrate into starry sparks leaving robe flat (6 frames)
      const t = frame;
      const dieProgress = Math.min(t / 5, 1.0);
      
      bodyYBob = -16 + dieProgress * 26; // Robe drops onto floor
      bodyRotation = dieProgress * 0.15; // stays relatively flat sliding
      
      angle_front_arm = 1.0; // staff slips out of limp hand
      angle_back_arm = 0.5;
      
      // Spark shower exploding upwards
      for (let i = 0; i < 3; i++) {
        particles.push({
          dx: (Math.random() - 0.5) * 20,
          dy: -15 + i * 8 - dieProgress * 25,
          r: Math.random() * 3.5 + 1.0,
          color: manaColor,
          alpha: 1.0 - dieProgress
        });
      }
      break;
    }
    case 'interact': {
      const cycle = (frame / 8) * Math.PI * 2;
      bodyYBob = -13; // bending down
      bodyRotation = 0.2;
      angle_front_arm = 0.9; // reading parchment
      angle_back_arm = 0.8;
      
      // glowing magic book particle sparks
      if (frame % 2 === 0) {
        particles.push({
          dx: 12,
          dy: 12,
          r: 1.5,
          color: manaColor,
          alpha: 0.8
        });
      }
      break;
    }
  }

  // Set general scale
  ctx.scale(config.bodySize, config.bodySize);

  // Apply outline border
  if (config.showOutline && config.outlineColor) {
    ctx.shadowColor = config.outlineColor;
    ctx.shadowBlur = 2;
  } else {
    ctx.shadowBlur = 0;
  }

  const tx = torsoXOffset;
  const ty = bodyYBob;

  // Render behind-layer particles first
  particles.forEach(p => {
    // Check if it's the large shield bubble so we draw a thick empty circle instead of solid filled dot
    const isShieldOuter = p.r > 15 && animationType === 'shield_barrier' && p.color.length > 7;
    const isShieldInner = p.r > 15 && animationType === 'shield_barrier' && p.color.endsWith('33');

    ctx.save();
    ctx.globalAlpha = p.alpha;
    
    if (isShieldOuter) {
      // Draw Stroke Runic Energy bubble
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tx + p.dx, 15 + p.dy, p.r, 0, Math.PI * 2);
      ctx.stroke();

      // Draw horizontal cross lines or runes inside
      ctx.strokeStyle = `${p.color}aa`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      // small magical cross lines of rune
      ctx.moveTo(tx + p.dx - p.r, 15 + p.dy); ctx.lineTo(tx + p.dx + p.r, 15 + p.dy);
      ctx.stroke();
    } else if (isShieldInner) {
      // Glow filled inner space
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(tx + p.dx, 15 + p.dy, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(tx + p.dx, 15 + p.dy, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  const skin = config.skinColor || '#ffedd5';
  const underwear = config.underwearColor || '#3b82f6';
  const hair = config.hairColor || '#eab308';

  // 1. FLOATING WIZARD ROBES BOTTOM OR BARE LEGS ("в трусах")
  ctx.save();
  ctx.translate(tx, ty + 12);
  ctx.rotate(robeFlop * 0.12);

  if (config.equipChestplate) {
    // Outer deep celestial gown/robe
    ctx.fillStyle = robeColor;
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(6, -4);
    // bell shape bottom robes
    ctx.bezierCurveTo(9, 6, 8, 11, 6, 14);
    ctx.lineTo(-6, 14);
    ctx.bezierCurveTo(-8, 11, -9, 6, -6, -4);
    ctx.closePath();
    ctx.fill();

    // Golden / Secondary Trim ribbon on bottom robe hem
    ctx.fillStyle = goldTrim;
    ctx.fillRect(-6.5, 12, 13, 2);

    // Deep dark inner shadow gown fold
    ctx.fillStyle = shadowRobe;
    ctx.beginPath();
    ctx.ellipse(-1, 4, 3, 7, -0.05, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Drawn Bare Underwear Legs hanging down because Mage floats!
    // Trunks
    ctx.fillStyle = underwear;
    ctx.fillRect(-4.5, -4, 9, 3.5);

    // Left bare leg dangling
    ctx.strokeStyle = skin;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(-2.5, 9 + Math.sin(hoverCycle) * 1.5);
    ctx.stroke();

    // Left bare foot
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(-3, 9 + Math.sin(hoverCycle) * 1.5, 1.8, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Right bare leg dangling
    ctx.strokeStyle = skin;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(2.5, 7 - Math.sin(hoverCycle) * 1.5);
    ctx.stroke();

    // Right bare foot
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(2, 7 - Math.sin(hoverCycle) * 1.5, 1.8, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // 2. MAIN WIZARD TORSO (SHOULDERS / SKIN BASE / ARMOR)
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(bodyRotation);
  
  if (config.equipChestplate) {
    // Inner robes
    ctx.fillStyle = '#2e1065'; // shadow deep indigo
    ctx.beginPath();
    ctx.ellipse(0, 3, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gold Trim Collar
    ctx.fillStyle = goldTrim;
    ctx.fillRect(-3, 0, 6, 1.5);
  } else {
    // Bare skin torso
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(0, 3.2, 4.4, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Belt
  if (config.equipBelt) {
    ctx.fillStyle = '#451a03'; // Brown leather belt
    ctx.fillRect(-4.5, 7.5, 9, 1.8);
    ctx.fillStyle = '#ecc94b'; // Gold buckle
    ctx.fillRect(-1.0, 6.8, 2.0, 3);
  }

  ctx.restore();

  // 3. WIZARD TALL HAT / BARE HAIR / HELMET
  ctx.save();
  ctx.translate(tx, ty - 65 * 0.1);
  ctx.rotate(bodyRotation * 0.9);

  // Hair
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(-1.5, -3, 3.5, 3.5, 0, 0, Math.PI * 2);
  ctx.ellipse(1.5, -3, 2.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head skin
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -3, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Starry Mage Eye
  if (animationType !== 'die') {
    ctx.fillStyle = manaColor;
    if (config.eyeGlow) {
      ctx.shadowColor = manaColor;
      ctx.shadowBlur = 3;
    }
    // Glowing cyan mage visor dot
    ctx.fillRect(1, -3, 1.5, 1.5);
    ctx.shadowBlur = 0;
  } else {
    // knocked out eye
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0.5, -3.5); ctx.lineTo(2.5, -1.5);
    ctx.moveTo(2.5, -3.5); ctx.lineTo(0.5, -1.5);
    ctx.stroke();
  }

  // Large Wizard Hat conical (Only if helmet option is equipped)
  if (config.equipHelmet) {
    ctx.save();
    ctx.translate(0, -4.5);
    
    // Wide hat Brim
    ctx.fillStyle = robeColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 2.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = goldTrim;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tall Pointy cone
    ctx.fillStyle = robeColor;
    ctx.beginPath();
    ctx.moveTo(-5, -0.6);
    // pointy bend tip
    ctx.quadraticCurveTo(-3, -11 * hatTallness, -4.5 * hatTallness, -13 * hatTallness);
    ctx.quadraticCurveTo(0, -9 * hatTallness, 5, -0.6);
    ctx.closePath();
    ctx.fill();

    // Shading on cone hat
    ctx.fillStyle = shadowRobe;
    ctx.beginPath();
    ctx.moveTo(-3, -0.6);
    ctx.quadraticCurveTo(-1.5, -9 * hatTallness, -3.5 * hatTallness, -11.5 * hatTallness);
    ctx.lineTo(-4.5 * hatTallness, -13 * hatTallness);
    ctx.closePath();
    ctx.fill();

    // Gold Hat buckle star belt
    ctx.fillStyle = goldTrim;
    ctx.fillRect(-3.5, -2, 7, 1.5);
    ctx.restore(); // cone done
  }

  ctx.restore(); // Head done

  // 4. FRONT FORWARD HAND & COLD WEAPON SLOT (Sword, Bow, Staff, None)
  ctx.save();
  ctx.translate(tx + 4, ty + 3);
  ctx.rotate(angle_front_arm);

  // Outer forearm outlining (bare skin vs sleeve)
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(6, 4);
  ctx.stroke();

  ctx.strokeStyle = config.equipChestplate ? robeColor : skin;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(6, 4);
  ctx.stroke();

  // Golden cuff ring / gloves
  if (config.equipGloves) {
    ctx.fillStyle = goldTrim;
    ctx.beginPath();
    ctx.arc(6, 4, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Staff Assembly
  ctx.save();
  ctx.translate(7, 5);
  
  if (config.equipWeapon === 'staff') {
    // Shaft Timber pole
    ctx.strokeStyle = staffColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 14); // bottom end
    ctx.lineTo(0, -staffHeight + 10); // top shaft
    ctx.stroke();

    // Staff Headpiece (Gilded Crown holding magic gem)
    const staffTopY = -staffHeight + 10;
    
    ctx.fillStyle = goldTrim;
    ctx.beginPath();
    ctx.moveTo(-3, staffTopY);
    ctx.lineTo(3, staffTopY);
    ctx.lineTo(4, staffTopY - 4);
    ctx.lineTo(0, staffTopY - 8);
    ctx.lineTo(-4, staffTopY - 4);
    ctx.closePath();
    ctx.fill();

    // Floating massive Glowing Crystal Jewel Gem (utilising manaColor)
    ctx.fillStyle = manaColor;
    if (config.eyeGlow) {
      ctx.shadowColor = manaColor;
      ctx.shadowBlur = 4;
    }
    ctx.beginPath();
    ctx.moveTo(0, staffTopY - 14);
    ctx.lineTo(2.4, staffTopY - 11);
    ctx.lineTo(0, staffTopY - 8);
    ctx.lineTo(-2.4, staffTopY - 11);
    ctx.closePath();
    ctx.fill();

    // Diamond sheen shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, staffTopY - 14);
    ctx.lineTo(1.2, staffTopY - 11.5);
    ctx.lineTo(0, staffTopY - 8);
    ctx.closePath();
    ctx.fill();

  } else if (config.equipWeapon === 'sword') {
    // Magic glowing blade
    ctx.rotate(1.0);
    ctx.fillStyle = goldTrim;
    ctx.fillRect(-1, -3, 2, 6);
    ctx.fillStyle = manaColor;
    ctx.beginPath();
    ctx.moveTo(1, -1.2);
    ctx.lineTo(16 * config.tailLength, -0.6);
    ctx.lineTo(18 * config.tailLength, 0);
    ctx.lineTo(16 * config.tailLength, 0.6);
    ctx.lineTo(1, 1.2);
    ctx.closePath();
    ctx.fill();
  } else if (config.equipWeapon === 'bow') {
    // Light wooden curved shortbow
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(2, 0, 10, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(2, -10);
    ctx.lineTo(2, 10);
    ctx.stroke();
  }

  ctx.restore(); // Staff done
  ctx.restore(); // Arm done

  ctx.restore();
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
