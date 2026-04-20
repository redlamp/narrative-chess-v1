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
| `activeGames.ts` | `archive_game` / `unarchive_game` | authenticated self-participant only, finished threads only |
| `activeGames.ts` | `resign_game` | authenticated active participant, only while thread status is `active` |

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
- `archive_game` / `unarchive_game` are granted only to `authenticated`, only affect the caller's own `game_participants.archived_at`, and require the thread to be in a finished state (`completed`, `cancelled`, `abandoned`).
- `resign_game` is granted only to `authenticated`, requires an active participant on the white or black side, and refuses to run on threads that are no longer `active`; rated settlements reuse the shared `calculate_elo_delta` path.
- `20260420180000_add_multiplayer_realtime_publication.sql` adds `game_threads`, `game_participants`, and `game_moves` to the `supabase_realtime` publication. RLS policies still filter the change stream, so subscribers only see rows they can already read.
- `publish_city_version` checks `auth.uid()` and `has_app_role('admin')` before archiving and publishing city versions.

## Required Before Production Supabase Use

### Resolved: Profile Rating Must Not Be Client-Mutable

Migration `20260419090000_restrict_profile_edit_fields.sql` drops direct authenticated insert/update policies on `profiles` and routes user profile edits through `upsert_current_profile(p_username, p_display_name)`. The RPC accepts only the profile fields users can edit and returns the current `elo_rating`.

Keep this invariant:

- browser code may read the current user's `profiles` row;
- browser code must not insert/update `profiles` directly;
- the rating settlement path in `append_game_move` remains the normal writer for Elo changes.

### Resolved: Version-Control Missing Base Security Objects

`20260418060000_recover_base_schema.sql` recreates the foundation that was present in the live project but not checked in: the `set_updated_at` trigger function, the `cities`/`city_editions`/`city_versions`/`user_roles` tables with their updated-at triggers and RLS enablement, the `has_app_role`/`bootstrap_first_admin` helpers, and the initial set of RLS policies authored for those tables. The file uses `create ... if not exists` and `drop policy if exists` + `create policy` so it is safe to re-apply against the live project (where the objects already exist) and is all a fresh Supabase needs to bootstrap before the rest of the repo migrations run.

`20260418185000_fix_calculate_elo_delta_search_path.sql` mirrors the live-only `fix_calculate_elo_delta_search_path` migration so repo and live converge. On fresh setups it pins `search_path = public` on `calculate_elo_delta` right after `add_multiplayer_game_schema` creates it.

### Resolved: City Draft RLS Match Editor Roles

`20260420200000_consolidate_and_optimize_rls_policies.sql` consolidates `city_versions` SELECT access into one authenticated policy (`status = 'published' OR public.has_app_role('author')`) plus one anon policy (`status = 'published'`), and the existing author-only INSERT/UPDATE policies remain. Draft rows can only be read by authors/admins, and clients still cannot publish directly because `publish_city_version` is the only path that sets `status = 'published'`.

Open follow-up: inserted draft rows still rely on `cityBoards.ts` supplying `created_by`. Adding `default auth.uid()` to `city_versions.created_by` or routing draft save through an RPC (e.g. `save_city_draft_version`) would make the caller record automatic.

### Resolved: Role Reads Are Self-Only With Admin Escape

`20260420200000_consolidate_and_optimize_rls_policies.sql` merges the two overlapping `user_roles` SELECT policies into a single `(select auth.uid()) = user_id OR public.has_app_role('admin')` policy. Write access stays on the admin-only INSERT/UPDATE policies defined in the base schema.

### Recently Applied Advisor Fixes

- `20260420190000_fix_fen_piece_at_search_path.sql` pins `search_path = public` on `fen_piece_at`, closing the `function_search_path_mutable` security lint.
- `20260420200000_consolidate_and_optimize_rls_policies.sql` wraps `auth.uid()` in `(select auth.uid())` inside every affected policy and removes duplicate permissive SELECT policies, addressing `auth_rls_initplan` + `multiple_permissive_policies` performance lints.
- `20260420210000_add_missing_foreign_key_indexes.sql` adds covering indexes on `city_versions.created_by`, `game_moves.user_id`, `game_threads.city_edition_id`, `game_threads.winner_user_id`, and `user_saved_matches.user_id`.

### Deferred By Decision

- Auth leaked-password protection (HIBP) stays disabled. Supabase gates the feature behind the Pro plan and the project is staying on Free for now; revisit when the plan upgrades. No SQL knob — it toggles under Supabase Auth → Providers → Email in the dashboard.
- Seven indexes are flagged as unused (`game_threads_status_updated_idx`, `game_threads_created_by_updated_idx`, `game_moves_game_created_idx`, `game_threads_deadline_idx`, `game_threads_open_invited_idx`, `game_participants_user_archived_idx`, and the three `city_versions_*` / `city_editions_city_id_idx` indexes). Cheap to keep during low-traffic prototype phase; drop once production traffic proves them dead.

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
