import type { SoundCategory, SoundKind } from './models';

export interface SoundSlot {
  /** Становится SoundDefinition.id */
  id: string;
  label: string;
  hint: string;
  category: SoundCategory;
  kind: SoundKind;
  /** Предлагаемый относительный путь файла (без ведущего слэша) */
  defaultPath: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI / Интерфейс
// ─────────────────────────────────────────────────────────────────────────────

const UI_SLOTS: SoundSlot[] = [
  { id: 'ui_click_primary',    label: 'Клик (основной)',      hint: 'Основной клик по кнопке, подтверждение выбора.',            category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/click_primary.ogg' },
  { id: 'ui_click_secondary',  label: 'Клик (второстепенный)',hint: 'Мягкий клик, второстепенные кнопки.',                       category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/click_secondary.ogg' },
  { id: 'ui_hover',            label: 'Hover',                hint: 'Тихий звук при наведении на кнопку.',                      category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/hover.ogg' },
  { id: 'ui_open_menu',        label: 'Открыть меню',         hint: 'Звук открытия панели / инвентаря / меню.',                  category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/open_menu.ogg' },
  { id: 'ui_close_menu',       label: 'Закрыть меню',         hint: 'Звук закрытия панели / меню.',                              category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/close_menu.ogg' },
  { id: 'ui_confirm',          label: 'Подтвердить',          hint: 'Звук подтверждения действия (OK, Принять, Готово).',        category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/confirm.ogg' },
  { id: 'ui_cancel',           label: 'Отмена',               hint: 'Звук отмены / выхода назад.',                               category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/cancel.ogg' },
  { id: 'ui_error',            label: 'Ошибка',               hint: 'Звук ошибки, недоступного действия.',                       category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/error.ogg' },
  { id: 'ui_notification',     label: 'Уведомление',          hint: 'Звук всплывающего уведомления.',                            category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/notification.ogg' },
  { id: 'ui_tab_switch',       label: 'Переключить вкладку',  hint: 'Звук смены вкладки / раздела.',                             category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/tab_switch.ogg' },
  { id: 'ui_purchase',         label: 'Покупка',              hint: 'Звук успешной покупки предмета.',                           category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/purchase.ogg' },
  { id: 'ui_sell',             label: 'Продажа',              hint: 'Звук успешной продажи предмета.',                           category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/sell.ogg' },
  { id: 'ui_drag_start',       label: 'Взять предмет (drag)', hint: 'Звук начала перетаскивания предмета в инвентаре.',          category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/drag_start.ogg' },
  { id: 'ui_drop_slot',        label: 'Положить предмет',     hint: 'Звук кладки предмета в слот.',                              category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/drop_slot.ogg' },
  { id: 'ui_level_up',         label: 'Повышение уровня',     hint: 'Торжественный звук при повышении уровня персонажа.',        category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/level_up.ogg' },
  { id: 'ui_quest_accept',     label: 'Квест принят',         hint: 'Звук принятия нового квеста.',                              category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/quest_accept.ogg' },
  { id: 'ui_quest_complete',   label: 'Квест выполнен',       hint: 'Торжественный звук завершения квеста.',                     category: 'ui', kind: 'sfx',      defaultPath: 'sfx/ui/quest_complete.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Инвентарь
// ─────────────────────────────────────────────────────────────────────────────

const INVENTORY_SLOTS: SoundSlot[] = [
  { id: 'inv_pickup_item',     label: 'Подобрать предмет',    hint: 'Звук поднятия предмета с земли.',                           category: 'inventory', kind: 'sfx', defaultPath: 'sfx/inventory/pickup_item.ogg' },
  { id: 'inv_drop_item',       label: 'Выбросить предмет',    hint: 'Звук выбрасывания предмета.',                               category: 'inventory', kind: 'sfx', defaultPath: 'sfx/inventory/drop_item.ogg' },
  { id: 'inv_equip_armor',     label: 'Надеть броню',         hint: 'Звук экипировки доспеха.',                                  category: 'inventory', kind: 'sfx', defaultPath: 'sfx/inventory/equip_armor.ogg' },
  { id: 'inv_equip_weapon',    label: 'Взять оружие',         hint: 'Звук экипировки оружия.',                                   category: 'inventory', kind: 'sfx', defaultPath: 'sfx/inventory/equip_weapon.ogg' },
  { id: 'inv_unequip',         label: 'Снять предмет',        hint: 'Звук снятия экипировки.',                                   category: 'inventory', kind: 'sfx', defaultPath: 'sfx/inventory/unequip.ogg' },
  { id: 'inv_use_potion',      label: 'Использовать зелье',   hint: 'Звук глотка зелья / флакона.',                              category: 'inventory', kind: 'sfx', defaultPath: 'sfx/inventory/use_potion.ogg' },
  { id: 'inv_use_scroll',      label: 'Использовать свиток',  hint: 'Шелест и магический звук свитка.',                          category: 'inventory', kind: 'sfx', defaultPath: 'sfx/inventory/use_scroll.ogg' },
  { id: 'inv_open_chest',      label: 'Открыть сундук',       hint: 'Скрип крышки сундука.',                                     category: 'inventory', kind: 'sfx', defaultPath: 'sfx/inventory/open_chest.ogg' },
  { id: 'inv_close_chest',     label: 'Закрыть сундук',       hint: 'Звук закрытия сундука.',                                    category: 'inventory', kind: 'sfx', defaultPath: 'sfx/inventory/close_chest.ogg' },
  { id: 'inv_gold_pickup',     label: 'Подобрать золото',      hint: 'Монеты позвякивают.',                                      category: 'inventory', kind: 'sfx', defaultPath: 'sfx/inventory/gold_pickup.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Шаги (Footsteps)
// ─────────────────────────────────────────────────────────────────────────────

const FOOTSTEPS_SLOTS: SoundSlot[] = [
  { id: 'step_grass',   label: 'Трава',    hint: 'Шаги по траве / мягкому грунту.',   category: 'footsteps', kind: 'sfx', defaultPath: 'sfx/footsteps/step_grass.ogg' },
  { id: 'step_stone',   label: 'Камень',   hint: 'Шаги по камню / брусчатке.',         category: 'footsteps', kind: 'sfx', defaultPath: 'sfx/footsteps/step_stone.ogg' },
  { id: 'step_wood',    label: 'Дерево',   hint: 'Шаги по деревянному полу / мосту.',  category: 'footsteps', kind: 'sfx', defaultPath: 'sfx/footsteps/step_wood.ogg' },
  { id: 'step_sand',    label: 'Песок',    hint: 'Тихие шаги по песку.',               category: 'footsteps', kind: 'sfx', defaultPath: 'sfx/footsteps/step_sand.ogg' },
  { id: 'step_water',   label: 'Вода',     hint: 'Шаги по мелководью / брод.',         category: 'footsteps', kind: 'sfx', defaultPath: 'sfx/footsteps/step_water.ogg' },
  { id: 'step_metal',   label: 'Металл',   hint: 'Шаги по металлическому настилу.',    category: 'footsteps', kind: 'sfx', defaultPath: 'sfx/footsteps/step_metal.ogg' },
  { id: 'step_snow',    label: 'Снег',     hint: 'Скрип снега под ногами.',            category: 'footsteps', kind: 'sfx', defaultPath: 'sfx/footsteps/step_snow.ogg' },
  { id: 'step_swamp',   label: 'Болото',   hint: 'Хлюпающие шаги по болоту.',          category: 'footsteps', kind: 'sfx', defaultPath: 'sfx/footsteps/step_swamp.ogg' },
  { id: 'step_leaves',  label: 'Листва',   hint: 'Шуршание сухих листьев.',            category: 'footsteps', kind: 'sfx', defaultPath: 'sfx/footsteps/step_leaves.ogg' },
  { id: 'step_carpet',  label: 'Ковёр',    hint: 'Мягкие шаги по ковру / ткани.',      category: 'footsteps', kind: 'sfx', defaultPath: 'sfx/footsteps/step_carpet.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Бой (Combat)
// ─────────────────────────────────────────────────────────────────────────────

const COMBAT_SLOTS: SoundSlot[] = [
  { id: 'combat_attack_start',  label: 'Начало атаки',    hint: 'Замах, рывок — начало удара.',                              category: 'combat', kind: 'sfx', defaultPath: 'sfx/combat/attack_start.ogg' },
  { id: 'combat_hit_physical',  label: 'Физический удар', hint: 'Звук попадания физическим ударом.',                         category: 'combat', kind: 'sfx', defaultPath: 'sfx/combat/hit_physical.ogg' },
  { id: 'combat_miss',          label: 'Промах',          hint: 'Звук промаха / рассечения воздуха.',                       category: 'combat', kind: 'sfx', defaultPath: 'sfx/combat/miss.ogg' },
  { id: 'combat_crit',          label: 'Критический удар',hint: 'Мощный звук критического попадания.',                      category: 'combat', kind: 'sfx', defaultPath: 'sfx/combat/crit.ogg' },
  { id: 'combat_block',         label: 'Блок',            hint: 'Звук блокирования удара щитом.',                           category: 'combat', kind: 'sfx', defaultPath: 'sfx/combat/block.ogg' },
  { id: 'combat_dodge',         label: 'Уклонение',       hint: 'Быстрый звук уклонения.',                                  category: 'combat', kind: 'sfx', defaultPath: 'sfx/combat/dodge.ogg' },
  { id: 'combat_take_damage',   label: 'Получить урон',   hint: 'Звук персонажа при получении урона (боль, выдох).',        category: 'combat', kind: 'sfx', defaultPath: 'sfx/combat/take_damage.ogg' },
  { id: 'combat_death_player',  label: 'Смерть игрока',   hint: 'Звук гибели персонажа игрока.',                            category: 'combat', kind: 'sfx', defaultPath: 'sfx/combat/death_player.ogg' },
  { id: 'combat_death_enemy',   label: 'Смерть врага',    hint: 'Звук гибели вражеского юнита.',                            category: 'combat', kind: 'sfx', defaultPath: 'sfx/combat/death_enemy.ogg' },
  { id: 'combat_battle_start',  label: 'Начало боя',      hint: 'Сигнал начала боевого столкновения.',                     category: 'combat', kind: 'sfx', defaultPath: 'sfx/combat/battle_start.ogg' },
  { id: 'combat_victory',       label: 'Победа',          hint: 'Фанфары победы в бою.',                                   category: 'combat', kind: 'sfx', defaultPath: 'sfx/combat/victory.ogg' },
  { id: 'combat_defeat',        label: 'Поражение',       hint: 'Мрачный звук поражения.',                                 category: 'combat', kind: 'sfx', defaultPath: 'sfx/combat/defeat.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Оружие (Weapons)
// ─────────────────────────────────────────────────────────────────────────────

const WEAPONS_SLOTS: SoundSlot[] = [
  { id: 'wpn_sword_swing',    label: 'Меч — замах',         hint: 'Звук замаха одноручного меча.',              category: 'weapons', kind: 'sfx', defaultPath: 'sfx/weapons/sword_swing.ogg' },
  { id: 'wpn_sword_hit',      label: 'Меч — удар',          hint: 'Звук удара мечом по цели.',                  category: 'weapons', kind: 'sfx', defaultPath: 'sfx/weapons/sword_hit.ogg' },
  { id: 'wpn_sword_2h_swing', label: 'Двуруч — замах',      hint: 'Тяжёлый замах двуручного меча.',             category: 'weapons', kind: 'sfx', defaultPath: 'sfx/weapons/sword_2h_swing.ogg' },
  { id: 'wpn_axe_swing',      label: 'Топор — замах',       hint: 'Свист топора в воздухе.',                    category: 'weapons', kind: 'sfx', defaultPath: 'sfx/weapons/axe_swing.ogg' },
  { id: 'wpn_axe_hit',        label: 'Топор — удар',        hint: 'Звук удара топором, рубящий звук.',           category: 'weapons', kind: 'sfx', defaultPath: 'sfx/weapons/axe_hit.ogg' },
  { id: 'wpn_bow_draw',       label: 'Лук — натяжение',     hint: 'Звук натяжения тетивы лука.',                category: 'weapons', kind: 'sfx', defaultPath: 'sfx/weapons/bow_draw.ogg' },
  { id: 'wpn_bow_release',    label: 'Лук — выстрел',       hint: 'Звук отпускания тетивы.',                    category: 'weapons', kind: 'sfx', defaultPath: 'sfx/weapons/bow_release.ogg' },
  { id: 'wpn_arrow_hit',      label: 'Стрела — попадание',  hint: 'Звук попадания стрелы в цель.',              category: 'weapons', kind: 'sfx', defaultPath: 'sfx/weapons/arrow_hit.ogg' },
  { id: 'wpn_staff_swing',    label: 'Посох — замах',       hint: 'Звук взмаха посоха.',                        category: 'weapons', kind: 'sfx', defaultPath: 'sfx/weapons/staff_swing.ogg' },
  { id: 'wpn_dagger_stab',    label: 'Кинжал — укол',       hint: 'Быстрый звук удара кинжалом.',               category: 'weapons', kind: 'sfx', defaultPath: 'sfx/weapons/dagger_stab.ogg' },
  { id: 'wpn_shield_block',   label: 'Щит — блок',          hint: 'Удар по щиту, металлический лязг.',          category: 'weapons', kind: 'sfx', defaultPath: 'sfx/weapons/shield_block.ogg' },
  { id: 'wpn_spear_thrust',   label: 'Копьё — удар',        hint: 'Звук укола копьём.',                         category: 'weapons', kind: 'sfx', defaultPath: 'sfx/weapons/spear_thrust.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Магия (Magic)
// ─────────────────────────────────────────────────────────────────────────────

const MAGIC_SLOTS: SoundSlot[] = [
  { id: 'magic_cast_start',   label: 'Начало каста',     hint: 'Нарастание магической энергии перед заклинанием.',           category: 'magic', kind: 'sfx', defaultPath: 'sfx/magic/cast_start.ogg' },
  { id: 'magic_cast_release', label: 'Выпустить заклинание', hint: 'Финальный звук при выпускании заклинания.',              category: 'magic', kind: 'sfx', defaultPath: 'sfx/magic/cast_release.ogg' },
  { id: 'magic_fire_impact',  label: 'Огонь — удар',     hint: 'Звук попадания огненного заклинания.',                      category: 'magic', kind: 'sfx', defaultPath: 'sfx/magic/fire_impact.ogg' },
  { id: 'magic_ice_impact',   label: 'Лёд — удар',       hint: 'Звук попадания ледяного заклинания, хруст льда.',            category: 'magic', kind: 'sfx', defaultPath: 'sfx/magic/ice_impact.ogg' },
  { id: 'magic_lightning',    label: 'Молния',           hint: 'Резкий звук молнии, треск.',                                 category: 'magic', kind: 'sfx', defaultPath: 'sfx/magic/lightning.ogg' },
  { id: 'magic_heal',         label: 'Исцеление',        hint: 'Мягкий, тёплый звук лечащего заклинания.',                  category: 'magic', kind: 'sfx', defaultPath: 'sfx/magic/heal.ogg' },
  { id: 'magic_curse',        label: 'Проклятие',        hint: 'Мрачный, тёмный звук наложения проклятия.',                 category: 'magic', kind: 'sfx', defaultPath: 'sfx/magic/curse.ogg' },
  { id: 'magic_teleport',     label: 'Телепортация',     hint: 'Звук телепортации / перемещения.',                          category: 'magic', kind: 'sfx', defaultPath: 'sfx/magic/teleport.ogg' },
  { id: 'magic_shield',       label: 'Магический щит',   hint: 'Активация магического защитного барьера.',                  category: 'magic', kind: 'sfx', defaultPath: 'sfx/magic/shield.ogg' },
  { id: 'magic_explosion',    label: 'Взрыв',            hint: 'Взрыв магической энергии, AoE заклинание.',                 category: 'magic', kind: 'sfx', defaultPath: 'sfx/magic/explosion.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Города (Cities)
// ─────────────────────────────────────────────────────────────────────────────

const CITIES_SLOTS: SoundSlot[] = [
  { id: 'city_enter',          label: 'Вход в город',      hint: 'Звук при входе в городские ворота.',                         category: 'cities', kind: 'sfx',     defaultPath: 'sfx/cities/city_enter.ogg' },
  { id: 'city_ambient_market', label: 'Рынок (ambient)',   hint: 'Фоновые звуки рыночной площади — голоса, торговля.',         category: 'cities', kind: 'ambient', defaultPath: 'ambient/cities/market.ogg' },
  { id: 'city_ambient_tavern', label: 'Таверна (ambient)', hint: 'Фоновый шум таверны — музыка, разговоры, кружки.',           category: 'cities', kind: 'ambient', defaultPath: 'ambient/cities/tavern.ogg' },
  { id: 'city_ambient_forge',  label: 'Кузница (ambient)', hint: 'Фоновый шум кузницы внутри города — молот, угли.',           category: 'cities', kind: 'ambient', defaultPath: 'ambient/cities/forge.ogg' },
  { id: 'city_ambient_gate',   label: 'Ворота (ambient)',  hint: 'Звуки городских ворот — стража, механизмы.',                 category: 'cities', kind: 'ambient', defaultPath: 'ambient/cities/gate.ogg' },
  { id: 'city_bell',           label: 'Колокол',           hint: 'Удар городского колокола — тревога или время.',              category: 'cities', kind: 'sfx',     defaultPath: 'sfx/cities/bell.ogg' },
  { id: 'city_music_peaceful', label: 'Мирная тема',       hint: 'Музыкальная тема мирного города.',                          category: 'cities', kind: 'music',   defaultPath: 'music/cities/peaceful.ogg' },
  { id: 'city_music_tense',    label: 'Напряжённая тема',  hint: 'Музыкальная тема при угрозе / осаде.',                      category: 'cities', kind: 'music',   defaultPath: 'music/cities/tense.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Королевства (Kingdoms)
// ─────────────────────────────────────────────────────────────────────────────

const KINGDOMS_SLOTS: SoundSlot[] = [
  { id: 'kingdom_argos_theme',   label: 'Аргос — главная тема',    hint: 'Основная музыкальная тема королевства Аргос.',     category: 'kingdoms', kind: 'music',   defaultPath: 'music/kingdoms/argos_theme.ogg' },
  { id: 'kingdom_argos_battle',  label: 'Аргос — боевая тема',     hint: 'Боевая музыка армии Аргоса.',                     category: 'kingdoms', kind: 'music',   defaultPath: 'music/kingdoms/argos_battle.ogg' },
  { id: 'kingdom_enemy_theme',   label: 'Враг — главная тема',     hint: 'Тема вражеского / тёмного королевства.',          category: 'kingdoms', kind: 'music',   defaultPath: 'music/kingdoms/enemy_theme.ogg' },
  { id: 'kingdom_neutral_theme', label: 'Нейтральное королевство', hint: 'Тема нейтрального / независимого королевства.',   category: 'kingdoms', kind: 'music',   defaultPath: 'music/kingdoms/neutral_theme.ogg' },
  { id: 'kingdom_victory_fanfare',label: 'Фанфары победы',         hint: 'Торжественные фанфары — победа королевства.',     category: 'kingdoms', kind: 'sfx',     defaultPath: 'sfx/kingdoms/victory_fanfare.ogg' },
  { id: 'kingdom_defeat_sting',  label: 'Поражение государства',   hint: 'Мрачный мотив при поражении.',                   category: 'kingdoms', kind: 'sfx',     defaultPath: 'sfx/kingdoms/defeat_sting.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Локации (Locations)
// ─────────────────────────────────────────────────────────────────────────────

const LOCATIONS_SLOTS: SoundSlot[] = [
  { id: 'loc_ambient_forest',    label: 'Лес (ambient)',       hint: 'Птицы, ветер в листве, лесные звуки.',                 category: 'locations', kind: 'ambient', defaultPath: 'ambient/locations/forest.ogg' },
  { id: 'loc_ambient_cave',      label: 'Пещера (ambient)',    hint: 'Капли воды, эхо, глубинные звуки.',                   category: 'locations', kind: 'ambient', defaultPath: 'ambient/locations/cave.ogg' },
  { id: 'loc_ambient_dungeon',   label: 'Подземелье (ambient)',hint: 'Мрачная атмосфера, цепи, скрипы.',                     category: 'locations', kind: 'ambient', defaultPath: 'ambient/locations/dungeon.ogg' },
  { id: 'loc_ambient_plains',    label: 'Равнина (ambient)',   hint: 'Открытое пространство — ветер, трава.',                category: 'locations', kind: 'ambient', defaultPath: 'ambient/locations/plains.ogg' },
  { id: 'loc_ambient_shore',     label: 'Берег (ambient)',     hint: 'Волны, чайки, морской бриз.',                          category: 'locations', kind: 'ambient', defaultPath: 'ambient/locations/shore.ogg' },
  { id: 'loc_ambient_ruins',     label: 'Руины (ambient)',     hint: 'Ветер через камни, тревожная атмосфера.',              category: 'locations', kind: 'ambient', defaultPath: 'ambient/locations/ruins.ogg' },
  { id: 'loc_music_explore',     label: 'Исследование',        hint: 'Музыка при исследовании мирной локации.',              category: 'locations', kind: 'music',   defaultPath: 'music/locations/explore.ogg' },
  { id: 'loc_music_danger',      label: 'Опасная зона',        hint: 'Напряжённая музыка опасной территории.',               category: 'locations', kind: 'music',   defaultPath: 'music/locations/danger.ogg' },
  { id: 'loc_discover',          label: 'Открытие локации',    hint: 'Звук открытия новой точки на карте.',                  category: 'locations', kind: 'sfx',     defaultPath: 'sfx/locations/discover.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// NPC
// ─────────────────────────────────────────────────────────────────────────────

const NPC_SLOTS: SoundSlot[] = [
  { id: 'npc_greet_friendly',  label: 'Приветствие (дружелюбный)',  hint: 'Дружественный NPC начинает разговор.',                  category: 'npc', kind: 'sfx', defaultPath: 'sfx/npc/greet_friendly.ogg' },
  { id: 'npc_greet_neutral',   label: 'Приветствие (нейтральный)', hint: 'Нейтральный NPC.',                                       category: 'npc', kind: 'sfx', defaultPath: 'sfx/npc/greet_neutral.ogg' },
  { id: 'npc_greet_hostile',   label: 'Агрессия',                   hint: 'Враждебный NPC агрессивно реагирует на игрока.',        category: 'npc', kind: 'sfx', defaultPath: 'sfx/npc/greet_hostile.ogg' },
  { id: 'npc_trade_open',      label: 'Открыть торговлю',           hint: 'Звук открытия торгового окна торговца.',                category: 'npc', kind: 'sfx', defaultPath: 'sfx/npc/trade_open.ogg' },
  { id: 'npc_quest_give',      label: 'Выдать квест',               hint: 'NPC выдаёт задание.',                                   category: 'npc', kind: 'sfx', defaultPath: 'sfx/npc/quest_give.ogg' },
  { id: 'npc_death',           label: 'Смерть NPC',                 hint: 'Звук гибели дружественного NPC.',                      category: 'npc', kind: 'sfx', defaultPath: 'sfx/npc/death.ogg' },
  { id: 'npc_idle_ambient',    label: 'Idle (ambient)',              hint: 'Окружающие звуки от NPC в мирном состоянии.',          category: 'npc', kind: 'sfx', defaultPath: 'sfx/npc/idle_ambient.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Карты боя (Battle Maps)
// ─────────────────────────────────────────────────────────────────────────────

const BATTLE_MAPS_SLOTS: SoundSlot[] = [
  { id: 'bmap_music_combat_01', label: 'Боевая тема 1',       hint: 'Первый боевой трек — динамичный, агрессивный.',         category: 'battle_maps', kind: 'music',   defaultPath: 'music/battle/combat_theme_01.ogg' },
  { id: 'bmap_music_combat_02', label: 'Боевая тема 2',       hint: 'Второй боевой трек — для разнообразия.',               category: 'battle_maps', kind: 'music',   defaultPath: 'music/battle/combat_theme_02.ogg' },
  { id: 'bmap_music_boss',      label: 'Тема босса',          hint: 'Эпическая тема боя с боссом.',                         category: 'battle_maps', kind: 'music',   defaultPath: 'music/battle/boss_theme.ogg' },
  { id: 'bmap_ambient_dungeon', label: 'Подземелье (ambient)',hint: 'Атмосфера подземного боевого зала.',                    category: 'battle_maps', kind: 'ambient', defaultPath: 'ambient/battle/dungeon.ogg' },
  { id: 'bmap_ambient_outdoor', label: 'Улица (ambient)',     hint: 'Звуки уличного боя на открытом воздухе.',              category: 'battle_maps', kind: 'ambient', defaultPath: 'ambient/battle/outdoor.ogg' },
  { id: 'bmap_stinger_danger',  label: 'Stinger — опасность', hint: 'Резкий звук при появлении опасного врага.',            category: 'battle_maps', kind: 'sfx',     defaultPath: 'sfx/battle/stinger_danger.ogg' },
  { id: 'bmap_stinger_victory', label: 'Stinger — победа',   hint: 'Короткий победный мотив по завершении боя.',            category: 'battle_maps', kind: 'sfx',     defaultPath: 'sfx/battle/stinger_victory.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Окружение (Ambient / Weather)
// ─────────────────────────────────────────────────────────────────────────────

const AMBIENT_SLOTS: SoundSlot[] = [
  { id: 'amb_wind_light',  label: 'Лёгкий ветер',   hint: 'Слабый ветер на открытом пространстве.',        category: 'ambient', kind: 'loop', defaultPath: 'ambient/weather/wind_light.ogg' },
  { id: 'amb_wind_strong', label: 'Сильный ветер',  hint: 'Сильный порывистый ветер, буря.',               category: 'ambient', kind: 'loop', defaultPath: 'ambient/weather/wind_strong.ogg' },
  { id: 'amb_rain_light',  label: 'Лёгкий дождь',   hint: 'Мелкий моросящий дождь.',                       category: 'ambient', kind: 'loop', defaultPath: 'ambient/weather/rain_light.ogg' },
  { id: 'amb_rain_heavy',  label: 'Ливень',          hint: 'Сильный ливень с грозой.',                      category: 'ambient', kind: 'loop', defaultPath: 'ambient/weather/rain_heavy.ogg' },
  { id: 'amb_thunder',     label: 'Гром',            hint: 'Удар грома (одиночный).',                       category: 'ambient', kind: 'sfx',  defaultPath: 'sfx/weather/thunder.ogg' },
  { id: 'amb_waterfall',   label: 'Водопад',         hint: 'Шум водопада вблизи.',                          category: 'ambient', kind: 'loop', defaultPath: 'ambient/weather/waterfall.ogg' },
  { id: 'amb_night_cricket',label: 'Ночь — сверчки', hint: 'Стрекотание сверчков в ночи.',                  category: 'ambient', kind: 'loop', defaultPath: 'ambient/weather/night_cricket.ogg' },
  { id: 'amb_fire_campfire',label: 'Костёр',         hint: 'Потрескивание огня костра.',                    category: 'ambient', kind: 'loop', defaultPath: 'ambient/weather/campfire.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Ресурсы / Профессии
// ─────────────────────────────────────────────────────────────────────────────

const RESOURCES_SLOTS: SoundSlot[] = [
  { id: 'res_mine_hit',    label: 'Удар кайлом',     hint: 'Звук добычи руды / камня.',                     category: 'resources', kind: 'sfx', defaultPath: 'sfx/resources/mine_hit.ogg' },
  { id: 'res_mine_done',   label: 'Добыча завершена',hint: 'Звук получения добытого ресурса.',               category: 'resources', kind: 'sfx', defaultPath: 'sfx/resources/mine_done.ogg' },
  { id: 'res_chop_hit',    label: 'Удар топором',     hint: 'Звук рубки дерева.',                            category: 'resources', kind: 'sfx', defaultPath: 'sfx/resources/chop_hit.ogg' },
  { id: 'res_herb_pick',   label: 'Сбор травы',       hint: 'Звук сбора травы / цветка.',                    category: 'resources', kind: 'sfx', defaultPath: 'sfx/resources/herb_pick.ogg' },
  { id: 'res_fish_splash', label: 'Рыболовство',      hint: 'Звук заброса удочки / поймана рыба.',           category: 'resources', kind: 'sfx', defaultPath: 'sfx/resources/fish_splash.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Квесты (Quests)
// ─────────────────────────────────────────────────────────────────────────────

const QUESTS_SLOTS: SoundSlot[] = [
  { id: 'quest_new',          label: 'Новый квест',         hint: 'Звук получения нового задания.',                         category: 'quests', kind: 'sfx', defaultPath: 'sfx/quests/quest_new.ogg' },
  { id: 'quest_objective_done',label: 'Цель выполнена',     hint: 'Звук выполнения промежуточной цели квеста.',             category: 'quests', kind: 'sfx', defaultPath: 'sfx/quests/objective_done.ogg' },
  { id: 'quest_complete',     label: 'Квест завершён',      hint: 'Торжественный звук завершения квеста.',                  category: 'quests', kind: 'sfx', defaultPath: 'sfx/quests/quest_complete.ogg' },
  { id: 'quest_fail',         label: 'Квест провален',      hint: 'Мрачный звук провала квеста.',                          category: 'quests', kind: 'sfx', defaultPath: 'sfx/quests/quest_fail.ogg' },
  { id: 'quest_update',       label: 'Обновление квеста',   hint: 'Звук обновления информации по квесту.',                 category: 'quests', kind: 'sfx', defaultPath: 'sfx/quests/quest_update.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// События (Events)
// ─────────────────────────────────────────────────────────────────────────────

const EVENTS_SLOTS: SoundSlot[] = [
  { id: 'event_random_start',  label: 'Случайное событие — начало', hint: 'Звук начала случайного события в мире.',         category: 'events', kind: 'sfx',  defaultPath: 'sfx/events/random_event_start.ogg' },
  { id: 'event_alarm',         label: 'Тревога',                   hint: 'Тревожный сигнал — нападение / опасность.',       category: 'events', kind: 'sfx',  defaultPath: 'sfx/events/alarm.ogg' },
  { id: 'event_discovery',     label: 'Открытие',                  hint: 'Звук важного открытия / сюжетного триггера.',     category: 'events', kind: 'sfx',  defaultPath: 'sfx/events/discovery.ogg' },
  { id: 'event_music_mystery', label: 'Таинственная музыка',        hint: 'Музыка для таинственных/сюжетных событий.',       category: 'events', kind: 'music', defaultPath: 'music/events/mystery.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Навыки (Skills)
// ─────────────────────────────────────────────────────────────────────────────

const SKILLS_SLOTS: SoundSlot[] = [
  { id: 'skill_activate',     label: 'Активация навыка',    hint: 'Общий звук активации активного навыка.',                 category: 'skills', kind: 'sfx', defaultPath: 'sfx/skills/activate.ogg' },
  { id: 'skill_passive_proc', label: 'Passive proc',        hint: 'Звук срабатывания пассивного навыка.',                   category: 'skills', kind: 'sfx', defaultPath: 'sfx/skills/passive_proc.ogg' },
  { id: 'skill_cooldown_done',label: 'Cooldown завершён',   hint: 'Звук окончания кулдауна навыка.',                        category: 'skills', kind: 'sfx', defaultPath: 'sfx/skills/cooldown_done.ogg' },
  { id: 'skill_unlock',       label: 'Навык разблокирован', hint: 'Звук изучения нового навыка.',                           category: 'skills', kind: 'sfx', defaultPath: 'sfx/skills/unlock.ogg' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Главный реестр: категория → слоты
// ─────────────────────────────────────────────────────────────────────────────

export const SOUND_SLOT_MAP: Partial<Record<SoundCategory, SoundSlot[]>> = {
  ui:           UI_SLOTS,
  inventory:    INVENTORY_SLOTS,
  footsteps:    FOOTSTEPS_SLOTS,
  combat:       COMBAT_SLOTS,
  weapons:      WEAPONS_SLOTS,
  magic:        MAGIC_SLOTS,
  cities:       CITIES_SLOTS,
  kingdoms:     KINGDOMS_SLOTS,
  locations:    LOCATIONS_SLOTS,
  npc:          NPC_SLOTS,
  battle_maps:  BATTLE_MAPS_SLOTS,
  ambient:      AMBIENT_SLOTS,
  weather:      AMBIENT_SLOTS,  // shared
  resources:    RESOURCES_SLOTS,
  quests:       QUESTS_SLOTS,
  events:       EVENTS_SLOTS,
  skills:       SKILLS_SLOTS,
};

/** Все слоты в плоском массиве */
export const ALL_SOUND_SLOTS: SoundSlot[] = Object.values(SOUND_SLOT_MAP).flat();

/** Получить слоты для категории */
export function getSlotsForCategory(category: SoundCategory): SoundSlot[] {
  return SOUND_SLOT_MAP[category] ?? [];
}

/** Получить слот по ID */
export function getSlotById(id: string): SoundSlot | undefined {
  return ALL_SOUND_SLOTS.find((s) => s.id === id);
}
