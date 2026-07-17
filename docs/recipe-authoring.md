# Recipe Authoring

This document describes how contributors should think about new recipes and
blocks. Recipe, block, and base-template manifests live in `recipes/` and are
validated by `pnpm verify:recipes`.

## Before proposing a recipe

Open a recipe proposal only when you can explain the developer pain it solves.

Good examples:

- "I want a React Router app with Tailwind CSS and shadcn/ui already wired."
- "I want a Vite React app with a minimal app shell and Vitest."
- "I want a dashboard starter that builds and has a sane file structure."

Weak examples:

- "Add every dependency from my favorite stack."
- "Expose all combinations because someone might need them."
- "Generate integration code for arbitrary npm packages."

## Recipe contribution flow

1. Check existing recipes and blocks.
2. Prefer composing existing blocks before adding new ones.
3. Add a recipe manifest in `recipes/catalog/`.
4. Add only the blocks, templates, and structured operations the recipe needs.
5. Keep custom dependencies out of the recipe unless they are part of the
   verified baseline.
6. Run recipe verification.
7. Fill out the recipe pull request checklist.

## Recipe requirements

Each recipe should define:

- stable `id`;
- human-readable `name`;
- short `description`;
- trust `tier`;
- `base_template`;
- composed `blocks`;
- user-configurable `options`;
- verification expectations;
- owner or maintainer information once community recipes are supported.

Validate recipe manifests before opening a pull request:

```bash
pnpm verify:recipes
```

## Block requirements

Each block should define:

- stable `id`;
- `category`: `integration` or `starter`;
- requirements;
- conflicts;
- provided capabilities;
- files touched;
- operations or templates.

Blocks should be narrow. For example, `tailwind-vite` should configure
Tailwind CSS for a Vite project. It should not also create a dashboard layout.

## Operations policy

Use the most structured operation available.

Preferred:

- package.json dependency/script merge;
- tsconfig path/compiler option merge;
- components.json creation or merge;
- file templates for new files;
- controlled templates for known config files.

Allowed only when needed:

- raw text patches;
- anchor-based insertions.

Raw text patches are fragile and should not be the default for recommended
recipes.

## Security policy

Recipes and blocks are declarative.

Forbidden:

- shell hooks;
- JavaScript or TypeScript generator hooks;
- Rust plugin hooks;
- network fetches during generation;
- post-generate commands;
- package installation on the server as part of user generation.

If a recipe needs behavior that cannot be expressed declaratively, propose an
engine feature instead of adding a custom hook.

## Base templates

Do not add new upstream base templates in the same pull request as a recipe.

Flow:

1. Add or update the base template in the templates repository.
2. Bump the pinned templates dependency in Scaffolder.
3. Add the recipe against the already available template snapshot.

This keeps review focused and makes failures easier to diagnose.

## Recommended MVP recipes

The first recipes should be small and high quality:

- `react-router-app`
- optionally `react-vite-app`

The main React recipe should use Tailwind CSS by default or as a required
baseline. shadcn/ui, testing, state management, and custom dependencies should
be optional recipe knobs.
