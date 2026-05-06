
# Scaf API MVP Notes

## Goal

Build a minimal working scaffolder architecture based on:
- single feature registry as source of truth
- dependency resolving (`requires`)
- conflict validation (`conflicts`)
- deterministic generation order (topological sort)
- operation pipeline after template materialization

## What Was Implemented

### 1) New branch for isolated work

- Branch: `feat/mvp-feature-graph-scaffolder`

### 2) Resolver layer

- Added `api/src/resolver.rs`.
- Introduced `ResolvedPlan`:
  - `selected`: final resolved feature set
  - `ordered`: topologically sorted features
- Added `resolve_from_config(&ProjectConfig)`:
  - maps request config to initial `Feature` list
  - expands dependencies from `feature_registry().requires`
  - validates conflicts from `feature_registry().conflicts`
  - computes topological order to ensure dependency-first execution

### 3) Generation operations MVP

- Added `api/src/operations.rs`.
- Added operations:
  - `PatchPackageJson`
  - `ApplyFeatureTextPatches`
  - `ApplyFeatureTemplateCopies`
- Patches `package.json`:
  - updates `name` from `ProjectConfig.project_name` (only the `name` field value; остальное не затирается)
  - merges dependencies from `ProjectConfig.dependencies`
  - merges feature-driven dependencies (Tailwind, ReactRouter, VueRouter, Zustand, Redux, Jotai, Biome)
  - **порядок ключей в корне `package.json`**: после правки выполняется стабилизация — вверху всегда `name`, `private`, `version`, `type`, `scripts`, затем остальные поля в исходном порядке; для этого в `serde_json` включён feature `preserve_order` (иначе при `to_string_pretty` ключи уезжают в лексикографический порядок)
- Supports text replacement and template-copy hooks for feature-specific customization.

This proves feature-graph planning is active and serialized into output.

### 4) Generation pipeline integration

- Updated `api/src/generation_service.rs`:
  1. resolve plan
  2. materialize template
  3. detect copied template root
  4. rename generated root directory to sanitized `project_name`
  5. execute operations
  6. zip workspace
- `generate_project` now returns `GeneratedArchive { file_name, bytes }`.

### 5) Template resolution hardening

- Updated `api/src/template_engine.rs`:
  - template path now uses `framework.as_str()`
  - base path resolved via `CARGO_MANIFEST_DIR/../templates` (not CWD-dependent)
  - explicit error if template directory is missing

### 6) API module wiring and schema fix

- Updated `api/src/main.rs`:
  - imports `generation_service::generate_project`
  - registers new modules (`operations`, `resolver`, etc.)
  - OpenAPI `/features` response corrected to `FeatureResponse[]`
  - `/generate` now returns `Content-Disposition` filename based on `project_name` (e.g. `my-app.zip`)

### 7) Feature registry completion

- Updated `api/src/schema.rs`:
  - added missing metadata entries for framework-related features to keep resolver complete
  - fixed incorrect conflict rule:
    - `React` no longer conflicts with `Nextjs` because `Nextjs` requires `React`

### 8) Dependency update

- `serde_json` в `api/Cargo.toml` с feature **`preserve_order`**, чтобы не ломать порядок полей в `package.json`.

### 9) Примеры патчей (`templates/patches/`)

- `README.md` — зачем папка и ссылки на официальные гайды (Tailwind Vite / Next.js, shadcn).
- `examples/vite-tailwind/` — сниппеты под плагин `@tailwindcss/vite`.
- `examples/nextjs-tailwind/` — пример `postcss.config.mjs`, сниппет `globals.css`, пример блока зависимостей.
- `tailwind/.env.example.tpl` — шаблон с `{{project_name}}` для копирования в генерируемый проект (если подключено в `ApplyFeatureTemplateCopies`).

## Testing and Validation

### Command used

- `cargo test -p scaf-api`

### Result

- First run found two failing tests due to inconsistent conflict matrix (`React` vs `Nextjs`).
- After conflict fix and operation updates, all tests pass:
  - `14 passed; 0 failed`

## Why This MVP Is Correct

- Central rules (`requires`/`conflicts`) now influence real generation flow, not only API metadata.
- Dependency order is deterministic and validated in tests.
- Architecture is ready for next step: attaching real patch operations per feature.

## Suggested Next Iteration

1. Move operation definitions into feature metadata (`FeatureMeta.operations`) to remove hardcoded mappings in `operations.rs`.
2. Add combo rules for feature sets (`React + Shadcn + Tailwind`) with selective suppression:
   - suppress whole features, or
   - suppress specific operation IDs while still applying integration patches.
3. Add explicit `selected_by_user`, `effective_features`, and `suppressed_ops` to `ResolvedPlan` for transparent debugging.
4. Add `POST /plan` endpoint to preview resolved features + operation sequence before archive generation.
5. Expand patch templates under `templates/patches/*` for framework/library combinations.

## Patch Bundle System (MVP follow-up)

- Добавлен движок `templates/patches/bundles/<key>/edits.json` в `api/src/operations.rs`.
- Bundle выбирается по `framework + routing + styling`:
  1) `${frameworkKey}-${routingKey}-${stylingKey}`
  2) `${frameworkKey}-${routingKey}`
  3) `${frameworkKey}-${stylingKey}`
  4) `${frameworkKey}`
  5) `default`
- Применение сделано слоистым: `default` -> менее специфичные -> более специфичные bundles.
- Режимы правок в `edits.json`: `replace`, `append`, `insertAfter`, `insertBefore` (+ `anchor` для insert).
- Добавлены правила на уровне edit:
  - `only_if_features`
  - `unless_features`
  - `only_if_frameworks`
  - `only_if_routing`
  - `only_if_styling`
- Примерные bundles добавлены:
  - `react-ts-react-router-tailwind`
  - `nextjs-app-router-tailwind`
  - `nextjs-pages-router-tailwind`
