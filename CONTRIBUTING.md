# Contributing to Scaffolder

Thank you for contributing. Changes should be focused, reproducible, and
covered by tests appropriate to their risk.

## Prerequisites

- Node.js 22
- pnpm 10.10.0
- Rust 1.88.0
- Python 3.12 and `pre-commit`
- Git with submodule support

## Setup

```bash
git clone --recurse-submodules https://github.com/Teamofeyy/scaffolder.git
cd scaffolder
pnpm bootstrap
pre-commit install
```

If the repository was cloned without submodules:

```bash
git submodule update --init --recursive
```

## Development

Run the complete application:

```bash
pnpm dev
```

Run individual services:

```bash
pnpm dev:web
pnpm dev:api
```

## Required checks

Before opening a pull request, run:

```bash
pre-commit run --all-files
cargo test --manifest-path apps/api/api/Cargo.toml --locked
pnpm run build:web
```

Changes to generation behavior should also verify representative generated
projects:

```text
generate -> install dependencies -> lint/typecheck -> build
```

## Template submodule workflow

Templates live in the separate `Teamofeyy/templates` repository.

1. Make and test template changes inside `apps/api/templates`.
2. Commit and push the template repository first.
3. Return to the main repository.
4. Commit the updated submodule pointer together with any matching API changes.

Never commit a submodule pointer to a commit that has not been pushed. CI
cannot fetch unpublished submodule commits.

## Pull requests

- Explain the user-visible behavior and the reason for the change.
- List the tested framework and feature combinations.
- Include screenshots for user-interface changes.
- Update `CHANGELOG.md` for notable changes.
- Update support and compatibility documents when behavior changes.
- Keep unrelated refactors out of the pull request.

## Recipe contributions

Scaffolder is moving toward a recipe-first model. New recipe work should follow
the documented contracts:

- [Recipes](docs/recipes.md)
- [Recipe authoring](docs/recipe-authoring.md)
- [Recipe review](docs/recipe-review.md)
- [Template updates](docs/template-updates.md)

Use `.github/PULL_REQUEST_TEMPLATE/recipe.md` for recipe or block changes. A
recipe should be accepted as `community` only after baseline validation and
should become `recommended` only after maintainer endorsement.

## Commit messages

Use concise Conventional Commit-style messages:

```text
feat: add Vue Router patch bundle
fix: reject invalid dependency names
docs: document supported combinations
```

## Adding or changing a supported combination

A combination may be marked supported only when CI or a documented manual
release check confirms that it can be generated, installed, typechecked or
linted where applicable, and built successfully.

See [SUPPORTED_COMBINATIONS.md](SUPPORTED_COMBINATIONS.md) and
[TEMPLATE_COMPATIBILITY.md](TEMPLATE_COMPATIBILITY.md).
