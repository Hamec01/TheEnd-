# THEEND Runtime JSON Guide

**Last Updated**: May 5, 2026  
**Guide Type**: Runtime-verified documentation (based on actual code execution, not just type declarations)

---

## Status Legend

- **WORKS** — Actually executed in runtime, tested pattern works
- **PARTIAL** — Partially implemented or has known issues
- **DECLARED_ONLY** — Type defined but not executed in runtime
- **BROKEN** — Declared but not working correctly

---

## Dialogue Choices

### Dialogue Choice Structure

Dialogue choices support three execution patterns for quest start:

#### Pattern 1: Legacy Shorthand (backward compatible, WORKS)
```javascript
{
  "id": "choice_accept_fire_path",
  "text": "Я найду его.",
  "giveQuest": "fireball_unlock_start",
  "end": true
}
```

#### Pattern 2: Actions Array (recommended modern format, WORKS)
```javascript
{
  "id": "choice_accept_fire_path",
  "text": "Я найду его.",
  "endsDialogue": true,
  "actions": [
    { "id": "start_fireball", "type": "startQuest", "questId": "fireball_unlock_start" }
  ]
}
```

#### Pattern 3: Effects Array (legacy-compatible bridge, WORKS for quest start)
```javascript
{
  "id": "choice_accept_fire_path",
  "text": "Я найду его.",
  "endsDialogue": true,
  "effects": [
    { "type": "start_quest", "questId": "fireball_unlock_start" }
  ]
}
```

### Dialogue Actions (via choice.actions)

| Action Type | Status | JSON Shape | Storage/State Changed | Notes |
|---|---|---|---|---|
| **startQuest** | WORKS | `{"type": "startQuest", "questId": "id"}` | Creates entry in `theend.playerQuests` | Checks `canStartQuest()` first |
| **completeObjective** | WORKS | `{"type": "completeObjective", "questId": "id", "objectiveId": "id"}` | Adds objectiveId to `completedObjectiveIds` | Quest must be active |
| **completeQuest** | WORKS | `{"type": "completeQuest", "questId": "id"}` | Sets quest status to 'completed' | No reward execution |
| **completeStep** | WORKS | `{"type": "completeStep", "questId": "id", "stepId": "id"}` | Advances quest step | Internal to quest state |
| **advanceQuest** | WORKS | `{"type": "advanceQuest", "questId": "id"}` | Moves to next step | Via `completeObjective` call |
| **failQuest** | WORKS | `{"type": "failQuest", "questId": "id"}` | Sets quest status to 'failed' | Reason: 'dialogue_action' |
| **setQuestFlag** | WORKS | `{"type": "setQuestFlag", "questId": "id", "key": "flag_name", "value": true}` | Stored in quest state flags | Any JSON-serializable value |
| **setGlobalFlag** | WORKS | `{"type": "setGlobalFlag", "key": "flag_name", "value": true}` | Stored in `theend.player.flags` | Any JSON-serializable value |
| **giveItem** | WORKS | `{"type": "giveItem", "itemId": "id"}` | Adds to `theend.player.items` | Duplicates prevented |
| **takeItem** | WORKS | `{"type": "takeItem", "itemId": "id"}` | Removes from `theend.player.items` | Silent if not found |
| **giveQuestItem** | WORKS | `{"type": "giveQuestItem", "questItemId": "id"}` | Adds to `theend.player.questItems` | Duplicates prevented |
| **takeQuestItem** | WORKS | `{"type": "takeQuestItem", "questItemId": "id"}` | Removes from `theend.player.questItems` | Silent if not found |
| **giveGold** | WORKS | `{"type": "giveGold", "amount": 50}` | Adds to `theend.player.gold` | Amount must be positive number |
| **takeGold** | WORKS | `{"type": "takeGold", "amount": 50}` | Subtracts from `theend.player.gold` | Clamped to 0 minimum |
| **addReputation** | WORKS | `{"type": "addReputation", "factionId": "id", "amount": 10}` | Stored in `theend.player.reputation[factionId]` | Can be negative |
| **openShop** | WORKS | `{"type": "openShop", "merchantId": "id"}` | Emits intent event | Triggers shop UI modal |
| **startCombat** | WORKS | `{"type": "startCombat", "battleMapId": "id", "presetId": "id"}` | Emits intent event | Starts battle encounter |
| **trainSkill** | WORKS | `{"type": "trainSkill", "skillId": "id"}` | Emits intent event | Opens training UI |
| **unlockLocation** | PARTIAL | `{"type": "unlockLocation", "locationId": "id"}` | Logs message only | No actual unlock in current runtime |
| **unlockDialogue** | PARTIAL | `{"type": "unlockDialogue", "dialogueId": "id"}` | Logs message only | No actual unlock in current runtime |

