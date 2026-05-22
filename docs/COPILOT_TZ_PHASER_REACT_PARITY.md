# Copilot Technical Specification: Full Phaser Integration With React Parity

## Purpose

Phaser must become the primary renderer/runtime host for the playable world map and combat scenes without taking ownership of game rules. React remains the application shell and UI layer for menus, panels, inventory, journal, dialogue, merchants, admin tools, editor tools, and text-heavy overlays.

This document is intentionally strict. Do not invent hidden gameplay behavior in Phaser. First extract shared contracts, then make Phaser consume those contracts.

## Verified Code Inventory

World map files:

- `apps/frontend/src/worldmap/WorldMapScreen.tsx`
- `apps/frontend/src/worldmap/WorldMapCanvas.tsx`
- `apps/frontend/src/worldmap/PhaserWorldMapCanvas.tsx`
- `apps/frontend/src/worldmap/movementSystem.ts`
- `apps/frontend/src/worldmap/playerMovementSettings.ts`
- `apps/frontend/src/worldmap/zoneSystem.ts`
- `apps/frontend/src/worldmap/zoneLocationLinking.ts`
- `apps/frontend/src/worldmap/worldMapExploration.ts`
- `apps/frontend/src/worldmap/components/ActiveWorldEntitiesLayer.tsx`
- `apps/frontend/src/worldmap/worldRendererSettings.ts`

World simulation and content files:

- `apps/frontend/src/services/useWorldSimulation.ts`
- `apps/backend/src/worldsim/world-simulation.service.ts`
- `apps/backend/src/worldsim/types/world-simulation.types.ts`
- `apps/frontend/src/types/world-simulation.types.ts`
- `apps/frontend/src/services/questRepository.ts`
- `apps/frontend/src/services/questRuntime.ts`
- `apps/frontend/src/services/questInteractionRuntime.ts`
- `apps/frontend/src/services/npcRepository.ts`
- `apps/frontend/src/services/npcInteractionSelector.ts`
- `apps/frontend/src/services/dialogueRepository.ts`
- `apps/frontend/src/services/locationRepository.ts`

Combat files:

- `apps/frontend/src/battle/BattlePanel.tsx`
- `apps/frontend/src/battle/BattleField.tsx`
- `apps/frontend/src/battle/renderers/PhaserBattleRenderer.tsx`
- `apps/frontend/src/battle/gridCoordinateAdapter.ts`
- `apps/frontend/src/battle/playback/buildBattlePlaybackTimeline.ts`
- `apps/frontend/src/battle/playback/buildBattlePlaybackTimeline.test.ts`
- `apps/frontend/src/battle/combatContextActions.ts`
- `apps/frontend/src/battle/battleRendererSettings.ts`
- `apps/backend/src/combat/combat.service.ts`
- `apps/backend/src/combat/combat.controller.ts`
- `packages/rpg-domain/src/arena-battle.ts`
- `packages/rpg-domain/src/combat-plan.ts`
- `packages/rpg-domain/src/battle-map.ts`
- `packages/rpg-domain/src/visual-effects.ts`

Battle map files:

- `apps/frontend/src/services/battleMaps/battleMapStorage.ts`
- `apps/frontend/src/services/battleMaps/battleMapRuntime.ts`
- `packages/rpg-domain/src/battle-map.ts`

Assets and effects files:

- `apps/frontend/src/phaser/assets/phaserAssetRegistry.ts`
- `apps/frontend/src/phaser/effects/battleEffectRegistry.ts`
- `apps/frontend/src/phaser/effects/effectRegistry.ts`
- `packages/rpg-domain/src/visual-effects.ts`
- `apps/frontend/src/admin/pages/NpcsPage.tsx`
- `apps/frontend/src/admin/pages/ItemsPage.tsx`
- `apps/frontend/src/admin/skills/SkillForm.tsx`
- `apps/backend/src/content/content.types.ts`
- `apps/backend/src/content/content.service.ts`

## Confirmed Current Problems

