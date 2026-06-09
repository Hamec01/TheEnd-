const PROFESSION_OVERLAY_CHANGE_EVENT = 'theend:professionOverlayChange';

export function getCarpenterForestZonesOverlayStorageKey(characterId: string): string {
  return `theend.professionOverlay.${characterId}.carpenter.forestZones`;
}

export function isCarpenterForestZonesOverlayEnabled(characterId: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(getCarpenterForestZonesOverlayStorageKey(characterId)) === '1';
}

export function setCarpenterForestZonesOverlayEnabled(characterId: string, enabled: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(
    getCarpenterForestZonesOverlayStorageKey(characterId),
    enabled ? '1' : '0',
  );
  window.dispatchEvent(new CustomEvent(PROFESSION_OVERLAY_CHANGE_EVENT, { detail: { characterId } }));
}

export function subscribeProfessionOverlayChanges(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  window.addEventListener(PROFESSION_OVERLAY_CHANGE_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(PROFESSION_OVERLAY_CHANGE_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}
