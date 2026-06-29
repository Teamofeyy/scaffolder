# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm/Turbo monorepo for Scaffolder. The Next.js frontend is in `apps/web`: routes in `app`, UI in `components`, helpers in `lib`, assets in `public`. The Rust backend is in `apps/api/api/src`; generated TypeScript bindings are in `apps/api/api/bindings`. Templates live in the `apps/api/templates` submodule. Root Markdown files define release, support, and security policy.

## Build, Test, and Development Commands

- `pnpm run bootstrap`: install JS dependencies and fetch Cargo dependencies.
- `pnpm dev`: run frontend and API development tasks through Turbo.
- `pnpm build`: build all workspaces.
- `pnpm check`: run format, lint, typecheck, and tests across the monorepo.
- `pnpm --filter nextjs-scaffolder typecheck`: refresh Next.js route types, then run `tsc`.
- `cargo test --manifest-path apps/api/Cargo.toml --locked`: run backend tests.
- `cargo clippy --manifest-path apps/api/Cargo.toml --workspace --all-targets -- -D warnings`: enforce Rust lints.

## Coding Style & Naming Conventions

Use existing tools: ESLint/TypeScript for `apps/web`, `cargo fmt` and Clippy for Rust. Components use PascalCase, hooks/helpers use camelCase, frontend file names follow existing kebab-case patterns, and Rust modules use snake_case. Commit generated bindings when backend schema changes affect the frontend.

## Testing Guidelines

Backend behavior is covered by Rust unit and endpoint tests near implementation files. Add tests for resolver logic, patch operations, validation, runtime limits, and HTTP errors when those areas change. Frontend validation relies on lint, typecheck, and build; run `pnpm --filter nextjs-scaffolder typecheck` after route or i18n changes because it clears stale `.next/types`.

## Commit & Pull Request Guidelines

History mostly follows concise Conventional Commits, for example `feat: verify generated projects in CI`. Use `feat:`, `fix:`, `docs:`, `test:`, or `chore:` with a direct summary. PRs should include the problem, solution, verification commands, linked issues, and screenshots for UI changes. At task end, decide whether to commit only or release now, then provide exact commands.

## Changelog & Release Notes

Every user-facing or behavior-changing task must update `CHANGELOG.md`. For a release, also update `RELEASE_NOTES.md` with summary, upgrade notes, and verification status. Do not duplicate unreleased work into release notes.

## Security & Configuration Tips

Do not relax backend limits, CORS defaults, request body limits, or Swagger exposure without updating `SECURITY.md`, `README.md`, and `CHANGELOG.md`. Keep generated project support aligned with `SUPPORT.md`.

## Agent-Specific Instructions

Use critical engineering judgment. Do not agree to be agreeable; challenge risky assumptions, explain tradeoffs, and choose the approach that fits repository policy, compatibility guarantees, and release quality.
