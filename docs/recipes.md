# Recipes

Recipes are the future product model for Scaffolder. A recipe is a curated,
verified frontend starting point, not an arbitrary cross-product of framework,
routing, styling, state, and testing options.

The current 1.1.x product still uses the legacy `ProjectConfig` model. This
document defines the target contract for the recipe-first rewrite.

## Goals

- Let users choose a useful project shape first.
- Keep each recipe deterministic and inspectable.
- Support community contributions without accepting unreviewed code execution.
- Make verification status meaningful.
- Keep generation useful for real developers, not just a dependency list.

## Non-goals

- Recipes must not run arbitrary scripts or hooks during generation.
- Recipes must not fetch network resources at generation time.
- Recipes must not silently bypass compatibility constraints.
- Recipes must not become a generic "all checkboxes are compatible" matrix.
- The open-source core must not collect telemetry.

## Core concepts

### Base template

A base template is a pinned local snapshot from an official upstream source,
for example a Vite React TypeScript template. User generation reads local
snapshots only; it does not fetch GitHub, npm, or upstream CLIs during a
request.

### Block

A block is a reusable declarative unit that a recipe can compose.

Block categories:

- `integration` - technical setup such as Tailwind CSS, React Router,
  shadcn/ui, Vitest, Playwright, or Zustand.
- `starter` - application structure such as an app shell, dashboard layout,
  marketing page, or auth placeholder.

Blocks declare their own requirements, conflicts, provided capabilities, and
files touched.

### Recipe

A recipe is a verified composition:

```text
base template + integration blocks + starter blocks + recipe-specific patches
```

Example shape:

```yaml
id: react-router-app
name: React Router App
description: Vite, React, TypeScript, Tailwind CSS, and React Router.
tier: recommended
base_template: vite-react-ts
blocks:
  - tailwind-vite
  - react-router
options:
  ui:
    values: [none, shadcn]
  testing:
    values: [none, vitest, playwright]
  state:
    values: [none, zustand]
verification:
  install: true
  build: true
  test: optional
```

The exact schema will be introduced in a later phase. Phase 0 documents the
contract before the implementation.

## Trust tiers

### Recommended

Recommended recipes are maintainer-endorsed. They are visible first in the UI
and should be treated as the safest default choices.

Recommended recipes must pass automated verification and manual quality review.

### Community

Community recipes are accepted through pull requests and pass the baseline
checks, but they are not maintainer-endorsed as defaults.

### Experimental

Experimental recipes or blocks are available for testing but have incomplete
verification, unstable contracts, or known limitations.

### Deprecated

Deprecated recipes are kept temporarily for compatibility but are no longer
recommended. They should be hidden from the default UI.

## Recipe options

Recipes expose only the options they support. The UI must not allow a user to
combine unrelated blocks simply because those blocks exist in the repository.

Good:

```text
Recipe: React Router App
Options: ui = shadcn, testing = vitest, state = zustand
```

Bad:

```text
Framework = React, Router = Vue Router, UI = shadcn, Styling = none
```

## Custom dependencies

Users may add custom npm dependencies as advanced extras.

Rules:

- Custom dependencies only modify `package.json`.
- Scaffolder must not generate integration code for arbitrary packages.
- Custom dependencies are outside the recipe verification guarantee.
- Preview should clearly distinguish recipe dependencies from user-selected
  extras.

If a package needs generated integration code, it should become a block or a
recipe option.

## Preview contract

Recipe preview must be generated from the real materialized project. Metadata
alone is not enough.

The preview should include:

- curated file tree by default;
- "show all files" mode;
- clickable `package.json` and `README.md` in the tree;
- key config and entry files;
- dependencies and dev dependencies;
- generated commands;
- recipe tier and verification status;
- base template snapshot metadata.

Preview and ZIP generation must use the same engine.

## Legacy model

The current `ProjectConfig` shape is legacy:

```text
project_name + framework + routing + styling + linting + state + testing
```

It remains useful while the recipe engine is built, but it should not remain
the central product model. Future API and UI work should move toward:

```json
{
  "recipeId": "react-router-app",
  "projectName": "my-app",
  "options": {
    "ui": "shadcn",
    "testing": "vitest",
    "state": "zustand"
  },
  "extras": {
    "dependencies": [],
    "devDependencies": []
  }
}
```