1. `WorldMapCanvas.tsx` and `PhaserWorldMapCanvas.tsx` both own local player state, run their own `requestAnimationFrame` loop, call `tickPlayerMovement` or `tickPlayerDirectionalMovement`, detect zones, and dispatch player position/state callbacks. This is duplicate gameplay authority.

2. `WorldMapScreen.tsx` owns the actual gameplay consequences: zone enter, city/location opening, quest events, NPC dialogue, living world entity approach, merchant opening, battle map start, combat start, stamina and travel exhaustion. Phaser must not duplicate this logic.

3. `PhaserWorldMapCanvas.tsx` fetches `useWorldSnapshot()` itself while `WorldMapScreen.tsx` and `ActiveWorldEntitiesLayer.tsx` also fetch world snapshots. This can create duplicate polling and stale renderer-specific state.

4. `ActiveWorldEntitiesLayer.tsx` resolves real world entity portraits and sprites from runtime images, NPC full image, portrait, icon, and `/sprites/world`. `PhaserWorldMapCanvas.tsx` currently renders active entities as simple circles and does not match this asset behavior.

5. `PhaserWorldMapCanvas.tsx` has empty imperative handle methods: `resetView`, `fitToScreen`, `focusZone`, and `focusPoint`. React canvas implements these behaviors.

6. `apps/backend/src/worldsim/world-simulation.service.ts` returns `hasQuest: false` with a TODO. Phaser must not invent quest markers for active entities. The snapshot/content layer must provide correct data.

7. `BattlePanel.tsx` keeps final authoritative battle state in `pendingFinalStateRef`, but Phaser playback completion is estimated by `sleep(totalDurationMs + 50)`. This is fragile and causes teleporting/desync when tweens or asset loading differ.

8. `BattleField.tsx` and `PhaserBattleRenderer.tsx` duplicate combat interaction logic such as movable cells, targetable cells, combat style classification, line of sight, and blocking checks. These calculations must become shared adapter functions.

9. `PhaserBattleRenderer.tsx` contains two movement/event paths: timeline playback and legacy `animationEvents` queue processing. This increases the chance of duplicate or jerky movement.

10. `PhaserBattleRenderer.tsx` mostly renders actors as circles/initials plus portrait fallback. It does not fully consume content visual fields such as `battleSpriteAssetId`, `deathEffectId`, and `hitEffectPreset`.

11. `apps/frontend/src/phaser/assets/phaserAssetRegistry.ts` contains only placeholder assets and raw URL fallback. This is not enough for Phaser scene preloading, audio, sprite sheets, atlases, particles, or stable content-driven assets.

12. Domain/content already define effect and visual fields: `SkillVisualConfig`, `StatusVisualConfig`, `ActorBattleVisualConfig`, skill visual IDs, sound IDs, NPC battle visuals, item battle visuals. Phaser must consume these fields instead of hardcoding guesses.

13. Battle maps contain cells, objects, traps, NPCs, triggers, exit zones, loot tables, image URL, calibration, viewport dimensions, and grid metadata. Phaser combat currently focuses on background/grid/entities/effects and needs explicit parity for map features.

14. Renderer toggles default to the legacy path unless localStorage selects Phaser. Keep this until parity gates pass.

## Non-Negotiable Architecture Rules

1. Phaser scenes are renderers and input emitters, not gameplay authorities.

2. Shared serializable state lives outside Phaser scenes.

3. React shell owns DOM UI, modal orchestration, admin/editor surfaces, dialogue, inventory, journal, merchants, and text-heavy panels.

4. Domain/backend remain authoritative for combat rules, turn order, AP/stamina/mana costs, damage, statuses, traps, loot, win/loss, and final battle state.

5. World map consequences remain outside Phaser: zone enter effects, quest progression, NPC selection, dialogue choice effects, city/location access gates, merchant opening, battle map starts, combat starts, mining starts, and living world entity interaction.

