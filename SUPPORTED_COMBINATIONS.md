# Supported Combinations

This document defines the combinations that Scaffolder treats as stable
product behavior. An option being accepted by the API does not automatically
make every cross-product combination supported.

## Status definitions

- **Supported:** Expected to generate a usable project and included in release
  verification.
- **Experimental:** Available in the product, but integration or automated
  verification is incomplete.
- **Unsupported:** Rejected, hidden, or not covered by compatibility promises.

## Stable framework profiles

| Framework | Routing | Styling | Status |
| --- | --- | --- | --- |
| React + TypeScript | None | Base CSS | Supported |
| React + TypeScript | None | Tailwind CSS | Supported |
| React + TypeScript | React Router | Base CSS | Supported |
| React + TypeScript | React Router | Tailwind CSS | Supported |
| React + TypeScript | React Router Data APIs | Base CSS | Supported |
| React + TypeScript | React Router Data APIs | Tailwind CSS | Supported |
| Vue + TypeScript | None | Base CSS | Supported |
| Vue + TypeScript | None | Tailwind CSS | Supported |
| Vue + TypeScript | Vue Router | Base CSS | Supported |
| Vue + TypeScript | Vue Router | Tailwind CSS | Supported |
| Next.js | App Router | Base CSS | Supported |
| Next.js | App Router | Tailwind CSS | Supported |
| Next.js | Pages Router | Base CSS | Supported |
| Next.js | Pages Router | Tailwind CSS | Supported |

`Base CSS` means the styling included by the upstream template. It does not
guarantee a framework-specific CSS Modules example.

## Implemented UI matrix

The web interface exposes only the combinations listed below. The API rejects
other routing, styling, linting, and state-management combinations.

| Framework | Routing | Styling |
| --- | --- | --- |
| React + TypeScript | None, React Router, React Router Data APIs | Tailwind CSS, CSS Modules, styled-components |
| Next.js | App Router | Tailwind CSS, CSS Modules |
| Next.js | Pages Router | Tailwind CSS, CSS Modules, styled-components |
| Vue + TypeScript | None, Vue Router | Tailwind CSS, CSS Modules |
| Svelte + TypeScript | None | Tailwind CSS |
| Solid + TypeScript | None | Tailwind CSS, CSS Modules |
| Preact + TypeScript | None | Tailwind CSS, CSS Modules |
| Nuxt + TypeScript | Nuxt file-system routing | Tailwind CSS, CSS Modules |
| Angular + TypeScript | Angular Router from the base template | Tailwind CSS |

React and Next.js expose ESLint, Biome, and no-linter modes. Other visible
frameworks currently expose no additional linter because their base templates
do not share one linting contract.

These combinations are generator-integrated and covered by materialization
tests. Combinations not already listed in the stable framework profiles remain
**Experimental** until release verification completes dependency installation,
static checks, and production builds for representative generated projects.

## Experimental framework templates

The following templates are available but are not part of the stable release
matrix:

- Angular
- Ember
- Lit
- Marko
- Nuxt
- Preact
- Preact official template
- Qwik
- Solid
- Svelte

Experimental templates receive only the integrations listed in the implemented
UI matrix. No compatibility guarantee applies to options that are not exposed
or documented for that framework.

## Package managers

| Package manager | Status | Notes |
| --- | --- | --- |
| npm | Supported | Generated projects use standard `package.json` metadata. |
| pnpm | Experimental | Selection is accepted, but a pnpm lockfile is not guaranteed. |
| Yarn | Experimental | Selection is accepted, but a Yarn lockfile is not guaranteed. |
| Bun | Experimental | Selection is accepted, but a Bun lockfile is not guaranteed. |

Stable support for a package manager requires manager-specific metadata,
commands, lockfile behavior, and CI verification.

## State management

Zustand, Redux Toolkit, and Jotai are available for React and Next.js.
Scaffolder intentionally installs the selected packages without generating a
store, provider, or usage example because application state architecture is
project-specific. These dependency-only presets remain experimental until
generated-project build verification covers them.

## Linting

- ESLint preserves the applicable React or Next.js base configuration.
- Biome removes conflicting ESLint packages, files, and scripts, then creates
  `biome.json` and Biome lint scripts.
- Selecting no linter removes inherited ESLint packages, files, and scripts.
- Linting modes remain experimental until generated-project lint and build
  checks run in the release pipeline.

## Additional dependencies

Arbitrary npm dependencies are passed through to `package.json`. Scaffolder
does not guarantee that user-selected packages are compatible with each other,
the chosen framework, or the selected runtime.

## Promotion criteria

An experimental combination may be promoted to supported only after the
release pipeline verifies:

1. Project generation.
2. Dependency installation with the selected package manager.
3. Linting or static checks where configured.
4. Typechecking where applicable.
5. Production build.
