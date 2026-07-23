# Scaffolder

Scaffolder is an open-source frontend Initializr. It generates real project
archives from curated, verified recipes instead of asking developers to rebuild
the same Vite, React, Tailwind CSS, shadcn/ui, routing, testing, and project
structure setup by hand.

The current web UI still exposes the legacy framework/routing/styling
configurator. The backend now also exposes recipe-first endpoints: choose a
recipe, configure the knobs that recipe explicitly supports, inspect the
generated files, and download a ZIP.

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

## Product direction

Scaffolder is moving toward a recipe catalog:

- **Recipes** describe useful starting points such as a React Router app or a
  Vite React app.
- **Blocks** provide reusable integrations or starter structure, for example
  Tailwind CSS, React Router, shadcn/ui, Vitest, Zustand, or an app shell.
- **Pinned base templates** come from official upstream sources and are stored
  locally so generation stays deterministic.
- **Verification** proves that recommended recipes can be generated, installed,
  and built before they are promoted.
- **Custom dependencies** are allowed as package.json-only extras, but they are
  outside the verified recipe guarantee.

Read the Phase 0 design documents:

- [Recipes](docs/recipes.md)
- [Recipe authoring](docs/recipe-authoring.md)
- [Recipe review](docs/recipe-review.md)
- [Template updates](docs/template-updates.md)

Validate recipe manifests:

```bash
pnpm verify:recipes
```

## Current features

- Backend-owned presets for stable React, Vue, and Next.js profiles.
- Backend-driven support states: `supported`, `experimental`, and
  `unavailable`.
- Frontend template selection for React, Vue, Svelte, Solid, Preact, Nuxt, and
  Angular templates.
- Routing, styling, linting, state-management, and testing options.
- npm registry package search.
- Separate `dependencies` and `devDependencies` additions.
- Detailed preview for the generated tree, `package.json`, README, entry
  files, dependencies, commands, support status, and verification flags.
- ZIP archive generation.

## Quick start

Install JavaScript dependencies and fetch Cargo dependencies from the repository
root:

```bash
pnpm bootstrap
```

If the repository was cloned without submodules, initialize templates:

```bash
git submodule update --init --recursive
```

Without `apps/api/templates`, the backend readiness check fails and preview or
generation endpoints are unavailable.

Run only the backend:

```bash
pnpm dev:api
```

Run only the frontend:

```bash
pnpm dev:web
```

Run both services:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

## Current usage

The current UI is still the legacy configurator:

1. Enter a project name, for example `my-app`.
2. Choose a preset or open manual configuration.
3. Choose framework, routing, styling, state management, and testing.
4. Search npm packages if you need additional libraries.
5. Add packages to `dependencies` or `devDependencies`.
6. Inspect the generated preview.
7. Generate the project ZIP.

The generated archive contains a `package.json`, README, selected dependencies,
and template files for the chosen stack.

## API contract

Stable current endpoints:

- `GET /recipes` - recipe catalog metadata.
- `GET /recipes/{id}` - recipe manifest details.
- `POST /recipes/{id}/preview` - real materialized recipe project preview.
- `POST /recipes/{id}/generate` - recipe ZIP generation.
- `GET /presets` - backend-owned preset definitions.
- `GET /verification-matrix` - stable generation/install/build matrix.
- `POST /preview/details` - deterministic tree, key files, dependencies,
  commands, support status, and verification flags.
- `POST /preview` - backward-compatible file-tree preview.
- `POST /generate` - ZIP generation.
- `GET /features` - feature metadata with support status.
- `GET /capabilities`, `/ready`, `/live`, `/metrics` - runtime status.

Installer or package-manager selection is not part of the API.

More detail:

- [Presets](docs/presets.md)
- [Verification matrix](docs/verification-matrix.md)
- [CLI design](docs/cli.md)
- [Recipe model](docs/recipes.md)

## Updating preset dependencies

Feature dependencies are stored in:

```text
apps/api/api/dependency-presets.json
```

Update versions within the current major range:

```bash
npm run deps:update-presets
```

The script intentionally avoids switching presets to a new major version
because that may break template compatibility.

## Load testing

Before running a load test, the backend must be available at
`http://127.0.0.1:8000`.

Check ZIP generation:

```bash
npm run load:test:generate
```

Check preview:

```bash
npm run load:test:preview
```

Tune request count and concurrency:

```bash
LOAD_TEST_REQUESTS=100 LOAD_TEST_CONCURRENCY=10 npm run load:test:generate
```

The result is JSON with request counts, successes, failures, RPS, and latency
`min/p50/p95/max`.

Release gate thresholds:

```bash
LOAD_TEST_MAX_P95_MS=15000 LOAD_TEST_MAX_ERROR_RATE=0 npm run load:test:generate
```

## Frontend test gate

Component tests:

```bash
pnpm --filter nextjs-scaffolder test
```

E2E, accessibility audit, ZIP download, locale switch, and mobile regression
screenshots:

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
- `/capabilities` - reports whether AI recommendations are configured.
- `/presets` - stable preset definitions.
- `/verification-matrix` - verified stable combinations.
- `/preview/details` - deterministic detailed preview.
- `/metrics` - Prometheus-compatible generation and error counters.

AI recommendations are optional. Set `AI_PROXY_URL` and `AI_PROXY_SECRET` in
the production environment to expose the assistant in the frontend; otherwise
the UI hides it. The recipe-first MVP keeps AI outside the core flow.

## Architecture

- `apps/web` - Next.js frontend.
- `apps/api/api` - Rust/Axum backend.
- `apps/api/templates` - project templates, currently connected as a Git
  submodule.
- `apps/api/api/dependency-presets.json` - dependencies added by selected
  feature options.
- `scripts/load-test.mjs` - dependency-free load test script.

## Before committing

The repository uses `pre-commit`. It checks YAML formatting, end-of-file
markers, trailing whitespace, conflict markers, and runs Turbo tasks for
formatting, linting, typechecking, and tests where configured.

Install dependencies and hooks once:

```bash
pnpm bootstrap
pre-commit install
```

Run all pre-commit checks:

```bash
pre-commit run --all-files
```

Run backend tests separately:

```bash
cargo test --manifest-path apps/api/api/Cargo.toml --locked
```
