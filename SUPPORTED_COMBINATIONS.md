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

## Stable presets

`GET /presets` exposes the stable presets used by the frontend and matrix
verification:

| Preset | Framework | Routing | Styling | Linting | State | Testing |
| --- | --- | --- | --- | --- | --- | --- |
| React SPA | React | None | CSS Modules | ESLint | none | none |
| React Router App | React | React Router | Tailwind CSS | ESLint | none | none |
| React Router Data App | React | React Router Data APIs | Tailwind CSS | ESLint | none | none |
| Vue App | Vue | None | Tailwind CSS | ESLint | none | none |
| Vue Router App | Vue | Vue Router | Tailwind CSS | ESLint | none | none |
| Next.js App Router | Next.js | App Router | Tailwind CSS | ESLint | none | none |
| Next.js Pages Router | Next.js | Pages Router | Tailwind CSS | ESLint | none | none |
| Minimal | React | None | CSS Modules | none | none | none |

Supported presets must remain backend-owned and must be included in
`pnpm run verify:stable-matrix`.

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

Experimental templates are copied from their base template and may not receive
feature-specific routing, styling, linting, or state-management patches.

## State management

Zustand, Redux Toolkit, and Jotai dependency presets are experimental.
Scaffolder may add packages without generating a framework-specific store,
provider, or usage example.

## Testing

`testing` is an additive configuration field and defaults to `none` for
backward-compatible API requests. Vitest and Playwright remain experimental
until generated test files, dependencies, `npm test`, and build verification
are covered by the stable matrix.

## Linting

- The base template's linting configuration is supported.
- Biome selection is experimental until it replaces conflicting ESLint files
  and scripts in every applicable template.
- Selecting no linter is experimental where the base template already contains
  linting configuration.

## Additional dependencies

Arbitrary npm dependencies are passed through to `package.json`. Scaffolder
does not guarantee that user-selected packages are compatible with each other,
the chosen framework, or the selected runtime.

## Promotion criteria

An experimental combination may be promoted to supported only after the
release pipeline verifies:

1. Project generation.
2. Dependency installation with the release verification command.
3. README generation and detailed preview coverage.
4. Linting or static checks where configured.
5. Typechecking where applicable.
6. Production build.
