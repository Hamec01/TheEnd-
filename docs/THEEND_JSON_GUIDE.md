# THE END: JSON guide for quests, dialogues, NPC and skills

This file lists the values that the game currently understands in code.
It is meant for manual JSON editing, admin import/export, and fast reference.

## 1. Safe rule

When you write JSON by hand:

- Use IDs exactly as strings: `"fireball"`, `"erdon_intro"`, `"quest_fire_trial"`.
- For `type`, use only values from the lists below.
- For quest/dialogue effects, prefer `snake_case` values from this guide.
- If a field references another entity, use its exact `id`.

## 2. Quest JSON

Minimal quest shape:

```json
{
  "id": "fireball_unlock_start",
  "title": "Old Cache",
  "adminDescription": "Internal admin text",
  "playerDescription": "Find the hidden cache.",
  "category": "npc",
  "status": "active",
  "isRepeatable": false,
  "isHidden": false,
  "steps": [],
  "triggers": [],
  "conditions": [],
  "rewards": [],
  "failureConsequences": [],
  "createdAt": "2026-05-05T00:00:00.000Z",
  "updatedAt": "2026-05-05T00:00:00.000Z"
}
```

### Quest `category`

- `global`
- `kingdom`
- `faction`
- `profession`
- `lore`
- `city`
- `npc`
- `random`
- `hidden`
- `repeatable`

### Quest `status`

- `draft`
- `active`
- `disabled`
- `archived`

### Quest step objective `type`

- `talk_to_npc`
- `enter_zone`
- `reach_marker`
- `kill_enemy`
- `collect_item`
- `deliver_item`
- `use_item`
- `pay_gold`
- `receive_gold`
- `choose_dialogue`
- `craft_item`
- `learn_profession`
- `gain_reputation`
- `wait_time`
- `read_book`
- `inspect_object`
- `survive_battle`
- `escort_npc`

Objective example:

```json
{
  "id": "obj_find_cache",
  "type": "enter_zone",
  "description": "Enter the abandoned alley.",
  "zoneId": "old_quarter_alley",
  "requiredCount": 1
}
```

### Quest trigger `type`

- `npc_dialogue`
- `map_marker`
- `map_zone_enter`
- `item_use`
- `enemy_death`
- `global_event`
- `profession_unlock`
- `manual_admin`
- `random_zone_roll`

Trigger example:

```json
{
  "id": "trigger_start_1",
  "type": "npc_dialogue",
  "npcId": "erdon_ashen",
  "dialogueId": "erdon_intro"
}
```

Notes:

- `random_zone_roll` should also define `chancePercent` and `cooldownSeconds`.
- `map_zone_enter` should define `zoneId`.

### Quest condition `type`

- `player_level`
- `player_race`
- `player_class`
- `player_profession`
- `kingdom_reputation`
- `faction_reputation`
- `has_item`
- `has_not_item`
- `quest_completed`
- `quest_not_completed`
- `quest_active`
- `npc_alive`
- `npc_dead`
- `time_of_day`
- `in_city`
- `in_kingdom`
- `stat_check`
- `flag_true`
- `flag_false`
- `gold_at_least`

Condition example:

```json
{
  "id": "cond_lvl_1",
  "type": "player_level",
  "operator": ">=",
  "value": 3
}
```

Important runtime note:

- `npc_alive`, `npc_dead`, and `stat_check` are declared in types, but current quest runtime marks them as not supported yet.

### Quest reward `type`

- `gold`
- `experience`
- `item`
- `quest_item`
- `reputation`
- `title`
- `profession`
- `skill`
- `recipe`
- `unlock_dialogue`
- `unlock_location`
- `unlock_shop`
- `faction_access`
- `lore_entry`

Reward example:

```json
{
  "id": "reward_gold_1",
  "type": "gold",
  "amount": 100
}
```

Reward example with target:

```json
{
  "id": "reward_skill_1",
  "type": "skill",
  "targetId": "fireball"
}
```

## 3. Quest interaction JSON

Quest interactions are separate from core quest definition and are used for zone inspect, zone enter, marker actions, object actions, and NPC interaction scenes.

Minimal shape:

```json
{
  "id": "int_old_cache",
  "title": "Hidden Cache",
  "triggerType": "zone_inspect",
  "zoneId": "old_quarter_alley",
  "text": "You notice loose stones in the wall.",
  "choices": [],
  "isActive": true
}
```

### Quest interaction `triggerType`

