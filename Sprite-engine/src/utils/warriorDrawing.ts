import { WolfConfig, WarriorAnimationType, WARRIOR_ANIMATIONS } from '../types';

/**
 * Draws a Warrior frame on a canvas context based on the current configuration and animation state.
 * All positions are drawn relative to a local origin (usually translated to frame center).
 */
export function drawWarrior(
  ctx: CanvasRenderingContext2D,
  config: WolfConfig,
  animationType: WarriorAnimationType,
  frame: number,
  cx: number, // Center X
  cy: number, // Center Y (ground offset)
  flipX: boolean = false
) {
  ctx.save();

  // Create clean color palette
  const armorRed = config.primaryColor; // User's custom red armor
  const capeColor = config.secondaryColor; // Secondary mantle color (default golden/dark or cape color)
  const metalSteel = config.accentColor; // Weapons, sword, and shield steel
  const visorColor = config.eyeColor; // Visor/helmet eyes glowing

  // Darker shade computed dynamically
  const shadowArmor = darkenColor(armorRed, 0.25);
  const shadowCape = darkenColor(capeColor, 0.25);
  const shadowSteel = darkenColor(metalSteel, 0.25);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Apply general scale and translation
  ctx.translate(cx, cy);

  if (flipX) {
    ctx.scale(-1, 1);
  }

  const totalFrames = WARRIOR_ANIMATIONS[animationType]?.frameCount || 6;
  const progress = frame / totalFrames; // 0 to 1

  // Handle general transformations depending on animation
  let bodyYBob = 0;
  let bodyRotation = 0;
  let torsoXOffset = 0;
  let scaleX = 1; // can be flipped of course
  let scaleY = 1;

  // Arms and legs positions
  let angle_front_leg = 0;
  let angle_back_leg = 0;
  let angle_front_arm = 0;
  let angle_back_arm = 0;

  let swordAngle = -0.3; // resting slant
  let swordYScale = config.tailLength; // sword length mapped to tailLength scale
  let shieldGuardOffset = 0; // shield raise position
  let crestSize = config.earSize; // helmet plume/crest scale
  let shieldScaleX = config.snoutLength; // shield size mapped to snoutLength

  // Particle emission list (drawn locally on top)
  let particles: Array<{ dx: number; dy: number; r: number; color: string; alpha: number }> = [];

  // --- MATH SYSTEM FOR 9 WARRIOR ANIMATIONS ---
  switch (animationType) {
    case 'idle': {
      // Gentle breathing bob
      const breath = Math.sin((frame / 6) * Math.PI * 2);
      bodyYBob = -17 + breath * 1.0;
      bodyRotation = 0.02 * breath;
      
      // Arms steady, stance relaxed
      angle_front_leg = 0.1;
      angle_back_leg = -0.15;
      angle_front_arm = 0.4 + breath * 0.04; // sword rest
      angle_back_arm = -0.2 - breath * 0.04;  // shield rest
      swordAngle = -0.2;
      break;
    }
    case 'walk': {
      // 8 walking frames
      const cycle = (frame / 8) * Math.PI * 2;
      bodyYBob = -17 + Math.sin(cycle * 2) * 1.0;
      bodyRotation = Math.cos(cycle) * 0.04;

      // Legs swing out of phase
      angle_front_leg = Math.sin(cycle) * 0.5;
      angle_back_leg = -Math.sin(cycle) * 0.5;

      // Arms swing
      angle_front_arm = -Math.sin(cycle) * 0.4 + 0.3; // holding weapon
      angle_back_arm = Math.sin(cycle) * 0.4 - 0.2; // shielding
      swordAngle = -0.1 + Math.sin(cycle) * 0.1;
      break;
    }
    case 'run': {
      // Leaning forward heavily in high momentum sprint
      const cycle = (frame / 8) * Math.PI * 2;
      bodyYBob = -17 + Math.sin(cycle * 2) * 2.2;
      bodyRotation = 0.18 + Math.cos(cycle * 2) * 0.03;
      torsoXOffset = 2;

      // Aggressive wide legs swing
      angle_front_leg = Math.sin(cycle) * 0.8;
      angle_back_leg = -Math.sin(cycle) * 0.8;

      // Arms coordinate
      angle_front_arm = 0.8 + Math.sin(cycle) * 0.3; // weapon forward
      angle_back_arm = -0.5 + Math.cos(cycle) * 0.3; // shield tucked in
      swordAngle = -0.4 + Math.sin(cycle) * 0.2;
      break;
    }
    case 'jump': {
      // 6 frames jump curve
      // Frame 0: Crouching
      // Frame 1-2: Flying high upward
      // Frame 3-4: Falling down and landing
      // Frame 5: Post-crouch recovery
      const t = frame;
      if (t === 0) {
        bodyYBob = -11; // deep squat
        angle_front_leg = 0.7; angle_back_leg = -0.6;
        angle_front_arm = 1.0; angle_back_arm = -0.6;
        swordAngle = -1.0;
      } else if (t === 1 || t === 2) {
        bodyYBob = -28 - (t === 2 ? 6 : 0); // rising to peak high
        angle_front_leg = -0.4; angle_back_leg = 0.3;
        angle_front_arm = -0.6; angle_back_arm = -1.2;
        swordAngle = 0.4;
      } else if (t === 3 || t === 4) {
        bodyYBob = -20 + (t === 4 ? 4 : 0); // falling
        angle_front_leg = 0.4; angle_back_leg = 0.5;
        angle_front_arm = 0.8; angle_back_arm = -0.3;
        swordAngle = -0.5;
      } else {
        bodyYBob = -14; // landing impact
        angle_front_leg = 0.6; angle_back_leg = -0.4;
        angle_front_arm = 0.3; angle_back_arm = -0.1;
      }
      break;
    }
    case 'sword_strike': {
      // Heavy sword slash - 6 frames
      // Row Y bobbing forward
      const t = frame;
      if (t === 0) {
        // Wind up / raise sword
        bodyYBob = -15;
        bodyRotation = -0.15;
        angle_front_arm = -1.6; // arm straight up
        angle_back_arm = -0.4;
        swordAngle = 0.8; // sword pointing backward
      } else if (t === 1) {
        // Slam swing start
        bodyYBob = -13;
        bodyRotation = 0.2;
        torsoXOffset = 6;
        angle_front_arm = 0.3; // arm lunges down and forward
        angle_back_arm = -0.2;
        swordAngle = -1.5; // slash downwards
        
        // Slash FX Trail Particles
        for (let i = 0; i < 7; i++) {
          particles.push({
            dx: 15 + i * 5,
            dy: -25 + i * 6,
            r: 4 - i * 0.4,
            color: 'rgba(255, 255, 255, 0.7)',
            alpha: 1.0 - i * 0.12
          });
        }
      } else if (t === 2 || t === 3) {
        // Follow through
        bodyYBob = -14;
        bodyRotation = 0.35;
        torsoXOffset = 8;
        angle_front_arm = 0.8;
        angle_back_arm = -0.5;
        swordAngle = -1.8; // slice flat

        // Sparks at the collision tip
        particles.push(
          { dx: 25, dy: -2, r: 2.5, color: '#f59e0b', alpha: 0.9 },
          { dx: 28, dy: -5, r: 1.5, color: '#ef4444', alpha: 0.8 },
          { dx: 22, dy: 1, r: 2.0, color: '#ffffff', alpha: 1.0 }
        );
      } else {
        // Recovery
        bodyYBob = -16;
        bodyRotation = 0.1;
        torsoXOffset = 3;
        angle_front_arm = 0.2;
        angle_back_arm = -0.3;
        swordAngle = -0.4;
      }
      break;
    }
    case 'shield_block': {
      // Shield blocking/hunkered (6 frames)
      const t = frame;
      const pulse = Math.sin((t / 6) * Math.PI);
      bodyYBob = -13; // hunkered lower stance
      bodyRotation = 0.05;
      torsoXOffset = -1;
      
      // Legs spread wide for support
      angle_front_leg = 0.4;
      angle_back_leg = -0.5;
      
      // Sword and shield posture
      angle_front_arm = -0.1; // sword held defensively close
      angle_back_arm = 0.8;  // shield extended forward
      shieldGuardOffset = 2 + pulse * 4; // shield raised and thrust forward
      swordAngle = 0.5; // slanting upward backwards
      
      // Draw shield defense sparks / energy waves
      if (t === 2 || t === 3) {
        particles.push(
          { dx: 18, dy: -12, r: 3, color: '#60a5fa', alpha: 0.8 },
          { dx: 19, dy: -17, r: 1.5, color: '#ffffff', alpha: 0.9 },
          { dx: 16, dy: -7, r: 2.2, color: '#3b82f6', alpha: 0.7 }
        );
      }
      break;
    }
    case 'roll': {
      // 360-degree combat roll - 6 frames
      const rollProgress = frame / 5; // 0 to 1
      const rollAngle = rollProgress * Math.PI * 2;
      
      bodyYBob = -11 + Math.sin(rollProgress * Math.PI) * 4; // lift up and drop
      torsoXOffset = rollProgress * 15; // move horizontally
      bodyRotation = rollAngle; // revolve full 360

      // Tuck in arms and legs
      angle_front_leg = 0.9;
      angle_back_leg = -0.9;
      angle_front_arm = -1.2;
      angle_back_arm = -1.2;
      swordAngle = -0.5;

      // Dust smoke clouds on floor
      particles.push(
        { dx: torsoXOffset - 10, dy: 13, r: Math.random() * 3 + 1.5, color: '#e2e8f080', alpha: 0.6 },
        { dx: torsoXOffset, dy: 13, r: Math.random() * 4 + 2, color: '#94a3b844', alpha: 0.5 }
      );
      break;
    }
    case 'die': {
      // Die / Collapse backwards (6 frames)
      const dieProgress = Math.min(frame / 5, 1.0);
      const easeDie = 1 - Math.pow(1 - dieProgress, 2); // deceleration curve

      bodyYBob = -17 + easeDie * 29; // Sink to floor
      torsoXOffset = -easeDie * 16; // sliding back
      bodyRotation = -easeDie * Math.PI * 0.45; // rotate 80 degrees backward

      // Legs fly limp
      angle_front_leg = -0.5 * (1 - dieProgress);
      angle_back_leg = 0.3 * (1 - dieProgress);

      // Dropping sword and shield
      angle_front_arm = -1.2 * dieProgress; // arm goes limp
      angle_back_arm = 1.0 * dieProgress;
      swordAngle = 1.3 * dieProgress; // weapon slips loose
      break;
    }
    case 'interact': {
      // Doing something / searching / hammering with hands (8 frames)
      const cycle = (frame / 8) * Math.PI * 2;
      const hammerBlow = Math.sin(cycle * 2);
      
      bodyYBob = -13 + Math.cos(cycle) * 1.0; // Bending down
      bodyRotation = 0.28; // leaning forward
      torsoXOffset = 2;

      // Stand solid
      angle_front_leg = 0.35;
      angle_back_leg = -0.3;

      // Hands move down doing crafting/assembling
      angle_front_arm = 1.1 + hammerBlow * 0.5; // hand hammering up and down
      angle_back_arm = 0.8 - hammerBlow * 0.2;  // stabilizing holding workpiece
      swordAngle = 0.6 + hammerBlow * 0.4;

      // Sparks emitting on work site
      if (frame === 1 || frame === 4) {
        particles.push(
          { dx: 14, dy: 10, r: 2.5, color: '#facc15', alpha: 1.0 },
          { dx: 17, dy: 8, r: 1.5, color: '#ea580c', alpha: 0.9 },
          { dx: 12, dy: 13, r: 2.0, color: '#ffffff', alpha: 1.0 },
          { dx: 9, dy: 7, r: 1.2, color: '#fbbf24', alpha: 0.8 }
        );
      }
      break;
    }
  }

  // Set general scale
  ctx.scale(config.bodySize, config.bodySize);

  // Apply visual outline shadow if selected
  if (config.showOutline && config.outlineColor) {
    ctx.shadowColor = config.outlineColor;
    ctx.shadowBlur = 2;
  } else {
    ctx.shadowBlur = 0;
  }

  // --- RENDERING WARRIOR LAYERS FROM BACK TO FRONT ---

  // Main coords
  const tx = torsoXOffset;
  const ty = bodyYBob;

  // 1. PARTICLES (Behind)
  particles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(tx + p.dx, 15 + p.dy, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0; // reset
  });

  // 2. CAPE (Floats behind back torso, sways with movement)
  // Only draw cape when chestplate/armor is equipped
  if (config.equipChestplate) {
    ctx.save();
    ctx.translate(tx - 6, ty + 2);
    let capeWave = Math.sin((frame / 8) * Math.PI * 2 + 1);
    if (animationType === 'run') capeWave = 2.5 + Math.sin(frame * 0.5) * 0.3;
    if (animationType === 'roll') capeWave = -1.2;
    if (animationType === 'die') capeWave = -1.0;
    ctx.rotate(-0.15 + capeWave * 0.15);

    ctx.fillStyle = capeColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-15, -4, -20 * config.tailLength, 15, -13 * config.tailLength, 24);
    ctx.lineTo(-4, 21);
    ctx.closePath();
    ctx.fill();

    // Highlight border on cape
    ctx.fillStyle = shadowCape;
    ctx.beginPath();
    ctx.moveTo(-2, 2);
    ctx.bezierCurveTo(-12, 1, -16 * config.tailLength, 16, -11 * config.tailLength, 22);
    ctx.lineTo(-3, 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const isDwarf = config.characterType === 'dwarf';

  // 3. BACK LIMB & FOOT (dark shadow tint/bare skin depending on setup)
  drawWarriorLeg(ctx, tx - 4, ty + 12, angle_back_leg, config, true, isDwarf);

  // 4. MAIN TORSO (BODY / CHESSPLATE)
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(bodyRotation);

  // Core base physical skin torso (Underwear baseline)
  ctx.fillStyle = config.skinColor || '#fef08a';
  ctx.beginPath();
  // Dwarf torso is much wider/stockier
  const torsoW = isDwarf ? 7.2 : 5.8;
  const torsoH = isDwarf ? 6.5 : 8.0;
  ctx.ellipse(0, 4, torsoW, torsoH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Underwear model shorts / pants ("в трусах")
  ctx.fillStyle = config.underwearColor || '#3b82f6';
  ctx.beginPath();
  ctx.ellipse(0, isDwarf ? 7.5 : 8.5, torsoW - 0.5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw equipped Plate Chestplate armor
  if (config.equipChestplate) {
    // Leather padding/mail lining underneath
    ctx.fillStyle = '#2d3748';
    ctx.beginPath();
    ctx.ellipse(0, 5, torsoW + 0.8, torsoH + 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Metal Plates
    ctx.fillStyle = armorRed;
    ctx.beginPath();
    ctx.ellipse(0, 3, torsoW + 0.2, torsoH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Emblem / Trim highlights
    ctx.strokeStyle = capeColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-torsoW + 1, 0);
    ctx.bezierCurveTo(-torsoW / 2, 4, torsoW / 2, 4, torsoW - 1, 0);
    ctx.stroke();

    // Shading shadow
    ctx.fillStyle = shadowArmor;
    ctx.beginPath();
    ctx.ellipse(-torsoW / 2, 3, torsoW / 2, torsoH - 1, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Waist Belt if equipped
  if (config.equipBelt) {
    ctx.fillStyle = '#542d13'; // Dark leather belt
    const beltW = torsoW + (config.equipChestplate ? 0.9 : 0.3);
    ctx.fillRect(-beltW, isDwarf ? 6.2 : 7.2, beltW * 2, 2.2);
    
    // Buckle
    ctx.fillStyle = '#f59e0b'; // Gold buckle
    ctx.fillRect(-1.5, isDwarf ? 5.2 : 6.2, 3, 4);
  }
  ctx.restore();

  // 5. FRONT LEG
  drawWarriorLeg(ctx, tx + 3, ty + 12, angle_front_leg, config, false, isDwarf);

  // 6. BACK ARM + SHIELD (drawn depending on angle)
  ctx.save();
  ctx.translate(tx - 3, ty + 2);
  ctx.rotate(angle_back_arm);

  // Upper shoulder pauldron if chestplate armor is equipped
  if (config.equipChestplate) {
    ctx.fillStyle = armorRed;
    ctx.beginPath();
    ctx.arc(-2, -1, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shadowArmor;
    ctx.beginPath();
    ctx.arc(-3, -1, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw base arm (skin colour)
  ctx.strokeStyle = '#2d3748'; // outline
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(isDwarf ? 4 : 6, isDwarf ? 4 : 6);
  ctx.stroke();

  ctx.strokeStyle = config.skinColor || '#fef08a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(isDwarf ? 4 : 6, isDwarf ? 4 : 6);
  ctx.stroke();

  // Drawing hand / gauntlets
  const handX = isDwarf ? 4 : 6;
  const handY = isDwarf ? 4 : 6;
  if (config.equipGloves) {
    ctx.fillStyle = metalSteel;
    ctx.beginPath();
    ctx.arc(handX, handY, 2.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = config.skinColor || '#fef08a';
    ctx.beginPath();
    ctx.arc(handX, handY, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw equipped Shield
  if (config.equipShield) {
    ctx.save();
    ctx.translate(handX, handY + shieldGuardOffset);
    ctx.scale(shieldScaleX, 1.0);
    
    // Shield Steel Backing
    ctx.fillStyle = metalSteel;
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.lineTo(5, -6);
    ctx.lineTo(6, 4);
    ctx.lineTo(0, 11);
    ctx.lineTo(-6, 4);
    ctx.closePath();
    ctx.fill();

    // Primary coat shield crest
    ctx.fillStyle = armorRed;
    ctx.beginPath();
    ctx.moveTo(-3, -4);
    ctx.lineTo(3, -4);
    ctx.lineTo(4, 3);
    ctx.lineTo(0, 8);
    ctx.lineTo(-4, 3);
    ctx.closePath();
    ctx.fill();

    // Center Gold cross / emblem
    ctx.fillStyle = capeColor;
    ctx.fillRect(-1.2, -2, 2.4, 4);
    ctx.fillRect(-2, -1.2, 4, 2.4);

    ctx.restore();
  }
  ctx.restore(); // Back arm done

  // 7. HEAD (HELMET/BEARD/HAIR/EYES)
  ctx.save();
  ctx.translate(tx, ty - 6);
  ctx.rotate(bodyRotation * 0.9);

  // Glorious Dwarf bearded layout
  if (isDwarf) {
    // Large beard overlapping body under head
    ctx.fillStyle = config.hairColor || '#eab308';
    ctx.beginPath();
    ctx.moveTo(-5.5, -2);
    ctx.quadraticCurveTo(-9, 13, -1, 15);
    ctx.quadraticCurveTo(1, 15, 5, 13);
    ctx.quadraticCurveTo(8.5, 13, 5.5, -2);
    ctx.closePath();
    ctx.fill();

    // Nose
    ctx.fillStyle = darkenColor(config.skinColor || '#ffedd5', 0.12);
    ctx.beginPath();
    ctx.arc(2.0, -3, 1.8, 0, Math.PI*2);
    ctx.fill();

    // Mustache trim
    ctx.fillStyle = darkenColor(config.hairColor || '#eab308', 0.15);
    ctx.fillRect(-3.5, -2.5, 6, 2.5);
  }

  // Is Helmet Equipped?
  if (config.equipHelmet) {
    // Plume
    if (crestSize > 0.4) {
      ctx.fillStyle = capeColor;
      ctx.beginPath();
      ctx.moveTo(-4, -4);
      ctx.bezierCurveTo(-14 * crestSize, -11 * crestSize, -7 * crestSize, -16 * crestSize, -2, -10 * crestSize);
      ctx.closePath();
      ctx.fill();
    }

    // Steel helmet base skull dome
    ctx.fillStyle = armorRed;
    ctx.beginPath();
    ctx.arc(0, -4, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Dark visor shield side
    ctx.fillStyle = shadowArmor;
    ctx.beginPath();
    ctx.moveTo(-3, -6);
    ctx.lineTo(4, -4);
    ctx.lineTo(3, -1);
    ctx.lineTo(-4, -1);
    ctx.closePath();
    ctx.fill();

    // Laser dynamic eyes visor glow
    if (animationType !== 'die') {
      ctx.strokeStyle = visorColor;
      ctx.lineWidth = 1.0;
      
      if (config.eyeGlow) {
        ctx.shadowColor = visorColor;
        ctx.shadowBlur = 4;
      }
      
      ctx.beginPath();
      ctx.moveTo(-1, -3);
      ctx.lineTo(3, -3);
      ctx.stroke();

      // Pixel lens glimmer
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(1, -3.5, 1, 1);
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(1, -4);
      ctx.lineTo(3, -2);
      ctx.moveTo(3, -4);
      ctx.lineTo(1, -2);
      ctx.stroke();
    }

    // Iron chin guards
    ctx.fillStyle = shadowArmor;
    ctx.fillRect(-3, -1, 6, 2);

  } else {
    // Helm is off: Draw humanoid species face, hair, ears and customizable eye glow
    ctx.fillStyle = config.skinColor || '#fbcfe8';
    ctx.beginPath();
    ctx.arc(0, -4, 4.8, 0, Math.PI * 2);
    ctx.fill();

    // Hair cap
    ctx.fillStyle = config.hairColor || '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, -5.5, 5.0, Math.PI, 0); // top hair shape
    ctx.fill();

    // Sideburns / ponytail drape
    ctx.beginPath();
    ctx.moveTo(-5, -5.5);
    ctx.lineTo(-6.5, 1.5);
    ctx.lineTo(-2.0, -1.0);
    ctx.closePath();
    ctx.fill();

    // Pointy Elf ear override if Elf is drawn as warrior or just to provide high fantasy look
    if (config.characterType === 'elf') {
      ctx.fillStyle = config.skinColor || '#ffedd5';
      ctx.beginPath();
      ctx.moveTo(-3, -5);
      ctx.lineTo(-10, -7);
      ctx.lineTo(-4, -2);
      ctx.closePath();
      ctx.fill();
    }

    // Normal humanoid eyes
    if (animationType !== 'die') {
      ctx.fillStyle = config.eyeColor || '#38bdf8';
      ctx.fillRect(1.5, -4.5, 1.5, 1.5);
      
      if (config.eyeGlow) {
        ctx.shadowColor = config.eyeColor;
        ctx.shadowBlur = 3;
        ctx.fillRect(1.5, -4.5, 1.5, 1.5);
        ctx.shadowBlur = 0;
      }
    } else {
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(1, -5); ctx.lineTo(3, -3);
      ctx.moveTo(3, -5); ctx.lineTo(1, -3);
      ctx.stroke();
    }
  }

  ctx.restore(); // Head done

  // 8. FRONT FOREARM & EQUPPED WEAPON (Supports sword, bow, staff, none)
  ctx.save();
  ctx.translate(tx + 4, ty + 3);
  ctx.rotate(angle_front_arm);

  // Front dynamic shoulder pauldron guard
  if (config.equipChestplate) {
    ctx.fillStyle = armorRed;
    ctx.beginPath();
    ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = capeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw forearm skin / mail
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(isDwarf ? 5 : 7, isDwarf ? 3 : 4);
  ctx.stroke();

  ctx.strokeStyle = config.skinColor || '#ffedd5';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(isDwarf ? 5 : 7, isDwarf ? 3 : 4);
  ctx.stroke();

  const weaponHandX = isDwarf ? 5 : 7;
  const weaponHandY = isDwarf ? 3 : 4;

  // Gauntlet / Glove on main hand
  if (config.equipGloves) {
    ctx.fillStyle = metalSteel;
    ctx.beginPath();
    ctx.arc(weaponHandX, weaponHandY, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = config.skinColor || '#ffedd5';
    ctx.beginPath();
    ctx.arc(weaponHandX, weaponHandY, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Weapon attachment hilt translation
  ctx.save();
  ctx.translate(weaponHandX, weaponHandY);
  ctx.rotate(swordAngle);

  // Render selection weapon slot
  if (config.equipWeapon === 'sword') {
    // Crossguard
    ctx.fillStyle = capeColor; // Gold metallic highlight
    ctx.fillRect(-1.5, -4, 3, 8);

    // Sword handle grip
    ctx.fillStyle = '#451a03'; // leather hold
    ctx.fillRect(-3, -1, 3, 2);

    // Pommel end bead
    ctx.fillStyle = capeColor;
    ctx.beginPath();
    ctx.arc(-3.5, 0, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Massive blade length multiplier
    const baseBladeLen = 19 * swordYScale;
    ctx.fillStyle = metalSteel;
    ctx.beginPath();
    ctx.moveTo(1.5, -2);
    ctx.lineTo(baseBladeLen + 1.5, -1.2);
    ctx.lineTo(baseBladeLen + 4, 0); // sharp edge tip
    ctx.lineTo(baseBladeLen + 1.5, 1.2);
    ctx.lineTo(1.5, 2);
    ctx.closePath();
    ctx.fill();

    // Highlight blade steel spine
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(1.5, 0);
    ctx.lineTo(baseBladeLen + 2.5, 0);
    ctx.stroke();

  } else if (config.equipWeapon === 'bow') {
    // Beautiful Archer Bow
    ctx.strokeStyle = '#92400e'; // Wooden limb core
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(2.5, 0, 13 * config.tailLength, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    // Bow string
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(2.5, -13 * config.tailLength);
    ctx.lineTo(2.5, 13 * config.tailLength);
    ctx.stroke();

  } else if (config.equipWeapon === 'staff') {
    // High Wizard Staff
    ctx.strokeStyle = '#542d13'; // Ornate mahogany wood
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-11 * config.tailLength, 0);
    ctx.lineTo(14 * config.tailLength, 0);
    ctx.stroke();

    // Floating gem glow
    ctx.fillStyle = config.eyeColor || '#38bdf8';
    ctx.beginPath();
    ctx.arc(14 * config.tailLength + 1, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Crystal center shimmer
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(14 * config.tailLength + 2.2, -0.8, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // Weapon done
  ctx.restore(); // Front arm done
  ctx.restore(); // General context restored
}

/**
 * Renders a customizable physical leg
 */
function drawWarriorLeg(
  ctx: CanvasRenderingContext2D,
  lx: number,
  ly: number,
  swingAngle: number,
  config: WolfConfig,
  isBackLeg: boolean = false,
  isDwarf: boolean = false
) {
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(swingAngle);

  const skin = config.skinColor || '#fbcfe8';
  const underwear = config.underwearColor || '#3b82f6';
  const plateColor = isBackLeg ? darkenColor(config.primaryColor, 0.25) : config.primaryColor;
  const bootColor = isBackLeg ? darkenColor(config.accentColor, 0.25) : config.accentColor;

  const legHScale = isDwarf ? 0.62 : 1.0;

  // 1. Draw thigh physical (Skin layer)
  ctx.strokeStyle = skin;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 7 * legHScale);
  ctx.stroke();

  // Highlight thigh skin with underpants trim at very top
  ctx.strokeStyle = underwear;
  ctx.lineWidth = 4.0;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 3 * legHScale);
  ctx.stroke();

  // Overlap cuisses plate armor if equipped
  if (config.equipChestplate) {
    ctx.strokeStyle = plateColor;
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 6.5 * legHScale);
    ctx.stroke();
  }

  // 2. Knee plate ball vs plain skin knee
  const kneeY = 7 * legHScale;
  if (config.equipBoots) {
    ctx.fillStyle = bootColor;
    ctx.beginPath();
    ctx.arc(0, kneeY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, kneeY, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Calf greave armor vs bare skin
  const calfEndY = 13 * legHScale;
  if (config.equipBoots) {
    ctx.strokeStyle = plateColor;
    ctx.lineWidth = 3.3;
    ctx.beginPath();
    ctx.moveTo(0, kneeY);
    ctx.lineTo(0, calfEndY);
    ctx.stroke();

    // Heavy foot steel sabaton boot
    ctx.fillStyle = bootColor;
    ctx.beginPath();
    ctx.ellipse(1, calfEndY, 3.8, 2.2, 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = skin;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, kneeY);
    ctx.lineTo(0, calfEndY);
    ctx.stroke();

    // Bare foot flesh
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(0.6, calfEndY, 2.8, 1.8, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Shorthand hex color darkener
 */
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
