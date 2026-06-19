# Versioning and Migration Policy

## Versioning model

Scaffolder follows [Semantic Versioning](https://semver.org/):

```text
MAJOR.MINOR.PATCH
```

- **MAJOR:** Incompatible API, configuration, generated-output, or support
  contract changes.
- **MINOR:** Backward-compatible features, templates, or supported
  combinations.
- **PATCH:** Backward-compatible fixes, documentation corrections, and
  compatible dependency or template updates.

Pre-release versions use identifiers such as:

```text
1.0.0-alpha.1
1.0.0-beta.1
1.0.0-rc.1
```

## Version scope

The release version represents the complete product:

- Web application.
- Backend API.
- Template submodule revision.
- Dependency presets.
- Deployment configuration.

Workspace package and Rust crate versions should be aligned for stable
releases.

## Public compatibility surface

The following are treated as public contracts after `1.0.0`:

- HTTP endpoints and documented request/response fields.
- Serialized enum values used by the frontend and API.
- Supported combinations listed in `SUPPORTED_COMBINATIONS.md`.
- Generated project layout where documented.
- Environment variables required for production deployment.

Internal patch-bundle layout and implementation details are not public APIs,
but changes must preserve the supported generated output.

## Breaking changes

Examples requiring a major release:

- Removing or renaming a supported framework or option.
- Changing an API field or enum value without backward compatibility.
- Dropping a supported runtime version.
- Requiring users to change production environment variables.
- Making a previously valid stable configuration invalid.

## Generated-project migrations

Scaffolder generates new projects; it does not automatically update projects
created by older releases.

When a release changes generated architecture or framework major versions:

1. `CHANGELOG.md` describes the difference.
2. The release notes identify affected combinations.
3. A migration section provides manual steps when practical.
4. Existing generated projects remain owned and maintained by their users.

## API migrations

Breaking API changes should use one of these strategies:

- Introduce a backward-compatible field first and deprecate the old field.
- Add a versioned endpoint for incompatible behavior.
- Publish a major release with explicit before-and-after request examples.

Deprecated fields should remain available for at least one minor release when
practical.

## Template migrations

Template major upgrades must include:

- Updated dependency presets and patch bundles.
- Successful generated-project installation and build checks.
- Updated runtime requirements.
- Changelog and support-matrix updates.

## Release process

1. Update `CHANGELOG.md`.
2. Confirm supported-combination checks.
3. Align workspace and crate versions.
4. Confirm the template submodule commit is published.
5. Build production containers.
6. Create an annotated Git tag.
7. Publish GitHub release notes.

Release tags use the `v` prefix, for example `v1.0.0`.