6. Phaser may interpolate visuals, tween tokens, animate sprites, play particles/audio, handle camera, and emit typed commands. It must not mutate canonical gameplay state directly.

7. All renderer calculations that affect gameplay parity must be in pure adapters with unit tests.

8. Do not switch Phaser to default until the parity checklist in this document passes.

## Required Target Architecture

Create or refactor toward these boundaries. Exact file names may be adjusted to match project style, but the boundaries are mandatory.

World runtime contracts:

- `WorldSceneSnapshot`: everything the world renderer needs for one frame.
- `WorldSceneCommand`: typed input emitted by React canvas or Phaser.
- `WorldRuntimeController`: shared movement, stamina lock, target movement, directional movement, zone detection, and interaction intent generation.
- `WorldSceneAdapter`: builds renderer snapshot from `WorldMapScreen.tsx` state and content.

Combat runtime contracts:

- `BattleSceneSnapshot`: everything the combat renderer needs for one frame.
- `BattleSceneCommand`: typed input emitted by React battle renderer or Phaser battle renderer.
- `BattleInteractionAdapter`: shared movable cells, targetable cells, target classification, tile occupancy, context click target, and line-of-sight helpers.
- `BattlePlaybackTimeline`: canonical visual playback phases derived from backend `CombatEvent[]` and `recentAnimationEvents`.
- `BattlePlaybackController`: starts playback, waits for renderer completion, applies final authoritative state only after completion.

Asset/effect contracts:

- `PhaserAssetManifest`: stable asset IDs for images, spritesheets, atlases, audio, and particle textures.
- `WorldEntityVisualResolver`: resolves sprite/portrait/image for living world entities exactly once for React and Phaser.
- `BattleActorVisualResolver`: resolves actor token sprite/portrait/death/hit defaults from NPC, item, entity, player avatar, race fallback, and manifest.
- `BattleEffectResolver`: maps `CombatAnimationEvent` and content visual IDs to Phaser VFX/SFX using `battleEffectRegistry.ts`.

## Implementation Roadmap

### Phase 0. Add an audit note before changing behavior

Create a short implementation note in the PR/commit description or a temporary markdown checklist. Record the current duplicate authority points:

- world movement is duplicated in `WorldMapCanvas.tsx` and `PhaserWorldMapCanvas.tsx`
- world snapshots are fetched from multiple components
- combat playback currently sleeps instead of waiting for Phaser completion
- combat interaction helpers are duplicated
- Phaser asset registry is placeholder-only

Do not skip this. It prevents future Copilot passes from treating current behavior as intentional.

Acceptance:

- The implementation starts from the verified problems above, not from assumptions.

### Phase 1. Define renderer snapshots and commands before visuals

Add typed contracts for world and combat renderer boundaries.

World snapshot must include:

- player position, state, avatar URL, movement target, movement lock reason
- camera viewport
- visible zones and current/hover zone IDs
- quest markers
- NPC markers
- active living world entities with resolved render coordinates
- locked/pending/engaged world entity IDs
- city/location entrance affordances
- discovery/fog data if currently enabled
- debug metadata: source tick/version and renderer kind

World commands must include:

- `move_to_point`
- `move_directional`
- `stop_movement`
- `hover_point`
- `interact_zone`
- `interact_world_entity`
- `inspect_current_zone`
- `focus_zone`
- `focus_point`

Combat snapshot must include:

- authoritative `ArenaBattleState` data needed by renderers
- viewport/calibration/cell size
- selected source, selected target, selected movement tile
- movable cells and targetable cells, or enough inputs to compute them in a shared adapter
- map image URL and battle map metadata
- traps, exit zones, loot containers, and renderable map objects if present
- active playback phases
- player avatar and resolved actor visuals

Combat commands must include:

- `select_entity`
- `select_cell`
- `open_context_menu`
- `execute_combat_command`
- `cancel_selection`
- `camera_pan`
- `camera_zoom`

Acceptance:

- React canvas and Phaser can both consume the same snapshot shape.
- React canvas and Phaser can both emit the same command shape.
- No Phaser scene has to inspect React component internals.

