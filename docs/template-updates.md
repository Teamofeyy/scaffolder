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

## Snapshot states

### Candidate

Downloaded from an official upstream source but not trusted yet.

### Verified

Affected recipes generated, installed, and built successfully.

### Promoted

Used by Scaffolder generation by default.

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

## Manual review triggers

Manual review is required when:

- upstream has a major version update;
- package manager behavior changes;
- new `postinstall`, `preinstall`, or similar lifecycle scripts appear;
- template directory structure changes;
- affected recipe verification fails;
- diff is large or hard to classify;
- license, attribution, or source metadata changes.

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
