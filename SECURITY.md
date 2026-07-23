# Security Policy

## Supported versions

The latest stable major version receives security fixes. Older major versions
may receive fixes only when explicitly announced.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Report vulnerabilities through
[GitHub private vulnerability reporting](https://github.com/Teamofeyy/scaffolder/security/advisories/new).
Include:

- A description of the vulnerability and its impact.
- The affected endpoint, component, template, or generated output.
- Reproduction steps or a proof of concept.
- The affected commit or version.
- Any suggested mitigation, if known.

You should receive an initial response within seven calendar days. We aim to
confirm severity and next steps within fourteen calendar days. Resolution time
depends on severity and complexity.

## Disclosure

Please allow the maintainers reasonable time to investigate and release a fix
before publishing details. Confirmed vulnerabilities will be documented in a
GitHub Security Advisory and in `CHANGELOG.md`.

## Scope

Security reports may cover:

- The hosted web application and API.
- Archive generation and temporary workspace handling.
- Dependency and template injection.
- Generated project contents.
- CI/CD and container configuration maintained in this repository.

Vulnerabilities in third-party packages should also be reported to the
upstream project when appropriate.

## Production safeguards

The production deployment uses separate liveness and readiness checks, bounded
container logs, container CPU/memory limits, Caddy access-log rotation, Docker
image SBOM generation in CI, and out-of-band dependency vulnerability review.

AI recommendations are disabled unless both `AI_PROXY_URL` and
`AI_PROXY_SECRET` are configured. The frontend uses `/capabilities` to hide the
AI assistant when the backend reports that AI is unavailable.

Operational metrics and Swagger UI are disabled by default. Enable them only on
trusted internal backend surfaces with `SCAFFOLDER_ENABLE_METRICS=true` or
`SCAFFOLDER_ENABLE_SWAGGER=true`; the production Caddy configuration blocks
`/api/metrics`, `/api/api-docs`, and `/api/swagger-ui*` from public routing.

Project generation and preview requests have bounded JSON body size,
application-level concurrency limits, and request timeouts. Backend validation
rejects malformed project names, unsafe dependency specs, excessive dependency
lists, and unavailable templates before filesystem materialization.
