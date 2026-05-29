# Scaffolder

Веб-сервис для генерации базовой структуры frontend-проекта по выбранным параметрам. Пользователь выбирает стек, дополнительные библиотеки и получает ZIP-архив с готовым шаблоном.

## Возможности

- Выбор frontend-шаблона: React, Vue, Svelte, Solid, Preact, Nuxt, Angular.
- Выбор менеджера пакетов: npm, pnpm, Yarn, Bun.
- Выбор роутинга, стилизации и state management.
- Поиск дополнительных библиотек в npm registry.
- Добавление пакетов отдельно в `dependencies` или `devDependencies`.
- Предпросмотр структуры проекта перед скачиванием.
- Генерация ZIP-архива с итоговым проектом.

## Быстрый запуск

Установите зависимости frontend:

```bash
cd apps/web
npm ci
```

Запустите backend:

```bash
cargo run --manifest-path apps/api/api/Cargo.toml --locked
```

В другом терминале запустите frontend:

```bash
cd apps/web
npm run dev
```

Откройте:

```text
http://localhost:3000
```

## Как пользоваться

1. Введите название проекта, например `my-app`.
2. Выберите фреймворк.
3. Выберите менеджер пакетов.
4. Выберите роутинг, стилизацию и state management.
5. В разделе инструментов найдите npm-пакет по названию.
6. Нажмите `dep`, чтобы добавить пакет в `dependencies`, или `dev`, чтобы добавить в `devDependencies`.
7. Проверьте предпросмотр структуры.
8. Нажмите `Сгенерировать проект`.

Браузер скачает ZIP-архив. Внутри будет `package.json` с выбранными зависимостями и базовые файлы шаблона.

## Обновление preset-зависимостей

Feature-зависимости хранятся в:

```text
apps/api/api/dependency-presets.json
```

Обновить версии в пределах текущего major:

```bash
npm run deps:update-presets
```

Скрипт не переключает preset на новый major, чтобы случайно не сломать совместимость шаблонов.

## Нагрузочная проверка

Перед запуском нагрузочного теста backend должен быть доступен на `http://127.0.0.1:8000`.

Проверить генерацию ZIP:

```bash
npm run load:test:generate
```

Проверить предпросмотр:

```bash
npm run load:test:preview
```

Настройки через переменные окружения:

```bash
LOAD_TEST_REQUESTS=100 LOAD_TEST_CONCURRENCY=10 npm run load:test:generate
```

Результат выводится в JSON: количество запросов, успешные/ошибочные ответы, RPS и latency `min/p50/p95/max`.

## Архитектура

- `apps/web` - Next.js frontend.
- `apps/api/api` - Rust/Axum backend.
- `apps/api/templates` - шаблоны проектов, подключенные как git submodule.
- `apps/api/api/dependency-presets.json` - зависимости, которые добавляются выбранными feature-опциями.
- `scripts/load-test.mjs` - простой нагрузочный тест без внешних зависимостей.

## Проверки

Backend:

```bash
cargo test --manifest-path apps/api/api/Cargo.toml --locked
```

Frontend:

```bash
cd apps/web
npm run typecheck
npm run lint
```
