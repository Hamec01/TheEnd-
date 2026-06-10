const CANVAS_W = 1280;
const CANVAS_H = 720;

type GameStage = 'INIT' | 'BELLOWS' | 'STRIKING' | 'EVENTS' | 'QUENCHING' | 'FINISHING' | 'RESULTS';
type StrikeZone = 'left' | 'center' | 'right';
type QuenchFluid = 'water' | 'oil';

interface GameState {
  heat: number;
  shape: number;
  quality: number;
  defects: number;
  tension: number;
  progress: number;
  stage: GameStage;
}

interface ForgeEvent {
  title: string;
  description: string;
  onFix: () => void;
  onIgnore: () => void;
}

interface SpriteSlot {
  x: number;
  y: number;
  maxW: number;
  maxH: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
}

interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Спрайты лежат в корне папки рядом с index.html */
const SPRITE_FILES = {
  bg: 'bg.png',
  furnace: 'furnace.png',
  bellows: 'bellows.png',
  anvil: 'anvil.png',
  tub: 'tub.png',
} as const;

const SPRITE_SLOTS: Record<keyof typeof SPRITE_FILES, SpriteSlot> = {
  bg: { x: 0, y: 0, maxW: CANVAS_W, maxH: CANVAS_H },
  furnace: { x: 40, y: 250, maxW: 300, maxH: 360 },
  bellows: { x: 300, y: 410, maxW: 150, maxH: 150 },
  anvil: { x: 430, y: 330, maxW: 360, maxH: 280 },
  tub: { x: 840, y: 400, maxW: 300, maxH: 220 },
};

const BELLOWS_HIT: LayoutRect = { x: 300, y: 410, w: 150, h: 150 };
const ANVIL_HIT: LayoutRect = { x: 500, y: 380, w: 280, h: 150 };
const STRIKE_ZONE_X: Record<StrikeZone, number> = { left: 540, center: 640, right: 740 };

const STAGE1_MAX_MS = 12_000;
const MIN_FORGE_HEAT = 55;
const STRIKE_COOLDOWN_MS = 250;

class GameAssets {
  private readonly images = new Map<string, HTMLImageElement>();
  private loadedCount = 0;
  private totalCount = 0;
  onAllLoaded: () => void = () => {};

  load(name: string, src: string): void {
    this.totalCount += 1;
    const img = new Image();
    img.src = src;
    const done = () => {
      this.loadedCount += 1;
      if (this.loadedCount >= this.totalCount) {
        this.onAllLoaded();
      }
    };
    img.onload = done;
    img.onerror = () => {
      console.warn(`[forge] sprite "${name}" not found at ${src}, using canvas fallback`);
      done();
    };
    this.images.set(name, img);
  }

