"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPassiveEquipmentTrigger = isPassiveEquipmentTrigger;
exports.effectNumericPercent = effectNumericPercent;
exports.effectNumericFlat = effectNumericFlat;
function isPassiveEquipmentTrigger(trigger) {
    return trigger === undefined || trigger === 'always';
}
function effectNumericPercent(effect) {
    if (typeof effect.percent === 'number' && Number.isFinite(effect.percent)) {
        return effect.percent;
    }
    return 0;
}
function effectNumericFlat(effect) {
    if (typeof effect.flat === 'number' && Number.isFinite(effect.flat)) {
        return effect.flat;
    }
    if (typeof effect.value === 'number' && Number.isFinite(effect.value)) {
        return effect.value;
    }
    return 0;
}