### Phase 2. Extract a shared world movement controller

Move canonical world movement out of `WorldMapCanvas.tsx` and `PhaserWorldMapCanvas.tsx`.

The shared controller must own:

- target click movement via `setPlayerTarget`
- directional movement via `tickPlayerDirectionalMovement`
- target movement via `tickPlayerMovement`
- speed multiplier/passability hooks
- sprint multiplier
- movement lock when gameplay is paused, location view is open, travel is exhausted, or a modal blocks movement
- zone detection using `detectCurrentZone`
- player state calculation
- callbacks/events for `position_changed`, `state_changed`, `zone_changed`, and `target_reached`

Phaser may animate the rendered token between controller positions, but it must not decide the authoritative player position alone.

Acceptance:

- Only one world runtime path updates canonical player coordinates.
- `WorldMapCanvas.tsx` and `PhaserWorldMapCanvas.tsx` no longer run separate gameplay movement loops with separate local authority.
- Position, state, and current zone are identical after a renderer switch.

### Phase 3. Centralize world command handling in `WorldMapScreen.tsx` or a controller hook

Move renderer input handling behind a shared handler.

The handler must translate `WorldSceneCommand` into existing game actions:

- update movement target
- stop movement
- inspect current zone
- interact with runtime zone
- approach or interact with living world entity
- open linked city/location when allowed
- dispatch status messages

Do not put access gate logic in Phaser. Reuse existing logic in:

- `zoneSystem.ts`
- `zoneLocationLinking.ts`
- `questRuntime.ts`
- `questInteractionRuntime.ts`
- `npcInteractionSelector.ts`
- `WorldMapScreen.tsx`

Acceptance:

- Clicking the same world point in React canvas or Phaser emits equivalent commands and reaches equivalent outcomes.
- Phaser pointer callbacks do not directly start quests, open cities, open dialogue, or start combat.

### Phase 4. Build a single world scene snapshot adapter

Build world renderer snapshots in one place from `WorldMapScreen.tsx` state and content.

The adapter must include everything currently passed separately into both renderers:

- zones
- camera
- player
- quest markers
- NPC markers
- active world entities
- locked entity coordinates
- player avatar URL
- control scheme
- current/hover zone
- movement lock state

Also include stable IDs and enough debug metadata to compare React and Phaser snapshots.

Acceptance:

- `PhaserWorldMapCanvas.tsx` no longer calls `useWorldSnapshot()` directly.
- `ActiveWorldEntitiesLayer.tsx` and Phaser use the same active entity list for the world map path.
- A debug log can show `snapshot.version`, player position, current zone, and active entity count for both renderers.

### Phase 5. Replace duplicate world snapshot polling with a shared subscription/cache

`useWorldSnapshot()` currently starts a 1000 ms interval per hook instance. Replace or wrap it with a shared cache/subscription so the screen owns one live snapshot and passes it down.

Acceptance:

- Opening the world map does not create duplicate `/api/world-simulation/snapshot` polling from `WorldMapScreen`, React entity layer, and Phaser renderer.
- Snapshot freshness is independent of renderer choice.

### Phase 6. Rebuild Phaser world scene as layered rendering only

Refactor `PhaserWorldMapCanvas.tsx` scene code into a thin scene with layers:

- background map layer
- kingdom/region/zone overlay layer
- hover/current zone highlight layer
- quest marker layer
- NPC marker layer
- active world entity layer
- player layer
- label/debug layer

Implement the previously empty imperative methods:

- `resetView`
- `fitToScreen`
- `focusZone`
- `focusPoint`

Acceptance:

- Camera commands behave like React canvas.
- Resizing does not distort the map.
- Focus methods work in both renderer modes.
- Scene redraws from snapshots and does not keep hidden gameplay state.

### Phase 7. Match world entity visuals between React and Phaser

Extract the visual resolution currently embedded in `ActiveWorldEntitiesLayer.tsx`.

The shared resolver must support:

