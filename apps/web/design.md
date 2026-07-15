# Design - Scaffolder Web

A locked visual system for the Scaffolder frontend. Page work in `apps/web`
should preserve this system and extend it only when the app adds a materially
different surface.

## Genre

modern-minimal

## Macrostructure Family

- App pages: Component Playground / Project Foundry. The page is a live
  assembly station: recipe summary, guided configuration, generated blueprint,
  and a persistent archive action. The preview is the visual asset.
- Content pages: Long Document if documentation-like routes are added later.
- Marketing pages: Marquee Hero or Workbench, using the same theme and CTA
  voice.

## Theme

- `--color-paper` oklch(0.9750 0.0100 155.0000)
- `--color-paper-2` oklch(0.9500 0.0120 155.0000)
- `--color-ink` oklch(0.2450 0.0300 155.0000)
- `--color-ink-2` oklch(0.5100 0.0300 155.0000)
- `--color-rule` oklch(0.8850 0.0200 155.0000)
- `--color-accent` oklch(0.5000 0.1450 145.0000)
- `--color-focus` oklch(0.5000 0.1450 145.0000)
- `--color-console` oklch(0.1850 0.0260 155.0000)
- `--color-console-2` oklch(0.2350 0.0300 155.0000)

## Typography

- Display: Geist, weight 700, style normal
- Body: Geist, weight 400
- Mono: Geist Mono, weight 600, for file paths, package names, and compact
  technical values only
- Display tracking: 0
- Type scale anchor: display headings use Tailwind responsive text utilities,
  capped so the app workbench remains visible above the fold

## Spacing

Use Tailwind's 4-point scale and existing shadcn-compatible radius tokens.
Cards stay at 8 px radius or below. Prefer gaps over stacked margins. App
pages use one strong dark console band plus light work panels, not a flat
white settings page.

## Motion

- Motion stance: quiet, functional only
- Easings: Tailwind defaults are acceptable for simple color changes; custom
  motion must use `cubic-bezier(0.16, 1, 0.3, 1)`
- Reduced motion: no required spatial reveals in the app shell

## Microinteractions Stance

- Use silent success unless the result is hidden by a download or async failure.
- Buttons and controls define explicit transition properties, never
  `transition-all`.
- Focus rings appear immediately via `focus-visible`.

## CTA Voice

- Primary CTA: compact green fill, icon plus one-line verb label.
- Secondary actions: outline or ghost controls with one-line labels.

## Per-Page Allowances

- App pages may use a dark console band and blueprint/grid surfaces when they
  carry real controls or preview output.
- Technical summaries may use compact definition lists or plain code text, but
  never fake terminal/browser/IDE chrome.

## What Pages Must Share

- Brand mark and Scaffolder wordmark.
- Green accent placement for active states and primary generation actions.
- Geist and Geist Mono roles.
- 8 px card/control radius cap.
- A recipe header, guided builder, blueprint preview, and persistent generation
  dock on the primary app route.
- One containment layer per region.

## What Pages May Differ On

- Grid proportions between configuration and preview areas.
- Whether the app page reads more as a two-column builder or a three-zone
  recipe / builder / blueprint surface.
- Preview content density as backend capabilities grow.
- Empty-state copy and inline status treatments.

## Exports

### tokens.css

```css
:root {
  --color-paper: oklch(0.9750 0.0100 155.0000);
  --color-paper-2: oklch(0.9500 0.0120 155.0000);
  --color-ink: oklch(0.2450 0.0300 155.0000);
  --color-ink-2: oklch(0.5100 0.0300 155.0000);
  --color-rule: oklch(0.8850 0.0200 155.0000);
  --color-accent: oklch(0.5000 0.1450 145.0000);
  --color-accent-ink: oklch(0.9850 0.0100 145.0000);
  --color-focus: oklch(0.5000 0.1450 145.0000);
  --color-console: oklch(0.1850 0.0260 155.0000);
  --color-console-2: oklch(0.2350 0.0300 155.0000);
  --font-display: "Geist", "Geist Fallback", sans-serif;
  --font-body: "Geist", "Geist Fallback", sans-serif;
  --font-outlier: "Geist Mono", "Geist Mono Fallback", monospace;
  --radius-card: 0.5rem;
  --radius-input: 0.5rem;
}
```

### Tailwind v4 `@theme`

```css
@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --font-sans: "Geist", "Geist Fallback";
  --font-mono: "Geist Mono", "Geist Mono Fallback";
}
```

### shadcn/ui CSS variables

The active implementation lives in `app/globals.css` and maps these tokens to
the existing `--background`, `--foreground`, `--primary`, `--card`, `--border`,
`--input`, and `--ring` variables.
