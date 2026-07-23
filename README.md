# Scaffolder

Веб-сервис для генерации базовой структуры frontend-проекта по выбранным параметрам. Пользователь выбирает стек, дополнительные библиотеки и получает ZIP-архив с готовым шаблоном.

## Project policies

- [License](LICENSE)
- [Changelog](CHANGELOG.md)
- [Current release notes](RELEASE_NOTES.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Support policy](SUPPORT.md)
- [Supported combinations](SUPPORTED_COMBINATIONS.md)
- [Template compatibility policy](TEMPLATE_COMPATIBILITY.md)
- [Versioning and migration policy](VERSIONING.md)

## Возможности

- Готовые presets для стабильных React, Vue и Next.js профилей.
- Backend-driven статусы Supported, Experimental и Coming later для шаблонов.
- Выбор frontend-шаблона: React, Vue, Svelte, Solid, Preact, Nuxt, Angular.
- Выбор роутинга, стилизации и state management.
- Поиск дополнительных библиотек в npm registry.
- Добавление пакетов отдельно в `dependencies` или `devDependencies`.
- Предпросмотр структуры, `package.json`, README, entry files, зависимостей и
  команд перед скачиванием.
- Генерация ZIP-архива с итоговым проектом.

## Быстрый запуск

Установите зависимости проекта одной командой из корня репозитория:

```bash
pnpm bootstrap
```

Если репозиторий был склонирован без submodules, подтяните шаблоны отдельно:

```bash
git submodule update --init --recursive
```

Без `apps/api/templates` backend не пройдет readiness-check, а предпросмотр и
генерация проектов будут недоступны.

Запустить только backend:

```bash
pnpm dev:api
```

Запустить только frontend:

```bash
pnpm dev:web
```

Запустить backend и frontend вместе:

```bash
pnpm dev
```

Откройте:

```text
http://localhost:3000
```

## Как пользоваться

1. Введите название проекта, например `my-app`.
2. Выберите preset или перейдите к ручной настройке.
3. Выберите фреймворк, роутинг, стилизацию, state management и testing.
4. В разделе инструментов найдите npm-пакет по названию.
5. Нажмите `dep`, чтобы добавить пакет в `dependencies`, или `dev`, чтобы добавить в `devDependencies`.
6. Проверьте preview tabs: структура, `package.json`, README и команды.
7. Нажмите `Сгенерировать проект`.

Браузер скачает ZIP-архив. Внутри будет `package.json` с выбранными
зависимостями, README с описанием stack и базовые файлы шаблона.

## API contract

Stable endpoints:

- `GET /presets` - backend-owned preset definitions.
- `GET /verification-matrix` - stable generation/install/build matrix.
- `POST /preview/details` - deterministic tree, key files, dependencies,
  commands, support status, and verification flags.
- `POST /preview` - backward-compatible file-tree preview.
- `POST /generate` - ZIP generation.
- `GET /features` - feature metadata with support status.
- `GET /capabilities`, `/ready`, `/live` - runtime status.

Installer or package-manager selection is not part of the API.

More detail:

- [Presets](docs/presets.md)
- [Verification matrix](docs/verification-matrix.md)
- [CLI design](docs/cli.md)

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

Пороговые значения для release gate:

```bash
LOAD_TEST_MAX_P95_MS=15000 LOAD_TEST_MAX_ERROR_RATE=0 npm run load:test:generate
```

## Frontend test gate

Component tests:

```bash
pnpm --filter nextjs-scaffolder test
```

E2E, accessibility audit, ZIP download, locale switch, and mobile regression screenshots:

```bash
pnpm --filter nextjs-scaffolder test:e2e
```

Update the mobile screenshot baseline only after reviewing the visual change:

```bash
pnpm --filter nextjs-scaffolder test:e2e:update
```

## Production health and observability

Backend endpoints:

- `/live` - process liveness.
- `/ready` - readiness for Compose health checks.
- `/health` - backward-compatible health check.
- `/capabilities` - currently reports whether AI recommendations are configured.
- `/presets` - stable preset definitions.
- `/verification-matrix` - verified stable combinations.
- `/preview/details` - deterministic detailed preview.

Administrative endpoints are disabled by default. Set
`SCAFFOLDER_ENABLE_METRICS=true` to expose backend-local `/metrics`, or
`SCAFFOLDER_ENABLE_SWAGGER=true` to expose backend-local `/swagger-ui` and
`/api-docs`. The production Caddy config does not publish these paths through
`/api/*`.

Set `CORS_ALLOWED_ORIGINS` to a comma-separated list when the API is called
directly from browsers outside the same frontend origin. The default allowlist
is `http://127.0.0.1:3000,http://localhost:3000`.

AI recommendations are optional. Set `AI_PROXY_URL` and `AI_PROXY_SECRET` in the production environment to expose the AI assistant in the frontend; otherwise the UI hides it.

## Архитектура

- `apps/web` - Next.js frontend.
- `apps/api/api` - Rust/Axum backend.
- `apps/api/templates` - шаблоны проектов, подключенные как git submodule.
- `apps/api/api/dependency-presets.json` - зависимости, которые добавляются выбранными feature-опциями.
- `scripts/load-test.mjs` - простой нагрузочный тест без внешних зависимостей.

## Перед коммитом

В репозитории настроен `pre-commit`. Он проверяет формат YAML, конец файлов,
лишние пробелы, конфликтные маркеры, а также через Turbo запускает `cargo fmt`,
`cargo clippy`, `cargo check`, frontend `eslint` и `tsc`.

Один раз установите зависимости проекта и git hooks. Если `pre-commit` не
установлен, сначала поставьте его через `pipx install pre-commit` или другим
удобным способом.

```bash
pnpm bootstrap
pre-commit install
```

Перед коммитом запустите все pre-commit проверки на всем репозитории:

```bash
pre-commit run --all-files
```

Дополнительно запустите backend-тесты, потому что они не входят в pre-commit:

```bash
cargo test --manifest-path apps/api/api/Cargo.toml --locked
```
