# Changelog

All notable changes to Scaffolder are documented in this file.

The project follows [Semantic Versioning](https://semver.org/) and the
structure recommended by [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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
