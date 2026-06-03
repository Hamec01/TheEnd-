import { loadWorldAudioSettings } from '../../worldmap/worldAudioSettings';

export const BLACKSMITH_MUSIC_TRACKS = Array.from({ length: 10 }, (_, index) => (
  `/audio/blacksmith/music/forge_theme_${String(index + 1).padStart(2, '0')}.ogg`
));

export const BLACKSMITH_BUTTON_SOUNDS = {
  selectRecipe: '/audio/blacksmith/sfx/buttons/button_select_recipe.ogg',
  startSession: '/audio/blacksmith/sfx/buttons/button_start_session.ogg',
  prepare: '/audio/blacksmith/sfx/buttons/button_prepare.ogg',
  heat: '/audio/blacksmith/sfx/buttons/button_heat.ogg',
  stabilize: '/audio/blacksmith/sfx/buttons/button_stabilize.ogg',
  lightStrike: '/audio/blacksmith/sfx/buttons/button_light_strike.ogg',
  mediumStrike: '/audio/blacksmith/sfx/buttons/button_medium_strike.ogg',
  heavyStrike: '/audio/blacksmith/sfx/buttons/button_heavy_strike.ogg',
  quenchWater: '/audio/blacksmith/sfx/buttons/button_quench_water.ogg',
  quenchOil: '/audio/blacksmith/sfx/buttons/button_quench_oil.ogg',
  finish: '/audio/blacksmith/sfx/buttons/button_finish.ogg',
  takeResult: '/audio/blacksmith/sfx/buttons/button_take_result.ogg',
  reset: '/audio/blacksmith/sfx/buttons/button_reset.ogg',
} as const;

export function playBlacksmithUiSound(source: string | undefined): void {
  const audioSettings = loadWorldAudioSettings();
  if (!source || !audioSettings.sfxEnabled) {
    return;
  }
  try {
    const audio = new Audio(source);
    audio.volume = Math.max(0, Math.min(1, 0.72 * audioSettings.sfxVolume));
    void audio.play().catch(() => undefined);
  } catch {
    // Ignore absent or blocked audio sources; user may add files later.
  }
}
