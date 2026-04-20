# Supabase RLS Checklist

Audit date: April 19, 2026

Scope:

- frontend Supabase calls in `apps/web/src`
- checked-in migrations in `supabase/migrations`
- current Milestone 2 and Milestone 6 durability work

This is an implementation checklist, not a proof that the live Supabase project matches the repo. Re-run it whenever a table, RPC, or frontend Supabase adapter changes.

## Frontend Data Surface

Direct table access:

| Module | Table | Operation |
| --- | --- | --- |
| `auth.ts` | `user_roles` | read current user's role |
| `profiles.ts` | `profiles` | read current user's profile |
| `savedMatchesCloud.ts` | `user_saved_matches` | list/upsert/delete current user's saved matches |
| `layoutCloud.ts` | `user_layout_bundles` | read/upsert current user's layout bundle |
| `cityBoards.ts` | `city_versions` | read published versions, read latest draft, insert draft version |
| `cityBoards.ts` | `city_editions` via embedded select | read playable published city metadata |
| `activeGames.ts` | `game_threads`, `game_participants` | read current participant's game session, turn, and clock state |
| `activeGames.ts` | `game_moves` | read latest move snapshot for current participant's game |

RPC access:

| Module | RPC | Expected privilege boundary |
| --- | --- | --- |
| `auth.ts` | `bootstrap_first_admin` | authenticated, internally limited to first-admin bootstrap rule |
| `cityBoards.ts` | `publish_city_version` | authenticated admin only |
| `profiles.ts` | `upsert_current_profile` | authenticated, writes only username/display name |
| `activeGames.ts` | `list_active_games` | authenticated, returns caller games plus limited open-game listings |
| `activeGames.ts` | `create_game_invite` | authenticated, validates username or open-game intent, city edition, side, and time control |
| `activeGames.ts` | `join_open_game` | authenticated, joins only available open games through server-side checks |
| `activeGames.ts` | `respond_to_game_invite` | authenticated invite participant only |
| `activeGames.ts` | `append_game_move` | authenticated active participant, current turn only |
| `activeGames.ts` | `claim_game_timeout` | authenticated opposing active participant, after `deadline_at` has passed |
| `activeGames.ts` | `cancel_game_invite` | authenticated invite creator only, while status is `invited` |

## Confirmed In Checked-In Migrations

- `user_saved_matches` has RLS enabled and owner-only select/insert/update/delete policies.
- `user_layout_bundles` has RLS enabled and owner-only select/insert/update policies.
- `profiles` has RLS enabled, owner-only select policy, and profile edits routed through `upsert_current_profile`.
- `game_threads`, `game_participants`, and `game_moves` have RLS enabled and participant-only read policies.
- Multiplayer mutations are routed through `SECURITY DEFINER` RPCs instead of direct table insert/update policies.
- `20260419093000_add_multiplayer_clock_state.sql` stores live-clock remaining seconds and turn start timestamps on `game_threads`.
- `list_active_games` is granted only to `authenticated`; it joins through the caller's participant row and separately exposes limited open-game listings.
- `create_game_invite` is granted only to `authenticated` and resolves opponent username or open-game creation inside the RPC.
- `join_open_game` is granted only to `authenticated`; open-game discovery remains constrained to the limited `list_active_games` RPC output.
- `append_game_move` is granted only to `authenticated` and validates participant status, game status, side, turn, square format, promotion, and immutable ply ordering before inserting a move.
- `claim_game_timeout` is granted only to `authenticated`, requires an active participant on the non-current-turn side, and refuses to settle the thread until `deadline_at` has passed; rated settlements reuse the `calculate_elo_delta` path.
- `cancel_game_invite` is granted only to `authenticated`, only lets the original `created_by` user cancel a thread whose status is still `invited`, and marks the thread cancelled instead of allowing client-side deletion.
- `publish_city_version` checks `auth.uid()` and `has_app_role('admin')` before archiving and publishing city versions.

## Required Before Production Supabase Use

### Resolved: Profile Rating Must Not Be Client-Mutable

Migration `20260419090000_restrict_profile_edit_fields.sql` drops direct authenticated insert/update policies on `profiles` and routes user profile edits through `upsert_current_profile(p_username, p_display_name)`. The RPC accepts only the profile fields users can edit and returns the current `elo_rating`.

Keep this invariant:

- browser code may read the current user's `profiles` row;
- browser code must not insert/update `profiles` directly;
- the rating settlement path in `append_game_move` remains the normal writer for Elo changes.

### P0: Version-Control Missing Base Security Objects

The checked-in migrations reference objects that are not defined in the local migration set:

- `cities`
- `city_editions`
- `city_versions`
- `user_roles`
- `has_app_role`
- `bootstrap_first_admin`
- `set_updated_at`

Before relying on a fresh Supabase environment, add or recover migrations for these objects and their grants/RLS policies. Until then, the repo cannot fully reproduce or audit the live database security model.

### P0: City Draft RLS Must Match Editor Roles

`cityBoards.ts` directly reads and inserts `city_versions` draft rows. The database must enforce:

- published city versions are readable by anonymous or authenticated users only when intended for Play;
- draft city versions are readable only by author/admin users;
- draft inserts are allowed only to author/admin users;
- inserted draft rows record the caller as creator, ideally with `created_by default auth.uid()`;
- clients cannot insert rows with `status = 'published'` directly.

If those policies become hard to reason about, move draft save into an RPC like `save_city_draft_version`.

### P0: Role Reads Must Be Self-Only And Writes Server-Controlled

`auth.ts` reads `user_roles` directly for the current user. The table policy must allow users to read only their own role and must not allow client-side inserts, updates, or deletes. Admin role assignment should happen through reviewed SQL/admin tooling or a narrow admin RPC.

## Recommended Hardening

- Add explicit `revoke all` / `grant execute to authenticated` statements for `publish_city_version`, matching the multiplayer RPC migrations.
- Prefer RPC-based city draft saving so version-number allocation and role checks happen in one transaction.
- Add a unique constraint that prevents more than one `published` city version per `city_edition_id`, or keep enforcing it transactionally in publish RPCs.
- Consider changing `user_saved_matches` from global primary key `id` to `(user_id, id)` so independent users cannot collide on a saved-match id.
- Keep opponent profile exposure inside `list_active_games`; do not add broad public `profiles` read policies unless the selected columns are intentionally public.
- Keep direct `game_moves` writes disabled. Moves should continue through `append_game_move`.

## Review Checklist For Future Supabase Changes

For every new frontend Supabase call:

1. Identify whether the call is direct table access or RPC.
2. If direct table access, confirm RLS covers row ownership and column-level grants protect privileged fields.
3. If RPC, confirm it checks `auth.uid()` and validates all caller-controlled ids.
4. Confirm execute grants are limited to the narrowest required role.
5. Confirm public data is intentionally public and does not include Auth email or provider metadata.
6. Update `docs/account-auth-setup.md` and this checklist in the same change.