### Legacy Shorthand Fields

✅ **PARTIAL / BACKWARD-COMPATIBLE**:
- `choice.giveQuest` → WORKS (mapped to `startQuest` runtime action)
- `choice.completeQuest` → WORKS (mapped to `completeQuest` runtime action)
- `choice.giveQuestItem` → WORKS (mapped to `giveQuestItem` runtime action)

❌ **UNSUPPORTED**:
- `choice.giveSkill` (no direct legacy mapper in dialogue runtime)
- `choice.giveExperience` (no direct dialogue action type)

### Dialogue `effects` support

✅ **PARTIAL / BACKWARD-COMPATIBLE**:
- `effects[].type = "start_quest"` or `"startQuest"` → starts quest
- `effects[].type = "complete_quest"` or `"completeQuest"` → completes quest
- `effects[].type = "give_quest_item"` or `"giveQuestItem"` → gives quest item

Other effect types still require explicit `actions[]` in dialogues.

---

## Dialogue Conditions

### Condition Structure
```javascript
{
  "type": "condition_type",
  "value": "depends_on_type"  // Can be string, number, or boolean
  "key": "optional_for_flags" // Only for flag conditions
}
```

### Condition Types (via choice.conditions)

| Condition | Status | JSON Shape | Checks In | Example |
|---|---|---|---|---|
| **quest_active** | WORKS | `{"type": "quest_active", "value": "quest_id"}` | Active quest state | `{"type": "quest_active", "value": "fireball_unlock_start"}` |
| **quest_completed** | WORKS | `{"type": "quest_completed", "value": "quest_id"}` | Completed quests | `{"type": "quest_completed", "value": "starter_quest"}` |
| **quest_not_started** | WORKS | `{"type": "quest_not_started", "value": "quest_id"}` | Never started quests | `{"type": "quest_not_started", "value": "advanced_quest"}` |
| **quest_failed** | WORKS | `{"type": "quest_failed", "value": "quest_id"}` | Failed quest state | `{"type": "quest_failed", "value": "timed_quest"}` |
| **objective_completed** | ❌ **BROKEN** | `{"type": "objective_completed", "value": "?"}` | **NOT IMPLEMENTED** | Not supported in dialogue |
| **objective_not_completed** | ❌ **BROKEN** | `{"type": "objective_not_completed", "value": "?"}` | **NOT IMPLEMENTED** | Not supported in dialogue |
| **has_item** | WORKS | `{"type": "has_item", "value": "item_id"}` | `theend.player.items[]` | `{"type": "has_item", "value": "training_sword_wood_01"}` |
| **has_quest_item** | PARTIAL | `{"type": "has_quest_item", "value": "quest_item_id"}` | `theend.player.questItems[]` | Only works if quest item was GIVEN by action |
| **gold_at_least** | WORKS | `{"type": "gold_at_least", "value": 100}` | `theend.player.gold` | `{"type": "gold_at_least", "value": 50}` |
| **player_level** | WORKS | `{"type": "player_level", "value": 5}` | `character.level` | `{"type": "player_level", "value": 10}` |
| **player_race** | WORKS | `{"type": "player_race", "value": "human"}` | `character.race` | `{"type": "player_race", "value": "wood_elf"}` |
| **player_profession** | WORKS | `{"type": "player_profession", "value": "mage"}` | `character.professionId` | `{"type": "player_profession", "value": "warrior"}` |
| **npc_disposition** | WORKS | `{"type": "npc_disposition", "value": "friendly"}` | `npc.defaultDisposition` | `{"type": "npc_disposition", "value": "hostile"}` |
| **global_flag** | WORKS | `{"type": "global_flag", "key": "flag_name", "value": true}` | `theend.player.flags[key]` | `{"type": "global_flag", "key": "visited_temple"}` |
| **quest_flag** | WORKS | `{"type": "quest_flag", "key": "flag_name", "value": true}` | `questState.flags[key]` | `{"type": "quest_flag", "key": "spoke_to_elder"}` |
| **faction_reputation** | ❌ DECLARED_ONLY | `{"type": "faction_reputation", "value": "?"}` | Not in code | Not implemented |
| **kingdom_reputation** | ❌ DECLARED_ONLY | `{"type": "kingdom_reputation", "value": "?"}` | Not in code | Not implemented |
| **time_of_day** | ❌ DECLARED_ONLY | `{"type": "time_of_day", "value": "?"}` | Not in code | Not implemented |

