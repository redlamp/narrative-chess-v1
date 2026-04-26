# Multiplayer Self-Test Guide

Use this guide to test multiplayer by yourself against the hosted dev Supabase project.

## Required Setup

- Use two different accounts with two different usernames.
- Open Player A in a normal browser profile.
- Open Player B in a different browser profile, a private profile with separate storage, or a different browser.
- Do not use two tabs in the same browser profile as two players. Supabase Auth storage is shared per profile, so both tabs represent the same signed-in account.

## Hosted Dev Smoke Test

1. Sign in as Player A and confirm the app menu shows username A.
2. Sign in as Player B in the second browser profile and confirm the app menu shows username B.
3. Player A creates a direct invite to username B, or creates an open game.
4. Player B accepts the invite or joins the open game.
5. Load the game on both profiles from `Open Games`.
6. Confirm the loaded multiplayer diagnostics show different accounts and opposite sides.
7. On Player A, confirm black pieces cannot be selected before White moves.
8. Player A makes White's first move, then uses the board header `Confirm` button.
9. Confirm Player A's `Confirm` and `Clear` buttons disappear after sync.
10. Confirm Player B receives the move without using manual refresh and can select only black pieces.
11. Player B makes Black's reply, then uses the board header `Confirm` button.
12. Confirm Player A receives the reply without using manual refresh and can select only white pieces.

## Turn-Enforcement Checks

- Pending local multiplayer moves should show `Clear` and `Confirm` in the board header.
- `Confirm` should call the server, clear the pending buttons, and push the move to the opponent client through Supabase Realtime.
- Manual refresh should remain a recovery/debug action, not the normal move-delivery path.
- `MP diagnostics` should show:
  - the signed-in account username or email
  - `Side`
  - `Turn`
  - game `Status`
  - synced ply count
  - input lock state
- If a profile can move when the diagnostics say it is waiting, treat that as a client bug.
- If the client allows a wrong-side move attempt but Supabase rejects it, server enforcement is still working; keep the rejection message and refresh behavior visible for triage.

## Playwright QA

Playwright is configured for browser smoke tests.

```powershell
bun run e2e
```

The default e2e run starts the Vite dev server and runs the no-credential Play board smoke test. To watch the browser:

```powershell
bun run e2e:headed
```

The hosted multiplayer smoke is skipped unless two test accounts are provided. Use dedicated hosted-dev accounts only: no personal accounts, no admin role, and no production data.

Copy the example file and fill in the local copy:

```powershell
Copy-Item .env.e2e.example .env.e2e.local
notepad .env.e2e.local
```

`.env.e2e.local` is gitignored and loaded automatically by `playwright.config.ts`. After filling it in, run:

```powershell
bun run e2e -- e2e/multiplayer-flow.spec.ts
```

That spec uses two isolated browser contexts, signs in both accounts, creates a White-side direct invite from Player A to Player B, accepts it, loads the game in both clients, confirms `e2-e4`, waits for Player B to receive it without refresh, then confirms `e7-e5` and waits for Player A to receive it without refresh.

## Hosted Supabase Verification

- Confirm all current migrations are applied to the hosted dev project.
- Confirm `20260419114500_validate_multiplayer_move_side.sql` is applied, or that a later migration redefining `append_game_move` includes the same checks.
- Confirm `20260425110000_fix_invite_rpc_ambiguous_game_id.sql` is applied if Cancel or Decline ever reports `column reference "game_id" is ambiguous`.
- Confirm the current `append_game_move` RPC rejects:
  - a user who is not an active participant in the game
  - an active participant moving when `current_turn` does not match their participant `side`
  - a submitted snapshot whose latest move side does not match the participant side
  - a move from a square containing the opponent's piece
- Do not use stale games created before side validation as proof of current behavior.

## Interpreting Common Results

- One account in two tabs appears to control both sides: invalid test setup unless diagnostics show different accounts.
- Two browser profiles show the same account: sign out in one profile and sign into the second test account.
- `Side` changes unexpectedly after refresh: inspect `game_participants` rows for duplicate or incorrect participant rows.
- `Turn` does not change after a move: refresh the loaded game and inspect whether `append_game_move` returned the new `current_turn`.
- Server accepts a wrong-side move: stop testing the UI and fix the hosted RPC/migration state first.

## Clearing Stale Dev Games

Prefer archiving stale dev games over deleting them. This keeps historical rows available for debugging while removing them from normal player views.

```sql
-- Finish old pending or active dev games.
update public.game_threads gt
set
  status = 'abandoned',
  result = 'abandoned',
  completed_at = coalesce(gt.completed_at, now()),
  current_turn = null,
  turn_started_at = null,
  deadline_at = null,
  is_open = false
where gt.status in ('invited', 'active')
  and gt.created_at < now() - interval '1 day';

-- Hide old finished dev games from every participant's normal list.
update public.game_participants gp
set archived_at = coalesce(gp.archived_at, now())
from public.game_threads gt
where gp.game_id = gt.id
  and gt.status in ('completed', 'cancelled', 'abandoned')
  and gt.created_at < now() - interval '1 day';
```

For a dev-only hard reset, delete old thread rows only after confirming the foreign keys cascade to `game_participants` and `game_moves` in that environment.

```sql
delete from public.game_threads gt
where gt.created_at < now() - interval '1 day';
```
