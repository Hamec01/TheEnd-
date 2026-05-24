# Phaser React Parity Implementation Checklist

## Audit Note

- [x] World movement authority is duplicated in `WorldMapCanvas.tsx` and `PhaserWorldMapCanvas.tsx`.
- [x] World snapshots are fetched from multiple components (`WorldMapScreen.tsx`, `PhaserWorldMapCanvas.tsx`, `ActiveWorldEntitiesLayer.tsx`).
- [x] Combat playback completion still relies on React-side sleep instead of renderer completion signaling.
- [x] Combat interaction helpers are duplicated between React and Phaser renderers.
- [x] Phaser asset registry is still placeholder-oriented instead of a stable manifest.

## Implementation Order

- [x] Phase 1: define shared world/combat scene contracts and route renderer data through them.
- [x] Phase 2: extract a shared world runtime controller and remove duplicate movement authority.
- [x] Phase 3: centralize renderer command handling in `WorldMapScreen.tsx`.
- [x] Phase 4: replace duplicate world snapshot polling with a single owner/subscription path.
- [ ] Phase 5: complete world visual parity and imperative camera controls in Phaser. (imperative camera commands wired; visual parity remains)
- [x] Phase 6: extract a shared combat interaction adapter.
- [x] Phase 7: make Phaser battle playback completion event-driven.
- [x] Phase 8: keep one combat movement pipeline.
- [ ] Phase 9: expand battle map, actor visual, asset, and effect parity. (map objects/traps/exit zones/loot containers parity added in React+Phaser; manifest expanded for sprite/audio/particle ids; actor/VFX tuning remains)
- [ ] Phase 10: ship parity instrumentation and keep Phaser behind toggles until parity gates pass. (Phaser is now default for world+battle; manual toggle rollback to canvas/react is preserved)

## Phaser-Default Smoke Checklist (Quick Run)

Run this list after renderer, battle parity, world parity, or asset-manifest changes.

### 1) Startup and Defaults

- [ ] Open app in a clean browser profile (or clear localStorage keys used by renderer settings).
- [ ] Verify world opens in Phaser renderer by default.
- [ ] Enter a battle and verify battle opens in Phaser renderer by default.
- [ ] Open renderer toggles/settings and confirm manual fallback to legacy renderers is still available.

### 2) World Parity Smoke (Phaser)

- [ ] Click movement points on world map and verify movement is executed through command path (no local renderer-only drift).
- [ ] Trigger camera focus commands (zone/point focus) and verify camera follows shared snapshot state.
- [ ] Verify player marker, zone marker, and basic world overlays are visible and consistent with React renderer behavior.

### 3) Battle Parity Smoke (Phaser)

- [ ] Start a battle and execute at least one movement + one skill action.
- [ ] Verify playback completes without React sleep timing dependency (turn progression waits for playback completion event).
- [ ] Verify map-object tile overlays are visible (cover/hazard/summon where present).
- [ ] Verify trap cells, exit-zone cells, and loot-container cells render when present in snapshot data.
- [ ] Verify movement animation path is single-source (no duplicate replay path artifacts).

### 4) Compatibility Rollback Smoke

- [ ] Switch world renderer to canvas/react fallback and verify world still loads and accepts movement commands.
- [ ] Switch battle renderer to react fallback and verify turn flow and overlays still work.
- [ ] Reload app and verify explicit renderer selection persists via localStorage.

### 5) Fast Validation Commands

- [ ] `cd apps/frontend && npm run typecheck`
- [ ] `cd apps/frontend && npm run build`
- [ ] `cd apps/frontend && npm test -- --watch=false`

### 6) Pass Criteria

- [ ] No renderer crash on startup, world entry, or battle entry.
- [ ] World and battle defaults are Phaser for new/clean users.
- [ ] Manual fallback remains operational and persistent.
- [ ] Typecheck, build, and tests are green.
