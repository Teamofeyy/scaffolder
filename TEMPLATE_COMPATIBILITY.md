# Template Compatibility Policy

Scaffolder combines base framework templates with dependency presets and patch
bundles. This policy defines how those parts are maintained and what users may
expect from stable releases.

## Template sources

Base templates are stored in the `apps/api/templates` Git submodule, backed by
the separate `Teamofeyy/templates` repository. The main repository pins an
exact template commit.

Every released Scaffolder version therefore corresponds to:

- An application commit.
- An exact template submodule commit.
- A dependency-preset snapshot.

## Compatibility guarantee

For combinations marked **Supported**, a stable Scaffolder release guarantees
that the generated project can be installed and built with the runtime versions
documented for that release.

The guarantee applies to the generated output at generation time. It does not
guarantee compatibility with future major versions of frameworks or arbitrary
third-party dependencies.

## Dependency updates

- Patch updates may refresh compatible dependency versions.
- Minor updates may update templates within the same intended framework
  generation and may change generated boilerplate.
- Framework or tool major-version upgrades require explicit compatibility
  testing and are announced in the changelog.
- Dependency presets must not automatically cross a major-version boundary.

## Patch bundles

Patch bundles are applied in layers from generic to specific. A bundle change
must:

- Be scoped to the documented framework and feature combination.
- Fail clearly when a required target or anchor is missing.
- Avoid silently changing unrelated templates.
- Include a generation test or representative generated-project build.

Missing optional targets may be skipped only when the bundle explicitly marks
them as optional.

## Runtime policy

The release documentation must state the Node.js and Rust versions used by CI.
Generated templates may require a newer Node.js version than the Scaffolder
frontend itself. Such requirements must be reflected in the generated
`package.json` or README.

## Experimental templates

Experimental templates:

- May track upstream changes more quickly.
- May have incomplete feature integration.
- May be removed or renamed in a minor release before `1.0.0`.
- Do not receive the same compatibility guarantee as supported combinations.

After `1.0.0`, removal of a previously supported template or option requires a
major release unless the option is affected by an upstream security or
availability emergency.

## Submodule publishing requirement

The template commit referenced by the main repository must exist on the remote
template repository before the main-repository commit is pushed or merged.
Unpublished submodule commits break clean clones and CI checkout.