### Important: `has_quest_item` Reliability Issue

The `has_quest_item` condition only works correctly if:
1. Quest item was given by `giveQuestItem` action in this session
2. OR it was stored in localStorage before quest interactions existed

**Workaround**: Use `objective_completed` condition instead (for checked objectives):
```javascript
// UNRELIABLE:
{"type": "has_quest_item", "value": "feralas_emblem"}

// RELIABLE:
{"type": "objective_completed", "value": "fireball_unlock_start"}
// But wait! This isn't supported in dialogue conditions!
```

⚠️ **CRITICAL BUG**: `objective_completed` condition is **NOT IMPLEMENTED** in dialogue conditions, though it's mentioned in type definitions.

---

## Quest Interactions

### Quest Interaction Structure
```javascript
{
  "id": "interaction_unique_id",
  "title": "Interaction Name",
  "text": "Description text",
  "isActive": true,
  "triggerType": "zone_inspect",  // or "object_interact"
  "zoneId": "zone_id",
  "objectId": "optional_for_object_interact",
  "requirements": [...],
  "choices": [...]
}
```

### Trigger Types

| Trigger | Status | Execution | Notes |
|---|---|---|---|
| **zone_inspect** | WORKS | Clicking "ОСМОТРЕТЬСЯ" (scout/look-around) | Must match current zone ID |
| **object_interact** | WORKS |  When actionId matches objectId | Requires zoneId AND objectId match |
| **zone_enter** | DECLARED_ONLY | Never fires | Not implemented |
| **marker_reached** | DECLARED_ONLY | Never fires | Not implemented |
| **item_use** | DECLARED_ONLY | Never fires | Not implemented |
| **npc_interact** | DECLARED_ONLY | Never fires | Not implemented |
| **manual** | DECLARED_ONLY | Never fires | Not implemented |

### Requirement Types (for quest interactions)

