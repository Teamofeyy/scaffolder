# Template Updates

Scaffolder should use official upstream templates without making user
generation depend on live upstream availability or floating branches.

## Policy

User generation reads local promoted template snapshots only.

Do not fetch GitHub, npm, or upstream CLIs during `/generate` or preview
requests.

## Repository boundary

Scaffolder core:

- recipe manifests;
- blocks;
- engine;
- UI/API;
- verification;
- documentation.

Templates repository:

- pinned official base templates;
- upstream source metadata;
- snapshot history.

The current project uses `apps/api/templates` as a Git submodule. That
submodule is the natural place for pinned base template snapshots unless the
repository structure changes.

Scaffolder builds pin the exact templates repository commit through the
submodule pointer and base-template snapshot metadata. Runtime preview and
generation only read the local promoted snapshot under `apps/api/templates`.

## Snapshot states

### Candidate

Downloaded from an official upstream source but not trusted yet.
Candidate snapshots may exist in the templates repository or a maintenance
workspace, but Scaffolder recipes must not reference them for runtime
generation.

### Verified

Affected recipes generated, installed, and built successfully.
Verified snapshots have passed automation but are still awaiting promotion.

### Promoted

Used by Scaffolder generation by default.
Promoted snapshots are the only snapshots non-deprecated recipes may reference.

## Update flow

```text
upstream update detected
  -> create candidate snapshot
  -> verify affected recipes
  -> classify diff risk
  -> promote automatically only if low risk
  -> require manual review for risky changes
  -> bump Scaffolder's pinned templates dependency
```

## Maintenance commands

Verify that Scaffolder pins the expected templates repository commit and that
promoted snapshots match their recorded hash:

```bash
pnpm verify:templates
```

Classify a candidate snapshot before promotion:

```bash
pnpm templates:classify -- --template vite-react-ts --candidate ../templates-candidates/react-ts
```

Classify and verify affected recipes in one run:

```bash
pnpm templates:classify -- \
  --template vite-react-ts \
  --candidate ../templates-candidates/react-ts \
  --verify-affected
```

The classifier writes:

- `artifacts/template-updates/<template-id>.md`;
- `artifacts/template-updates/<template-id>.json`.

Generate a PR checklist from a classification report:

```bash
pnpm templates:pr-plan -- --report artifacts/template-updates/vite-react-ts.json
```

## Safe auto-promotion criteria

An update may be auto-promoted only when all of these are true:

- upstream update is patch or minor risk;
- affected recipes pass verification;
- no new lifecycle scripts appear;
- dependency changes are expected and reviewable;
- license/source metadata does not change;
- directory structure remains compatible;
- diff is within expected template files;
- snapshot is reproducible.

The classifier treats a no-trigger report plus successful affected-recipe
verification as safe for auto-promotion. Maintainers still review the report
before merging the Scaffolder dependency bump.

## Manual review triggers

Manual review is required when:

- upstream has a major version update;
- package manager behavior changes;
- new `postinstall`, `preinstall`, or similar lifecycle scripts appear;
- template directory structure changes;
- affected recipe verification fails;
- diff is large or hard to classify;
- license, attribution, or source metadata changes.

The classifier reports these triggers explicitly. If any trigger is present,
promotion requires manual review.

## Pull request flow

Do not mix base template changes and recipe logic in one pull request.

Recommended flow:

1. Template updater opens or prepares a templates repository change.
2. Template verification runs against affected recipes.
3. Maintainer promotes the snapshot.
4. Scaffolder updates the pinned templates dependency or submodule pointer.
5. Recipe changes are proposed separately.

This keeps the supply chain auditable and makes generated archives
reproducible.

## Scaffolder bump checklist

When a promoted snapshot lands in the templates repository:

1. Update the `apps/api/templates` submodule pointer.
2. Update `recipes/base-templates/<id>.json`:
   - `status`;
   - `source.ref`;
   - `snapshot.commit`;
   - `snapshot.hash`;
   - `snapshot.promotedAt`.
3. Run `pnpm verify:templates`.
4. Run affected recipe verification from the classification report.
5. Commit the submodule pointer and metadata together.

Rollback is the inverse: restore the previous submodule pointer and
base-template snapshot metadata from the last known-good commit, then rerun
`pnpm verify:templates` and affected recipe verification.
