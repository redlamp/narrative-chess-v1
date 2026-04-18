# UI Design System Review

Last updated: April 18, 2026

## Scope

Reviewed the current React/Vite UI against shadcn-style composition, Tailwind-first styling, and Vercel Web Interface Guidelines.

Primary target folders:

1. `apps/web/src/components`
2. `apps/web/src/components/ui`
3. `apps/web/src/App.tsx`
4. `apps/web/src/styles.css`

## Current Direction

1. Keep the current visual language.
2. Prefer shadcn UI primitives for controls.
3. Prefer Tailwind utility classes for new local layout/styling.
4. Keep global CSS for tokens, page-level layout, complex workspace behavior, map/board internals, and legacy surfaces until migrated.

## Findings

### A. shadcn Config

The repo now has a root `components.json`.

Current status:

1. `pnpm dlx shadcn@latest info --json` recognizes the project.
2. Installed local UI primitives are visible to the shadcn CLI.
3. Framework is detected as `Manual`, which is acceptable for this Vite monorepo layout.

### B. Global CSS Is Doing Too Much

`apps/web/src/styles.css` holds most app surface styling.

Risk:

1. hard to review component-level changes
2. hard to keep shadcn/Tailwind conventions consistent
3. custom classes like `field-select` compete with reusable UI primitives

Recommendation:

1. Do not rewrite all CSS at once.
2. Convert one surface at a time.
3. Start with form controls and toolbar controls.

### C. Native Selects Should Move To shadcn-style Select

Known remaining native/custom select patterns:

1. `EdinburghReviewPage.tsx`

Done:

1. `RecentGamesPanel.tsx` Active invite form now uses `components/ui/select.tsx`.
2. `StudyPanel.tsx` historic-game selector now uses `components/ui/select.tsx`.
3. `RoleCatalogPage.tsx` sort, piece type, content status, and review status selectors now use `components/ui/select.tsx`.

Recommendation:

1. Migrate remaining `field-select` usage incrementally.
2. Prefer `Select`, `DropdownMenu`, or `ToggleGroup` depending on the interaction.

### D. Accessibility Cleanup Remains

High-signal issues to keep checking:

1. icon-only buttons need `aria-label`
2. async status messages should use `aria-live` where user-facing
3. custom drag controls need visible focus and keyboard support
4. labels should remain programmatically tied to inputs

Done:

1. `RecentGamesPanel` Active refresh icon button now has `aria-label`.

### E. Tailwind-first Rule

For new code:

1. Use Tailwind utility classes for simple layout, spacing, sizing, and typography.
2. Use global CSS only for repeated tokens, complex workspace mechanics, map/board rendering, and hard-to-express stateful selectors.
3. Do not add new one-off global classes when a short `className` works.

For existing code:

1. Avoid churn-only rewrites.
2. Prefer migration when touching a component for product work.

## Suggested Migration Order

1. Finish `EdinburghReviewPage.tsx` select/dropdown cleanup.
2. Replace custom notice/callout blocks with `Alert` or a shared local equivalent.
3. Move simple panel/form layout classes from CSS into Tailwind.
4. Split `styles.css` only after repeated patterns are stabilized.

## Guardrails

1. Do not change board/chess interaction clarity for cosmetic reasons.
2. Do not refactor multiple pages just to reduce CSS line count.
3. Prefer one visible user-facing improvement per cleanup slice.
4. Keep build and tests green after every slice.
