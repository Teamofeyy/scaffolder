# Scaffolder 1.0.0

Scaffolder `1.0.0` is the first stable release. It defines the public API,
frontend workflow, template support matrix, deployment baseline, and
maintenance policy for supported generated projects.

## Highlights

- Generate supported React, Vue, and Next.js projects from a web UI.
- Preview the generated file tree before downloading a ZIP archive.
- Configure routing, styling, linting, state management, and additional npm
  dependencies.
- Use React Router component or data-router modes.
- Use Vue Router and Next.js App Router or Pages Router.
- Apply Tailwind CSS integrations for the supported React, Vue, and Next.js
  profiles.
- Search npm registry dependencies from the UI.
- Run the service through Docker Compose with readiness checks, bounded logs,
  Caddy access-log rotation, and rollback-oriented deployment diagnostics.
- Use `/live`, `/ready`, `/metrics`, `/capabilities`, `/preview`, and
  `/generate` as the stable HTTP API surface documented for this release.

## Stable support

The stable matrix is limited to the combinations listed in
`SUPPORTED_COMBINATIONS.md`:

- React + TypeScript with base CSS or Tailwind CSS, with no router, React
  Router, or React Router Data APIs.
- Vue + TypeScript with base CSS or Tailwind CSS, with no router or Vue Router.
- Next.js with App Router or Pages Router, with base CSS or Tailwind CSS.

Experimental framework templates remain available where exposed by the API, but
they are not part of the 1.0.0 compatibility guarantee.

## API and UI contract

Installer selection is not part of the 1.0.0 API or frontend contract.
Generated projects are ordinary npm ecosystem projects; release verification
uses the documented generated-project install and build commands rather than a
user-selectable installer field.

## Security and dependency status

- The frontend runtime has been updated to Next.js `15.5.20`.
- The frontend dependency graph resolves `form-data` to `4.0.6`.
- The experimental Angular template production dependency graph resolves to
  Angular `21.2.17`.
- CI keeps CycloneDX SBOM generation for production images.
- Blocking Trivy deployment gates are intentionally outside the deploy path;
  dependency review is handled as a release responsibility before tagging.

## Known limitations

- State-management presets may add dependencies without generating a complete
  store or provider integration.
- Biome and no-linter modes may leave configuration inherited from a base
  template.
- Experimental framework templates have less feature-specific patch coverage.
- The AI assistant is hidden unless the backend reports that AI
  recommendations are configured.

## Upgrade and migration notes

From `0.9.0-beta.1`:

- Remove any client usage of the old installer field before calling the API.
- Update deployment files from this release so backend containers resolve
  templates through `SCAFFOLDER_TEMPLATE_ROOT=/app/templates`.
- Rebuild and redeploy both backend and frontend images; the frontend image now
  runs from the preserved workspace layout.
- Confirm the `apps/api/templates` submodule commit is available remotely
  before tagging or deploying.

## Verification

The following release gates were completed locally for this release
preparation:

```bash
cargo fmt --manifest-path apps/api/Cargo.toml --all --check
cargo test --manifest-path apps/api/Cargo.toml --locked
pnpm --filter nextjs-scaffolder typecheck
pnpm --filter nextjs-scaffolder test
pnpm --filter nextjs-scaffolder test:e2e
pnpm run build:web
cargo clippy --manifest-path apps/api/Cargo.toml --workspace --all-targets -- -D warnings
pnpm run verify:stable-matrix
```

`pnpm run verify:stable-matrix` generated, installed, and built all 14 stable
React, Vue, and Next.js combinations.

The production deployment for the release commit must complete successfully on
`master` before creating the `v1.0.0` tag.