- `resolveStoredImageSource(spriteId, runtimeImages)`
- sprite IDs as absolute paths
- sprite IDs as `/sprites/world/{id}.png`
- portrait IDs as runtime images
- portrait IDs as `/sprites/actor/{id}.png`
- NPC full image, portrait, and icon fallback
- hostile indicator
- quest indicator only when snapshot/content provides it
- group count indicator
- merchant/friendly/hostile styling

Acceptance:

- Phaser world entities no longer render only as circles when a valid sprite/portrait exists.
- React and Phaser show the same active living world entities and indicators.
- Phaser does not invent `hasQuest`; fix the backend/content snapshot if needed.

### Phase 8. Preserve world quest/NPC/city/location behavior exactly

Extract or wrap the current logic so Phaser commands call the same gameplay path as React canvas.

Must preserve:

- `handleZoneEnterMemoized` effects
- passive zone inspect behavior
- `handleRuntimeZoneInteract`
- city/location access gates
- quest `zone_enter` and `zone_inspect`
- random quest pool triggers
- target scenes and battle map starts
- NPC dialogue selection via `selectBestInteractionForNpc`
- merchant open behavior
- living world entity approach range

Acceptance:

- The same zone enter event produces the same quest logs/rewards/unlocks in both renderers.
- The same NPC/entity click opens the same dialogue/merchant/combat path in both renderers.
- Renderer code contains no separate quest/NPC/city branching.

### Phase 9. Add world parity tests for pure adapters

Add unit tests for:

- movement controller target step
- directional movement with blocked/passable points
- zone change detection
- runtime click target selection
- linked city/location visibility and access
- active entity visual resolution
- snapshot builder output for a representative world state

Acceptance:

- World renderer parity can be checked without starting Phaser.
- Tests fail if React and Phaser would receive different gameplay facts.

### Phase 10. Build a shared combat interaction adapter

Move duplicated combat renderer calculations out of `BattleField.tsx` and `PhaserBattleRenderer.tsx`.

The shared adapter must provide:

- tile occupancy
- movable cells
- targetable cells
- selected source target rules
- blocking tile checks
- line of sight
- combat style classification
- clicked target classification for context menu
- player-on-exit-zone helper if needed by UI

Use existing domain types from `packages/rpg-domain`.

Acceptance:

- `BattleField.tsx` and `PhaserBattleRenderer.tsx` call the same adapter.
- A test can compare movable/targetable cells for React and Phaser paths.
- There is no duplicated `classifyCombatStyle` logic in both renderers.

### Phase 11. Make battle playback completion event-driven

Replace Phaser playback timing based only on `sleep(totalDurationMs + 50)`.

Required behavior:

- `BattlePanel.tsx` builds playback phases from backend events and final state.
- `PhaserBattleRenderer` receives phases and starts a playback run with a stable `runId`.
- Phaser calls `onPlaybackComplete(runId)` or resolves a promise when all tweens/timers/particles required for gameplay synchronization finish.
- `BattlePanel.tsx` applies `pendingFinalStateRef.current` only after the completion signal for the active run.
- If Phaser errors or unmounts, fail safe by applying final state and logging a renderer error.

Acceptance:

- No token teleports to final state before movement tween completion.
- Playback duration no longer depends on a guessed sleep in React.
- Repeated actions cannot complete an old playback run into a new state.

### Phase 12. Keep one combat movement pipeline

Choose the canonical path: `BattlePlaybackTimeline` phases.

Then remove or fully disable duplicate legacy movement consumption during Phaser timeline playback:

- `animationEvents` queue path
- `moveQueueByActor`
- `processedEvents`
- direct `processAnimationEvents` movement effects during active timeline playback

Legacy `animationEvents` may remain only for non-playback state previews, if still required.

Acceptance:

- Each `move_token` event is consumed once.
- Movement cannot be played both by timeline phase and legacy queue.
- A test covers no duplicate move when backend already supplies `move_token`.

