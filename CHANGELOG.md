# Changelog

All notable changes to Scaffolder are documented in this file.

The project follows [Semantic Versioning](https://semver.org/) and the
structure recommended by [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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
- Graceful backend shutdown on `SIGTERM`/Ctrl+C.
- CycloneDX SBOM generation for production images in CI.
- Load-test thresholds for p95 latency and error rate.
- Caddy access-log persistence and rotation.

### Changed

- Limited the visible package-manager choices to npm and pnpm for the 1.0
  release gate.
- Improved light-theme primary color contrast to satisfy WCAG AA checks.
- Locale switching now uses regular anchors so language changes perform a full
  navigation and reliably update middleware-managed locale state.
- Production Compose now includes resource limits, bounded container logs,
  readiness checks, and optional AI proxy environment variables.
- Deployment now waits for healthy services and rolls back to the previous
  environment file when the update fails.
- Deployment now normalizes the `DOMAIN` secret to a host before writing the
  production `.env`, preventing accidental path-based Caddy redirects.
- Frontend Docker builds now use the workspace `pnpm-lock.yaml`.
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
- Removed Yarn, Bun, and the unused Deno package-manager feature values from
  the public API schema and generated TypeScript bindings before `1.0.0`.

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
- Package-manager selection does not yet guarantee manager-specific lockfiles.
- Generated-project build verification does not yet cover the entire
  configuration matrix.

[Unreleased]: https://github.com/Teamofeyy/scaffolder/compare/v0.9.0-beta.1...HEAD
[0.9.0-beta.1]: https://github.com/Teamofeyy/scaffolder/releases/tag/v0.9.0-beta.1
