# TASK: Admin UI Workspace Refactor for TheEnd

## Goal

Improve the admin panel UI layout and responsiveness across all admin sections without losing any existing functionality.

This task is only about admin UI layout, structure, responsiveness and usability.

Do not change gameplay logic.
Do not change runtime behavior.
Do not change content schemas unless strictly needed for UI state.
Do not remove existing fields, buttons, imports, exports, validation, save/load, autosave, or feature flags.

The admin should become easier to use for content-heavy work:

* NPCs
* Dialogues
* Quests
* Items
* Skills
* Visual FX
* Sprite Studio
* Zone Editor
* Map Editor later
* Battle Maps
* Cities / Locations

The visual colors/theme can stay mostly the same for now.
The main goal is layout logic, responsive behavior, panel structure and usability.

---

## Current situation

The admin already has:

* `AdminLayout`
* sidebar navigation
* admin header with autosave
* `admin-content`
* editor route mode
* many separate admin pages

Important files:

* `apps/frontend/src/admin/AdminLayout.tsx`
* `apps/frontend/src/admin/AdminApp.tsx`
* `apps/frontend/src/styles.css`

The problem:
Some pages behave like long forms.
Some buttons/inputs can overlap or become cramped.
Some pages have one big scroll instead of panel-local scroll.
Complex editors do not consistently use a workspace layout.
There are existing CSS helpers, but they are not a unified admin UI system.

---

## Required approach

Create a reusable Admin Workspace UI system.

Do this as an additive UI refactor.

Do not rewrite every page at once.
Do not remove existing page logic.
Do not change data behavior.
Do not break save/load/import/export.

Start by creating reusable components/classes, then migrate pages gradually.

---

## New reusable layout components

Add reusable admin layout components, for example:

```txt id="fh1dqf"
apps/frontend/src/admin/layout/AdminWorkspace.tsx
apps/frontend/src/admin/layout/AdminPanel.tsx
apps/frontend/src/admin/layout/AdminToolbar.tsx
apps/frontend/src/admin/layout/AdminTabs.tsx
apps/frontend/src/admin/layout/AdminFormGrid.tsx
apps/frontend/src/admin/layout/AdminInspector.tsx
apps/frontend/src/admin/layout/AdminCanvasArea.tsx
apps/frontend/src/admin/layout/AdminSplitPane.tsx
```

Or similar naming if the project already has a better convention.

---

## 1. AdminWorkspace

A reusable shell for complex admin tools.

Must support:

```txt id="fjdo58"
top toolbar
left panel
center work area
right inspector
optional bottom panel
responsive collapse
internal panel scrolling
no overlapping buttons or inputs
```

Large screen layout:

```txt id="l1x1lt"
left / center / right
```

Medium screen layout:

```txt id="i39kjv"
left / center
right inspector moves below or becomes tab
```

Small screen layout:

```txt id="q0p57s"
single column
sections become tabs or stacked panels
```

Important CSS rules:

```txt id="5rxsli"
display: grid
grid-template-columns: clamp(260px, 22vw, 380px) minmax(0, 1fr) clamp(280px, 24vw, 420px)
min-width: 0
min-height: 0
overflow: hidden
```

---

## 2. AdminPanel

Reusable panel/card.

Must support:

```txt id="qkn2jy"
header
content
footer
own internal scroll
compact mode
sticky header optional
```

Important CSS:

```txt id="jjfa3s"
min-width: 0
min-height: 0
overflow: auto
scrollbar-gutter: stable
```

---

## 3. AdminToolbar

Reusable toolbar.

Must support:

```txt id="vbgq5s"
flex-wrap
gap
left actions
right actions
search field
filters
save/export/import buttons
status badges
```

Buttons must never overlap.

Important CSS:

```txt id="aw81rc"
display: flex
flex-wrap: wrap
gap: 8px
align-items: center
min-width: 0
```

---

## 4. AdminFormGrid

Reusable responsive form grid.

Must support:

```txt id="kzn348"
1 column on small width
2 columns on medium
3-4 columns on wide screens
full-width fields
textarea full-width
checkbox rows
compact mode
```

Important CSS:

```txt id="j9rgch"
display: grid
grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))
gap: 10px 12px
min-width: 0
```

All inputs/selects/textareas inside must use:

```txt id="w65ovc"
width: 100%
min-width: 0
```

---

## 5. AdminTabs

Reusable tabs.

Must support:

```txt id="cqkapf"
wrap on normal pages
horizontal scroll on cramped panels
active state
small/compact mode
```

Tabs/buttons must not overlap.

---

## 6. AdminCanvasArea

For Sprite Studio, Zone Editor, Battle Maps, Map Editor later.

Must support:

```txt id="5mi3z2"
centered preview/canvas
zoom controls
fit-to-view
contained canvas
overflow hidden or controlled scroll
```

Important CSS:

```txt id="m7nghh"
display: grid
place-items: center
min-width: 0
min-height: 0
overflow: hidden
```

---

## 7. AdminSplitPane

For pages like NPCs, Dialogues, Items.

Must support:

```txt id="p7nffh"
left list
right editor
optional inspector
responsive stacking
local scroll for list
local scroll for editor
```

This should replace page-specific duplicated split styles gradually.

---

# Migration plan

## Phase UI-1: Add shared layout system

Add the reusable components and CSS only.

Do not migrate all pages yet.

Acceptance:

* components compile;
* no visual regression on existing pages;
* no route breaks;
* typecheck passes.

