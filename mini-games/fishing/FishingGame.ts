export interface FishConfig {
    name: string;
    speed: number;       // Насколько быстро рыба реагирует/двигается (0.01 - 0.2)
    chatter: number;     // Как часто меняет направление (в миллисекундах)
    barSize: number;     // Размер зеленой зоны игрока (меньше = сложнее)
}

export const FISH_PRESETS: Record<string, FishConfig> = {
    easy: { name: "Карась", speed: 0.04, chatter: 1500, barSize: 90 },
    medium: { name: "Окунь", speed: 0.08, chatter: 1000, barSize: 70 },
    hard: { name: "Щука", speed: 0.14, chatter: 500, barSize: 50 }
};

export class FishingGame {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private animationFrameId: number | null = null;
    private isRunning: boolean = false;

    // Настройки физики зеленой зоны (игрока)
    private readonly gravity = 0.3;
    private readonly lift = -0.65;
    private readonly friction = 0.98;

    private barY: number;
    private barHeight: number;
    private barVelocity: number = 0;

    // Настройки рыбы
    private fishY: number;
    private fishTargetY: number;
    private fishTimer: number = 0;
    private readonly fishSize = 16;
    private currentFish: FishConfig;

    // Состояние игры
    private catchProgress: number = 30; // Начинаем с 30% для баланса
    private maxProgress = 100;
    private isSpacePressed = false;

    // Колбэки для интеграции с основной игрой
    public onWin?: (fishName: string) => void;
    public onLose?: () => void;

    constructor(canvasId: string, difficulty: keyof typeof FISH_PRESETS = 'easy') {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.currentFish = FISH_PRESETS[difficulty];

        this.barHeight = this.currentFish.barSize;
        this.barY = this.canvas.height - this.barHeight - 10;
        this.fishY = this.canvas.height / 2;
        this.fishTargetY = this.fishY;

        this.setupInput();
    }

    private setupInput() {
        // Управление как с клавиатуры (Пробел), так и мышкой/тачем (для мобилок)
        const startAction = () => { this.isSpacePressed = true; };
        const endAction = () => { this.isSpacePressed = false; };

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') startAction();
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') endAction();
        });

        this.canvas.addEventListener('mousedown', startAction);
        this.canvas.addEventListener('mouseup', endAction);
        this.canvas.addEventListener('touchstart', startAction);
        this.canvas.addEventListener('touchend', endAction);
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.catchProgress = 30;
        this.loop();
    }

    public stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    private update(deltaTime: number) {
        // 1. Физика зеленой зоны (игрока)
        if (this.isSpacePressed) {
            this.barVelocity += this.lift;
        } else {
            this.barVelocity += this.gravity;
        }

        this.barVelocity *= this.friction;
        this.barY += this.barVelocity;

        // Ограничения для зеленой зоны (чтобы не вылетала за границы шкалы)
        const maxY = this.canvas.height - this.barHeight;
        if (this.barY < 0) {
            this.barY = 0;
            this.barVelocity = 0;
        } else if (this.barY > maxY) {
            this.barY = maxY;
            // Небольшой отскок от дна для реализма физики
            this.barVelocity = -this.barVelocity * 0.25; 
        }

        // 2. ИИ Рыбы (выбор цели и движение к ней)
        this.fishTimer -= deltaTime;
        if (this.fishTimer <= 0) {
            // Рыба выбирает случайную высоту на шкале
            this.fishTargetY = Math.random() * (this.canvas.height - this.fishSize);
            // Случайный интервал до следующего маневра
            this.fishTimer = this.currentFish.chatter * (0.5 + Math.random());
        }

        // Плавное движение к выбранной цели (интерполяция)
        const diff = this.fishTargetY - this.fishY;
        this.fishY += diff * this.currentFish.speed;

        // 3. Проверка: находится ли рыба в зеленой зоне?
        const isFishInside = this.fishY >= this.barY && (this.fishY + this.fishSize) <= (this.barY + this.barHeight);

        if (isFishInside) {
            this.catchProgress += 0.15; // Скорость заполнения шкалы
        } else {
            this.catchProgress -= 0.12; // Скорость падения шкалы (чуть медленнее, чтобы прощать ошибки)
        }

        // Ограничиваем прогресс от 0 до 100
        this.catchProgress = Math.max(0, Math.min(this.maxProgress, this.catchProgress));

        // 4. Проверка условий победы/поражения
        if (this.catchProgress >= this.maxProgress) {
            this.stop();
            if (this.onWin) this.onWin(this.currentFish.name);
        } else if (this.catchProgress <= 0) {
            this.stop();
            if (this.onLose) this.onLose();
        }
    }

    private draw() {
        // Очистка экрана
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Фон шкалы воды
        this.ctx.fillStyle = "#1e293b";
        this.ctx.fillRect(10, 10, 40, this.canvas.height - 20);

        // Зеленая зона игрока
        this.ctx.fillStyle = "rgba(74, 222, 128, 0.6)";
        this.ctx.fillRect(10, this.barY, 40, this.barHeight);

        // Рыба (красный прямоугольник/иконка)
        this.ctx.fillStyle = "#f87171";
        this.ctx.fillRect(20, this.fishY, 20, this.fishSize);

        // Шкала прогресса (справа)
        const progressX = 70;
        const progressHeight = this.canvas.height - 20;
        this.ctx.fillStyle = "#334155";
        this.ctx.fillRect(progressX, 10, 15, progressHeight);

        // Заполнение шкалы прогресса
        const currentProgressHeight = (this.catchProgress / this.maxProgress) * progressHeight;
        this.ctx.fillStyle = "#fbbf24";
        this.ctx.fillRect(
            progressX, 
            10 + (progressHeight - currentProgressHeight), 
            15, 
            currentProgressHeight
        );
    }

    private lastTime = 0;
    private loop = (time = 0) => {
        if (!this.isRunning) return;
        
        const deltaTime = this.lastTime ? time - this.lastTime : 16;
        this.lastTime = time;

        this.update(deltaTime);
        this.draw();

        this.animationFrameId = requestAnimationFrame(this.loop);
    };
}