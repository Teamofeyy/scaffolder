# Changelog

All notable changes to Scaffolder are documented in this file.

The project follows [Semantic Versioning](https://semver.org/) and the
structure recommended by [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- Phase 7 public feedback launch materials: polished README messaging,
  architecture note, GitHub recipe request and technical feedback issue
  templates, and a recipe workbench screenshot asset.
- Templates repository setup guide documenting the sibling
  `Teamofeyy/scaffolder-templates` repository, submodule consumption, push
  flow, and verification steps.
- Phase 6 template update pipeline tooling with exact promoted snapshot
  metadata, template submodule commit/hash verification, safe diff
  classification, affected recipe verification commands, template update PR
  planning, and documentation for candidate, verified, and promoted snapshot
  states.
- Phase 5 recipe verification pipeline: `pnpm verify:recipes` now combines
  strict manifest validation with API-backed preview/generate checks,
  generated ZIP extraction, forbidden script checks, dependency review,
  install/build/test execution, Markdown/JSON reports, and CI report artifacts
  for the recipe matrix.
- Recipe-first workbench UI as the primary frontend flow, with a catalog screen,
  Recommended and Community tabs, experimental filtering, recipe cards with
  verification metadata, a three-panel recipe workspace, clickable file tree,
  curated/all files mode, preview file viewer, summary panel, and recipe ZIP
  generation through the recipe API.
- Stable recipe-first API response and error contract: recipe preview now
  includes full and curated trees, selected file contents, dependency lists,
  commands, support status, verification metadata, template snapshot, warnings,
  and typed JSON errors for invalid recipe ids, invalid options, incompatible
  blocks, invalid custom dependencies, missing templates, and generation
  failures. Generated TypeScript bindings now cover recipe API types.
- Recipe engine MVP with `GET /recipes`, `GET /recipes/{id}`,
  `POST /recipes/{id}/preview`, and `POST /recipes/{id}/generate` endpoints
  that materialize pinned base templates, compose blocks, apply structured
  operations, render recipe file templates, and generate ZIP archives.
- Recipe schema MVP with base-template, block, and recipe manifests under
  `recipes/`, plus `pnpm verify:recipes` for strict manifest and compatibility
  validation.
- Phase 0 recipe-first product documentation covering recipes, recipe
  authoring, recipe review, template update policy, and the recipe pull request
  checklist.
- Backend-driven support statuses for features and framework cards using
  `supported`, `experimental`, and `unavailable` states.
- Stable project presets from `GET /presets` for React, Vue, Next.js, and
  Minimal profiles.
- `GET /verification-matrix` with the 1.1.0 stable React/Vue/Next.js
  generation, install, and build matrix.
- `POST /preview/details` with deterministic file tree, `package.json`,
  README, entry files, dependencies, commands, support status, and verification
  flags.
- Generated project README output documenting stack choices, npm commands,
  Scaffolder version, and support status.
- Preview tabs in the frontend for structure, `package.json`, README, entry
  files, and commands.
- Frontend framework and preset badges that distinguish Supported,
  Experimental, and Coming later options.
- Additive `testing` field on project configuration with a default `none`
  value for backward-compatible API requests.
- Documentation for presets, the verification matrix, and the planned CLI MVP.
- Nix development shell tooling for Node.js 22, pnpm 10, pre-commit, and the
  repository's pinned Rust toolchain.

### Changed

- Promoted `react-router-app` to a recommended active MVP recipe and moved the
  current recipe blocks to stable after verification. `react-vite-app` is now
  an active community recipe for feedback.
- The templates submodule now points at the sibling
  `Teamofeyy/scaffolder-templates` repository and the promoted base-template
  manifest pins that repository's exact commit.
- Caddy now routes requests by the forwarded `Host` header on port 80 so it can
  run behind an external reverse proxy that connects by IP.
- The stable matrix verification script now also fetches supported presets from
  the backend and verifies each preset through generate, install, and build.
- Frontend preset definitions and support statuses now come from the backend
  instead of being duplicated in the UI.

## [1.0.0] - 2026-07-02

### Added

- Frontend unit/component testing with Vitest and Testing Library.
- Playwright E2E coverage for locale switching, preview rendering, ZIP download,
  accessibility checks, and mobile regression screenshots.
- Keyboard navigation for the preview file tree.
- AI capabilities discovery through `/capabilities`; the frontend now hides the
  AI assistant when the backend reports that AI recommendations are unavailable.
- Backend liveness (`/live`), readiness (`/ready`), and Prometheus-compatible
  `/metrics` endpoints for generation count, error count, and generation
  latency totals.
- Backend startup, readiness checks, and Docker builds now validate that the
  templates submodule inventory is present before preview or generation runs.
- Structured backend logs for startup context, HTTP request status/latency,
  generation, preview, and dependency-search diagnostics.
- Graceful backend shutdown on `SIGTERM`/Ctrl+C.
- CycloneDX SBOM generation for production images in CI.
- Load-test thresholds for p95 latency and error rate.
- Stable generated-project matrix verification for supported React, Vue, and
  Next.js profiles.
- Caddy access-log persistence and rotation.

### Changed

- Removed installer selection from the frontend and backend API contract.
- Improved light-theme primary color contrast to satisfy WCAG AA checks.
- Locale switching now uses regular anchors so language changes perform a full
  navigation and reliably update middleware-managed locale state.
- Production Compose now includes resource limits, bounded container logs,
  readiness checks, and optional AI proxy environment variables.
- Production Compose CPU limits now fit single-core VDS hosts.
- Backend production health checks now use a GET request so Axum readiness
  routes are recognized correctly.
- Deployment now waits for healthy services and rolls back to the previous
  environment file when the update fails.
- Deployment now normalizes the `DOMAIN` secret to a host before writing the
  production `.env`, preventing accidental path-based Caddy redirects.
- Frontend Docker builds now use the workspace `pnpm-lock.yaml`.
- Frontend Docker runtime images now start Next.js from the preserved
  workspace layout instead of the standalone output to avoid broken pnpm
  symlinks in production containers.
- Frontend runtime dependencies now use Next.js `15.5.20`, Axios `1.18.1`,
  `form-data` `4.0.6`, and fixed `picomatch` versions in the lockfile.
- The experimental Angular template lockfile now resolves Angular `21.2.17`
  for the production dependency graph.
- Backend template lookup now uses an explicit runtime template root in
  production containers instead of build-time Cargo paths.
- Pull requests now run the quality gate once, while pushes to `master` run
  only image build, SBOM, push, and deployment jobs.
- CI now restores Turbo, Cargo, pre-commit, Playwright browser, and Buildx
  caches to reduce repeated workflow time.
- CI no longer enables pip caching for `actions/setup-python` because this
  repository does not ship Python dependency manifests.
- Removed blocking Trivy vulnerability gates from the Docker release job;
  dependency and image vulnerability review is handled outside the deploy path.
- Removed the stale frontend npm lockfile so Docker builds use the supported
  pnpm lockfile only.

## [0.9.0-beta.1] - 2026-06-18

This is the first public beta release of Scaffolder. It establishes the
initial product, API, template, support, and versioning contracts while keeping
experimental combinations outside the stable compatibility guarantee.

### Added

- React, Vue, and Next.js project generation.
- Project structure preview before archive generation.
- npm registry dependency search.
- Routing, styling, linting, and state-management configuration.
- React Router and Vue Router patch bundles.
- Next.js App Router and Pages Router variants.
- Tailwind CSS integration for React, Vue, and Next.js.
- English and Russian user-interface localization.
- Automatic locale detection with a persisted user preference.
- Shared product branding, favicon, and Open Graph preview.
- Docker-based production deployment and CI/CD workflow.
- Release, security, support, contribution, compatibility, and versioning
  documentation.

### Changed

- Dependency presets and base templates are maintained independently from the
  application through the `apps/api/templates` Git submodule.
- Product package and crate versions are aligned under one release version.

### Known limitations

- Not every option exposed by the API has a complete implementation for every
  framework.
- Generated-project build verification does not yet cover the entire
  configuration matrix.

[Unreleased]: https://github.com/Teamofeyy/scaffolder/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Teamofeyy/scaffolder/compare/v0.9.0-beta.1...v1.0.0
[0.9.0-beta.1]: https://github.com/Teamofeyy/scaffolder/releases/tag/v0.9.0-beta.1
