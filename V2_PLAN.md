# Plan: Fresh-Repo v2 — Chess-First Foundation

## Context

The v1 codebase grew narrative-first on a fragile chess + multiplayer foundation. Multiplayer never became reliable, and persistence drift across localStorage / IndexedDB / files / Supabase is the root architectural pain (per v1 PRD §8.1).

The user wants to **stop accumulating tedious commits on a tangled `main`** and start over cleanly. After weighing subfolder + branch-rename approaches, the chosen path is the simplest possible: **a brand new GitHub repository for v2, with the existing repo renamed and preserved.**

**v2 goal**: rebuild chess-first on a sound foundation. Two players play a reliable real-time game. Then layer narrative (cities, characters, story beats) on top — not before.

---

## Locked decisions

| Decision | Choice |
|---|---|
| Old repo | `redlamp/narrative-chess` → renamed to `redlamp/narrative-chess-v1`. Made private. Left active (no archive) so hotfixes remain possible. |
| New repo | Fresh `redlamp/narrative-chess` (public). Owns the canonical name. |
| GH Pages on v1 | **Goes offline** when v1 repo flips private (free plan limitation). Acceptable per user. |
| v2 stack | Next.js 15 (App Router) + React 19 + TS + Tailwind v4 + shadcn/ui + Zod |
| v2 backend | Supabase (Postgres + Auth + Realtime) — **new project**, do not reuse v1's |
| v2 hosting | Vercel hobby tier (free) |
| Branch policy | `main` (deploys) ← `dev` (active work) ← `feat/*` / `fix/*` (per-task) |
| v2 M1 scope | Working **untimed** multiplayer chess. Clocks deferred to M1.5. Nothing narrative until M2+. |
| Local folder | New folder for v2 (e.g. `C:\workspace\narrative-chess-v2`). Existing folder stays pointing at v1 repo. |

---

## v2 M1 scope (the rebuild target)

**M1 — untimed correspondence chess**

In:
- Account create + login (Supabase Auth)
- Create game / join game by invite link or open list
- Server-side legal-move validation (Server Action + `chess.js`)
- Live move sync between two browsers (Supabase Realtime)
- Win / loss / draw / resign / abort end-states (no time-based loss)
- Smoke e2e: two-browser game starts → ends correctly

Out of M1:
- Clocks (deferred to M1.5)
- Ratings / Elo (M2)
- Vercel Cron (no timeout sweep needed without clocks)
- All narrative / city / character / layout features

**M1.5 — clocks**

Once M1 is rock solid:
- Per-player clocks tracked server-side (column on `games`)
- Tick countdown rendered client-side from server time
- Timeout sweep via Vercel Cron
- Reconnect / pause-on-disconnect policy

**M2+ — narrative layers**

Cities, characters, narrative templates, layouts. Content can be copied from v1 repo when needed — clone v1, copy JSON / data, paste in v2.

---

## Step 1 — Settle v1 working tree

Pre-condition: nothing important lost before the rename.

1. Review pending work in the current `C:\workspace\narrative-chess` folder. Files modified: appSettings.ts, auth.ts, chessMotion.ts, fileSystemAccess.ts, layoutState.ts, etc. Plus session work (`.fallowrc.json`, fileSystemAccess refactor, Fallow cleanups, deleted `use-mobile.ts`, removed `SharedLayoutFileReference`).
2. **For each pending change:** commit it on v1 main, stash it, or discard. Default: commit anything that improves v1, since v1 may need to live on for reference.
3. Push `main` to `origin/main` (currently 9 commits ahead).

Verification: `git status` clean, `git log origin/main..HEAD` empty.

---

## Step 2 — Rename + privatize v1 repo on GitHub

Done via `gh` CLI or GitHub web UI.

```bash
gh repo rename narrative-chess-v1 -R redlamp/narrative-chess
gh repo edit redlamp/narrative-chess-v1 --visibility private --accept-visibility-change-consequences
```

GitHub auto-redirects the old URL → new URL for ~30 days, so existing clone URLs keep working temporarily. Local clone in `C:\workspace\narrative-chess` stays attached to the renamed repo via auto-redirect, but should update its remote URL explicitly:

