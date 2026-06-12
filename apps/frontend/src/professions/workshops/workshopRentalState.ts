import type { ProfessionWorkshopDefinition } from "../../services/content/models";

export interface PlayerWorkshopRentalState {
  characterId: string;
  workshopId: string;
  rentedAtIso: string;
  expiresAtIso: string;
  paidGold: number;
  ownerNpcId?: string;
  rentalDialogueId?: string;
}

export interface WorkshopRentalAccessResult {
  canUse: boolean;
  isRented: boolean;
  expiresAtIso?: string;
  reason?: string;
  status?: "free" | "active" | "missing" | "expired";
}

const WORKSHOP_RENTAL_LOCK_REASON = "Нужно арендовать мастерскую, чтобы пользоваться этим станком.";

function getStorageKey(characterId: string): string {
  return `theend.workshopRentals.${String(characterId ?? "").trim()}`;
}

function readWorkshopRentals(characterId: string): PlayerWorkshopRentalState[] {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedCharacterId = String(characterId ?? "").trim();
  if (!normalizedCharacterId) {
    return [];
  }

  const raw = window.localStorage.getItem(getStorageKey(normalizedCharacterId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => normalizeRentalState(entry, normalizedCharacterId))
      .filter((entry): entry is PlayerWorkshopRentalState => Boolean(entry));
  } catch {
    return [];
  }
}

function writeWorkshopRentals(characterId: string, rentals: PlayerWorkshopRentalState[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedCharacterId = String(characterId ?? "").trim();
  if (!normalizedCharacterId) {
    return;
  }

  window.localStorage.setItem(getStorageKey(normalizedCharacterId), JSON.stringify(rentals));
}

function normalizeRentalState(value: unknown, characterId: string): PlayerWorkshopRentalState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const workshopId = String(record.workshopId ?? "").trim();
  const rentedAtIso = String(record.rentedAtIso ?? "").trim();
  const expiresAtIso = String(record.expiresAtIso ?? "").trim();
  const paidGold = Math.max(0, Math.floor(Number(record.paidGold ?? 0) || 0));
  const ownerNpcId = String(record.ownerNpcId ?? "").trim() || undefined;
  const rentalDialogueId = String(record.rentalDialogueId ?? "").trim() || undefined;

  if (!workshopId || !rentedAtIso || !expiresAtIso) {
    return null;
  }

  const rentedAt = new Date(rentedAtIso);
  const expiresAt = new Date(expiresAtIso);
  if (Number.isNaN(rentedAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
    return null;
  }

  return {
    characterId,
    workshopId,
    rentedAtIso: rentedAt.toISOString(),
    expiresAtIso: expiresAt.toISOString(),
    paidGold,
    ownerNpcId,
    rentalDialogueId,
  };
}

export function getWorkshopRentalState(characterId: string, workshopId: string): PlayerWorkshopRentalState | null {
  const normalizedCharacterId = String(characterId ?? "").trim();
  const normalizedWorkshopId = String(workshopId ?? "").trim();
  if (!normalizedCharacterId || !normalizedWorkshopId) {
    return null;
  }

  clearExpiredWorkshopRentals(normalizedCharacterId);
  return readWorkshopRentals(normalizedCharacterId).find((entry) => entry.workshopId === normalizedWorkshopId) ?? null;
}

export function isWorkshopRentalActive(characterId: string, workshopId: string, now = new Date()): boolean {
  const state = getWorkshopRentalState(characterId, workshopId);
  if (!state) {
    return false;
  }
  const expiresAt = new Date(state.expiresAtIso);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}

export function saveWorkshopRentalState(state: PlayerWorkshopRentalState): void {
  const normalizedCharacterId = String(state.characterId ?? "").trim();
  const normalizedWorkshopId = String(state.workshopId ?? "").trim();
  if (!normalizedCharacterId || !normalizedWorkshopId) {
    return;
  }

  const rentals = readWorkshopRentals(normalizedCharacterId).filter((entry) => entry.workshopId !== normalizedWorkshopId);
  rentals.push({
    ...state,
    characterId: normalizedCharacterId,
    workshopId: normalizedWorkshopId,
    rentedAtIso: new Date(state.rentedAtIso).toISOString(),
    expiresAtIso: new Date(state.expiresAtIso).toISOString(),
    paidGold: Math.max(0, Math.floor(Number(state.paidGold ?? 0) || 0)),
    ownerNpcId: String(state.ownerNpcId ?? "").trim() || undefined,
    rentalDialogueId: String(state.rentalDialogueId ?? "").trim() || undefined,
  });
  writeWorkshopRentals(normalizedCharacterId, rentals);
}

export function clearExpiredWorkshopRentals(characterId: string): void {
  const normalizedCharacterId = String(characterId ?? "").trim();
  if (!normalizedCharacterId) {
    return;
  }

  const nowTime = Date.now();
  const rentals = readWorkshopRentals(normalizedCharacterId);
  const activeRentals = rentals.filter((entry) => {
    const expiresAt = new Date(entry.expiresAtIso);
    return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > nowTime;
  });

  if (activeRentals.length !== rentals.length) {
    writeWorkshopRentals(normalizedCharacterId, activeRentals);
  }
}

export function getWorkshopRentalAccess(params: {
  characterId: string;
  workshop: ProfessionWorkshopDefinition;
  now?: Date;
}): WorkshopRentalAccessResult {
  const rental = params.workshop.rental;
  if (rental?.enabled !== true) {
    return { canUse: true, isRented: false, status: "free" };
  }

  const now = params.now ?? new Date();
  const normalizedCharacterId = String(params.characterId ?? "").trim();
  const normalizedWorkshopId = String(params.workshop.id ?? "").trim();
  const state = readWorkshopRentals(normalizedCharacterId).find((entry) => entry.workshopId === normalizedWorkshopId) ?? null;
  if (!state) {
    return {
      canUse: false,
      isRented: false,
      reason: WORKSHOP_RENTAL_LOCK_REASON,
      status: "missing",
    };
  }

  const expiresAt = new Date(state.expiresAtIso);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    clearExpiredWorkshopRentals(normalizedCharacterId);
    return {
      canUse: false,
      isRented: false,
      reason: "Срок аренды мастерской истёк.",
      status: "expired",
    };
  }

  return {
    canUse: true,
    isRented: true,
    expiresAtIso: state.expiresAtIso,
    status: "active",
  };
}
