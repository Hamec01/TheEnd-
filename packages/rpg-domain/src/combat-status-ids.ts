import { KNOWN_COMBAT_STATUS_IDS } from './combat-status-registry';

/**
 * Подсказки для UI (apply_status и т.д.). Произвольные строки statusId из контента остаются допустимыми.
 * Для нового контента показываем только канонические id из combat-status-registry.
 * Legacy aliases продолжают поддерживаться рантаймом через canonicalCombatStatusId.
 */
export const KNOWN_STATUS_IDS = KNOWN_COMBAT_STATUS_IDS;

export type KnownStatusId = (typeof KNOWN_COMBAT_STATUS_IDS)[number];
