"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEscapeAllowedForBattle = isEscapeAllowedForBattle;
exports.findActorExitZone = findActorExitZone;
exports.isActorStandingOnExitZone = isActorStandingOnExitZone;
// 17.62: Проверка разрешён ли побег в этом бою
function isEscapeAllowedForBattle(battleState) {
    return battleState.battleType != null && battleState.battleType !== 'arena';
}
// 17.63: Найти exit_zone, на которой стоит actor
function findActorExitZone(params) {
    const actor = params.battleState.entities.find(e => e.id === params.actorId && e.isAlive);
    if (!actor || typeof actor.battlefieldX !== 'number' || typeof actor.battlefieldY !== 'number')
        return null;
    const zones = params.battleState.exitZones ?? [];
    for (const zone of zones) {
        if (zone.cells.some(cell => cell.x === actor.battlefieldX && cell.y === actor.battlefieldY)) {
            // Проверка команды
            if (!zone.team || zone.team === 'any')
                return zone;
            if (zone.team === 'player' && actor.team === 'LEFT')
                return zone;
            if (zone.team === 'enemy' && actor.team === 'RIGHT')
                return zone;
        }
    }
    return null;
}
// 17.10: Проверка стоит ли actor на exit_zone
function isActorStandingOnExitZone(params) {
    const zone = findActorExitZone(params);
    return zone ? { ok: true, exitZone: zone } : { ok: false };
}
