# 🌍 Туториал: Живая симуляция мира

## Введение

Система **живой симуляции мира** делает игровой мир "живым" – NPC появляются на карте естественным образом (караваны путешествуют между городами, бандиты патрулируют дороги, монахи странствуют). Вместо того чтобы всегда видеть одних и тех же NPC на одних и тех же местах, игрок встречает разных торговцев, охранников и врагов, цены в городах меняются в зависимости от экономики.

## Архитектура системы

### 6 слоев симуляции:

1. **Abstract Runtime** (бэкенд) - Симуляция находящихся вне экрана сущностей
2. **Spawn Rules** - Правила появления групп (время, события, экономика)
3. **Routes** - Маршруты между городами
4. **Archetypes** - Шаблоны для создания групп (торговец, охранник, бандит)
5. **Active Entities** - Конкретные появившиеся экземпляры
6. **Visibility/Anchoring** - Спрайты на карте (привязаны, пока видны)

### Основные компоненты:

**Архетип (Archetype)** = Шаблон для NPC-группы
- Тип: торговец, охранник, бандит, монах, странник
- Экономический профиль (какие товары торгует)
- Внешний вид (спрайт на карте, портрет персонажа)

**Маршрут (Route)** = Путь между городами
- Узлы (города, остановки)
- Время путешествия
- Уровень опасности

**Правило спавна (Spawn Rule)** = Когда и как появляются группы
- Триггер: по времени, по событию, по экономике
- Размер группы
- Архетипы для спавна

**Активная сущность (Active Entity)** = Конкретная группа на карте
- Текущее состояние (путешествует, отдыхает, в городе, в бою)
- Позиция на маршруте (0.0 до 1.0)
- Участники (список NPC ID)
- Груз (для торговцов)

---

## Квик-старт (5 минут)

### Шаг 1: Добавить админ-страничку

Откройте `apps/frontend/src/admin/AdminMenu.tsx` и добавьте импорт и ссылку:

```tsx
import { WorldSimulationAdmin } from './pages/WorldSimulationAdmin';

// В AdminMenu компонента добавьте:
<NavLink to="/admin/world-sim">🌍 Живой мир</NavLink>

// В роутах:
<Route path="/admin/world-sim" element={<WorldSimulationAdmin />} />
```

### Шаг 2: Добавить слой сущностей на карту

Откройте `apps/frontend/src/worldmap/WorldMapScreen.tsx`:

```tsx
import ActiveWorldEntitiesLayer from './components/ActiveWorldEntitiesLayer';

// В render найдите <div> с картой и добавьте перед NPC-слоем:
<ActiveWorldEntitiesLayer
  playerPosition={playerPosition}
  visibilityRange={0.15}
  onEntityClick={handleEntityClick}
/>
```

### Шаг 3: Зарегистрировать модуль на бэкенде

Откройте `apps/backend/src/app.module.ts`:

```tsx
import { WorldSimulationModule } from './worldsim/world-simulation.module';

@Module({
  imports: [
    // ... остальные импорты
    WorldSimulationModule,
  ],
})
export class AppModule {}
```

### Шаг 4: Создать примеры данных

В админке (вкладка "Архетипы") создайте новый архетип:
- **ID**: `merchant_luminor`
- **Имя**: Торговец Люминора
- **Тип**: merchant
- **NPC шаблон**: `npc_merchant_luminor_01` (можно создать позже)
- **Спрайт**: `trader_world_sprite`

Потом (вкладка "Маршруты") создайте маршрут:
- **Имя**: Люминор ↔️ Архлейн
- **Узлы**: 
  - Люминор (город)
  - Граница (зона отдыха)
  - Архлейн (город)
- **Время**: 10 минут (dev), 6 часов (production)

Потом (вкладка "Правила спавна") создайте правило:
- **Имя**: Ежедневные торговцы
- **Тип**: time_based
- **Интервал**: каждые 5 минут (dev)
- **Архетипы**: `merchant_luminor`
- **Размер группы**: 1-2
- **Вероятность**: 70%

---

## Детальный гайд

### 1️⃣ Создание архетипа

Архетип = "профессия" для NPC-группы.

#### Для торговца:

```json
{
  "id": "merchant_luminor",
  "name": "Торговец из Люминора",
  "kind": "merchant",
  "npcTemplateId": "npc_merchant_01",
  "worldSpriteId": "trader_world_sprite",
  "portraitId": "human_01.png",
  "economyProfile": {
    "homeCity": "luminor",
    "targetCities": ["arklein", "crystalis"],
    "goodsCategories": ["spices", "cloth", "weapons"],
    "buyBias": 0.8,
    "sellBias": 1.3
  },
  "escorts": {
    "npcTemplateId": "npc_guard_01",
    "count": 2
  },
  "isEnabled": true
}
```

#### Для бандитов:

