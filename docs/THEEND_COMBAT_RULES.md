# THE END Combat Rules

This document is the tactical combat source of truth for the arena battle flow.

## Core Model

Combat is driven by exact battlefield cells, not by manually choosing distance bands.
Distance is derived from fighter positions with Manhattan distance:

```text
distance = abs(actor.x - target.x) + abs(actor.y - target.y)
```

Distance bands remain in code only as derived helpers:

```text
0-1 = MELEE
2-4 = NEAR
5+  = FAR
```

## Action Economy

Each round every fighter has:

- 1 Main Action
- 1 Move Action
- 1 Defense Choice

Main actions:

- Attack
- Skill
- Magic
- Item
- Defend
- Wait

Move actions:

- Step: 1 cell
- Extra move: 2 cells total for the action window, higher stamina load
- Dash: up to 3 cells, consumes the main action, no attack after it
- Disengage: 1 cell, consumes the main action, prevents opportunity attack

## Resource Rules

Stamina costs:

- Move 1 cell: 6
- Extra move: 16
- Dash: 14
- Disengage: 10
- Attack: 10 fallback
- Defend: 8

Round start regeneration:

```text
staminaRegen = 10 + floor(constitution / 4)
manaRegen = 6 + floor(willpower / 4)
```

Resources are clamped to max values. They do not fully refill each round.

## Attack After Movement

Allowed:

- Move 1 cell + attack

Blocked by default:

- Move 2+ cells + attack
- Dash + attack
- Disengage + attack

## Defense Logic

Body-zone attack and defense remain in place.

Guard modes:

- 0 defense zones: Reckless Attack
- 1 defense zone: Aggressive Guard
- 2 defense zones: Normal Guard

Effects:

- Reckless Attack: +20% outgoing damage, +15 hit chance, +10 crit chance, +20% incoming damage, enemies gain +10 crit chance against the actor
- Aggressive Guard: +10% outgoing damage
- Normal Guard: no offensive bonus

## Opportunity Attack

A free strike triggers when a unit leaves melee range from an active melee enemy without using Disengage.

Requirements:

- enemy is alive
- enemy is melee
- enemy has enough stamina
- actor moved from distance <= 1 to distance > 1
- movement type is not Disengage

## Battlefield

The battlefield is a 12x12 grid.
Each living entity occupies one tile.

Supported tile types:

- empty
- blocked
- lowCover
- highCover
- hazard
- summon

Current implementation only requires path blocking support immediately, but the data model must preserve all tile types for future terrain, LOS, hazards, summons, and AoE effects.

## NPC Rules

- Melee NPC: closes distance to the nearest reachable adjacent tile and attacks when in range
- Ranged NPC: prefers 3-6 cells and repositions away from melee pressure
- Magic NPC: prefers distance and avoids melee pressure
- Low HP NPC: prefers defend or disengage
- NPCs may not move onto blocked or occupied tiles

## UI Requirements

BattleField should show:

- reachable cells
- selected destination
- blocked cells
- threatened cells
- attack range preview
- opportunity warning for dangerous movement

ActionPlanner should show:

- movement type
- selected destination tile
- defense zones
- clear defense option for reckless attack
- stamina and mana preview
- impossible-action warnings

## Non-Breaking Constraints

Keep and extend the existing arena combat structure. Do not rewrite combat from scratch.
Preserve:

- combat logs
- initiative ordering
- stamina and mana fields
- body-zone targeting
- NPC action generation
- current frontend battle shell
- DistanceBand as a derived helper
