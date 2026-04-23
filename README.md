# TheEnd RPG

Базовый монорепозиторий для браузерной онлайн-RPG:

- Frontend: React + TypeScript + Vite
- Backend: NestJS + TypeScript + Prisma + PostgreSQL
- Общий домен: расовые правила, статы, расчёты боевых параметров

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

## Этап 2 (следующий)

- Turn-based combat core
- Очередь ходов
- Базовые действия: attack / defend / skip
- Подготовка к магии/стихиям/эффектам