```bash
cd C:\workspace\narrative-chess
git remote set-url origin https://github.com/redlamp/narrative-chess-v1.git
```

Verification:
- `gh repo view redlamp/narrative-chess-v1` shows the renamed + private repo
- `git push` from the local v1 folder succeeds against new URL
- `redlamp.github.io/narrative-chess` returns 404 (expected — Pages disabled by privacy on free plan)

---

## Step 3 — Create fresh v2 repo

```bash
gh repo create redlamp/narrative-chess --public --description "Chess-first multiplayer game with narrative layer (v2 rebuild)"
```

No initial README / license / gitignore — Next.js scaffold will fill the repo.

---

## Step 4 — Scaffold v2 locally

Pick a fresh local folder so v1 and v2 don't share working directories. Suggested: `C:\workspace\narrative-chess-v2`.

```bash
cd C:\workspace
bun create next-app@latest narrative-chess-v2 --ts --tailwind --app --import-alias="@/*" --no-src-dir --no-eslint --use-bun
cd narrative-chess-v2
git remote add origin https://github.com/redlamp/narrative-chess.git
bunx shadcn@latest init   # accept Tailwind v4 + neutral defaults
bun add @supabase/supabase-js @supabase/ssr chess.js zod
bun add -d @playwright/test
git add . && git commit -m "chore: initial Next.js scaffold + shadcn + supabase clients"
git branch -M main
git push -u origin main
```

Resulting layout:

```
narrative-chess-v2/
  app/
    (auth)/
      login/page.tsx
      sign-up/page.tsx
    games/
      page.tsx              # list active + open games
      new/page.tsx          # create game
      [gameId]/
        page.tsx            # board + game UI (client)
        actions.ts          # server actions: makeMove, resign
    layout.tsx
    page.tsx                # landing
  components/
    ui/                     # shadcn vendored components
    board/                  # chess board (client)
    game/
  lib/
    supabase/
      client.ts             # browser client
      server.ts             # server component / action client
      middleware.ts         # cookie session refresh
    chess/
      engine.ts             # chess.js wrapper
    realtime/
      subscribe.ts          # Supabase Realtime move subscription
  middleware.ts             # auth session refresh
  supabase/
    migrations/             # SQL migrations for v2 schema
  e2e/
    multiplayer-untimed.spec.ts
  .env.local.example
  README.md
  CLAUDE.md                 # agent rails
  AGENTS.md
```

---

## Step 5 — Set up branch policy + Vercel