### Phase 13. Expand `BattlePlaybackTimeline` coverage and tests

The timeline must support all currently emitted or planned `CombatAnimationEvent` types:

- `move_token`
- `attack_bump`
- `skill_cast`
- `projectile`
- `impact`
- `damage_number`
- `heal_number`
- `critical_hit`
- `miss`
- `block`
- `dodge`
- `status_applied`
- `status_tick`
- `block_flash`
- `dodge_step`
- `death_fade`
- `loot_spawn`

Also account for combat events:

- `turn_started`
- `turn_changed`
- `turn_ended`
- `command_started`
- `command_failed`
- `movement`
- `attack`
- `skill_cast`
- `trap_placed`
- `trap_triggered`
- `loot_created`
- `loot_taken`
- `battle_finished`

Acceptance:

- Timeline ordering is deterministic by round, step, and phase kind.
- Missing movement reconciliation remains a fallback, not the main path.
- Tests cover movement, attack/projectile/damage, status, death, and loot/trap events.

### Phase 14. Make Phaser combat render battle map features

Use `ArenaBattleState`, `RuntimeBattleMapPayload`, and `packages/rpg-domain/src/battle-map.ts`.

Phaser combat must display or intentionally expose:

- map image URL
- calibration offsets
- viewport dimensions
- blocked/high cover/low cover/difficult/water/hazard/trap cells
- revealed traps
- placed traps
- exit zones
- loot containers
- interactable map objects
- battle map NPCs or triggers if they are active in combat state

Acceptance:

- Escape/exit zones are visible enough for the player to understand retreat.
- Trap and loot gameplay states have visual representation.
- Phaser does not hide critical tactical information shown or implied by React/domain state.

### Phase 15. Build actor visual resolution for combat

Create a shared resolver for battle actor visuals.

Input sources:

- `ArenaCombatEntity.avatarUrl`
- player avatar URL
- NPC `battleSpriteAssetId`
- NPC `deathEffectId`
- NPC `hitEffectPreset`
- item `battleVisuals.battleSpriteAssetId`
- item `battleVisuals.deathEffectId`
- item `battleVisuals.hitEffectPreset`
- race fallback from current `getRacePortrait`
- Phaser asset manifest fallback

Important: `apps/frontend/src/services/npcCombatAdapter.ts` currently returns combat stats but not visual fields. If combat state lacks visual IDs, extend the combat setup path or snapshot adapter so Phaser receives them without querying random content inside the scene.

Acceptance:

- Actors can render from content-defined sprite IDs.
- Missing assets fall back deterministically.
- Phaser scene code does not hardcode NPC or item content lookup.

### Phase 16. Build a real Phaser asset manifest and preloader

Expand `apps/frontend/src/phaser/assets/phaserAssetRegistry.ts`.

Must support:

- `image`
- `spritesheet`
- `atlas`
- `audio`
- `particle`

Must provide:

- stable asset IDs
- URL/fallback URL
- frame dimensions for sheets
- preload groups for world and battle
- runtime image integration for stored/admin images
- safe missing asset behavior

Do not scatter raw paths inside scenes. The scene can receive manifest-resolved URLs/keys, but path decisions belong in resolvers/adapters.

Acceptance:

- World background, world entities, battle actors, particles, and sounds are loaded through manifest/resolver logic.
- `playSoundSafe` can actually play registered/preloaded audio assets.
- Missing assets are visible in logs/debug overlay.

### Phase 17. Consolidate effects and sounds

Use these sources:

- `packages/rpg-domain/src/visual-effects.ts`
- `apps/frontend/src/phaser/effects/battleEffectRegistry.ts`
- skill visuals from admin `SkillForm.tsx`
- NPC/item visual fields from admin pages
- combat service `recentAnimationEvents`

Rules:

- Preserve legacy aliases such as `hit_slash`, `impact_blood`, `projectile_arrow`.
- `SkillVisualConfig` IDs must map to Phaser VFX/SFX.
- `StatusVisualConfig` should map status apply/remove/loop behavior where available.
- `ActorBattleVisualConfig` should set default hit/death visuals.
- Effects must not change combat rules.