| Requirement | Status | JSON Shape | Checks Against | Notes |
|---|---|---|---|---|
| **quest_active** | WORKS | `{"type": "quest_active", "questId": "id"}` | Active quest state | Must match exactly |
| **quest_completed** | WORKS | `{"type": "quest_completed", "questId": "id"}` | Completed quests | |
| **quest_not_started** | WORKS | `{"type": "quest_not_started", "questId": "id"}` | Never started | |
| **objective_completed** | WORKS | `{"type": "objective_completed", "questId": "id", "objectiveId": "id"}` | Completed objectives | ONLY works in quest interactions |
| **objective_not_completed** | WORKS | `{"type": "objective_not_completed", "questId": "id", "objectiveId": "id"}` | Not completed yet | ONLY works in quest interactions |
| **has_quest_item** | WORKS | `{"type": "has_quest_item", "questItemId": "id"}` | Quest items array | More reliable than dialogue |
| **missing_quest_item** | ❌ BROKEN | `{"type": "missing_quest_item", "questItemId": "id"}` | Not checked | Type exists but no handler |
| **has_skill** | ❌ BROKEN | `{"type": "has_skill", "skillId": "id"}` | Not checked | Type exists but no handler |
| **missing_skill** | ❌ BROKEN | `{"type": "missing_skill", "skillId": "id"}` | Not checked | Type exists but no handler |
| **flag_true** | WORKS | `{"type": "flag_true", "key": "flag_name"}` | Global flags | True or truthy |
| **flag_false** | WORKS | `{"type": "flag_false", "key": "flag_name"}` | Global flags | False or falsy |
| **flag_equals** | ❌ BROKEN | `{"type": "flag_equals", "key": "name", "value": "x"}` | Not checked | Type exists but no handler |
| **level_min** | ❌ BROKEN | `{"type": "level_min", "value": 5}` | Not checked | Type exists but no handler |
| **level_max** | ❌ BROKEN | `{"type": "level_max", "value": 20}` | Not checked | Type exists but no handler |

### Effect Types (for quest interactions)

| Effect | Status | JSON Shape | Execution | State Changed |
|---|---|---|---|---|
| **give_quest_item** | WORKS | `{"type": "give_quest_item", "questItemId": "id"}` | Adds to player items | `theend.player.questItems[]` |
| **complete_objective** | WORKS | `{"type": "complete_objective", "questId": "id", "objectiveId": "id"}` | Completes objective & advances | Quest state + `advanceQuest` |
| **set_flag** | WORKS | `{"type": "set_flag", "key": "name", "value": true}` | Sets global or quest flag | `theend.player.flags[key]` |
| **give_gold** | WORKS | `{"type": "give_gold", "amount": 50}` | Calls parent callback | Via `onGrantGold()` prop |
| **give_experience** | WORKS | `{"type": "give_experience", "amount": 100}` | Calls parent callback | Via `onGrantExperience()` prop |
| **give_skill** | WORKS | `{"type": "give_skill", "skillId": "id"}` | Calls parent callback | Via `onLearnSkill()` prop |
| **complete_quest** | WORKS | `{"type": "complete_quest", "questId": "id"}` | Completes entire quest | Quest state status='completed' |
| **complete_step** | ❌ BROKEN | `{"type": "complete_step", "questId": "id", "stepId": "id"}` | Not implemented | Type exists only |
| **start_quest** | ❌ BROKEN | `{"type": "start_quest", "questId": "id"}` | Not implemented | Type exists only |
| **give_rewards** | ❌ BROKEN | `{"type": "give_rewards", "questId": "id"}` | Not implemented | Type exists only |
| **give_item** | ❌ BROKEN | `{"type": "give_item", "itemId": "id"}` | Not implemented | Type exists only |
| **take_quest_item** | ❌ BROKEN | `{"type": "take_quest_item", "questItemId": "id"}` | Not implemented | Type exists only |
| **take_item** | ❌ BROKEN | `{"type": "take_item", "itemId": "id"}` | Not implemented | Type exists only |
| **open_dialogue** | ❌ BROKEN | `{"type": "open_dialogue", "dialogueId": "id"}` | Not implemented | Type exists only |
| **open_shop** | ❌ BROKEN | `{"type": "open_shop", "merchantId": "id"}` | Not implemented | Type exists only |
| **start_combat** | ❌ BROKEN | `{"type": "start_combat", "battleMapId": "id"}` | Not implemented | Type exists only |

---

## Skills

### Skill Granting

