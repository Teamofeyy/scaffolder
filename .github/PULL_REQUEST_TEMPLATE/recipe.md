## Recipe pull request

Use this template for new or changed recipes and blocks.

## Summary

- Recipe or block IDs:
- Trust tier requested: community / experimental / recommended
- Base template:
- Problem this solves:

## Author checklist

- [ ] The recipe solves a specific developer setup pain.
- [ ] The recipe uses an existing pinned base template.
- [ ] The change does not fetch network resources during generation.
- [ ] The change does not add arbitrary scripts, hooks, or plugin execution.
- [ ] Blocks declare requirements, conflicts, provided capabilities, and files
      touched.
- [ ] Options are constrained to combinations the recipe actually supports.
- [ ] Custom dependencies, if any, only affect package.json.
- [ ] Generated README or docs explain the resulting stack.
- [ ] The recipe does not duplicate an existing recipe without a clear reason.

## Verification

CI runs:

```bash
pnpm verify:recipes
```

This includes manifest validation, preview smoke, ZIP generation, forbidden
script checks, dependency review, install, build, and tests when enabled.

Local verification:

- [ ] Project generation succeeds.
- [ ] Preview shows the important files.
- [ ] Dependency installation succeeds.
- [ ] Production build succeeds.
- [ ] Tests pass when the recipe enables tests.
- [ ] No forbidden package lifecycle scripts or install hooks are added.
- [ ] Dependencies are scoped to the recipe goal and avoid URL/git/file specs.

## Community acceptance

- [ ] Default recipe baseline is green in CI.
- [ ] Generated project is understandable without hidden manual steps.
- [ ] Limitations are documented.

## Recommended promotion

Fill this only when requesting `recommended`.

- [ ] Full option matrix is green in CI.
- [ ] Recipe status is `active`.
- [ ] Base template is verified or promoted.
- [ ] All reachable blocks are stable.
- [ ] Defaults are suitable for a broad developer audience.
- [ ] `package.json` and `README.md` are visible in curated preview.
- [ ] Maintainer explicitly approves promotion.

## Maintainer review

- [ ] Community acceptance checklist passed.
- [ ] Dependency set is reasonable.
- [ ] Generated project structure is acceptable.
- [ ] Known limitations are documented.
- [ ] Recommended promotion, if requested, is explicitly approved by a
      maintainer.