Acceptance:

- Changing a skill visual ID in content changes Phaser presentation.
- Changing an NPC/item hit/death visual ID changes Phaser presentation.
- Unknown effect IDs produce deterministic fallback plus debug warning.

### Phase 18. Keep React DOM overlays on top of Phaser

Do not port these to Phaser:

- dialogue UI
- quest journal
- inventory
- merchant/training UI
- battle action panels
- combat logs
- hotbar DOM controls
- admin/editor forms

Phaser should render the playfield and emit commands. React should continue to block input during modal/playback states.

Acceptance:

- Existing UI remains accessible and readable.
- Phaser canvas does not consume clicks meant for React overlays.
- During combat playback, input is blocked by the existing overlay or equivalent command guard.

### Phase 19. Add debug and parity instrumentation

Add development-only diagnostics:

- current renderer
- world player coordinates
- current zone ID
- hover zone ID
- movement target
- active entity count
- world snapshot version/time
- battle playback run ID
- battle phase count/current phase
- pending final state status
- missing asset/effect warnings

Acceptance:

- A bug report can state whether the mismatch is in snapshot, command, adapter, or Phaser rendering.
- Debug output is disabled or minimal in production.

### Phase 20. Roll out behind existing renderer toggles

Keep:

- `apps/frontend/src/worldmap/worldRendererSettings.ts`
- `apps/frontend/src/battle/battleRendererSettings.ts`

Do not make Phaser default until all gates pass.

Rollout steps:

1. Keep React/canvas renderer as fallback.
2. Add parity tests and debug overlay.
3. Fix blockers while toggling renderers.
4. Set Phaser default only after world and combat parity are verified.
5. Remove dead duplicate code only after a stable period.

Acceptance:

- Renderer switching does not alter gameplay outcomes.
- Phaser can be disabled quickly if a regression appears.

## File-by-File Work Checklist

`WorldMapScreen.tsx`:

- Build and own `WorldSceneSnapshot`.
- Own the single `useWorldSnapshot()` subscription or pass shared snapshot down.
- Convert renderer callbacks to `WorldSceneCommand`.
- Keep existing gameplay consequences here or in extracted controller hooks.

`WorldMapCanvas.tsx`:

- Stop owning unique gameplay movement once `WorldRuntimeController` exists.
- Consume `WorldSceneSnapshot`.
- Emit `WorldSceneCommand`.
- Keep editor-only behavior separate from play-mode runtime.

`PhaserWorldMapCanvas.tsx`:

- Stop direct `useWorldSnapshot()`.
- Stop separate gameplay movement authority.
- Consume `WorldSceneSnapshot`.
- Emit `WorldSceneCommand`.
- Implement camera imperative methods.
- Render layers from snapshot only.

`movementSystem.ts`:

- Remain pure movement math.
- Move orchestration into `WorldRuntimeController` or equivalent hook.

`zoneSystem.ts` and `zoneLocationLinking.ts`:

- Remain shared pure gameplay/selection helpers.
- Do not duplicate their logic inside Phaser scenes.

`useWorldSimulation.ts`:

- Add shared cache/subscription or make `WorldMapScreen.tsx` the single owner for snapshot polling.

`ActiveWorldEntitiesLayer.tsx`:

- Extract entity visual resolver for React and Phaser reuse.

`BattlePanel.tsx`:

- Build `BattleSceneSnapshot`.
- Use shared combat interaction adapter.
- Replace guessed Phaser playback sleep with renderer completion.
- Apply pending final state only after completion.

`BattleField.tsx`:

- Use shared `BattleInteractionAdapter`.
- Keep React renderer as fallback/reference until parity passes.

`PhaserBattleRenderer.tsx`:

- Consume `BattleSceneSnapshot`.
- Emit `BattleSceneCommand`.
- Use shared adapter for interaction math.
- Use one timeline playback path.
- Signal playback completion.
- Use actor/effect/asset resolvers.