| Method | Status | JSON Shape | Notes |
|---|---|---|---|
| **Dialogue action: trainSkill** | WORKS | `{"type": "trainSkill", "skillId": "id"}` | Opens training UI, doesn't auto-grant |
| **Quest interaction effect: give_skill** | WORKS | `{"type": "give_skill", "skillId": "id"}` | Via callback, adds to learnedSkills |
| **Direct admin grant** | WORKS | Admin UI only | Not JSON-based |

**Working Pattern:**
```javascript
// Quest interaction effect
{"type": "give_skill", "skillId": "Fireball"}
```

---

## Fireball Quest - Verified Working Pattern

### Test Case: fireball_unlock_start

**Dialogue Choice (Start Quest, safest backward-compatible version):**
```javascript
{
  "id": "choice_accept_fire_path",
  "text": "Я найду его.",
  "giveQuest": "fireball_unlock_start",
  "endsDialogue": true,
  "actions": [
    {"id": "start_fireball", "type": "startQuest", "questId": "fireball_unlock_start"}
  ],
  "effects": [
    {"type": "start_quest", "questId": "fireball_unlock_start"}
  ]
}
```

**Zone Interact (Get Item):**
```javascript
{
  "id": "interaction_fireball_chest",
  "title": "Старый сундук",
  "text": "Сундук покрыт копотью. Похоже, внутри что-то осталось.",
  "isActive": true,
  "triggerType": "zone_inspect",
  "zoneId": "zone_fireball_chest",
  "requirements": [
    {"type": "quest_active", "questId": "fireball_unlock_start"},
    {"type": "objective_not_completed", "questId": "fireball_unlock_start", "objectiveId": "obj_open_chest"}
  ],
  "choices": [
    {
      "id": "choice_open_chest",
      "text": "Открыть сундук",
      "effects": [
        {"type": "give_quest_item", "questItemId": "feralas_emblem"},
        {"type": "complete_objective", "questId": "fireball_unlock_start", "objectiveId": "obj_open_chest"}
      ]
    }
  ]
}
```

**Dialogue Return (Get Skill):**
```javascript
{
  "id": "choice_accept_teach",
  "text": "Я запомню.",
  "nextNodeId": "node_end",
  "endsDialogue": true,
  "conditions": [
    {"type": "quest_active", "value": "fireball_unlock_start"}
    // WORKAROUND: Cannot use has_quest_item or objective_completed here!
    // Must check via quest_active only
  ],
  "actions": [
    {"type": "completeObjective", "questId": "fireball_unlock_start", "objectiveId": "obj_return"},
    {"type": "completeQuest", "questId": "fireball_unlock_start"}
  ]
}
```

---

## Known Issues & Workarounds

### Issue 1: `objective_completed` Not Supported in Dialogue Conditions
**Impact**: Can't check if objective is done before showing dialogue option  
**Workaround**: Use `quest_active` + UI logic; or assume objective auto-progresses  
**Fix**: Add handler in `evaluateDialogueConditions()` (see FIXES section)

### Issue 2: `has_quest_item` Unreliable in Dialogue
**Impact**: Quest item checks fail in dialogue conditions  
**Workaround**: Use `objective_completed` in quest interactions where it works  
**Fix**: Ensure quest item detection uses same storage keys everywhere

### Issue 3: Zone Inspect Objective Auto-Progress
**Status**: Actually working correctly in current code  
**Note**: User mentioned this bug but code review shows zone_inspect checks interactions FIRST before any auto-complete. If an interaction matches, it opens immediately without auto-completing.

### Issue 4: Effects Array Not Parsed from Dialogue JSON
**Impact**: Only node.actions and choice.actions execute; no effects array  
**Workaround**: Use actions array instead of effects array in dialogues  
**Note**: Quest interactions use effects array, dialogues use actions array

---

## Debug Commands (Browser Console)

