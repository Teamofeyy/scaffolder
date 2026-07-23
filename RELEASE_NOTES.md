# Scaffolder 1.2.0

Scaffolder `1.2.0` is the first recipe-first MVP release. It turns the project
from a framework dropdown generator into a verified frontend Initializr: choose
a recipe, configure options, inspect the real generated files, and download the
same ZIP that the preview pipeline produced.

## Why only two recipes?

The catalog is intentionally small.

This release is not trying to win by recipe count. It is testing whether the
recipe format, block composition, generated project quality, and verification
pipeline are good enough for real developers to trust.

Current catalog:

- `react-router-app` is the recommended MVP recipe. It exercises the hard parts:
  Vite template materialization, Tailwind, React Router files, optional shadcn
  setup, optional Vitest/Zustand blocks, custom dependency injection, preview,
  ZIP generation, install, build, and verification.
- `react-vite-app` is the community baseline recipe. It keeps the contribution
  path visible without pretending that every stack is already recommended.

New recipes should arrive through recipe requests and pull requests. A recipe
can become recommended only after it is stable, reviewable, and verified.

## Highlights

- Recipe catalog first UI with Recommended and Community tabs.
- Developer workbench with options, custom dependencies, file explorer, file
  viewer, summary, verification metadata, and ZIP generation.
- Recipe-first API:
  - `GET /recipes`
  - `GET /recipes/{id}`
  - `POST /recipes/{id}/preview`
  - `POST /recipes/{id}/generate`
- Preview responses include full tree, curated tree, selected file contents,
  dependencies, dev dependencies, commands, recipe tier, support status,
  verification metadata, template snapshot, and warnings.
- Preview and generate now use the same recipe pipeline.
- Recommended recipe verification now runs manifest validation, generation,
  install, build, optional tests, preview smoke checks, forbidden script checks,
  and dependency review.
- Template update tooling tracks candidate, verified, and promoted snapshots so
  runtime generation uses local promoted templates instead of fetching GitHub
  live.
- GitHub issue templates are ready for recipe requests and technical feedback.
- The recipe catalog cards now keep stack descriptions readable on narrow
  viewports instead of truncating decision-critical text.

## API and compatibility

- Recipe-first endpoints are the new primary API surface.
- Legacy `/generate`, `/preview`, `/preview/details`, `/presets`, and
  `/verification-matrix` endpoints remain temporarily for compatibility.
- API errors distinguish invalid recipe ids, invalid options, incompatible block
  selections, invalid custom dependencies, missing templates, and generation
  failures.
- The legacy stable matrix is still the `1.1.0` ProjectConfig matrix. The new
  recipe trust model is covered by `pnpm verify:recipes`.

## Template repository

Scaffolder now consumes promoted base template snapshots through the
`apps/api/templates` submodule. The intended repository split is:

- core app: this repository;
- promoted template snapshots: `Teamofeyy/scaffolder-templates`;
- future maintenance automation: only when scheduled update volume justifies a
  separate repository;
- future community registry: only when recipe PR volume justifies it.

User generation is deterministic: production generation uses pinned local
snapshots, not live GitHub fetches.

## Upgrade notes

- Initialize submodules before building from a fresh clone:

```bash
git submodule update --init --recursive
```

- Backend Docker builds must use the repository root as the build context so
  recipe manifests and recipe file templates are present during Rust
  compilation.
- The web and API packages are aligned on version `1.2.0`.
- Keep legacy clients on old endpoints for now, but new frontend work should use
  the recipe API.

## Verification status

Completed before release preparation:

```bash
pnpm check
pnpm build
pnpm verify:recipes
pnpm verify:templates
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/run/current-system/sw/bin/google-chrome-stable pnpm --filter nextjs-scaffolder test:e2e
```

The deployment for `master` completed successfully after the Docker recipe
include fix. The final UI readability fix was verified with frontend lint,
typecheck, format check, Playwright snapshot update, Playwright e2e, and
`git diff --check`.

## Release checklist

- Push `master`.
- Create tag `v1.2.0` from the release commit.
- Create a GitHub Release using this file as the body.
- Post a technical feedback request after the release URL is live.
