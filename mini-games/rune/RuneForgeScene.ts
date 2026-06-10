import Phaser from 'phaser';

// Интерфейсы данных
export interface RunePoint {
    x: number;
    y: number;
}

export interface RuneStep {
    type: 'hold' | 'tap';
    key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Space';
    startT?: number;
    endT?: number;
    t?: number;
    text: string;
    hit?: boolean;
}

export interface RuneData {
    name: string;
    desc: string;
    points: RunePoint[];
    steps: RuneStep[];
}

export interface MediumStyle {
    bg: number;               // Цвет фона
    borderColor: number;      // Цвет границы наковальни
    lineBaseColor: number;    // Цвет незаполненного чертежа
    lineCarvedColor: number;  // Цвет раскаленного пропила
    shadowColor: number;      // Цвет свечения
    particleColor: number;    // Цвет искр/крови/чернил
    tapColor: number;         // Цвет колец пробела
    helpText: string;
    errorText: string;
    missText: string;
}

export interface RuneForgeInitData {
    rune: 'uragg' | 'morrg';
    medium: 'item' | 'skin' | 'scroll';
    sacrifice: 'none' | 'blood' | 'memory';
    onComplete?: (success: boolean, penaltyText?: string) => void;
}

// Пресеты рун из доклада
const RUNES: Record<string, RuneData> = {
    uragg: {
        name: "Урагг ⚡ (Ярость)",
        desc: "Зигзаг, как молния. Требует мгновенной смены направления стрелок и точных ударов молота на углах.",
        points: [
            { x: 100, y: 130 },  
            { x: 350, y: 180 }, 
            { x: 120, y: 280 }, 
            { x: 330, y: 330 }  
        ],
        steps: [
            { type: 'hold', key: 'ArrowRight', startT: 0, endT: 0.33, text: '→' },
            { type: 'tap', key: 'Space', t: 0.33, text: 'ПРОБЕЛ', hit: false },
            { type: 'hold', key: 'ArrowLeft', startT: 0.33, endT: 0.66, text: '←' },
            { type: 'tap', key: 'Space', t: 0.66, text: 'ПРОБЕЛ', hit: false },
            { type: 'hold', key: 'ArrowRight', startT: 0.66, endT: 1.0, text: '→' }
        ]
    },
    morrg: {
        name: "Моррг 🩸 (Сбережение Крови)",
        desc: "Дуга со штрихами. Плавное движение по кругу завершается серией точечных ударов резца.",
        points: [
            { x: 120, y: 260 }, { x: 170, y: 170 }, { x: 225, y: 140 }, { x: 280, y: 170 }, { x: 330, y: 260 },
            { x: 180, y: 190 }, { x: 180, y: 240 },
            { x: 225, y: 170 }, { x: 225, y: 220 },
            { x: 270, y: 190 }, { x: 270, y: 240 }
        ],
        steps: [
            { type: 'hold', key: 'A