- `zone_inspect`
- `zone_enter`
- `marker_reached`
- `object_interact`
- `item_use`
- `npc_interact`
- `manual`

### Quest interaction requirement `type`

- `quest_not_started`
- `quest_active`
- `quest_completed`
- `quest_failed`
- `objective_completed`
- `objective_not_completed`
- `step_completed`
- `step_not_completed`
- `has_item`
- `missing_item`
- `has_quest_item`
- `missing_quest_item`
- `has_skill`
- `missing_skill`
- `has_flag`
- `flag_equals`
- `race_is`
- `class_is`
- `level_min`
- `level_max`
- `faction_relation_min`

### Quest interaction effect `type`

- `complete_objective`
- `complete_step`
- `complete_quest`
- `start_quest`
- `fail_quest`
- `give_rewards`
- `give_item`
- `take_item`
- `give_quest_item`
- `take_quest_item`
- `give_skill`
- `give_gold`
- `give_experience`
- `set_flag`
- `unlock_location`
- `unlock_dialogue`
- `open_dialogue`
- `open_shop`
- `start_combat`

Choice example:

```json
{
  "id": "choice_take_emblem",
  "text": "Take the emblem",
  "requirements": [
    {
      "type": "quest_active",
      "questId": "fireball_unlock_start"
    }
  ],
  "effects": [
    {
      "type": "give_quest_item",
      "questItemId": "feralas_emblem"
    },
    {
      "type": "complete_objective",
      "questId": "fireball_unlock_start",
      "objectiveId": "obj_find_emblem"
    }
  ],
  "close": true
}
```

## 4. Dialogue JSON

Minimal shape:

```json
{
  "id": "erdon_intro",
  "title": "Erdon Intro",
  "npcId": "erdon_ashen",
  "status": "active",
  "startNodeId": "start",
  "nodes": [],
  "createdAt": "2026-05-05T00:00:00.000Z",
  "updatedAt": "2026-05-05T00:00:00.000Z"
}
```

### Dialogue `status`

- `draft`
- `active`
- `disabled`

### Dialogue node `speaker`

- `npc`
- `player`
- `system`

### Dialogue condition `type`

Declared and validated:

- `quest_not_started`
- `quest_active`
- `quest_completed`
- `quest_failed`
- `objective_completed`
- `objective_not_completed`
- `has_item`
- `missing_item`
- `has_quest_item`
- `missing_quest_item`
- `has_skill`
- `missing_skill`
- `has_flag`
- `flag_equals`
- `race_is`
- `class_is`
- `level_min`
- `level_max`
- `faction_relation_min`
- `player_level`
- `player_race`
- `player_profession`
- `faction_reputation`
- `kingdom_reputation`
- `gold_at_least`
- `npc_disposition`
- `time_of_day`
- `global_flag`
- `quest_flag`

Compatibility aliases also exist in some places:

- `playerLevel`
- `playerRace`
- `playerProfession`
- `questActive`
- `questCompleted`
- `questNotStarted`
- `objectiveCompleted`
- `objectiveNotCompleted`
- `hasItem`
- `missingItem`
- `hasQuestItem`
- `missingQuestItem`
- `hasSkill`
- `missingSkill`
- `hasFlag`
- `flagEquals`
- `raceIs`
- `classIs`
- `levelMin`
- `levelMax`
- `factionRelationMin`
- `questFailed`
- `goldAtLeast`
- `factionReputation`
- `kingdomReputation`
- `npcDisposition`
- `globalFlag`
- `questFlag`

Important note:

- `missing_flag`, `flag_true`, and `flag_false` are currently supported in the NPC quest-marker selector layer, but they are not part of the main declared dialogue type list. For stable content, prefer `has_flag` and `flag_equals` unless runtime support is unified everywhere.

### Dialogue action `type`

Safe values:

- `start_quest`
- `complete_objective`
- `complete_step`
- `complete_quest`
- `fail_quest`
- `give_rewards`
- `set_flag`
- `give_item`
- `take_item`
- `give_quest_item`
- `take_quest_item`
- `give_gold`
- `take_gold`
- `give_experience`
- `give_skill`
- `open_shop`
- `start_combat`
- `unlock_location`
- `unlock_dialogue`
- `open_dialogue`

CamelCase aliases also exist:

