# Recipe Verification

Recipe verification makes Scaffolder trust tiers enforceable.

## Commands

Run the full Phase 5 verifier:

```bash
pnpm verify:recipes
```

This command runs strict manifest validation first, then verifies generated
projects through the recipe-first API pipeline.

Manifest-only validation remains available for quick authoring feedback:

```bash
pnpm verify:recipes:manifests
```

Runtime project verification can be run directly:

```bash
pnpm verify:recipes:projects
```

Useful options:

```bash
pnpm verify:recipes:projects -- --recipe react-router-app
pnpm verify:recipes:projects -- --tier recommended
pnpm verify:recipes:projects -- --full-matrix-all
```

## Automated Checks

For every non-deprecated recipe, the runtime verifier:

- starts the Rust API on an isolated local port;
- calls `POST /recipes/{id}/preview`;
- validates that preview includes tree data, selected files, commands,
  verification metadata, and template snapshot information;
- calls `POST /recipes/{id}/generate`;
- extracts the generated ZIP;
- rejects forbidden lifecycle scripts and suspicious script fragments;
- reviews dependency names and version specifiers;
- runs the canonical install command from preview metadata;
- runs `npm run build`;
- runs `npm test` when the generated project enables a test script.

Recommended recipes run across their full option matrix. Community and
experimental recipes run their default baseline unless `--full-matrix-all` is
used.

## CI Report

CI writes:

- `artifacts/recipe-verification/report.md`;
- `artifacts/recipe-verification/report.json`.

The Markdown report is appended to the GitHub Actions job summary and uploaded
as an artifact. Contributors should be able to see which recipe variant failed
and which check failed without reading raw logs first.

## Recommended Gate

A recipe cannot be promoted to `recommended` unless:

- manifest validation passes;
- the recipe has `status: active`;
- `verification.generate`, `verification.install`, and `verification.build`
  are all `true`;
- the base template is `verified` or `promoted`;
- every block reachable from required blocks and option values is `stable`;
- `package.json` and `README.md` are included in curated preview files;
- the full runtime option matrix passes in CI;
- the maintainer completes the recommended promotion checklist.

## Community Gate

A community recipe must pass:

- manifest validation;
- default generation;
- preview smoke;
- forbidden script/hook checks;
- dependency review;
- install;
- build;
- maintainer checklist review.

Community recipes are accepted as useful contributions, not as maintainer
endorsements.
