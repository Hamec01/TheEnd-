export enum SkillType {
  PHYSICAL = 'physical',
  MAGIC = 'magic',
  ELEMENTAL_MAGIC = 'elemental_magic',
  NORMAL_MAGIC = 'normal_magic',
  FORBIDDEN_MAGIC = 'forbidden_magic',
  SHAMANISM = 'shamanism',
  RUNE = 'rune',
  MIXED = 'mixed',
  PASSIVE = 'passive',
}

export enum SkillSubtype {
  MELEE = 'melee',
  RANGED = 'ranged',
  SPELL = 'spell',
  CHANT = 'chant',
  RITUAL = 'ritual',
  TOTEM = 'totem',
  CONTRACT = 'contract',
  CURSE = 'curse',
  BLESSING = 'blessing',
  HEAL = 'heal',
  SUMMON = 'summon',
  TRANSFORMATION = 'transformation',
  CONTROL = 'control',
  AURA = 'aura',
  RUNE_MARK = 'rune_mark',
  WEAPON_TECHNIQUE = 'weapon_technique',
}

export enum SkillResourceType {
  MP = 'mp',
  STAMINA = 'stamina',
  HP = 'hp',
  BLOOD = 'blood',
  MEMORY = 'memory',
  SOUL = 'soul',
  RUNE_CHARGE = 'rune_charge',
  SPIRIT_FAVOR = 'spirit_favor',
  ITEM = 'item',
}

export enum DamageKind {
  PHYSICAL = 'physical',
  ELEMENTAL = 'elemental',
  MAGIC = 'magic',
  SPIRITUAL = 'spiritual',
  RUNE = 'rune',
  FORBIDDEN = 'forbidden',
  TRUE = 'true',
}

export enum PhysicalDamageType {
  SLASHING = 'slashing',
  PIERCING = 'piercing',
  BLUNT = 'blunt',
}

export enum ElementType {
  FIRE = 'fire',
  WATER = 'water',
  EARTH = 'earth',
  AIR = 'air',
  LIGHT = 'light',
  DARKNESS = 'darkness',
}

export enum MagicSchoolType {
  ELEMENTAL = 'elemental',
  NORMAL = 'normal',
  LIFE = 'life',
  DEATH = 'death',
  BLOOD = 'blood',
  MIND = 'mind',
  SHADOW = 'shadow',
  ILLUSION = 'illusion',
  NECROMANCY = 'necromancy',
  FORBIDDEN = 'forbidden',
}

export enum HealType {
  DIRECT = 'direct',
  OVER_TIME = 'over_time',
  CLEANSE = 'cleanse',
  SHIELD = 'shield',
  LIFE_STEAL = 'life_steal',
}

export enum EffectType {
  BURN = 'burn',
  BLEED = 'bleed',
  POISON = 'poison',
  CURSE = 'curse',
  STUN = 'stun',
  KNOCKDOWN = 'knockdown',
  ROOT = 'root',
  SLOW = 'slow',
  SILENCE = 'silence',
  FEAR = 'fear',
  CONFUSION = 'confusion',
  BLIND = 'blind',
  WEAKNESS = 'weakness',
  ARMOR_BREAK = 'armor_break',
  RESISTANCE_BREAK = 'resistance_break',
  CRIT_CHANCE_BUFF = 'crit_chance_buff',
  DAMAGE_BUFF = 'damage_buff',
  DEFENSE_BUFF = 'defense_buff',
  DODGE_BUFF = 'dodge_buff',
  HEAL_OVER_TIME = 'heal_over_time',
  SHIELD = 'shield',
  TRANSFORM = 'transform',
  MANA_BURN = 'mana_burn',
  STAMINA_DRAIN = 'stamina_drain',
}

export enum EffectStackMode {
  REFRESH = 'refresh',
  STACK = 'stack',
  REPLACE = 'replace',
  IGNORE = 'ignore',
}

export enum SkillTargetType {
  SELF = 'self',
  SINGLE_ALLY = 'single_ally',
  SINGLE_ENEMY = 'single_enemy',
  ANY_SINGLE = 'any_single',
  ALL_ALLIES = 'all_allies',
  ALL_ENEMIES = 'all_enemies',
  AREA = 'area',
  CONE = 'cone',
  LINE = 'line',
  GLOBAL = 'global',
}

export enum SkillAreaShape {
  CIRCLE = 'circle',
  CONE = 'cone',
  LINE = 'line',
  RING = 'ring',
  FIELD = 'field',
}

export enum CastType {
  INSTANT = 'instant',
  CAST_TIME = 'cast_time',
  CHANNELING = 'channeling',
  RITUAL = 'ritual',
  TOGGLE = 'toggle',
}

export enum StatType {
  HP = 'hp',
  MP = 'mp',
  STAMINA = 'stamina',
  STRENGTH = 'strength',
  CONSTITUTION = 'constitution',
  DEXTERITY = 'dexterity',
  INTELLIGENCE = 'intelligence',
  LUCK = 'luck',
  PERCEPTION = 'perception',
  WILLPOWER = 'willpower',
}

export enum AcquisitionType {
  STARTING = 'starting',
  TEACHER = 'teacher',
  SHOP = 'shop',
  QUEST_REWARD = 'quest_reward',
  BOOK = 'book',
  ITEM = 'item',
  LOCATION_DISCOVERY = 'location_discovery',
  RUNE_DISCOVERY = 'rune_discovery',
  SPIRIT_CONTRACT = 'spirit_contract',
  DEMON_CONTRACT = 'demon_contract',
  ADMIN_GRANT = 'admin_grant',
}

export enum SkillClassRole {
  MASTER = 'master',
  PROFICIENT = 'proficient',
  NEUTRAL = 'neutral',
  PENALIZED = 'penalized',
  FORBIDDEN = 'forbidden',
}

export enum SkillRiskType {
  FAIL_CAST = 'fail_cast',
  BACKFIRE_DAMAGE = 'backfire_damage',
  SELF_STUN = 'self_stun',
  SELF_BURN = 'self_burn',
  BLOOD_LOSS = 'blood_loss',
  MEMORY_LOSS = 'memory_loss',
  SOUL_DAMAGE = 'soul_damage',
  DEMONIC_POSSESSION = 'demonic_possession',
  SPIRIT_ANGER = 'spirit_anger',
  RUNE_OVERLOAD = 'rune_overload',
  TRANSFORMATION_LOCK = 'transformation_lock',
  FRIENDLY_FIRE = 'friendly_fire',
  RANDOM_TARGET = 'random_target',
}

export enum RiskSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  EXTREME = 'extreme',
}

export enum SpiritType {
  ANCESTOR = 'ancestor',
  BEAST = 'beast',
  NATURE = 'nature',
  FIRE = 'fire',
  WATER = 'water',
  EARTH = 'earth',
  AIR = 'air',
  SHADOW = 'shadow',
  DEMON = 'demon',
  UNKNOWN = 'unknown',
}

export enum SummonType {
  SPIRIT = 'spirit',
  DEMON = 'demon',
  BEAST = 'beast',
  UNDEAD = 'undead',
  ELEMENTAL = 'elemental',
  ILLUSION = 'illusion',
}

export enum SummonControlType {
  DIRECT = 'direct',
  AI = 'ai',
  RISKY = 'risky',
  UNCONTROLLED = 'uncontrolled',
}
