# Presets

Presets are backend-owned starter configurations returned by `GET /presets`.
The frontend must render these definitions from the API instead of duplicating
the list in UI code.

## Stable presets

| ID | Label | Status |
| --- | --- | --- |
| `react-spa` | React SPA | supported |
| `react-router-tailwind` | React Router App | supported |
| `react-router-data-tailwind` | React Router Data App | supported |
| `vue-app` | Vue App | supported |
| `vue-router-tailwind` | Vue Router App | supported |
| `next-app-router` | Next.js App Router | supported |
| `next-pages-router` | Next.js Pages Router | supported |
| `minimal` | Minimal | supported |

## Contract

Each preset response contains:

- `id`
- `label`
- `description`
- `status`
- `config`

Preset `config` intentionally excludes `project_name`; the UI preserves the
user-entered project name while applying stack options.

## Verification

Supported presets are included in `pnpm run verify:stable-matrix`. The script
fetches `/presets`, filters `status === "supported"`, then verifies generate,
install, and build for each preset.

Do not mark a preset `supported` unless its framework/routing/styling
combination is covered by `/verification-matrix`.
