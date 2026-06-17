# Sprite Studio Phase 2.7C Handoff

## Current state

We stopped at **Phase 2.7C acceptance hardening**, without starting 2.7D.

Already completed in this layer:

- fixed `/admin/sprite-studio` content-load path so it no longer fails with `Unexpected token '<'`
- fixed Vite/backend content API routing so `/api/content/...` returns JSON again
- added preview support for:
  - `rotation`
  - `zLayer`
  - multi-frame clip metadata
  - frame scrubber / play / loop / reset flow
- `Generate V0 starter visuals` now upgrades stale starter animation sets to generated multi-frame sheets
- added regression coverage for starter animation set upgrade

## Acceptance status

### Working

- Sprite Studio page loads
- starter generator runs manually by button
- multi-frame clips persist after generation
- `Play` becomes available on generated starter clips
- frame scrubber shows real multi-frame state
- resolver test for starter demo profile passes in unit tests

### Still blocked

- browser preview still shows **body only**
- generated `sword / shield / helmet / chest` overlays are **not visible in the live admin preview**
- because of that, Phase 2.7C is **not accepted yet**

## Important finding

The core resolver is **not** the primary blocker anymore.

Unit coverage now proves that starter content resolves correctly into:

- `body_torso`
- `chest_armor`
- `helmet`
- `main_hand_weapon`
- `offhand_shield`

So the remaining issue is likely in one of these layers:

1. preview-side sanitization/filtering
2. actual loaded draft/reference data in admin
3. preview-selected profile/equipment state in UI

## Most likely investigation targets

### 1. Preview sanitization

File:

- `C:\Users\ham\Documents\TheEnd\apps\frontend\src\admin\spriteStudio\SpriteStudioWorkspace.tsx`

Pay special attention to:

- `previewSanitizedDraft`
- `previewEquipmentBindings`
- `resolvedPreview`
- `renderAssetSourcesSection`

Risk:

- generated equipment image refs may be filtered before they reach the preview resolver

### 2. Asset classification / overlay eligibility

File:

- `C:\Users\ham\Documents\TheEnd\apps\frontend\src\admin\spriteStudio\spriteStudioAssetKinds.ts`

Check whether generated equipment images are classified consistently as:

- `sprite_equipment_weapon`
- `sprite_equipment_shield`
- `sprite_equipment_helmet`
- `sprite_equipment_armor`

### 3. Actual loaded starter content

Backend local content already contains generated starter bindings/profile updates in:

- `C:\Users\ham\Documents\TheEnd\apps\backend\data\theend_content.local.json`

Confirmed there:

- `profile_regal_paladin` includes:
  - `starter_sword_01`
  - `starter_leather_armor_01`
  - `shield_argos_private_01`
  - `helmet_argos_private_01`
- generated equipment bindings point to:
  - `img_sprite_studio_equipment_starter_sword_visual`
  - `img_sprite_studio_equipment_starter_shield_visual`
  - `img_sprite_studio_equipment_starter_helmet_visual`
  - `img_sprite_studio_equipment_starter_chest_armor_visual`

## Tests already added

File:

- `C:\Users\ham\Documents\TheEnd\apps\frontend\src\sprite-studio-core\CharacterVisualResolver.test.ts`

New coverage includes:

- stale starter animation set upgrade to multi-frame generated clips
- starter demo profile resolves body + chest + helmet + sword + shield

## Next safe step

Do **not** start 2.7D.

Continue only with:

1. inspect why live preview strips or skips equipment overlays
2. fix that path
3. verify in browser:
   - body visible
   - sword visible
   - shield visible
   - helmet visible
   - chest visible
   - fitting controls affect at least one overlay
4. rerun:
   - `npm run typecheck`
   - `npm run build`

## Do not do yet

- no Equipment Visual Forge
- no body authoring controls
- no world runtime swap
- no battle runtime swap
- no combat logic changes
- no Phase 3
