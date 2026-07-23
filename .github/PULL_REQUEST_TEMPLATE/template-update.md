## Template update

Use this template for base template snapshot changes and Scaffolder submodule
bumps. Do not mix recipe behavior changes into the same pull request.

## Summary

- Base template ID:
- Upstream source/ref:
- Templates repository commit:
- Snapshot state: candidate / verified / promoted
- Affected recipes:

## Automation

Run:

```bash
pnpm verify:templates
pnpm templates:classify -- --template <id> --candidate <candidate-path> --verify-affected
```

- [ ] Classification report is attached or linked.
- [ ] Affected recipe verification is green.
- [ ] Snapshot hash in `recipes/base-templates/<id>.json` matches the promoted
      snapshot.
- [ ] Scaffolder submodule pointer pins the exact promoted templates commit.

## Safe auto-promotion

- [ ] Update is patch/minor risk.
- [ ] No lifecycle scripts or hooks were added.
- [ ] No suspicious dependency specifiers were added.
- [ ] No license/source metadata changed.
- [ ] Diff is within expected template files.
- [ ] Snapshot is reproducible from documented upstream source.

## Manual review

Required when any item is checked:

- [ ] Major upstream update.
- [ ] Package manager behavior changed.
- [ ] Base directory structure changed.
- [ ] Large or hard-to-review diff.
- [ ] Affected recipe verification failed.
- [ ] License, attribution, repository, or source metadata changed.

## Rollback plan

- [ ] Previous promoted templates commit is known.
- [ ] Previous snapshot metadata can be restored.
- [ ] Rollback verification command is documented.
