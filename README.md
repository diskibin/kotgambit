# Кот Гамбит

Русскоязычная платформа для обучения шахматам: сайт, мобильное приложение для Android и API.
Обучение построено вокруг кота-наставника Гамбита: короткие главы, мгновенная обратная связь
от кота, задачи, партии с ботами и разбор позиций.

Проект source-available, а не open source: код под [PolyForm Noncommercial 1.0.0](LICENSE),
графика и персонаж под [LICENSE-ASSETS](LICENSE-ASSETS) (все права защищены).

## Что внутри

- **Главы** четырёх треков: основы, дебюты, миттельшпиль, эндшпиль. Позиции и линии проверяются
  через chess.js.
- **Задачи** из базы Lichess с темами на русском, подсказками в три уровня и ежедневной задачей.
- **Партии с ботами.** Боты бесплатны для всех, нагрузка ограничивается очередью и rate limit.
- **Анализ** позиции и разбор партии на Stockfish: оценка, лучший ход, варианты.
- **Прогресс:** серии дней, ежедневная цель, награды, карточки из собственных ошибок.
- **Премиум** через ЮKassa. Сервер единственный источник истины, клиенты платёж не подтверждают.

## Стек

| Область   | Выбор                                                                        |
| --------- | ---------------------------------------------------------------------------- |
| Монорепо  | pnpm workspaces, Turborepo, TypeScript strict                                |
| Web       | React, Vite, Tailwind CSS                                                    |
| Mobile    | React Native без Expo (Android)                                              |
| Состояние | Redux Toolkit, серверные данные через RTK Query                              |
| API       | NestJS на Fastify, Prisma, PostgreSQL, Redis                                 |
| Контракты | Zod-схемы в `packages/contracts`, общие для API и клиентов                   |
| Шахматы   | chess.js в `packages/chess-core`, Stockfish как отдельный процесс на сервере |
| Тесты     | Vitest, Jest, Testing Library, MSW, Testcontainers                           |

## Структура

```
apps/api        NestJS
apps/web        React + Vite
apps/mobile     React Native
packages/       общий код без привязки к платформе: chess-core, contracts, api-client,
                coach, mascot, locales, плееры уроков, задач и партий и другие
content/        бесплатные главы, темы задач, боты
tools/          проверка контента, content-guard, генераторы ассетов
infra/          compose для локальной разработки
```

## Быстрый старт

Нужны Node.js 24+, pnpm и Docker (для Postgres и Redis).

```
cp .env.example .env     # значения по умолчанию подходят для локального запуска
pnpm start:local
```

Скрипт ставит зависимости, поднимает Postgres и Redis, применяет миграции, заливает контент
и запускает API (`http://localhost:3000`) и сайт (`http://localhost:5173`). Повторно
`pnpm setup` гонять не нужно: дальше хватит `pnpm services:up` и
`pnpm dev --filter @kotgambit/api --filter @kotgambit/web`.

Без `SMTP_URL` письма со ссылками (подтверждение почты, сброс пароля) пишутся в лог API. Чтобы открывать их как настоящие, впиши в `.env` `SMTP_URL=smtp://localhost:1025`: `pnpm services:up` запускает Mailpit, ящик на `http://localhost:8025`.

### Движок

Анализ и разбор партий работают на Stockfish, который в репозиторий не входит. Скачай бинарник
с [официальных релизов](https://github.com/official-stockfish/Stockfish/releases) (в CI
закреплена `sf_19`) и укажи путь в `.env`:

```
ENGINE_PATH=C:/tools/stockfish/stockfish-windows-x86-64-avx2.exe
```

Без `ENGINE_PATH` анализ отвечает 503, остальное работает. Остальные настройки движка описаны в
[.env.example](.env.example).

### Мобильное приложение

```
pnpm --filter @kotgambit/mobile dev        # Metro
pnpm --filter @kotgambit/mobile android    # сборка и запуск на устройстве или эмуляторе
```

Нужны Android SDK и эмулятор. В режиме разработки приложение ходит к API по адресу
`http://10.0.2.2:3000`, так эмулятор Android видит компьютер, на котором запущен API.

## Проверки

```
pnpm lint
pnpm typecheck
pnpm test
pnpm validate:content   # схема и chess.js для всех глав, словарь тем, боты
pnpm content-guard      # в публичном репозитории только бесплатный контент
```

Перед коммитом работают husky, lint-staged, commitlint (Conventional Commits) и gitleaks.
Мобильные тесты при общем `pnpm test` могут упираться в таймауты на загруженной машине, по
отдельности (`pnpm --filter @kotgambit/mobile test`) они проходят.

## Безопасность

В репозитории нет секретов, персональных данных и платного контента. Все значения только в
`.env`, в git лежит `.env.example`. О найденных уязвимостях сообщай по [SECURITY.md](SECURITY.md).
Сторонние данные и лицензии: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
