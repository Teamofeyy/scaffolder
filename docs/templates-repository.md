# Templates Repository Setup

Scaffolder consumes base templates from a separate repository pinned as the
`apps/api/templates` submodule.

Local repository created for this workspace:

```text
/home/teamofey/scaffolder-templates
```

Expected public GitHub repository:

```text
Teamofeyy/scaffolder-templates
```

The submodule URL in `.gitmodules` is:

```text
../scaffolder-templates.git
```

With the Scaffolder remote `git@github.com:Teamofeyy/scaffolder.git`, GitHub
resolves that relative URL to the sibling repository
`git@github.com:Teamofeyy/scaffolder-templates.git`.

## Create The GitHub Repository

Create an empty GitHub repository:

```text
Teamofeyy/scaffolder-templates
```

Do not initialize it with README, license, or `.gitignore`; the local repository
already has history and files.

Push the local repository:

```bash
cd /home/teamofey/scaffolder-templates
git remote set-url origin git@github.com:Teamofeyy/scaffolder-templates.git
git push -u origin main
```

## Current Contents

The templates repository currently contains:

- `react-ts/` - promoted Vite React TypeScript snapshot used by
  `vite-react-ts`;
- `snapshots/vite-react-ts.json` - promoted snapshot metadata;
- historical and candidate template directories copied from the previous
  templates source;
- `README.md` - maintenance rules for template snapshots.

## Update Scaffolder After Template Changes

When the templates repository gets a new promoted commit:

```bash
git -C apps/api/templates fetch origin
git -C apps/api/templates checkout <templates-commit>
pnpm templates:hash -- --path apps/api/templates/react-ts
```

Then update `recipes/base-templates/vite-react-ts.json`:

- `source.ref`;
- `snapshot.commit`;
- `snapshot.hash` if files under `react-ts/` changed;
- `snapshot.promotedAt` when promoting a new snapshot.

Verify:

```bash
pnpm verify:templates
pnpm verify:recipes
```

Commit the Scaffolder submodule pointer and manifest update together.

## Rule

User generation must never fetch the templates repository live. Runtime
generation reads only the pinned local submodule commit.