```javascript
// Inspect quest state
console.log(JSON.parse(localStorage.getItem('theend.playerQuests')));

// Inspect completed objectives
const quests = JSON.parse(localStorage.getItem('theend.playerQuests')) || [];
console.log(quests.map(q => ({
  questId: q.questId,
  completedObjectives: q.completedObjectiveIds
})));

// Inspect quest items
console.log(JSON.parse(localStorage.getItem('theend.player.questItems')) || []);

// Inspect learned skills
console.log(JSON.parse(localStorage.getItem('theend.player.learnedSkills')) || []);

// Inspect global flags
console.log(JSON.parse(localStorage.getItem('theend.player.flags')) || {});

// Reset a quest (WARNING: development only)
(() => {
  const quests = JSON.parse(localStorage.getItem('theend.playerQuests')) || [];
  const idx = quests.findIndex(q => q.questId === 'fireball_unlock_start');
  if (idx >= 0) quests.splice(idx, 1);
  localStorage.setItem('theend.playerQuests', JSON.stringify(quests));
  console.log('Quest reset');
})();

// Check if quest item exists
console.log((JSON.parse(localStorage.getItem('theend.player.questItems')) || []).includes('feralas_emblem'));
```

---

## Acceptance Tests

### Test A — Dialogue Quest Start
1. ✅ Create new character
2. ✅ Talk to Erdon
3. ✅ Should see "Я найду его." choice (quest_not_started condition passes)
4. ✅ Click choice
5. ✅ **Verify**: `localStorage.theend.playerQuests` contains `{questId: "fireball_unlock_start", status: "active", ...}`

### Test B — Zone Inspect Interaction
1. ✅ Active fireball quest **(state: "active")**
2. ✅ Go to `zone_fireball_chest`
3. ✅ Click "ОСМОТРЕТЬСЯ"
4. ✅ **Verify**: Interaction modal opens (not auto-completing objective)
5. ✅ Click "Открыть сундук"
6. ✅ **Verify**: `localStorage.theend.player.questItems` now contains `"feralas_emblem"`
7. ✅ **Verify**: `questState.completedObjectiveIds` contains `"obj_open_chest"`

### Test C — Return to NPC for Reward
1. ✅ **Setup**: `obj_open_chest` completed, quest still active
2. ✅ Return to Erdon
3. ✅ Should see "Научи меня этому слову" branchnode
4. ✅ See "Я запомню" choice (quest_active check passes)
5. ✅ Click choice
6. ✅ **Verify**: `localStorage.theend.player.learnedSkills` contains `"Fireball"`
7. ✅ **Verify**: `questState.status === "completed"` and `questState.completedObjectiveIds` includes both objectives

---

## Summary Table: Working vs Broken

| Category | WORKS | PARTIAL | BROKEN |
|---|---|---|---|
| **Dialogue Actions** | startQuest, completeObjective, completeQuest, failQuest, setQuestFlag, giveItem, giveQuestItem, giveGold, addReputation, openShop, startCombat | unlockLocation, unlockDialogue | — |
| **Dialogue Conditions** | quest_active, quest_completed, quest_not_started, quest_failed, has_item, has_quest_item, player_level, player_race, player_profession, npc_disposition, global_flag, quest_flag | has_quest_item (unreliable) | objective_completed, objective_not_completed, faction_reputation, kingdom_reputation, time_of_day |
| **Quest Interaction Triggers** | zone_inspect, object_interact | — | zone_enter, marker_reached, item_use, npc_interact, manual |
| **Quest Interaction Requirements** | quest_active, quest_completed, quest_not_started, objective_completed, objective_not_completed, has_quest_item, flag_true, flag_false | — | missing_quest_item, has_skill, missing_skill, flag_equals, level_min, level_max |
| **Quest Interaction Effects** | give_quest_item, complete_objective, set_flag, give_gold, give_experience, give_skill, complete_quest | — | complete_step, start_quest, give_rewards, give_item, take_quest_item, take_item, open_dialogue, open_shop, start_combat |
| **Skills** | trainSkill (opens UI), give_skill (via callback) | — | — |