---

## Phase UI-2: Apply to Sprite Studio first

Sprite Studio is the best first target because it already behaves like a workspace.

Refactor Sprite Studio layout into:

```txt id="dhvfjg"
left: collections / templates / bindings list
center: resolved preview / canvas / playground
right: inspector / validation / debug
bottom: export / spritesheet / logs
```

Do not change resolver logic.
Do not change content collections.
Do not change runtime flags.

Acceptance:

* `/admin/sprite-studio` still opens;
* starter templates still work;
* resolved preview still works;
* no overlapping buttons;
* panels scroll internally;
* resizing browser does not break layout.

---

## Phase UI-3: Apply to NPC editor

NPC editor should become:

```txt id="wspjys"
left panel:
  NPC list
  search
  filters
  create/import/export actions

center/right editor:
  Main identity
  Visuals
  Equipment
  Dialogue links
  Quest bindings
  Combat stats
  Behavior
  Sprite profile link
```

Use tabs or sections inside the editor.

Do not remove any existing NPC fields.

Acceptance:

* all existing NPC fields are still editable;
* creating NPC still works;
* saving NPC still works;
* import/export still works;
* long forms do not become one huge page;
* list and editor scroll separately.

---

## Phase UI-4: Apply to Dialogues editor

Dialogues are content-heavy and need a better layout.

Dialogue editor should become:

```txt id="6mrcn1"
left panel:
  dialogue list
  search
  NPC filter
  quest filter
  create/import/export

center panel:
  scenes
  choices
  dialogue graph/list

right inspector:
  selected scene
  selected choice
  conditions
  effects
  quest start/giveQuest
  validation
```

Important:
Do not break current dialogue schema.
Do not break `giveQuest` legacy shorthand.
Do not break existing effects.

Acceptance:

* existing dialogues load;
* existing dialogue choices remain editable;
* `giveQuest` is preserved;
* effects are preserved;
* save/import/export still works;
* editor is easier to use on wide and medium screens.

---

## Phase UI-5: Apply to Items / Skills / Visual FX

Items:

```txt id="z5yfkz"
left: item list/search/filters
center: item data
right: visuals, stats preview, crafting links, sprite binding
```

Skills:

```txt id="7xm7m6"
left: skill list/tree
center: skill data
right: requirements, effects, animation/FX binding
```

Visual FX:

```txt id="iik9r4"
left: FX list
center: preview/player
right: asset settings, animation settings, sequence/stages
bottom: timeline/logs
```

Acceptance:

* all old fields remain;
* no missing data after save/load;
* preview still works;
* buttons wrap correctly;
* no overlapping fields.

---

## Phase UI-6: Apply to Zone Editor / Battle Maps / future Map Editor

These are true editor/workspace tools.

Use:

```txt id="tro5c8"
left tools/layers/assets
center canvas/map
right inspector
bottom logs/export/timeline
```

Do not change zone data behavior.
Do not change map runtime.
Do not break existing zone export/import.

---

# CSS rules to enforce globally for admin

Add or normalize these admin utility classes:

```txt id="tnckq2"
.admin-workspace
.admin-workspace-left
.admin-workspace-center
.admin-workspace-right
.admin-workspace-bottom
.admin-panel
.admin-panel-header
.admin-panel-body
.admin-panel-footer
.admin-toolbar
.admin-form-grid
.admin-inspector
.admin-canvas-area
.admin-scroll-area
.admin-tabs
.admin-field
.admin-field-full
```

Rules:

```txt id="b2jtdc"
min-width: 0 on all grid/flex children
min-height: 0 on all scroll containers
overflow: auto inside panels
overflow: hidden only around workspace root/canvas
flex-wrap: wrap for toolbars/buttons
repeat(auto-fit, minmax(220px, 1fr)) for forms
clamp() for side panel widths
no fixed width buttons unless necessary
no absolute positioning for normal form layout
```

---

# Regression protections

Before and after each page migration:

1. Run typecheck.
2. Open the page.
3. Create/edit/save one record.
4. Reload page.
5. Confirm record remains.
6. Check import/export if page supports it.
7. Check browser resize:

   * 1920px
   * 1366px
   * 1024px
   * 768px
8. Confirm no overlapping buttons or fields.
9. Confirm old data still displays.
10. Confirm no runtime/gameplay files were changed.

---

# No-touch areas

This task is admin UI only.

Do not change:

```txt id="dbk3n5"
world map runtime
battle runtime
combat logic
movement system
quest runtime
dialogue runtime behavior
inventory runtime behavior
backend content logic except if UI needs no schema change
```

Do not touch these unless explicitly needed and approved:

```txt id="v2xfm4"
WorldMapCanvas.tsx
PhaserWorldMapCanvas.tsx
movementSystem.ts
PhaserBattleRenderer.tsx
quest runtime files
dialogue runtime files
```

---

# Acceptance Criteria

Admin UI refactor is successful when:

1. Existing functionality is preserved.
2. All existing fields remain editable.
3. Save/load still works.
4. Import/export still works.
5. Buttons do not overlap.
6. Inputs do not overlap.
7. Long forms are broken into tabs/panels.
8. Lists and editors scroll independently.
9. Complex editors use workspace layout.
10. UI works on wide and medium screens.
11. Sidebar remains usable.
12. The admin is easier to use for NPCs and Dialogues.
13. Runtime/gameplay behavior is unchanged.
14. Typecheck passes.
15. No unrelated files are included.

```
```
