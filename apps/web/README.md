# Scaffolder Web

Frontend-интерфейс генератора шаблонов. Основная пользовательская инструкция находится в корневом [README.md](../../README.md).

## Запуск

Из корня репозитория:

```bash
pnpm bootstrap
pnpm dev:web
```

По умолчанию frontend проксирует `/api/*` на `http://127.0.0.1:8000`.

Если backend запущен по другому адресу:

```bash
BACKEND_API_URL=http://127.0.0.1:9000 pnpm dev:web
```

## Проверки

Из корня репозитория:

```bash
pnpm typecheck
pnpm lint
```
