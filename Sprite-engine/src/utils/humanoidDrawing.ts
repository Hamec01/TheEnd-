import { WolfConfig } from '../types';

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

/**
 * Procedural Vector Humanoid Drawing System
 */
export function drawHumanoid(
  ctx: CanvasRenderingContext2D,
  config: WolfConfig,
  animationType: string,
  frame: number,
  cx: number, // Center X
  cy: number, // Center Y (ground level)
  flipX: boolean = false
) {
  ctx.save();

  // 1. Resolve Colors and Theme based on configuration
  const primaryColor = config.primaryColor || '#c21e1e';  // Cloak/plate base
  const secondaryColor = config.secondaryColor || '#ecc94b'; // Trim/capes/hair secondary
  const accentColor = config.accentColor || '#94a3b8';   // Weapons metals
  const eyeColor = config.eyeColor || '#38bdf8';

  const shadowPrimary = darkenColor(primaryColor, 0.25);
  const shadowSecondary = darkenColor(secondaryColor, 0.25);
  const shadowAccent = darkenColor(accentColor, 0.25);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Apply master scale and translation
  ctx.translate(cx, cy);

  if (flipX) {
    ctx.scale(-1, 1);
  }

  // Define anatomy sliders or fallbacks
  const bodyHeight = config.bodyHeight !== undefined ? config.bodyHeight : 1.0; // 0.6 to 1.4
  const armSize = config.armSize !== undefined ? config.armSize : 1.0;       // 0.6 to 1.5
  const bellySize = config.bellySize !== undefined ? config.bellySize : 1.0;     // 0.6 to 1.6
  const masterSize = config.bodySize || 1.0;

  // Resolve humanoid sub-race attributes
  const race = config.humanoidRace || 'human';
  let skinColor = config.skinColor || '#ffedd5';
  let hairColor = config.hairColor || '#eab308';
  let underwearColor = config.underwearColor || '#2563eb';

  // Override attributes dynamically depending on selected sub-race
  if (race === 'orc') {
    skinColor = '#16a34a'; // green
  } else if (race === 'undead') {
    skinColor = '#64748b'; // stone gray blue
  } else if (race === 'vampire') {
    skinColor = '#f1f5f9'; // marble white
    underwearColor = '#7f1d1d'; // dark crimson
  } else if (race === 'skeleton') {
    skinColor = '#f8fafc'; // bone ash white
  }

  const isSkeleton = race === 'skeleton';
  const isDwarf = race === 'dwarf';

  // Scale torso height & stoutness
  const finalTorsoWidth = (isDwarf ? 7.6 : 5.8) * bellySize;
  const finalTorsoHeight = (isDwarf ? 6.0 : 8.0) * bodyHeight;

  // Frame counts mapping
  let frameCount = 6;
  if (animationType === 'walk' || animationType === 'run' || animationType === 'interact' || animationType === 'work') {
    frameCount = 8;
  }

  // --- RENDERING POSES MATH MATRIX ---
  let bodyYBob = -17;
  let bodyRotation = 0;
  let torsoXOffset = 0;

  let angle_front_leg = 0;
  let angle_back_leg = 0;
  let angle_front_arm = 0;
  let angle_back_arm = 0;

  let weaponAngle = -0.3; 
  let shieldGuardOffset = 0;
  let handXOffset = 0;
  let handYOffset = 0;

  // Custom timelines particles
  let particles: Array<{ dx: number; dy: number; r: number; color: string; alpha: number }> = [];

  const cycle = (frame / frameCount) * Math.PI * 2;

  // Render POSES based on general structural state names
  if (animationType === 'idle') {
    const breath = Math.sin(cycle);
    bodyYBob = -17 + breath * 0.8;
    bodyRotation = 0.02 * breath;
    angle_front_leg = 0.08;
    angle_back_leg = -0.12;
    angle_front_arm = 0.4 + breath * 0.04;
    angle_back_arm = -0.2 - breath * 0.04;
    weaponAngle = -0.2;
  } else if (animationType === 'walk') {
    bodyYBob = -17 + Math.sin(cycle * 2) * 1.0;
    bodyRotation = Math.cos(cycle) * 0.04;
    angle_front_leg = Math.sin(cycle) * 0.48;
    angle_back_leg = -Math.sin(cycle) * 0.48;
    angle_front_arm = -Math.sin(cycle) * 0.35 + 0.35;
    angle_back_arm = Math.sin(cycle) * 0.35 - 0.2;
    weaponAngle = -0.1 + Math.sin(cycle) * 0.12;
  } else if (animationType === 'run') {
    bodyYBob = -17 + Math.sin(cycle * 2) * 2.2;
    bodyRotation = 0.16 + Math.cos(cycle * 2) * 0.04;
    torsoXOffset = 2.4;
    angle_front_leg = Math.sin(cycle) * 0.78;
    angle_back_leg = -Math.sin(cycle) * 0.78;
    angle_front_arm = 0.8 + Math.sin(cycle) * 0.3;
    angle_back_arm = -0.5 + Math.cos(cycle) * 0.3;
    weaponAngle = -0.4 + Math.sin(cycle) * 0.2;
  } else if (animationType === 'jump') {
    const t = frame % 6;
    if (t === 0) {
      bodyYBob = -11; 
      angle_front_leg = 0.6; angle_back_leg = -0.5;
      angle_front_arm = 0.9; angle_back_arm = -0.5;
      weaponAngle = -0.9;
    } else if (t === 1 || t === 2) {
      bodyYBob = -27 - (t === 2 ? 6 : 0);
      angle_front_leg = -0.3; angle_back_leg = 0.3;
      angle_front_arm = -0.5; angle_back_arm = -1.1;
      weaponAngle = 0.4;
    } else if (t === 3 || t === 4) {
      bodyYBob = -20 + (t === 4 ? 4 : 0);
      angle_front_leg = 0.3; angle_back_leg = 0.4;
      angle_front_arm = 0.7; angle_back_arm = -0.3;
      weaponAngle = -0.5;
    } else {
      bodyYBob = -14;
      angle_front_leg = 0.5; angle_back_leg = -0.3;
      angle_front_arm = 0.2; angle_back_arm = -0.1;
    }
  } else if (animationType === 'roll') {
    const p = frame / 5;
    const rAngle = p * Math.PI * 2;
    bodyYBob = -11 + Math.sin(p * Math.PI) * 4;
    torsoXOffset = p * 15;
    bodyRotation = rAngle;
    angle_front_leg = 0.9;
    angle_back_leg = -0.9;
    angle_front_arm = -1.2;
    angle_back_arm = -1.2;
    weaponAngle = -0.5;

    particles.push(
      { dx: torsoXOffset - 8, dy: 13, r: Math.random() * 2 + 1, color: '#e2e8f080', alpha: 0.5 },
      { dx: torsoXOffset, dy: 13, r: Math.random() * 3 + 1.5, color: '#94a3b844', alpha: 0.4 }
    );
  } else if (animationType === 'attack' || animationType.startsWith('attack_') || animationType === 'sword_strike' || animationType === 'shoot_bow' || animationType === 'cast_spell' || animationType === 'claws_slash') {
    const t = frame % 6;
    const weaponType = config.equipWeapon || 'sword';

    if (t === 0) {
      bodyYBob = -15;
      bodyRotation = -0.18;
      angle_front_arm = -1.5;
      angle_back_arm = -0.3;
      weaponAngle = 0.8;
    } else if (t === 1) {
      bodyYBob = -13;
      bodyRotation = 0.22;
      torsoXOffset = 6.5;
      angle_front_arm = 0.35;
      angle_back_arm = -0.1;
      weaponAngle = -1.6;

      // Trigger standard attack strike FX dust particles
      for (let i = 0; i < 6; i++) {
        particles.push({
          dx: 16 + i * 4,
          dy: -23 + i * 5,
          r: 3.5 - i * 0.35,
          color: config.fxColor || 'rgba(255, 255, 255, 0.75)',
          alpha: 1.0 - i * 0.15
        });
      }
    } else if (t === 2 || t === 3) {
      bodyYBob = -14;
      bodyRotation = 0.38;
      torsoXOffset = 8.0;
      angle_front_arm = 0.85;
      angle_back_arm = -0.4;
      weaponAngle = -1.9;

      particles.push(
        { dx: 24, dy: -3, r: 2.2, color: config.fxColor || '#ecc94b', alpha: 0.9 },
        { dx: 21, dy: 2, r: 1.8, color: '#ffffff', alpha: 1.0 }
      );
    } else {
      bodyYBob = -16;
      bodyRotation = 0.1;
      torsoXOffset = 2.5;
      angle_front_arm = 0.2;
      angle_back_arm = -0.2;
      weaponAngle = -0.4;
    }
  } else if (animationType === 'defense' || animationType.startsWith('block_') || animationType === 'shield_block' || animationType === 'shield_barrier' || animationType === 'roar_buff') {
    bodyYBob = -13;
    bodyRotation = 0.05;
    torsoXOffset = -1;
    angle_front_leg = 0.38;
    angle_back_leg = -0.48;
    angle_front_arm = -0.1;
    angle_back_arm = 0.75;
    shieldGuardOffset = 2.5 + Math.sin(cycle) * 3;
    weaponAngle = 0.55;

    if (frame === 1 || frame === 2) {
      particles.push(
        { dx: 18, dy: -10, r: 2.5, color: '#60a5fa', alpha: 0.8 },
        { dx: 15, dy: -6, r: 2.0, color: '#ffffff', alpha: 0.9 }
      );
    }
  } else if (animationType === 'work' || animationType === 'interact') {
    bodyYBob = -13 + Math.cos(cycle) * 1.0;
    bodyRotation = 0.28;
    torsoXOffset = 2;
    angle_front_leg = 0.32;
    angle_back_leg = -0.28;

    const hammerBlow = Math.sin(cycle * 2);
    angle_front_arm = 1.1 + hammerBlow * 0.45;
    angle_back_arm = 0.8 - hammerBlow * 0.15;
    weaponAngle = 0.6 + hammerBlow * 0.35;

    if (frame % 3 === 1) {
      particles.push(
        { dx: 15, dy: 10, r: 2.2, color: '#fbbf24', alpha: 1.0 },
        { dx: 12, dy: 11, r: 1.5, color: '#ffffff', alpha: 0.9 }
      );
    }
  } else if (animationType === 'die') {
    const dProgress = Math.min(frame / 5, 1.0);
    const ease = 1 - Math.pow(1 - dProgress, 2);
    bodyYBob = -17 + ease * 29;
    torsoXOffset = -ease * 15;
    bodyRotation = -ease * Math.PI * 0.45;
    angle_front_leg = -0.4 * (1 - dProgress);
    angle_back_leg = 0.2 * (1 - dProgress);
    angle_front_arm = -1.1 * dProgress;
    angle_back_arm = 0.9 * dProgress;
    weaponAngle = 1.2 * dProgress;
  }

  // Set general scale
  ctx.scale(masterSize, masterSize);

  // Apply visual outline shadow if selected
  if (config.showOutline && config.outlineColor) {
    ctx.shadowColor = config.outlineColor;
    ctx.shadowBlur = 2;
  } else {
    ctx.shadowBlur = 0;
  }

  const tx = torsoXOffset;
  const ty = bodyYBob;

  // --- DRAW TIMELINE PARTICLES ---
  particles.forEach(p => {
    ctx.save();
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(tx + p.dx, 15 + p.dy, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // --- RENDERING LAYERS FROM BACK TO FRONT ---
  const drawCape = () => {
    if (config.equipChestplate && !isSkeleton) {
      ctx.save();
      ctx.translate(tx - 6, ty + 2);
      let capeWave = Math.sin(cycle + 1) * 0.12;
      if (animationType === 'run') capeWave = 0.38 + Math.sin(frame * 0.5) * 0.2;
      if (animationType === 'roll') capeWave = -1.0;
      if (animationType === 'die') capeWave = -0.8;
      ctx.rotate(-0.15 + capeWave);

      // Deep background cape fabric
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-15, -4, -19 * config.tailLength, 15, -12 * config.tailLength, 23);
      ctx.lineTo(-4, 20);
      ctx.closePath();
      ctx.fill();

      // Dark shading accent rim on cape fold
      ctx.fillStyle = shadowPrimary;
      ctx.beginPath();
      ctx.moveTo(-1.5, 1);
      ctx.bezierCurveTo(-11, 1, -15 * config.tailLength, 16, -10 * config.tailLength, 21);
      ctx.lineTo(-3, 19);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };

  const drawBackLeg = () => {
    // 2. BACK LEG
    drawHumanoidLeg(ctx, tx - 4, ty + 12, angle_back_leg, config, skinColor, underwearColor, isSkeleton, isDwarf, bodyHeight, true);
  };

  const drawTorso = () => {
    // 3. MAIN TORSO
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(bodyRotation);

    if (isSkeleton) {
      // RIB CAGE BONE SYSTEM
      ctx.strokeStyle = skinColor;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(0, 9); // spine
      ctx.stroke();

      ctx.lineWidth = 1.8;
      // draw rib hoops
      for (let rY = -1; rY <= 6; rY += 2.2) {
        ctx.beginPath();
        ctx.ellipse(0, rY, 3.8 * bellySize, 1.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // Solid flesh torso block
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.ellipse(0, 4, finalTorsoWidth, finalTorsoHeight, 0, 0, Math.PI * 2);
      ctx.fill();

      // Stout / wide chest shading details for Orc or bulkier builds
      if (race === 'orc') {
        ctx.fillStyle = darkenColor(skinColor, 0.15);
        ctx.beginPath();
        ctx.ellipse(-1.5, 2, 2.5, 3.5, 0.05, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cute underwear trunks
      ctx.fillStyle = underwearColor;
      ctx.beginPath();
      ctx.ellipse(0, finalTorsoHeight / 2 + 3.4, finalTorsoWidth - 0.4, 3.0, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw equipped Plate Chestplate armor
    if (config.equipChestplate) {
      ctx.fillStyle = '#2d3748'; // leather underlying structure
      ctx.beginPath();
      ctx.ellipse(0, 4, finalTorsoWidth + 0.8, finalTorsoHeight + 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = primaryColor; // Outer alloy metal
      ctx.beginPath();
      ctx.ellipse(0, 3, finalTorsoWidth + 0.2, finalTorsoHeight, 0, 0, Math.PI * 2);
      ctx.fill();

      // Polished gold crest/trim
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-finalTorsoWidth + 1, 0);
      ctx.bezierCurveTo(-finalTorsoWidth / 2, 4, finalTorsoWidth / 2, 4, finalTorsoWidth - 1, 0);
      ctx.stroke();
    }

    // Draw waist belt
    if (config.equipBelt) {
      ctx.fillStyle = '#542d13'; // brown leather belt straps
      const beltW = finalTorsoWidth + (config.equipChestplate ? 0.9 : 0.3);
      ctx.fillRect(-beltW, finalTorsoHeight / 2 + 2.8, beltW * 2, 2.3);

      ctx.fillStyle = '#ecc94b'; // glowing brass buckle
      ctx.fillRect(-1.5, finalTorsoHeight / 2 + 1.8, 3.0, 4.2);
    }

    ctx.restore(); // Torso restored
  };

  const drawFrontLeg = () => {
    // 4. FRONT LEG
    drawHumanoidLeg(ctx, tx + 3, ty + 12, angle_front_leg, config, skinColor, underwearColor, isSkeleton, isDwarf, bodyHeight, false);
  };

  const drawBackArm = () => {
    // 5. BACK ARM / SHIELD
    ctx.save();
    ctx.translate(tx - 3, ty + 1);
    ctx.rotate(angle_back_arm);

    const backArmLen = (isDwarf ? 5 : 7) * armSize;
    const backArmThick = (isSkeleton ? 1.6 : 3.6) * armSize;

    if (config.equipChestplate && !isSkeleton) {
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(-2, -1, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = backArmThick;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(backArmLen, backArmLen * 0.9);
    ctx.stroke();

    ctx.strokeStyle = skinColor;
    ctx.lineWidth = backArmThick - 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(backArmLen, backArmLen * 0.9);
    ctx.stroke();

    // Glove block
    if (config.equipGloves && !isSkeleton) {
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(backArmLen, backArmLen * 0.9, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(backArmLen, backArmLen * 0.9, 1.8 * armSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render back shield or custom weapon left
    const leftWep = config.equipWeaponLeft || 'none';

    if (config.equipShield || leftWep === 'shield') {
      ctx.save();
      ctx.translate(backArmLen, backArmLen * 0.9 + shieldGuardOffset);
      ctx.scale(config.snoutLength, 1.0);

      // Steel Backing shield rim
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(-5, -6);
      ctx.lineTo(5, -6);
      ctx.lineTo(6, 4);
      ctx.lineTo(0, 11);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fill();

      // Infill team coat
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.moveTo(-3, -4);
      ctx.lineTo(3, -4);
      ctx.lineTo(4, 3);
      ctx.lineTo(0, 8);
      ctx.lineTo(-4, 3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-1, -2, 2, 4);
      ctx.fillRect(-2, -1, 4, 2);
      ctx.restore();
    } else if (leftWep !== 'none' && leftWep !== 'hands') {
      // Draw actual weapon in back hand (dual-wielding)
      ctx.save();
      ctx.translate(backArmLen, backArmLen * 0.9);
      // Give a symmetrical weapon stance angle
      ctx.rotate(-weaponAngle - 0.4);

      if (leftWep === 'sword' || leftWep === 'dagger') {
        const isDagger = leftWep === 'dagger';
        // Crossguard
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(-1, -3, 2, 6);
        
        // Blade
        const bladeLen = (isDagger ? 10 : 16) * config.tailLength;
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(1, -1.2);
        ctx.lineTo(bladeLen + 1, -0.8);
        ctx.lineTo(bladeLen + 2.5, 0); 
        ctx.lineTo(bladeLen + 1, 0.8);
        ctx.lineTo(1, 1.2);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(1, 0);
        ctx.lineTo(bladeLen + 1, 0);
        ctx.stroke();

      } else if (leftWep === 'axe') {
        ctx.strokeStyle = '#542d13';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.lineTo(11 * config.tailLength, 0);
        ctx.stroke();

        const headX = 11 * config.tailLength;
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(headX - 1, -0.8);
        ctx.bezierCurveTo(headX + 1.5, -7, headX + 2.5 * config.tailLength, -10, headX + 5, -9);
        ctx.lineTo(headX + 3.5, -0.8);
        ctx.bezierCurveTo(headX + 3, 4, headX + 2 * config.tailLength, 8, headX + 4, 7);
        ctx.lineTo(headX - 1, 0.8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = secondaryColor;
        ctx.fillRect(headX - 0.8, -1.5, 2, 3);

      } else if (leftWep === 'spear') {
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(19 * config.tailLength, 0);
        ctx.stroke();

        const spTip = 19 * config.tailLength;
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(spTip, -1.8);
        ctx.lineTo(spTip + 2, -0.8);
        ctx.lineTo(spTip + 7, 0);
        ctx.lineTo(spTip + 2, 0.8);
        ctx.lineTo(spTip, 1.8);
        ctx.closePath();
        ctx.fill();

      } else if (leftWep === 'staff') {
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(16 * config.tailLength, 0);
        ctx.stroke();

        const stTip = 16 * config.tailLength;
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.arc(stTip, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.arc(stTip, 0, 1.8, 0, Math.PI * 2);
        ctx.fill();

      } else if (leftWep === 'bow') {
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(2.0, 0, 9 * config.tailLength, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(2.0, -9 * config.tailLength);
        ctx.lineTo(2.0, 9 * config.tailLength);
        ctx.stroke();

      } else if (leftWep === 'halberd') {
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.lineTo(18 * config.tailLength, 0);
        ctx.stroke();

        const tipX = 18 * config.tailLength;
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(tipX, -1.2);
        ctx.lineTo(tipX + 6, 0);
        ctx.lineTo(tipX, 1.2);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(tipX - 3, -0.8);
        ctx.bezierCurveTo(tipX, -5, tipX + 1.5, -6, tipX + 4, -4);
        ctx.lineTo(tipX - 0.8, 0);
        ctx.bezierCurveTo(tipX + 1.5, 3.5, tipX + 0.8, 6, tipX - 3, 0.8);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
    ctx.restore(); // Back arm restored
  };

  const drawHeadPart = () => {
    // 6. HEAD (Includes sub-race ear styles, horns, skulls, beards)
    ctx.save();
    ctx.translate(tx, ty - 5);
    ctx.rotate(bodyRotation * 0.88);

    // Stout Dwarf Braided long beard
    if (isDwarf && !isSkeleton) {
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.moveTo(-5.5, -2);
      ctx.quadraticCurveTo(-9 * config.tailLength, 12 * config.tailLength, -1, 14 * config.tailLength);
      ctx.quadraticCurveTo(1, 14 * config.tailLength, 5 * config.tailLength, 12 * config.tailLength);
      ctx.quadraticCurveTo(8.5, 12, 5.5, -2);
      ctx.closePath();
      ctx.fill();

      // Reddish bulbous dwarf nose
      ctx.fillStyle = darkenColor(skinColor, 0.14);
      ctx.beginPath();
      ctx.arc(1.8, -2.8, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tooth fangs for vampires & orcs
    const drawMouthDetails = () => {
      ctx.fillStyle = '#ffffff';
      if (race === 'orc') {
        // big bottom tusks pointing up
        ctx.beginPath();
        ctx.moveTo(0.5, -1); ctx.lineTo(1.5, -4); ctx.lineTo(2.2, -1); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(3.0, -1); ctx.lineTo(3.8, -3.5); ctx.lineTo(4.4, -1); ctx.closePath(); ctx.fill();
      } else if (race === 'vampire') {
        // small down-pointing dripping fangs
        ctx.beginPath();
        ctx.moveTo(1.2, -3); ctx.lineTo(1.8, -4.8); ctx.lineTo(2.2, -3); ctx.closePath(); ctx.fill();
      }
    };

    // Skeleton skull drawing versus solid flesh head
    if (isSkeleton) {
      // Skull Base
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(0, -4, 4.4, 0, Math.PI * 2);
      ctx.fill();

      // Jaw block underneath
      ctx.fillRect(-2, -1, 3.8, 2);

      // Empty hollow eye sockets
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-1.2, -4.5, 1.1, 0, Math.PI * 2);
      ctx.arc(1.8, -4.5, 1.1, 0, Math.PI * 2);
      ctx.fill();

      // Glimmer of red magical soul light in eyes
      if (animationType !== 'die') {
        ctx.fillStyle = eyeColor;
        ctx.fillRect(1.5, -4.8, 1, 1);
        if (config.eyeGlow) {
          ctx.shadowColor = eyeColor;
          ctx.shadowBlur = 3;
          ctx.fillRect(1.5, -4.8, 1, 1);
          ctx.shadowBlur = 0;
        }
      }

      // nose cavity
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0.2, -2.2); ctx.lineTo(-0.4, -1.2); ctx.lineTo(0.8, -1.2); ctx.closePath(); ctx.fill();

    } else {
      // Normal / fleshy head
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(0, -4, 4.8, 0, Math.PI * 2);
      ctx.fill();

      // Draw fangs / tusks
      drawMouthDetails();

      // Hair cap layer
      if (config.hairStyle !== 'none' && !config.equipHelmet) {
        ctx.fillStyle = hairColor;
        ctx.beginPath();
        ctx.arc(0, -5.2, 5.0, Math.PI, 0); // top volume
        ctx.fill();

        if (config.hairStyle === 'long' || config.hairStyle === 'braids') {
          ctx.fillRect(-5.2, -5.2, 1.5, 8); // drape back hair
          ctx.fillRect(-1.5, -5.2, 1.5, 4); 
        } else if (config.hairStyle === 'crest') {
          // mohawk / warrior crest spike
          ctx.fillRect(-1.5, -11, 3.0, 6);
        }
      }

      // Pointy ears (Elf)
      if (race === 'elf' || config.earSize > 1.2) {
        ctx.save();
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.moveTo(-3, -5.5);
        ctx.lineTo(-10 * config.earSize, -7.5 * config.earSize);
        ctx.lineTo(-4, -1.8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Glares of eyes
      if (animationType !== 'die') {
        ctx.fillStyle = eyeColor;
        ctx.fillRect(1.8, -4.5, 1.4, 1.4);

        if (config.eyeGlow) {
          ctx.shadowColor = eyeColor;
          ctx.shadowBlur = 3.5;
          ctx.fillRect(1.8, -4.5, 1.4, 1.4);
          ctx.shadowBlur = 0;
        }
      } else {
        // dead crosses
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(1.2, -5.2); ctx.lineTo(3.2, -3.2);
        ctx.moveTo(3.2, -5.2); ctx.lineTo(1.2, -3.2);
        ctx.stroke();
      }
    }

    // Draw steel helmet on top
    if (config.equipHelmet) {
      const plumeSize = config.earSize;
      if (plumeSize > 0.4) {
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.moveTo(-4, -4);
        ctx.bezierCurveTo(-14 * plumeSize, -11 * plumeSize, -7 * plumeSize, -16 * plumeSize, -2, -10 * plumeSize);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = primaryColor; // Outer metal
      ctx.beginPath();
      ctx.arc(0, -4.2, 5.4, 0, Math.PI * 2);
      ctx.fill();

      // Dark visor slits
      ctx.fillStyle = shadowPrimary;
      ctx.fillRect(-3, -5.5, 7, 2);
    }

    ctx.restore(); // Head restored
  };

  const drawFrontArm = () => {
    // 7. FRONT FOREARM & CUSTOM VECTOR WEAPONS
    ctx.save();
    ctx.translate(tx + 4, ty + 3);
    ctx.rotate(angle_front_arm);

    const frontArmLen = (isDwarf ? 5 : 7) * armSize;
    const frontArmThick = (isSkeleton ? 1.6 : 3.6) * armSize;

    if (config.equipChestplate && !isSkeleton) {
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = frontArmThick;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(frontArmLen, frontArmLen * 0.7);
    ctx.stroke();

    ctx.strokeStyle = skinColor;
    ctx.lineWidth = frontArmThick - 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(frontArmLen, frontArmLen * 0.7);
    ctx.stroke();

    const handX = frontArmLen;
    const handY = frontArmLen * 0.7;

    // Gauntlet glove
    if (config.equipGloves && !isSkeleton) {
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(handX, handY, 2.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(handX, handY, 1.8 * armSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // WEAPONS BRANCH
    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(weaponAngle);

    const activeWeapon = config.equipWeapon || 'sword';

    if (activeWeapon === 'sword') {
      // Crossguard
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-1.5, -4.5, 3, 9);
      
      // Blade
      const bladeLen = 19 * config.tailLength;
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(1.5, -2);
      ctx.lineTo(bladeLen + 1.5, -1.2);
      ctx.lineTo(bladeLen + 4, 0); 
      ctx.lineTo(bladeLen + 1.5, 1.2);
      ctx.lineTo(1.5, 2);
      ctx.closePath();
      ctx.fill();

      // Blade central spinal highlight
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(1.5, 0);
      ctx.lineTo(bladeLen + 2.0, 0);
      ctx.stroke();

    } else if (activeWeapon === 'axe') {
      // Giant Bearded Axe
      // shaft timber
      ctx.strokeStyle = '#542d13';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(13 * config.tailLength, 0);
      ctx.stroke();

      // Steel double-bearded head
      const headX = 13 * config.tailLength;
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(headX - 1.5, -1.0);
      ctx.bezierCurveTo(headX + 2, -10, headX + 3 * config.tailLength, -14, headX + 7, -12);
      ctx.lineTo(headX + 5, -1);
      ctx.bezierCurveTo(headX + 4, 6, headX + 3 * config.tailLength, 12, headX + 6, 10);
      ctx.lineTo(headX - 1.5, 1.0);
      ctx.closePath();
      ctx.fill();

      // Golden core inlay trim on axe
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(headX - 1, -2, 2.5, 4);

    } else if (activeWeapon === 'halberd') {
      // Royal Polearm Halberd
      ctx.strokeStyle = '#3e2723'; // dark timber pole
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(22 * config.tailLength, 0);
      ctx.stroke();

      const tipX = 22 * config.tailLength;
      // Spear head top spike of halberd
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(tipX, -1.5);
      ctx.lineTo(tipX + 8, 0); // long spike
      ctx.lineTo(tipX, 1.5);
      ctx.closePath();
      ctx.fill();

      // Moon axe blade attached on one side
      ctx.beginPath();
      ctx.moveTo(tipX - 4, -1);
      ctx.bezierCurveTo(tipX, -7, tipX + 2, -9, tipX + 5, -6);
      ctx.lineTo(tipX - 1, 0);
      ctx.bezierCurveTo(tipX + 2, 5, tipX + 1, 8, tipX - 4, 1);
      ctx.closePath();
      ctx.fill();

      // Hook on opposite side
      ctx.beginPath();
      ctx.moveTo(tipX - 5, 0);
      ctx.quadraticCurveTo(tipX - 10, -5, tipX - 8, -4);
      ctx.stroke();

    } else if (activeWeapon === 'spear' || activeWeapon === 'spear_throw') {
      // Clean Steel Javelin / Spear
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(23 * config.tailLength, 0); // long pole
      ctx.stroke();

      const spTip = 23 * config.tailLength;
      // Diamond spear-head
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(spTip, -2.5);
      ctx.lineTo(spTip + 3, -1);
      ctx.lineTo(spTip + 9, 0); // sharp tip
      ctx.lineTo(spTip + 3, 1);
      ctx.lineTo(spTip, 2.5);
      ctx.closePath();
      ctx.fill();

      // Decorative silk ribbon tying spearhead
      ctx.fillStyle = primaryColor;
      ctx.fillRect(spTip - 1.5, -2, 1.8, 4);

    } else if (activeWeapon === 'bow') {
      // Forest Recurve Bow
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(3.0, 0, 13 * config.tailLength, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();

      // Bow bow-string
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(3.0, -13 * config.tailLength);
      ctx.lineTo(3.0, 13 * config.tailLength);
      ctx.stroke();

      // Nocked arrow during attack frames
      if (animationType.includes('attack') || animationType.includes('shoot')) {
        ctx.strokeStyle = '#f59e0b'; // golden shaft
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();

        // arrow crystal tip
        ctx.fillStyle = eyeColor;
        ctx.beginPath();
        ctx.moveTo(8, -1.8); ctx.lineTo(12, 0); ctx.lineTo(8, 1.8); ctx.closePath(); ctx.fill();
      }

    } else if (activeWeapon === 'staff') {
      // Magic twisted mahogany wood staff
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(16 * config.tailLength, 0);
      ctx.stroke();

      // Twisting golden ring holding crystal
      const staffTip = 16 * config.tailLength;
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(staffTip, 0, 4.4, 0, Math.PI * 2);
      ctx.fill();

      // Floating gemstone
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.arc(staffTip, 0, 3.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(staffTip + 1.2, -0.6, 1.0, 0, Math.PI * 2);
      ctx.fill();

    } else if (activeWeapon === 'shield_bash') {
      // Heavy round metal shield extended in weapon grip
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(0, 0, 8.5 * config.snoutLength, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(0, 0, 6.0, 0, Math.PI * 2);
      ctx.fill();

      // Central brass spike
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(0, 0, 2.0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // Weapon restored
    ctx.restore(); // Front arm restored
  };

  const defaultOrder = ['cape', 'back_leg', 'torso', 'front_leg', 'back_arm', 'head', 'front_arm'];
  const activeOrder = config.layerOrder || defaultOrder;

  activeOrder.forEach(layerKey => {
    if (layerKey === 'cape') drawCape();
    else if (layerKey === 'back_leg') drawBackLeg();
    else if (layerKey === 'torso') drawTorso();
    else if (layerKey === 'front_leg') drawFrontLeg();
    else if (layerKey === 'back_arm') drawBackArm();
    else if (layerKey === 'head') drawHeadPart();
    else if (layerKey === 'front_arm') drawFrontArm();
  });

  // --- PROCEDURAL FX TIMELINE OVERLAY GENERATOR ---
  const activeFx = config.fxType || 'none';
  if (activeFx !== 'none') {
    const fxScale = config.fxScale !== undefined ? config.fxScale : 1.0;
    const isTriggerFrame = (config.fxFrame === undefined) || (frame === config.fxFrame);

    if (isTriggerFrame) {
      ctx.save();
      ctx.translate(tx + 12, ty);
      ctx.scale(fxScale, fxScale);

      // Render custom procedural visual vector effects
      if (activeFx === 'fire_slash') {
        // Blazing crescent flame arc
        const gradient = ctx.createRadialGradient(0, 0, 2, 8, -2, 22);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, '#facc15'); // orange-gold
        gradient.addColorStop(0.7, '#ef4444'); // hot red
        gradient.addColorStop(1.0, 'rgba(239, 68, 68, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(2, -22);
        ctx.quadraticCurveTo(15, -4, 18, 12);
        ctx.quadraticCurveTo(10, 2, -2, -10);
        ctx.closePath();
        ctx.fill();

        // flame particles
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.fillStyle = '#ea580c';
          ctx.arc(10 + Math.sin(frame + i) * 6, -10 + i * 8, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (activeFx === 'magic_burst') {
        // Swirling magical rune circles + energy stars
        ctx.strokeStyle = config.eyeColor || '#38bdf8';
        ctx.lineWidth = 1.5;
        // draw concentric magic seals
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.stroke();

        // Spark points
        ctx.fillStyle = '#ffffff';
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          const sx = Math.cos(a + frame * 0.2) * 15;
          const sy = Math.sin(a + frame * 0.2) * 15;
          ctx.beginPath();
          ctx.arc(sx, sy, 2.0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (activeFx === 'lightning_shield') {
        // Glowing electric blue sparks shield
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(-10, 0, 22, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();

        // draw lightning bolts zigzagging
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(-10, -22);
        ctx.lineTo(-5, -10);
        ctx.lineTo(-12, 0);
        ctx.lineTo(-4, 12);
        ctx.lineTo(-10, 22);
        ctx.stroke();
      } else if (activeFx === 'holy_sparkle') {
        // Floating radiant star matrices
        ctx.fillStyle = '#fbbf24';
        for (let j = 0; j < 5; j++) {
          const ox = Math.cos(j * 1.5 + frame) * 18;
          const oy = Math.sin(j * 0.8 - frame) * 18 - 8;
          ctx.save();
          ctx.translate(ox, oy);
          ctx.beginPath();
          ctx.moveTo(0, -4); ctx.lineTo(1, -1); ctx.lineTo(4, 0); ctx.lineTo(1, 1);
          ctx.lineTo(0, 4); ctx.lineTo(-1, 1); ctx.lineTo(-4, 0); ctx.lineTo(-1, -1);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      } else if (activeFx === 'frost_spike') {
        // Sharp icy diamonds
        ctx.fillStyle = '#93c5fd';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.1;
        for (let j = 0; j < 3; j++) {
          ctx.save();
          ctx.translate(14 + j * 6, -11 + j * 9);
          ctx.rotate(0.5);
          ctx.beginPath();
          ctx.moveTo(0, -7); ctx.lineTo(3.5, 0); ctx.lineTo(0, 7); ctx.lineTo(-3.5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      } else if (activeFx === 'shadow_strike') {
        // Deep purple eldritch smoke trails
        ctx.fillStyle = '#701a75';
        for (let j = 0; j < 6; j++) {
          const sx = Math.sin(frame * 0.4 + j) * 8;
          ctx.beginPath();
          ctx.arc(8 + j * 3, -12 + j * 4 + sx, 4 - j * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  ctx.restore(); // Final master canvas restore
}

/**
 * Customizable Physical Leg Engine
 */
function drawHumanoidLeg(
  ctx: CanvasRenderingContext2D,
  lx: number,
  ly: number,
  swingAngle: number,
  config: WolfConfig,
  skinColor: string,
  underwearColor: string,
  isSkeleton: boolean,
  isDwarf: boolean,
  bodyHeight: number,
  isBackLeg: boolean = false
) {
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(swingAngle);

  const plateColor = isBackLeg ? darkenColor(config.primaryColor || '#c21e1e', 0.25) : (config.primaryColor || '#c21e1e');
  const bootColor = isBackLeg ? darkenColor(config.accentColor || '#94a3b8', 0.25) : (config.accentColor || '#94a3b8');

  // Stout dwarves have stubby legs, Skeletons have skinny bones
  const legHScale = (isDwarf ? 0.62 : 1.0) * bodyHeight;
  const thighThick = isSkeleton ? 1.4 : 3.5;

  // 1. Physical thigh (Skin / clothing segment)
  if (!isSkeleton) {
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = thighThick;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 7 * legHScale);
    ctx.stroke();

    // Underpants cuffs at the absolute top of hips
    ctx.strokeStyle = underwearColor;
    ctx.lineWidth = thighThick + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 3 * legHScale);
    ctx.stroke();
  } else {
    // skeletal femur bone
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 7 * legHScale);
    ctx.stroke();

    // bone joint ball
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(0, 0, 2.0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cuisses plate armor overlap
  if (config.equipChestplate && !isSkeleton) {
    ctx.strokeStyle = plateColor;
    ctx.lineWidth = thighThick + 0.9;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 6.5 * legHScale);
    ctx.stroke();
  }

  // 2. Knee joints
  const kneeY = 7 * legHScale;
  if (config.equipBoots && !isSkeleton) {
    ctx.fillStyle = bootColor;
    ctx.beginPath();
    ctx.arc(0, kneeY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(0, kneeY, isSkeleton ? 1.4 : 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Shins/Calfs & boots
  const calfEndY = 13 * legHScale;
  if (config.equipBoots && !isSkeleton) {
    // heavy armor plating greaves
    ctx.strokeStyle = plateColor;
    ctx.lineWidth = thighThick - 0.2;
    ctx.beginPath();
    ctx.moveTo(0, kneeY);
    ctx.lineTo(0, calfEndY);
    ctx.stroke();

    // Steel boot sabaton
    ctx.fillStyle = bootColor;
    ctx.beginPath();
    ctx.ellipse(0.8, calfEndY, 3.8, 2.2, 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Plain flesh limbs or twin bone tibias
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = isSkeleton ? 1.4 : 2.4;
    ctx.beginPath();
    ctx.moveTo(0, kneeY);
    ctx.lineTo(0, calfEndY);
    ctx.stroke();

    // Bare foot flesh or bony pedal digits
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse(0.6, calfEndY, isSkeleton ? 2.2 : 2.8, isSkeleton ? 1.2 : 1.8, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
