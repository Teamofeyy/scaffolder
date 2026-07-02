# CLI Design

The CLI is planned as a small API-backed client. It is not implemented in the
current 1.1.0 code path.

## Goals

- Let experienced users create projects without opening the web UI.
- Reuse backend `/presets` and `/generate`.
- Avoid local template generation in the first CLI version.
- Keep installer/package-manager selection out of the contract.

## Planned commands

```bash
scaffolder presets
scaffolder create my-app --preset react-router-tailwind
scaffolder create my-app --framework react --routing react-router --styling tailwind
scaffolder create my-app --api https://scaffolder.example.com --preset next-app-router
```

## MVP architecture

- Package location: `packages/cli`.
- Runtime: Node.js.
- `presets` calls `GET /presets`.
- `create` calls `POST /generate`, downloads the ZIP, and extracts it locally.

## Out of scope for the MVP

- Interactive TUI.
- npm publication as a release blocker.
- Local generation without a backend.
- GitHub export or OAuth flows.