- `startQuest`
- `completeObjective`
- `completeStep`
- `advanceQuest`
- `completeQuest`
- `failQuest`
- `giveRewards`
- `setQuestFlag`
- `giveItem`
- `takeItem`
- `giveQuestItem`
- `takeQuestItem`
- `giveGold`
- `takeGold`
- `giveExperience`
- `addReputation`
- `openShop`
- `startCombat`
- `trainSkill`
- `unlockLocation`
- `unlockDialogue`
- `openDialogue`
- `setNpcDisposition`
- `setGlobalFlag`

Important note:

- `give_skill` is normalized into the runtime skill-grant flow.

Dialogue choice example:

```json
{
  "id": "choice_remember_fireball",
  "end": true,
  "text": "I will remember.",
  "effects": [
    {
      "type": "give_skill",
      "skillId": "fireball"
    },
    {
      "type": "set_flag",
      "flagKey": "erdon_taught_fireball",
      "value": true
    }
  ]
}
```

Notes:

- `next` is supported as alias of `nextNodeId`.
- `end` is supported as alias of `endsDialogue`.
- `giveQuest`, `completeQuest`, `completeStep`, and `completeObjective` are supported as shorthand compatibility fields.

## 5. NPC JSON

### NPC `status`

- `draft`
- `active`
- `disabled`
- `archived`

### NPC `kind`

- `civilian`
- `quest_giver`
- `trader`
- `trainer`
- `guard`
- `enemy`
- `boss`
- `companion`
- `random_encounter`
- `story_character`
- `monster`
- `animal`

### NPC `race`

- `human`
- `high_elf`
- `forest_elf`
- `ancient_elf`
- `dwarf`
- `orc`
- `dark_elf`
- `arin_fellar`
- `monster`
- `beast`
- `undead`
- `spirit`
- `other`

### NPC `defaultDisposition`

- `friendly`
- `neutral`
- `hostile`
- `fearful`
- `aggressive_on_sight`
- `quest_locked`
- `hidden`

### NPC map binding `spawnType`

- `fixed`
- `random_in_zone`
- `quest_spawn`
- `event_spawn`

### NPC condition `type`

- `quest_active`
- `quest_completed`
- `quest_not_started`
- `quest_failed`
- `player_level`
- `player_race`
- `player_profession`
- `faction_reputation`
- `kingdom_reputation`
- `has_item`
- `has_quest_item`
- `time_of_day`
- `global_flag`
- `npc_alive`
- `npc_dead`

### NPC quest binding `role`

- `giver`
- `target`
- `receiver`
- `enemy`
- `escort`
- `trainer`
- `lore_source`

### NPC quest action `type`

- `startQuest`
- `completeObjective`
- `advanceQuest`
- `completeQuest`
- `failQuest`
- `setQuestFlag`
- `giveItem`
- `giveQuestItem`
- `takeItem`
- `takeQuestItem`
- `addReputation`
- `giveGold`
- `takeGold`
- `unlockDialogue`
- `unlockLocation`

## 6. Skill JSON

### Skill `type`

- `physical`
- `magic`
- `elemental_magic`
- `normal_magic`
- `forbidden_magic`
- `shamanism`
- `rune`
- `mixed`
- `passive`

### Skill `subtype`

- `melee`
- `ranged`
- `spell`
- `chant`
- `ritual`
- `totem`
- `contract`
- `curse`
- `blessing`
- `heal`
- `summon`
- `transformation`
- `control`
- `aura`
- `rune_mark`
- `weapon_technique`

### Skill target `targetType`

- `self`
- `single_ally`
- `single_enemy`
- `any_single`
- `all_allies`
- `all_enemies`
- `area`
- `cone`
- `line`
- `global`

### Skill damage `damageKind`

- `physical`
- `elemental`
- `magic`
- `spiritual`
- `rune`
- `forbidden`
- `true`

### Skill cast `castType`

- `instant`
- `cast_time`
- `channeling`
- `ritual`
- `toggle`

### Skill acquisition method `type`

- `starting`
- `teacher`
- `shop`
- `quest_reward`
- `book`
- `item`
- `location_discovery`
- `rune_discovery`
- `spirit_contract`
- `demon_contract`
- `admin_grant`

## 7. Practical advice

- For quests, write `type` exactly as listed here and keep references by exact `id`.
- For dialogue actions, prefer `snake_case`.
- For dialogue conditions, prefer declared types from section 4 and do not rely on partial compatibility unless you know the exact runtime path.
- If something validates in admin but does not work in play, the first suspects are usually: wrong `id`, wrong reference field, or a type that exists in typings but is only partially supported in runtime.
