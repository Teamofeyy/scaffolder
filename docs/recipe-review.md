# Recipe Review

Recipe review protects trust in Scaffolder. A recipe that generates but does
not build, or builds but produces poor project structure, should not be promoted
as recommended.

## Trust model

### Community acceptance

Community recipes must pass the baseline checks and avoid obvious quality or
security issues. They are accepted into the repository but are not endorsed as
the best default.

Checklist:

- Manifest is valid.
- Recipe uses an existing pinned base template.
- Recipe is declarative and has no arbitrary scripts or hooks.
- Blocks declare requirements, conflicts, provided capabilities, and files
  touched.
- Generated project can be materialized.
- Install and build checks pass when verification tooling exists.
- Dependencies are reasonable for the stated recipe.
- Recipe does not duplicate an existing recipe without a clear reason.
- README or generated docs explain the resulting stack.
- Maintainer/owner is identified once community ownership is supported.

### Recommended promotion

Recommended recipes are maintainer-endorsed.

Promotion checklist:

- All community acceptance checks pass.
- Verification is stable across repeated runs.
- Generated file structure is clean and understandable.
- Defaults are useful for a broad audience.
- No unnecessary dependencies are included.
- UI skeletons, if present, are accessible enough for a starter.
- Preview shows the important files clearly.
- The maintainer is willing to answer for the recipe quality.
- Known limitations are documented.

Popularity alone is not a promotion criterion. Scaffolder does not rely on
telemetry in the open-source core.

## Automated checks

The future `pnpm verify:recipes` command should report:

- manifest validation;
- block compatibility;
- generation success;
- install success;
- build success;
- test success when tests are enabled;
- forbidden hooks or scripts;
- missing files referenced by operations.

CI reports should be understandable to contributors. A failing recipe should
tell the author what to fix instead of producing an opaque failure.

## Manual review focus

Reviewers should look for:

- Is this recipe solving a real setup pain?
- Is it trying to be too broad?
- Are options constrained to known-good combinations?
- Are blocks reusable or too recipe-specific?
- Does the generated project feel like something a developer would keep?
- Would a beginner understand the generated README?
- Are custom dependencies handled as extras instead of magical integrations?

## Reasons to request changes

- The recipe only adds dependencies without required integration files.
- The recipe uses raw patches where structured operations are available.
- The recipe touches unrelated files.
- The recipe depends on an unpinned or live upstream source.
- The recipe includes custom scripts or hooks.
- The recipe hides experimental behavior behind a recommended tier.
- The recipe creates a poor default project structure.

## Reasons to reject

- Arbitrary code execution during generation.
- Network fetches during user generation.
- Unreviewable dependency set.
- License/source metadata concerns.
- Recipe cannot pass baseline verification.
- Recipe duplicates a maintained recommended recipe without a meaningful
  difference.
