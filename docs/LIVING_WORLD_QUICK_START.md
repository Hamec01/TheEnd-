# 🌍 Живой мир: Готовый старт (5 минут)

## ✅ Что уже интегрировано

- ✓ Backend модуль WorldSimulationModule
- ✓ Admin UI в меню (🌍 Живой мир)
- ✓ Слой активных сущностей на карте
- ✓ Примеры данных для торговцев и бандитов

## 🚀 Как запустить?

### Вариант 1: Через админку (рекомендуется)

1. **Запустить backend и frontend**
   ```bash
   # Terminal 1
   cd apps/backend
   npm run dev
   
   # Terminal 2
   cd apps/frontend
   npm run dev
   ```

2. **Открыть админку**
   - Перейти на `http://localhost:5173/admin`
   - Внизу меню слева найти "🌍 Живой мир"

3. **Добавить торговцев**
   - Вкладка "Архетипы" → "➕ Создать архетип"
   - Заполнить форму (используйте данные ниже)
   - Сохранить

4. **Добавить маршруты**
   - Вкладка "Маршруты" → "➕ Создать маршрут"
   - Определить узлы (города/зоны)
   - Установить время путешествия

5. **Включить спавн**
   - Вкладка "Правила спавна" → "➕ Создать правило спавна"
   - Выбрать архетипы, интервал, вероятность
   - Активировать

6. **Смотреть монитор**
   - Вкладка "Монитор" → видеть активные сущности на карте
   - Жать кнопки kill/freeze для тестирования

### Вариант 2: Через curl (для быстрого тестирования)

```bash
# Создать архетип торговца
curl -X POST http://localhost:3000/api/world-simulation/archetypes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "merchant_test",
    "name": "Тестовый торговец",
    "kind": "merchant",
    "npcTemplateId": "npc_merchant_01",
    "worldSpriteId": "trader_world_sprite",
    "portraitId": "human_01.png",
    "isEnabled": true
  }'

# Создать маршрут
curl -X POST http://localhost:3000/api/world-simulation/routes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "route_test",
    "name": "Люминор -> Архлейн",
    "waypoints": [
      {"zoneId": "city_luminor", "cityId": "luminor"},
      {"zoneId": "zone_forest_middle"},
      {"zoneId": "city_arklein", "cityId": "arklein"}
    ],
    "travelTimingDevMinutes": 5,
    "travelTimingReleaseHours": 2,
    "dangerLevel": 3,
    "restChance": 0.25,
    "allowedArchetypes": ["merchant_test"],
    "isActive": true
  }'

# Создать правило спавна
curl -X POST http://localhost:3000/api/world-simulation/spawn-rules \
  -H "Content-Type: application/json" \
  -d '{
    "id": "spawn_test",
    "name": "Тестовые торговцы",
    "spawnType": "time_based",
    "spawnTimeDevMinutes": 5,
    "archetypeIds": ["merchant_test"],
    "minGroupSize": 1,
    "maxGroupSize": 1,
    "spawnWeight": 1.0,
    "cooldownDev": 10,
    "isActive": true
  }'

# Просмотреть текущее состояние
curl http://localhost:3000/api/world-simulation/snapshot | jq
```

---

## 📋 Готовые примеры данных

### Торговцы

#### Архетип 1: Торговец Люминора
```json
{
  "id": "merchant_luminor_trader",
  "name": "Торговец Люминора",
  "kind": "merchant",
  "npcTemplateId": "npc_merchant_luminor_01",
  "worldSpriteId": "trader_world_sprite",
  "portraitId": "human_01.png",
  "economyProfile": {
    "homeCity": "luminor",
    "targetCities": ["arklein", "crystallis"],
    "goodsCategories": ["spices", "cloth"],
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

#### Архетип 2: Торговец Архлейна
```json
{
  "id": "merchant_arklein_trader",
  "name": "Торговец Архлейна",
  "kind": "merchant",
  "npcTemplateId": "npc_merchant_arklein_01",
  "worldSpriteId": "trader_world_sprite",
  "portraitId": "dwarf_01.png",
  "economyProfile": {
    "homeCity": "arklein",
    "targetCities": ["luminor", "crystallis"],
    "goodsCategories": ["weapons", "materials"],
    "buyBias": 0.75,
    "sellBias": 1.4
  },
  "escorts": {
    "npcTemplateId": "npc_guard_01",
    "count": 3
  },
  "isEnabled": true
}
```

#### Маршрут: Люминор ↔ Архлейн
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
  "dangerLevel": 3,
  "restChance": 0.25,
  "allowedArchetypes": ["merchant_luminor_trader"],
  "isActive": true
}
```

#### Правило спавна: Ежедневные торговцы
```json
{
  "id": "spawn_merchants_daily",
  "name": "Ежедневные торговцы",
  "spawnType": "time_based",
  "spawnTimeDevMinutes": 5,
  "spawnTimeReleaseHours": 24,
  "archetypeIds": ["merchant_luminor_trader", "merchant_arklein_trader"],
  "minGroupSize": 1,
  "maxGroupSize": 2,
  "spawnWeight": 0.7,
  "cooldownDev": 10,
  "cooldownRelease": 24,
  "isActive": true
}
```