```json
{
  "id": "bandit_caravan",
  "name": "Банда разбойников",
  "kind": "bandit",
  "npcTemplateId": "npc_bandit_01",
  "worldSpriteId": "camp_world_sprite",
  "portraitId": "bandit_01.png",
  "isEnabled": true
}
```

#### Для монахов:

```json
{
  "id": "wandering_monks",
  "name": "Странствующие монахи",
  "kind": "monk",
  "npcTemplateId": "npc_monk_01",
  "worldSpriteId": "fire_world_sprite",
  "portraitId": "human_01.png",
  "isEnabled": true
}
```

### 2️⃣ Создание маршрута

Маршрут = путь между городами с остановками.

```json
{
  "id": "route_luminor_arklein",
  "name": "Люминор → Архлейн",
  "waypoints": [
    {
      "zoneId": "city_luminor",
      "cityId": "luminor",
      "stopDurationMin": 60,
      "stopDurationMax": 180
    },
    {
      "zoneId": "zone_forest_middle",
      "stopDurationMin": 15,
      "stopDurationMax": 30
    },
    {
      "zoneId": "city_arklein",
      "cityId": "arklein",
      "stopDurationMin": 120,
      "stopDurationMax": 240
    }
  ],
  "travelTimingDevMinutes": 10,
  "travelTimingReleaseHours": 6,
  "dangerLevel": 4,
  "restChance": 0.3,
  "allowedArchetypes": ["merchant_luminor", "patrol_guards"],
  "isActive": true
}
```

**Что означают параметры**:

- `travelTimingDevMinutes` = 10 мин в режиме разработки (ускоренное время)
- `travelTimingReleaseHours` = 6 часов в production (реальное время)
- `dangerLevel` = 4/10 (вероятность встреть врагов на дороге)
- `restChance` = 30% шанс остановиться в пути без причины

### 3️⃣ Создание правила спавна

Правило спавна = "когда и как" появляются группы.

#### Вариант 1: По времени (ежедневно в 10:00)

```json
{
  "id": "spawn_daily_merchants",
  "name": "Ежедневные торговцы",
  "spawnType": "time_based",
  "spawnTimeDevMinutes": 5,
  "spawnTimeReleaseHours": 24,
  "archetypeIds": ["merchant_luminor", "merchant_crystallis"],
  "minGroupSize": 1,
  "maxGroupSize": 3,
  "spawnWeight": 0.7,
  "cooldownDev": 10,
  "cooldownRelease": 24,
  "isActive": true
}
```

#### Вариант 2: По экономике (когда цена высокая)

```json
{
  "id": "spawn_demand_merchants",
  "name": "Торговцы при спросе",
  "spawnType": "economy_based",
  "archetypeIds": ["merchant_luminor"],
  "minGroupSize": 1,
  "maxGroupSize": 2,
  "spawnWeight": 0.5,
  "conditions": {
    "priceCategory": "spices",
    "minPrice": 150,
    "cityId": "luminor"
  },
  "cooldownDev": 30,
  "isActive": true
}
```

#### Вариант 3: Бандиты на опасной дороге

```json
{
  "id": "spawn_bandits_mountain",
  "name": "Бандиты в горах",
  "spawnType": "time_based",
  "spawnTimeDevMinutes": 15,
  "archetypeIds": ["bandit_caravan"],
  "minGroupSize": 2,
  "maxGroupSize": 4,
  "spawnWeight": 0.4,
  "cooldownDev": 20,
  "isActive": true
}
```

### 4️⃣ Мониторинг активных сущностей

В админке откройте вкладку "Монитор":

- Вы видите все активные группы на карте
- Зелёный статус = путешествует/отдыхает
- Красный статус = в бою
- Серый статус = мертв
- Синий статус = заморожен

**GM-команды**:

- 💀 **Убить** = Убить группу (заморозить на 24ч, потом respawn)
- ❄️ **Заморозить** = Заморозить на указанное время

---

## Интеграция с боевой системой

Когда игрок приближается к враждебной группе (бандиты), система автоматически:

1. Обнаруживает, что группа враждебна
2. Переводит группу в состояние `in_combat`
3. Запускает боевую карту
4. После боя:
   - Если игрок выиграл → группа переходит в `dead`, замораживается на 24ч
   - Если игрок проиграл → игрок телепортируется в город

---

## Интеграция с экономикой

### Как работают цены:

1. **Базовая цена** (фиксированная) = 100 золотых
2. **Спрос и предложение** влияют на текущую цену
3. Формула: `текущая_цена = базовая * (1 + (спрос - предложение) / 100)`

### События, влияющие на рынок:

| Событие | Эффект |
|---------|--------|
| Торговец прибыл | ↑ Предложение товара |
| Торговец убит | ↑ Спрос на товар |
| Большой заказ | ↑↑ Спрос |
| Перепроизводство | ↓ Цена |

### Пример:

```
Спицы в Люминоре:
- Базовая цена: 100 золотых
- Спрос: 80
- Предложение: 50
- Текущая цена: 100 * (1 + (80-50)/100) = 130 золотых

Прибывает торговец со спицами (добавляет 200 единиц):
- Новое предложение: 250
- Новая цена: 100 * (1 + (80-250)/100) = 83 золотых
```

