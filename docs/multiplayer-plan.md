# Multiplayer Plan

Last updated: April 18, 2026

## Goal

Add invite-based multiplayer that supports:

1. one multiplayer game model with time controls
2. live clock play
3. correspondence play with move deadlines
4. durable game history
5. usernames
6. a basic Elo system

Keep scope narrow. Do not build public matchmaking first.

## Product direction

`Play > Games` should evolve toward:

1. `Active`
   a. live multiplayer games
   b. correspondence games waiting on a player
   c. invites and accepted games

2. `Yours`
   a. personal saved games
   b. solo/local runs
   c. archived personal copies

3. `Historic`
   a. reference games
   b. study imports
   c. not multiplayer state

## Naming

Use:

1. `username`
   a. unique
   b. lowercase canonical form
   c. stable for invites and game headers

2. `display_name`
   a. optional
   b. can change more freely

3. `elo_rating`
   a. starts at `1200`
   b. updated only after rated completed games

## Phase 1

### Profiles

Add `profiles` table:

1. `user_id`
2. `username`
3. `display_name`
4. `elo_rating`
5. timestamps

Rules:

1. username unique
2. username required before multiplayer
3. user can edit display name
4. username change should be restricted or deferred

### DB shape

Add:

1. `profiles`
2. `game_threads`
3. `game_participants`
4. `game_moves`

## Phase 2

### Game threads

`game_threads` should hold:

1. `id`
2. `created_by`
3. `city_edition_id`
4. `status`
   a. `invited`
   b. `active`
   c. `completed`
   d. `abandoned`
5. `time_control_kind`
   a. `live_clock`
   b. `move_deadline`
6. `base_seconds`
   a. optional for live clock only
7. `increment_seconds`
   a. optional for live clock only
8. `move_deadline_seconds`
   a. optional for correspondence only
9. `deadline_at`
   a. next required move deadline for correspondence
10. `current_turn`
11. `current_fen`
12. `winner_user_id`
13. `rated`
14. timestamps

### Participants

`game_participants` should hold:

1. `game_id`
2. `user_id`
3. `side`
   a. `white`
   b. `black`
4. `participant_status`
   a. `invited`
   b. `active`
   c. `declined`
   d. `left`

### Moves

`game_moves` should hold:

1. `game_id`
2. `ply_number`
3. `user_id`
4. `from_square`
5. `to_square`
6. `promotion`
7. `fen_after`
8. `snapshot_payload` optional at first
9. timestamps

Move rows are append-only.

## Phase 3

### Invite flow

Start with direct invites by username only.

Reason:

1. simpler permissions
2. easier UX
3. avoids matchmaking/moderation work
4. good for async and sync both

Flow:

1. user enters opponent username
2. creator chooses:
   a. city edition
   b. rated or casual
   c. time control preset
3. invite sent
4. opponent accepts or declines
5. game becomes active

Suggested first presets:

1. `10 min`
   a. live clock
   b. `base_seconds = 600`
   c. `increment_seconds = 0`

2. `15 + 10`
   a. live clock
   b. `base_seconds = 900`
   c. `increment_seconds = 10`

3. `1 move / hour`
   a. correspondence
   b. `move_deadline_seconds = 3600`

4. `1 move / day`
   a. correspondence
   b. `move_deadline_seconds = 86400`

5. `1 move / week`
   a. correspondence
   b. `move_deadline_seconds = 604800`

6. `1 move / month`
   a. correspondence
   b. `move_deadline_seconds = 2592000`

## Phase 4

### Realtime

Use Supabase Realtime only after thread/move model exists.

Realtime should cover:

1. new moves
2. invite updates
3. turn changes
4. maybe presence later

Correspondence does not need presence to work.

## Elo

Keep Elo basic at first.

Rules:

1. start at `1200`
2. only rated completed games count
3. use simple K-factor, start with `32`
4. no provisional rating system at first
5. no team/mode-specific ladders at first

Basic update:

1. expected score from player ratings
2. actual score from result
3. `new_rating = old_rating + K * (actual - expected)`

Do this in a DB function when a rated game is completed.

## RLS

Need strict ownership rules:

1. users can read their own profile
2. public can read limited profile fields needed for multiplayer lookup
3. players can read games they participate in
4. players can insert moves only on their turn
5. players cannot edit prior moves

## UI rollout

1. username claim UI in account details
2. `Games > Active` invite/create state
3. active game list
4. turn indicators
5. accept/decline invite
6. time control badge
7. rated/casual badge
8. result screen with Elo delta
9. completed games list in `Games > Active`
10. creator side choice

## Near-term implementation order

1. scaffold `profiles`
2. add username claim UI
3. add multiplayer schema tables
   a. done: `game_threads`
   b. done: `game_participants`
   c. done: `game_moves`
   d. done: `calculate_elo_delta()`
4. replace `sync/async` with time controls
5. create invite flow
6. append moves to DB
7. poll open active games for opponent moves
8. add rated game completion function
9. subscribe with Realtime

## Deliberate non-goals for first release

1. public matchmaking
2. spectators
3. chat
4. clans/friends/social graph
5. complex ranking tiers
6. tournament mode

## Notes

1. Do not ask users to choose between `sync` and `async` directly.
2. Ask for a time control instead.
3. Live and correspondence are backend variants of the same thread model.
4. The first implementation can keep `play_mode` internally if needed for compatibility, but the product direction should move to explicit time controls.
5. Polling is the first multiplayer refresh path; Realtime can replace it after the turn loop is stable.