---

### Бандиты

#### Архетип: Горные разбойники
```json
{
  "id": "bandit_mountain_gang",
  "name": "Банда горных разбойников",
  "kind": "bandit",
  "npcTemplateId": "npc_bandit_01",
  "worldSpriteId": "camp_world_sprite",
  "portraitId": "bandit_01.png",
  "isEnabled": true
}
```

#### Маршрут: Горный патруль
```json
{
  "id": "route_bandit_mountain_patrol",
  "name": "Горный патруль разбойников",
  "waypoints": [
    {"zoneId": "zone_mountain_pass", "stopDurationMin": 30, "stopDurationMax": 60},
    {"zoneId": "zone_mountain_north", "stopDurationMin": 20, "stopDurationMax": 45},
    {"zoneId": "zone_mountain_pass", "stopDurationMin": 30, "stopDurationMax": 60}
  ],
  "travelTimingDevMinutes": 8,
  "travelTimingReleaseHours": 5,
  "dangerLevel": 7,
  "restChance": 0.4,
  "allowedArchetypes": ["bandit_mountain_gang"],
  "isActive": true
}
```

#### Правило спавна: Бандиты в горах
```json
{
  "id": "spawn_bandits_mountains",
  "name": "Бандиты в горах",
  "spawnType": "time_based",
  "spawnTimeDevMinutes": 15,
  "spawnTimeReleaseHours": 12,
  "archetypeIds": ["bandit_mountain_gang"],
  "minGroupSize": 2,
  "maxGroupSize": 4,
  "spawnWeight": 0.6,
  "cooldownDev": 20,
  "cooldownRelease": 12,
  "isActive": true
}
```

---

## 🎮 Как это видит игрок?

1. **На карте мира** (во время игры)
   - Видит спрайты (тележка для торговца, лагерь для бандитов)
   - При наведении мышки видит портрет NPC
   - При клике... (сейчас просто логирует, но потом откроется диалог/бой)

2. **В чате игрока**
   - "Банда разбойников атакует вас при приближении!"
   - "Торговец из Люминора прибыл"

3. **В админке**
   - Вкладка "Монитор" показывает все живые сущности
   - Видно: статус, прогресс маршрута, HP, ID
   - Можно убить, заморозить, телепортировать

---

## ⚙️ Параметры для настройки

| Параметр | Что означает | Пример |
|----------|-------------|--------|
| `travelTimingDevMinutes` | Минуты (dev версия, ускоренное время) | 5 = 5 минут реального времени |
| `travelTimingReleaseHours` | Часы (production версия, нормальное время) | 6 = 6 часов реального времени |
| `spawnTimeDevMinutes` | Как часто спавнить (dev) | 5 = каждые 5 минут пытаемся спавнить |
| `spawnWeight` | Вероятность спавна (0.0-1.0) | 0.7 = 70% шанс спавнить |
| `minGroupSize` / `maxGroupSize` | Размер группы | 1-2 = от 1 до 2 сущностей |
| `dangerLevel` | Опасность маршрута (0-10) | 7 = очень опасно |
| `buyBias` | На какой % дешевле покупаем | 0.8 = покупаем на 20% дешевле |
| `sellBias` | На какой % дороже продаем | 1.3 = продаем на 30% дороже |

---

## 📚 Полная документация

- [LIVING_WORLD_TUTORIAL.md](../LIVING_WORLD_TUTORIAL.md) - Полный гайд на русском
- [LIVING_WORLD_INTEGRATION.md](../LIVING_WORLD_INTEGRATION.md) - Техническая интеграция
- [living-world-merchants.json](./living-world-merchants.json) - Примеры торговцев
- [living-world-bandits.json](./living-world-bandits.json) - Примеры бандитов

---

## 🐛 Troubleshooting

### Сущности не видны на карте
**Решение**: Убедитесь что:
1. Правило спавна активно (`isActive: true`)
2. Архетип существует и активен
3. Маршрут существует и активен
4. Запущены `npm run dev` на backend и frontend
5. Проверьте консоль браузера (F12)

### Нет активных сущностей в мониторе
**Решение**: Дождитесь срабатывания спавна:
- Каждые 10 сек (dev) или 24ч (production) происходит проверка
- Вероятность спавна = `spawnWeight` (0.7 = 70%)
- Если повезет, появится одна-две сущности

### Сущность исчезла с карты
**Решение**: Это нормально! Когда сущность:
- Прошла весь маршрут до конца → заходит в город и исчезает
- Была убита → замораживается на 24ч, потом respawn
- Вышла из видимости → исчезает (появится снова если подойдешь)

### API возвращает 404
**Решение**: Убедитесь что:
1. Backend запущен на `localhost:3000`
2. Модуль зарегистрирован в `app.module.ts`
3. Перезагрузите backend (`npm run dev`)

---

**Версия**: 1.0 Готовый старт  
**Дата**: 20.05.2026  
**Статус**: ✅ Готово к использованию
