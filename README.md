# Narrative Chess

Narrative Chess is a web-based chess game with a lightweight generative narrative layer.

The board is still chess first. The narrative system is there to add flavor, not to obscure legality, board state, or turn flow.

## Current Status

The repository is beyond the first playable prototype and is consolidating city data,
account auth, local/cloud saves, layout tooling, and GitHub Pages deployment.

What is working today:
- local playable chess in a 2D board UI
- legal move validation via `chess.js`
- move history
- undo
- check, checkmate, and stalemate status in the UI
- city-aware boards and city review/editor flows
- structured role and classic game editors
- lightweight narrative event log for moves
- optional Supabase auth, profiles, saved matches, city versions, and multiplayer sync

What is intentionally not in scope yet:
- 3D board rendering
- advanced AI strength
- broad matchmaking/social systems

The current product focus is Milestone 2 city-board stability plus Milestone 6 durability, with early Milestone 7 multiplayer work kept narrow around Supabase turn sync.

## Repository Structure

```text
apps/
  web/                 React + Vite client for the playable local prototype
packages/
  content-schema/      Shared TypeScript and Zod contracts
  game-core/           Chess rules integration, move helpers, and board state
  narrative-engine/    Character roster and move-to-event generation
content/
  templates/           Editable narrative template data
docs/
  prd.md               Working product requirements document
AGENTS.md              Project guidance for coding agents
README.md
```

## Tech Stack

Current implementation:
- React + TypeScript
- Vite
- `chess.js`
- Zod
- Vitest
- ESLint
- Bun workspace

Optional backend:
- Supabase Auth
- Supabase Postgres tables/RPCs guarded by Row-Level Security
- frontend-only Supabase publishable key

## Local Development

This repo uses the Bun workspace defined in [`package.json`](./package.json).

```bash
bun install
bun run dev
```

Useful commands:

```bash
bun install
bun run dev
bun run build
bun run test
bun run lint
bun run typecheck
```

The `dev` and `build` scripts target `apps/web`.

## Supabase Configuration

Supabase is optional for local development. Without Supabase env values, the app falls back to browser-local state and bundled content where possible.

For frontend builds, use only these public Vite variables:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
VITE_ENABLE_SUPABASE_PUBLISHED_CITIES=false
```

Do not put Supabase service-role keys in `.env.local`, GitHub Pages variables, GitHub Pages secrets, or any `VITE_*` variable. Vite exposes `VITE_*` values to browser code.

See [`docs/account-auth-setup.md`](./docs/account-auth-setup.md) for GitHub Pages variables, Auth redirects, and the expected RLS access model.

## Milestone Guidance

The project direction is:
1. chess clarity and correctness
2. lightweight narrative value
3. city-context presentation
4. richer map or 3D presentation later

Current milestone focus:
- keep Play chess-first and turn-correct
- stabilize city-board and authored city data flow
- clarify local draft, file save, repo content, and Supabase-backed state
- keep multiplayer limited to invite/open games, time controls, turn enforcement, and durable move sync

Current non-goals:
- 3D board rendering
- advanced AI strength
- broad matchmaking/social systems
- comic or vignette systems

## Definition Of Done For The First Playable Slice

The first playable slice is considered successful when:
- a player can complete a full local game
- all legal moves validate correctly
- check, checkmate, and stalemate are surfaced in the UI
- undo restores the exact prior game state
- a minimal narrative event is generated for every move

## Working Notes

Before making substantive changes:
1. read [`AGENTS.md`](./AGENTS.md)
2. read [`docs/PRD.md`](./docs/PRD.md)
3. confirm the current milestone
4. work within a bounded package or folder
5. call out schema changes explicitly

Current package boundaries:
- `apps/web` owns UI, route-level composition, and panels
- `packages/game-core` owns chess legality and move/state helpers
- `packages/content-schema` owns shared types and validation schemas
- `packages/narrative-engine` owns event generation and lightweight narrative hooks
- `content/` owns editable structured content
