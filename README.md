# TheEnd RPG

Базовый монорепозиторий для браузерной онлайн-RPG:

- Frontend: React + TypeScript + Vite
- Backend: NestJS + TypeScript + Prisma + PostgreSQL
- Общий домен: расовые правила, статы, расчёты боевых параметров

Проект развивается как тактическая online-RPG с акцентом на позиционирование, очередность действий и честный серверный резолв боя.
Клиент отвечает за планирование и визуализацию, а backend является источником истины для валидации команд, списания ресурсов и применения эффектов.

## Структура

- `apps/frontend` — UI: регистрация, создание персонажа, профильные экраны
- `apps/backend` — API: аккаунты, персонажи, игровые правила
- `packages/rpg-domain` — общие типы и расчёты (используются и на frontend, и на backend)

## Этап 1

- Регистрация аккаунта
- Создание персонажа с выбором расы
- Распределение 5 стартовых очков
- Сохранение в PostgreSQL
- Подготовка combat-ready snapshot

## Что уже реализовано

- Базовый PvE контур боя и старт/завершение combat-сессий
- Контракт боевого плана в общем домене:
	- команды раунда (CombatCommand)
	- план раунда (CombatTurnPlan)
	- нормализация и серверная валидация команд
- Единый реестр стоимости действий (AP/STA/MP/HP) в packages/rpg-domain
- Backend API для очереди команд:
	- validate-plan
	- submit-plan
	- ready / cancel-ready
	- undo / clear
- Пошаговый резолв раунда на backend:
	- snapshot планов на момент старта резолва
	- инициатива и порядок выполнения
	- revalidation перед каждой командой
	- command_failed без обрыва всего раунда
- Обновленные правила для срыва команд:
	- повторная проверка target/range/line-of-sight/ресурсов/состояний актора
	- при revalidation fail ресурсы не списываются
- Friendly fire (P0) для area/cell эффектов:
	- эффект применяется ко всем сущностям в зоне
	- сервер считает affected targets в момент выполнения, а не при планировании
	- events содержат friendlyFire и relationToCaster
- Улучшенный battle UI:
	- локальная очередь действий и подсказки по рискам
	- warning для friendly fire
	- предупреждение при нажатии Готово для опасного плана

## Этап 2 (в процессе)

- Turn-based combat core
- Расширение area/cell эффектов (line/cone/hazard/trap-trigger)
- Более детальная логика AI с оценкой friendly fire риска
- Полноценные эффекты статусов, резисты и иммунитеты
- Дополнительные визуализации и UX подтверждения в боевом планировщике

## Локальный запуск

1. Установить зависимости в корне репозитория.
2. Поднять PostgreSQL и применить Prisma migrations для backend.
3. Запустить backend и frontend workspace-скриптами.
4. Для проверки типов использовать workspace typecheck команды.

## Admin Panel Performance Investigation

The admin panel currently feels slow mainly because of a few cumulative bottlenecks:

- `apps/frontend/src/admin/AdminApp.tsx` statically imports many admin pages, so the initial admin bundle becomes very large.
- `apps/frontend/src/services/content/contentApi.ts` routes almost every collection read through `ensureContentBackendReady()`, which first performs a full content snapshot/bootstrap step.
- `apps/frontend/src/services/content/legacyContentMigration.ts` can still read and compare large legacy localStorage datasets before normal admin work begins.
- `apps/frontend/src/services/content/models.ts` stores images as full `dataUrl` strings, and `apps/frontend/src/services/content/imageService.ts` returns all images with their payloads in one go.
- Several heavy pages load too many collections at once with `Promise.all(...)`, especially `LocationsPage`, `NpcsPage`, `DialoguesPage`, and `ItemsPage`.
- Image-heavy pages such as `ImagesPage` then render many decoded previews immediately, which blocks the main thread further.

### Highest-impact fixes

1. Remove the full snapshot/bootstrap requirement from normal collection reads.
2. Split image metadata from image payload so admin lists do not load all `dataUrl` content up front.
3. Lazy-load admin routes instead of statically importing every page into the initial admin bundle.
4. Load secondary collections only when the active tab actually needs them.
5. Virtualize long image/card lists or lazy-render previews as they scroll into view.

### Practical priority order

- Very high impact: `contentApi` bootstrap path and image payload strategy.
- High impact: route-level code splitting in `AdminApp`.
- Medium impact: page-by-page lazy data loading.
- Medium impact: virtualization and deferred preview rendering.
