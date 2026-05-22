# Phaser React Parity Implementation Checklist

## Audit Note

- [x] World movement authority is duplicated in `WorldMapCanvas.tsx` and `PhaserWorldMapCanvas.tsx`.
- [x] World snapshots are fetched from multiple components (`WorldMapScreen.tsx`, `PhaserWorldMapCanvas.tsx`, `ActiveWorldEntitiesLayer.tsx`).
- [x] Combat playback completion still relies on React-side sleep instead of renderer completion signaling.
- [x] Combat interaction helpers are duplicated between React and Phaser renderers.
- [x] Phaser asset registry is still placeholder-oriented instead of a stable manifest.

## Implementation Order

- [ ] Phase 1: define shared world/combat scene contracts and route renderer data through them.
- [ ] Phase 2: extract a shared world runtime controller and remove duplicate movement authority.
- [ ] Phase 3: centralize renderer command handling in `WorldMapScreen.tsx`.
- [ ] Phase 4: replace duplicate world snapshot polling with a single owner/subscription path.
- [ ] Phase 5: complete world visual parity and imperative camera controls in Phaser.
- [ ] Phase 6: extract a shared combat interaction adapter.
- [ ] Phase 7: make Phaser battle playback completion event-driven.
- [ ] Phase 8: keep one combat movement pipeline.
- [ ] Phase 9: expand battle map, actor visual, asset, and effect parity.
- [ ] Phase 10: ship parity instrumentation and keep Phaser behind toggles until parity gates pass.