# Competitive Analysis for 1.1.0

This document summarizes the projects closest to Scaffolder's 1.1.0 scope and
the positioning choices that follow from them.

## Positioning

Scaffolder is a web-first project generator for teams that want a visible,
reviewable configuration workflow before downloading generated code. It is not
trying to replace framework CLIs, broad AI app builders, or full-stack SaaS
platforms. The stable 1.1.0 promise is narrower: deterministic React, Vue, and
Next.js project generation with presets, detailed preview, documented support
boundaries, and verification badges.

## Comparable Projects

| Project | Primary strength | Gap Scaffolder can target |
| --- | --- | --- |
| Vite / create-vite | Fast official scaffolding for many frontend templates. | CLI-first, minimal cross-option preview, and no Scaffolder-specific support matrix or preview details. |
| create-next-app | Official Next.js bootstrap with current Next.js defaults and examples. | Next.js-only; does not cover Vue/React Router combinations in one product workflow. |
| Create T3 App | Opinionated full-stack TypeScript stack for Next.js with modular choices. | Strong for one ecosystem, but not a general previewable generator across React, Vue, and Next.js. |
| React framework recommendations | React docs point users toward frameworks such as Next.js and React Router. | Guidance is distributed across framework docs; Scaffolder can encode supported combinations into one workflow. |
| Bolt | AI-first app and website builder with chat, design-system import, hosting, and cloud features. | Much broader product surface; Scaffolder can stay deterministic, inspectable, and easier to self-host. |
| Lovable | Natural-language full-stack app generation with GitHub sync, collaboration, deployment, and governance. | Strong AI/product platform; Scaffolder can focus on predictable template output and explicit compatibility guarantees. |

## Observations

- Vite documents a broad template set and CLI commands for npm, Yarn, pnpm,
  Bun, and Deno. Scaffolder should not compete by exposing installer
  choice in the API; it should compete on previewable, stable combinations and
  release verification.
- Next.js documents `create-next-app` as the easiest way to create a Next.js
  application and exposes many framework-specific options. Scaffolder should
  treat Next.js as one supported profile, not as the whole product.
- Create T3 App is explicitly focused on full-stack, type-safe Next.js apps and
  modular selection. Scaffolder should avoid copying its opinionated stack and
  instead keep the 1.0.0 surface framework-agnostic across the supported
  frontend profiles.
- React's own docs recommend starting new apps with a framework and list
  Next.js and React Router as first-class choices. That supports Scaffolder's
  stable matrix: React Router, Vue Router, and Next.js router profiles are the
  combinations worth verifying first.
- Bolt and Lovable show that AI-assisted generation is a separate market from
  deterministic scaffolding. Scaffolder's AI recommendations should remain
  optional capability-driven behavior, not a release blocker or core contract.

## 1.1.0 Product Implications

- Keep the stable contract small and testable: React, Vue, Next.js, routing,
  base CSS/Tailwind, linting, preview, and ZIP generation.
- Keep installer selection out of the public API and bindings.
- Promote a combination only after generation, install, and build verification.
- Make presets backend-owned so the UI cannot drift from verified support.
- Use detailed preview as the trust surface: `package.json`, README, entry
  files, dependencies, commands, and verification status before download.
- Make template-submodule availability a hard startup/readiness condition.
- Keep CI/deploy reliable: release images, SBOMs, health checks, diagnostics,
  and rollback behavior matter more than expanding experimental templates.

## Sources

- Vite Getting Started: https://vite.dev/guide/
- Next.js `create-next-app` docs: https://nextjs.org/docs/app/api-reference/cli/create-next-app
- React "Creating a React App": https://react.dev/learn/creating-a-react-app
- Create T3 App docs: https://create.t3.gg/
- Bolt product page: https://bolt.new/
- Lovable documentation: https://docs.lovable.dev/introduction/welcome
