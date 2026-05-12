"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCombatLogMessage = buildCombatLogMessage;
function buildCombatLogMessage(params) {
    const actor = params.actorName?.trim() || 'Неизвестный противник';
    const target = params.targetName?.trim() || 'цель';
    switch (params.eventType) {
        case 'round_timeout':
            return 'Время на планирование истекло. Раунд начинается.';
        case 'plan_auto_submitted':
            return `${actor} не успевает подтвердить план, сервер отправляет его автоматически.`;
        case 'escape_started':
            return `${actor} добирается до выхода и бросает взгляд назад. Теперь ему нужно продержаться здесь три раунда.`;
        case 'escape_progress':
            return `${actor} удерживает позицию у выхода. До побега осталось ${params.reason ?? 'несколько'} раундов.`;
        case 'escape_delayed':
            return `${actor} всё ещё у выхода, но не может продолжить побег.`;
        case 'escape_cancelled':
            return `${actor} покидает зону выхода, и попытка побега срывается.`;
        case 'escape_success':
            return `Выдержав натиск, ${actor} исчезает за краем поля боя. Схватка для него окончена.`;
        case 'loot_created':
            return `После смерти ${actor} на земле остаются трофеи.`;
        case 'loot_taken':
            return `${actor} быстро подбирает добычу, не выпуская врагов из поля зрения.`;
        case 'death':
            return `${actor} падает на землю, и силы покидают его.`;
        case 'weapon_swap':
            return `${actor} меняет оружие.`;
        case 'item_used':
            return `${actor} использует предмет${params.itemName ? `: ${params.itemName}` : ''}.`;
        case 'guard_applied':
            return `${actor} занимает защитную стойку.`;
        case 'guard_broken':
            return `Защитная стойка ${actor} была пробита.`;
        case 'skill_cast':
            return `${actor} применяет навык${params.skillName ? `: ${params.skillName}` : ''}.`;
        case 'command_failed':
            return `${actor} пытается действовать, но действие срывается.`;
        case 'damage': {
            const amount = typeof params.damage === 'number' ? params.damage : 0;
            const kind = params.damageType ? ` ${params.damageType}` : '';
            return `${target} получает ${amount}${kind} урона.`;
        }
        case 'heal': {
            const amount = typeof params.damage === 'number' ? params.damage : 0;
            return `${target} восстанавливает ${amount} HP.`;
        }
        default:
            return params.reason ? `${actor}: ${params.reason}` : `${actor} действует.`;
    }
}