1. Create `dev` branch off main: `git checkout -b dev && git push -u origin dev`
2. On GitHub: Settings → Branches → set `dev` as default for new PRs (keep `main` protected for production).
3. Connect Vercel:
   - `vercel link` from `narrative-chess-v2/`
   - Vercel auto-detects Next.js
   - Production branch: `main`
   - Preview branches: all others (including `dev` and feat/*)
4. Add Supabase env vars in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - (server-only) `SUPABASE_SERVICE_ROLE_KEY` for server actions

Local `.env.local` mirrors Vercel for dev.

---

## Step 6 — Build M1 untimed multiplayer chess

Each sub-step = own `feat/*` branch off `dev`.

### 6.1 Supabase project + auth shell
- Create *new* Supabase project for v2 (do NOT reuse v1's project — sharing `auth.users` + RLS policies repeats the v1 trap).
- Wire Supabase Auth via `@supabase/ssr` cookie pattern.
- Add `middleware.ts` for session refresh.
- Verify: signup → "logged in" page → refresh keeps session.

### 6.2 DB schema with Realtime publication

Migration `supabase/migrations/0001_init.sql`:

```sql
-- profiles (shadow of auth.users)
create table profiles (
  user_id uuid primary key references auth.users(id),
  display_name text not null
);

-- games — note current_fen + current_turn cached so move append is O(1)
create table games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  white_id uuid references profiles(user_id),
  black_id uuid references profiles(user_id),
  status text not null check (status in ('open','in_progress','white_won','black_won','draw','aborted')),
  current_fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  current_turn text not null default 'w' check (current_turn in ('w','b')),
  ply integer not null default 0
);

-- game_moves (append-only)
create table game_moves (
  game_id uuid references games(id),
  ply integer not null,
  san text not null,
  uci text not null,
  fen_after text not null,
  played_by uuid not null references profiles(user_id),
  played_at timestamptz not null default now(),
  primary key (game_id, ply)
);

-- enable Realtime on both tables
alter publication supabase_realtime add table game_moves;
alter publication supabase_realtime add table games;
```

RLS — **Realtime / RLS interaction must be designed together**:
- `games`: SELECT allowed for participants (white_id or black_id matches caller). Insert via server only.
- `game_moves`: SELECT allowed for participants. Insert via server only.
- Both publications must permit SELECT for the subscribing client; otherwise Realtime fires but client receives nothing — exactly the v1 trap. Test with two test users explicitly before moving on.

### 6.3 Server move validation
- `app/games/[gameId]/actions.ts` — `makeMove(gameId, uci)` server action.
- Loads `games.current_fen` + `current_turn` (NOT replay every move — O(1)).
- Validates with `chess.js`.
- In one transaction: INSERT into `game_moves`, UPDATE `games.current_fen` + `current_turn` + `ply` + `status` if terminal.

### 6.4 Board UI
- Minimal shadcn-styled chess board (client component).
- Click-to-move (drag-drop optional, defer if it slows M1).
- Calls `makeMove`; on error, surface a toast.

### 6.5 Realtime sync
- Client subscribes to `postgres_changes` on `game_moves` filtered by `game_id`.
- INSERT event → push move into local list, update board to `fen_after`.
- Same channel surfaces `games` row updates for status changes.

### 6.6 Game end states
- Checkmate / stalemate detected server-side after each move.
- `resign(gameId)` server action sets status accordingly.
- Abort allowed only before move 1.
- Draw by repetition / 50-move / insufficient material — detected via `chess.js` server-side.

### 6.7 e2e
- Playwright spec at `e2e/multiplayer-untimed.spec.ts`.
- Two browser contexts: User A creates game, User B joins via URL.
- Alternating moves to a known checkmate (e.g. fool's mate variant).
- Must pass before M1 closes.

---

## Step 7 — Agent rails

`CLAUDE.md` at v2 repo root should answer:
- "How do I run dev?" → `bun install && bun dev`
- "Where's the chess core?" → `lib/chess/`
- "Where's persistence?" → server actions only; no localStorage
- "Where's RLS?" → `supabase/migrations/`
- "Branch policy" → feat/* off dev, PR to dev, dev → main = deploy
- "Pulling content from v1" → clone `redlamp/narrative-chess-v1` separately and copy what's needed

`AGENTS.md` mirrors, scoped to v2.

---

## Reuse from v1 (when v2 wants it)

Cloned separately, copied in by hand. Not auto-imported. Likely reuse candidates later:
- Supabase auth patterns (after RLS redesign)
- Reference games seed data (`content/games/classic-games.json`)
- City + role content (M3+): `content/cities/`, `content/templates/`
- Multiplayer diagnostics test ideas

---

## Verification (end-to-end)

After Step 2:
- `redlamp/narrative-chess-v1` exists, is private, contains all v1 history
- Local v1 folder pushes/pulls successfully against new remote URL

After Step 3-4:
- `redlamp/narrative-chess` exists, public, has Next.js scaffold
- `cd narrative-chess-v2 && bun run dev` boots Next.js on http://localhost:3000

After Step 5:
- `dev` branch exists; default for PRs
- Vercel deploys `main` to production URL, deploys `dev` and feat/* to previews

After Step 6 (M1 done):
- Two test users sign up
- User A creates game, User B joins via URL
- Both see same board, alternate legal moves
- Illegal moves rejected by server
- Game ends correctly on checkmate / resign
- `bunx playwright test` passes

---

## What ships when

| Milestone | What ships | Deploy target |
|---|---|---|
| End of Step 2 | v1 archived (renamed + private). v1 GH Pages goes offline. | n/a |
| End of Step 4 | v2 hello-world (Next.js default page) | Vercel preview |
| End of Step 5 | Vercel production wired up | Vercel `main` |
| End of Step 6 | v2 M1 untimed multiplayer chess | Vercel production |
| Future M1.5 | Clocks added | Vercel production |
| Future M2+ | Narrative layers added | Vercel production |
