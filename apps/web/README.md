# Scaffolder Web

Frontend-интерфейс генератора шаблонов. Основная пользовательская инструкция находится в корневом [README.md](../../README.md).

## Запуск

```bash
npm ci
npm run dev
```

По умолчанию frontend проксирует `/api/*` на `http://127.0.0.1:8000`.

Если backend запущен по другому адресу:

```bash
BACKEND_API_URL=http://127.0.0.1:9000 npm run dev
```

## Проверки

```bash
npm run typecheck
npm run lint
```
