# Narrative Chess

Narrative Chess is a web-based chess game with a lightweight generative narrative layer.

The board is still chess first. The narrative system is there to add flavor, not to obscure legality, board state, or turn flow.

## Current Status

The repository is now bootstrapped into an early Milestone 1 vertical slice.

What is working today:
- local playable chess in a 2D board UI
- legal move validation via `chess.js`
- move history
- undo
- check, checkmate, and stalemate status in the UI
- deterministic placeholder character roster
- minimal narrative event log for moves

What is intentionally not in scope yet:
- multiplayer
- 3D board rendering
- real city mapping
- advanced AI strength
- authored Edinburgh data

The next major product step after this slice is Milestone 2: mapping one city, likely Edinburgh, onto the board without sacrificing chess clarity.

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
- pnpm workspace

Planned later, not yet implemented:
- shadcn/ui or another UI system as needed
- saved games and backend services
- city data pipeline
- richer map-mode and 3D presentation

## Local Development

This repo uses the pnpm workspace defined in [`package.json`](/C:/workspace/narrative-chess/package.json) and [`pnpm-workspace.yaml`](/C:/workspace/narrative-chess/pnpm-workspace.yaml).

If `pnpm` is not already installed globally, use Corepack:

```bash
corepack pnpm install
corepack pnpm dev
```

Useful commands:

```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm build
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
```

The `dev` and `build` scripts target `apps/web`.

## Milestone Guidance

The project direction is:
1. chess clarity and correctness
2. lightweight narrative value
3. city-context presentation
4. richer map or 3D presentation later

Milestone 1 focus:
- legal local chess
- move history
- undo
- clear board UI
- minimal narrative hooks

Milestone 1 non-goals:
- multiplayer
- 3D board
- authored city research
- advanced AI
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
1. read [`AGENTS.md`](/C:/workspace/narrative-chess/AGENTS.md)
2. read [`docs/prd.md`](/C:/workspace/narrative-chess/docs/prd.md)
3. confirm the current milestone
4. work within a bounded package or folder
5. call out schema changes explicitly

Current package boundaries:
- `apps/web` owns UI, route-level composition, and panels
- `packages/game-core` owns chess legality and move/state helpers
- `packages/content-schema` owns shared types and validation schemas
- `packages/narrative-engine` owns event generation and lightweight narrative hooks
- `content/` owns editable structured content
