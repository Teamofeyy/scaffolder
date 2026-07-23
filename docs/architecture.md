# Architecture Note

Scaffolder is a recipe-based frontend Initializr. It is intentionally closer to
Spring Initializr than to a generic template gallery: users pick a useful
project shape, configure supported recipe options, inspect generated files, and
download a deterministic ZIP.

## MVP objective

The MVP solves one repeated setup pain:

```text
Create a Vite React TypeScript app with Tailwind CSS, React Router, and
optional shadcn/ui, Vitest, Zustand, and package.json-only custom dependencies.
```

The generated project must install and build. The preview must show the same
files that ZIP generation will archive.

## Runtime architecture

```text
Next.js workbench
  -> recipe-first API
  -> Rust recipe resolver
  -> promoted local base template snapshot
  -> declarative blocks and file templates
  -> preview response or ZIP archive
```

Runtime generation does not fetch GitHub, run upstream CLIs, install packages,
or execute contributor-provided code. All network freshness is moved to
maintenance tooling and CI.

## Repository boundaries

The project currently uses one core repository plus a pinned templates
submodule:

- `scaffolder` - frontend, Rust API, recipe engine, recipe/block manifests,
  schemas, verification scripts, contributor docs, and issue templates.
- `apps/api/templates` - pinned promoted template snapshots connected as a Git
  submodule. The current base template manifest pins the exact submodule commit
  and deterministic snapshot hash.

This is enough for public MVP feedback. More repositories should be introduced
only when they reduce review risk or operational coupling.

## Planned repository split

### Templates repository

Purpose: hold official upstream template snapshots and update history.

Contents:

- promoted snapshots used by Scaffolder runtime generation;
- candidate and verified snapshots during update review;
- snapshot metadata, reproducibility hashes, and source references;
- template update pull requests created by maintenance automation.

Scaffolder pins this repository by exact commit. A rollback is a submodule
commit rollback plus `pnpm verify:templates` and affected recipe verification.

### Optional maintenance automation repository

Purpose: run scheduled upstream checks without putting network polling into the
runtime product.

Contents:

- scheduled jobs that fetch upstream Vite template changes;
- calls to `scripts/template-update.mjs classify`;
- generated reports and PR plans;
- optional GitHub CLI automation for template snapshot PRs and Scaffolder
  submodule bump PRs.

This can also live in the templates repository at first. It does not need to be
created before public feedback.

### Optional community recipe registry

Purpose: separate high-volume community recipe proposals from core engine
development if contribution volume grows.

Not needed for MVP. Keeping recipes in the core repository now makes review,
schema changes, CI, and workbench behavior easier to reason about. A split is
worth it only when recipe PR volume starts slowing down core development.

## Trust model

- `recommended` recipes are maintainer-endorsed and must pass the full
  verification matrix.
- `community` recipes pass baseline checks but are not default
  recommendations.
- `experimental` recipes or blocks may change and should not be presented as
  stable defaults.

The open-source core does not add telemetry. Promotion decisions use automated
verification, manual review, and maintainer judgment.

