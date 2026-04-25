# Account Auth Setup

## GitHub Pages

The GitHub Pages workflow reads these GitHub Actions variables during the Vite build:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_ENABLE_SUPABASE_PUBLISHED_CITIES`

These are public frontend build values, not service-role secrets. Prefer repository variables for these values; secrets are only a fallback in the deploy workflow for projects that already stored them there.

Never store a Supabase service-role key in:

- `apps/web/.env.local`
- repository variables or secrets used by GitHub Pages
- any variable prefixed with `VITE_`

Vite embeds `VITE_*` values into browser code. The app must rely on Supabase Auth, RLS, and narrow RPC functions for authorization.

Local development can copy [`apps/web/.env.example`](../apps/web/.env.example) to `apps/web/.env.local` and fill only the frontend-safe values.

## Supabase Auth URLs

Supabase Auth redirect URLs still need to be configured in the Supabase dashboard because the available MCP tools do not expose Auth URL mutation in this session.

Add these under Supabase Auth URL settings:

- Site URL: `https://redlamp.github.io/narrative-chess/`
- Redirect URL: `http://localhost:5173`
- Redirect URL: `https://redlamp.github.io/narrative-chess/`

Add the future custom domain or subdomain here before testing auth on that domain.

## Current App Flows

- Email/password sign in.
- Email/password sign up with password confirmation.
- Forgot password email.
- Signed-in password update with password confirmation.
- Profile display name update for all signed-in users.
- Username creation for users without a username; username reset only remains visible to admins after a username exists.

## Current Supabase Surface

The browser client is created in `apps/web/src/lib/supabase.ts` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

Current direct table access from the frontend:

- `profiles`: signed-in profile read for the current user; user-edited profile writes go through `upsert_current_profile`.
- `user_roles`: role lookup for the current user.
- `user_saved_matches`: signed-in saved match read/write/delete, including optional `city_metadata`.
- `user_layout_bundles`: signed-in layout bundle read/write.
- `city_versions`: published city reads and draft city reads; draft writes go through `save_city_draft_version`.
- `game_threads`, `game_participants`, `game_moves`: multiplayer session reads for participating players and realtime-backed updates.

Current RPC calls from the frontend:

- `bootstrap_first_admin`
- `upsert_current_profile`
- `save_city_draft_version`
- `publish_city_version`
- `list_active_games`
- `create_game_invite`
- `join_open_game`
- `respond_to_game_invite`
- `append_game_move`
- `cancel_game_invite`
- `claim_game_timeout`
- `archive_game`
- `unarchive_game`
- `resign_game`

Multiplayer also depends on Supabase Realtime subscriptions over `game_threads`, `game_participants`, and `game_moves`, with those tables present in the `supabase_realtime` publication so list and active-game views can refresh from change events.

## Profile Privacy

Treat Supabase Auth email, provider metadata, and session data as private.

Profile fields currently used by the UI:

- `user_id`: private identifier; use for ownership checks, not public display.
- `username`: public multiplayer lookup/display handle.
- `display_name`: public display label when shown to opponents.
- `elo_rating`: public rating when shown in multiplayer contexts.

Do not add sensitive demographic fields to account/profile tables for early milestones. Character diversity belongs in authored narrative/content data with editorial review, not inferred from user accounts.

## RLS Requirements

Before enabling Supabase features for production traffic, confirm RLS is enabled on all app tables and policies match the app access model:

- users can read and update only their own private profile row, while public profile lookup exposes only limited display fields needed for direct invites and open multiplayer game listings.
- users can read/write/delete only their own `user_saved_matches`.
- users can read/write only their own `user_layout_bundles`.
- published city versions can be read by everyone if `VITE_ENABLE_SUPABASE_PUBLISHED_CITIES=true`.
- draft city versions can be read by authorized author/admin users and written only through the author/admin RPC path.
- publish/admin functions are restricted to authorized roles.
- game threads and moves are readable only by participants.
- game moves are inserted through `append_game_move`, which must validate participant, turn, ply order, and immutable prior moves.

See [`supabase-rls-checklist.md`](supabase-rls-checklist.md) for the current frontend query/RPC audit and hardening checklist.

When adding a table or RPC, update this document in the same change so the browser data surface stays reviewable.
