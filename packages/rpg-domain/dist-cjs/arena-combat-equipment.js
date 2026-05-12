"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyArenaCombatEquipmentModifiers = emptyArenaCombatEquipmentModifiers;
function emptyArenaCombatEquipmentModifiers() {
    const zero = { flat: 0, percent: 0 };
    return {
        hitChancePercent: 0,
        critChancePercent: 0,
        dodgeChancePercent: 0,
        blockChancePercent: 0,
        critChanceTakenPercent: 0,
        outgoingDamagePercent: 0,
        incomingPhysical: { ...zero },
        incomingMagic: { ...zero },
    };
}
