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

Run these when the tooling exists:

```bash
pnpm verify:recipes
```

Current manual verification:

- [ ] Project generation succeeds.
- [ ] Dependency installation succeeds.
- [ ] Production build succeeds.
- [ ] Tests pass when the recipe enables tests.
- [ ] Preview shows the important files.

## Maintainer review

- [ ] Community acceptance checklist passed.
- [ ] Dependency set is reasonable.
- [ ] Generated project structure is acceptable.
- [ ] Known limitations are documented.
- [ ] Recommended promotion, if requested, is explicitly approved by a
      maintainer.