---

## Визуализация спрайтов

### Спрайты в `C:\theend\Resurse\`:

| Папка | Использование |
|-------|---------------|
| `actor/` | Портреты персонажей (hover на сущности) |
| `world_sprites/` | Иконки на карте мира |
| `materials/` | Иконки товаров |

### Маппинг спрайтов:

```tsx
// В компоненте ActiveWorldEntitiesLayer:
const spriteMap = {
  'trader_world_sprite': '/sprites/world/trader_world_sprite.png',
  'camp_world_sprite': '/sprites/world/camp_world_sprite.png',
  'fire_world_sprite': '/sprites/world/fire_world_sprite.png',
  'camp_world_sprite_2': '/sprites/world/camp_world_sprite_2.png',
};

const portraitMap = {
  'human_01.png': '/sprites/actor/human_01.png',
  'dwarf_01.png': '/sprites/actor/dwarf_01.png',
  'bandit_01.png': '/sprites/actor/bandit_01.png',
  'high_elf_01.png': '/sprites/actor/high_elf_01.png',
};
```

---

## Продвинутые конфигурации

### Сценарий 1: Торговый конвой

```json
{
  "id": "trading_convoy_north",
  "name": "Северный торговый конвой",
  "kind": "merchant",
  "npcTemplateId": "npc_merchant_caravan_north",
  "worldSpriteId": "trader_world_sprite",
  "economyProfile": {
    "homeCity": "crystallis",
    "targetCities": ["luminor", "arklein", "windholm"],
    "goodsCategories": ["spices", "cloth", "weapons", "jewels"],
    "buyBias": 0.75,
    "sellBias": 1.4
  },
  "escorts": {
    "npcTemplateId": "npc_guard_knight",
    "count": 4
  }
}
```

### Сценарий 2: Ночная стража

```json
{
  "id": "night_patrol",
  "name": "Ночной дозор",
  "kind": "guard",
  "npcTemplateId": "npc_guard_captain",
  "worldSpriteId": "camp_world_sprite"
}
```

С правилом спавна:

```json
{
  "spawnType": "time_based",
  "spawnTimeReleaseHours": 24,
  "conditions": {
    "cityId": "luminor"
  },
  "archetypeIds": ["night_patrol"],
  "minGroupSize": 3,
  "maxGroupSize": 5,
  "spawnWeight": 1.0
}
```

### Сценарий 3: Динамические бандиты

```json
{
  "id": "spawn_bandits_dynamic",
  "name": "Бандиты при нехватке охраны",
  "spawnType": "economy_based",
  "archetypeIds": ["bandit_caravan"],
  "minGroupSize": 2,
  "maxGroupSize": 4,
  "spawnWeight": 0.6,
  "conditions": {
    "supplyDeficit": true,
    "priceCategory": "weapons"
  }
}
```

---

## Отладка и GM-команды

### Просмотр логов:

```
Backend: `npm run dev` → см. консоль
WorldSimulationService: debug логи каждые 10 тиков
```

### Сброс симуляции:

```typescript
// В backend console:
const worldSim = app.get(WorldSimulationService);
await worldSim.initializeSimulation(); // Перезагрузить
```

### Форсированный спавн:

Используйте админку → Монитор → (будут кнопки для ручного создания)

---

## Частые ошибки

| Ошибка | Решение |
|--------|---------|
| Сущности не видны на карте | Проверьте `isVisibleToPlayer: true` в компоненте |
| Цены не меняются | Убедитесь, что `updateMarketPrices()` вызывается каждый тик |
| Маршруты не работают | Проверьте, что `allowedArchetypes` включает архетип |
| Спавн не срабатывает | Проверьте `isActive: true` для правила и cooldown |

---

## Следующие шаги

1. **Сохранение в БД** - Добавить Prisma-модели для сохранения состояния
2. **Торговля с игроком** - Добавить возможность торговать с торговцами
3. **Квесты** - Интегрировать с системой квестов
4. **Погода и события** - Добавить триггеры по событиям (шторм, атака)
5. **Репутация** - Отслеживать, как фракции реагируют на действия игрока

---

## Быстрые ссылки на код

- **Типы**: `apps/frontend/src/types/world-simulation.types.ts`
- **Сервис симуляции**: `apps/backend/src/worldsim/world-simulation.service.ts`
- **Контроллер API**: `apps/backend/src/worldsim/world-simulation.controller.ts`
- **React хуки**: `apps/frontend/src/services/useWorldSimulation.ts`
- **Компонент карты**: `apps/frontend/src/worldmap/components/ActiveWorldEntitiesLayer.tsx`
- **Админка**: `apps/frontend/src/admin/pages/WorldSimulationAdmin.tsx`

---

**Версия**: 1.0
**Последнее обновление**: 20.05.2026
**Автор**: Live World System MVP