`gridCoordinateAdapter.ts`:

- Keep and expand as the single coordinate conversion utility.

`buildBattlePlaybackTimeline.ts`:

- Become the canonical timeline builder.
- Add tests for all important phase types and ordering.

`phaserAssetRegistry.ts`:

- Become a real manifest/resolver, not placeholder-only.

`battleEffectRegistry.ts`:

- Remain renderer-side visual implementation mapping.
- Consume domain/content IDs and expose deterministic fallback behavior.

Backend/domain:

- Preserve combat authority in `apps/backend/src/combat/combat.service.ts`.
- Preserve combat/domain types in `packages/rpg-domain`.
- Extend snapshots/content wiring only when Phaser lacks required render data.
- Fix `world-simulation.service.ts` `hasQuest` at the data/source level if quest indicators are required.

## Copilot Anti-Fantasy Rules

Do not do these:

- Do not move quest, NPC, dialogue, merchant, city, or combat rules into Phaser scenes.
- Do not add a Phaser-only quest system.
- Do not add a Phaser-only movement source of truth.
- Do not call backend gameplay APIs directly from Phaser scenes.
- Do not solve jerky combat with arbitrary sleeps.
- Do not hardcode new raw asset paths inside scene methods.
- Do not silently ignore missing assets/effects.
- Do not change domain combat rules to make rendering easier.
- Do not remove the React/canvas fallback until parity gates pass.
- Do not make Phaser default before tests and manual parity checks pass.

## Acceptance Gates

World map gate:

- Player can move by click and keyboard in Phaser.
- Player position and current zone match React/canvas for the same input.
- Stamina/sprint/exhaustion/movement locks behave identically.
- City/location entrances open exactly the same way.
- Zone enter and inspect trigger the same quest/runtime effects.
- NPC markers and living world entities match React/canvas data.
- Living world entity approach/click opens the same dialogue/merchant/combat path.
- `resetView`, `fitToScreen`, `focusZone`, and `focusPoint` work.
- No duplicate world snapshot polling in normal play mode.

Combat gate:

- Movable and targetable cells match React renderer.
- Context menu target classification matches React renderer.
- Movement, dash, disengage, attack, projectile, status, death, loot, trap, and exit visuals are represented.
- Final state is applied only after active Phaser playback completes.
- No duplicate movement playback path runs during timeline playback.
- Renderer switching does not change authoritative battle outcome.

Asset/effect gate:

- World and battle assets load through manifest/resolvers.
- Runtime/admin images resolve consistently.
- Skill, status, NPC, and item visual IDs affect Phaser presentation.
- Audio IDs are preloaded or produce clear fallback warnings.
- Unknown asset/effect IDs use deterministic fallbacks.

Test/debug gate:

- Pure adapter tests cover world movement, zone selection, linked locations, active entity visuals, battle targeting, and playback timeline ordering.
- Development debug output identifies snapshot/command/playback mismatches.
- Phaser remains behind existing toggles until the above gates pass.

## Recommended First Implementation Slice

Do this first, in this order:

1. Add `WorldSceneSnapshot` and `WorldSceneCommand`.
2. Make `WorldMapScreen.tsx` build one world snapshot.
3. Stop `PhaserWorldMapCanvas.tsx` from calling `useWorldSnapshot()` directly.
4. Extract shared world movement controller.
5. Make both world renderers consume the shared movement/controller path.
6. Add debug parity output for player position, current zone, and active entity count.
7. Only then improve Phaser world visuals.

Second slice:

1. Add `BattleSceneSnapshot` and `BattleSceneCommand`.
2. Extract shared `BattleInteractionAdapter`.
3. Add renderer completion callback for Phaser playback.
4. Remove duplicate Phaser movement queue during timeline playback.
5. Expand playback timeline tests.
6. Only then improve combat VFX/assets.

This order is mandatory. Visual polish before state unification will hide bugs and make Phaser feel worse, not better.
