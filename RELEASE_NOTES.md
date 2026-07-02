# Scaffolder 1.1.0

Scaffolder `1.1.0` focuses on trust in generated output: backend-defined
presets, visible support levels, deterministic preview details, generated
project README files, and a verification matrix that the UI can display.

## Highlights

- Choose stable presets from the first configuration step.
- See Supported, Experimental, and Coming later badges for framework cards and
  presets.
- Inspect `package.json`, README, entry files, dependencies, and post-download
  commands before generating the ZIP archive.
- Use `GET /presets`, `GET /verification-matrix`, and
  `POST /preview/details` as the new 1.1.0 API surface.
- Generate README files that document the selected stack, npm commands,
  Scaffolder version, and support status.
- Verify supported presets in the stable matrix script in addition to the base
  React, Vue, and Next.js matrix.

## Stable support

The stable 1.1.0 matrix remains intentionally narrow:

- React with no router, React Router, or React Router Data APIs.
- Vue with no router or Vue Router.
- Next.js with App Router or Pages Router.
- Base CSS/CSS Modules and Tailwind CSS variants for those profiles.

Angular, Svelte, Solid, Preact, Nuxt, Qwik, Lit, Ember, and Marko remain
experimental unless a future release promotes them after install and build
verification.

## API and compatibility

- `ProjectConfig.testing` is additive and defaults to `none` when omitted.
- Existing `/generate`, `/preview`, `/features`, `/capabilities`, `/ready`,
  `/live`, and `/metrics` endpoints remain available.
- Package manager or installer selection is still intentionally absent from
  the public contract.

## Upgrade notes

- Frontend clients should fetch presets from `/presets`; do not duplicate
  preset definitions in UI code.
- Frontend clients should use `/features` or detailed preview responses for
  support status rather than maintaining local stable/experimental lists.
- Consumers that want richer preview should move from `/preview` to
  `/preview/details`; the old file-tree endpoint remains compatible.

## Verification status

Completed locally during release preparation:

```bash
cargo test --manifest-path apps/api/Cargo.toml --locked
pnpm --filter nextjs-scaffolder typecheck
pnpm --filter nextjs-scaffolder test
pnpm --filter nextjs-scaffolder lint
pnpm --filter nextjs-scaffolder test:e2e
pnpm run build:web
cargo clippy --manifest-path apps/api/Cargo.toml --workspace --all-targets -- -D warnings
pnpm run check
pnpm run verify:stable-matrix
```

HTTP smoke checks were also completed for `/presets`, `/verification-matrix`,
`/features`, and `/preview/details`.

`pnpm run verify:stable-matrix` generated, previewed, installed, and built all
14 stable combinations and all 8 supported presets.

The production deployment for the release commit must complete successfully on
`master` before creating the `v1.1.0` tag.
