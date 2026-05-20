# Интеграция системы живого мира

## Быстрая интеграция (15 минут)

### ✅ Что уже готово

- ✓ Типы для бэкенда и фронтенда
- ✓ Сервис симуляции (WorldSimulationService) с 6 слоями
- ✓ REST API контроллер для админки
- ✓ NestJS модуль
- ✓ React хуки для управления данными
- ✓ Компонент отображения активных сущностей на карте
- ✓ Админка с 4 вкладками (Архетипы, Маршруты, Спавн-правила, Монитор)
- ✓ Полный туториал на русском

### 📋 Чеклист интеграции

- [ ] 1. Зарегистрировать `WorldSimulationModule` в `apps/backend/src/app.module.ts`
- [ ] 2. Добавить хук вызова симуляции в фронтенд админку
- [ ] 3. Добавить ссылку на админку в меню
- [ ] 4. Встроить `ActiveWorldEntitiesLayer` в `WorldMapScreen.tsx`
- [ ] 5. Протестировать создание архетипа/маршрута/правила спавна
- [ ] 6. Синхронизировать типы фронт/бэк при необходимости
- [ ] 7. Добавить Prisma-модели для сохранения в БД (опционально)
- [ ] 8. Интегрировать с боевой системой (опционально)

### 🔧 Файлы для интеграции

**Бэкенд** (уже созданы):
- `apps/backend/src/worldsim/types/world-simulation.types.ts` - Типы
- `apps/backend/src/worldsim/world-simulation.service.ts` - Основной сервис
- `apps/backend/src/worldsim/world-simulation.controller.ts` - REST API
- `apps/backend/src/worldsim/world-simulation.module.ts` - NestJS модуль

**Фронтенд** (уже созданы):
- `apps/frontend/src/types/world-simulation.types.ts` - Типы (синхро с бэком)
- `apps/frontend/src/services/useWorldSimulation.ts` - React хуки
- `apps/frontend/src/worldmap/components/ActiveWorldEntitiesLayer.tsx` - Слой сущностей
- `apps/frontend/src/worldmap/components/ActiveWorldEntities.css` - Стили
- `apps/frontend/src/admin/pages/WorldSimulationAdmin.tsx` - Админка
- `apps/frontend/src/admin/pages/WorldSimulationAdmin.css` - Стили админки

**Документация**:
- `docs/LIVING_WORLD_TUTORIAL.md` - Полный туториал (русский)

### 🎯 Минимальные шаги для запуска

#### Шаг 1: Backend - Зарегистрировать модуль

**Файл**: `apps/backend/src/app.module.ts`

```typescript
import { WorldSimulationModule } from './worldsim/world-simulation.module';

@Module({
  imports: [
    // ... другие импорты
    WorldSimulationModule, // 👈 ДОБАВИТЬ
  ],
})
export class AppModule {}
```

#### Шаг 2: Frontend - Добавить админку в меню

**Файл**: `apps/frontend/src/admin/AdminMenu.tsx` (или похожий)

```tsx
import { WorldSimulationAdmin } from './pages/WorldSimulationAdmin';

// В компоненте меню добавить:
<NavLink to="/admin/world-sim">🌍 Живой мир</NavLink>

// В роутах:
<Route path="/admin/world-sim" element={<WorldSimulationAdmin />} />
```

#### Шаг 3: Frontend - Встроить слой на карту

**Файл**: `apps/frontend/src/worldmap/WorldMapScreen.tsx`

```tsx
import ActiveWorldEntitiesLayer from './components/ActiveWorldEntitiesLayer';

// В JSX (где рендерятся NPC):
<ActiveWorldEntitiesLayer
  playerPosition={playerPosition}
  visibilityRange={0.15} // 15% от размера карты
  onEntityClick={(id) => console.log('Clicked:', id)}
/>
```

#### Шаг 4: Запустить и протестировать

```bash
# Terminal 1: Backend
cd apps/backend
npm run dev

# Terminal 2: Frontend
cd apps/frontend
npm run dev

# Открыть localhost:5173 → Admin → Живой мир → Архетипы
```

### 📦 Зависимости

Все используемые зависимости уже в проекте:
- NestJS (backend)
- React (frontend)
- TypeScript (везде)

Дополнительно **не требуется**!

### 🐛 Типичные проблемы при интеграции

| Проблема | Причина | Решение |
|----------|---------|---------|
| 404 на `/api/world-simulation/*` | Модуль не зарегистрирован | Проверьте `app.module.ts` |
| Компонент не отрисовывается | Неправильный путь импорта | Проверьте абсолютные пути |
| Типы не совпадают фронт/бэк | Расхождение типов | Скопируйте типы из бэка в фронт |
| Спрайты не загружаются | Путь к изображениям неверный | Проверьте `/public/sprites/` |

### 📊 Примеры использования

#### Создать архетип торговца (curl):

```bash
curl -X POST http://localhost:3000/api/world-simulation/archetypes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "merchant_test",
    "name": "Тестовый торговец",
    "kind": "merchant",
    "npcTemplateId": "npc_merchant_01",
    "worldSpriteId": "trader_world_sprite",
    "isEnabled": true
  }'
```

#### Создать маршрут (curl):

```bash
curl -X POST http://localhost:3000/api/world-simulation/routes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "route_test",
    "name": "Тестовый маршрут",
    "waypoints": [
      {"zoneId": "zone_1", "cityId": "city_1"},
      {"zoneId": "zone_2"},
      {"zoneId": "zone_3", "cityId": "city_2"}
    ],
    "travelTimingDevMinutes": 5,
    "travelTimingReleaseHours": 2,
    "dangerLevel": 3,
    "restChance": 0.25,
    "allowedArchetypes": ["merchant_test"],
    "isActive": true
  }'
```

#### Создать правило спавна (curl):

```bash
curl -X POST http://localhost:3000/api/world-simulation/spawn-rules \
  -H "Content-Type: application/json" \
  -d '{
    "id": "spawn_test",
    "name": "Тестовое правило",
    "spawnType": "time_based",
    "spawnTimeDevMinutes": 5,
    "archetypeIds": ["merchant_test"],
    "minGroupSize": 1,
    "maxGroupSize": 2,
    "spawnWeight": 0.8,
    "cooldownDev": 10,
    "isActive": true
  }'
```

### 🚀 Следующие этапы после интеграции

1. **Добавить Prisma модели** - Сохранять состояние в БД
2. **Боевая интеграция** - Враждебные сущности → автоматический бой
3. **Торговля** - Игрок может торговать с торговцами
4. **События** - Логирование всех действий в живом мире
5. **Графики** - Dashboard с анализом экономики

---

**Статус**: ✅ MVP готов к интеграции
**Время интеграции**: ~15 минут
**Сложность**: 🟢 Низкая (просто добавить импорты)
