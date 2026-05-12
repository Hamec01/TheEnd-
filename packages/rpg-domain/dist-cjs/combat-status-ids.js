"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_STATUS_IDS = void 0;
const combat_status_registry_1 = require("./combat-status-registry");
/**
 * Подсказки для UI (apply_status и т.д.). Произвольные строки statusId из контента остаются допустимыми.
 * Для нового контента показываем только канонические id из combat-status-registry.
 * Legacy aliases продолжают поддерживаться рантаймом через canonicalCombatStatusId.
 */
exports.KNOWN_STATUS_IDS = combat_status_registry_1.KNOWN_COMBAT_STATUS_IDS;
