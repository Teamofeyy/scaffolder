# Verification Matrix

`GET /verification-matrix` returns the static release manifest used for
stable badges and detailed preview verification status.

## 1.1.0 manifest

The 1.1.0 matrix covers:

- React with no router, React Router, and React Router Data APIs.
- Vue with no router and Vue Router.
- Next.js with App Router and Pages Router.
- CSS Modules/base CSS and Tailwind CSS variants.

Each combination records:

- `framework`
- `routing`
- `styling`
- `generate`
- `install`
- `build`

`state_management` and `testing` may be present when a future release promotes
those options into the stable matrix.

## UI usage

The UI should show a verified badge only when the selected configuration has a
matching matrix entry with `generate`, `install`, and `build` all true.

Experimental templates may be visible, but they must not receive the stable
verified badge unless they are promoted and added to this manifest.

## Release process

Before tagging a release:

```bash
pnpm run verify:stable-matrix
```

When candidate frameworks such as Svelte or Solid are evaluated, use a separate
candidate matrix run instead of silently expanding the stable manifest.
