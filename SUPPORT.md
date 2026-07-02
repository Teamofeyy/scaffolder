# Support Policy

## Support channels

Use [GitHub Issues](https://github.com/Teamofeyy/scaffolder/issues) for:

- Reproducible bugs.
- Incorrect generated output.
- Documentation problems.
- Feature requests with a concrete use case.

Use the private process in [SECURITY.md](SECURITY.md) for vulnerabilities.

## Information required for bug reports

Include:

- Scaffolder version or commit SHA.
- Framework and all selected options.
- Node.js and npm versions used to install or build the generated project.
- Steps to reproduce.
- Expected and actual behavior.
- Relevant logs and generated files.

Remove secrets, private registry credentials, and proprietary source code
before attaching files.

## Support levels

- **Supported:** Covered by the published support matrix and release checks.
- **Experimental:** Available for evaluation, but may have incomplete feature
  integration or weaker test coverage.
- **Coming later:** Visible or documented as planned, but not offered as a
  supported generator option in the current release.
- **Unsupported:** Outside the documented environment or rejected by the API.

Experimental features may change without a major-version release until they
are promoted to supported status.

The API exposes support status through `/features`, `/presets`, and
`/preview/details`. The frontend should display those backend statuses instead
of maintaining a separate stable/experimental list.

## Response expectations

This is an open-source project without a guaranteed service-level agreement.
Maintainers prioritize security issues, regressions in supported combinations,
and data-loss or invalid-output bugs.

## Third-party dependencies

Scaffolder cannot guarantee support for arbitrary packages added through npm
search. Package compatibility remains the responsibility of the generated
project's maintainer.
