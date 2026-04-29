# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Bun workspace. Run from repo root.

```bash
bun install
bun run dev         # apps/web Vite dev server (filtered to @narrative-chess/web)
bun run build       # apps/web Vite build
bun run test        # vitest run (apps/** + packages/**)
bun run test:watch
bun run lint        # eslint .
bun run typecheck   # tsc --noEmit (root tsconfig covers apps + packages)
bun run security:scan   # scripts/check-public-secrets.mjs — blocks service-role/secret patterns in tracked files
```

Single vitest file: `bunx vitest run apps/web/src/savedMatches.test.ts` (or `... -t "case name"`).

Playwright e2e (`bun run e2e`, `e2e:headed`, `e2e:ui`):
- Auto-spawns dev server on `127.0.0.1:5173` unless `PLAYWRIGHT_BASE_URL` set.
- Requires `.env.e2e.local` (template in `.env.e2e.example`) with two test-only Supabase accounts. `multiplayer-flow.spec.ts` skips without them.
- Single test: `bunx playwright test e2e/play-board.spec.ts`.

CI (`.github/workflows/deploy-pages.yml`) runs typecheck → security:scan → build → deploys `apps/web/dist` to GitHub Pages on push to `main`.

## Architecture

### Workspace layout
- `apps/web` — React 19 + Vite SPA. Owns UI, panels, page composition, browser persistence, Supabase clients. Vite alias `@/*` → `apps/web/src/*` (also in root `tsconfig.json` paths).
- `packages/content-schema` — Zod schemas + TS contracts. The single source of shared types between game-core, narrative-engine, and the web app. Schema changes ripple — call them out.
- `packages/game-core` — `chess.js` wrapper. Returns immutable `GameSnapshot` / `MoveApplication` records keyed by `pieceId`. UI consumes snapshots; never put chess legality in components.
- `packages/narrative-engine` — move-to-event mapping + character roster. Imports `content/templates/narrative-data.json` directly (build-time bundled).
- `content/` — checked-in authored data: `cities/*-board.json`, `games/classic-games.json`, `templates/narrative-data.json`, `styles/piece-styles.css`. Treated as canonical content source.
- `layouts/` — bundled default workspace + page layouts shipped with the build (consumed by `apps/web/src/bundledLayouts.ts` / `pageLayoutBundle.ts`).
- `supabase/migrations/` — SQL migrations. Multiplayer flows depend on RPCs (`append_game_move`, `claim_game_timeout`, `resign_game`, `publish_city_version`, …) with Row-Level Security; client never bypasses them.

### Persistence model (this is the trickiest part of the codebase)
State for the same concept can live in up to four places. Persistence fragmentation is called out in `docs/PRD.md` as the biggest active problem.

1. **`localStorage`** — `appSettings`, workspace + page layouts, saved matches, role catalog drafts, city drafts, piece styles. See `*State.ts` / `saved*.ts` modules in `apps/web/src/`.
2. **IndexedDB** — persisted File System Access directory handles (`fileSystemAccess.ts`).
3. **Local files** via File System Access API — JSON drafts + CSS export/import. Optional; gated by browser support.
4. **Checked-in `content/` + `layouts/` JSON** — canonical defaults baked into the bundle.
5. **Supabase (optional)** — auth/profile, cloud saved matches, layout bundles, published/draft city versions, multiplayer game threads + moves. Modules suffixed `*Cloud.ts` (`layoutCloud.ts`, `savedMatchesCloud.ts`, `activeGames.ts`, `profiles.ts`, `auth.ts`). App falls back to local-only if env vars missing.

When touching anything stateful, identify which of these layers owns the truth for your feature and whether a draft/published/cloud distinction applies.

### Pages
Six top-level surfaces composed in `App.tsx`: Play, Cities, Classics, Roles, Research, Design. Play + Cities share `BoardPanel`. Most pages have lazy-loaded route components plus dedicated `*State.ts` + `*Files.ts` modules for browser/local-file persistence.

### Multiplayer
Client locks the board for non-player side and non-turn states; server-side `append_game_move` RPC re-validates participant, side, turn, square format, promotion, and ply order. Live clocks + correspondence deadlines settled via `claim_game_timeout`; `resign_game` concedes. `multiplayerDiagnostics.ts` powers a self-test surface — see `docs/multiplayer-self-test.md`.

## Constraints

### Supabase env (frontend-only)
Use only public Vite vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ENABLE_SUPABASE_PUBLISHED_CITIES`. Never put service-role or `sb_secret_*` keys in `VITE_*`, `.env.local`, GH Pages vars/secrets, or any tracked file — `security:scan` will fail the build.

### Vite base path
`apps/web/vite.config.ts` sets `base` to `/narrative-chess/` when `GITHUB_ACTIONS=true`, `/` otherwise. Asset paths must respect this; don't hardcode absolute paths.

### Package boundaries (enforced by `AGENTS.md`)
- No chess legality in `apps/web` components — go through `packages/game-core`.
- No narrative template logic in components — go through `packages/narrative-engine`.
- `content-schema` is types/Zod only, no runtime business logic.
- Don't create new packages without a clear ownership boundary.

### Milestone focus
Active: **Milestone 2 (City Board)** + **Milestone 6 (Durable Content + Save)**, with narrow Milestone 7 multiplayer work. Out of scope: 3D rendering, advanced AI, broad matchmaking. See `docs/PRD.md` Section 6 for full status before widening any task.

### Character/content rules
Lightweight only: name, role, district, faction, curated traits/verbs, one-line description. Avoid procedural assignment of religion/sexuality/ethnicity as structured fields. Separate appearance from moral framing. Full rules in `AGENTS.md`.

## Reference docs
- `AGENTS.md` — agent rules, package boundaries, content rules, output expectations. Read before non-trivial changes.
- `docs/PRD.md` — milestone status, architecture snapshot, persistence problem statement.
- `docs/account-auth-setup.md` — Supabase Auth + RLS access model.
- `docs/multiplayer-plan.md`, `docs/multiplayer-self-test.md` — multiplayer flow + diagnostics.
- `docs/MOBILE.md` — mobile support plan.