  get(name: string): HTMLImageElement | null {
    const img = this.images.get(name);
    if (img?.complete && img.naturalWidth > 0) {
      return img;
    }
    return null;
  }
}

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing #${id} in index.html`);
  }
  return el as T;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pointInRect(x: number, y: number, rect: LayoutRect): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function startForgeGame(ctx: CanvasRenderingContext2D): void {
  const hudHeat = requireElement<HTMLElement>('hud-heat');
  const hudShape = requireElement<HTMLElement>('hud-shape');
  const hudQuality = requireElement<HTMLElement>('hud-quality');
  const hudDefects = requireElement<HTMLElement>('hud-defects');
  const hudProgress = requireElement<HTMLElement>('hud-progress');
  const eventOverlay = requireElement<HTMLElement>('event-overlay');
  const quenchOverlay = requireElement<HTMLElement>('quench-overlay');
  const finishOverlay = requireElement<HTMLElement>('finish-overlay');
  const resultOverlay = requireElement<HTMLElement>('result-overlay');

  const assets = new GameAssets();
  for (const [name, file] of Object.entries(SPRITE_FILES)) {
    assets.load(name, file);
  }

  const state: GameState = {
    heat: 20,
    shape: 0,
    quality: 50,
    defects: 0,
    tension: 10,
    progress: 0,
    stage: 'INIT',
  };

  let stageTimer = 0;
  let activeStrikeZone: StrikeZone = 'center';
  let lastStrikeTime = 0;
  let bellowsScale = 1;
  let sliderPos = 0;
  let sliderDirection = 1;
  let selectedFluid: QuenchFluid | null = null;
  let finishPointsLeft = 3;
  let finishChoices = { balance: 0, polish: 0, sharpen: 0 };
  let particles: Particle[] = [];

  function spawnSparks(x: number, y: number, count = 12): void {
    for (let i = 0; i < count; i += 1) {
      const green = Math.floor(Math.random() * 150) + 100;
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.9) * 11,
        alpha: 1,
        size: Math.random() * 4 + 2,
        color: `rgba(255, ${green}, 0, `,
      });
    }
  }

  function spawnSteam(x: number, y: number, count = 18): void {
    for (let i = 0; i < count; i += 1) {
      particles.push({
        x: x + (Math.random() - 0.5) * 90,
        y,
        vx: (Math.random() - 0.5) * 2.5,
        vy: -Math.random() * 4 - 1.5,
        alpha: 0.85,
        size: Math.random() * 14 + 8,
        color: 'rgba(220, 225, 235, ',
      });
    }
  }

  function updateParticles(dt: number): void {
    const fade = 0.02 * (dt / 16.67);
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= fade;
      if (p.alpha <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function getQualityTier(score: number): { tier: string; color: string } {
    if (state.defects >= 70) return { tier: 'Брак (Металлолом)', color: '#ff4444' };
    if (state.defects >= 45) return { tier: 'Деформированная пластина', color: '#ffaa44' };
    if (score < 40) return { tier: 'Хлам (Грубая работа)', color: '#9d9d9d' };
    if (score < 65) return { tier: 'Обычное качество', color: '#ffffff' };
    if (score < 80) return { tier: 'Редкое изделие', color: '#0070dd' };
    if (score < 92) return { tier: 'Мастерская ковка', color: '#a335ee' };
    return { tier: 'Легендарное оружие', color: '#ff8000' };
  }

  function calculateFinalScore(): number {
    const heatControl = Math.max(0, 20 - Math.abs(state.heat - 75));
    const defectPenalty = state.defects * 1.5;
    const quenchScore = (selectedFluid === 'water' ? 25 : 12) * (1 - Math.abs(sliderPos - 0.5) * 2);
    const finishBonus = (finishChoices.balance + finishChoices.polish + finishChoices.sharpen) * 8;
    return Math.max(0, Math.floor(heatControl + state.shape + quenchScore + finishBonus - defectPenalty));
  }

  function setStage(newStage: GameStage): void {
    state.stage = newStage;
    stageTimer = 0;

    eventOverlay.classList.remove('active');
    quenchOverlay.classList.remove('active');
    finishOverlay.classList.remove('active');
    resultOverlay.classList.remove('active');

    if (newStage === 'BELLOWS') {
      state.heat = 20;
      state.progress = 0;
    } else if (newStage === 'STRIKING') {
      state.progress = state.shape;
      activeStrikeZone = 'center';
    } else if (newStage === 'EVENTS') {
      triggerRandomEvent();
    } else if (newStage === 'QUENCHING') {
      sliderPos = 0;
      sliderDirection = 1;
      quenchOverlay.classList.add('active');
    } else if (newStage === 'FINISHING') {
      finishPointsLeft = 3;
      requireElement<HTMLElement>('finish-points').innerText = String(finishPointsLeft);
      finishOverlay.classList.add('active');
    } else if (newStage === 'RESULTS') {
      showResults();
    }
  }

  function triggerRandomEvent(): void {
    const events: ForgeEvent[] = [
      {
        title: 'Обнаружена трещина!',
        description: 'На клинке проявилось слабое место. Исправить дефект или ковать дальше?',
        onFix: () => {
          state.defects = Math.max(0, state.defects - 15);
          state.heat = Math.max(10, state.heat - 10);
          setStage('QUENCHING');
        },
        onIgnore: () => {
          state.defects += 20;
          state.tension += 15;
          setStage('QUENCHING');
        },
      },
      {
        title: 'Шлаковая жила',
        description: 'Внутри полосы скопился шлак. Требуется локальный перегрев и чистка.',
        onFix: () => {
          state.quality = Math.min(100, state.quality + 10);
          state.heat = Math.max(10, state.heat - 15);
          setStage('QUENCHING');
        },
        onIgnore: () => {
          state.quality = Math.max(0, state.quality - 15);
          state.defects += 10;
          setStage('QUENCHING');
        },
      },
    ];

    const randomEvent = events[Math.floor(Math.random() * events.length)];
    requireElement<HTMLElement>('event-title').innerText = randomEvent.title;
    requireElement<HTMLElement>('event-desc').innerText = randomEvent.description;
    eventOverlay.classList.add('active');
    requireElement<HTMLButtonElement>('btn-fix').onclick = () => randomEvent.onFix();
    requireElement<HTMLButtonElement>('btn-ignore').onclick = () => randomEvent.onIgnore();
  }

  requireElement<HTMLButtonElement>('btn-quench-water').onclick = () => {
    selectedFluid = 'water';
    quenchOverlay.classList.remove('active');
  };
  requireElement<HTMLButtonElement>('btn-quench-oil').onclick = () => {
    selectedFluid = 'oil';
    quenchOverlay.classList.remove('active');
  };

  function updateFinishPoints(): void {
    requireElement<HTMLElement>('finish-points').innerText = String(finishPointsLeft);
    if (finishPointsLeft <= 0) {
      setStage('RESULTS');
    }
  }

  requireElement<HTMLButtonElement>('btn-finish-balance').onclick = () => {
    if (finishPointsLeft <= 0) return;
    finishChoices.balance += 1;
    finishPointsLeft -= 1;
    updateFinishPoints();
  };
  requireElement<HTMLButtonElement>('btn-finish-polish').onclick = () => {
    if (finishPointsLeft <= 0) return;
    finishChoices.polish += 1;
    finishPointsLeft -= 1;
    updateFinishPoints();
  };
  requireElement<HTMLButtonElement>('btn-finish-sharpen').onclick = () => {
    if (finishPointsLeft <= 0) return;
    finishChoices.sharpen += 1;
    finishPointsLeft -= 1;
    updateFinishPoints();
  };

  function showResults(): void {
    const score = calculateFinalScore();
    const result = getQualityTier(score);
    const titleEl = requireElement<HTMLElement>('result-title');
    const descEl = requireElement<HTMLElement>('result-desc');
    const gradeEl = requireElement<HTMLElement>('result-grade');

    if (state.defects >= 70) {
      titleEl.innerText = 'Клинок разрушен!';
      descEl.innerText = 'Металл не выдержал закалку. Получен металлолом.';
      gradeEl.innerText = result.tier;
      gradeEl.style.color = result.color;
    } else {
      titleEl.innerText = 'Оружие выковано!';
      descEl.innerText = `Нагрев: ${Math.floor(state.heat)}% | Форма: ${state.shape}%\nДефекты: ${state.defects}% | Качество: ${state.quality}%`;
      gradeEl.innerText = `Результат: ${result.tier} (${score} очков)`;
      gradeEl.style.color = result.color;
    }
    resultOverlay.classList.add('active');
  }

  requireElement<HTMLButtonElement>('btn-restart').onclick = () => {
    state.heat = 20;
    state.shape = 0;
    state.quality = 50;
    state.defects = 0;
    state.tension = 10;
    state.progress = 0;
    finishChoices = { balance: 0, polish: 0, sharpen: 0 };
    selectedFluid = null;
    particles = [];
    setStage('BELLOWS');
  };

  function pumpBellows(): void {
    state.heat = Math.min(100, state.heat + 10);
    bellowsScale = 0.82;
    spawnSparks(190, 470, 6);
    state.progress = Math.min(100, (state.heat / MIN_FORGE_HEAT) * 100);
    if (state.heat >= MIN_FORGE_HEAT) {
      setStage('STRIKING');
    }
  }

  function handleStrike(zone: StrikeZone): void {
    const now = performance.now();
    if (now - lastStrikeTime < STRIKE_COOLDOWN_MS) return;
    lastStrikeTime = now;

    spawnSparks(STRIKE_ZONE_X[zone], 420, 14);

    if (zone === activeStrikeZone) {
      if (state.heat >= 60 && state.heat <= 85) {
        state.shape = Math.min(100, state.shape + 15);
        state.quality = Math.min(100, state.quality + 5);
      } else if (state.heat < 50) {
        state.shape = Math.min(100, state.shape + 2);
        state.defects = Math.min(100, state.defects + 5);
      } else {
        state.shape = Math.min(100, state.shape + 10);
        state.defects = Math.min(100, state.defects + 8);
      }
    } else {
      state.defects = Math.min(100, state.defects + 12);
    }

    state.progress = state.shape;
    const zones: StrikeZone[] = ['left', 'center', 'right'];
    activeStrikeZone = zones[Math.floor(Math.random() * zones.length)];

    if (state.progress >= 100) {
      setStage('EVENTS');
    }
  }

  function performQuench(): void {
    const deviation = Math.abs(sliderPos - 0.5);
    spawnSteam(990, 500, 36);

    if (selectedFluid === 'water') {
      if (deviation > 0.15) {
        state.defects += 35;
        state.tension += 40;
      } else {
        state.quality = Math.min(100, state.quality + 20);
      }
    } else if (deviation > 0.15) {
      state.defects += 12;
    } else {
      state.quality = Math.min(100, state.quality + 10);
    }

    setStage('FINISHING');
  }

  function handleActionInput(): void {
    if (state.stage === 'BELLOWS') {
      pumpBellows();
    } else if (state.stage === 'STRIKING') {
      handleStrike(activeStrikeZone);
    } else if (state.stage === 'QUENCHING' && selectedFluid) {
      performQuench();
    }
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      handleActionInput();
    }
  });

  const canvas = requireElement<HTMLCanvasElement>('gameCanvas');
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = (event.clientX - rect.left) * (CANVAS_W / rect.width);
    const clickY = (event.clientY - rect.top) * (CANVAS_H / rect.height);

    if (state.stage === 'BELLOWS' && pointInRect(clickX, clickY, BELLOWS_HIT)) {
      pumpBellows();
      return;
    }

    if (state.stage === 'STRIKING' && pointInRect(clickX, clickY, ANVIL_HIT)) {
      let hitZone: StrikeZone = 'center';
      if (clickX < STRIKE_ZONE_X.center - 50) hitZone = 'left';
      else if (clickX > STRIKE_ZONE_X.center + 50) hitZone = 'right';
      handleStrike(hitZone);
      return;
    }

    if (state.stage === 'QUENCHING' && selectedFluid) {
      performQuench();
    }
  });

  function drawSprite(name: keyof typeof SPRITE_FILES, fallback: () => void): void {
    const slot = SPRITE_SLOTS[name];
    const img = assets.get(name);
    if (!img) {
      fallback();
      return;
    }
    const scale = Math.min(slot.maxW / img.naturalWidth, slot.maxH / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const x = slot.x + (slot.maxW - w) / 2;
    const y = slot.y + (slot.maxH - h) / 2;
    ctx.drawImage(img, x, y, w, h);
  }

  function drawBgFallback(): void {
    ctx.fillStyle = '#221a15';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#15110e';
    ctx.fillRect(0, 580, CANVAS_W, 140);
  }

  function drawFurnaceFallback(): void {
    const slot = SPRITE_SLOTS.furnace;
    ctx.fillStyle = '#5c2c16';
    ctx.fillRect(slot.x + 20, slot.y + 40, slot.maxW - 40, slot.maxH - 50);
    const gradient = ctx.createRadialGradient(slot.x + 130, slot.y + 220, 10, slot.x + 130, slot.y + 220, 90);
    const fire = Math.floor(state.heat * 2.5);
    gradient.addColorStop(0, `rgb(255, ${Math.min(255, fire + 50)}, 0)`);
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(slot.x + 130, slot.y + 220, 80, 0, Math.PI, true);
    ctx.closePath();
    ctx.fill();
  }

  function drawBellowsFallback(): void {
    const slot = SPRITE_SLOTS.bellows;
    ctx.save();
    ctx.translate(slot.x + slot.maxW / 2, slot.y + slot.maxH / 2);
    ctx.scale(1, bellowsScale);
    ctx.fillStyle = '#8b5a2b';
    ctx.beginPath();
    ctx.moveTo(-45, 35);
    ctx.lineTo(45, 35);
    ctx.lineTo(0, -55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawAnvilFallback(): void {
    const slot = SPRITE_SLOTS.anvil;
    const cx = slot.x + slot.maxW / 2;
    const top = slot.y + 90;
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(cx - 110, top + 90);
    ctx.lineTo(cx + 110, top + 90);
    ctx.lineTo(cx + 95, top + 20);
    ctx.lineTo(cx + 55, top + 20);
    ctx.lineTo(cx + 35, top + 45);
    ctx.lineTo(cx - 35, top + 45);
    ctx.lineTo(cx - 55, top + 20);
    ctx.lineTo(cx - 95, top + 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  function drawTubFallback(): void {
    const slot = SPRITE_SLOTS.tub;
    ctx.fillStyle = '#553311';
    ctx.fillRect(slot.x + 10, slot.y + 50, slot.maxW - 20, slot.maxH - 60);
    ctx.fillStyle = selectedFluid === 'oil' ? '#5a4f37' : '#1d425c';
    ctx.fillRect(slot.x + 25, slot.y + 60, slot.maxW - 50, 35);
  }

  function drawBladeOnAnvil(): void {
    ctx.save();
    ctx.translate(520, 420);
    const heatColor = `rgb(255, ${Math.max(0, Math.floor(state.heat * 2.5 - 100))}, 0)`;
    ctx.shadowBlur = state.heat / 3;
    ctx.shadowColor = heatColor;
    ctx.fillStyle = state.heat < 30 ? '#444' : heatColor;
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(180, 5);
    ctx.lineTo(210, 0);
    ctx.lineTo(180, -5);
    ctx.lineTo(0, -5);
    ctx.closePath();
    ctx.fill();

    if (state.defects > 15) {
      ctx.strokeStyle = '#ff3300';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(50, -3);
      ctx.lineTo(55, 3);
      ctx.lineTo(60, -2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStrikeHint(): void {
    const zoneX = STRIKE_ZONE_X[activeStrikeZone];
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#d4af37';
    ctx.fillStyle = 'rgba(212, 175, 55, 0.22)';
    ctx.beginPath();
    ctx.arc(zoneX, 420, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f0d070';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('УДАР', zoneX, 426);
    ctx.restore();
  }

  function drawQuenchMinigame(): void {
    const barX = 440;
    const barY = 250;
    const barW = 400;
    const barH = 30;

    ctx.fillStyle = '#222';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#8a2b2b';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(barX + barW * 0.25, barY, barW * 0.5, barH);
    ctx.fillStyle = '#2b8a2b';
    ctx.fillRect(barX + barW * 0.42, barY, barW * 0.16, barH);

    const curX = barX + barW * sliderPos;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(curX, barY - 10);
    ctx.lineTo(curX, barY + barH + 10);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Пробел или клик в зелёной зоне!', CANVAS_W / 2, 220);
  }

  function drawStageHint(): void {
    if (state.stage === 'BELLOWS') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(280, 580, 720, 48);
      ctx.fillStyle = '#f5e6b8';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Кликайте по мехам или жмите ПРОБЕЛ, пока накал не достигнет 55%', CANVAS_W / 2, 610);
    } else if (state.stage === 'STRIKING') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(280, 580, 720, 48);
      ctx.fillStyle = '#f5e6b8';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Бейте в подсвеченную зону. Температура 60–85% — идеально.', CANVAS_W / 2, 610);
    }
  }

  function updateHUD(): void {
    hudHeat.innerText = `${Math.floor(state.heat)}%`;
    hudShape.innerText = `${state.shape}%`;
    hudQuality.innerText = `${state.quality}%`;
    hudDefects.innerText = `${Math.floor(state.defects)}%`;
    hudProgress.innerText = `${Math.floor(state.progress)}%`;
  }

  function update(dt: number): void {
    stageTimer += dt;

    if (state.stage === 'BELLOWS') {
      state.heat = Math.max(0, state.heat - 0.003 * dt);
      state.progress = Math.min(100, (state.heat / MIN_FORGE_HEAT) * 100);
      if (stageTimer >= STAGE1_MAX_MS) {
        setStage('STRIKING');
      }
    } else if (state.stage === 'STRIKING') {
      state.heat = Math.max(0, state.heat - 0.004 * dt);
      if (state.heat > 88) {
        state.defects = Math.min(100, state.defects + 0.008 * dt);
      }
    } else if (state.stage === 'QUENCHING' && selectedFluid) {
      const step = 0.0009 * dt;
      sliderPos += sliderDirection * step;
      if (sliderPos >= 1 || sliderPos <= 0) {
        sliderDirection *= -1;
        sliderPos = clamp(sliderPos, 0, 1);
      }
    }

    if (bellowsScale < 1) {
      bellowsScale = Math.min(1, bellowsScale + 0.0008 * dt);
    }

    updateParticles(dt);
    updateHUD();
  }

  function draw(): void {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    drawSprite('bg', drawBgFallback);
    drawSprite('furnace', drawFurnaceFallback);
    drawSprite('anvil', drawAnvilFallback);
    drawSprite('bellows', drawBellowsFallback);
    drawSprite('tub', drawTubFallback);

    if (state.stage === 'BELLOWS' || state.stage === 'STRIKING') {
      drawBladeOnAnvil();
    }

    if (state.stage === 'STRIKING') {
      drawStrikeHint();
    }

    if (state.stage === 'QUENCHING' && selectedFluid) {
      drawQuenchMinigame();
    }

    particles.forEach((p) => {
      ctx.fillStyle = `${p.color}${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    drawStageHint();
  }

  let lastTime = 0;
  function gameLoop(time: number): void {
    if (lastTime === 0) lastTime = time;
    const dt = Math.min(50, time - lastTime);
    lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
  }

  assets.onAllLoaded = () => {
    setStage('BELLOWS');
    requestAnimationFrame(gameLoop);
  };
}

window.addEventListener('DOMContentLoaded', () => {
  const canvas = requireElement<HTMLCanvasElement>('gameCanvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }
  startForgeGame(ctx);
});
